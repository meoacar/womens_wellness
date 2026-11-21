import { create } from 'zustand';

interface PedometerState {
  isAvailable: boolean;
  hasPermission: boolean | null;
  enabled: boolean;
  liveNotificationEnabled: boolean;
  todaySteps: number;
  lastSyncedSteps: number;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  setAvailability: (isAvailable: boolean) => void;
  setPermission: (hasPermission: boolean) => void;
  setEnabled: (enabled: boolean) => void;
  setLiveNotificationEnabled: (liveNotificationEnabled: boolean) => void;
  setTodaySteps: (steps: number) => void;
  setSyncMeta: (lastSyncedSteps: number, lastSyncedAt: string) => void;
  setIsSyncing: (isSyncing: boolean) => void;
}

export const usePedometerStore = create<PedometerState>((set) => ({
  isAvailable: false,
  hasPermission: null,
  enabled: true,
  liveNotificationEnabled: true,
  todaySteps: 0,
  lastSyncedSteps: 0,
  isSyncing: false,
  lastSyncedAt: null,
  setAvailability: (isAvailable) => set({ isAvailable }),
  setPermission: (hasPermission) => set({ hasPermission }),
  setEnabled: (enabled) => set({ enabled }),
  setLiveNotificationEnabled: (liveNotificationEnabled) => set({ liveNotificationEnabled }),
  setTodaySteps: (todaySteps) => set({ todaySteps }),
  setSyncMeta: (lastSyncedSteps, lastSyncedAt) => set({ lastSyncedSteps, lastSyncedAt }),
  setIsSyncing: (isSyncing) => set({ isSyncing }),
}));
