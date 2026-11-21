import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { UsersService } from './users.service';

describe('UsersService.updateProfile (preferencesJson isolation)', () => {
  it('strips reserved server-controlled keys like partnerLink and preserves server metadata', async () => {
    const prisma = {
      profile: {
        findUnique: jest.fn().mockResolvedValue({
          userId: 'user-1',
          firstName: 'Test',
          lastName: 'User',
          preferencesJson: {
            language: 'tr',
            pendingWinbackBanner: { title: 'Offer', incentive: 'nova_bonus' },
          },
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'user@example.com',
          password: 'hash',
          pinHash: null,
          profile: { preferencesJson: { language: 'en' } },
        }),
      },
    } as any;

    const service = new UsersService(prisma);
    await service.updateProfile('user-1', {
      preferencesJson: {
        language: 'en',
        partnerLink: { partnerUserId: 'victim-id', role: 'partner' },
        pendingWinbackBanner: { title: 'Forged', incentive: 'nova_bonus' },
        winbackRecoveredAt: '2099-01-01',
      },
    });

    expect(prisma.profile.update).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: {
        preferencesJson: {
          language: 'en',
          pendingWinbackBanner: { title: 'Offer', incentive: 'nova_bonus' },
        },
      },
    });
  });

  it('rejects non-object preferencesJson payloads', async () => {
    const prisma = {
      profile: {
        findUnique: jest.fn().mockResolvedValue({
          userId: 'user-1',
          preferencesJson: {},
        }),
      },
    } as any;

    const service = new UsersService(prisma);
    await expect(
      service.updateProfile('user-1', { preferencesJson: ['bad'] }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('UsersService.deleteUser & exportUserData (KVKK completeness)', () => {
  let tempDir: string;
  const originalUploadsDir = process.env.UPLOADS_DIR;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wellness-delete-test-'));
    process.env.UPLOADS_DIR = tempDir;
  });

  afterEach(() => {
    process.env.UPLOADS_DIR = originalUploadsDir;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('deletes only server-owned UploadedFile records for the user and never deletes another user file referenced by URL', async () => {
    const profileDir = path.join(tempDir, 'profiles');
    fs.mkdirSync(profileDir, { recursive: true });
    const victimPath = path.join(profileDir, 'victim-avatar.jpg');
    const attackerOwnPath = path.join(profileDir, 'attacker-own.png');
    fs.writeFileSync(victimPath, 'victim-img');
    fs.writeFileSync(attackerOwnPath, 'attacker-img');

    const prisma: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'attacker-1',
          email: 'attacker@example.com',
          // Even if attacker managed to store victim URL in profile/dailyLogs, deleteUser ignores URLs
          profile: {
            profilePictureUrl: 'https://api.kadinatlasi.com/uploads/profiles/victim-avatar.jpg',
          },
          dailyLogs: [
            { attachments: ['https://api.kadinatlasi.com/uploads/profiles/victim-avatar.jpg'] },
          ],
        }),
        delete: jest.fn().mockResolvedValue({ id: 'attacker-1' }),
      },
      uploadedFile: {
        findMany: jest.fn().mockResolvedValue([
          { relativePath: 'profiles/attacker-own.png' },
        ]),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      featureFlag: {
        findMany: jest.fn().mockResolvedValue([
          { key: 'support_ticket_1', valueJson: { userId: 'attacker-1', subject: 'Mine' } },
          { key: 'support_ticket_2', valueJson: { userId: 'victim-1', subject: 'Other' } },
        ]),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: {
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      passwordResetToken: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn(async (cb: any) => cb(prisma)),
    };

    const service = new UsersService(prisma);
    const result = await service.deleteUser('attacker-1');

    expect(result).toEqual({ success: true });
    expect(prisma.uploadedFile.findMany).toHaveBeenCalledWith({
      where: { userId: 'attacker-1' },
      select: { relativePath: true },
    });
    expect(prisma.uploadedFile.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'attacker-1' },
    });
    expect(prisma.auditLog.deleteMany).toHaveBeenCalledWith({
      where: { OR: [{ userId: 'attacker-1' }, { entity: 'User', entityId: 'attacker-1' }] },
    });
    expect(prisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
      where: { email: 'attacker@example.com' },
    });
    expect(prisma.featureFlag.deleteMany).toHaveBeenCalledWith({
      where: { key: { in: ['support_ticket_1'] } },
    });
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'attacker-1' } });
    expect(fs.existsSync(attackerOwnPath)).toBe(false);
    expect(fs.existsSync(victimPath)).toBe(true);
  });

  it('rejects updateProfile when profilePictureUrl points to another user uploaded file', async () => {
    const prisma: any = {
      profile: {
        findUnique: jest.fn().mockResolvedValue({ userId: 'attacker-1', preferencesJson: {} }),
        update: jest.fn(),
      },
      uploadedFile: {
        findUnique: jest.fn().mockResolvedValue({ userId: 'victim-1' }),
      },
      user: { findUnique: jest.fn() },
    };

    const service = new UsersService(prisma);
    await expect(
      service.updateProfile('attacker-1', {
        profilePictureUrl: 'https://api.kadinatlasi.com/uploads/profiles/victim-avatar.jpg',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.profile.update).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when deleting non-existent user', async () => {
    const prisma: any = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = new UsersService(prisma);
    await expect(service.deleteUser('missing')).rejects.toThrow(NotFoundException);
  });

  it('exports dailyLogs, full pregnancy sub-records, wellness logs, Q&A, partner, and supportTickets', async () => {
    const emptyArr = jest.fn().mockResolvedValue([]);
    const nullOne = jest.fn().mockResolvedValue(null);

    const prisma: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'alice@example.com',
          password: 'hashed-password',
          pinHash: 'hashed-pin',
          profile: { displayName: 'Alice' },
          subscription: null,
        }),
      },
      healthMetric: { findMany: emptyArr },
      dailyLog: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'dl-1', symptoms: ['cramps'], healthNotes: 'Hydrated' },
        ]),
      },
      waterLog: { findMany: emptyArr },
      stepsLog: { findMany: emptyArr },
      dailySteps: { findMany: emptyArr },
      sleepLog: { findMany: emptyArr },
      meditationSession: { findMany: emptyArr },
      wellnessPreferences: { findUnique: nullOne },
      periodCycle: { findMany: emptyArr },
      pregnancy: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'preg-1',
            kickCounts: [{ id: 'kc-1' }],
            contractions: [{ id: 'ct-1' }],
            appointments: [{ id: 'ap-1' }],
            medications: [{ id: 'pm-1' }],
            birthPlan: { id: 'bp-1' },
            hospitalBagItems: [{ id: 'hb-1' }],
            pregnancyNotes: [{ id: 'pn-1' }],
          },
        ]),
      },
      reminder: { findMany: emptyArr },
      conversation: { findMany: emptyArr },
      message: { findMany: emptyArr },
      memory: { findMany: emptyArr },
      usageQuota: { findUnique: nullOne },
      birthChartProfile: { findUnique: nullOne },
      userGamification: { findUnique: nullOne },
      userAchievement: { findMany: emptyArr },
      userInsight: { findMany: emptyArr },
      userHomePreferences: { findUnique: nullOne },
      userContentPreferences: { findUnique: nullOne },
      articleInteraction: { findMany: emptyArr },
      question: { findMany: emptyArr },
      answer: { findMany: emptyArr },
      questionComment: { findMany: emptyArr },
      answerComment: { findMany: emptyArr },
      answerVote: { findMany: emptyArr },
      questionFavorite: { findMany: emptyArr },
      questionFollower: { findMany: emptyArr },
      partnerLink: { findUnique: nullOne },
      partnerInvite: { findUnique: nullOne },
      featureFlag: {
        findMany: jest.fn().mockResolvedValue([
          { key: 'support_ticket_1', valueJson: { userId: 'user-1', subject: 'Help' } },
          { key: 'support_ticket_2', valueJson: { userId: 'other-user', subject: 'Not mine' } },
        ]),
      },
    };

    const service = new UsersService(prisma);
    const exported = await service.exportUserData('user-1');

    expect((exported.user as any).password).toBeUndefined();
    expect((exported.user as any).pinHash).toBeUndefined();
    expect(exported.dailyLogs).toHaveLength(1);
    expect(exported.pregnancy[0].kickCounts).toHaveLength(1);
    expect(exported.pregnancy[0].contractions).toHaveLength(1);
    expect(exported.pregnancy[0].appointments).toHaveLength(1);
    expect(exported.pregnancy[0].medications).toHaveLength(1);
    expect(exported.pregnancy[0].birthPlan).toEqual({ id: 'bp-1' });
    expect(exported.pregnancy[0].hospitalBagItems).toHaveLength(1);
    expect(exported.pregnancy[0].pregnancyNotes).toHaveLength(1);
    expect(exported.supportTickets).toEqual([{ userId: 'user-1', subject: 'Help' }]);
    expect(prisma.pregnancy.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          kickCounts: expect.any(Object),
          contractions: expect.any(Object),
          appointments: expect.any(Object),
          medications: expect.any(Object),
          birthPlan: true,
          hospitalBagItems: expect.any(Object),
          pregnancyNotes: expect.any(Object),
        }),
      }),
    );
  });
});
