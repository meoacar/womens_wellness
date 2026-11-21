import * as Sentry from '@sentry/node';

let sentryInitialized = false;

/**
 * Scrubs sensitive headers and user identifiers before sending events to Sentry.
 */
export function sanitizeSentryEvent<T extends Record<string, any>>(event: T): T {
  if (!event || typeof event !== 'object') return event;

  if (event.request) {
    delete event.request.cookies;
    if (event.request.headers) {
      delete event.request.headers.authorization;
      delete event.request.headers.cookie;
    }
  }

  if (event.user) {
    delete event.user.email;
    delete event.user.ip_address;
  }

  return event;
}

/**
 * Initializes Sentry error monitoring for the NestJS API when `SENTRY_DSN` is configured.
 */
export function initApiSentry(env: NodeJS.ProcessEnv = process.env): boolean {
  if (sentryInitialized) return true;

  const dsn = env.SENTRY_DSN?.trim();
  if (!dsn || dsn === '__OPTIONAL__') {
    return false;
  }

  const isProd = env.NODE_ENV === 'production';

  Sentry.init({
    dsn,
    environment: env.NODE_ENV || 'development',
    tracesSampleRate: isProd ? 0.1 : 1.0,
    beforeSend(event) {
      return sanitizeSentryEvent(event as any);
    },
  });

  sentryInitialized = true;
  return true;
}

export function isApiSentryEnabled(): boolean {
  return sentryInitialized;
}

export function captureSentryException(
  error: unknown,
  context?: Record<string, any>,
  tags?: Record<string, string>,
): void {
  if (!sentryInitialized) return;

  Sentry.withScope((scope) => {
    if (tags) {
      for (const [key, value] of Object.entries(tags)) {
        scope.setTag(key, value);
      }
    }
    if (context) {
      scope.setContext('details', context);
    }
    Sentry.captureException(error);
  });
}

export function captureSentryMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'info' = 'error',
  context?: Record<string, any>,
  tags?: Record<string, string>,
): void {
  if (!sentryInitialized) return;

  Sentry.withScope((scope) => {
    if (tags) {
      for (const [key, value] of Object.entries(tags)) {
        scope.setTag(key, value);
      }
    }
    if (context) {
      scope.setContext('details', context);
    }
    Sentry.captureMessage(message, level);
  });
}

export function resetSentryForTests(): void {
  sentryInitialized = false;
}
