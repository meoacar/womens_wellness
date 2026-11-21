import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AdminGuard } from '../common/guards/admin.guard';
import { FeatureFlagController } from './feature-flag.controller';
import { FeatureFlagService } from './feature-flag.service';

describe('FeatureFlag security & isolation', () => {
  describe('FeatureFlagController guards', () => {
    it('requires AdminGuard on findAll, findOne, create, update, delete', () => {
      const protectedMethods = ['findAll', 'findOne', 'create', 'update', 'delete'] as const;
      for (const methodName of protectedMethods) {
        const guards = Reflect.getMetadata(
          GUARDS_METADATA,
          (FeatureFlagController.prototype as any)[methodName],
        );
        expect(guards).toEqual(expect.arrayContaining([AdminGuard]));
      }
    });

    it('leaves only findPublicFlags open for client flag polling', () => {
      const publicGuards = Reflect.getMetadata(
        GUARDS_METADATA,
        FeatureFlagController.prototype.findPublicFlags,
      );
      expect(publicGuards).toBeUndefined();
    });
  });

  describe('FeatureFlagService internal key filtering', () => {
    function createService() {
      const prisma = {
        featureFlag: {
          findMany: jest.fn().mockResolvedValue([
            { key: 'community_enabled', valueJson: true },
          ]),
          findFirst: jest.fn(),
          findUnique: jest.fn(),
          count: jest.fn().mockResolvedValue(1),
          create: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
          upsert: jest.fn(),
          deleteMany: jest.fn(),
        },
      } as any;
      return { service: new FeatureFlagService(prisma), prisma };
    }

    it.each([
      'support_ticket_12345',
      ' support_ticket_12345 ',
      'partner_invite_ABC123',
      'period_notifications_config',
      'period_notifications_dispatch_logs',
      'retention_winback_config',
      'retention_winback_logs',
      'premium_paywall_config',
      'nova_quota_config',
      'nova_limits_config',
      'ai.google.enabled',
      'reminders.server_push',
      'admin.impersonation',
    ])('blocks single-key read/write access to internal or legacy key %s', async (key) => {
      const { service, prisma } = createService();

      await expect(service.findOne(key)).rejects.toThrow(NotFoundException);
      expect(prisma.featureFlag.findFirst).not.toHaveBeenCalled();

      await expect(service.create({ key, valueJson: { hacked: true } })).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.update(key, { valueJson: { hacked: true } })).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.delete(key)).rejects.toThrow(NotFoundException);
    });

    it('queries public filter when looking up non-internal keys in findOne', async () => {
      const { service, prisma } = createService();
      prisma.featureFlag.findFirst.mockResolvedValue({
        key: 'community_enabled',
        valueJson: true,
      });

      const res = await service.findOne('community_enabled');
      expect(res).toEqual({ key: 'community_enabled', valueJson: true });
      expect(prisma.featureFlag.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              { key: 'community_enabled' },
              expect.objectContaining({ AND: expect.any(Array) }),
            ]),
          }),
        }),
      );
    });

    it('filters internal keys out of findPublicFlags and findAll', async () => {
      const { service, prisma } = createService();

      const publicFlags = await service.findPublicFlags();
      expect(publicFlags).toEqual({ community_enabled: true });

      await service.findAll({ page: 1, limit: 50 });
      expect(prisma.featureFlag.findMany).toHaveBeenCalledTimes(2);
      for (const call of prisma.featureFlag.findMany.mock.calls) {
        expect(call[0].where).toEqual(
          expect.objectContaining({
            AND: expect.arrayContaining([
              { NOT: { key: { startsWith: 'support_ticket_' } } },
              { NOT: { key: { startsWith: 'partner_invite_' } } },
            ]),
          }),
        );
      }
    });
  });
});
