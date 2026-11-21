import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RemindersService, CreateReminderDto, UpdateReminderDto } from './reminders.service';
import { PushService } from './push.service';
import { AdminGuard } from '../common/guards/admin.guard';

@Controller('reminders')
@UseGuards(AuthGuard('jwt'))
export class RemindersController {
  constructor(
    private readonly remindersService: RemindersService,
    private readonly pushService: PushService,
  ) { }

  // Admin: Get all reminders (must be before @Get(':id'))
  @Get('admin/all')
  @UseGuards(AdminGuard)
  async getAllReminders(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('active') active?: string,
  ) {
    return this.remindersService.getAllReminders(
      parseInt(page, 10) || 1,
      parseInt(limit, 10) || 20,
      { search, type, active },
    );
  }

  @Patch('admin/:id')
  @UseGuards(AdminGuard)
  async adminUpdateReminder(
    @Param('id') id: string,
    @Body() data: UpdateReminderDto,
  ) {
    return this.remindersService.adminUpdateReminder(id, data);
  }

  @Delete('admin/:id')
  @UseGuards(AdminGuard)
  async adminDeleteReminder(@Param('id') id: string) {
    return this.remindersService.adminDeleteReminder(id);
  }

  @Post()
  async createReminder(
    @Request() req: any,
    @Body() data: CreateReminderDto,
  ) {
    return this.remindersService.createReminder(req.user.id, data);
  }

  @Get()
  async getReminders(@Request() req: any) {
    return this.remindersService.getReminders(req.user.id);
  }

  @Get('preferences')
  async getNotificationPreferences(@Request() req: any) {
    return this.pushService.getNotificationPreferences(req.user.id);
  }

  @Patch('preferences')
  async updateNotificationPreferences(
    @Request() req: any,
    @Body() data: any,
  ) {
    return this.pushService.updateNotificationPreferences(req.user.id, data);
  }

  @Get('push/pending')
  async getPendingPushNotifications(@Request() req: any) {
    return {
      notifications: await this.pushService.getPendingNotifications(req.user.id),
    };
  }

  @Post('push/ack')
  async ackPendingPushNotifications(
    @Request() req: any,
    @Body() data: { ids: string[] },
  ) {
    return this.pushService.ackPendingNotifications(req.user.id, data?.ids || []);
  }

  @Post('push/register')
  async registerPushToken(
    @Request() req: any,
    @Body() data: { pushToken: string },
  ) {
    return this.pushService.registerPushToken(req.user.id, data.pushToken);
  }

  @Post('push/test')
  async testPush(@Request() req: any) {
    return this.pushService.sendPush(
      req.user.id,
      {
        to: '',
        sound: 'default',
        title: 'Kadın Atlası Bildirim Testi 🔔',
        body: 'Harika! Sunucu ve cihaz bildirimlerin aktif olarak çalışıyor.',
        data: { screen: 'reminders', test: true },
      },
      { ignoreQuietHours: true },
    );
  }

  @Get(':id')
  async getReminder(@Request() req: any, @Param('id') id: string) {
    return this.remindersService.getReminder(req.user.id, id);
  }

  @Patch(':id')
  async updateReminder(
    @Request() req: any,
    @Param('id') id: string,
    @Body() data: UpdateReminderDto,
  ) {
    return this.remindersService.updateReminder(req.user.id, id, data);
  }

  @Delete(':id')
  async deleteReminder(@Request() req: any, @Param('id') id: string) {
    return this.remindersService.deleteReminder(req.user.id, id);
  }

  @Patch(':id/toggle')
  async toggleReminder(
    @Request() req: any,
    @Param('id') id: string,
    @Body() data: { active: boolean },
  ) {
    return this.remindersService.toggleReminder(req.user.id, id, data.active);
  }
}
