import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface NovaLimitsConfig {
  freeMonthlyLimit: number;
  premiumMonthlyLimit: number;
  maxMessageLength: number;
  isNovaEnabled: boolean;
  maintenanceMessage: string;
  systemGreeting: string;
}

const DEFAULT_NOVA_LIMITS: NovaLimitsConfig = {
  freeMonthlyLimit: 100,
  premiumMonthlyLimit: 1000,
  maxMessageLength: 500,
  isNovaEnabled: true,
  maintenanceMessage: 'NOVA şu anda bakımdadır. Kısa süre sonra tekrar deneyebilirsiniz.',
  systemGreeting:
    'Merhaba! Ben NOVA, kişisel kadın sağlığı asistanınım. Döngün, hamilelik sürecin, su tüketimin veya genel sağlığınla ilgili sorularını buradan yanıtlayabilirim.',
};

const NOVA_CONFIG_KEY = 'nova_limits_config';

@Injectable()
export class QuotaService {
  constructor(private readonly prisma: PrismaService) { }

  private getCurrentMonthKey(): string {
    return new Date().toISOString().slice(0, 7);
  }

  private getNextMonthStart(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }

  async getLimitsConfig(): Promise<NovaLimitsConfig> {
    const flag = await this.prisma.featureFlag.findUnique({
      where: { key: NOVA_CONFIG_KEY },
    });

    const val = (flag?.valueJson as Record<string, any>) || {};
    return {
      freeMonthlyLimit:
        typeof val.freeMonthlyLimit === 'number' && val.freeMonthlyLimit > 0
          ? val.freeMonthlyLimit
          : DEFAULT_NOVA_LIMITS.freeMonthlyLimit,
      premiumMonthlyLimit:
        typeof val.premiumMonthlyLimit === 'number' && val.premiumMonthlyLimit > 0
          ? val.premiumMonthlyLimit
          : DEFAULT_NOVA_LIMITS.premiumMonthlyLimit,
      maxMessageLength:
        typeof val.maxMessageLength === 'number' && val.maxMessageLength >= 50
          ? val.maxMessageLength
          : DEFAULT_NOVA_LIMITS.maxMessageLength,
      isNovaEnabled:
        typeof val.isNovaEnabled === 'boolean'
          ? val.isNovaEnabled
          : DEFAULT_NOVA_LIMITS.isNovaEnabled,
      maintenanceMessage:
        typeof val.maintenanceMessage === 'string' && val.maintenanceMessage.trim()
          ? val.maintenanceMessage
          : DEFAULT_NOVA_LIMITS.maintenanceMessage,
      systemGreeting:
        typeof val.systemGreeting === 'string' && val.systemGreeting.trim()
          ? val.systemGreeting
          : DEFAULT_NOVA_LIMITS.systemGreeting,
    };
  }

  async updateLimitsConfig(
    input: Partial<NovaLimitsConfig> & { syncExisting?: boolean },
  ): Promise<NovaLimitsConfig> {
    const current = await this.getLimitsConfig();
    const next: NovaLimitsConfig = {
      freeMonthlyLimit:
        typeof input.freeMonthlyLimit === 'number' && input.freeMonthlyLimit > 0
          ? Math.round(input.freeMonthlyLimit)
          : current.freeMonthlyLimit,
      premiumMonthlyLimit:
        typeof input.premiumMonthlyLimit === 'number' && input.premiumMonthlyLimit > 0
          ? Math.round(input.premiumMonthlyLimit)
          : current.premiumMonthlyLimit,
      maxMessageLength:
        typeof input.maxMessageLength === 'number' && input.maxMessageLength >= 50
          ? Math.round(input.maxMessageLength)
          : current.maxMessageLength,
      isNovaEnabled:
        typeof input.isNovaEnabled === 'boolean'
          ? input.isNovaEnabled
          : current.isNovaEnabled,
      maintenanceMessage:
        typeof input.maintenanceMessage === 'string' && input.maintenanceMessage.trim()
          ? input.maintenanceMessage.trim()
          : current.maintenanceMessage,
      systemGreeting:
        typeof input.systemGreeting === 'string' && input.systemGreeting.trim()
          ? input.systemGreeting.trim()
          : current.systemGreeting,
    };

    await this.prisma.featureFlag.upsert({
      where: { key: NOVA_CONFIG_KEY },
      update: { valueJson: next as any },
      create: { key: NOVA_CONFIG_KEY, valueJson: next as any },
    });

    if (input.syncExisting !== false) {
      await this.syncActiveLimits(next);
    }

    return next;
  }

  private async syncActiveLimits(config: NovaLimitsConfig) {
    const monthKey = this.getCurrentMonthKey();

    // Update Subscription limits for FREE and ACTIVE/TRIAL plans
    await this.prisma.subscription.updateMany({
      where: { status: { in: ['ACTIVE', 'TRIAL'] } },
      data: { aiMessagesLimit: config.premiumMonthlyLimit },
    });
    await this.prisma.subscription.updateMany({
      where: { status: { notIn: ['ACTIVE', 'TRIAL'] } },
      data: { aiMessagesLimit: config.freeMonthlyLimit },
    });

    // Sync UsageQuota records for current month
    const quotas = await this.prisma.usageQuota.findMany({
      where: { monthKey },
      include: { user: { include: { subscription: true } } },
    });

    for (const q of quotas) {
      const isPrem =
        q.user?.subscription?.status === 'ACTIVE' ||
        q.user?.subscription?.status === 'TRIAL';
      const targetLimit = isPrem ? config.premiumMonthlyLimit : config.freeMonthlyLimit;
      if (q.limit !== targetLimit) {
        await this.prisma.usageQuota.update({
          where: { id: q.id },
          data: { limit: targetLimit },
        });
      }
    }
  }

  async getOrCreateQuota(userId: string) {
    const monthKey = this.getCurrentMonthKey();

    let quota = await this.prisma.usageQuota.findUnique({
      where: {
        userId_monthKey: {
          userId,
          monthKey,
        },
      },
    });

    if (!quota) {
      const [user, config] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: userId },
          include: { subscription: true },
        }),
        this.getLimitsConfig(),
      ]);

      const isPremium =
        user?.subscription?.status === 'ACTIVE' || user?.subscription?.status === 'TRIAL';
      const limit = isPremium ? config.premiumMonthlyLimit : config.freeMonthlyLimit;

      quota = await this.prisma.usageQuota.create({
        data: {
          userId,
          monthKey,
          aiRequests: 0,
          limit,
          resetsAt: this.getNextMonthStart(),
        },
      });
    }

    return quota;
  }

  async hasQuota(userId: string): Promise<boolean> {
    const quota = await this.getOrCreateQuota(userId);
    return quota.aiRequests < quota.limit;
  }

  async checkQuota(userId: string) {
    const hasQuota = await this.hasQuota(userId);
    if (!hasQuota) {
      throw new ForbiddenException({
        code: 'QUOTA_EXCEEDED',
        message: 'Aylık mesaj limitinize ulaştınız.',
        messageEn: 'Monthly message quota exceeded.',
      });
    }
  }

  async increment(userId: string) {
    const quota = await this.getOrCreateQuota(userId);

    const updatedQuota = await this.prisma.usageQuota.update({
      where: { id: quota.id },
      data: {
        aiRequests: {
          increment: 1,
        },
      },
    });

    await this.prisma.subscription
      .updateMany({
        where: { userId },
        data: { aiMessagesUsed: updatedQuota.aiRequests },
      })
      .catch(() => {});
  }

  async getStatus(userId: string) {
    const [quota, config] = await Promise.all([
      this.getOrCreateQuota(userId),
      this.getLimitsConfig(),
    ]);

    return {
      used: quota.aiRequests,
      limit: quota.limit,
      remaining: Math.max(0, quota.limit - quota.aiRequests),
      resetsAt: quota.resetsAt,
      resetDate: quota.resetsAt,
      monthKey: quota.monthKey,
      percentage: quota.limit > 0 ? Math.round((quota.aiRequests / quota.limit) * 100) : 100,
      hasQuota: quota.aiRequests < quota.limit,
      maxMessageLength: config.maxMessageLength,
      isNovaEnabled: config.isNovaEnabled,
      maintenanceMessage: config.maintenanceMessage,
      systemGreeting: config.systemGreeting,
    };
  }

  async reset(userId: string) {
    const quota = await this.getOrCreateQuota(userId);

    await this.prisma.subscription
      .updateMany({
        where: { userId },
        data: { aiMessagesUsed: 0 },
      })
      .catch(() => {});

    return this.prisma.usageQuota.update({
      where: { id: quota.id },
      data: {
        aiRequests: 0,
      },
    });
  }

  async resetAll() {
    const currentMonthKey = this.getCurrentMonthKey();

    await this.prisma.usageQuota.deleteMany({
      where: {
        monthKey: {
          not: currentMonthKey,
        },
      },
    });

    return { status: 'ok', message: 'All quotas reset for new month' };
  }

  async updateLimit(userId: string, newLimit: number) {
    const quota = await this.getOrCreateQuota(userId);

    await this.prisma.subscription
      .updateMany({
        where: { userId },
        data: { aiMessagesLimit: newLimit },
      })
      .catch(() => {});

    return this.prisma.usageQuota.update({
      where: { id: quota.id },
      data: {
        limit: newLimit,
      },
    });
  }

  async findAll(params?: { page?: number; limit?: number; search?: string }) {
    const { page = 1, limit = 50, search } = params || {};
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search?.trim()) {
      where.user = {
        OR: [
          { email: { contains: search.trim(), mode: 'insensitive' } },
          { username: { contains: search.trim(), mode: 'insensitive' } },
        ],
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.usageQuota.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ aiRequests: 'desc' }, { resetsAt: 'desc' }],
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              subscription: {
                select: {
                  status: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.usageQuota.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async getAdminSummary() {
    const monthKey = this.getCurrentMonthKey();
    const [config, quotas, totalMessagesAgg, exhaustedCount] = await Promise.all([
      this.getLimitsConfig(),
      this.prisma.usageQuota.count({ where: { monthKey } }),
      this.prisma.usageQuota.aggregate({
        where: { monthKey },
        _sum: { aiRequests: true },
      }),
      this.prisma.usageQuota.findMany({
        where: { monthKey },
        select: { aiRequests: true, limit: true },
      }),
    ]);

    const exhaustedUsers = exhaustedCount.filter((q) => q.aiRequests >= q.limit).length;

    return {
      config,
      monthKey,
      activeQuotaUsers: quotas,
      totalMessagesThisMonth: totalMessagesAgg._sum.aiRequests || 0,
      exhaustedUsers,
    };
  }
}
