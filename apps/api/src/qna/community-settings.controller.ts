import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from '../common/guards/admin.guard';
import {
  CommunitySettings,
  CommunitySettingsService,
} from './community-settings.service';

@Controller('qna')
export class CommunitySettingsController {
  constructor(private readonly settingsService: CommunitySettingsService) {}

  @Get('settings')
  getPublicSettings() {
    return this.settingsService.getSettings();
  }

  @Get('admin/settings')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  getAdminSettings() {
    return this.settingsService.getSettings();
  }

  @Put('admin/settings')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  updateAdminSettings(@Body() body: Partial<CommunitySettings>) {
    return this.settingsService.updateSettings(body);
  }
}
