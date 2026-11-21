import { Injectable, Logger } from '@nestjs/common';
import { captureSentryException, captureSentryMessage } from './sentry';

export type AlertCategory =
  | 'api'
  | 'redis_queue'
  | 'payment_webhook'
  | 'push_notification';

export interface CategoryAlertStats {
  totalFailures: number;
  consecutiveFailures: number;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  lastAlertAt: string | null;
}

const DEFAULT_THRESHOLDS: Record<AlertCategory, number> = {
  api: 3,
  redis_queue: 1,
  payment_webhook: 1,
  push_notification: 3,
};

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);
  private readonly stats = new Map<AlertCategory, CategoryAlertStats>();
  private readonly lastAlertTimestamp = new Map<AlertCategory, number>();

  constructor() {
    for (const category of [
      'api',
      'redis_queue',
      'payment_webhook',
      'push_notification',
    ] as AlertCategory[]) {
      this.stats.set(category, {
        totalFailures: 0,
        consecutiveFailures: 0,
        lastErrorAt: null,
        lastErrorMessage: null,
        lastAlertAt: null,
      });
    }
  }

  private getThreshold(category: AlertCategory): number {
    const envOverride = Number(process.env.ALERT_FAILURE_THRESHOLD);
    if (Number.isFinite(envOverride) && envOverride >= 1) {
      return category === 'payment_webhook' || category === 'redis_queue'
        ? 1
        : Math.floor(envOverride);
    }
    return DEFAULT_THRESHOLDS[category];
  }

  private getCooldownMs(): number {
    const raw = Number(process.env.ALERT_COOLDOWN_MS);
    return Number.isFinite(raw) && raw >= 0 ? raw : 5 * 60 * 1000;
  }

  async recordFailure(
    category: AlertCategory,
    message: string,
    context?: Record<string, any>,
    error?: unknown,
  ): Promise<void> {
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const current = this.stats.get(category) || {
      totalFailures: 0,
      consecutiveFailures: 0,
      lastErrorAt: null,
      lastErrorMessage: null,
      lastAlertAt: null,
    };

    const updated: CategoryAlertStats = {
      ...current,
      totalFailures: current.totalFailures + 1,
      consecutiveFailures: current.consecutiveFailures + 1,
      lastErrorAt: nowIso,
      lastErrorMessage: message.slice(0, 300),
    };
    this.stats.set(category, updated);

    if (error !== undefined) {
      captureSentryException(error, { category, message, ...context }, { alert_category: category });
    } else {
      captureSentryMessage(
        `[${category}] ${message}`,
        'error',
        context,
        { alert_category: category },
      );
    }

    const threshold = this.getThreshold(category);
    const cooldownMs = this.getCooldownMs();
    const lastAlertAt = this.lastAlertTimestamp.get(category) || 0;

    if (
      updated.consecutiveFailures >= threshold &&
      now - lastAlertAt >= cooldownMs
    ) {
      this.lastAlertTimestamp.set(category, now);
      updated.lastAlertAt = nowIso;
      this.stats.set(category, updated);
      await this.dispatchAlert(category, message, updated, context);
    }
  }

  recordSuccess(category: AlertCategory): void {
    const current = this.stats.get(category);
    if (!current || current.consecutiveFailures === 0) return;

    this.stats.set(category, {
      ...current,
      consecutiveFailures: 0,
    });
  }

  getAlertSummary(): Record<AlertCategory, CategoryAlertStats> {
    return {
      api: { ...this.stats.get('api')! },
      redis_queue: { ...this.stats.get('redis_queue')! },
      payment_webhook: { ...this.stats.get('payment_webhook')! },
      push_notification: { ...this.stats.get('push_notification')! },
    };
  }

  private async dispatchAlert(
    category: AlertCategory,
    message: string,
    stats: CategoryAlertStats,
    context?: Record<string, any>,
  ): Promise<void> {
    this.logger.error(
      `ALERT [${category}] (consecutive=${stats.consecutiveFailures}, total=${stats.totalFailures}): ${message}`,
    );

    const webhookUrl = process.env.ALERT_WEBHOOK_URL?.trim();
    if (!webhookUrl) return;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `[${process.env.NODE_ENV || 'development'}] ALERT (${category}): ${message}`,
          category,
          environment: process.env.NODE_ENV || 'development',
          consecutiveFailures: stats.consecutiveFailures,
          totalFailures: stats.totalFailures,
          timestamp: stats.lastErrorAt,
          context: context || {},
        }),
        signal: controller.signal,
      });
    } catch (err: any) {
      this.logger.warn(`Failed to deliver alert webhook: ${err?.message || err}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
