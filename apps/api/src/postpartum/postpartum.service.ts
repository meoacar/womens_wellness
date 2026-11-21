import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type LifeStage = 'CYCLE' | 'FERTILITY' | 'PREGNANCY' | 'POSTPARTUM';
const VALID_LIFE_STAGES: LifeStage[] = ['CYCLE', 'FERTILITY', 'PREGNANCY', 'POSTPARTUM'];

const DEFAULT_VACCINE_SCHEDULE = [
  { vaccineCode: 'HEPB_1', title: 'Hepatit B (1. Doz)', dueMonth: 0 },
  { vaccineCode: 'HEPB_2', title: 'Hepatit B (2. Doz)', dueMonth: 1 },
  { vaccineCode: 'BCG', title: 'BCG (Verem)', dueMonth: 2 },
  { vaccineCode: 'DABT_1', title: '5’li Karma (DaBT-İPA-Hib 1. Doz)', dueMonth: 2 },
  { vaccineCode: 'KPA_1', title: 'KPA (Pnömokok 1. Doz)', dueMonth: 2 },
  { vaccineCode: 'DABT_2', title: '5’li Karma (2. Doz)', dueMonth: 4 },
  { vaccineCode: 'KPA_2', title: 'KPA (Pnömokok 2. Doz)', dueMonth: 4 },
  { vaccineCode: 'HEPB_3', title: 'Hepatit B (3. Doz)', dueMonth: 6 },
  { vaccineCode: 'DABT_3', title: '5’li Karma (3. Doz)', dueMonth: 6 },
  { vaccineCode: 'OPA_1', title: 'OPA (Oral Polio 1. Doz)', dueMonth: 6 },
  { vaccineCode: 'KKK_1', title: 'KKK (Kızamık-Kızamıkçık-Kabakulak)', dueMonth: 12 },
  { vaccineCode: 'KPA_P', title: 'KPA (Pekiştirme)', dueMonth: 12 },
  { vaccineCode: 'SUCICEGI', title: 'Suçiçeği', dueMonth: 12 },
  { vaccineCode: 'DABT_P', title: '5’li Karma (Pekiştirme)', dueMonth: 18 },
  { vaccineCode: 'OPA_2', title: 'OPA (2. Doz)', dueMonth: 18 },
  { vaccineCode: 'HEPA_1', title: 'Hepatit A (1. Doz)', dueMonth: 18 },
  { vaccineCode: 'HEPA_2', title: 'Hepatit A (2. Doz)', dueMonth: 24 },
];

@Injectable()
export class PostpartumService {
  constructor(private readonly prisma: PrismaService) {}

  private getStartOfToday(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private async getPrimaryBaby(userId: string) {
    return this.prisma.babyProfile.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async requireBaby(userId: string) {
    const baby = await this.getPrimaryBaby(userId);
    if (!baby) {
      throw new NotFoundException('Önce bebek profili oluşturmalısınız.');
    }
    return baby;
  }

  async getLifeStage(userId: string): Promise<{ lifeStage: LifeStage }> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { lifeStage: true },
    });
    const raw = (profile?.lifeStage || 'CYCLE').toUpperCase() as LifeStage;
    return {
      lifeStage: VALID_LIFE_STAGES.includes(raw) ? raw : 'CYCLE',
    };
  }

  async updateLifeStage(userId: string, lifeStage: string) {
    const normalized = String(lifeStage || '').toUpperCase() as LifeStage;
    if (!VALID_LIFE_STAGES.includes(normalized)) {
      throw new BadRequestException('Geçersiz yaşam evresi.');
    }

    await this.prisma.profile.update({
      where: { userId },
      data: { lifeStage: normalized },
    });

    return { lifeStage: normalized };
  }

  async upsertBabyProfile(
    userId: string,
    dto: {
      name: string;
      birthDate: string;
      gender?: string;
      birthWeightGr?: number;
      birthHeightCm?: number;
      notes?: string;
    },
  ) {
    if (!dto.name?.trim()) {
      throw new BadRequestException('Bebek adı gereklidir.');
    }
    const birthDate = new Date(dto.birthDate);
    if (Number.isNaN(birthDate.getTime())) {
      throw new BadRequestException('Geçerli bir doğum tarihi giriniz.');
    }

    const existing = await this.getPrimaryBaby(userId);
    if (existing) {
      return this.prisma.babyProfile.update({
        where: { id: existing.id },
        data: {
          name: dto.name.trim(),
          birthDate,
          gender: dto.gender || existing.gender,
          birthWeightGr: dto.birthWeightGr ?? existing.birthWeightGr,
          birthHeightCm: dto.birthHeightCm ?? existing.birthHeightCm,
          notes: dto.notes ?? existing.notes,
        },
      });
    }

    const created = await this.prisma.babyProfile.create({
      data: {
        userId,
        name: dto.name.trim(),
        birthDate,
        gender: dto.gender || null,
        birthWeightGr: dto.birthWeightGr ?? null,
        birthHeightCm: dto.birthHeightCm ?? null,
        notes: dto.notes ?? null,
      },
    });

    // Seed default T.C. childhood vaccine schedule
    await this.prisma.babyVaccineRecord.createMany({
      data: DEFAULT_VACCINE_SCHEDULE.map((v) => ({
        babyId: created.id,
        vaccineCode: v.vaccineCode,
        title: v.title,
        dueMonth: v.dueMonth,
      })),
      skipDuplicates: true,
    });

    // Automatically switch lifeStage to POSTPARTUM when creating first baby profile
    await this.prisma.profile
      .update({
        where: { userId },
        data: { lifeStage: 'POSTPARTUM' },
      })
      .catch(() => {});

    return created;
  }

  async getOverview(userId: string) {
    const { lifeStage } = await this.getLifeStage(userId);
    const baby = await this.getPrimaryBaby(userId);
    if (!baby) {
      return {
        lifeStage,
        baby: null,
        todaySummary: {
          feedingsCount: 0,
          feedingMinutes: 0,
          formulaMl: 0,
          diapersCount: 0,
          sleepMinutes: 0,
        },
        feedings: [],
        diapers: [],
        sleeps: [],
        growthLogs: [],
        vaccines: [],
      };
    }

    const startOfToday = this.getStartOfToday();

    const [feedings, diapers, sleeps, growthLogs, vaccines] = await Promise.all([
      this.prisma.feedingLog.findMany({
        where: { babyId: baby.id },
        orderBy: { startedAt: 'desc' },
        take: 30,
      }),
      this.prisma.diaperLog.findMany({
        where: { babyId: baby.id },
        orderBy: { loggedAt: 'desc' },
        take: 30,
      }),
      this.prisma.babySleepLog.findMany({
        where: { babyId: baby.id },
        orderBy: { startedAt: 'desc' },
        take: 20,
      }),
      this.prisma.babyGrowthLog.findMany({
        where: { babyId: baby.id },
        orderBy: { measuredAt: 'desc' },
        take: 20,
      }),
      this.prisma.babyVaccineRecord.findMany({
        where: { babyId: baby.id },
        orderBy: [{ dueMonth: 'asc' }, { title: 'asc' }],
      }),
    ]);

    const todayFeedings = feedings.filter((f) => f.startedAt >= startOfToday);
    const todayDiapers = diapers.filter((d) => d.loggedAt >= startOfToday);
    const todaySleeps = sleeps.filter((s) => s.startedAt >= startOfToday);

    const feedingMinutes = Math.round(
      todayFeedings.reduce((sum, f) => sum + (f.durationSec || 0), 0) / 60,
    );
    const formulaMl = todayFeedings.reduce((sum, f) => sum + (f.amountMl || 0), 0);
    const sleepMinutes = todaySleeps.reduce((sum, s) => sum + s.durationMin, 0);

    return {
      lifeStage,
      baby,
      todaySummary: {
        feedingsCount: todayFeedings.length,
        feedingMinutes,
        formulaMl,
        diapersCount: todayDiapers.length,
        sleepMinutes,
      },
      feedings,
      diapers,
      sleeps,
      growthLogs,
      vaccines,
    };
  }

  async logFeeding(
    userId: string,
    dto: {
      type: string;
      durationSec?: number;
      amountMl?: number;
      startedAt?: string;
      notes?: string;
    },
  ) {
    const baby = await this.requireBaby(userId);
    const allowed = ['BREAST_LEFT', 'BREAST_RIGHT', 'PUMP', 'FORMULA'];
    if (!allowed.includes(dto.type)) {
      throw new BadRequestException('Geçersiz beslenme türü.');
    }

    return this.prisma.feedingLog.create({
      data: {
        babyId: baby.id,
        type: dto.type,
        durationSec: dto.durationSec ?? null,
        amountMl: dto.amountMl ?? null,
        startedAt: dto.startedAt ? new Date(dto.startedAt) : new Date(),
        notes: dto.notes ?? null,
      },
    });
  }

  async deleteFeeding(userId: string, id: string) {
    const baby = await this.requireBaby(userId);
    await this.prisma.feedingLog.deleteMany({
      where: { id, babyId: baby.id },
    });
    return { deleted: true };
  }

  async logDiaper(
    userId: string,
    dto: { type: string; loggedAt?: string; notes?: string },
  ) {
    const baby = await this.requireBaby(userId);
    if (!['WET', 'DIRTY', 'BOTH'].includes(dto.type)) {
      throw new BadRequestException('Geçersiz bez türü.');
    }

    return this.prisma.diaperLog.create({
      data: {
        babyId: baby.id,
        type: dto.type,
        loggedAt: dto.loggedAt ? new Date(dto.loggedAt) : new Date(),
        notes: dto.notes ?? null,
      },
    });
  }

  async deleteDiaper(userId: string, id: string) {
    const baby = await this.requireBaby(userId);
    await this.prisma.diaperLog.deleteMany({
      where: { id, babyId: baby.id },
    });
    return { deleted: true };
  }

  async logSleep(
    userId: string,
    dto: { startedAt?: string; endedAt?: string; durationMin: number; notes?: string },
  ) {
    const baby = await this.requireBaby(userId);
    const durationMin = Math.max(1, Math.round(Number(dto.durationMin) || 0));
    const endedAt = dto.endedAt ? new Date(dto.endedAt) : new Date();
    const startedAt = dto.startedAt
      ? new Date(dto.startedAt)
      : new Date(endedAt.getTime() - durationMin * 60 * 1000);

    return this.prisma.babySleepLog.create({
      data: {
        babyId: baby.id,
        startedAt,
        endedAt,
        durationMin,
        notes: dto.notes ?? null,
      },
    });
  }

  async deleteSleep(userId: string, id: string) {
    const baby = await this.requireBaby(userId);
    await this.prisma.babySleepLog.deleteMany({
      where: { id, babyId: baby.id },
    });
    return { deleted: true };
  }

  async logGrowth(
    userId: string,
    dto: {
      measuredAt?: string;
      weightKg?: number;
      heightCm?: number;
      headCm?: number;
      notes?: string;
    },
  ) {
    const baby = await this.requireBaby(userId);
    if (dto.weightKg == null && dto.heightCm == null && dto.headCm == null) {
      throw new BadRequestException('En az bir ölçüm değeri giriniz.');
    }

    return this.prisma.babyGrowthLog.create({
      data: {
        babyId: baby.id,
        measuredAt: dto.measuredAt ? new Date(dto.measuredAt) : new Date(),
        weightKg: dto.weightKg ?? null,
        heightCm: dto.heightCm ?? null,
        headCm: dto.headCm ?? null,
        notes: dto.notes ?? null,
      },
    });
  }

  async deleteGrowth(userId: string, id: string) {
    const baby = await this.requireBaby(userId);
    await this.prisma.babyGrowthLog.deleteMany({
      where: { id, babyId: baby.id },
    });
    return { deleted: true };
  }

  async toggleVaccine(
    userId: string,
    vaccineId: string,
    dto: { administered: boolean; administeredAt?: string; notes?: string },
  ) {
    const baby = await this.requireBaby(userId);
    const existing = await this.prisma.babyVaccineRecord.findFirst({
      where: { id: vaccineId, babyId: baby.id },
    });
    if (!existing) {
      throw new NotFoundException('Aşı kaydı bulunamadı.');
    }

    return this.prisma.babyVaccineRecord.update({
      where: { id: existing.id },
      data: {
        administeredAt: dto.administered
          ? dto.administeredAt
            ? new Date(dto.administeredAt)
            : new Date()
          : null,
        notes: dto.notes ?? existing.notes,
      },
    });
  }

  async getAdminAll(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (search?.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        {
          user: {
            OR: [
              { email: { contains: q, mode: 'insensitive' } },
              { username: { contains: q, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const [
      babies,
      total,
      postpartumUsersCount,
      totalFeedings,
      totalDiapers,
      totalSleeps,
      completedVaccines,
    ] = await Promise.all([
      this.prisma.babyProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              profile: { select: { lifeStage: true } },
            },
          },
          _count: {
            select: {
              feedingLogs: true,
              diaperLogs: true,
              sleepLogs: true,
              growthLogs: true,
              vaccineRecords: true,
            },
          },
          vaccineRecords: {
            where: { administeredAt: { not: null } },
            select: { id: true },
          },
        },
      }),
      this.prisma.babyProfile.count({ where }),
      this.prisma.profile.count({ where: { lifeStage: 'POSTPARTUM' } }),
      this.prisma.feedingLog.count(),
      this.prisma.diaperLog.count(),
      this.prisma.babySleepLog.count(),
      this.prisma.babyVaccineRecord.count({ where: { administeredAt: { not: null } } }),
    ]);

    return {
      data: babies.map((b) => ({
        ...b,
        completedVaccinesCount: b.vaccineRecords.length,
        vaccineRecords: undefined,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      stats: {
        totalBabies: total,
        postpartumUsersCount,
        totalFeedings,
        totalDiapers,
        totalSleeps,
        completedVaccines,
      },
    };
  }
}
