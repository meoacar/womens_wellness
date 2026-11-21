import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';
import {
  MOTIVATION_NOTIFICATIONS,
  PERIOD_SUPPORT_NOTIFICATIONS,
  RANDOM_FUN_NOTIFICATIONS,
} from '@/constants/funNotifications';
import { FunNotification } from '@/types/funNotifications';
import { useFunNotificationStore } from '@/store/funNotificationStore';
import { remindersService } from './api';

export interface NotificationSettingsState {
  enabled: boolean;
  periodReminders: boolean;
  discreetMode: boolean;
  pregnancyUpdates: boolean;
  appointmentReminders: boolean;
  dailyTips: boolean;
  funNotifications: boolean;
  meditationReminders: boolean;
  waterReminders: boolean;
  quietHours: {
    enabled: boolean;
    startHour: number;
    endHour: number;
  };
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettingsState = {
  enabled: true,
  periodReminders: true,
  discreetMode: false,
  pregnancyUpdates: true,
  appointmentReminders: true,
  dailyTips: true,
  funNotifications: true,
  meditationReminders: false,
  waterReminders: false,
  quietHours: {
    enabled: true,
    startHour: 23,
    endHour: 8,
  },
};

const SETTINGS_STORAGE_KEY = '@notification_settings_v1';
const FALLBACK_EAS_PROJECT_ID = '76d59681-ec69-472c-b1f5-b38abee8a3d7';

let pendingSyncInFlight = false;

export async function ensureAndroidNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Promise.all([
      Notifications.setNotificationChannelAsync('default', {
        name: 'Genel Bildirimler',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#EC4899',
        sound: 'default',
      }),
      Notifications.setNotificationChannelAsync('reminders', {
        name: 'Hatırlatıcılar',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#EC4899',
        sound: 'default',
      }),
      Notifications.setNotificationChannelAsync('period-support', {
        name: 'Döngü & Regl Desteği',
        importance: Notifications.AndroidImportance.HIGH,
        lightColor: '#F43F5E',
        sound: 'default',
      }),
      Notifications.setNotificationChannelAsync('wellness', {
        name: 'Su, Meditasyon & Sağlık',
        importance: Notifications.AndroidImportance.DEFAULT,
        lightColor: '#0EA5E9',
        sound: 'default',
      }),
      Notifications.setNotificationChannelAsync('fun-notifications', {
        name: 'Mizahi Bildirimler',
        importance: Notifications.AndroidImportance.DEFAULT,
        lightColor: '#8B5CF6',
        sound: 'default',
      }),
    ]);
  } catch {
    // Ignore on unsupported environments
  }
}

export function openAppNotificationSettings(): void {
  if (Platform.OS === 'ios') {
    Linking.openURL('app-settings:').catch(() => {});
  } else {
    Linking.openSettings().catch(() => {});
  }
}

export async function getOsNotificationPermissionStatus(): Promise<{
  granted: boolean;
  status: 'granted' | 'denied' | 'undetermined';
  canAskAgain: boolean;
}> {
  try {
    const expoPerm = await Notifications.getPermissionsAsync();
    let granted =
      expoPerm.granted ||
      expoPerm.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

    if (
      Platform.OS === 'android' &&
      typeof Platform.Version === 'number' &&
      Platform.Version >= 33 &&
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    ) {
      const nativeGranted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      granted = nativeGranted;
    }

    const status: 'granted' | 'denied' | 'undetermined' = granted
      ? 'granted'
      : expoPerm.status === 'denied'
        ? 'denied'
        : 'undetermined';

    return {
      granted,
      status,
      canAskAgain: expoPerm.canAskAgain ?? true,
    };
  } catch {
    return { granted: false, status: 'undetermined', canAskAgain: true };
  }
}

export async function requestOsNotificationPermission(options?: {
  showSettingsPrompt?: boolean;
}): Promise<{
  granted: boolean;
  status: 'granted' | 'denied' | 'undetermined';
  canAskAgain: boolean;
}> {
  await ensureAndroidNotificationChannels();

  const before = await getOsNotificationPermissionStatus();
  if (before.granted) {
    return before;
  }

  let granted = false;
  let canAskAgain = before.canAskAgain;

  try {
    if (
      Platform.OS === 'android' &&
      typeof Platform.Version === 'number' &&
      Platform.Version >= 33 &&
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    ) {
      const androidRes = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      granted = androidRes === PermissionsAndroid.RESULTS.GRANTED;
      if (androidRes === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        canAskAgain = false;
      }
      if (!granted && canAskAgain) {
        const expoRes = await Notifications.requestPermissionsAsync();
        granted = Boolean(expoRes.granted);
        canAskAgain = expoRes.canAskAgain ?? canAskAgain;
      }
    } else {
      const requested = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      granted =
        requested.granted ||
        requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
      canAskAgain = requested.canAskAgain ?? false;
    }
  } catch {
    granted = false;
  }

  const finalStatus: 'granted' | 'denied' | 'undetermined' = granted
    ? 'granted'
    : 'denied';

  if (!granted && options?.showSettingsPrompt !== false) {
    Alert.alert(
      'Bildirim İzni Gerekli',
      canAskAgain
        ? 'Hatırlatıcıları, mizahi mesajları ve regl desteği bildirimlerini alabilmek için cihaz bildirim iznine onay vermelisiniz.'
        : 'Bildirim izni daha önce kapatılmış. Cihaz ayarlarından Kadın Atlası bildirimlerini açabilirsiniz.',
      [
        { text: 'Şimdi Değil', style: 'cancel' },
        { text: 'Ayarları Aç', onPress: openAppNotificationSettings },
      ],
    );
  }

  return { granted, status: finalStatus, canAskAgain };
}

export async function registerPushTokenWithBackend(): Promise<string | null> {
  try {
    const perm = await getOsNotificationPermissionStatus();
    if (!perm.granted) return null;

    await ensureAndroidNotificationChannels();

    // Prefer native FCM / APNs device token so push works directly via Firebase without Expo account
    if (Platform.OS === 'android') {
      try {
        const deviceToken = await Notifications.getDevicePushTokenAsync();
        if (typeof deviceToken?.data === 'string' && deviceToken.data.trim()) {
          await remindersService.registerPushToken(deviceToken.data.trim()).catch(() => {});
          return deviceToken.data.trim();
        }
      } catch {
        // Fall through to Expo token fallback
      }
    }

    const envProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
    const projectId =
      envProjectId && !envProjectId.startsWith('__')
        ? envProjectId
        : FALLBACK_EAS_PROJECT_ID;

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    if (tokenData?.data) {
      await remindersService.registerPushToken(tokenData.data).catch(() => {});
      return tokenData.data;
    }
    return null;
  } catch {
    return null;
  }
}

export async function loadLocalNotificationSettings(): Promise<NotificationSettingsState> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<NotificationSettingsState>) : {};
    const discreetRaw = await AsyncStorage.getItem('@discreet_period_notifications');
    const quietEnabledRaw = await AsyncStorage.getItem('@quiet_hours_enabled');
    const quietStartRaw = await AsyncStorage.getItem('@quiet_hours_start');
    const quietEndRaw = await AsyncStorage.getItem('@quiet_hours_end');

    const startHour = quietStartRaw ? Number(quietStartRaw.split(':')[0]) : undefined;
    const endHour = quietEndRaw ? Number(quietEndRaw.split(':')[0]) : undefined;

    return {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...parsed,
      discreetMode:
        discreetRaw !== null
          ? discreetRaw === 'true'
          : parsed.discreetMode ?? DEFAULT_NOTIFICATION_SETTINGS.discreetMode,
      quietHours: {
        enabled:
          quietEnabledRaw !== null
            ? quietEnabledRaw === 'true'
            : parsed.quietHours?.enabled ?? DEFAULT_NOTIFICATION_SETTINGS.quietHours.enabled,
        startHour:
          typeof startHour === 'number' && Number.isFinite(startHour)
            ? startHour
            : parsed.quietHours?.startHour ?? DEFAULT_NOTIFICATION_SETTINGS.quietHours.startHour,
        endHour:
          typeof endHour === 'number' && Number.isFinite(endHour)
            ? endHour
            : parsed.quietHours?.endHour ?? DEFAULT_NOTIFICATION_SETTINGS.quietHours.endHour,
      },
    };
  } catch {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
}

export async function saveLocalNotificationSettings(
  settings: NotificationSettingsState,
): Promise<void> {
  try {
    await AsyncStorage.multiSet([
      [SETTINGS_STORAGE_KEY, JSON.stringify(settings)],
      ['@discreet_period_notifications', settings.discreetMode ? 'true' : 'false'],
      ['@quiet_hours_enabled', settings.quietHours.enabled ? 'true' : 'false'],
      ['@quiet_hours_start', `${String(settings.quietHours.startHour).padStart(2, '0')}:00`],
      ['@quiet_hours_end', `${String(settings.quietHours.endHour).padStart(2, '0')}:00`],
    ]);
  } catch {
    // Ignore storage failures
  }
}

function isHourInQuietHours(
  hour: number,
  quietHours?: { enabled: boolean; startHour: number; endHour: number },
): boolean {
  if (!quietHours?.enabled) return false;
  if (quietHours.startHour > quietHours.endHour) {
    return hour >= quietHours.startHour || hour < quietHours.endHour;
  }
  return hour >= quietHours.startHour && hour < quietHours.endHour;
}

async function cancelScheduledBySource(source: string): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => (n.content?.data as any)?.source === source)
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
  } catch {
    // Ignore cancellation failures
  }
}

export async function syncPendingServerNotifications(): Promise<number> {
  if (pendingSyncInFlight) return 0;
  pendingSyncInFlight = true;
  try {
    const perm = await getOsNotificationPermissionStatus();
    if (!perm.granted) return 0;

    await ensureAndroidNotificationChannels();

    const res = await remindersService.getPendingPushNotifications();
    const list = Array.isArray(res?.notifications) ? res.notifications : [];
    if (list.length === 0) return 0;

    const deliveredIds: string[] = [];
    for (const item of list) {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: item.title,
            body: item.body,
            sound: 'default',
            data: {
              ...(item.data || {}),
              serverPushId: item.id,
            },
          },
          trigger: null,
        });
        deliveredIds.push(item.id);
      } catch {
        // Ignore individual failures
      }
    }

    if (deliveredIds.length > 0) {
      await remindersService.ackPendingPushNotifications(deliveredIds).catch(() => {});
    }
    return deliveredIds.length;
  } catch {
    return 0;
  } finally {
    pendingSyncInFlight = false;
  }
}

export async function syncLocalRemindersSchedule(
  reminders: Array<{
    id: string;
    type: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
    active: boolean;
    nextRunAt?: string;
    payloadJson?: {
      title?: string;
      message?: string;
      time?: string;
      days?: number[];
    };
  }>,
): Promise<void> {
  await cancelScheduledBySource('user_reminder');
  const perm = await getOsNotificationPermissionStatus();
  const settings = await loadLocalNotificationSettings();
  if (!perm.granted || !settings.enabled) return;

  await ensureAndroidNotificationChannels();

  for (const r of reminders) {
    if (!r.active || !r.payloadJson) continue;
    const title = r.payloadJson.title || 'Hatırlatıcı';
    const body = r.payloadJson.message || 'Zamanı geldi!';
    const [rawH, rawM] = (r.payloadJson.time || '09:00').split(':').map(Number);
    const hour = Number.isFinite(rawH) ? Math.min(23, Math.max(0, rawH)) : 9;
    const minute = Number.isFinite(rawM) ? Math.min(59, Math.max(0, rawM)) : 0;

    if (isHourInQuietHours(hour, settings.quietHours)) {
      continue;
    }

    try {
      if (r.type === 'DAILY') {
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            sound: 'default',
            data: { source: 'user_reminder', reminderId: r.id, screen: 'reminders' },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            channelId: 'reminders',
            hour,
            minute,
          },
        });
      } else if (r.type === 'WEEKLY' && Array.isArray(r.payloadJson.days)) {
        for (const day of r.payloadJson.days) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title,
              body,
              sound: 'default',
              data: { source: 'user_reminder', reminderId: r.id, screen: 'reminders' },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
              channelId: 'reminders',
              weekday: ((day % 7) + 7) % 7 + 1,
              hour,
              minute,
            },
          });
        }
      } else if (r.type === 'MONTHLY' && Array.isArray(r.payloadJson.days)) {
        for (const day of r.payloadJson.days) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title,
              body,
              sound: 'default',
              data: { source: 'user_reminder', reminderId: r.id, screen: 'reminders' },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
              channelId: 'reminders',
              day: Math.min(28, Math.max(1, day)),
              hour,
              minute,
            },
          });
        }
      } else if (r.type === 'CUSTOM') {
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            sound: 'default',
            data: { source: 'user_reminder', reminderId: r.id, screen: 'reminders' },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            channelId: 'reminders',
            hour,
            minute,
          },
        });
      }
    } catch {
      // Ignore single reminder scheduling failures
    }
  }
}

export async function syncWellnessLocalNotifications(
  settings: NotificationSettingsState,
): Promise<void> {
  await cancelScheduledBySource('wellness_prefs_sync');
  const perm = await getOsNotificationPermissionStatus();
  if (!perm.granted || !settings.enabled) return;

  await ensureAndroidNotificationChannels();

  const scheduleDaily = async (
    hour: number,
    minute: number,
    title: string,
    body: string,
    screen: string,
  ) => {
    if (isHourInQuietHours(hour, settings.quietHours)) return;
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: 'default',
          data: { source: 'wellness_prefs_sync', screen },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          channelId: 'wellness',
          hour,
          minute,
        },
      });
    } catch {
      // Ignore single schedule failures
    }
  };

  if (settings.waterReminders) {
    await scheduleDaily(
      10,
      0,
      'Su Molası 💧',
      'Güne enerjik devam etmek için bir bardak su içmeyi unutma!',
      'home',
    );
    await scheduleDaily(
      14,
      0,
      'Hidrasyon Hatırlatması 💧',
      'Öğleden sonra su hedefinin yarısını geçtin mi? Bir bardak su iç.',
      'home',
    );
    await scheduleDaily(
      17,
      0,
      'Günlük Su Hedefi 💧',
      'Akşam olmadan günlük su hedefine biraz daha yaklaş!',
      'home',
    );
    await scheduleDaily(
      20,
      0,
      'Akşam Su Hatırlatması 💧',
      'Günü tamamlamadan bir bardak su içmeyi unutma.',
      'home',
    );
  }

  if (settings.meditationReminders) {
    await scheduleDaily(
      20,
      30,
      'Nefes & Meditasyon Zamanı 🧘‍♀️',
      'Günün yorgunluğunu atmak için kendine 5 dakikalık bir mola ayır.',
      'home',
    );
  }

  if (settings.dailyTips) {
    await scheduleDaily(
      11,
      0,
      'Günün Sağlık İpucu ✨',
      'Bugünkü döngü önerilerini ve check-in görevlerini görmek için uygulamayı aç.',
      'home',
    );
  }

  if (settings.pregnancyUpdates) {
    try {
      if (!isHourInQuietHours(10, settings.quietHours)) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Haftalık Hamilelik Özeti 🤰',
            body: 'Bebeğinin bu haftaki gelişimini ve senin için önerileri incele.',
            sound: 'default',
            data: { source: 'wellness_prefs_sync', screen: 'home' },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            channelId: 'wellness',
            weekday: 2, // Monday
            hour: 10,
            minute: 0,
          },
        });
      }
    } catch {
      // Ignore
    }
  }
}

export async function syncFunLocalNotifications(): Promise<void> {
  await cancelScheduledBySource('fun_notifications_sync');
  const perm = await getOsNotificationPermissionStatus();
  const settings = await loadLocalNotificationSettings();
  const { preferences } = useFunNotificationStore.getState();

  if (!perm.granted || !settings.enabled || !settings.funNotifications || !preferences.enabled) {
    return;
  }

  await ensureAndroidNotificationChannels();

  const pool: FunNotification[] = [];
  if (preferences.motivationNotifications) pool.push(...MOTIVATION_NOTIFICATIONS);
  if (preferences.randomNotifications) pool.push(...RANDOM_FUN_NOTIFICATIONS);
  if (preferences.periodSupportNotifications) pool.push(...PERIOD_SUPPORT_NOTIFICATIONS);

  if (pool.length === 0) return;

  const hoursByFrequency: Record<'low' | 'medium' | 'high', number[]> = {
    low: [14],
    medium: [12, 18],
    high: [10, 13, 16, 19],
  };

  const candidateHours = (hoursByFrequency[preferences.frequency] || [12, 18]).filter(
    (h) => !isHourInQuietHours(h, settings.quietHours),
  );
  if (candidateHours.length === 0) return;

  const now = new Date();
  let poolIndex = Math.floor(Math.random() * pool.length);

  // Schedule next 3 days cleanly with varied fun messages
  for (let dayOffset = 0; dayOffset < 3; dayOffset++) {
    for (const hour of candidateHours) {
      const target = new Date(now);
      target.setDate(now.getDate() + dayOffset);
      target.setHours(hour, 20, 0, 0);

      if (target.getTime() <= now.getTime() + 60 * 1000) {
        continue;
      }

      const item = pool[poolIndex % pool.length];
      poolIndex++;

      const title =
        settings.discreetMode && item.type === 'PERIOD_SUPPORT'
          ? 'Kadın Atlası • Günün Notu 🌸'
          : item.titleTr;
      const body =
        settings.discreetMode && item.type === 'PERIOD_SUPPORT'
          ? 'Kendine bugün ekstra nazik davranmayı unutma. ✨'
          : item.messageTr;

      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            sound: 'default',
            data: {
              source: 'fun_notifications_sync',
              funId: item.id,
              type: item.type,
              screen: 'home',
            },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            channelId: 'fun-notifications',
            date: target,
          },
        });
      } catch {
        // Ignore single schedule error
      }
    }
  }
}

export async function sendFunTestLocalNotification(): Promise<FunNotification | null> {
  const perm = await requestOsNotificationPermission({ showSettingsPrompt: true });
  if (!perm.granted) return null;

  await ensureAndroidNotificationChannels();
  const { preferences } = useFunNotificationStore.getState();

  const pool: FunNotification[] = [];
  if (preferences.motivationNotifications) pool.push(...MOTIVATION_NOTIFICATIONS);
  if (preferences.randomNotifications) pool.push(...RANDOM_FUN_NOTIFICATIONS);
  if (preferences.periodSupportNotifications) pool.push(...PERIOD_SUPPORT_NOTIFICATIONS);
  const finalPool = pool.length > 0 ? pool : RANDOM_FUN_NOTIFICATIONS;
  const chosen = finalPool[Math.floor(Math.random() * finalPool.length)];

  await Notifications.scheduleNotificationAsync({
    content: {
      title: chosen.titleTr,
      body: chosen.messageTr,
      sound: 'default',
      data: {
        source: 'fun_test',
        funId: chosen.id,
        type: chosen.type,
        screen: 'home',
        test: true,
      },
    },
    trigger: null,
  });

  return chosen;
}

export async function cancelAllScheduledAppNotifications(): Promise<void> {
  await Promise.all([
    cancelScheduledBySource('user_reminder'),
    cancelScheduledBySource('wellness_prefs_sync'),
    cancelScheduledBySource('fun_notifications_sync'),
    cancelScheduledBySource('period_support_sync'),
  ]);
}
