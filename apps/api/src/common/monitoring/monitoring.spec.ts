import { HttpException, HttpStatus } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AppController } from '../../app.controller';
import { AppService } from '../../app.service';
import { PushService } from '../../reminders/push.service';
import { MonitoringService } from './monitoring.service';
import { initApiSentry, resetSentryForTests, sanitizeSentryEvent } from './sentry';
import { MonitoringExceptionFilter } from './sentry-exception.filter';

describe('Monitoring, Sentry & Real Health Checks', () => {
  const originalEnv = { ...process.env };
  let tempDir: string;

  beforeEach(() => {
    resetSentryForTests();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wellness-health-test-'));
    process.env.UPLOADS_DIR = tempDir;
    delete process.env.ALERT_WEBHOOK_URL;
    delete process.env.ALERT_FAILURE_THRESHOLD;
    delete process.env.ALERT_COOLDOWN_MS;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Sentry initialization & PII scrubbing', () => {
    it('skips initialization when SENTRY_DSN is missing or __OPTIONAL__', () => {
      expect(initApiSentry({} as any)).toBe(false);
      expect(initApiSentry({ SENTRY_DSN: '__OPTIONAL__' } as any)).toBe(false);
    });

    it('scrubs cookies, authorization headers, email, and ip_address from events', () => {
      const scrubbed = sanitizeSentryEvent({
        request: {
          cookies: { sid: 'secret' },
          headers: { authorization: 'Bearer jwt', cookie: 'a=b', 'user-agent': 'app' },
        },
        user: { id: 'u1', email: 'alice@example.com', ip_address: '1.2.3.4' },
      });

      expect(scrubbed.request.cookies).toBeUndefined();
      expect(scrubbed.request.headers.authorization).toBeUndefined();
      expect(scrubbed.request.headers.cookie).toBeUndefined();
      expect(scrubbed.request.headers['user-agent']).toBe('app');
      expect(scrubbed.user).toEqual({ id: 'u1' });
    });
  });

  describe('AppService.getHealthStatus & AppController.healthCheck', () => {
    it('returns healthy and HTTP 200 when DB, Redis, BullMQ queue, and storage are all up', async () => {
      const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) } as any;
      const queue = {
        client: Promise.resolve({ ping: jest.fn().mockResolvedValue('PONG') }),
        getJobCounts: jest.fn().mockResolvedValue({ waiting: 1, active: 0, failed: 0, delayed: 2 }),
      } as any;
      const monitoring = new MonitoringService();
      const appService = new AppService(prisma, queue, monitoring);
      const controller = new AppController(appService);
      const res = { status: jest.fn() } as any;

      const health = await controller.healthCheck(res);

      expect(health.status).toBe('healthy');
      expect(health.services.database.connected).toBe(true);
      expect(health.services.redis.connected).toBe(true);
      expect(health.services.queue).toEqual({
        connected: true,
        name: 'reminders',
        waiting: 1,
        active: 0,
        failed: 0,
        delayed: 2,
      });
      expect(health.services.storage.accessible).toBe(true);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('returns unhealthy, HTTP 503, and records redis_queue alarm when Redis/BullMQ is down', async () => {
      const prisma = { $queryRaw: jest.fn().mockResolvedValue([1]) } as any;
      const queue = {
        client: Promise.reject(new Error('ECONNREFUSED redis:6379')),
        getJobCounts: jest.fn(),
      } as any;
      const monitoring = new MonitoringService();
      const fetchSpy = jest.fn().mockResolvedValue({ ok: true });
      (global as any).fetch = fetchSpy;
      process.env.ALERT_WEBHOOK_URL = 'https://hooks.example.com/alert';

      const appService = new AppService(prisma, queue, monitoring);
      const controller = new AppController(appService);
      const res = { status: jest.fn() } as any;

      const health = await controller.healthCheck(res);

      expect(health.status).toBe('unhealthy');
      expect(health.services.database.connected).toBe(true);
      expect(health.services.redis.connected).toBe(false);
      expect(health.services.queue.connected).toBe(false);
      expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
      expect(health.alerts?.redis_queue.totalFailures).toBe(1);
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://hooks.example.com/alert',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('returns unhealthy and HTTP 503 when database query fails', async () => {
      const prisma = { $queryRaw: jest.fn().mockRejectedValue(new Error('DB down')) } as any;
      const queue = {
        client: Promise.resolve({ ping: jest.fn().mockResolvedValue('PONG') }),
        getJobCounts: jest.fn().mockResolvedValue({ waiting: 0, active: 0, failed: 0, delayed: 0 }),
      } as any;
      const monitoring = new MonitoringService();
      const appService = new AppService(prisma, queue, monitoring);
      const controller = new AppController(appService);
      const res = { status: jest.fn() } as any;

      const health = await controller.healthCheck(res);
      expect(health.status).toBe('unhealthy');
      expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    });

    it('returns degraded when BullMQ failed job count reaches threshold', async () => {
      const prisma = { $queryRaw: jest.fn().mockResolvedValue([1]) } as any;
      const queue = {
        client: Promise.resolve({ ping: jest.fn().mockResolvedValue('PONG') }),
        getJobCounts: jest.fn().mockResolvedValue({ waiting: 0, active: 0, failed: 30, delayed: 0 }),
      } as any;
      const appService = new AppService(prisma, queue, new MonitoringService());
      const controller = new AppController(appService);
      const res = { status: jest.fn() } as any;

      const health = await controller.healthCheck(res);
      expect(health.status).toBe('degraded');
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('MonitoringService & domain failure alarms', () => {
    it('dispatches webhook alert on payment webhook failure and push failure threshold', async () => {
      const monitoring = new MonitoringService();
      const fetchSpy = jest.fn().mockResolvedValue({ ok: true });
      (global as any).fetch = fetchSpy;
      process.env.ALERT_WEBHOOK_URL = 'https://hooks.example.com/alert';
      process.env.ALERT_COOLDOWN_MS = '60000';

      // Payment webhook triggers immediately (threshold 1)
      await monitoring.recordFailure('payment_webhook', 'Apple JWS invalid');
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Push notification alerts after 3 consecutive failures
      await monitoring.recordFailure('push_notification', 'Push fail 1');
      await monitoring.recordFailure('push_notification', 'Push fail 2');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      await monitoring.recordFailure('push_notification', 'Push fail 3');
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('records push_notification failure from PushService when Expo API errors', async () => {
      const prisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'u-1',
            profile: { preferencesJson: { pushToken: 'ExponentPushToken[abc]' }, timezone: 'Europe/Istanbul' },
          }),
        },
      } as any;
      const monitoring = new MonitoringService();
      const pushService = new PushService(prisma, monitoring);

      (global as any).fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => ({ errors: [{ message: 'Expo gateway error' }] }),
      });

      const receipt = await pushService.sendPush('u-1', {
        to: '',
        title: 'Test',
        body: 'Body',
      });

      expect(receipt.status).toBe('error');
      expect(monitoring.getAlertSummary().push_notification.totalFailures).toBe(1);
    });

    it('MonitoringExceptionFilter records 5xx errors as api failures but ignores 4xx', () => {
      const monitoring = new MonitoringService();
      const recordSpy = jest.spyOn(monitoring, 'recordFailure').mockResolvedValue();
      const filter = new MonitoringExceptionFilter(monitoring);
      jest.spyOn(Object.getPrototypeOf(MonitoringExceptionFilter.prototype), 'catch').mockImplementation(() => {});

      const host: any = {
        switchToHttp: () => ({
          getRequest: () => ({ method: 'GET', url: '/test?x=1' }),
          getResponse: () => ({}),
        }),
      };

      filter.catch(new HttpException('Bad input', HttpStatus.BAD_REQUEST), host);
      expect(recordSpy).not.toHaveBeenCalled();

      filter.catch(new Error('Unexpected crash'), host);
      expect(recordSpy).toHaveBeenCalledWith(
        'api',
        expect.stringContaining('GET /test: Unexpected crash'),
        expect.objectContaining({ status: 500 }),
        expect.any(Error),
      );
    });
  });
});
