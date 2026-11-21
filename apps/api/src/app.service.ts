import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Optional } from '@nestjs/common';
import { Queue } from 'bullmq';
import * as fs from 'fs';
import { PrismaService } from './prisma/prisma.service';
import { resolveUploadsDir } from './common/utils/uploads';
import {
  AlertCategory,
  CategoryAlertStats,
  MonitoringService,
} from './common/monitoring/monitoring.service';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    database: { connected: boolean; latency?: number };
    redis: { connected: boolean; latency?: number };
    queue: {
      connected: boolean;
      name: string;
      waiting?: number;
      active?: number;
      failed?: number;
      delayed?: number;
    };
    storage: { accessible: boolean };
  };
  alerts?: Record<AlertCategory, CategoryAlertStats>;
  version: string;
  uptime: number;
}

const HEALTH_CHECK_TIMEOUT_MS = 2500;
const DEGRADED_FAILED_JOBS_THRESHOLD = 25;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Health check timed out')), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

@Injectable()
export class AppService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() @InjectQueue('reminders') private readonly remindersQueue?: Queue,
    @Optional() private readonly monitoring?: MonitoringService,
  ) {}

  getHello(): string {
    return 'Wellness API v1.0 - Women\'s Wellness Companion';
  }

  async getHealthStatus(): Promise<HealthStatus> {
    const dbStart = Date.now();
    let dbConnected = false;
    let dbLatency = 0;

    try {
      await withTimeout(this.prisma.$queryRaw`SELECT 1`, HEALTH_CHECK_TIMEOUT_MS);
      dbConnected = true;
      dbLatency = Date.now() - dbStart;
    } catch (error: any) {
      await this.monitoring?.recordFailure(
        'api',
        `Database health check failed: ${error?.message || error}`,
        { check: 'database' },
        error,
      );
    }

    const redisStart = Date.now();
    let redisConnected = false;
    let redisLatency = 0;
    let queueConnected = false;
    let jobCounts: { waiting?: number; active?: number; failed?: number; delayed?: number } = {};

    try {
      if (this.remindersQueue) {
        const client = await withTimeout(this.remindersQueue.client, HEALTH_CHECK_TIMEOUT_MS);
        const pong = await withTimeout(client.ping(), HEALTH_CHECK_TIMEOUT_MS);
        redisConnected = pong === 'PONG';
        redisLatency = Date.now() - redisStart;

        const counts = await withTimeout(
          this.remindersQueue.getJobCounts('waiting', 'active', 'failed', 'delayed'),
          HEALTH_CHECK_TIMEOUT_MS,
        );
        queueConnected = true;
        jobCounts = {
          waiting: counts.waiting ?? 0,
          active: counts.active ?? 0,
          failed: counts.failed ?? 0,
          delayed: counts.delayed ?? 0,
        };
        this.monitoring?.recordSuccess('redis_queue');
      }
    } catch (error: any) {
      await this.monitoring?.recordFailure(
        'redis_queue',
        `Redis/BullMQ health check failed: ${error?.message || error}`,
        { check: 'redis_queue' },
        error,
      );
    }

    let storageAccessible = false;
    try {
      const uploadsDir = resolveUploadsDir();
      await fs.promises.mkdir(uploadsDir, { recursive: true });
      await fs.promises.access(uploadsDir, fs.constants.R_OK | fs.constants.W_OK);
      storageAccessible = true;
    } catch {
      storageAccessible = false;
    }

    const criticalDown = !dbConnected || !redisConnected || !queueConnected;
    const isDegraded =
      !criticalDown &&
      (!storageAccessible || (jobCounts.failed ?? 0) >= DEGRADED_FAILED_JOBS_THRESHOLD);

    const status: HealthStatus['status'] = criticalDown
      ? 'unhealthy'
      : isDegraded
        ? 'degraded'
        : 'healthy';

    return {
      status,
      services: {
        database: {
          connected: dbConnected,
          latency: dbLatency,
        },
        redis: {
          connected: redisConnected,
          latency: redisLatency,
        },
        queue: {
          connected: queueConnected,
          name: 'reminders',
          ...jobCounts,
        },
        storage: {
          accessible: storageAccessible,
        },
      },
      ...(this.monitoring ? { alerts: this.monitoring.getAlertSummary() } : {}),
      version: '1.0.0',
      uptime: process.uptime(),
    };
  }

  async getPublicSiteSummary() {
    const [activeArticlesCount, totalBadgesCount, pages] = await Promise.all([
      this.prisma.educationalArticle.count({
        where: {
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
        },
      }),
      this.prisma.achievement.count({ where: { isActive: true } }),
      this.prisma.page.findMany({
        where: { isActive: true },
        select: {
          slug: true,
          titleTr: true,
          titleEn: true,
          sortOrder: true,
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      }),
    ]);

    return {
      brand: 'Kadın Atlası',
      activeArticlesCount,
      totalBadgesCount,
      pages,
      storeLinks: {
        ios: process.env.APP_STORE_URL || 'https://apps.apple.com',
        android: process.env.PLAY_STORE_URL || 'https://play.google.com/store',
      },
    };
  }
}
