import {
    Controller,
    Post,
    Get,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    Request,
    BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import {
    ModerationService,
    CreateReportDto,
    ReportFilters,
    ModerationAction,
} from './moderation.service';
import { ContentType, ReportStatus } from '@prisma/client';
import { AdminGuard } from './guards';

@Controller('qna/moderation')
@UseGuards(AuthGuard('jwt'))
export class ModerationController {
    constructor(private moderationService: ModerationService) { }

    /**
     * İçerik raporla
     * POST /api/qna/moderation/report
     */
    @Post('report')
    @Throttle({ default: { limit: 10, ttl: 3600000 } }) // 10 reports per hour
    async reportContent(@Request() req, @Body() dto: CreateReportDto) {
        const userId = req.user?.id || req.user?.userId || req.user?.sub;
        if (!userId) {
            throw new BadRequestException('User ID not found');
        }
        return this.moderationService.reportContent(userId, dto);
    }

    /**
     * Kullanıcı engelle (Google Play UGC politikası)
     * POST /api/qna/moderation/block/:targetUserId
     */
    @Post('block/:targetUserId')
    @Throttle({ default: { limit: 30, ttl: 3600000 } })
    async blockUser(
        @Request() req,
        @Param('targetUserId') targetUserId: string,
        @Body('reason') reason?: string,
    ) {
        const userId = req.user?.id || req.user?.userId || req.user?.sub;
        if (!userId) {
            throw new BadRequestException('User ID not found');
        }
        return this.moderationService.blockUser(userId, targetUserId, reason);
    }

    /**
     * Kullanıcı engelini kaldır
     * DELETE /api/qna/moderation/block/:targetUserId
     */
    @Delete('block/:targetUserId')
    async unblockUser(
        @Request() req,
        @Param('targetUserId') targetUserId: string,
    ) {
        const userId = req.user?.id || req.user?.userId || req.user?.sub;
        if (!userId) {
            throw new BadRequestException('User ID not found');
        }
        return this.moderationService.unblockUser(userId, targetUserId);
    }

    /**
     * Engellenen kullanıcıları listele
     * GET /api/qna/moderation/blocked-users
     */
    @Get('blocked-users')
    async getBlockedUsers(@Request() req) {
        const userId = req.user?.id || req.user?.userId || req.user?.sub;
        if (!userId) {
            throw new BadRequestException('User ID not found');
        }
        return this.moderationService.getBlockedUsers(userId);
    }

    /**
     * Raporları listele (admin)
     * GET /api/qna/moderation/reports
     */
    @Get('reports')
    @UseGuards(AdminGuard)
    async getReports(
        @Query('status') status?: ReportStatus,
        @Query('contentType') contentType?: ContentType,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        const filters: ReportFilters = {
            status,
            contentType,
            page: page ? parseInt(page) : 1,
            limit: limit ? parseInt(limit) : 20,
        };
        return this.moderationService.getReports(filters);
    }

    /**
     * Raporu incele ve aksiyon al (admin)
     * PATCH /api/qna/moderation/reports/:id
     */
    @Patch('reports/:id')
    @UseGuards(AdminGuard)
    @Throttle({ default: { limit: 50, ttl: 3600000 } }) // 50 reviews per hour
    async reviewReport(
        @Request() req,
        @Param('id') reportId: string,
        @Body('action') action: ModerationAction,
        @Body('moderatorNote') moderatorNote?: string,
    ) {
        return this.moderationService.reviewReport(
            reportId,
            action,
            req.user.id,
            moderatorNote,
        );
    }

    /**
     * Rapor detayını getir (admin)
     * GET /api/qna/moderation/reports/:id
     */
    @Get('reports/:id')
    @UseGuards(AdminGuard)
    async getReport(@Param('id') reportId: string) {
        return this.moderationService.getReportById(reportId);
    }

    /**
     * Rapor durumunu güncelle (admin)
     * PATCH /api/qna/moderation/reports/:id/status
     */
    @Patch('reports/:id/status')
    @UseGuards(AdminGuard)
    async updateReportStatus(
        @Param('id') reportId: string,
        @Body('status') status: string,
    ) {
        return this.moderationService.updateReportStatus(reportId, status);
    }

    /**
     * İçeriği gizle (admin)
     * POST /api/qna/moderation/hide/:contentType/:id
     */
    @Post('hide/:contentType/:id')
    @UseGuards(AdminGuard)
    @Throttle({ default: { limit: 100, ttl: 3600000 } }) // 100 hides per hour
    async hideContent(
        @Param('contentType') contentType: ContentType,
        @Param('id') contentId: string,
    ) {
        await this.moderationService.hideContent(contentId, contentType);
        return { message: 'İçerik gizlendi' };
    }

    /**
     * İçeriği sil (admin)
     * DELETE /api/qna/moderation/content/:contentType/:id
     */
    @Delete('content/:contentType/:id')
    @UseGuards(AdminGuard)
    @Throttle({ default: { limit: 100, ttl: 3600000 } }) // 100 deletes per hour
    async deleteContent(
        @Param('contentType') contentType: ContentType,
        @Param('id') contentId: string,
    ) {
        await this.moderationService.deleteContent(contentId, contentType);
        return { message: 'İçerik silindi' };
    }

    /**
     * Kullanıcının raporlarını getir
     * GET /api/qna/moderation/my-reports
     */
    @Get('my-reports')
    async getMyReports(@Request() req) {
        return this.moderationService.getUserReports(req.user.id);
    }

    /**
     * İçeriğin rapor sayısını getir
     * GET /api/qna/moderation/report-count/:contentType/:id
     */
    @Get('report-count/:contentType/:id')
    async getReportCount(
        @Param('contentType') contentType: ContentType,
        @Param('id') contentId: string,
    ) {
        const count = await this.moderationService.getContentReportCount(
            contentId,
            contentType,
        );
        return { count };
    }

    /**
     * Spam kontrolü
     * POST /api/qna/moderation/check-spam
     */
    @Post('check-spam')
    async checkSpam(@Body('content') content: string) {
        const isSpam = this.moderationService.checkSpam(content);
        return { isSpam };
    }
}
