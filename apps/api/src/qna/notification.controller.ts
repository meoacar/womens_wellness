import {
    Controller,
    Get,
    Patch,
    Post,
    Body,
    UseGuards,
    Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { QnaNotificationService } from './qna-notification.service';
import { UpdateQnaNotificationPreferencesDto } from './dto/notification.dto';

@Controller('qna/notifications')
@UseGuards(AuthGuard('jwt'))
export class NotificationController {
    constructor(
        private readonly notificationService: QnaNotificationService,
    ) { }

    @Get('preferences')
    async getPreferences(@Request() req: any) {
        const userId = req.user.id || req.user.sub;
        return this.notificationService.getNotificationPreferences(userId);
    }

    @Patch('preferences')
    async updatePreferences(
        @Request() req: any,
        @Body() dto: UpdateQnaNotificationPreferencesDto,
    ) {
        const userId = req.user.id || req.user.sub;
        return this.notificationService.updateNotificationPreferences(userId, dto);
    }

    @Get('unread-count')
    async getUnreadCount(@Request() req: any) {
        const userId = req.user.id || req.user.sub;
        return this.notificationService.getUnreadCount(userId);
    }

    @Post('mark-read')
    async markNotificationsRead(@Request() req: any) {
        const userId = req.user.id || req.user.sub;
        return this.notificationService.markNotificationsRead(userId);
    }
}
