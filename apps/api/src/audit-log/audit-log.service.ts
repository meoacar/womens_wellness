import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { ClientTelemetry } from '../common/utils/client-telemetry';

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  VIEW = 'VIEW',
  EXPORT = 'EXPORT',
}

@Injectable()
export class AuditLogService {
  constructor(private prisma: PrismaService) {}

  async findAll(params?: {
    page?: number;
    limit?: number;
    userId?: string;
    action?: string;
    entity?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const {
      page = 1,
      limit = 50,
      userId,
      action,
      entity,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params || {};
    const skip = (page - 1) * limit;
    const allowedSortFields = ['createdAt', 'action', 'entity', 'entityId'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const safeSortOrder: 'asc' | 'desc' =
      sortOrder === 'asc' || sortOrder === 'ascend' ? 'asc' : 'desc';

    const where: any = {};
    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (entity) where.entity = entity;
    if (search?.trim()) {
      const q = search.trim();
      where.OR = [
        { action: { contains: q, mode: 'insensitive' } },
        { entity: { contains: q, mode: 'insensitive' } },
        { entityId: { contains: q, mode: 'insensitive' } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { [safeSortBy]: safeSortOrder },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async findOne(id: string) {
    return this.prisma.auditLog.findUnique({
      where: { id },
    });
  }

  async log(data: {
    userId?: string;
    action: string;
    entity: string;
    entityId?: string;
    metadataJson?: any;
  }) {
    return this.prisma.auditLog.create({
      data: {
        ...data,
        metadataJson: data.metadataJson || {},
      },
    });
  }

  async logCreate(userId: string, entity: string, entityId: string, metadata?: any) {
    return this.log({
      userId,
      action: AuditAction.CREATE,
      entity,
      entityId,
      metadataJson: metadata,
    });
  }

  async logUpdate(userId: string, entity: string, entityId: string, metadata?: any) {
    return this.log({
      userId,
      action: AuditAction.UPDATE,
      entity,
      entityId,
      metadataJson: metadata,
    });
  }

  async logDelete(userId: string, entity: string, entityId: string, metadata?: any) {
    return this.log({
      userId,
      action: AuditAction.DELETE,
      entity,
      entityId,
      metadataJson: metadata,
    });
  }

  async logLogin(userId: string, metadata?: any) {
    return this.log({
      userId,
      action: AuditAction.LOGIN,
      entity: 'auth',
      metadataJson: metadata,
    });
  }

  async logLogout(userId: string, metadata?: any) {
    return this.log({
      userId,
      action: AuditAction.LOGOUT,
      entity: 'auth',
      metadataJson: metadata,
    });
  }

  async touchUserTelemetry(userId: string, telemetry?: ClientTelemetry) {
    if (!userId || !telemetry) return;
    const hasFields = Boolean(
      telemetry.ipAddress ||
        telemetry.deviceModel ||
        telemetry.osVersion ||
        telemetry.appVersion ||
        telemetry.userAgent,
    );
    if (!hasFields) return;
    await this.prisma.user
      .update({
        where: { id: userId },
        data: {
          ...(telemetry.ipAddress ? { lastIpAddress: telemetry.ipAddress } : {}),
          ...(telemetry.deviceModel ? { lastDeviceModel: telemetry.deviceModel } : {}),
          ...(telemetry.osVersion ? { lastOsVersion: telemetry.osVersion } : {}),
          ...(telemetry.appVersion ? { lastAppVersion: telemetry.appVersion } : {}),
          ...(telemetry.userAgent ? { lastUserAgent: telemetry.userAgent } : {}),
          lastSeenAt: new Date(),
        },
      })
      .catch(() => {});
  }
}
