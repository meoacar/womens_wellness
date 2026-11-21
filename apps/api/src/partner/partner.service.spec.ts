import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PartnerService } from './partner.service';

describe('PartnerService (security & mutual link validation)', () => {
  it('never trusts preferencesJson.partnerLink and returns disconnected when no PartnerLink row exists', async () => {
    const prisma = {
      featureFlag: { findUnique: jest.fn().mockResolvedValue(null) },
      partnerLink: { findFirst: jest.fn().mockResolvedValue(null) },
      periodCycle: { findMany: jest.fn() },
    } as any;

    const service = new PartnerService(prisma);
    const result = await service.getStatus('attacker-id');

    expect(result).toEqual({ connected: false, link: null, partnerSummary: null });
    expect(prisma.periodCycle.findMany).not.toHaveBeenCalled();
  });

  it('denies cycle summary when viewer is the owner rather than the verified partner', async () => {
    const prisma = {
      featureFlag: { findUnique: jest.fn().mockResolvedValue(null) },
      partnerLink: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'link-1',
          ownerUserId: 'owner-1',
          partnerUserId: 'partner-1',
          connectedAt: new Date('2026-11-18T00:00:00Z'),
          owner: { id: 'owner-1', status: 'ACTIVE', profile: { displayName: 'Ayşe' } },
          partner: { id: 'partner-1', status: 'ACTIVE', profile: { displayName: 'Ali' } },
        }),
      },
      periodCycle: { findMany: jest.fn() },
    } as any;

    const service = new PartnerService(prisma);
    const result = await service.getStatus('owner-1');

    expect(result.connected).toBe(true);
    expect(result.link?.role).toBe('owner');
    expect(result.partnerSummary).toBeNull();
    expect(prisma.periodCycle.findMany).not.toHaveBeenCalled();
  });

  it('returns owner cycle summary ONLY for the verified mutual partner on an active link', async () => {
    const prisma = {
      featureFlag: { findUnique: jest.fn().mockResolvedValue(null) },
      partnerLink: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'link-1',
          ownerUserId: 'owner-1',
          partnerUserId: 'partner-1',
          connectedAt: new Date('2026-11-18T00:00:00Z'),
          owner: { id: 'owner-1', status: 'ACTIVE', profile: { displayName: 'Ayşe' } },
          partner: { id: 'partner-1', status: 'ACTIVE', profile: { displayName: 'Ali' } },
        }),
      },
      periodCycle: {
        findMany: jest.fn().mockResolvedValue([{ startDate: new Date() }]),
      },
    } as any;

    const service = new PartnerService(prisma);
    const result = await service.getStatus('partner-1');

    expect(prisma.periodCycle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'owner-1' } }),
    );
    expect(result.connected).toBe(true);
    expect(result.link?.role).toBe('partner');
    expect(result.partnerSummary?.ownerDisplayName).toBe('Ayşe');
    expect(result.partnerSummary?.cycleDay).toBe(1);
  });

  it('refuses cycle summary when either linked account is not ACTIVE', async () => {
    const prisma = {
      featureFlag: { findUnique: jest.fn().mockResolvedValue(null) },
      partnerLink: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'link-1',
          ownerUserId: 'owner-1',
          partnerUserId: 'partner-1',
          connectedAt: new Date('2026-11-18T00:00:00Z'),
          owner: { id: 'owner-1', status: 'SUSPENDED', profile: { displayName: 'Ayşe' } },
          partner: { id: 'partner-1', status: 'ACTIVE', profile: { displayName: 'Ali' } },
        }),
      },
      periodCycle: { findMany: jest.fn() },
    } as any;

    const service = new PartnerService(prisma);
    const result = await service.getStatus('partner-1');

    expect(result).toEqual({ connected: false, link: null, partnerSummary: null });
    expect(prisma.periodCycle.findMany).not.toHaveBeenCalled();
  });

  it('refuses cycle summary when partner_mode_enabled flag is false', async () => {
    const prisma = {
      featureFlag: { findUnique: jest.fn().mockResolvedValue({ key: 'partner_mode_enabled', valueJson: false }) },
      partnerLink: { findFirst: jest.fn() },
      periodCycle: { findMany: jest.fn() },
    } as any;

    const service = new PartnerService(prisma);
    const result = await service.getStatus('partner-1');

    expect(result).toEqual({ connected: false, link: null, partnerSummary: null });
    expect(prisma.partnerLink.findFirst).not.toHaveBeenCalled();
    expect(prisma.periodCycle.findMany).not.toHaveBeenCalled();
  });

  it('rejects self-invite acceptance and rejects double-linking inside transaction', async () => {
    const tx = {
      partnerInvite: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'inv-1',
          code: 'ABC123',
          ownerUserId: 'owner-1',
          expiresAt: new Date(Date.now() + 60_000),
        }),
      },
      user: {
        findUnique: jest.fn(),
      },
      partnerLink: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    };
    const prisma = {
      featureFlag: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((cb: any) => cb(tx)),
    } as any;

    const service = new PartnerService(prisma);

    await expect(service.acceptInvite('owner-1', 'ABC123')).rejects.toThrow(BadRequestException);

    tx.user.findUnique
      .mockResolvedValueOnce({ id: 'owner-1', status: 'ACTIVE', profile: { displayName: 'Ayşe' } })
      .mockResolvedValueOnce({ id: 'partner-2', status: 'ACTIVE', profile: { displayName: 'Can' } });
    tx.partnerLink.findFirst.mockResolvedValueOnce({ id: 'existing-link' });

    await expect(service.acceptInvite('partner-2', 'ABC123')).rejects.toThrow(ConflictException);
    expect(tx.partnerLink.create).not.toHaveBeenCalled();
  });

  it('blocks invite creation when partner_mode_enabled is disabled', async () => {
    const prisma = {
      featureFlag: { findUnique: jest.fn().mockResolvedValue({ key: 'partner_mode_enabled', valueJson: false }) },
    } as any;

    const service = new PartnerService(prisma);
    await expect(service.createInvite('owner-1')).rejects.toThrow(ForbiddenException);
  });
});
