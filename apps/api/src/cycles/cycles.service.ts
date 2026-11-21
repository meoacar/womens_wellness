import {
  Injectable,
  Inject,
  forwardRef,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PredictionService } from './prediction.service';
import { GamificationService } from '../gamification/gamification.service';
import { AchievementService } from '../gamification/achievement.service';
import { InsightService } from '../gamification/insight.service';

interface PeriodSymptoms {
  flow: 'light' | 'moderate' | 'heavy';
  cramps: 0 | 1 | 2 | 3 | 4 | 5;
  mood: string[];
  physical: string[];
  notes?: string;
}

interface DailyLogInput {
  date: string;
  flow?: 'light' | 'moderate' | 'heavy';
  cramps?: number;
  symptoms?: string[];
  mood?: string[];
  hadSex?: boolean;
  contraception?: string[];
  sexNotes?: string;
  medications?: string[];
  healthNotes?: string;
  attachments?: string[];
}

@Injectable()
export class CyclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly predictionService: PredictionService,
    @Inject(forwardRef(() => GamificationService))
    private readonly gamificationService: GamificationService,
    @Inject(forwardRef(() => AchievementService))
    private readonly achievementService: AchievementService,
    @Inject(forwardRef(() => InsightService))
    private readonly insightService: InsightService,
  ) { }

  /**
   * Parse YYYY-MM-DD or ISO date string to local/server midnight without day drift
   */
  private parseCalendarDate(value: string): Date {
    const trimmed = (value || '').trim();
    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (dateOnlyMatch) {
      const [, y, m, d] = dateOnlyMatch;
      return new Date(Number(y), Number(m) - 1, Number(d), 0, 0, 0, 0);
    }
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Geçersiz tarih formatı.');
    }
    parsed.setHours(0, 0, 0, 0);
    return parsed;
  }

  private toDateKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /**
   * Create a new period cycle
   */
  async createCycle(
    userId: string,
    data: {
      startDate: string;
      endDate?: string;
      symptoms?: PeriodSymptoms;
      notes?: string;
    },
  ) {
    const startDate = this.parseCalendarDate(data.startDate);
    const endDate = data.endDate ? this.parseCalendarDate(data.endDate) : null;

    if (endDate && endDate < startDate) {
      throw new BadRequestException('Bitiş tarihi başlangıç tarihinden önce olamaz.');
    }

    // Avoid duplicate cycles starting on the same calendar day
    const dayEnd = new Date(startDate);
    dayEnd.setHours(23, 59, 59, 999);
    const existingSameDay = await this.prisma.periodCycle.findFirst?.({
      where: {
        userId,
        startDate: { gte: startDate, lte: dayEnd },
      },
    });

    if (existingSameDay) {
      if (endDate || data.notes !== undefined || data.symptoms) {
        return this.prisma.periodCycle.update({
          where: { id: existingSameDay.id },
          data: {
            ...(endDate ? { endDate } : {}),
            ...(data.symptoms ? { symptomsJson: data.symptoms as any } : {}),
            ...(data.notes !== undefined ? { notes: data.notes } : {}),
          },
        });
      }
      return existingSameDay;
    }

    return this.prisma.periodCycle.create({
      data: {
        userId,
        startDate,
        endDate,
        symptomsJson: (data.symptoms || {}) as any,
        notes: data.notes,
      },
    });
  }

  /**
   * Update existing cycle
   */
  async updateCycle(
    userId: string,
    cycleId: string,
    data: {
      startDate?: string;
      endDate?: string | null;
      symptoms?: PeriodSymptoms;
      notes?: string;
    },
  ) {
    const existing = await this.prisma.periodCycle.findUnique({
      where: { id: cycleId },
    });

    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('Regl kaydı bulunamadı.');
    }

    const nextStart = data.startDate
      ? this.parseCalendarDate(data.startDate)
      : this.parseCalendarDate(this.toDateKey(new Date(existing.startDate)));
    const nextEnd =
      data.endDate === null
        ? null
        : data.endDate !== undefined
          ? this.parseCalendarDate(data.endDate)
          : existing.endDate
            ? this.parseCalendarDate(this.toDateKey(new Date(existing.endDate)))
            : null;

    if (nextEnd && nextEnd < nextStart) {
      throw new BadRequestException('Bitiş tarihi başlangıç tarihinden önce olamaz.');
    }

    return this.prisma.periodCycle.update({
      where: {
        id: cycleId,
        userId,
      },
      data: {
        ...(data.startDate ? { startDate: nextStart } : {}),
        ...(data.endDate !== undefined ? { endDate: nextEnd } : {}),
        ...(data.symptoms && { symptomsJson: data.symptoms as any }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
    });
  }

  /**
   * Get user's cycle history
   */
  async getCycles(userId: string, limit = 12, isAdmin = false) {
    return this.prisma.periodCycle.findMany({
      where: isAdmin ? {} : { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
          },
        },
      },
      orderBy: { startDate: 'desc' },
      take: limit,
    });
  }

  /**
   * Get specific cycle
   */
  async getCycle(userId: string, cycleId: string, isAdmin = false) {
    return this.prisma.periodCycle.findFirst({
      where: isAdmin ? { id: cycleId } : { id: cycleId, userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
          },
        },
      },
    });
  }

  /**
   * Delete cycle
   */
  async deleteCycle(userId: string, cycleId: string) {
    return this.prisma.periodCycle.delete({
      where: {
        id: cycleId,
        userId,
      },
    });
  }

  /**
   * Delete all cycles for a user (reset calendar)
   */
  async deleteAllCycles(userId: string) {
    const result = await this.prisma.periodCycle.deleteMany({
      where: { userId },
    });
    console.log(`🗑️ Deleted ${result.count} cycles for user ${userId}`);
    return { deleted: result.count, message: 'Tüm regl kayıtları silindi' };
  }

  /**
   * Get prediction for next period
   */
  async getPrediction(userId: string) {
    const cycles = await this.getCycles(userId, 6);

    if (cycles.length === 0) {
      return {
        prediction: null,
        message: 'Tahmin için en az 1 regl kaydı gerekli',
      };
    }

    const prediction = this.predictionService.predict(
      cycles.map((c) => ({
        startDate: c.startDate.toISOString(),
        endDate: c.endDate?.toISOString(),
      }))
    );

    return {
      prediction,
      cyclesUsed: cycles.length,
      message:
        cycles.length < 3
          ? 'Daha kesin tahmin için daha fazla veri gerekli'
          : null,
    };
  }

  /**
   * Get cycle calendar data for a month
   */
  async getCalendarMonth(userId: string, year: number, month: number) {
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0);

    // Get cycles that overlap with this month
    const cycles = await this.prisma.periodCycle.findMany({
      where: {
        userId,
        OR: [
          {
            startDate: {
              gte: startOfMonth,
              lte: endOfMonth,
            },
          },
          {
            AND: [
              { startDate: { lte: endOfMonth } },
              {
                OR: [
                  { endDate: { gte: startOfMonth } },
                  { endDate: null }, // Ongoing cycle
                ],
              },
            ],
          },
        ],
      },
      orderBy: { startDate: 'desc' },
    });

    // Get daily logs for this month
    const dailyLogs = await this.prisma.dailyLog.findMany({
      where: {
        userId,
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
    });

    // Create a map for quick lookup
    const dailyLogMap = new Map(
      dailyLogs.map((log) => [log.date.toISOString().split('T')[0], log])
    );

    // Debug: log cycles for this month
    console.log(`📊 Cycles for ${year}-${month}:`, cycles.map(c => ({
      start: c.startDate.toISOString().split('T')[0],
      end: c.endDate ? c.endDate.toISOString().split('T')[0] : 'no end',
    })));

    // Get prediction
    const { prediction } = await this.getPrediction(userId);

    // Debug: log prediction details
    if (prediction) {
      console.log('📅 Calendar Prediction Debug:', {
        nextStart: prediction.nextStart.toISOString().split('T')[0],
        fertileWindow: {
          start: prediction.fertile.start.toISOString().split('T')[0],
          end: prediction.fertile.end.toISOString().split('T')[0],
        },
        avgCycleLength: prediction.averageCycleLength,
        confidence: prediction.confidence,
      });
    }

    // Compute personal average period length from up to 6 completed cycles (fallback: 5 days)
    const completedCycles = await this.prisma.periodCycle.findMany({
      where: { userId, endDate: { not: null } },
      orderBy: { startDate: 'desc' },
      take: 6,
      select: { startDate: true, endDate: true },
    });
    const completedLengths = completedCycles
      .map((c) => {
        const s = new Date(c.startDate);
        const e = new Date(c.endDate!);
        s.setHours(0, 0, 0, 0);
        e.setHours(0, 0, 0, 0);
        return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      })
      .filter((len) => len >= 1 && len <= 12);
    const assumedPeriodLength =
      completedLengths.length > 0
        ? Math.min(
            10,
            Math.max(
              2,
              Math.round(
                completedLengths.reduce((acc, len) => acc + len, 0) /
                  completedLengths.length,
              ),
            ),
          )
        : 5;

    // Build calendar data
    const days: Array<{
      date: Date;
      isPeriod: boolean;
      isFertile: boolean;
      isPredicted: boolean;
      isOvulation: boolean;
      cycleDay?: number;
      cycleId?: string;
      cycleStartDate?: string;
      cycleEndDate?: string | null;
      isCycleStart?: boolean;
      isCycleEnd?: boolean;
      markers: string[];
      dailyLog?: any;
    }> = [];

    for (let day = 1; day <= endOfMonth.getDate(); day++) {
      const date = new Date(year, month - 1, day);
      const dateKey = date.toISOString().split('T')[0];
      let isPeriod = false;
      let cycleDay: number | undefined;
      let cycleId: string | undefined;
      let cycleStartDate: string | undefined;
      let cycleEndDate: string | null | undefined;
      let isCycleStart = false;
      let isCycleEnd = false;
      const markers: string[] = [];

      // Check if this day is within any cycle's period days
      for (const cycle of cycles) {
        const start = new Date(cycle.startDate);
        start.setHours(0, 0, 0, 0);

        let end: Date;
        if (cycle.endDate) {
          end = new Date(cycle.endDate);
          end.setHours(0, 0, 0, 0);
        } else {
          // If no end date yet, use personal average period length (default: 5 days)
          end = new Date(start);
          end.setDate(end.getDate() + assumedPeriodLength - 1);
        }

        const dateNormalized = new Date(date);
        dateNormalized.setHours(0, 0, 0, 0);

        if (dateNormalized >= start && dateNormalized <= end) {
          isPeriod = true;
          cycleId = cycle.id;
          cycleStartDate = this.toDateKey(start);
          cycleEndDate = cycle.endDate ? this.toDateKey(end) : null;
          isCycleStart = dateNormalized.getTime() === start.getTime();
          isCycleEnd = Boolean(cycle.endDate) && dateNormalized.getTime() === end.getTime();
          markers.push('period');
          cycleDay = this.predictionService.getCycleDay(dateNormalized, start);
          break;
        }
      }

      // Check fertile window (should NOT overlap with period days)
      let isFertile = false;
      if (prediction && !isPeriod) {
        isFertile = this.predictionService.isFertileDay(date, prediction);
        if (isFertile) {
          markers.push('fertile');
          console.log(`  🌸 Day ${day}: FERTILE`);
        }
      }

      // Check if ovulation day
      let isOvulation = false;
      if (prediction && !isPeriod) {
        isOvulation = this.isSameDay(date, prediction.ovulation);
        if (isOvulation) {
          markers.push('ovulation');
          console.log(`  ⭐ Day ${day}: OVULATION`);
        }
      }

      // Check if predicted period start (should NOT overlap with current period)
      let isPredicted = false;
      if (prediction && !isPeriod) {
        isPredicted = this.isSameDay(date, prediction.nextStart);
        if (isPredicted) {
          console.log(`  📅 Day ${day}: PREDICTED START`);
        }
      }

      // Get daily log if exists
      const dailyLog = dailyLogMap.get(dateKey);
      if (dailyLog) {
        if (dailyLog.hadSex) markers.push('sex');
        if (dailyLog.symptoms && dailyLog.symptoms.length > 0) markers.push('symptom');
        if (dailyLog.mood && dailyLog.mood.length > 0) markers.push('mood');
        if (dailyLog.medications && dailyLog.medications.length > 0) markers.push('medication');
        console.log(`  🎭 Day ${day}: Has daily log with mood=${dailyLog.mood?.join(', ')}`);
      }

      days.push({
        date,
        isPeriod,
        isFertile,
        isPredicted,
        isOvulation,
        cycleDay,
        ...(cycleId ? { cycleId, cycleStartDate, cycleEndDate, isCycleStart, isCycleEnd } : {}),
        markers,
        dailyLog: dailyLog || undefined,
      });
    }

    return {
      year,
      month,
      days,
      cycles,
      prediction,
      assumedPeriodLength,
    };
  }

  /**
   * Helper to check if two dates are the same day (ignoring time)
   */
  private isSameDay(date1: Date, date2: Date): boolean {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }

  /**
   * Get cycle statistics
   */
  async getStats(userId: string) {
    const cycles = await this.getCycles(userId, 12);

    if (cycles.length === 0) {
      return {
        totalCycles: 0,
        averageCycleLength: null,
        averagePeriodLength: null,
        cycleVariance: null,
      };
    }

    // Calculate average cycle length
    const cycleLengths: number[] = [];
    for (let i = 0; i < cycles.length - 1; i++) {
      const current = cycles[i].startDate;
      const next = cycles[i + 1].startDate;
      const length = Math.round(
        (current.getTime() - next.getTime()) / (1000 * 60 * 60 * 24)
      );
      cycleLengths.push(length);
    }

    const avgCycleLength =
      cycleLengths.length > 0
        ? Math.round(
          cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length
        )
        : null;

    // Calculate cycle variance (standard deviation)
    let cycleVariance: number | null = null;
    if (cycleLengths.length > 1 && avgCycleLength !== null) {
      const squaredDiffs = cycleLengths.map((len) =>
        Math.pow(len - avgCycleLength, 2)
      );
      const variance = squaredDiffs.reduce((a, b) => a + b, 0) / cycleLengths.length;
      cycleVariance = Math.round(Math.sqrt(variance) * 10) / 10; // Round to 1 decimal
    }

    // Calculate average period length
    const periodLengths = cycles
      .filter((c) => c.endDate)
      .map((c) => {
        const start = c.startDate.getTime();
        const end = c.endDate!.getTime();
        return Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
      });

    const avgPeriodLength =
      periodLengths.length > 0
        ? Math.round(
          periodLengths.reduce((a, b) => a + b, 0) / periodLengths.length
        )
        : null;

    return {
      totalCycles: cycles.length,
      averageCycleLength: avgCycleLength,
      averagePeriodLength: avgPeriodLength,
      cycleVariance,
      cycleLengths,
      periodLengths,
      last3Cycles: cycleLengths.slice(0, 3),
    };
  }

  /**
   * Create or update daily log for a specific date
   */
  async upsertDailyLog(userId: string, data: DailyLogInput) {
    // Parse date string correctly to avoid timezone issues
    // If data.date is "2025-10-09", we want exactly that date in local timezone
    const dateParts = data.date.split('-').map(Number);
    const date = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], 0, 0, 0, 0);

    // Find if date falls within any cycle
    const cycle = await this.prisma.periodCycle.findFirst({
      where: {
        userId,
        startDate: { lte: date },
        OR: [
          { endDate: { gte: date } },
          { endDate: null },
        ],
      },
    });

    const dailyLog = await this.prisma.dailyLog.upsert({
      where: {
        userId_date: {
          userId,
          date,
        },
      },
      update: {
        flow: data.flow,
        cramps: data.cramps,
        symptoms: data.symptoms || [],
        mood: data.mood || [],
        hadSex: data.hadSex ?? false,
        contraception: data.contraception || [],
        sexNotes: data.sexNotes,
        medications: data.medications || [],
        healthNotes: data.healthNotes,
        attachments: data.attachments || [],
      },
      create: {
        userId,
        cycleId: cycle?.id,
        date,
        flow: data.flow,
        cramps: data.cramps,
        symptoms: data.symptoms || [],
        mood: data.mood || [],
        hadSex: data.hadSex ?? false,
        contraception: data.contraception || [],
        sexNotes: data.sexNotes,
        medications: data.medications || [],
        healthNotes: data.healthNotes,
        attachments: data.attachments || [],
      },
    });

    // Update gamification stats
    try {
      await this.gamificationService.incrementDataEntry(userId);

      // Update symptom count if symptoms were logged
      if (data.symptoms && data.symptoms.length > 0) {
        await this.prisma.userGamification.update({
          where: { userId },
          data: {
            totalSymptoms: { increment: data.symptoms.length },
          },
        });
      }

      // Check for new achievements
      await this.achievementService.checkAchievements(userId);

      // Generate insights (async, don't wait)
      this.insightService.generateInsights(userId).catch(err => {
        console.error('Error generating insights:', err);
      });
    } catch (error) {
      console.error('Error updating gamification:', error);
      // Don't fail the daily log creation if gamification fails
    }

    return dailyLog;
  }

  /**
   * Get daily log for a specific date
   */
  async getDailyLog(userId: string, date: string) {
    const dateObj = new Date(date);
    dateObj.setHours(0, 0, 0, 0);

    return this.prisma.dailyLog.findUnique({
      where: {
        userId_date: {
          userId,
          date: dateObj,
        },
      },
    });
  }

  /**
   * Get daily logs for a date range
   */
  async getDailyLogs(userId: string, startDate: string, endDate: string) {
    return this.prisma.dailyLog.findMany({
      where: {
        userId,
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      orderBy: { date: 'asc' },
    });
  }

  /**
   * Delete daily log
   */
  async deleteDailyLog(userId: string, date: string) {
    const dateObj = new Date(date);
    dateObj.setHours(0, 0, 0, 0);

    return this.prisma.dailyLog.delete({
      where: {
        userId_date: {
          userId,
          date: dateObj,
        },
      },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Admin Endpoints
  // ─────────────────────────────────────────────────────────────

  async getAdminCycles(options: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 10));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (options.status === 'ongoing') {
      where.endDate = null;
    } else if (options.status === 'completed') {
      where.endDate = { not: null };
    }

    if (options.search?.trim()) {
      const q = options.search.trim();
      where.user = {
        OR: [
          { email: { contains: q, mode: 'insensitive' } },
          { username: { contains: q, mode: 'insensitive' } },
        ],
      };
    }

    const [cycles, total, allCompleted, ongoingCount, totalDailyLogs] = await Promise.all([
      this.prisma.periodCycle.findMany({
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
        orderBy: { startDate: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.periodCycle.count({ where }),
      this.prisma.periodCycle.findMany({
        where: { endDate: { not: null } },
        select: { startDate: true, endDate: true },
      }),
      this.prisma.periodCycle.count({ where: { endDate: null } }),
      this.prisma.dailyLog.count(),
    ]);

    const avgDurationDays =
      allCompleted.length > 0
        ? Math.round(
            (allCompleted.reduce((sum, c) => {
              const diff =
                Math.floor(
                  (new Date(c.endDate!).getTime() - new Date(c.startDate).getTime()) /
                    (1000 * 60 * 60 * 24),
                ) + 1;
              return sum + Math.max(1, diff);
            }, 0) /
              allCompleted.length) *
              10,
          ) / 10
        : 0;

    return {
      data: cycles,
      total,
      page,
      limit,
      stats: {
        totalCycles: allCompleted.length + ongoingCount,
        ongoingCycles: ongoingCount,
        completedCycles: allCompleted.length,
        avgDurationDays,
        totalDailyLogs,
      },
    };
  }

  async getAdminCycleById(cycleId: string) {
    const cycle = await this.prisma.periodCycle.findUnique({
      where: { id: cycleId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
          },
        },
      },
    });

    if (!cycle) {
      return null;
    }

    const rangeStart = new Date(cycle.startDate);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = cycle.endDate
      ? new Date(cycle.endDate)
      : new Date(rangeStart.getTime() + 14 * 24 * 60 * 60 * 1000);
    rangeEnd.setHours(23, 59, 59, 999);

    const dailyLogs = await this.prisma.dailyLog.findMany({
      where: {
        userId: cycle.userId,
        date: {
          gte: rangeStart,
          lte: rangeEnd,
        },
      },
      orderBy: { date: 'desc' },
    });

    return {
      ...cycle,
      dailyLogs,
    };
  }

  /**
   * Analyze cycle, symptom, sleep and hydration correlations for actionable insights
   */
  async getPatternInsights(userId: string) {
    const lookback90 = new Date();
    lookback90.setDate(lookback90.getDate() - 90);

    const [cycles, dailyLogs, sleepLogs, waterLogs] = await Promise.all([
      this.prisma.periodCycle.findMany({
        where: { userId },
        orderBy: { startDate: 'desc' },
        take: 7,
      }),
      this.prisma.dailyLog.findMany({
        where: { userId, date: { gte: lookback90 } },
        orderBy: { date: 'desc' },
      }),
      this.prisma.sleepLog.findMany({
        where: { userId, sleepDate: { gte: lookback90 } },
        orderBy: { sleepDate: 'desc' },
      }),
      this.prisma.waterLog.findMany({
        where: { userId, loggedAt: { gte: lookback90 } },
      }),
    ]);

    // 1. Cycle history (newest -> oldest -> chart expects chronological order)
    const cycleHistory: Array<{
      startDate: string;
      cycleLength: number;
      periodLength: number | null;
    }> = [];

    for (let i = 0; i < cycles.length - 1; i++) {
      const currStart = new Date(cycles[i].startDate);
      const prevStart = new Date(cycles[i + 1].startDate);
      const cycleLength = Math.round(
        (currStart.getTime() - prevStart.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (cycleLength >= 15 && cycleLength <= 60) {
        const prevEnd = cycles[i + 1].endDate ? new Date(cycles[i + 1].endDate!) : null;
        const periodLength = prevEnd
          ? Math.max(
              1,
              Math.round((prevEnd.getTime() - prevStart.getTime()) / (1000 * 60 * 60 * 24)) + 1,
            )
          : null;
        cycleHistory.push({
          startDate: prevStart.toISOString().slice(0, 10),
          cycleLength,
          periodLength,
        });
      }
    }
    cycleHistory.reverse();

    // 2. Pre-period symptoms (1-5 days before period start)
    const prePeriodCounts = new Map<string, number>();
    const allSymptomCounts = new Map<string, number>();
    const moodCounts = new Map<string, number>();

    for (const log of dailyLogs) {
      const logDate = new Date(log.date);
      logDate.setHours(0, 0, 0, 0);

      const isPrePeriod = cycles.some((c) => {
        const start = new Date(c.startDate);
        start.setHours(0, 0, 0, 0);
        const diffDays = Math.round((start.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays >= 1 && diffDays <= 5;
      });

      const symptoms = Array.isArray(log.symptoms) ? (log.symptoms as string[]) : [];
      const moods = Array.isArray(log.mood) ? (log.mood as string[]) : [];

      for (const s of symptoms) {
        allSymptomCounts.set(s, (allSymptomCounts.get(s) || 0) + 1);
        if (isPrePeriod) {
          prePeriodCounts.set(s, (prePeriodCounts.get(s) || 0) + 1);
        }
      }
      for (const m of moods) {
        moodCounts.set(m, (moodCounts.get(m) || 0) + 1);
      }
    }

    const topPrePeriodSymptoms = Array.from(prePeriodCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }));

    const topSymptoms = Array.from(allSymptomCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name, count]) => ({ name, count }));

    const topMoods = Array.from(moodCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }));

    // 3. Sleep vs Cramp correlation
    const sleepByDate = new Map<string, number>();
    for (const s of sleepLogs) {
      const key = new Date(s.sleepDate).toISOString().slice(0, 10);
      sleepByDate.set(key, s.durationMin);
    }

    const crampsGoodSleep: number[] = [];
    const crampsLowSleep: number[] = [];
    for (const log of dailyLogs) {
      if (typeof log.cramps !== 'number' || log.cramps <= 0) continue;
      const key = new Date(log.date).toISOString().slice(0, 10);
      const sleepMin = sleepByDate.get(key);
      if (sleepMin === undefined) continue;
      if (sleepMin >= 420) crampsGoodSleep.push(log.cramps);
      else crampsLowSleep.push(log.cramps);
    }

    const avgGoodSleepCramps =
      crampsGoodSleep.length > 0
        ? Number((crampsGoodSleep.reduce((a, b) => a + b, 0) / crampsGoodSleep.length).toFixed(1))
        : null;
    const avgLowSleepCramps =
      crampsLowSleep.length > 0
        ? Number((crampsLowSleep.reduce((a, b) => a + b, 0) / crampsLowSleep.length).toFixed(1))
        : null;

    // 4. Water daily average & insight
    const waterByDate = new Map<string, number>();
    for (const w of waterLogs) {
      const key = new Date(w.loggedAt).toISOString().slice(0, 10);
      waterByDate.set(key, (waterByDate.get(key) || 0) + w.amountMl);
    }
    const avgWaterMl =
      waterByDate.size > 0
        ? Math.round(
            Array.from(waterByDate.values()).reduce((a, b) => a + b, 0) / waterByDate.size,
          )
        : 0;

    // Build human-readable summary insights
    const insights: Array<{
      id: string;
      icon: string;
      title: string;
      description: string;
      tone: 'pink' | 'purple' | 'teal' | 'amber';
    }> = [];

    if (topPrePeriodSymptoms.length > 0) {
      const names = topPrePeriodSymptoms.map((s) => s.name).join(', ');
      insights.push({
        id: 'pre_period_pattern',
        icon: 'sparkles',
        title: 'PMS Örüntüsü Yakalandı',
        description: `Regl başlamadan 1-5 gün önce en sık şu belirtileri kaydediyorsun: ${names}.`,
        tone: 'purple',
      });
    }

    if (avgGoodSleepCramps !== null && avgLowSleepCramps !== null) {
      if (avgGoodSleepCramps < avgLowSleepCramps) {
        const diffPct = Math.round(((avgLowSleepCramps - avgGoodSleepCramps) / avgLowSleepCramps) * 100);
        insights.push({
          id: 'sleep_cramp_correlation',
          icon: 'moon',
          title: 'Uyku & Kramp İlişkisi',
          description: `7+ saat uyuduğun günlerde kramp şiddetin %${Math.max(5, diffPct)} daha düşük (${avgGoodSleepCramps}/5 vs ${avgLowSleepCramps}/5).`,
          tone: 'teal',
        });
      }
    }

    if (cycleHistory.length >= 2) {
      const lengths = cycleHistory.map((c) => c.cycleLength);
      const minLen = Math.min(...lengths);
      const maxLen = Math.max(...lengths);
      const spread = maxLen - minLen;
      insights.push({
        id: 'cycle_regularity',
        icon: 'pulse',
        title: spread <= 3 ? 'Döngü Rimin Çok İstikrarlı' : 'Döngü Değişkenliği Gözlemi',
        description: `Son ${cycleHistory.length} döngün ${minLen}-${maxLen} gün aralığında gerçekleşti (${spread <= 3 ? 'düzenli ritim' : `${spread} günlük sapma`}).`,
        tone: 'pink',
      });
    }

    if (avgWaterMl > 0) {
      insights.push({
        id: 'hydration_summary',
        icon: 'water',
        title: 'Hidrasyon Ortalaman',
        description:
          avgWaterMl >= 1800
            ? `Son dönem günlük ortalama ${avgWaterMl} ml su içiyorsun — krampları azaltmak için harika!`
            : `Günlük ortalama ${avgWaterMl} ml su içiyorsun. 2000 ml hedefi şişkinliği azaltmaya yardımcı olur.`,
        tone: 'amber',
      });
    }

    if (insights.length === 0) {
      insights.push({
        id: 'keep_logging',
        icon: 'analytics',
        title: 'Kişisel Örüntülerin Oluşuyor',
        description:
          'Birkaç gün daha semptom, uyku ve su verisi girdiğinde sana özel PMS ve kramp korelasyonların burada belirecek.',
        tone: 'purple',
      });
    }

    // Build upcoming 3 cycles projection for long-term planning (Premium)
    const avgCycleLen =
      cycleHistory.length > 0
        ? Math.round(
            cycleHistory.reduce((acc, c) => acc + c.cycleLength, 0) / cycleHistory.length,
          )
        : 28;
    const completedPeriods = cycleHistory.filter((c) => typeof c.periodLength === 'number');
    const avgPeriodLen =
      completedPeriods.length > 0
        ? Math.round(
            completedPeriods.reduce((acc, c) => acc + (c.periodLength || 5), 0) /
              completedPeriods.length,
          )
        : 5;

    const upcoming3Cycles: Array<{
      cycleNumber: number;
      startDate: string;
      endDate: string;
      ovulationDate: string;
      fertileStart: string;
      fertileEnd: string;
    }> = [];

    if (cycles.length > 0) {
      const latestStart = new Date(cycles[0].startDate);
      const todayMidnight = new Date();
      todayMidnight.setHours(0, 0, 0, 0);

      const cursorStart = new Date(latestStart);
      cursorStart.setHours(0, 0, 0, 0);
      while (cursorStart.getTime() <= todayMidnight.getTime()) {
        cursorStart.setDate(cursorStart.getDate() + avgCycleLen);
      }

      for (let idx = 0; idx < 3; idx++) {
        const start = new Date(cursorStart);
        start.setDate(cursorStart.getDate() + idx * avgCycleLen);
        const end = new Date(start);
        end.setDate(start.getDate() + avgPeriodLen - 1);

        const nextStart = new Date(start);
        nextStart.setDate(start.getDate() + avgCycleLen);
        const ovulation = new Date(nextStart);
        ovulation.setDate(nextStart.getDate() - 14);
        const fertileStart = new Date(ovulation);
        fertileStart.setDate(ovulation.getDate() - 5);
        const fertileEnd = new Date(ovulation);
        fertileEnd.setDate(ovulation.getDate() + 1);

        upcoming3Cycles.push({
          cycleNumber: idx + 1,
          startDate: start.toISOString().slice(0, 10),
          endDate: end.toISOString().slice(0, 10),
          ovulationDate: ovulation.toISOString().slice(0, 10),
          fertileStart: fertileStart.toISOString().slice(0, 10),
          fertileEnd: fertileEnd.toISOString().slice(0, 10),
        });
      }
    }

    return {
      totalLogsAnalyzed: dailyLogs.length,
      cycleHistory,
      upcoming3Cycles,
      topPrePeriodSymptoms,
      topSymptoms,
      topMoods,
      sleepCrampCorrelation: {
        avgGoodSleepCramps,
        avgLowSleepCramps,
        sampleCount: crampsGoodSleep.length + crampsLowSleep.length,
      },
      avgWaterMl,
      insights,
    };
  }
}
