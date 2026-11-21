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
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CyclesService } from './cycles.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AdminGuard } from '../common/guards/admin.guard';

interface PeriodSymptoms {
  flow: 'light' | 'moderate' | 'heavy';
  cramps: 0 | 1 | 2 | 3 | 4 | 5;
  mood: string[];
  physical: string[];
  notes?: string;
}

@Controller('cycles')
@UseGuards(AuthGuard('jwt'))
export class CyclesController {
  constructor(private readonly cyclesService: CyclesService) {}

  @Post()
  async createCycle(
    @CurrentUser() user: any,
    @Body()
    data: {
      startDate: string;
      endDate?: string;
      symptoms?: PeriodSymptoms;
      notes?: string;
    },
  ) {
    return this.cyclesService.createCycle(user.id, data);
  }

  @Get()
  async getCycles(
    @CurrentUser() user: any,
    @Query('limit') limit?: string,
  ) {
    return this.cyclesService.getCycles(
      user.id,
      limit ? parseInt(limit) : undefined,
      false,
    );
  }

  @Get('admin/all')
  @UseGuards(AdminGuard)
  async getAllCyclesAdmin(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.cyclesService.getAdminCycles({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
      search,
      status,
    });
  }

  @Get('admin/:id')
  @UseGuards(AdminGuard)
  async getCycleAdmin(@Param('id') id: string) {
    return this.cyclesService.getAdminCycleById(id);
  }

  @Get('stats')
  async getStats(@CurrentUser() user: any) {
    return this.cyclesService.getStats(user.id);
  }

  @Get('prediction')
  async getPrediction(@CurrentUser() user: any) {
    return this.cyclesService.getPrediction(user.id);
  }

  @Get('insights/patterns')
  async getPatternInsights(@CurrentUser() user: any) {
    return this.cyclesService.getPatternInsights(user.id);
  }

  @Get('calendar')
  async getCalendarMonth(
    @CurrentUser() user: any,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    return this.cyclesService.getCalendarMonth(
      user.id,
      parseInt(year),
      parseInt(month),
    );
  }

  @Get(':id')
  async getCycle(@CurrentUser() user: any, @Param('id') id: string) {
    return this.cyclesService.getCycle(user.id, id, user.isAdmin);
  }

  @Patch(':id')
  async updateCycle(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body()
    data: {
      startDate?: string;
      endDate?: string | null;
      symptoms?: PeriodSymptoms;
      notes?: string;
    },
  ) {
    return this.cyclesService.updateCycle(user.id, id, data);
  }

  @Delete(':id')
  async deleteCycle(@CurrentUser() user: any, @Param('id') id: string) {
    return this.cyclesService.deleteCycle(user.id, id);
  }

  @Delete()
  async deleteAllCycles(@CurrentUser() user: any) {
    return this.cyclesService.deleteAllCycles(user.id);
  }

  // Daily Log endpoints
  @Post('daily-log')
  async upsertDailyLog(
    @CurrentUser() user: any,
    @Body()
    data: {
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
    },
  ) {
    return this.cyclesService.upsertDailyLog(user.id, data);
  }

  @Get('daily-log/:date')
  async getDailyLog(
    @CurrentUser() user: any,
    @Param('date') date: string,
  ) {
    return this.cyclesService.getDailyLog(user.id, date);
  }

  @Get('daily-logs')
  async getDailyLogs(
    @CurrentUser() user: any,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.cyclesService.getDailyLogs(user.id, startDate, endDate);
  }

  @Delete('daily-log/:date')
  async deleteDailyLog(
    @CurrentUser() user: any,
    @Param('date') date: string,
  ) {
    return this.cyclesService.deleteDailyLog(user.id, date);
  }
}
