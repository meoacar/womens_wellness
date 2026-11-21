import { Global, Module } from '@nestjs/common';
import { APP_FILTER, HttpAdapterHost } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { MonitoringService } from './monitoring.service';
import { MonitoringExceptionFilter } from './sentry-exception.filter';

@Global()
@Module({
  providers: [
    MonitoringService,
    {
      provide: APP_FILTER,
      inject: [MonitoringService, HttpAdapterHost, PrismaService],
      useFactory: (
        monitoring: MonitoringService,
        httpAdapterHost: HttpAdapterHost,
        prisma: PrismaService,
      ) => {
        const filter = new MonitoringExceptionFilter(monitoring, prisma);
        (filter as any).applicationRef = httpAdapterHost?.httpAdapter;
        return filter;
      },
    },
  ],
  exports: [MonitoringService],
})
export class MonitoringModule {}
