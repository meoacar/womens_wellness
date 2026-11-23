import { Platform } from 'react-native';
import {
  initialize,
  getSdkStatus,
  requestPermission,
  getGrantedPermissions,
  aggregateRecord,
  readRecords,
  openHealthConnectSettings,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';

type HealthRecordType = 'Steps' | 'SleepSession';

const REQUIRED_PERMISSIONS = [
  { accessType: 'read' as const, recordType: 'Steps' as const },
  { accessType: 'read' as const, recordType: 'SleepSession' as const },
];

class HealthConnectSyncService {
  private initialized = false;

  async isAvailable(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    try {
      const status = await getSdkStatus();
      return status === SdkAvailabilityStatus.SDK_AVAILABLE;
    } catch {
      return false;
    }
  }

  private async ensureInit(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    if (this.initialized) return true;
    try {
      const ok = await initialize();
      this.initialized = Boolean(ok);
      return this.initialized;
    } catch {
      return false;
    }
  }

  async hasPermission(recordType: HealthRecordType): Promise<boolean> {
    if (!(await this.ensureInit())) return false;
    try {
      const granted = await getGrantedPermissions();
      return granted.some(
        (p: any) => p.recordType === recordType && p.accessType === 'read',
      );
    } catch {
      return false;
    }
  }

  async hasPermissions(): Promise<boolean> {
    if (!(await this.ensureInit())) return false;
    try {
      const granted = await getGrantedPermissions();
      return granted.some(
        (p: any) =>
          p.accessType === 'read' &&
          (p.recordType === 'Steps' || p.recordType === 'SleepSession'),
      );
    } catch {
      return false;
    }
  }

  async requestPermissions(): Promise<boolean> {
    if (!(await this.isAvailable())) return false;
    if (!(await this.ensureInit())) return false;
    try {
      const granted = await requestPermission(REQUIRED_PERMISSIONS);
      return granted.some(
        (p: any) =>
          p.accessType === 'read' &&
          (p.recordType === 'Steps' || p.recordType === 'SleepSession'),
      );
    } catch {
      return false;
    }
  }

  openSettings(): void {
    if (Platform.OS !== 'android') return;
    try {
      openHealthConnectSettings();
    } catch {
      // Ignore if Health Connect settings unavailable
    }
  }

  async getTodaySteps(): Promise<number | null> {
    if (!(await this.hasPermission('Steps'))) return null;
    try {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      const result = await aggregateRecord({
        recordType: 'Steps',
        timeRangeFilter: {
          operator: 'between',
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        },
      });
      const count = (result as any)?.COUNT_TOTAL;
      return typeof count === 'number' && count >= 0 ? Math.round(count) : null;
    } catch {
      return null;
    }
  }

  async getLastNightSleepMinutes(): Promise<number | null> {
    if (!(await this.hasPermission('SleepSession'))) return null;
    try {
      const end = new Date();
      const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
      const res = await readRecords('SleepSession', {
        timeRangeFilter: {
          operator: 'between',
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        },
      });
      const records = (res as any)?.records || [];
      if (records.length === 0) return null;
      let totalMs = 0;
      for (const rec of records) {
        const s = new Date(rec.startTime).getTime();
        const e = new Date(rec.endTime).getTime();
        if (e > s) totalMs += e - s;
      }
      return totalMs > 0 ? Math.round(totalMs / 60000) : null;
    } catch {
      return null;
    }
  }
}

export const healthConnectSyncService = new HealthConnectSyncService();
