import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AdminGuard } from '../common/guards/admin.guard';
import { PostpartumService } from './postpartum.service';

@Controller('postpartum')
@UseGuards(AuthGuard('jwt'))
export class PostpartumController {
  constructor(private readonly postpartumService: PostpartumService) {}

  @Get('admin/all')
  @UseGuards(AdminGuard)
  getAdminAll(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
  ) {
    return this.postpartumService.getAdminAll(
      Math.max(1, parseInt(page, 10) || 1),
      Math.min(100, Math.max(1, parseInt(limit, 10) || 20)),
      search,
    );
  }

  @Get('overview')
  getOverview(@CurrentUser() user: any) {
    return this.postpartumService.getOverview(user.id);
  }

  @Get('life-stage')
  getLifeStage(@CurrentUser() user: any) {
    return this.postpartumService.getLifeStage(user.id);
  }

  @Patch('life-stage')
  updateLifeStage(
    @CurrentUser() user: any,
    @Body() body: { lifeStage: string },
  ) {
    return this.postpartumService.updateLifeStage(user.id, body.lifeStage);
  }

  @Post('baby')
  upsertBaby(
    @CurrentUser() user: any,
    @Body()
    body: {
      name: string;
      birthDate: string;
      gender?: string;
      birthWeightGr?: number;
      birthHeightCm?: number;
      notes?: string;
    },
  ) {
    return this.postpartumService.upsertBabyProfile(user.id, body);
  }

  @Post('feedings')
  logFeeding(
    @CurrentUser() user: any,
    @Body()
    body: {
      type: string;
      durationSec?: number;
      amountMl?: number;
      startedAt?: string;
      notes?: string;
    },
  ) {
    return this.postpartumService.logFeeding(user.id, body);
  }

  @Delete('feedings/:id')
  deleteFeeding(@CurrentUser() user: any, @Param('id') id: string) {
    return this.postpartumService.deleteFeeding(user.id, id);
  }

  @Post('diapers')
  logDiaper(
    @CurrentUser() user: any,
    @Body() body: { type: string; loggedAt?: string; notes?: string },
  ) {
    return this.postpartumService.logDiaper(user.id, body);
  }

  @Delete('diapers/:id')
  deleteDiaper(@CurrentUser() user: any, @Param('id') id: string) {
    return this.postpartumService.deleteDiaper(user.id, id);
  }

  @Post('sleeps')
  logSleep(
    @CurrentUser() user: any,
    @Body()
    body: {
      startedAt?: string;
      endedAt?: string;
      durationMin: number;
      notes?: string;
    },
  ) {
    return this.postpartumService.logSleep(user.id, body);
  }

  @Delete('sleeps/:id')
  deleteSleep(@CurrentUser() user: any, @Param('id') id: string) {
    return this.postpartumService.deleteSleep(user.id, id);
  }

  @Post('growth')
  logGrowth(
    @CurrentUser() user: any,
    @Body()
    body: {
      measuredAt?: string;
      weightKg?: number;
      heightCm?: number;
      headCm?: number;
      notes?: string;
    },
  ) {
    return this.postpartumService.logGrowth(user.id, body);
  }

  @Delete('growth/:id')
  deleteGrowth(@CurrentUser() user: any, @Param('id') id: string) {
    return this.postpartumService.deleteGrowth(user.id, id);
  }

  @Patch('vaccines/:id')
  toggleVaccine(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body()
    body: { administered: boolean; administeredAt?: string; notes?: string },
  ) {
    return this.postpartumService.toggleVaccine(user.id, id, body);
  }
}
