import { Injectable, Logger, Optional } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { MonitoringService } from '../common/monitoring/monitoring.service';

export interface ExpoPushMessage {
  to: string;
  sound?: 'default';
  title: string;
  body: string;
  data?: any;
  badge?: number;
}

export interface PushSendOptions {
  ignoreQuietHours?: boolean;
  queueForDevice?: boolean;
}

export interface PushReceipt {
  status: 'ok' | 'queued' | 'error';
  id?: string;
  delivery?: 'expo' | 'fcm' | 'device_sync';
  message?: string;
  details?: any;
}

export interface PendingDeviceNotification {
  id: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  createdAt: string;
}

export interface NotificationPreferencesPayload {
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
  funPreferences?: {
    enabled: boolean;
    streakNotifications: boolean;
    motivationNotifications: boolean;
    achievementNotifications: boolean;
    randomNotifications: boolean;
    periodSupportNotifications: boolean;
    frequency: 'low' | 'medium' | 'high';
  };
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferencesPayload = {
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

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly expoEndpoint = 'https://exp.host/--/api/v2/push/send';
  private readonly accessToken = process.env.EXPO_ACCESS_TOKEN;
  private fcmTokenCache: { token: string; expiresAt: number } | null = null;

  constructor(
    private prisma: PrismaService,
    @Optional() private readonly monitoring?: MonitoringService,
  ) {}

  private loadFirebaseServiceAccount(): {
    projectId: string;
    clientEmail: string;
    privateKey: string;
  } | null {
    try {
      const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
      if (rawJson) {
        const parsed = JSON.parse(rawJson);
        if (parsed?.project_id && parsed?.client_email && parsed?.private_key) {
          return {
            projectId: parsed.project_id,
            clientEmail: parsed.client_email,
            privateKey: String(parsed.private_key).replace(/\\n/g, '\n'),
          };
        }
      }
      const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
      if (filePath && fs.existsSync(filePath)) {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (parsed?.project_id && parsed?.client_email && parsed?.private_key) {
          return {
            projectId: parsed.project_id,
            clientEmail: parsed.client_email,
            privateKey: String(parsed.private_key).replace(/\\n/g, '\n'),
          };
        }
      }
      if (
        process.env.FIREBASE_PROJECT_ID &&
        process.env.FIREBASE_CLIENT_EMAIL &&
        process.env.FIREBASE_PRIVATE_KEY
      ) {
        return {
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        };
      }
    } catch (err: any) {
      this.logger.warn(`Failed to load Firebase service account: ${err?.message}`);
    }
    return null;
  }

  private async getFcmAccessToken(sa: {
    clientEmail: string;
    privateKey: string;
  }): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.fcmTokenCache && this.fcmTokenCache.expiresAt > now + 60) {
      return this.fcmTokenCache.token;
    }

    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const claimSet = Buffer.from(
      JSON.stringify({
        iss: sa.clientEmail,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      }),
    ).toString('base64url');

    const unsigned = `${header}.${claimSet}`;
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(unsigned);
    signer.end();
    const signature = signer.sign(sa.privateKey).toString('base64url');
    const assertion = `${unsigned}.${signature}`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }).toString(),
    });

    const tokenJson: any = await tokenRes.json();
    if (!tokenRes.ok || !tokenJson?.access_token) {
      throw new Error(tokenJson?.error_description || tokenJson?.error || 'FCM OAuth token failed');
    }

    const expiresIn = Number(tokenJson.expires_in) || 3600;
    this.fcmTokenCache = {
      token: tokenJson.access_token,
      expiresAt: now + expiresIn,
    };
    return tokenJson.access_token;
  }

  private async sendFcmPush(
    userId: string,
    pushToken: string,
    message: ExpoPushMessage,
    queuedId: string | null,
  ): Promise<PushReceipt> {
    const sa = this.loadFirebaseServiceAccount();
    if (!sa) {
      if (queuedId) {
        return {
          status: 'queued',
          id: queuedId,
          delivery: 'device_sync',
          message: 'Firebase Service Account yapılandırılmamış; bildirim cihaz içi kuyruğa eklendi.',
        };
      }
      return { status: 'error', message: 'Firebase service account not configured' };
    }

    try {
      const accessToken = await this.getFcmAccessToken(sa);
      const stringData: Record<string, string> = {};
      if (message.data && typeof message.data === 'object') {
        for (const [k, v] of Object.entries(message.data)) {
          if (v !== undefined && v !== null) {
            stringData[k] = typeof v === 'string' ? v : JSON.stringify(v);
          }
        }
      }

      const channelId =
        message.data?.type === 'PERIOD_SUPPORT' ? 'period-support' : 'default';

      const fcmRes = await fetch(
        `https://fcm.googleapis.com/v1/projects/${sa.projectId}/messages:send`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            message: {
              token: pushToken,
              notification: {
                title: message.title,
                body: message.body,
              },
              data: stringData,
              android: {
                priority: 'HIGH',
                notification: {
                  channel_id: channelId,
                  sound: 'default',
                },
              },
            },
          }),
        },
      );

      const fcmResult: any = await fcmRes.json().catch(() => ({}));
      if (!fcmRes.ok) {
        const errMsg = fcmResult?.error?.message || `FCM HTTP ${fcmRes.status}`;
        this.logger.error(`FCM push failed for ${userId}: ${errMsg}`);
        await this.monitoring?.recordFailure(
          'push_notification',
          `FCM push HTTP ${fcmRes.status}: ${errMsg}`,
          { userId, status: fcmRes.status },
        );
        return { status: 'error', message: errMsg, details: fcmResult };
      }

      this.monitoring?.recordSuccess('push_notification');
      this.logger.log(`FCM push sent to user ${userId}: ${fcmResult?.name || 'ok'}`);
      return { status: 'ok', id: fcmResult?.name, delivery: 'fcm' };
    } catch (error: any) {
      this.logger.error(`FCM push exception for ${userId}: ${error?.message}`);
      await this.monitoring?.recordFailure(
        'push_notification',
        `FCM push exception: ${error?.message || error}`,
        { userId },
        error,
      );
      return { status: 'error', message: error?.message || 'FCM send failed' };
    }
  }

  private async enqueuePendingDeviceNotification(
    userId: string,
    currentPrefs: Record<string, any>,
    message: ExpoPushMessage,
  ): Promise<string | null> {
    if (!this.prisma.profile?.update) {
      return null;
    }

    const notifId = `push_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const entry: PendingDeviceNotification = {
      id: notifId,
      title: message.title,
      body: message.body,
      data: message.data || {},
      createdAt: new Date().toISOString(),
    };

    try {
      const existingQueue = Array.isArray(currentPrefs?.pendingPushQueue)
        ? (currentPrefs.pendingPushQueue as PendingDeviceNotification[])
        : [];
      const nextQueue = [...existingQueue, entry].slice(-30);

      await this.prisma.profile.update({
        where: { userId },
        data: {
          preferencesJson: {
            ...currentPrefs,
            pendingPushQueue: nextQueue,
          } as any,
        },
      });
      return notifId;
    } catch (error: any) {
      this.logger.warn(`Could not enqueue pending notification for ${userId}: ${error?.message}`);
      return null;
    }
  }

  /**
   * Send push notification via Expo Push API and queue in device-sync inbox
   */
  async sendPush(
    userId: string,
    message: ExpoPushMessage,
    options?: PushSendOptions,
  ): Promise<PushReceipt> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user?.profile) {
      this.logger.warn(`No profile found for user ${userId}`);
      return { status: 'error', message: 'User profile not found' };
    }

    const prefs = ((user.profile.preferencesJson as Record<string, any>) || {});
    const pushToken = prefs.pushToken;
    const ignoreQuiet = Boolean(options?.ignoreQuietHours || message.data?.test);

    if (
      !ignoreQuiet &&
      prefs.notificationPreferences?.enabled === false
    ) {
      return { status: 'error', message: 'Notifications disabled by user preference' };
    }

    // Check quiet hours
    const quietHours = prefs.quietHours;
    const timezone = user.profile.timezone || 'Europe/Istanbul';

    if (
      !ignoreQuiet &&
      quietHours?.enabled &&
      !this.shouldSendNow(quietHours, timezone)
    ) {
      this.logger.debug(`Skipping push for user ${userId} - quiet hours`);
      return { status: 'error', message: 'Quiet hours active' };
    }

    let queuedId: string | null = null;
    if (options?.queueForDevice !== false) {
      queuedId = await this.enqueuePendingDeviceNotification(userId, prefs, message);
    }

    if (!pushToken) {
      this.logger.warn(`No push token for user ${userId}; queued=${Boolean(queuedId)}`);
      if (queuedId) {
        return {
          status: 'queued',
          id: queuedId,
          delivery: 'device_sync',
          message:
            'Kullanıcının Push Token bilgisi yok; bildirim cihaz içi teslimat kuyruğuna eklendi.',
        };
      }
      return { status: 'error', message: 'No push token registered' };
    }

    const isExpoToken =
      typeof pushToken === 'string' &&
      (pushToken.startsWith('ExponentPushToken[') || pushToken.startsWith('ExpoPushToken['));

    if (!isExpoToken) {
      return this.sendFcmPush(userId, pushToken, message, queuedId);
    }

    try {
      const response = await fetch(this.expoEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          ...(this.accessToken && {
            Authorization: `Bearer ${this.accessToken}`,
          }),
        },
        body: JSON.stringify([
          {
            to: pushToken,
            sound: message.sound || 'default',
            title: message.title,
            body: message.body,
            data: message.data,
            badge: message.badge,
          },
        ]),
      });

      const result = await response.json();

      if (!response.ok) {
        const errMsg = result.errors?.[0]?.message || 'Push failed';
        this.logger.error(`Expo push failed: ${JSON.stringify(result)}`);
        await this.monitoring?.recordFailure(
          'push_notification',
          `Expo push HTTP ${response.status}: ${errMsg}`,
          { userId, status: response.status },
        );
        return {
          status: 'error',
          message: errMsg,
          details: result,
        };
      }

      // Expo returns `data` as an array for array payloads, or object for single payloads
      const receipt = Array.isArray(result?.data) ? result.data[0] : result?.data;

      if (receipt?.status === 'ok') {
        this.monitoring?.recordSuccess('push_notification');
        this.logger.log(`Push sent to user ${userId}: ${receipt.id}`);
        return { status: 'ok', id: receipt.id, delivery: 'expo' };
      } else {
        const errMsg = receipt?.message || 'Unknown error';
        this.logger.error(`Push error for user ${userId}: ${errMsg}`);
        await this.monitoring?.recordFailure(
          'push_notification',
          `Expo push receipt error: ${errMsg}`,
          { userId, details: receipt?.details },
        );
        return {
          status: 'error',
          message: errMsg,
          details: receipt?.details,
        };
      }
    } catch (error: any) {
      this.logger.error(`Failed to send push: ${error.message}`);
      await this.monitoring?.recordFailure(
        'push_notification',
        `Expo push network/exception error: ${error?.message || error}`,
        { userId },
        error,
      );
      return { status: 'error', message: error.message };
    }
  }

  /**
   * Send push with retry logic
   */
  async sendPushWithRetry(
    userId: string,
    message: ExpoPushMessage,
    maxRetries = 3,
    options?: PushSendOptions,
  ): Promise<PushReceipt> {
    let lastError: PushReceipt | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await this.sendPush(userId, message, options);

      if (result.status === 'ok' || result.status === 'queued') {
        return result;
      }

      if (
        result.message === 'Quiet hours active' ||
        result.message === 'No push token registered' ||
        result.message === 'Notifications disabled by user preference'
      ) {
        return result;
      }

      lastError = result;

      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    return lastError || { status: 'error', message: 'All retries failed' };
  }

  /**
   * Batch send pushes
   */
  async sendBatchPushes(
    pushes: Array<{ userId: string; message: ExpoPushMessage }>,
    options?: PushSendOptions,
  ): Promise<PushReceipt[]> {
    return Promise.all(
      pushes.map((p) => this.sendPush(p.userId, p.message, options)),
    );
  }

  /**
   * Register push token for user
   */
  async registerPushToken(userId: string, pushToken: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new Error('Profile not found');
    }

    const preferencesJson = {
      ...((profile.preferencesJson as Record<string, any>) || {}),
      pushToken,
      pushTokenUpdatedAt: new Date().toISOString(),
    };

    await this.prisma.profile.update({
      where: { userId },
      data: { preferencesJson: preferencesJson as any },
    });

    return { success: true };
  }

  async getPendingNotifications(userId: string): Promise<PendingDeviceNotification[]> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { preferencesJson: true },
    });

    const prefs = ((profile?.preferencesJson as Record<string, any>) || {});
    const queue = Array.isArray(prefs.pendingPushQueue)
      ? (prefs.pendingPushQueue as PendingDeviceNotification[])
      : [];
    return queue;
  }

  async ackPendingNotifications(userId: string, ids: string[]): Promise<{ acknowledged: number }> {
    if (!Array.isArray(ids) || ids.length === 0) {
      return { acknowledged: 0 };
    }
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { preferencesJson: true },
    });
    if (!profile) {
      return { acknowledged: 0 };
    }

    const prefs = ((profile.preferencesJson as Record<string, any>) || {});
    const queue = Array.isArray(prefs.pendingPushQueue)
      ? (prefs.pendingPushQueue as PendingDeviceNotification[])
      : [];
    const idSet = new Set(ids);
    const remaining = queue.filter((item) => !idSet.has(item.id));
    const acknowledged = queue.length - remaining.length;

    if (acknowledged > 0) {
      await this.prisma.profile.update({
        where: { userId },
        data: {
          preferencesJson: {
            ...prefs,
            pendingPushQueue: remaining,
          } as any,
        },
      });
    }

    return { acknowledged };
  }

  private parseHour(raw: unknown, fallback: number): number {
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return Math.min(23, Math.max(0, Math.floor(raw)));
    }
    if (typeof raw === 'string' && raw.trim()) {
      const parsed = Number(raw.split(':')[0]);
      if (Number.isFinite(parsed)) {
        return Math.min(23, Math.max(0, Math.floor(parsed)));
      }
    }
    return fallback;
  }

  private normalizeQuietHours(input: any, fallback = DEFAULT_NOTIFICATION_PREFERENCES.quietHours) {
    const startHour = this.parseHour(input?.startHour ?? input?.start, fallback.startHour);
    const endHour = this.parseHour(input?.endHour ?? input?.end, fallback.endHour);
    return {
      enabled: input?.enabled !== false,
      startHour,
      endHour,
      start: `${String(startHour).padStart(2, '0')}:00`,
      end: `${String(endHour).padStart(2, '0')}:00`,
    };
  }

  async getNotificationPreferences(userId: string) {
    const [profile, wellnessPrefs] = await Promise.all([
      this.prisma.profile.findUnique({
        where: { userId },
        select: { preferencesJson: true },
      }),
      this.prisma.wellnessPreferences.findUnique({
        where: { userId },
        select: { notificationsJson: true },
      }),
    ]);

    const prefs = ((profile?.preferencesJson as Record<string, any>) || {});
    const storedNotifs = ((prefs.notificationPreferences as Record<string, any>) || {});
    const storedWellnessNotifs = ((wellnessPrefs?.notificationsJson as Record<string, any>) || {});
    const quietHours = this.normalizeQuietHours(
      prefs.quietHours || storedNotifs.quietHours || DEFAULT_NOTIFICATION_PREFERENCES.quietHours,
    );

    return {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...storedWellnessNotifs,
      ...storedNotifs,
      periodReminders:
        prefs.periodNotificationsEnabled !== undefined
          ? prefs.periodNotificationsEnabled !== false
          : storedNotifs.periodReminders ?? true,
      discreetMode:
        typeof prefs.discreetMode === 'boolean'
          ? prefs.discreetMode
          : storedNotifs.discreetMode ?? false,
      quietHours,
      funPreferences: storedNotifs.funPreferences,
      hasPushToken: Boolean(prefs.pushToken),
    };
  }

  async updateNotificationPreferences(
    userId: string,
    updates: Partial<NotificationPreferencesPayload>,
  ) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { preferencesJson: true },
    });

    if (!profile) {
      throw new Error('Profile not found');
    }

    const currentPrefs = ((profile.preferencesJson as Record<string, any>) || {});
    const currentNotifs = ((currentPrefs.notificationPreferences as Record<string, any>) || {});
    const currentQuiet = this.normalizeQuietHours(
      currentPrefs.quietHours || currentNotifs.quietHours || DEFAULT_NOTIFICATION_PREFERENCES.quietHours,
    );

    const mergedQuiet = updates.quietHours
      ? this.normalizeQuietHours(updates.quietHours, currentQuiet)
      : currentQuiet;

    const mergedNotifs: Record<string, any> = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...currentNotifs,
      ...updates,
      quietHours: mergedQuiet,
    };

    const nextProfilePrefs: Record<string, any> = {
      ...currentPrefs,
      notificationPreferences: mergedNotifs,
      quietHours: mergedQuiet,
    };

    if (typeof updates.periodReminders === 'boolean') {
      nextProfilePrefs.periodNotificationsEnabled = updates.periodReminders;
    }
    if (typeof updates.discreetMode === 'boolean') {
      nextProfilePrefs.discreetMode = updates.discreetMode;
    }

    await this.prisma.profile.update({
      where: { userId },
      data: { preferencesJson: nextProfilePrefs as any },
    });

    // Sync wellness reminders preferences too
    const existingWellness = await this.prisma.wellnessPreferences.findUnique({
      where: { userId },
    });
    const wellnessNotifPatch = {
      ...((existingWellness?.notificationsJson as Record<string, any>) || {}),
      ...(typeof updates.meditationReminders === 'boolean' && {
        meditationReminders: updates.meditationReminders,
      }),
      ...(typeof updates.waterReminders === 'boolean' && {
        waterReminders: updates.waterReminders,
      }),
      ...(typeof updates.dailyTips === 'boolean' && {
        dailyTips: updates.dailyTips,
      }),
    };
    if (existingWellness) {
      await this.prisma.wellnessPreferences.update({
        where: { userId },
        data: { notificationsJson: wellnessNotifPatch as any },
      });
    } else {
      await this.prisma.wellnessPreferences.create({
        data: {
          userId,
          notificationsJson: wellnessNotifPatch as any,
        },
      });
    }

    return {
      ...mergedNotifs,
      hasPushToken: Boolean(currentPrefs.pushToken),
    };
  }

  /**
   * Check if push should be sent based on quiet hours
   */
  private shouldSendNow(
    quietHours: { enabled: boolean; startHour: number; endHour: number },
    timezone: string,
  ): boolean {
    const now = new Date();
    const rawHour = Number(
      new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        hour12: false,
        timeZone: timezone,
      }).format(now),
    );
    const hour = Number.isNaN(rawHour) ? now.getUTCHours() : rawHour % 24;

    // Overnight window (e.g., 22:00 - 08:00)
    if (quietHours.startHour > quietHours.endHour) {
      return !(hour >= quietHours.startHour || hour < quietHours.endHour);
    }

    // Regular window
    return !(hour >= quietHours.startHour && hour < quietHours.endHour);
  }
}
