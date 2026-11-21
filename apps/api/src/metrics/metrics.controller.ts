import { Controller, Post, Get, Body, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { MetricsService } from './metrics.service';
import { CalculatorService } from './calculator.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

class CalculateBMIDto {
  @Type(() => Number)
  @IsNumber()
  heightCm!: number;

  @Type(() => Number)
  @IsNumber()
  weightKg!: number;

  @IsOptional()
  @IsString()
  measuredAt?: string;
}

class CalculateBMRDto {
  @Type(() => Number)
  @IsNumber()
  heightCm!: number;

  @Type(() => Number)
  @IsNumber()
  weightKg!: number;

  @Type(() => Number)
  @IsNumber()
  ageYears!: number;

  @IsString()
  sex!: 'male' | 'female';

  @IsOptional()
  @IsString()
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active' | 'extreme';
}

class CalculateWaterDto {
  @Type(() => Number)
  @IsNumber()
  weightKg!: number;

  @IsOptional()
  @IsString()
  activity?: 'sedentary' | 'low' | 'moderate' | 'active' | 'high';

  @IsOptional()
  @IsString()
  climate?: 'cool' | 'cold' | 'temperate' | 'moderate' | 'hot';
}

class CalculateCyclePublicDto {
  @IsString()
  lastPeriodDate!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cycleLength?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  periodLength?: number;
}

class CalculatePregnancyPublicDto {
  @IsOptional()
  @IsString()
  lmpDate?: string;

  @IsOptional()
  @IsString()
  dueDate?: string;
}

@ApiTags('metrics')
@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly calculatorService: CalculatorService,
  ) { }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user health metrics history' })
  async getMetrics(@CurrentUser() user: any) {
    return this.metricsService.getUserMetrics(user.id);
  }

  @Get('health-report')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get aggregated health & doctor summary report' })
  async getHealthReport(@CurrentUser() user: any, @Query('days') days?: string) {
    const parsedDays = days ? parseInt(days, 10) : 30;
    return this.metricsService.getHealthReport(user.id, Number.isNaN(parsedDays) ? 30 : parsedDays);
  }

  @Post('bmi')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Calculate and save BMI' })
  async calculateBMI(@CurrentUser() user: any, @Body() dto: CalculateBMIDto) {
    if (!Number.isFinite(dto.heightCm) || !Number.isFinite(dto.weightKg) || dto.heightCm < 50 || dto.heightCm > 260 || dto.weightKg < 20 || dto.weightKg > 350) {
      throw new BadRequestException('Geçerli boy (cm) ve kilo (kg) değerleri giriniz.');
    }

    const result = this.calculatorService.calculateBMI(
      dto.weightKg,
      dto.heightCm,
    );

    const metric = await this.metricsService.saveMetric(user.id, {
      kind: 'BMI',
      valueJson: {
        ...result,
        heightCm: dto.heightCm,
        weightKg: dto.weightKg,
      },
      measuredAt: dto.measuredAt ? new Date(dto.measuredAt) : new Date(),
    });

    return {
      bmi: result.bmi,
      category: result.category,
      heightCm: dto.heightCm,
      weightKg: dto.weightKg,
      metricId: metric.id,
    };
  }

  @Post('bmr')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Calculate BMR and TDEE' })
  async calculateBMR(@CurrentUser() user: any, @Body() dto: CalculateBMRDto) {
    if (
      !Number.isFinite(dto.heightCm) ||
      !Number.isFinite(dto.weightKg) ||
      !Number.isFinite(dto.ageYears) ||
      dto.heightCm < 50 ||
      dto.heightCm > 260 ||
      dto.weightKg < 20 ||
      dto.weightKg > 350 ||
      dto.ageYears < 10 ||
      dto.ageYears > 120
    ) {
      throw new BadRequestException('Geçerli boy (cm), kilo (kg) ve yaş değerleri giriniz.');
    }

    const bmr = this.calculatorService.calculateBMR(
      dto.weightKg,
      dto.heightCm,
      dto.ageYears,
      dto.sex || 'female',
    );

    const tdee = dto.activityLevel
      ? this.calculatorService.calculateTDEE(bmr, dto.activityLevel)
      : null;

    const metric = await this.metricsService.saveMetric(user.id, {
      kind: 'BMR',
      valueJson: {
        bmr: Math.round(bmr),
        tdee,
        heightCm: dto.heightCm,
        weightKg: dto.weightKg,
        ageYears: dto.ageYears,
        sex: dto.sex || 'female',
        activityLevel: dto.activityLevel,
      },
    });

    return {
      bmr: Math.round(bmr),
      tdee,
      metricId: metric.id,
    };
  }

  @Post('water/calculate')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Calculate daily water need' })
  async calculateWater(@Body() dto: CalculateWaterDto) {
    const weightKg = typeof dto.weightKg === 'string' ? parseFloat(dto.weightKg) : dto.weightKg;
    if (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 350) {
      throw new BadRequestException('Geçerli bir kilo (kg) değeri giriniz.');
    }

    const dailyNeed = this.calculatorService.calculateDailyWaterNeed(
      weightKg,
      dto.activity || 'moderate',
      dto.climate || 'temperate',
    );

    return {
      dailyWaterMl: dailyNeed,
      dailyNeedMl: dailyNeed,
      dailyNeedL: Math.round(dailyNeed / 100) / 10,
      glasses200Ml: Math.ceil(dailyNeed / 200),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Public Website Calculator Endpoints (No auth, stateless)
  // ─────────────────────────────────────────────────────────────

  @Post('public/bmi')
  @ApiOperation({ summary: 'Public BMI calculation for website visitors' })
  calculatePublicBMI(@Body() dto: CalculateBMIDto) {
    if (!Number.isFinite(dto.heightCm) || !Number.isFinite(dto.weightKg) || dto.heightCm < 50 || dto.heightCm > 260 || dto.weightKg < 20 || dto.weightKg > 350) {
      throw new BadRequestException('Geçerli boy (cm) ve kilo (kg) değerleri giriniz.');
    }
    const result = this.calculatorService.calculateBMI(dto.weightKg, dto.heightCm);
    return {
      bmi: result.bmi,
      category: result.category,
      heightCm: dto.heightCm,
      weightKg: dto.weightKg,
    };
  }

  @Post('public/bmr')
  @ApiOperation({ summary: 'Public BMR & TDEE calculation for website visitors' })
  calculatePublicBMR(@Body() dto: CalculateBMRDto) {
    if (
      !Number.isFinite(dto.heightCm) ||
      !Number.isFinite(dto.weightKg) ||
      !Number.isFinite(dto.ageYears) ||
      dto.heightCm < 50 ||
      dto.heightCm > 260 ||
      dto.weightKg < 20 ||
      dto.weightKg > 350 ||
      dto.ageYears < 10 ||
      dto.ageYears > 120
    ) {
      throw new BadRequestException('Geçerli boy (cm), kilo (kg) ve yaş değerleri giriniz.');
    }
    const bmr = this.calculatorService.calculateBMR(
      dto.weightKg,
      dto.heightCm,
      dto.ageYears,
      dto.sex || 'female',
    );
    const tdee = dto.activityLevel
      ? this.calculatorService.calculateTDEE(bmr, dto.activityLevel)
      : this.calculatorService.calculateTDEE(bmr, 'moderate');
    return {
      bmr: Math.round(bmr),
      tdee,
    };
  }

  @Post('public/water')
  @ApiOperation({ summary: 'Public daily water calculation for website visitors' })
  calculatePublicWater(@Body() dto: CalculateWaterDto) {
    if (!Number.isFinite(dto.weightKg) || dto.weightKg < 20 || dto.weightKg > 350) {
      throw new BadRequestException('Geçerli kilo (kg) değeri giriniz.');
    }
    const dailyNeed = this.calculatorService.calculateDailyWaterNeed(
      dto.weightKg,
      dto.activity || 'moderate',
      dto.climate || 'temperate',
    );
    return {
      dailyWaterMl: dailyNeed,
      dailyNeedL: Math.round(dailyNeed / 100) / 10,
      glasses200Ml: Math.ceil(dailyNeed / 200),
      glasses250Ml: Math.ceil(dailyNeed / 250),
    };
  }

  @Post('public/cycle')
  @ApiOperation({ summary: 'Public cycle & ovulation estimate for website visitors' })
  calculatePublicCycle(@Body() dto: CalculateCyclePublicDto) {
    if (!dto.lastPeriodDate || Number.isNaN(Date.parse(dto.lastPeriodDate))) {
      throw new BadRequestException('Geçerli bir son adet başlangıç tarihi giriniz.');
    }
    return this.calculatorService.calculateCycleEstimate(dto);
  }

  @Post('public/pregnancy')
  @ApiOperation({ summary: 'Public pregnancy week & due date estimate for website visitors' })
  calculatePublicPregnancy(@Body() dto: CalculatePregnancyPublicDto) {
    if (!dto.lmpDate && !dto.dueDate) {
      throw new BadRequestException('Son adet tarihi veya tahmini doğum tarihi gereklidir.');
    }
    return this.calculatorService.calculatePregnancyEstimate(dto);
  }
}
