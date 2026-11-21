import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { MonitoringService } from './monitoring.service';
import { PrismaService } from '../../prisma/prisma.service';
import { extractClientTelemetry } from '../utils/client-telemetry';

@Catch()
export class MonitoringExceptionFilter extends BaseExceptionFilter {
  constructor(
    private readonly monitoring: MonitoringService,
    private readonly prisma?: PrismaService,
  ) {
    super();
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<any>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const path = (req?.url || '').split('?')[0];
    const message =
      exception instanceof Error
        ? exception.message
        : 'Unhandled server exception';

    if (status >= 500) {
      this.monitoring
        .recordFailure(
          'api',
          `${req?.method || 'HTTP'} ${path || '/'}: ${message}`,
          { method: req?.method, path, status },
          exception,
        )
        .catch(() => undefined);
    }

    // Persist API 4xx/5xx error logs for user diagnostics (excluding normal refresh 401 expiry)
    if (
      this.prisma?.userErrorLog &&
      status >= 400 &&
      !(status === 401 && path.startsWith('/auth/refresh'))
    ) {
      const telemetry = extractClientTelemetry(req);
      const userId = req?.user?.id || undefined;
      if (userId || status >= 500) {
        this.prisma.userErrorLog
          .create({
            data: {
              userId,
              source: 'API',
              level: status >= 500 ? 'FATAL' : 'ERROR',
              statusCode: status,
              method: req?.method || null,
              path: path || null,
              message: String(message).slice(0, 500),
              stack:
                exception instanceof Error && exception.stack
                  ? exception.stack.slice(0, 2000)
                  : null,
              ipAddress: telemetry.ipAddress,
              deviceModel: telemetry.deviceModel,
              osVersion: telemetry.osVersion,
              appVersion: telemetry.appVersion,
            },
          })
          .catch(() => undefined);
      }
    }

    super.catch(exception, host);
  }
}
