import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GamificationService } from '../gamification/gamification.service';

export interface StepsData {
  date: string; // ISO date string
  count: number;
  source?: string;
  isManual?: boolean;
}

export interface MeditationData {
  date: string;
  durationMin: number;
  type?: 'breath' | 'guided' | 'custom';
  source?: string;
  isManual?: boolean;
}

export interface SleepData {
  sleepDate: string;
  durationMin: number;
  quality?: 'good' | 'medium' | 'poor';
  source?: string;
  isManual?: boolean;
  notes?: string;
}

export interface WellnessSummary {
  steps: {
    today: number;
    goal: number;
    percentage: number;
    source: string;
  } | null;
  meditation: {
    todayMin: number;
    goalMin: number;
    percentage: number;
    sessions: number;
  } | null;
  sleep: {
    lastNightMin: number;
    goalHours: number;
    percentage: number;
    quality?: string;
  } | null;
}

@Injectable()
export class WellnessService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => GamificationService))
    private gamificationService: GamificationService,
  ) { }

  /**
   * Normalize a date (YYYY-MM-DD or Date/ISO) to midnight UTC for its calendar date.
   * For YYYY-MM-DD strings, uses that exact calendar date without timezone shift.
   * For Date/ISO timestamps, uses the server's local timezone (TZ=Europe/Istanbul).
   */
  private normalizeToMidnight(date: Date | string): Date {
    if (typeof date === 'string') {
      const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
      if (dateOnly) {
        return new Date(
          Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 0, 0, 0, 0),
        );
      }
    }
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0));
  }

  /**
   * Get today's date at midnight in UTC
   */
  private getToday(): Date {
    return this.normalizeToMidnight(new Date());
  }

  // ────────────────────────────────────────────────────────────────────────
  // Steps Management
  // ────────────────────────────────────────────────────────────────────────

  async getSteps(userId: string, from?: Date, to?: Date) {
    const where: any = { userId };

    if (from || to) {
      where.date = {};
      if (from) where.date.gte = from;
      if (to) where.date.lte = to;
    }

    return this.prisma.dailySteps.findMany({
      where,
      orderBy: { date: 'desc' },
    });
  }

  async getTodaySteps(userId: string) {
    const today = this.getToday();

    const record = await this.prisma.dailySteps.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
    });

    return record || { count: 0, source: 'manual', isManual: true };
  }

  async logSteps(userId: string, data: StepsData) {
    const date = this.normalizeToMidnight(data.date);

    // Check if this is a new entry
    const existing = await this.prisma.dailySteps.findUnique({
      where: {
        userId_date: {
          userId,
          date,
        },
      },
    });

    // Upsert to handle duplicates
    const result = await this.prisma.dailySteps.upsert({
      where: {
        userId_date: {
          userId,
          date,
        },
      },
      update: {
        count: data.count,
        source: data.source || 'manual',
        isManual: data.isManual ?? true,
        syncedAt: new Date(),
      },
      create: {
        userId,
        date,
        count: data.count,
        source: data.source || 'manual',
        isManual: data.isManual ?? true,
      },
    });

    // Update gamification XP, streak, and wellness log count if new entry
    if (!existing) {
      try {
        await this.gamificationService.incrementDataEntry(userId, { wellness: true });
      } catch (error) {
        console.error('Error updating wellness log count:', error);
      }
    }

    return result;
  }

  async deleteSteps(userId: string, date: string) {
    const dateObj = this.normalizeToMidnight(date);

    const record = await this.prisma.dailySteps.findUnique({
      where: {
        userId_date: {
          userId,
          date: dateObj,
        },
      },
    });

    if (!record) {
      throw new NotFoundException('Steps record not found');
    }

    return this.prisma.dailySteps.delete({
      where: { id: record.id },
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // Meditation Management
  // ────────────────────────────────────────────────────────────────────────

  async getMeditation(userId: string, from?: Date, to?: Date) {
    const where: any = { userId };

    if (from || to) {
      where.date = {};
      if (from) where.date.gte = from;
      if (to) where.date.lte = to;
    }

    return this.prisma.meditationSession.findMany({
      where,
      orderBy: { date: 'desc' },
    });
  }

  async getTodayMeditation(userId: string) {
    const today = this.getToday();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const sessions = await this.prisma.meditationSession.findMany({
      where: {
        userId,
        date: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    const totalMin = sessions.reduce((sum, s) => sum + s.durationMin, 0);

    return {
      sessions: sessions.length,
      totalMin,
      records: sessions,
    };
  }

  async logMeditation(userId: string, data: MeditationData) {
    const date = this.normalizeToMidnight(data.date);

    const result = await this.prisma.meditationSession.create({
      data: {
        userId,
        date,
        durationMin: data.durationMin,
        type: data.type || 'breath',
        source: data.source || 'manual',
        isManual: data.isManual ?? true,
      },
    });

    // Update gamification XP, streak, and wellness log count
    try {
      await this.gamificationService.incrementDataEntry(userId, { wellness: true });
    } catch (error) {
      console.error('Error updating wellness log count:', error);
    }

    return result;
  }

  async deleteMeditation(userId: string, sessionId: string) {
    const session = await this.prisma.meditationSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      throw new NotFoundException('Meditation session not found');
    }

    return this.prisma.meditationSession.delete({
      where: { id: sessionId },
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // Sleep Management
  // ────────────────────────────────────────────────────────────────────────

  async getSleep(userId: string, from?: Date, to?: Date) {
    const where: any = { userId };

    if (from || to) {
      where.sleepDate = {};
      if (from) where.sleepDate.gte = from;
      if (to) where.sleepDate.lte = to;
    }

    return this.prisma.sleepLog.findMany({
      where,
      orderBy: { sleepDate: 'desc' },
    });
  }

  async getLastNightSleep(userId: string) {
    const today = this.getToday();

    // Get last night's sleep (yesterday's date)
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const record = await this.prisma.sleepLog.findUnique({
      where: {
        userId_sleepDate: {
          userId,
          sleepDate: yesterday,
        },
      },
    });

    return record;
  }

  async logSleep(userId: string, data: SleepData) {
    const sleepDate = this.normalizeToMidnight(data.sleepDate);

    // Validate quality if provided
    if (data.quality && !['good', 'medium', 'poor'].includes(data.quality)) {
      throw new BadRequestException('Invalid quality value. Must be: good, medium, or poor');
    }

    // Check if this is a new entry
    const existing = await this.prisma.sleepLog.findUnique({
      where: {
        userId_sleepDate: {
          userId,
          sleepDate,
        },
      },
    });

    const result = await this.prisma.sleepLog.upsert({
      where: {
        userId_sleepDate: {
          userId,
          sleepDate,
        },
      },
      update: {
        durationMin: data.durationMin,
        quality: data.quality,
        source: data.source || 'manual',
        isManual: data.isManual ?? true,
        notes: data.notes,
      },
      create: {
        userId,
        sleepDate,
        durationMin: data.durationMin,
        quality: data.quality,
        source: data.source || 'manual',
        isManual: data.isManual ?? true,
        notes: data.notes,
      },
    });

    // Update gamification XP, streak, and wellness log count if new entry
    if (!existing) {
      try {
        await this.gamificationService.incrementDataEntry(userId, { wellness: true });
      } catch (error) {
        console.error('Error updating wellness log count:', error);
      }
    }

    return result;
  }

  async deleteSleep(userId: string, date: string) {
    const sleepDate = this.normalizeToMidnight(date);

    const record = await this.prisma.sleepLog.findUnique({
      where: {
        userId_sleepDate: {
          userId,
          sleepDate,
        },
      },
    });

    if (!record) {
      throw new NotFoundException('Sleep record not found');
    }

    return this.prisma.sleepLog.delete({
      where: { id: record.id },
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // Preferences Management
  // ────────────────────────────────────────────────────────────────────────

  async getPreferences(userId: string) {
    let prefs = await this.prisma.wellnessPreferences.findUnique({
      where: { userId },
    });

    if (!prefs) {
      // Create default preferences
      prefs = await this.prisma.wellnessPreferences.create({
        data: { userId },
      });
    }

    return prefs;
  }

  async updatePreferences(userId: string, data: Partial<{
    stepsGoal: number;
    meditationGoalMin: number;
    sleepGoalHours: number;
    tilesEnabled: any;
    notificationsJson: any;
  }>) {
    const prefs = await this.getPreferences(userId);

    return this.prisma.wellnessPreferences.update({
      where: { id: prefs.id },
      data,
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // Summary for Home Screen
  // ────────────────────────────────────────────────────────────────────────

  async getWellnessSummary(userId: string): Promise<WellnessSummary> {
    const prefs = await this.getPreferences(userId);
    const tilesEnabled = (prefs.tilesEnabled as any) || {};

    // Get today's steps
    let steps: WellnessSummary['steps'] = null;
    if (tilesEnabled.steps !== false) {
      const todaySteps = await this.getTodaySteps(userId);
      const count = todaySteps.count || 0;
      steps = {
        today: count,
        goal: prefs.stepsGoal,
        percentage: Math.round((count / prefs.stepsGoal) * 100),
        source: todaySteps.source || 'manual',
      };
    }

    // Get today's meditation
    let meditation: WellnessSummary['meditation'] = null;
    if (tilesEnabled.meditation !== false) {
      const todayMeditation = await this.getTodayMeditation(userId);
      meditation = {
        todayMin: todayMeditation.totalMin,
        goalMin: prefs.meditationGoalMin,
        percentage: Math.round((todayMeditation.totalMin / prefs.meditationGoalMin) * 100),
        sessions: todayMeditation.sessions,
      };
    }

    // Get last night's sleep
    let sleep: WellnessSummary['sleep'] = null;
    if (tilesEnabled.sleep !== false) {
      const lastNight = await this.getLastNightSleep(userId);
      if (lastNight) {
        const goalMin = prefs.sleepGoalHours * 60;
        sleep = {
          lastNightMin: lastNight.durationMin,
          goalHours: prefs.sleepGoalHours,
          percentage: Math.round((lastNight.durationMin / goalMin) * 100),
          quality: lastNight.quality || undefined,
        };
      }
    }

    return { steps, meditation, sleep };
  }
}
