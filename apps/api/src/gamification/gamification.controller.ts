import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { GamificationService } from './gamification.service';
import { AchievementService } from './achievement.service';
import { InsightService } from './insight.service';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';

@Controller('gamification')
@UseGuards(JwtAuthGuard)
export class GamificationController {
    constructor(
        private gamificationService: GamificationService,
        private achievementService: AchievementService,
        private insightService: InsightService,
    ) { }

    @Get('stats')
    async getStats(@Req() req: any) {
        return this.gamificationService.getUserStats(req.user.id);
    }

    @Get('daily-tasks')
    async getDailyTasks(@Req() req: any) {
        return this.gamificationService.getDailyTasks(req.user.id);
    }

    @Post('daily-checkin')
    async submitDailyCheckin(
        @Req() req: any,
        @Body()
        body: {
            mood?: string;
            energy?: number;
            symptoms?: string[];
            water250?: boolean;
            note?: string;
        },
    ) {
        const res = await this.gamificationService.submitDailyCheckin(req.user.id, body || {});
        await this.achievementService.checkAchievements(req.user.id).catch(() => null);
        return res;
    }

    @Get('achievements')
    async getAchievements(@Req() req: any) {
        return this.achievementService.getUserAchievements(req.user.id);
    }

    @Get('achievements/:id/progress')
    async getAchievementProgress(@Req() req: any, @Param('id') achievementId: string) {
        return this.achievementService.getAchievementProgress(req.user.id, achievementId);
    }

    @Post('check-achievements')
    async checkAchievements(@Req() req: any) {
        return this.achievementService.checkAchievements(req.user.id);
    }

    @Get('insights')
    async getInsights(@Req() req: any, @Query('includeRead') includeRead?: string) {
        const showRead = includeRead === undefined ? true : includeRead !== 'false';
        return this.insightService.getUserInsights(req.user.id, showRead);
    }

    @Post('insights/read-all')
    async markAllInsightsAsRead(@Req() req: any) {
        return this.insightService.markAllAsRead(req.user.id);
    }

    @Post('insights/:id/read')
    async markInsightAsRead(@Req() req: any, @Param('id') insightId: string) {
        return this.insightService.markAsRead(insightId, req.user.id);
    }

    @Post('generate-insights')
    async generateInsights(@Req() req: any) {
        return this.insightService.generateInsights(req.user.id);
    }

    @Post('reset')
    async resetGamification(@Req() req: any) {
        return this.gamificationService.resetUserGamification(req.user.id);
    }

    // Admin-only endpoint to seed default achievements
    @Post('seed-achievements')
    @UseGuards(JwtAuthGuard, AdminGuard)
    async seedAchievements() {
        const existing = await this.achievementService.seedAchievements();
        return { message: 'Achievements seeded successfully', count: existing.length };
    }
}
