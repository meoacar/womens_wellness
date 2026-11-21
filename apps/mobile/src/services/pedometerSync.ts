import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pedometer } from 'expo-sensors';
import {
  AppState,
  AppStateStatus,
  NativeEventEmitter,
  NativeModules,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { queryClient } from '../lib/queryClient';
import { wellnessService } from './api';
import { widgetSyncService } from './widgetSync';
import { usePedometerStore } from '../store/pedometerStore';
import { healthConnectSyncService } from './healthConnectSync';

const STORAGE_KEY = '@wellness_auto_pedometer_v1';
const PROMPTED_KEY = '@wellness_pedometer_prompted_v1';
const NOTIF_PROMPTED_KEY = '@wellness_step_notif_prompted_v1';

interface PersistedPedometerState {
  enabled: boolean;
  dateKey: string;
  todaySteps: number;
  lastBootSteps: number | null;
  lastSyncedSteps: number;
}

const HardwareStepCounter = NativeModules.HardwareStepCounter as
  | {
      isAvailable: () => Promise<boolean>;
      getCurrentBootSteps: () => Promise<number>;
      startListening: () => void;
      stopListening: () => void;
      startLiveNotification?: (goal: number) => Promise<boolean>;
      stopLiveNotification?: () => Promise<boolean>;
      pauseLiveNotification?: () => void;
      isLiveNotificationEnabled?: () => Promise<boolean>;
      getDailyStepSnapshot?: () => Promise<{
        dateKey: string;
        todaySteps: number;
        stepsGoal: number;
        lastBootSteps: number;
        liveNotificationEnabled: boolean;
      }>;
      syncNativeBaseline?: (steps: number, goal: number, isManualOverride: boolean) => void;
    }
  | undefined;

const getLocalDateKey = (date = new Date()): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

class PedometerSyncService {
  private initialized = false;
  private isAuthenticated = false;
  private state: PersistedPedometerState = {
    enabled: true,
    dateKey: getLocalDateKey(),
    todaySteps: 0,
    lastBootSteps: null,
    lastSyncedSteps: 0,
  };

  private appStateSubscription: { remove: () => void } | null = null;
  private androidEmitterSub: { remove: () => void } | null = null;
  private iosWatchSub: { remove: () => void } | null = null;
  private iosBaseSteps = 0;
  private stepsGoal = 7000;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private syncLock = false;

  private async loadState(): Promise<PersistedPedometerState> {
    const todayKey = getLocalDateKey();
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedPedometerState>;
        const sameDay = parsed.dateKey === todayKey;
        this.state = {
          enabled: parsed.enabled !== false,
          dateKey: todayKey,
          todaySteps: sameDay && typeof parsed.todaySteps === 'number' ? parsed.todaySteps : 0,
          lastBootSteps:
            typeof parsed.lastBootSteps === 'number' ? parsed.lastBootSteps : null,
          lastSyncedSteps:
            sameDay && typeof parsed.lastSyncedSteps === 'number'
              ? parsed.lastSyncedSteps
              : 0,
        };
      } else {
        this.state = {
          enabled: true,
          dateKey: todayKey,
          todaySteps: 0,
          lastBootSteps: null,
          lastSyncedSteps: 0,
        };
      }
    } catch {
      this.state.dateKey = todayKey;
    }

    const store = usePedometerStore.getState();
    store.setEnabled(this.state.enabled);
    store.setTodaySteps(this.state.todaySteps);
    return this.state;
  }

  private async saveState(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Ignore storage failures
    }
  }

  public async checkAvailability(): Promise<boolean> {
    try {
      let available = false;
      if (Platform.OS === 'android' && HardwareStepCounter?.isAvailable) {
        available = await HardwareStepCounter.isAvailable();
      } else {
        available = await Pedometer.isAvailableAsync();
      }
      usePedometerStore.getState().setAvailability(available);
      return available;
    } catch {
      usePedometerStore.getState().setAvailability(false);
      return false;
    }
  }

  public async checkPermission(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        if (typeof Platform.Version === 'number' && Platform.Version < 29) {
          usePedometerStore.getState().setPermission(true);
          return true;
        }
        const granted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
        );
        usePedometerStore.getState().setPermission(granted);
        return granted;
      }

      const perm = await Pedometer.getPermissionsAsync();
      const granted = Boolean(perm?.granted);
      usePedometerStore.getState().setPermission(granted);
      return granted;
    } catch {
      usePedometerStore.getState().setPermission(false);
      return false;
    }
  }

  public async requestPermission(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        if (typeof Platform.Version === 'number' && Platform.Version < 29) {
          usePedometerStore.getState().setPermission(true);
          return true;
        }
        const already = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
        );
        if (already) {
          usePedometerStore.getState().setPermission(true);
          return true;
        }
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
          {
            title: 'Otomatik Adım Sayar İzni',
            message:
              'Kadın Atlası, telefonunuzdaki adımları otomatik olarak sayıp günlük hedefinize ekleyebilmek için fiziksel aktivite iznine ihtiyaç duyar.',
            buttonPositive: 'İzin Ver',
            buttonNegative: 'Şimdi Değil',
          },
        );
        const granted = result === PermissionsAndroid.RESULTS.GRANTED;
        usePedometerStore.getState().setPermission(granted);
        return granted;
      }

      const perm = await Pedometer.requestPermissionsAsync();
      const granted = Boolean(perm?.granted);
      usePedometerStore.getState().setPermission(granted);
      return granted;
    } catch {
      usePedometerStore.getState().setPermission(false);
      return false;
    }
  }

  public async start(isAuthenticated: boolean): Promise<void> {
    this.isAuthenticated = isAuthenticated;
    if (!isAuthenticated) {
      this.stop();
      return;
    }

    await this.loadState();
    const available = await this.checkAvailability();
    if (!available) {
      return;
    }

    let granted = await this.checkPermission();
    if (!granted && this.state.enabled) {
      const prompted = await AsyncStorage.getItem(PROMPTED_KEY).catch(() => null);
      if (!prompted) {
        await AsyncStorage.setItem(PROMPTED_KEY, '1').catch(() => {});
        granted = await this.requestPermission();
      }
    }

    if (!granted || !this.state.enabled) {
      return;
    }

    if (!this.initialized) {
      this.initialized = true;
      this.appStateSubscription = AppState.addEventListener(
        'change',
        this.handleAppStateChange,
      );
    }

    await this.reconcileWithNativeSnapshot();
    await this.syncFromServerBaseline();
    await this.syncNow(false);
    await this.ensureLiveNotificationRunning();
    this.startRealtimeListeners();
  }

  public stop(): void {
    this.stopRealtimeListeners();
    if (Platform.OS === 'android') {
      HardwareStepCounter?.pauseLiveNotification?.();
    }
    this.appStateSubscription?.remove();
    this.appStateSubscription = null;
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    this.initialized = false;
  }

  private async requestNotificationPermission(forcePrompt = false): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    if (typeof Platform.Version === 'number' && Platform.Version < 33) {
      return true;
    }
    try {
      const perm = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
      if (!perm) return true;
      const granted = await PermissionsAndroid.check(perm);
      if (granted) return true;

      if (!forcePrompt) {
        return false;
      }

      const res = await PermissionsAndroid.request(perm, {
        title: 'Kilit Ekranı Adım & Döngü Takibi',
        message:
          'Adım sayar, kalori ve regl özeti kartını kilit ekranı ile bildirim çubuğunda canlı gösterebilmek için bildirim iznine ihtiyaç duyar.',
        buttonPositive: 'İzin Ver',
        buttonNegative: 'Şimdi Değil',
      });
      return res === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  }

  private async ensureLiveNotificationRunning(forcePrompt = false): Promise<boolean> {
    if (Platform.OS !== 'android' || !this.state.enabled || !this.isAuthenticated) {
      return false;
    }
    try {
      const enabled = HardwareStepCounter?.isLiveNotificationEnabled
        ? await HardwareStepCounter.isLiveNotificationEnabled()
        : false;
      usePedometerStore.getState().setLiveNotificationEnabled(enabled);
      if (!enabled) return false;

      const notifGranted = await this.requestNotificationPermission(forcePrompt);
      if (!notifGranted) return false;

      HardwareStepCounter?.syncNativeBaseline?.(this.state.todaySteps, this.stepsGoal, false);
      if (HardwareStepCounter?.startLiveNotification) {
        return await HardwareStepCounter.startLiveNotification(this.stepsGoal);
      }
      return false;
    } catch {
      return false;
    }
  }

  private async reconcileWithNativeSnapshot(): Promise<void> {
    if (Platform.OS !== 'android' || !HardwareStepCounter?.getDailyStepSnapshot) return;
    try {
      const snap = await HardwareStepCounter.getDailyStepSnapshot();
      const todayKey = getLocalDateKey();
      usePedometerStore.getState().setLiveNotificationEnabled(snap.liveNotificationEnabled);
      if (snap.stepsGoal > 0) {
        this.stepsGoal = snap.stepsGoal;
      }
      if (snap.dateKey === todayKey) {
        if (snap.todaySteps > this.state.todaySteps) {
          this.state.todaySteps = snap.todaySteps;
          usePedometerStore.getState().setTodaySteps(this.state.todaySteps);
        }
        if (snap.lastBootSteps >= 0) {
          this.state.lastBootSteps = snap.lastBootSteps;
        }
        await this.saveState();
      }
    } catch {
      // Ignore native snapshot errors
    }
  }

  public async setLiveNotificationEnabled(enabled: boolean): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    if (enabled) {
      const hasActivity = await this.checkPermission();
      if (!hasActivity) {
        const granted = await this.requestPermission();
        if (!granted) return false;
      }
      const hasNotif = await this.requestNotificationPermission(true);
      if (!hasNotif) {
        usePedometerStore.getState().setLiveNotificationEnabled(false);
        return false;
      }
      HardwareStepCounter?.syncNativeBaseline?.(this.state.todaySteps, this.stepsGoal, false);
      const started = HardwareStepCounter?.startLiveNotification
        ? await HardwareStepCounter.startLiveNotification(this.stepsGoal)
        : false;
      usePedometerStore.getState().setLiveNotificationEnabled(started);
      return started;
    }

    await HardwareStepCounter?.stopLiveNotification?.().catch(() => {});
    usePedometerStore.getState().setLiveNotificationEnabled(false);
    // Restart JS listener when foreground service is stopped so in-app counting stays active
    if (this.state.enabled && this.isAuthenticated) {
      this.startRealtimeListeners();
    }
    return false;
  }

  public updateStepGoal(goal: number): void {
    if (!goal || goal <= 0) return;
    this.stepsGoal = goal;
    widgetSyncService.syncStepsOnly(this.state.todaySteps, goal);
    if (Platform.OS === 'android') {
      HardwareStepCounter?.syncNativeBaseline?.(this.state.todaySteps, goal, false);
    }
  }

  public async enableAndStart(): Promise<boolean> {
    const available = await this.checkAvailability();
    if (!available) return false;

    const granted = await this.requestPermission();
    if (!granted) return false;

    this.state.enabled = true;
    usePedometerStore.getState().setEnabled(true);
    await this.saveState();
    await this.start(this.isAuthenticated);
    await this.ensureLiveNotificationRunning(true);
    return true;
  }

  public async setAutoEnabled(enabled: boolean): Promise<boolean> {
    if (enabled) {
      return this.enableAndStart();
    }
    this.state.enabled = false;
    usePedometerStore.getState().setEnabled(false);
    this.stopRealtimeListeners();
    if (Platform.OS === 'android') {
      await HardwareStepCounter?.stopLiveNotification?.().catch(() => {});
      usePedometerStore.getState().setLiveNotificationEnabled(false);
    }
    await this.saveState();
    return true;
  }

  private handleAppStateChange = (nextState: AppStateStatus) => {
    if (!this.isAuthenticated || !this.state.enabled) return;

    if (nextState === 'active') {
      this.syncNow(false).catch(() => {});
      this.startRealtimeListeners();
    } else if (nextState === 'background' || nextState === 'inactive') {
      this.flushToBackend(true).catch(() => {});
    }
  };

  private async syncFromServerBaseline(): Promise<void> {
    if (!this.isAuthenticated) return;
    try {
      const todayData = await wellnessService.getTodaySteps();
      const todayKey = getLocalDateKey();
      const serverDateKey =
        typeof (todayData as any)?.date === 'string'
          ? (todayData as any).date.slice(0, 10)
          : todayKey;
      const serverCount =
        serverDateKey === todayKey && typeof todayData?.count === 'number'
          ? todayData.count
          : 0;

      let nativeToday = 0;
      if (Platform.OS === 'android' && HardwareStepCounter?.getDailyStepSnapshot) {
        const snap = await HardwareStepCounter.getDailyStepSnapshot().catch(() => null);
        if (snap && snap.dateKey === todayKey && typeof snap.todaySteps === 'number') {
          nativeToday = snap.todaySteps;
        }
      }

      if (this.state.dateKey !== todayKey) {
        this.state.dateKey = todayKey;
        this.state.todaySteps = Math.max(serverCount, nativeToday);
        this.state.lastSyncedSteps = serverCount;
      } else {
        const best = Math.max(this.state.todaySteps, serverCount, nativeToday);
        this.state.todaySteps = best;
        this.state.lastSyncedSteps = Math.max(this.state.lastSyncedSteps, serverCount);
      }
      usePedometerStore.getState().setTodaySteps(this.state.todaySteps);
      if (Platform.OS === 'android') {
        HardwareStepCounter?.syncNativeBaseline?.(this.state.todaySteps, this.stepsGoal, false);
      }
      await this.saveState();
    } catch {
      // Offline or transient error
    }
  }

  private async applyBootSteps(bootSteps: number): Promise<void> {
    if (bootSteps < 0) return;

    const todayKey = getLocalDateKey();
    if (this.state.dateKey !== todayKey) {
      // New calendar day: carry delta only from midnight baseline
      this.state.dateKey = todayKey;
      this.state.todaySteps = 0;
      this.state.lastSyncedSteps = 0;
      this.state.lastBootSteps = bootSteps;
      usePedometerStore.getState().setTodaySteps(0);
      await this.saveState();
      return;
    }

    if (this.state.lastBootSteps === null) {
      this.state.lastBootSteps = bootSteps;
      await this.saveState();
      return;
    }

    if (bootSteps === this.state.lastBootSteps) {
      return;
    }

    const delta =
      bootSteps >= this.state.lastBootSteps
        ? bootSteps - this.state.lastBootSteps
        : bootSteps; // Device rebooted since last reading

    this.state.lastBootSteps = bootSteps;
    if (delta > 0 && delta < 150000) {
      this.state.todaySteps += delta;
      usePedometerStore.getState().setTodaySteps(this.state.todaySteps);
      widgetSyncService.syncStepsOnly(this.state.todaySteps);
      await this.saveState();
      this.scheduleBackendSync();
    } else {
      await this.saveState();
    }
  }

  public async syncNow(forceBackend = true): Promise<number> {
    if (this.syncLock) return this.state.todaySteps;
    this.syncLock = true;
    try {
      const store = usePedometerStore.getState();
      if (!this.state.enabled || store.hasPermission === false) {
        return this.state.todaySteps;
      }

      if (Platform.OS === 'android') {
        if (HardwareStepCounter?.getCurrentBootSteps) {
          await HardwareStepCounter.getCurrentBootSteps().catch(() => -1);
        }
        await this.reconcileWithNativeSnapshot();

        const hcSteps = await healthConnectSyncService.getTodaySteps().catch(() => null);
        if (typeof hcSteps === 'number' && hcSteps > this.state.todaySteps) {
          this.state.todaySteps = hcSteps;
          usePedometerStore.getState().setTodaySteps(hcSteps);
          HardwareStepCounter?.syncNativeBaseline?.(hcSteps, this.stepsGoal, false);
          widgetSyncService.syncStepsOnly(hcSteps, this.stepsGoal);
          await this.saveState();
        }
      } else {
        const end = new Date();
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const result = await Pedometer.getStepCountAsync(start, end).catch(() => null);
        if (result && typeof result.steps === 'number') {
          this.iosBaseSteps = result.steps;
          const todayKey = getLocalDateKey();
          if (this.state.dateKey !== todayKey) {
            this.state.dateKey = todayKey;
            this.state.todaySteps = result.steps;
            this.state.lastSyncedSteps = 0;
          } else {
            this.state.todaySteps = Math.max(this.state.todaySteps, result.steps);
          }
          store.setTodaySteps(this.state.todaySteps);
          await this.saveState();
        }
      }

      if (forceBackend || this.state.todaySteps - this.state.lastSyncedSteps >= 10) {
        await this.flushToBackend(forceBackend);
      }

      return this.state.todaySteps;
    } finally {
      this.syncLock = false;
    }
  }

  private startRealtimeListeners(): void {
    const store = usePedometerStore.getState();
    if (!this.state.enabled || !store.hasPermission) return;

    if (Platform.OS === 'android') {
      if (this.androidEmitterSub || !HardwareStepCounter || !NativeModules.HardwareStepCounter) {
        return;
      }
      const emitter = new NativeEventEmitter(NativeModules.HardwareStepCounter);
      this.androidEmitterSub = emitter.addListener(
        'HardwareStepCounterUpdate',
        (event: { bootSteps?: number; todaySteps?: number }) => {
          if (typeof event?.todaySteps === 'number') {
            const todayKey = getLocalDateKey();
            if (this.state.dateKey !== todayKey) {
              this.state.dateKey = todayKey;
              this.state.todaySteps = event.todaySteps;
              this.state.lastSyncedSteps = 0;
            } else {
              this.state.todaySteps = Math.max(this.state.todaySteps, event.todaySteps);
            }
            if (typeof event.bootSteps === 'number') {
              this.state.lastBootSteps = event.bootSteps;
            }
            usePedometerStore.getState().setTodaySteps(this.state.todaySteps);
            widgetSyncService.syncStepsOnly(this.state.todaySteps, this.stepsGoal);
            this.saveState().catch(() => {});
            this.scheduleBackendSync();
          } else if (typeof event?.bootSteps === 'number') {
            this.applyBootSteps(event.bootSteps).catch(() => {});
          }
        },
      );
      HardwareStepCounter.startListening();
    } else if (!this.iosWatchSub) {
      this.iosWatchSub = Pedometer.watchStepCount((result) => {
        const nextTotal = Math.max(
          this.state.todaySteps,
          this.iosBaseSteps + (result?.steps || 0),
        );
        this.state.todaySteps = nextTotal;
        usePedometerStore.getState().setTodaySteps(nextTotal);
        this.saveState().catch(() => {});
        this.scheduleBackendSync();
      });
    }
  }

  private stopRealtimeListeners(): void {
    if (this.androidEmitterSub) {
      this.androidEmitterSub.remove();
      this.androidEmitterSub = null;
      try {
        HardwareStepCounter?.stopListening();
      } catch {
        // Ignore
      }
    }
    if (this.iosWatchSub) {
      this.iosWatchSub.remove();
      this.iosWatchSub = null;
    }
  }

  private scheduleBackendSync(): void {
    if (this.state.todaySteps - this.state.lastSyncedSteps >= 25) {
      this.flushToBackend(false).catch(() => {});
      return;
    }
    if (this.syncTimer) return;
    this.syncTimer = setTimeout(() => {
      this.syncTimer = null;
      this.flushToBackend(false).catch(() => {});
    }, 10000);
  }

  public async flushToBackend(force = false): Promise<void> {
    if (!this.isAuthenticated || this.state.todaySteps <= 0) return;
    if (!force && this.state.todaySteps <= this.state.lastSyncedSteps) return;

    const store = usePedometerStore.getState();
    store.setIsSyncing(true);
    try {
      const targetSteps = this.state.todaySteps;
      const now = new Date();
      await wellnessService.logSteps({
        date: getLocalDateKey(now),
        count: targetSteps,
        source: 'pedometer',
        isManual: false,
      });
      this.state.lastSyncedSteps = targetSteps;
      await this.saveState();
      store.setSyncMeta(targetSteps, now.toISOString());

      queryClient.invalidateQueries({ queryKey: ['steps'] });
      queryClient.invalidateQueries({ queryKey: ['homeSnapshot'] });
      queryClient.invalidateQueries({ queryKey: ['dailyTasks'] });
      queryClient.invalidateQueries({ queryKey: ['gamification'] });
    } catch {
      // Retry on next step or foreground resume
    } finally {
      store.setIsSyncing(false);
    }
  }

  /**
   * Call when the user manually sets/adds today's step count so auto pedometer
   * adds subsequent steps on top of the updated count.
   */
  public async recordManualSteps(count: number): Promise<void> {
    const todayKey = getLocalDateKey();
    this.state.dateKey = todayKey;
    this.state.todaySteps = Math.max(0, count);
    this.state.lastSyncedSteps = Math.max(0, count);
    usePedometerStore.getState().setTodaySteps(this.state.todaySteps);
    usePedometerStore.getState().setSyncMeta(this.state.lastSyncedSteps, new Date().toISOString());
    widgetSyncService.syncStepsOnly(this.state.todaySteps, this.stepsGoal);
    if (Platform.OS === 'android') {
      HardwareStepCounter?.syncNativeBaseline?.(this.state.todaySteps, this.stepsGoal, true);
    }
    await this.saveState();
  }
}

export const pedometerSyncService = new PedometerSyncService();
