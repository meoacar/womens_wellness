import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../reminders/push.service';
import { MailService } from '../mail/mail.service';

export type WinbackTriggerType = 'inactivity' | 'onboarding_dropoff' | 'trial_ending';
export type WinbackIncentive = 'none' | 'trial_offer' | 'nova_bonus' | 'quick_checkin';
export type WinbackCtaScreen = 'home' | 'calendar' | 'chat' | 'premium';

export interface WinbackTierConfig {
  id: string;
  triggerType: WinbackTriggerType;
  inactiveDays: number;
  titleTr: string;
  bodyTr: string;
  sendPush: boolean;
  sendEmail: boolean;
  showInAppBanner: boolean;
  incentive: WinbackIncentive;
  ctaScreen: WinbackCtaScreen;
  active: boolean;
}

export interface WinbackConfig {
  enabled: boolean;
  tiers: WinbackTierConfig[];
  updatedAt: string;
}

const WINBACK_CONFIG_KEY = 'retention_winback_config';
const WINBACK_LOG_KEY = 'retention_winback_logs';

const DEFAULT_WINBACK_CONFIG: WinbackConfig = {
  enabled: false,
  tiers: [
    {
      id: 'onboarding_2d',
      triggerType: 'onboarding_dropoff',
      inactiveDays: 2,
      titleTr: 'İlk döngünü ekle, kişisel tahminlerin başlasın 🌸',
      bodyTr: 'Son regl başlangıcını seçmek sadece 10 saniye sürer; sonra sana özel faz rehberin ve takvimin hazır olur.',
      sendPush: true,
      sendEmail: false,
      showInAppBanner: true,
      incentive: 'quick_checkin',
      ctaScreen: 'calendar',
      active: true,
    },
    {
      id: 'winback_3d',
      triggerType: 'inactivity',
      inactiveDays: 3,
      titleTr: 'Seni özledik 🤍',
      bodyTr: 'Son birkaç gündür su ve döngü kaydını göremedik. 1 saniyede bugünü işaretlemeye ne dersin?',
      sendPush: true,
      sendEmail: false,
      showInAppBanner: true,
      incentive: 'quick_checkin',
      ctaScreen: 'home',
      active: true,
    },
    {
      id: 'winback_7d',
      triggerType: 'inactivity',
      inactiveDays: 7,
      titleTr: 'Tekrar Hoş Geldin! +10 NOVA Mesaj Hediyen Hazır 🎁',
      bodyTr: 'Bir haftadır görüşemedik! Dönüşüne özel +10 ücretsiz NOVA AI mesajı seni bekliyor.',
      sendPush: true,
      sendEmail: true,
      showInAppBanner: true,
      incentive: 'nova_bonus',
      ctaScreen: 'chat',
      active: true,
    },
    {
      id: 'winback_14d',
      triggerType: 'inactivity',
      inactiveDays: 14,
      titleTr: '7 Gün Ücretsiz Premium ile Yeniden Başla 👑',
      bodyTr: '3 aylık döngü projeksiyonu, klinik doktor raporu ve Partner Modunu 7 gün ücretsiz deneyimle.',
      sendPush: true,
      sendEmail: true,
      showInAppBanner: true,
      incentive: 'trial_offer',
      ctaScreen: 'premium',
      active: true,
    },
  ],
  updatedAt: new Date().toISOString(),
};

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: PushService,
    private readonly mailService: MailService,
  ) {}

  async getFunnelStats() {
    const now = new Date();
    const day1Ago = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    const days3Ago = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const days7Ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const days30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      profileCompletedCount,
      cycleUserGroups,
      dailyLogUserGroups,
      waterUserGroups,
      sleepUserGroups,
      stepsUserGroups,
      novaUserGroups,
      activeLast1Day,
      activeLast7Days,
      activeLast30Days,
      activePremiumCount,
      allActiveUsers,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.profile.count({ where: { dateOfBirth: { not: null } } }),
      this.prisma.periodCycle.groupBy({ by: ['userId'] }),
      this.prisma.dailyLog.groupBy({ by: ['userId'] }),
      this.prisma.waterLog.groupBy({ by: ['userId'] }),
      this.prisma.sleepLog.groupBy({ by: ['userId'] }),
      this.prisma.stepsLog.groupBy({ by: ['userId'] }),
      this.prisma.conversation.groupBy({ by: ['userId'] }),
      this.prisma.user.count({ where: { updatedAt: { gte: day1Ago } } }),
      this.prisma.user.count({ where: { updatedAt: { gte: days7Ago } } }),
      this.prisma.user.count({ where: { updatedAt: { gte: days30Ago } } }),
      this.prisma.subscription.count({ where: { status: { in: ['ACTIVE', 'TRIAL'] } } }),
      this.prisma.user.findMany({
        where: { status: 'ACTIVE' },
        select: {
          id: true,
          email: true,
          createdAt: true,
          updatedAt: true,
          subscription: { select: { status: true } },
          profile: {
            select: {
              displayName: true,
              dateOfBirth: true,
              preferencesJson: true,
            },
          },
          partnerLinkAsOwner: { select: { id: true } },
          partnerLinkAsPartner: { select: { id: true } },
          _count: {
            select: {
              periodCycles: true,
              dailyLogs: true,
            },
          },
        },
        orderBy: { updatedAt: 'asc' },
      }),
    ]);

    const cycleUsersSet = new Set(cycleUserGroups.map((g) => g.userId));
    const wellnessUsersSet = new Set([
      ...waterUserGroups.map((g) => g.userId),
      ...sleepUserGroups.map((g) => g.userId),
      ...stepsUserGroups.map((g) => g.userId),
    ]);

    let partnerOrPushUsers = 0;
    let recoveredCount = 0;
    let inactive7dRisk = 0;

    const atRiskUsers: Array<{
      id: string;
      email: string;
      displayName: string;
      inactiveDays: number;
      riskReason: 'inactivity' | 'onboarding_dropoff';
      subscriptionStatus: string;
      cycleCount: number;
      hasPushToken: boolean;
      hasPendingBanner: boolean;
      lastWinbackDate: string | null;
    }> = [];

    for (const u of allActiveUsers) {
      const prefs = ((u.profile?.preferencesJson as Record<string, any>) || {});
      if (prefs.pushToken || u.partnerLinkAsOwner || u.partnerLinkAsPartner) {
        partnerOrPushUsers++;
      }
      if (prefs.winbackRecoveredAt) {
        recoveredCount++;
      }

      const inactiveDays = Math.max(
        0,
        Math.floor((now.getTime() - new Date(u.updatedAt).getTime()) / (1000 * 60 * 60 * 24)),
      );
      const daysSinceSignup = Math.floor(
        (now.getTime() - new Date(u.createdAt).getTime()) / (1000 * 60 * 60 * 24),
      );

      if (u.updatedAt < days7Ago) {
        inactive7dRisk++;
      }

      const isOnboardingDropoff = u._count.periodCycles === 0 && daysSinceSignup >= 1;
      const isInactiveRisk = inactiveDays >= 3;

      if (isInactiveRisk || isOnboardingDropoff) {
        atRiskUsers.push({
          id: u.id,
          email: u.email,
          displayName: u.profile?.displayName || u.email.split('@')[0],
          inactiveDays,
          riskReason: isInactiveRisk ? 'inactivity' : 'onboarding_dropoff',
          subscriptionStatus: u.subscription?.status || 'FREE',
          cycleCount: u._count.periodCycles,
          hasPushToken: Boolean(prefs.pushToken),
          hasPendingBanner: Boolean(prefs.pendingWinbackBanner),
          lastWinbackDate: prefs.winbackLastSent?.date || null,
        });
      }
    }

    // Weekly cohorts for last 4 weeks
    const cohorts: Array<{
      label: string;
      registered: number;
      withCycle: number;
      activeLast7d: number;
      premium: number;
      retentionPct: number;
    }> = [];

    for (let w = 0; w < 4; w++) {
      const end = new Date(now.getTime() - w * 7 * 24 * 60 * 60 * 1000);
      const start = new Date(now.getTime() - (w + 1) * 7 * 24 * 60 * 60 * 1000);
      const cohortUsers = allActiveUsers.filter(
        (u) => new Date(u.createdAt) >= start && new Date(u.createdAt) < end,
      );
      const reg = cohortUsers.length;
      const withCycle = cohortUsers.filter((u) => cycleUsersSet.has(u.id)).length;
      const act7 = cohortUsers.filter((u) => new Date(u.updatedAt) >= days7Ago).length;
      const prem = cohortUsers.filter((u) =>
        ['ACTIVE', 'TRIAL'].includes(u.subscription?.status || ''),
      ).length;

      cohorts.push({
        label: w === 0 ? 'Son 7 Gün' : `${w * 7}-${(w + 1) * 7} Gün Önce`,
        registered: reg,
        withCycle,
        activeLast7d: act7,
        premium: prem,
        retentionPct: reg > 0 ? Math.round((act7 / reg) * 100) : 0,
      });
    }

    const pct = (part: number) =>
      totalUsers > 0 ? Math.round((part / totalUsers) * 100) : 0;

    const rawSteps = [
      { key: 'registered', label: 'Kayıtlı Kullanıcı', count: totalUsers },
      { key: 'profile_completed', label: 'Profil / Doğum Tarihi Girdi', count: profileCompletedCount },
      { key: 'cycle_logged', label: 'En Az 1 Döngü Girdi', count: cycleUserGroups.length },
      { key: 'daily_logged', label: 'Günlük Semptom Kaydı Yaptı', count: dailyLogUserGroups.length },
      { key: 'wellness_used', label: 'Su / Uyku / Adım Kaydetti', count: wellnessUsersSet.size },
      { key: 'nova_used', label: 'NOVA AI Sohbet Kullandı', count: novaUserGroups.length },
      { key: 'sticky_hook', label: 'Bildirim veya Partner Bağladı', count: partnerOrPushUsers },
      { key: 'premium_active', label: 'Aktif Premium / Deneme', count: activePremiumCount },
    ];

    const steps = rawSteps.map((s, idx) => {
      const prevCount = idx === 0 ? s.count : Math.max(1, rawSteps[idx - 1].count);
      const stepRetentionPct =
        idx === 0 ? 100 : Math.min(100, Math.round((s.count / prevCount) * 100));
      return {
        ...s,
        ratePct: pct(s.count),
        stepRetentionPct,
      };
    });

    const stickinessPct =
      activeLast30Days > 0
        ? Math.min(100, Math.round((activeLast1Day / activeLast30Days) * 100))
        : 0;

    return {
      totalUsers,
      steps,
      cohorts,
      atRiskUsers: atRiskUsers.slice(0, 30),
      activity: {
        dau: activeLast1Day,
        wau: activeLast7Days,
        mau: activeLast30Days,
        stickinessPct,
        activeLast7Days,
        activeLast30Days,
        inactive3dCount: allActiveUsers.filter((u) => u.updatedAt < days3Ago).length,
        inactive7dRisk,
        recoveredCount,
      },
      generatedAt: now.toISOString(),
    };
  }

  private sanitizeConfig(raw: any): WinbackConfig {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.tiers)) {
      return DEFAULT_WINBACK_CONFIG;
    }

    const tiers: WinbackTierConfig[] = raw.tiers
      .filter((t: any) => t && t.titleTr && t.bodyTr)
      .map((t: any, idx: number) => ({
        id: String(t.id || `rule_${Date.now()}_${idx}`),
        triggerType: (['inactivity', 'onboarding_dropoff', 'trial_ending'].includes(t.triggerType)
          ? t.triggerType
          : 'inactivity') as WinbackTriggerType,
        inactiveDays: Math.max(1, Math.min(90, Number(t.inactiveDays) || 3)),
        titleTr: String(t.titleTr).trim(),
        bodyTr: String(t.bodyTr).trim(),
        sendPush: t.sendPush !== false,
        sendEmail: Boolean(t.sendEmail),
        showInAppBanner: t.showInAppBanner !== false,
        incentive: (['none', 'trial_offer', 'nova_bonus', 'quick_checkin'].includes(t.incentive)
          ? t.incentive
          : 'none') as WinbackIncentive,
        ctaScreen: (['home', 'calendar', 'chat', 'premium'].includes(t.ctaScreen)
          ? t.ctaScreen
          : 'home') as WinbackCtaScreen,
        active: t.active !== false,
      }));

    return {
      enabled: Boolean(raw.enabled),
      tiers: tiers.length > 0 ? tiers : DEFAULT_WINBACK_CONFIG.tiers,
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
    };
  }

  async getWinbackConfig(): Promise<WinbackConfig> {
    const existing = await this.prisma.featureFlag.findUnique({
      where: { key: WINBACK_CONFIG_KEY },
    });
    if (!existing) {
      await this.prisma.featureFlag.upsert({
        where: { key: WINBACK_CONFIG_KEY },
        update: { valueJson: DEFAULT_WINBACK_CONFIG as any },
        create: { key: WINBACK_CONFIG_KEY, valueJson: DEFAULT_WINBACK_CONFIG as any },
      });
      return DEFAULT_WINBACK_CONFIG;
    }
    return this.sanitizeConfig(existing.valueJson);
  }

  async updateWinbackConfig(input: Partial<WinbackConfig>): Promise<WinbackConfig> {
    const current = await this.getWinbackConfig();
    const next = this.sanitizeConfig({
      ...current,
      ...input,
      updatedAt: new Date().toISOString(),
    });
    await this.prisma.featureFlag.upsert({
      where: { key: WINBACK_CONFIG_KEY },
      update: { valueJson: next as any },
      create: { key: WINBACK_CONFIG_KEY, valueJson: next as any },
    });
    return next;
  }

  async getWinbackLogs() {
    const existing = await this.prisma.featureFlag.findUnique({
      where: { key: WINBACK_LOG_KEY },
    });
    return Array.isArray((existing?.valueJson as any)?.runs)
      ? (existing?.valueJson as any).runs
      : [];
  }

  private async deliverRuleToUser(
    user: {
      id: string;
      email: string;
      profile: { preferencesJson: any } | null;
    },
    rule: WinbackTierConfig,
    ignoreQuietHours = false,
  ) {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const prefs = ((user.profile?.preferencesJson as Record<string, any>) || {});

    let pushed = false;
    let emailed = false;
    let bannerQueued = false;

    if (rule.sendPush) {
      const res = await this.pushService.sendPush(
        user.id,
        {
          to: '',
          sound: 'default',
          title: rule.titleTr,
          body: rule.bodyTr,
          data: {
            type: 'WINBACK',
            screen: rule.ctaScreen,
            tierId: rule.id,
          },
        },
        { ignoreQuietHours },
      );
      if (res.status === 'ok' || res.status === 'queued') pushed = true;
    }

    if (rule.sendEmail && user.email) {
      try {
        await this.mailService.sendAdminBroadcastEmail(user.email, rule.titleTr, rule.bodyTr);
        emailed = true;
      } catch {
        // Ignore single email failure
      }
    }

    const latestProfile = user.profile
      ? await this.prisma.profile.findUnique({
          where: { userId: user.id },
          select: { preferencesJson: true },
        })
      : null;

    const nextPrefs: Record<string, any> = {
      ...((latestProfile?.preferencesJson as Record<string, any>) || prefs),
      winbackLastSent: {
        tierId: rule.id,
        date: todayStr,
        sentAt: now.toISOString(),
      },
    };

    if (rule.showInAppBanner) {
      nextPrefs.pendingWinbackBanner = {
        id: `${rule.id}_${Date.now()}`,
        ruleId: rule.id,
        title: rule.titleTr,
        body: rule.bodyTr,
        incentive: rule.incentive,
        ctaScreen: rule.ctaScreen,
        createdAt: now.toISOString(),
      };
      bannerQueued = true;
    }

    if (user.profile) {
      await this.prisma.profile.update({
        where: { userId: user.id },
        data: { preferencesJson: nextPrefs as any },
      });
    }

    return { pushed, emailed, bannerQueued };
  }

  async nudgeSpecificUser(
    userId: string,
    payload?: {
      titleTr?: string;
      bodyTr?: string;
      incentive?: WinbackIncentive;
      ctaScreen?: WinbackCtaScreen;
      sendPush?: boolean;
      sendEmail?: boolean;
      showInAppBanner?: boolean;
    },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        profile: { select: { preferencesJson: true } },
      },
    });
    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    const rule: WinbackTierConfig = {
      id: `manual_nudge_${Date.now()}`,
      triggerType: 'inactivity',
      inactiveDays: 0,
      titleTr: payload?.titleTr?.trim() || 'Seni tekrar görmek harika olur 🌸',
      bodyTr:
        payload?.bodyTr?.trim() ||
        'Döngü tahminlerin ve bugünkü önerilerin seni bekliyor. +10 NOVA bonus mesaj hakkın hazır!',
      sendPush: payload?.sendPush !== false,
      sendEmail: Boolean(payload?.sendEmail),
      showInAppBanner: payload?.showInAppBanner !== false,
      incentive: payload?.incentive || 'nova_bonus',
      ctaScreen: payload?.ctaScreen || 'home',
      active: true,
    };

    const result = await this.deliverRuleToUser(user, rule, true);
    return {
      userId: user.id,
      email: user.email,
      ...result,
    };
  }

  async dispatchWinbackCampaigns(force = false) {
    const config = await this.getWinbackConfig();
    if (!config.enabled && !force) {
      return {
        skipped: true,
        reason: 'Win-back automation disabled',
        targetedUsers: 0,
        sentPush: 0,
        sentEmail: 0,
        queuedBanners: 0,
      };
    }

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const activeTiers = config.tiers
      .filter((t) => t.active)
      .sort((a, b) => b.inactiveDays - a.inactiveDays);

    let sentPush = 0;
    let sentEmail = 0;
    let queuedBanners = 0;
    let targetedUsers = 0;

    const users = await this.prisma.user.findMany({
      where: { status: 'ACTIVE' },
      include: {
        profile: { select: { displayName: true, preferencesJson: true } },
        subscription: { select: { status: true, trialEndDate: true, endDate: true } },
        _count: { select: { periodCycles: true } },
      },
    });

    for (const user of users) {
      const inactiveDays = Math.floor(
        (now.getTime() - new Date(user.updatedAt).getTime()) / (1000 * 60 * 60 * 24),
      );
      const daysSinceSignup = Math.floor(
        (now.getTime() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24),
      );

      let matchedTier = activeTiers.find(
        (t) => t.triggerType === 'inactivity' && inactiveDays >= t.inactiveDays,
      );

      if (!matchedTier && user._count.periodCycles === 0) {
        matchedTier = activeTiers.find(
          (t) => t.triggerType === 'onboarding_dropoff' && daysSinceSignup >= t.inactiveDays,
        );
      }

      if (!matchedTier && user.subscription?.status === 'TRIAL' && user.subscription.trialEndDate) {
        const daysToEnd = Math.ceil(
          (new Date(user.subscription.trialEndDate).getTime() - now.getTime()) /
            (1000 * 60 * 60 * 24),
        );
        matchedTier = activeTiers.find(
          (t) => t.triggerType === 'trial_ending' && daysToEnd >= 0 && daysToEnd <= t.inactiveDays,
        );
      }

      if (!matchedTier) continue;

      const prefs = ((user.profile?.preferencesJson as Record<string, any>) || {});
      const lastWinback = prefs.winbackLastSent as { tierId?: string; date?: string } | undefined;

      if (!force && lastWinback?.tierId === matchedTier.id && lastWinback?.date === todayStr) {
        continue;
      }

      targetedUsers++;
      const res = await this.deliverRuleToUser(user, matchedTier);
      if (res.pushed) sentPush++;
      if (res.emailed) sentEmail++;
      if (res.bannerQueued) queuedBanners++;
    }

    const logEntry = {
      timestamp: now.toISOString(),
      trigger: force ? 'manual' : 'cron',
      targetedUsers,
      sentPush,
      sentEmail,
      queuedBanners,
    };

    const prevLogs = await this.getWinbackLogs();
    await this.prisma.featureFlag.upsert({
      where: { key: WINBACK_LOG_KEY },
      update: { valueJson: { runs: [logEntry, ...prevLogs].slice(0, 20) } as any },
      create: { key: WINBACK_LOG_KEY, valueJson: { runs: [logEntry] } as any },
    });

    return logEntry;
  }

  @Cron(CronExpression.EVERY_DAY_AT_11AM)
  async handleDailyWinbackCron() {
    try {
      const res = await this.dispatchWinbackCampaigns(false);
      if ((res as any).targetedUsers > 0) {
        this.logger.log(`Win-back cron completed: ${JSON.stringify(res)}`);
      }
    } catch (error: any) {
      this.logger.error(`Win-back cron failed: ${error?.message}`);
    }
  }
}
