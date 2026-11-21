import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from './push.service';
import { ReminderSchedulerService } from './scheduler.service';

export type PeriodNotificationTone =
  | 'empathy'
  | 'pain_relief'
  | 'self_care'
  | 'hydration'
  | 'motivation';

export type PeriodDayRange = 'all' | 'early_heavy' | 'mid_late';

export interface PeriodNotificationMessage {
  id: string;
  titleTr: string;
  titleEn: string;
  messageTr: string;
  messageEn: string;
  emoji: string;
  tone: PeriodNotificationTone;
  dayRange: PeriodDayRange;
  active: boolean;
  order: number;
}

export interface PeriodNotificationsConfig {
  enabled: boolean;
  defaultSendHours: number[];
  maxPerDay: number;
  periodWindowDays: number;
  messages: PeriodNotificationMessage[];
  updatedAt: string;
}

export interface DispatchRunLog {
  timestamp: string;
  trigger: 'cron' | 'manual';
  totalActivePeriodUsers: number;
  sent: number;
  queued?: number;
  skippedNoToken: number;
  skippedQuietOrHour: number;
  skippedDailyLimit: number;
  failed: number;
}

const PERIOD_CONFIG_KEY = 'period_notifications_config';
const PERIOD_LOGS_KEY = 'period_notifications_dispatch_logs';

export const DEFAULT_PERIOD_MESSAGES: PeriodNotificationMessage[] = [
  {
    id: 'period_empathy_1',
    titleTr: 'Bugün yalnız değilsin 🤍',
    titleEn: "You're not alone today 🤍",
    messageTr:
      'Çok ağrın var ama ben hep senin yanındayım. Derin bir nefes al, bugün kendine izin ver. 💕',
    messageEn:
      'The cramps may be tough today, but I am right here with you. Take a deep breath and be gentle with yourself. 💕',
    emoji: '🤍',
    tone: 'empathy',
    dayRange: 'early_heavy',
    active: true,
    order: 1,
  },
  {
    id: 'period_pain_2',
    titleTr: 'Sıcak bir mola zamanı 🫖',
    titleEn: 'Time for a warm break 🫖',
    messageTr:
      'Karnına sıcak su torbanı koy, bir fincan bitki çayı al ve uzan. Bu yoğun günleri birlikte atlatacağız. 🌸',
    messageEn:
      'Grab a warm heating pad and a soothing cup of herbal tea. We will get through these heavy days together. 🌸',
    emoji: '🫖',
    tone: 'pain_relief',
    dayRange: 'early_heavy',
    active: true,
    order: 2,
  },
  {
    id: 'period_empathy_3',
    titleTr: 'Sen düşündüğünden daha güçlüsün 💪',
    titleEn: "You're stronger than you think 💪",
    messageTr:
      'Bugün enerjin düşük olabilir, bu çok normal. Kendine yüklenme, küçük adımlar bile yeterli. ✨',
    messageEn:
      'Your energy might feel low today and that is completely okay. Small steps are more than enough. ✨',
    emoji: '💪',
    tone: 'empathy',
    dayRange: 'all',
    active: true,
    order: 3,
  },
  {
    id: 'period_care_4',
    titleTr: 'Kendine ekstra nazik ol 🌷',
    titleEn: 'Be extra kind to yourself 🌷',
    messageTr:
      'Regl dönemindesin; bugün her şeye yetişmek zorunda değilsin. Dinlenmek en doğal hakkın. 🛋️',
    messageEn:
      "You're on your period; you don't have to do it all today. Resting is your right. 🛋️",
    emoji: '🌷',
    tone: 'self_care',
    dayRange: 'all',
    active: true,
    order: 4,
  },
  {
    id: 'period_hydration_5',
    titleTr: 'Bir yudum su içtin mi? 💧',
    titleEn: 'Have you had some water? 💧',
    messageTr:
      'Regl döneminde vücudun ekstra suya ihtiyaç duyar. Şimdi bir bardak ılık su içip bedenini rahatlat. 🌿',
    messageEn:
      'Your body needs extra hydration during your period. Sip a glass of warm water to soothe your body. 🌿',
    emoji: '💧',
    tone: 'hydration',
    dayRange: 'all',
    active: true,
    order: 5,
  },
  {
    id: 'period_pain_6',
    titleTr: 'Kramplarına küçük bir dokunuş 🤗',
    titleEn: 'A gentle touch for your cramps 🤗',
    messageTr:
      'Çok ağrın varsa omuzlarını serbest bırak, ılık bir duş al ve Nova ile dertleş. Her an yanındayım. 💝',
    messageEn:
      'If cramps are heavy, drop your shoulders, take a warm shower, and chat with Nova anytime. 💝',
    emoji: '🤗',
    tone: 'pain_relief',
    dayRange: 'early_heavy',
    active: true,
    order: 6,
  },
  {
    id: 'period_empathy_7',
    titleTr: 'Duyguların çok doğal 🌙',
    titleEn: 'Your feelings are valid 🌙',
    messageTr:
      'Döngünün bu döneminde hislerin yoğunlaşabilir. Ne hissediyorsan geçici, ben buradayım. 💖',
    messageEn:
      'Emotions can feel heavier right now. Whatever you feel is valid and temporary — I am here with you. 💖',
    emoji: '🌙',
    tone: 'empathy',
    dayRange: 'all',
    active: true,
    order: 7,
  },
  {
    id: 'period_motivation_8',
    titleTr: 'Hafif bir esneme iyi gelebilir 🧘‍♀️',
    titleEn: 'A gentle stretch might help 🧘‍♀️',
    messageTr:
      'Bedenin yavaş yavaş toparlanıyor. 5 dakikalık yumuşak bir esneme veya kısa bir yürüyüş sana çok iyi gelecek. 🌼',
    messageEn:
      'Your body is gently recharging. A 5-minute light stretch or short walk can ease tension. 🌼',
    emoji: '🧘‍♀️',
    tone: 'motivation',
    dayRange: 'mid_late',
    active: true,
    order: 8,
  },
];

@Injectable()
export class PeriodNotificationsService {
  private readonly logger = new Logger(PeriodNotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: PushService,
    private readonly scheduler: ReminderSchedulerService,
  ) {}

  private buildDefaultConfig(): PeriodNotificationsConfig {
    return {
      enabled: true,
      defaultSendHours: [10, 15, 20],
      maxPerDay: 2,
      periodWindowDays: 6,
      messages: DEFAULT_PERIOD_MESSAGES,
      updatedAt: new Date().toISOString(),
    };
  }

  private sanitizeConfig(raw: any): PeriodNotificationsConfig {
    const fallback = this.buildDefaultConfig();
    if (!raw || typeof raw !== 'object') {
      return fallback;
    }

    const rawHours = Array.isArray(raw.defaultSendHours)
      ? raw.defaultSendHours
          .map((h: any) => Number(h))
          .filter((h: number) => Number.isInteger(h) && h >= 0 && h <= 23)
      : fallback.defaultSendHours;

    const uniqueHours = Array.from<number>(new Set(rawHours)).sort((a, b) => a - b);

    const rawMessages = Array.isArray(raw.messages) ? raw.messages : fallback.messages;
    const sanitizedMessages: PeriodNotificationMessage[] = rawMessages
      .filter((m: any) => m && typeof m === 'object' && m.titleTr && m.messageTr)
      .map((m: any, idx: number) => ({
        id: String(m.id || `period_msg_${Date.now()}_${idx}`),
        titleTr: String(m.titleTr).trim(),
        titleEn: String(m.titleEn || m.titleTr).trim(),
        messageTr: String(m.messageTr).trim(),
        messageEn: String(m.messageEn || m.messageTr).trim(),
        emoji: String(m.emoji || '💕').trim() || '💕',
        tone: (['empathy', 'pain_relief', 'self_care', 'hydration', 'motivation'].includes(
          m.tone,
        )
          ? m.tone
          : 'empathy') as PeriodNotificationTone,
        dayRange: (['all', 'early_heavy', 'mid_late'].includes(m.dayRange)
          ? m.dayRange
          : 'all') as PeriodDayRange,
        active: m.active !== false,
        order: Number.isFinite(Number(m.order)) ? Number(m.order) : idx + 1,
      }))
      .sort((a: PeriodNotificationMessage, b: PeriodNotificationMessage) => a.order - b.order);

    return {
      enabled: raw.enabled !== false,
      defaultSendHours: uniqueHours.length > 0 ? uniqueHours : fallback.defaultSendHours,
      maxPerDay: Math.min(5, Math.max(1, Number(raw.maxPerDay) || fallback.maxPerDay)),
      periodWindowDays: Math.min(
        10,
        Math.max(3, Number(raw.periodWindowDays) || fallback.periodWindowDays),
      ),
      messages: sanitizedMessages,
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
    };
  }

  async getConfig(): Promise<PeriodNotificationsConfig> {
    const existing = await this.prisma.featureFlag.findUnique({
      where: { key: PERIOD_CONFIG_KEY },
    });

    if (!existing) {
      const defaults = this.buildDefaultConfig();
      await this.prisma.featureFlag.upsert({
        where: { key: PERIOD_CONFIG_KEY },
        update: { valueJson: defaults as any },
        create: { key: PERIOD_CONFIG_KEY, valueJson: defaults as any },
      });
      return defaults;
    }

    return this.sanitizeConfig(existing.valueJson);
  }

  async getPublicMessages() {
    const config = await this.getConfig();
    return {
      enabled: config.enabled,
      defaultSendHours: config.defaultSendHours,
      maxPerDay: config.maxPerDay,
      periodWindowDays: config.periodWindowDays,
      messages: config.messages.filter((m) => m.active),
      updatedAt: config.updatedAt,
    };
  }

  async updateConfig(
    input: Partial<PeriodNotificationsConfig>,
  ): Promise<PeriodNotificationsConfig> {
    const current = await this.getConfig();
    const merged = this.sanitizeConfig({
      ...current,
      ...input,
      updatedAt: new Date().toISOString(),
    });

    await this.prisma.featureFlag.upsert({
      where: { key: PERIOD_CONFIG_KEY },
      update: { valueJson: merged as any },
      create: { key: PERIOD_CONFIG_KEY, valueJson: merged as any },
    });

    return merged;
  }

  async resetToDefaults(): Promise<PeriodNotificationsConfig> {
    const defaults = this.buildDefaultConfig();
    await this.prisma.featureFlag.upsert({
      where: { key: PERIOD_CONFIG_KEY },
      update: { valueJson: defaults as any },
      create: { key: PERIOD_CONFIG_KEY, valueJson: defaults as any },
    });
    return defaults;
  }

  private formatLocalDate(date: Date, timezone: string): string {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(date);
    } catch {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Istanbul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(date);
    }
  }

  private getLocalHour(date: Date, timezone: string): number {
    try {
      const formatted = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        hour12: false,
      }).format(date);
      const parsed = Number(formatted);
      return Number.isNaN(parsed) ? date.getUTCHours() : parsed % 24;
    } catch {
      return date.getUTCHours();
    }
  }

  private diffDaysBetweenLocalDates(laterYmd: string, earlierYmd: string): number {
    const [y1, m1, d1] = laterYmd.split('-').map(Number);
    const [y2, m2, d2] = earlierYmd.split('-').map(Number);
    const t1 = Date.UTC(y1, (m1 || 1) - 1, d1 || 1);
    const t2 = Date.UTC(y2, (m2 || 1) - 1, d2 || 1);
    return Math.floor((t1 - t2) / (1000 * 60 * 60 * 24));
  }

  async getActivePeriodUsers(periodWindowDays: number) {
    const lookback = new Date();
    lookback.setDate(lookback.getDate() - (periodWindowDays + 14));

    const cycles = await this.prisma.periodCycle.findMany({
      where: {
        OR: [
          { startDate: { gte: lookback } },
          { endDate: { gte: new Date(Date.now() - 48 * 3600 * 1000) } },
        ],
      },
      orderBy: { startDate: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                displayName: true,
                timezone: true,
                preferencesJson: true,
              },
            },
          },
        },
      },
    });

    const latestByUser = new Map<string, (typeof cycles)[number]>();
    for (const cycle of cycles) {
      if (!latestByUser.has(cycle.userId)) {
        latestByUser.set(cycle.userId, cycle);
      }
    }

    const now = new Date();
    const activeUsers: Array<{
      userId: string;
      email: string;
      displayName: string;
      cycleDay: number;
      timezone: string;
      localDateStr: string;
      localHour: number;
      pushToken?: string;
      quietHours?: any;
      periodOptOut: boolean;
      history: { date?: string; count?: number; sentIds?: string[] };
      preferencesJson: Record<string, any>;
    }> = [];

    for (const cycle of latestByUser.values()) {
      const profile = cycle.user?.profile;
      const timezone = profile?.timezone || 'Europe/Istanbul';
      const localDateStr = this.formatLocalDate(now, timezone);
      const startYmd = this.formatLocalDate(new Date(cycle.startDate), timezone);
      const cycleDay = this.diffDaysBetweenLocalDates(localDateStr, startYmd) + 1;

      if (cycleDay < 1) {
        continue;
      }

      let inActivePeriod = false;
      if (cycle.endDate) {
        const endYmd = this.formatLocalDate(new Date(cycle.endDate), timezone);
        inActivePeriod = localDateStr <= endYmd && cycleDay <= 14;
      } else {
        inActivePeriod = cycleDay <= periodWindowDays;
      }

      if (!inActivePeriod) {
        continue;
      }

      const prefs = ((profile?.preferencesJson as Record<string, any>) || {}) as Record<
        string,
        any
      >;

      activeUsers.push({
        userId: cycle.userId,
        email: cycle.user?.email || '',
        displayName: profile?.displayName || 'Kullanıcı',
        cycleDay,
        timezone,
        localDateStr,
        localHour: this.getLocalHour(now, timezone),
        pushToken: prefs.pushToken,
        quietHours: prefs.quietHours,
        periodOptOut: prefs.periodNotificationsEnabled === false,
        history: prefs.periodPushHistory || {},
        preferencesJson: prefs,
      });
    }

    return activeUsers;
  }

  private pickVariedMessage(
    messages: PeriodNotificationMessage[],
    cycleDay: number,
    sentIdsToday: string[],
  ): PeriodNotificationMessage | null {
    const activeMessages = messages.filter((m) => m.active);
    if (activeMessages.length === 0) return null;

    const rangePool = activeMessages.filter((m) => {
      if (m.dayRange === 'early_heavy') return cycleDay <= 3;
      if (m.dayRange === 'mid_late') return cycleDay >= 4;
      return true;
    });

    const pool = rangePool.length > 0 ? rangePool : activeMessages;
    const freshPool = pool.filter((m) => !sentIdsToday.includes(m.id));
    const finalPool = freshPool.length > 0 ? freshPool : pool;

    const randomIndex = Math.floor(Math.random() * finalPool.length);
    return finalPool[randomIndex] || null;
  }

  async getDispatchStats() {
    const config = await this.getConfig();
    const [activeUsers, logsFlag] = await Promise.all([
      this.getActivePeriodUsers(config.periodWindowDays),
      this.prisma.featureFlag.findUnique({ where: { key: PERIOD_LOGS_KEY } }),
    ]);

    const logs = Array.isArray((logsFlag?.valueJson as any)?.runs)
      ? ((logsFlag?.valueJson as any).runs as DispatchRunLog[])
      : [];

    const totalPushReady = activeUsers.filter((u) => Boolean(u.pushToken)).length;

    return {
      activePeriodUsersCount: activeUsers.length,
      pushReadyUsersCount: totalPushReady,
      activeMessagesCount: config.messages.filter((m) => m.active).length,
      totalMessagesCount: config.messages.length,
      recentRuns: logs.slice(0, 15),
    };
  }

  private async appendDispatchLog(run: DispatchRunLog) {
    try {
      const existing = await this.prisma.featureFlag.findUnique({
        where: { key: PERIOD_LOGS_KEY },
      });
      const prevRuns = Array.isArray((existing?.valueJson as any)?.runs)
        ? ((existing?.valueJson as any).runs as DispatchRunLog[])
        : [];
      const nextRuns = [run, ...prevRuns].slice(0, 30);

      await this.prisma.featureFlag.upsert({
        where: { key: PERIOD_LOGS_KEY },
        update: { valueJson: { runs: nextRuns } as any },
        create: { key: PERIOD_LOGS_KEY, valueJson: { runs: nextRuns } as any },
      });
    } catch (error: any) {
      this.logger.warn(`Could not persist period dispatch log: ${error?.message}`);
    }
  }

  async dispatchPeriodNotifications(options?: { forceNow?: boolean }) {
    const forceNow = Boolean(options?.forceNow);
    const config = await this.getConfig();

    if (!config.enabled && !forceNow) {
      return {
        skipped: true,
        reason: 'Period notifications disabled globally',
        totalActivePeriodUsers: 0,
        sent: 0,
        skippedNoToken: 0,
        skippedQuietOrHour: 0,
        skippedDailyLimit: 0,
        failed: 0,
      };
    }

    const activeUsers = await this.getActivePeriodUsers(config.periodWindowDays);
    const now = new Date();

    let sent = 0;
    let queued = 0;
    let skippedNoToken = 0;
    let skippedQuietOrHour = 0;
    let skippedDailyLimit = 0;
    let failed = 0;

    for (const user of activeUsers) {
      if (user.periodOptOut) {
        skippedQuietOrHour++;
        continue;
      }

      if (!forceNow) {
        if (!config.defaultSendHours.includes(user.localHour)) {
          skippedQuietOrHour++;
          continue;
        }
        if (!this.scheduler.shouldSendPush(now, { ...user.quietHours, timezone: user.timezone })) {
          skippedQuietOrHour++;
          continue;
        }
      }

      const sameDay = user.history?.date === user.localDateStr;
      const sentCountToday = sameDay ? Number(user.history?.count || 0) : 0;
      const sentIdsToday = sameDay && Array.isArray(user.history?.sentIds)
        ? user.history.sentIds
        : [];

      if (!forceNow && sentCountToday >= config.maxPerDay) {
        skippedDailyLimit++;
        continue;
      }

      const selected = this.pickVariedMessage(
        config.messages,
        user.cycleDay,
        sentIdsToday,
      );

      if (!selected) {
        continue;
      }

      if (!user.pushToken) {
        skippedNoToken++;
      }

      const receipt = await this.pushService.sendPush(
        user.userId,
        {
          to: '',
          sound: 'default',
          title: selected.titleTr,
          body: selected.messageTr,
          data: {
            type: 'PERIOD_SUPPORT',
            screen: 'home',
            cycleDay: user.cycleDay,
            messageId: selected.id,
          },
        },
        { ignoreQuietHours: forceNow },
      );

      if (receipt.status === 'ok' || receipt.status === 'queued') {
        if (receipt.status === 'ok') {
          sent++;
        } else {
          queued++;
        }

        const nextHistory = {
          date: user.localDateStr,
          count: sentCountToday + 1,
          sentIds: [...sentIdsToday, selected.id].slice(-12),
          lastSentAt: now.toISOString(),
        };
        const latestProfile = await this.prisma.profile.findUnique({
          where: { userId: user.userId },
          select: { preferencesJson: true },
        });
        await this.prisma.profile.update({
          where: { userId: user.userId },
          data: {
            preferencesJson: {
              ...((latestProfile?.preferencesJson as Record<string, any>) || user.preferencesJson),
              periodPushHistory: nextHistory,
            } as any,
          },
        });
      } else {
        failed++;
      }
    }

    const summary: DispatchRunLog = {
      timestamp: now.toISOString(),
      trigger: forceNow ? 'manual' : 'cron',
      totalActivePeriodUsers: activeUsers.length,
      sent,
      queued,
      skippedNoToken,
      skippedQuietOrHour,
      skippedDailyLimit,
      failed,
    };

    if (forceNow || activeUsers.length > 0) {
      await this.appendDispatchLog(summary);
    }

    return summary;
  }

  async sendTestMessage(userIdOrEmail: string, messageId?: string) {
    const query = (userIdOrEmail || '').trim();
    if (!query) {
      throw new NotFoundException('Hedef kullanıcı ID veya e-posta gereklidir.');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ id: query }, { email: { equals: query, mode: 'insensitive' } }],
      },
      include: {
        profile: { select: { displayName: true, preferencesJson: true } },
      },
    });

    if (!user) {
      throw new NotFoundException(`Kullanıcı bulunamadı: ${query}`);
    }

    const config = await this.getConfig();
    const chosen =
      (messageId ? config.messages.find((m) => m.id === messageId) : undefined) ||
      this.pickVariedMessage(config.messages, 1, []) ||
      DEFAULT_PERIOD_MESSAGES[0];

    const receipt = await this.pushService.sendPush(
      user.id,
      {
        to: '',
        sound: 'default',
        title: chosen.titleTr,
        body: chosen.messageTr,
        data: {
          type: 'PERIOD_SUPPORT',
          screen: 'home',
          messageId: chosen.id,
          test: true,
        },
      },
      { ignoreQuietHours: true },
    );

    const statusMessage =
      receipt.status === 'ok'
        ? `Test push bildirimi ${user.email} kullanıcısına gönderildi.`
        : receipt.status === 'queued'
          ? `${user.email} kullanıcısının Expo Push Tokenı olmadığı için test bildirimi cihaz teslimat kuyruğuna eklendi (uygulama açıldığında/ön planda otomatik iletilecek).`
          : receipt.message || 'Test bildirimi gönderilemedi.';

    return {
      status: receipt.status,
      delivery: receipt.delivery,
      message: statusMessage,
      receipt,
      preview: chosen,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.profile?.displayName || user.email,
      },
    };
  }

  @Cron(CronExpression.EVERY_HOUR)
  async handleHourlyPeriodNotifications() {
    try {
      const result = await this.dispatchPeriodNotifications({ forceNow: false });
      if (result.sent > 0) {
        this.logger.log(
          `Dispatched ${result.sent} period support push notifications (active=${result.totalActivePeriodUsers})`,
        );
      }
    } catch (error: any) {
      this.logger.error(
        `Hourly period notification job failed: ${error?.message}`,
        error?.stack,
      );
    }
  }
}
