import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Put,
    Query,
    UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserStatus, SubscriptionStatus } from '@prisma/client';
import { IsArray, IsObject, IsOptional, IsString } from 'class-validator';
import { AdminGuard } from '../common/guards/admin.guard';
import { AdminService } from './admin.service';
import { RetentionService, WinbackConfig } from './retention.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

class BulkUpdateDto {
    @IsArray()
    userIds!: string[];
    @IsObject()
    data!: {
        status?: UserStatus;
        pinEnabled?: boolean;
    };
}

class BulkDeleteDto {
    @IsArray()
    userIds!: string[];
}

class BulkNotificationDto {
    @IsArray()
    userIds!: string[];
    @IsObject()
    notification!: {
        title: string;
        body: string;
    };
}

class BulkEmailDto {
    @IsArray()
    userIds!: string[];
    @IsObject()
    email!: {
        subject: string;
        body: string;
    };
}

class SearchUsersDto {
    @IsOptional()
    @IsString()
    search?: string;
    @IsOptional()
    @IsString()
    lifeStage?: string;
    @IsOptional()
    status?: UserStatus;
    @IsOptional()
    subscriptionStatus?: SubscriptionStatus;
    @IsOptional()
    @IsString()
    createdAfter?: string;
    @IsOptional()
    @IsString()
    createdBefore?: string;
    @IsOptional()
    hasSubscription?: boolean | string;
    @IsOptional()
    page?: number | string;
    @IsOptional()
    limit?: number | string;
    @IsOptional()
    @IsString()
    sortBy?: string;
    @IsOptional()
    @IsString()
    sortOrder?: 'asc' | 'desc';
}

@ApiTags('admin')
@Controller('admin')
@UseGuards(AuthGuard('jwt'), AdminGuard)
@ApiBearerAuth()
export class AdminController {
    constructor(
        private readonly adminService: AdminService,
        private readonly retentionService: RetentionService,
    ) { }

    /**
     * Dashboard Statistics
     */
    @Get('dashboard/stats')
    @ApiOperation({ summary: 'Get dashboard statistics' })
    async getDashboardStats(
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        const start = startDate ? new Date(startDate) : undefined;
        const end = endDate ? new Date(endDate) : undefined;
        return this.adminService.getDashboardStats(start, end);
    }

    /**
     * Chart Data Endpoints
     */
    @Get('charts/user-growth')
    @ApiOperation({ summary: 'Get user growth chart data' })
    async getUserGrowthChart(@Query('days') days?: string) {
        const daysNum = days ? parseInt(days, 10) : 30;
        return this.adminService.getUserGrowthChart(daysNum);
    }

    @Get('charts/revenue')
    @ApiOperation({ summary: 'Get revenue chart data' })
    async getRevenueChart(@Query('days') days?: string) {
        const daysNum = days ? parseInt(days, 10) : 30;
        return this.adminService.getRevenueChart(daysNum);
    }

    /**
     * Bulk Operations
     */
    @Post('bulk/update-users')
    @ApiOperation({ summary: 'Bulk update users' })
    async bulkUpdateUsers(@Body() dto: BulkUpdateDto) {
        return this.adminService.bulkUpdateUsers(dto.userIds, dto.data);
    }

    @Post('bulk/delete-users')
    @ApiOperation({ summary: 'Bulk delete users' })
    async bulkDeleteUsers(@Body() dto: BulkDeleteDto) {
        return this.adminService.bulkDeleteUsers(dto.userIds);
    }

    @Post('bulk/send-notifications')
    @ApiOperation({ summary: 'Bulk send notifications' })
    async bulkSendNotifications(@Body() dto: BulkNotificationDto) {
        return this.adminService.bulkSendNotifications(
            dto.userIds,
            dto.notification,
        );
    }

    @Post('bulk/send-emails')
    @ApiOperation({ summary: 'Bulk send emails' })
    async bulkSendEmails(@Body() dto: BulkEmailDto) {
        return this.adminService.bulkSendEmails(dto.userIds, dto.email);
    }

    /**
     * Advanced User Search & Filtering
     */
    @Get('users/search')
    @ApiOperation({ summary: 'Advanced user search with filters' })
    async searchUsers(@Query() filters: SearchUsersDto) {
        const parsedFilters = {
            ...filters,
            createdAfter: filters.createdAfter ? new Date(filters.createdAfter) : undefined,
            createdBefore: filters.createdBefore ? new Date(filters.createdBefore) : undefined,
            hasSubscription:
                filters.hasSubscription === undefined || filters.hasSubscription === ''
                    ? undefined
                    : filters.hasSubscription === true || filters.hasSubscription === 'true',
            page: filters.page ? parseInt(filters.page.toString(), 10) : 1,
            limit: filters.limit ? parseInt(filters.limit.toString(), 10) : 20,
        };
        return this.adminService.searchUsers(parsedFilters);
    }

    /**
     * User Impersonation
     */
    @Post('impersonate/:userId')
    @ApiOperation({ summary: 'Impersonate a user' })
    async impersonateUser(
        @CurrentUser() admin: any,
        @Param('userId') userId: string,
    ) {
        return this.adminService.impersonateUser(admin.id, userId);
    }

    /**
     * System Health
     */
    @Get('system/health')
    @ApiOperation({ summary: 'Get system health metrics' })
    async getSystemHealth() {
        return this.adminService.getSystemHealth();
    }

    @Get('users/:userId/overview')
    @ApiOperation({ summary: 'Get 360 user overview (Admin)' })
    async getUserOverview(@Param('userId') userId: string) {
        return this.adminService.getUserOverview360(userId);
    }

    @Post('users/:userId/send-push')
    @ApiOperation({ summary: 'Send direct push notification to user (Admin)' })
    async sendDirectPush(
        @Param('userId') userId: string,
        @Body() body: { title: string; body: string },
    ) {
        return this.adminService.sendDirectPushToUser(userId, body.title, body.body);
    }

    @Post('users/:userId/sessions/revoke-all')
    @ApiOperation({ summary: 'Revoke all JWT sessions for user (Admin)' })
    async revokeAllUserSessions(
        @CurrentUser() admin: any,
        @Param('userId') userId: string,
    ) {
        return this.adminService.revokeAllUserSessions(admin.id, userId);
    }

    @Post('users/:userId/sessions/:familyId/revoke')
    @ApiOperation({ summary: 'Revoke a single JWT session family for user (Admin)' })
    async revokeUserSessionFamily(
        @CurrentUser() admin: any,
        @Param('userId') userId: string,
        @Param('familyId') familyId: string,
    ) {
        return this.adminService.revokeUserSessionFamily(admin.id, userId, familyId);
    }

    @Get('retention/funnel')
    @ApiOperation({ summary: 'Get user retention & conversion funnel' })
    async getRetentionFunnel() {
        return this.retentionService.getFunnelStats();
    }

    @Get('retention/winback')
    @ApiOperation({ summary: 'Get automated win-back configuration and logs' })
    async getWinbackConfig() {
        const [config, logs] = await Promise.all([
            this.retentionService.getWinbackConfig(),
            this.retentionService.getWinbackLogs(),
        ]);
        return { config, logs };
    }

    @Put('retention/winback')
    @ApiOperation({ summary: 'Update automated win-back configuration' })
    async updateWinbackConfig(@Body() body: Partial<WinbackConfig>) {
        const config = await this.retentionService.updateWinbackConfig(body);
        const logs = await this.retentionService.getWinbackLogs();
        return { config, logs };
    }

    @Post('retention/winback/dispatch')
    @ApiOperation({ summary: 'Run win-back campaign dispatch immediately' })
    async dispatchWinbackNow() {
        const summary = await this.retentionService.dispatchWinbackCampaigns(true);
        const logs = await this.retentionService.getWinbackLogs();
        return { summary, logs };
    }

    @Post('retention/nudge-user/:userId')
    @ApiOperation({ summary: 'Send targeted retention nudge to a specific user' })
    async nudgeUser(
        @Param('userId') userId: string,
        @Body()
        body: {
            titleTr?: string;
            bodyTr?: string;
            incentive?: 'none' | 'trial_offer' | 'nova_bonus' | 'quick_checkin';
            ctaScreen?: 'home' | 'calendar' | 'chat' | 'premium';
            sendPush?: boolean;
            sendEmail?: boolean;
            showInAppBanner?: boolean;
        },
    ) {
        return this.retentionService.nudgeSpecificUser(userId, body);
    }
}
