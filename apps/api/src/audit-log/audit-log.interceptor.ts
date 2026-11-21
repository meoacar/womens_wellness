import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditLogService } from './audit-log.service';
import { extractClientTelemetry } from '../common/utils/client-telemetry';

const EXACT_SECRET_KEYS = new Set([
  'password',
  'currentpassword',
  'newpassword',
  'confirmpassword',
  'pin',
  'oldpin',
  'newpin',
  'pinhash',
  'refreshtoken',
  'accesstoken',
  'idtoken',
  'token',
  'secret',
  'secretkey',
  'clientsecret',
  'webhooksecret',
  'apikey',
  'privatekey',
  'authorization',
  'receiptdata',
  'purchasetoken',
  'signedpayload',
  'signedtransactioninfo',
  'signedrenewalinfo',
  'signature',
  'credential',
  'credentials',
]);

const SECRET_KEY_SUFFIXES = [
  'password',
  'secret',
  'token',
  'apikey',
  'privatekey',
  'signature',
];

const REDACTED_CONTENT_KEYS = new Set([
  'notes',
  'note',
  'healthnotes',
  'sexnotes',
  'doctornotes',
  'adminnote',
  'moderatornote',
  'symptoms',
  'symptomsjson',
  'medications',
  'mood',
  'contraception',
  'flow',
  'cramps',
  'hadsex',
  'vitalsjson',
  'contentjson',
  'preferencesjson',
  'content',
  'message',
  'messages',
  'prompt',
  'systemprompt',
  'reply',
  'answer',
  'subject',
  'body',
  'text',
  'title',
  'description',
  'attachments',
  'dateofbirth',
  'birthdate',
  'birthtime',
  'email',
  'useremail',
]);

const BODY_OMITTED_PREFIXES = [
  '/auth',
  '/chat',
  '/cycles',
  '/pregnancy',
  '/metrics',
  '/water',
  '/steps',
  '/wellness',
  '/qna',
  '/support',
  '/me',
  '/users/me',
  '/partner',
  '/reminders',
  '/subscription/verify',
  '/subscription/restore',
];

function normalizeKey(key: string): string {
  return key.replace(/[_-]/g, '').toLowerCase();
}

export function isSensitiveSecretKey(key: string): boolean {
  const norm = normalizeKey(key);
  if (EXACT_SECRET_KEYS.has(norm)) return true;
  return SECRET_KEY_SUFFIXES.some((suffix) => norm.endsWith(suffix));
}

export function isRedactedContentKey(key: string): boolean {
  return REDACTED_CONTENT_KEYS.has(normalizeKey(key));
}

export function shouldOmitAuditBody(path: string): boolean {
  const normalizedPath = (path || '').split('?')[0].toLowerCase();
  return BODY_OMITTED_PREFIXES.some(
    (prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`),
  );
}

export function sanitizeBody(input: any): any {
  if (!input || typeof input !== 'object') return input;
  if (Array.isArray(input)) {
    return input.slice(0, 10).map((item) => sanitizeBody(item));
  }
  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(input)) {
    if (isSensitiveSecretKey(key)) {
      clean[key] = '[MASKED]';
    } else if (isRedactedContentKey(key)) {
      clean[key] = '[REDACTED]';
    } else if (typeof val === 'string' && val.length > 200) {
      clean[key] = `${val.slice(0, 200)}...`;
    } else if (val && typeof val === 'object') {
      clean[key] = sanitizeBody(val);
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

export function buildAuditMetadata(
  method: string,
  path: string,
  body: any,
): Record<string, any> {
  if (shouldOmitAuditBody(path)) {
    const fieldCount =
      body && typeof body === 'object' && !Array.isArray(body)
        ? Object.keys(body).length
        : undefined;
    return {
      method,
      path,
      bodyRedacted: true,
      ...(fieldCount !== undefined ? { fieldCount } : {}),
    };
  }

  return {
    method,
    path,
    body: body ? sanitizeBody(body) : undefined,
  };
}

function inferEntity(path: string): string {
  if (path.includes('feature-flags')) return 'FeatureFlag';
  if (path.includes('period-notifications')) return 'PeriodNotification';
  if (path.includes('support')) return 'SupportTicket';
  if (path.includes('subscription')) return 'Subscription';
  if (path.includes('retention')) return 'Retention';
  if (path.includes('admin/users') || path.includes('/users') || path.includes('bulk') || path.startsWith('/me')) return 'User';
  if (path.includes('cycles')) return 'PeriodCycle';
  if (path.includes('reminders')) return 'Reminder';
  if (path.includes('qna')) return 'QnA';
  if (path.includes('discover')) return 'Article';
  if (path.includes('/pages')) return 'Page';
  if (path.includes('/wellness') || path.includes('/steps')) return 'Wellness';
  if (path.includes('/metrics')) return 'Metrics';
  if (path.includes('ai-providers') || path.includes('model-policies') || path.includes('quotas')) {
    return 'AIConfig';
  }
  if (path.includes('auth')) return 'Auth';
  return 'System';
}

function inferAction(method: string, path: string): string {
  if (path.startsWith('/auth/login')) return 'LOGIN';
  if (path.startsWith('/auth/register')) return 'CREATE';
  if (path.startsWith('/auth/logout')) return 'LOGOUT';
  if (path.includes('impersonate')) return 'USER_IMPERSONATION';
  if (method === 'POST') return 'CREATE';
  if (method === 'PUT' || method === 'PATCH') return 'UPDATE';
  if (method === 'DELETE') return 'DELETE';
  return method;
}

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly telemetryTouchMap = new Map<string, number>();

  constructor(private readonly auditLogService: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest();
    const telemetry = extractClientTelemetry(req);
    const reqUserId = req.user?.id;
    if (reqUserId) {
      const now = Date.now();
      const last = this.telemetryTouchMap.get(reqUserId) || 0;
      if (now - last >= 60_000) {
        this.telemetryTouchMap.set(reqUserId, now);
        this.auditLogService.touchUserTelemetry(reqUserId, telemetry).catch(() => {});
      }
    }

    const method = (req.method || 'GET').toUpperCase();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const rawUrl = (req.url || '').split('?')[0];
    if (
      rawUrl.startsWith('/auth/refresh') ||
      rawUrl.startsWith('/audit-logs') ||
      rawUrl.startsWith('/health')
    ) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: (responseData) => {
          const userId =
            req.user?.id ||
            responseData?.user?.id ||
            undefined;
          const entity = inferEntity(rawUrl);
          const action = inferAction(method, rawUrl);
          const entityId =
            req.params?.id ||
            req.params?.key ||
            req.params?.userId ||
            responseData?.id ||
            responseData?.key ||
            undefined;

          const metadataJson = {
            ...buildAuditMetadata(method, rawUrl, req.body),
            ...(telemetry.ipAddress ? { ipAddress: telemetry.ipAddress } : {}),
            ...(telemetry.deviceModel ? { deviceModel: telemetry.deviceModel } : {}),
            ...(telemetry.osVersion ? { osVersion: telemetry.osVersion } : {}),
            ...(telemetry.appVersion ? { appVersion: telemetry.appVersion } : {}),
          };

          this.auditLogService
            .log({
              userId,
              action,
              entity,
              entityId: entityId ? String(entityId) : undefined,
              metadataJson,
            })
            .catch(() => {});
        },
        error: (err) => {
          const status = err?.status || err?.statusCode || 500;
          if (status < 500) return;

          const entity = inferEntity(rawUrl);
          this.auditLogService
            .log({
              userId: req.user?.id || undefined,
              action: 'SERVER_ERROR',
              entity,
              metadataJson: {
                method,
                path: rawUrl,
                status,
                message: String(err?.message || 'Internal Server Error').slice(0, 200),
                ...(telemetry.ipAddress ? { ipAddress: telemetry.ipAddress } : {}),
                ...(telemetry.deviceModel ? { deviceModel: telemetry.deviceModel } : {}),
              },
            })
            .catch(() => {});
        },
      }),
    );
  }
}
