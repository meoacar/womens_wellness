import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PostpartumService } from './postpartum.service';

describe('PostpartumService', () => {
  const mockPrisma: any = {
    profile: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    babyProfile: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    babyVaccineRecord: {
      createMany: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    feedingLog: {
      findMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    diaperLog: {
      findMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    babySleepLog: {
      findMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    babyGrowthLog: {
      findMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  let service: PostpartumService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PostpartumService(mockPrisma);
  });

  it('rejects invalid life stage', async () => {
    await expect(service.updateLifeStage('user-1', 'INVALID')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('updates valid life stage to POSTPARTUM', async () => {
    mockPrisma.profile.update.mockResolvedValue({ lifeStage: 'POSTPARTUM' });
    const res = await service.updateLifeStage('user-1', 'postpartum');
    expect(res).toEqual({ lifeStage: 'POSTPARTUM' });
    expect(mockPrisma.profile.update).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: { lifeStage: 'POSTPARTUM' },
    });
  });

  it('creates baby profile, seeds 17 vaccines, and switches lifeStage to POSTPARTUM', async () => {
    mockPrisma.babyProfile.findFirst.mockResolvedValue(null);
    mockPrisma.babyProfile.create.mockResolvedValue({
      id: 'baby-1',
      userId: 'user-1',
      name: 'Defne',
      birthDate: new Date('2026-11-01'),
    });
    mockPrisma.babyVaccineRecord.createMany.mockResolvedValue({ count: 17 });
    mockPrisma.profile.update.mockResolvedValue({});

    const baby = await service.upsertBabyProfile('user-1', {
      name: 'Defne',
      birthDate: '2026-11-01',
      gender: 'GIRL',
    });

    expect(baby.id).toBe('baby-1');
    expect(mockPrisma.babyVaccineRecord.createMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.babyVaccineRecord.createMany.mock.calls[0][0].data).toHaveLength(17);
    expect(mockPrisma.profile.update).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: { lifeStage: 'POSTPARTUM' },
    });
  });

  it('throws NotFoundException when logging feeding without baby profile', async () => {
    mockPrisma.babyProfile.findFirst.mockResolvedValue(null);
    await expect(
      service.logFeeding('user-1', { type: 'BREAST_LEFT', durationSec: 600 }),
    ).rejects.toThrow(NotFoundException);
  });
});
