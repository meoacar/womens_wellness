import { pedometerSyncService } from '@/services/pedometerSync';
import { usePedometerStore } from '@/store/pedometerStore';

export function usePedometer() {
  const isPedometerAvailable = usePedometerStore((s) => s.isAvailable);
  const hasPermission = usePedometerStore((s) => s.hasPermission);
  const isEnabled = usePedometerStore((s) => s.enabled);
  const liveNotificationEnabled = usePedometerStore((s) => s.liveNotificationEnabled);
  const totalSteps = usePedometerStore((s) => s.todaySteps);
  const isSyncing = usePedometerStore((s) => s.isSyncing);
  const lastSyncedAt = usePedometerStore((s) => s.lastSyncedAt);

  return {
    isPedometerAvailable,
    hasPermission,
    isEnabled,
    liveNotificationEnabled,
    totalSteps,
    isSyncing,
    lastSyncedAt,
    isAutoActive: isPedometerAvailable && isEnabled && hasPermission === true,
    enableAndStart: () => pedometerSyncService.enableAndStart(),
    setAutoEnabled: (enabled: boolean) => pedometerSyncService.setAutoEnabled(enabled),
    setLiveNotificationEnabled: (enabled: boolean) =>
      pedometerSyncService.setLiveNotificationEnabled(enabled),
    updateStepGoal: (goal: number) => pedometerSyncService.updateStepGoal(goal),
    syncNow: () => pedometerSyncService.syncNow(true),
    recordManualSteps: (count: number) => pedometerSyncService.recordManualSteps(count),
  };
}
