import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { WellnessService, StepsData, MeditationData, SleepData } from './wellness.service';
import { AdminGuard } from '../common/guards/admin.guard';

@Controller('wellness/v1')
@UseGuards(AuthGuard('jwt'))
export class WellnessController {
  constructor(private readonly wellnessService: WellnessService) { }

  // ────────────────────────────────────────────────────────────────────────
  // Steps Endpoints
  // ────────────────────────────────────────────────────────────────────────

  @Get('steps')
  async getSteps(
    @Request() req,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;

    return this.wellnessService.getSteps(req.user.id, fromDate, toDate);
  }

  @Get('steps/today')
  async getTodaySteps(@Request() req) {
    return this.wellnessService.getTodaySteps(req.user.id);
  }

  @Post('steps')
  async logSteps(@Request() req, @Body() data: StepsData) {
    return this.wellnessService.logSteps(req.user.id, data);
  }

  @Delete('steps/:date')
  async deleteSteps(@Request() req, @Param('date') date: string) {
    return this.wellnessService.deleteSteps(req.user.id, date);
  }

  // ────────────────────────────────────────────────────────────────────────
  // Meditation Endpoints
  // ────────────────────────────────────────────────────────────────────────

  @Get('meditation')
  async getMeditation(
    @Request() req,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;

    return this.wellnessService.getMeditation(req.user.id, fromDate, toDate);
  }

  @Get('meditation/today')
  async getTodayMeditation(@Request() req) {
    return this.wellnessService.getTodayMeditation(req.user.id);
  }

  @Post('meditation')
  async logMeditation(@Request() req, @Body() data: MeditationData) {
    return this.wellnessService.logMeditation(req.user.id, data);
  }

  @Delete('meditation/:sessionId')
  async deleteMeditation(@Request() req, @Param('sessionId') sessionId: string) {
    return this.wellnessService.deleteMeditation(req.user.id, sessionId);
  }

  // ────────────────────────────────────────────────────────────────────────
  // Sleep Endpoints
  // ────────────────────────────────────────────────────────────────────────

  @Get('sleep')
  async getSleep(
    @Request() req,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;

    return this.wellnessService.getSleep(req.user.id, fromDate, toDate);
  }

  @Get('sleep/last-night')
  async getLastNightSleep(@Request() req) {
    return this.wellnessService.getLastNightSleep(req.user.id);
  }

  @Post('sleep')
  async logSleep(@Request() req, @Body() data: SleepData) {
    return this.wellnessService.logSleep(req.user.id, data);
  }

  @Delete('sleep/:date')
  async deleteSleep(@Request() req, @Param('date') date: string) {
    return this.wellnessService.deleteSleep(req.user.id, date);
  }

  // ────────────────────────────────────────────────────────────────────────
  // Preferences Endpoints
  // ────────────────────────────────────────────────────────────────────────

  @Get('preferences')
  async getPreferences(@Request() req) {
    return this.wellnessService.getPreferences(req.user.id);
  }

  @Post('preferences')
  async updatePreferences(@Request() req, @Body() data: any) {
    return this.wellnessService.updatePreferences(req.user.id, data);
  }

  // ────────────────────────────────────────────────────────────────────────
  // Summary Endpoint (for Home Screen)
  // ────────────────────────────────────────────────────────────────────────

  @Get('summary')
  async getWellnessSummary(@Request() req) {
    return this.wellnessService.getWellnessSummary(req.user.id);
  }

  // ────────────────────────────────────────────────────────────────────────
  // Admin Endpoints
  // ────────────────────────────────────────────────────────────────────────

  @Get('admin/stats')
  @UseGuards(AdminGuard)
  async getAdminStats() {
    const prisma = this.wellnessService['prisma'];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      dailyStepsStats,
      legacyStepsStats,
      meditationStats,
      sleepStats,
      waterStats,
      totalDailyLogs,
      totalHealthMetrics,
      activeStepUsers,
      activeWaterUsers,
      profilesWithPrefs,
      todayStepUsersCount,
    ] = await Promise.all([
      prisma.dailySteps.aggregate({ _sum: { count: true }, _count: true }),
      prisma.stepsLog.aggregate({ _sum: { steps: true } }),
      prisma.meditationSession.aggregate({ _sum: { durationMin: true }, _count: true }),
      prisma.sleepLog.aggregate({ _sum: { durationMin: true }, _count: true }),
      prisma.waterLog.aggregate({ _sum: { amountMl: true }, _count: true }),
      prisma.dailyLog.count(),
      prisma.healthMetric.count(),
      prisma.dailySteps.findMany({
        where: { date: { gte: sevenDaysAgo } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      prisma.waterLog.findMany({
        where: { loggedAt: { gte: sevenDaysAgo } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      prisma.profile.findMany({
        select: { preferencesJson: true },
      }),
      prisma.dailySteps.count({
        where: {
          date: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
          count: { gt: 0 },
        },
      }),
    ]);

    const activePushUsersCount = profilesWithPrefs.filter((p) => {
      const prefs = p.preferencesJson as Record<string, any> | null;
      return Boolean(prefs?.pushToken);
    }).length;

    const activeUserIds = new Set([
      ...activeStepUsers.map((u) => u.userId),
      ...activeWaterUsers.map((u) => u.userId),
    ]);

    return {
      totalSteps: (dailyStepsStats._sum.count || 0) + (legacyStepsStats._sum.steps || 0),
      totalMeditation: meditationStats._sum.durationMin || 0,
      totalSleep: Math.round(((sleepStats._sum.durationMin || 0) / 60) * 10) / 10,
      totalWater: waterStats._sum.amountMl || 0,
      totalDailyLogs,
      totalHealthMetrics,
      activeUsers7d: activeUserIds.size,
      activePushUsersCount,
      todayStepUsersCount,
      counts: {
        steps: dailyStepsStats._count,
        meditation: meditationStats._count,
        sleep: sleepStats._count,
        water: waterStats._count,
        dailyLogs: totalDailyLogs,
        metrics: totalHealthMetrics,
      },
    };
  }

  @Get('admin/overview')
  @UseGuards(AdminGuard)
  async getAdminOverview(
    @Query('search') search?: string,
    @Query('limit') limit: string = '50',
  ) {
    const prisma = this.wellnessService['prisma'];
    const take = Math.min(100, Math.max(10, parseInt(limit, 10) || 50));
    const userFilter = search?.trim()
      ? {
          user: {
            OR: [
              { email: { contains: search.trim(), mode: 'insensitive' as const } },
              { username: { contains: search.trim(), mode: 'insensitive' as const } },
            ],
          },
        }
      : {};

    const userSelect = {
      select: {
        id: true,
        email: true,
        username: true,
      },
    };

    const [stats, steps, water, sleep, meditation, dailyLogs, metrics] = await Promise.all([
      this.getAdminStats(),
      prisma.dailySteps.findMany({
        where: userFilter,
        include: { user: userSelect },
        orderBy: { date: 'desc' },
        take,
      }),
      prisma.waterLog.findMany({
        where: userFilter,
        include: { user: userSelect },
        orderBy: { loggedAt: 'desc' },
        take,
      }),
      prisma.sleepLog.findMany({
        where: userFilter,
        include: { user: userSelect },
        orderBy: { sleepDate: 'desc' },
        take,
      }),
      prisma.meditationSession.findMany({
        where: userFilter,
        include: { user: userSelect },
        orderBy: { date: 'desc' },
        take,
      }),
      prisma.dailyLog.findMany({
        where: userFilter,
        include: { user: userSelect },
        orderBy: { date: 'desc' },
        take,
      }),
      prisma.healthMetric.findMany({
        where: userFilter,
        include: { user: userSelect },
        orderBy: { measuredAt: 'desc' },
        take,
      }),
    ]);

    return {
      stats,
      records: {
        steps,
        water,
        sleep,
        meditation,
        dailyLogs,
        metrics,
      },
    };
  }
}
