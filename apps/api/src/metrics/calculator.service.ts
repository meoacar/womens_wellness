import { Injectable } from '@nestjs/common';

type Sex = 'male' | 'female';
type Activity = 'sedentary' | 'moderate' | 'active';
type Climate = 'cool' | 'temperate' | 'hot';
type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active' | 'extreme';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function parseToUtcNoon(input: Date | string): Date {
  if (typeof input === 'string') {
    const isoDateMatch = input.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoDateMatch) {
      const year = Number(isoDateMatch[1]);
      const month = Number(isoDateMatch[2]) - 1;
      const day = Number(isoDateMatch[3]);
      return new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
    }
  }
  const d = input instanceof Date ? input : new Date(input);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0, 0));
}

function addUtcDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * MS_PER_DAY);
}

function diffUtcDays(later: Date, earlier: Date): number {
  const laterDay = Date.UTC(later.getUTCFullYear(), later.getUTCMonth(), later.getUTCDate());
  const earlierDay = Date.UTC(earlier.getUTCFullYear(), earlier.getUTCMonth(), earlier.getUTCDate());
  return Math.round((laterDay - earlierDay) / MS_PER_DAY);
}

@Injectable()
export class CalculatorService {
  /**
   * Calculate BMI (Body Mass Index)
   */
  calculateBMI(weightKg: number, heightCm: number): {
    bmi: number;
    category: 'underweight' | 'normal' | 'overweight' | 'obese';
  } {
    const heightM = heightCm / 100;
    const bmi = Math.round((weightKg / (heightM * heightM)) * 10) / 10;

    let category: 'underweight' | 'normal' | 'overweight' | 'obese';
    if (bmi < 18.5) category = 'underweight';
    else if (bmi < 25) category = 'normal';
    else if (bmi < 30) category = 'overweight';
    else category = 'obese';

    return { bmi, category };
  }

  /**
   * Calculate BMR using Mifflin-St Jeor Equation
   */
  calculateBMR(
    weightKg: number,
    heightCm: number,
    ageYears: number,
    sex: Sex | string,
  ): number {
    const normalizedSex = String(sex || 'female').trim().toLowerCase();
    if (normalizedSex === 'male') {
      return 10 * weightKg + 6.25 * heightCm - 5 * ageYears + 5;
    }
    return 10 * weightKg + 6.25 * heightCm - 5 * ageYears - 161;
  }

  /**
   * Calculate TDEE (Total Daily Energy Expenditure)
   */
  calculateTDEE(bmr: number, activityLevel: ActivityLevel | string): number {
    const multipliers: Record<string, number> = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      very_active: 1.9,
      // Legacy mobile alias
      extreme: 1.9,
    };

    const normalized = String(activityLevel || 'moderate').trim().toLowerCase();
    const multiplier = multipliers[normalized] ?? multipliers.moderate;
    return Math.round(bmr * multiplier);
  }

  /**
   * Calculate daily water need (30-35 ml/kg baseline with modifiers)
   */
  calculateDailyWaterNeed(
    weightKg: number,
    activity: Activity | string,
    climate: Climate | string,
  ): number {
    const base = weightKg * 33; // 33 ml per kg baseline (average of 30-35)
    const activityMultipliers: Record<string, number> = {
      sedentary: 1.0,
      low: 1.0,
      moderate: 1.15,
      active: 1.3,
      high: 1.3,
    };
    const climateBonuses: Record<string, number> = {
      cool: 0,
      cold: 0,
      temperate: 250,
      moderate: 250,
      hot: 500,
    };

    const normalizedActivity = String(activity || 'moderate').trim().toLowerCase();
    const normalizedClimate = String(climate || 'temperate').trim().toLowerCase();
    const activityMultiplier = activityMultipliers[normalizedActivity] ?? 1.15;
    const climateBonus = climateBonuses[normalizedClimate] ?? 250;

    return Math.round(base * activityMultiplier + climateBonus); // ml/day
  }

  /**
   * Calculate pregnancy due date (Naegele's rule: LMP + 280 days)
   */
  calculateDueDate(lmpDate: Date): Date {
    return addUtcDays(parseToUtcNoon(lmpDate), 280);
  }

  /**
   * Calculate pregnancy week from LMP
   */
  calculatePregnancyWeek(lmpDate: Date): number {
    const lmp = parseToUtcNoon(lmpDate);
    const today = parseToUtcNoon(new Date());
    const diffDays = Math.max(0, diffUtcDays(today, lmp));
    return Math.floor(diffDays / 7);
  }

  /**
   * Calculate cycle prediction, ovulation, fertile window & current phase
   */
  calculateCycleEstimate(params: {
    lastPeriodDate: string;
    cycleLength?: number;
    periodLength?: number;
  }) {
    const cycleLength = Math.min(45, Math.max(20, Math.round(params.cycleLength || 28)));
    const periodLength = Math.min(10, Math.max(2, Math.round(params.periodLength || 5)));

    const lmp = parseToUtcNoon(params.lastPeriodDate);
    const today = parseToUtcNoon(new Date());
    const diffDays = diffUtcDays(today, lmp);
    const isFutureDate = diffDays < 0;

    // Project forward to the currently active cycle when past cycles have elapsed
    const cyclesPassed = diffDays >= 0 ? Math.floor(diffDays / cycleLength) : 0;
    const activeCycleStart = addUtcDays(lmp, cyclesPassed * cycleLength);
    const currentCycleDay = diffDays >= 0 ? (diffDays % cycleLength) + 1 : 1;

    const ovulationOffset = Math.max(7, cycleLength - 14);
    const ovulationCycleDay = ovulationOffset + 1; // 1-indexed cycle day (LMP = Day 1)
    let currentPhase: 'MENSTRUAL' | 'FOLLICULAR' | 'OVULATION' | 'LUTEAL' = 'FOLLICULAR';
    if (currentCycleDay <= periodLength) {
      currentPhase = 'MENSTRUAL';
    } else if (currentCycleDay >= ovulationCycleDay - 1 && currentCycleDay <= ovulationCycleDay + 1) {
      currentPhase = 'OVULATION';
    } else if (currentCycleDay > ovulationCycleDay + 1) {
      currentPhase = 'LUTEAL';
    }

    const currentCycleOvulation = addUtcDays(activeCycleStart, ovulationOffset);
    const currentFertileStart = addUtcDays(currentCycleOvulation, -5);
    const currentFertileEnd = addUtcDays(currentCycleOvulation, 1);

    const upcomingCycles = [0, 1, 2].map((index) => {
      const start = addUtcDays(activeCycleStart, (index + 1) * cycleLength);
      const end = addUtcDays(start, periodLength - 1);
      const ovulation = addUtcDays(start, -14);
      const fertileStart = addUtcDays(ovulation, -5);
      const fertileEnd = addUtcDays(ovulation, 1);
      return {
        cycleNumber: index + 1,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        ovulationDate: ovulation.toISOString(),
        fertileStart: fertileStart.toISOString(),
        fertileEnd: fertileEnd.toISOString(),
      };
    });

    return {
      cycleLength,
      periodLength,
      lastPeriodDate: lmp.toISOString(),
      daysSinceLmp: diffDays,
      isFutureDate,
      currentCycleDay,
      currentPhase,
      nextPeriodDate: upcomingCycles[0].startDate,
      ovulationDate: currentCycleOvulation.toISOString(),
      fertileWindow: {
        start: currentFertileStart.toISOString(),
        end: currentFertileEnd.toISOString(),
      },
      upcomingCycles,
    };
  }

  /**
   * Calculate gestational age & trimester from LMP or Due Date
   */
  calculatePregnancyEstimate(params: { lmpDate?: string; dueDate?: string }) {
    let lmp: Date;
    let due: Date;

    if (params.lmpDate) {
      lmp = parseToUtcNoon(params.lmpDate);
      due = addUtcDays(lmp, 280);
    } else if (params.dueDate) {
      due = parseToUtcNoon(params.dueDate);
      lmp = addUtcDays(due, -280);
    } else {
      lmp = parseToUtcNoon(new Date());
      due = addUtcDays(lmp, 280);
    }

    const today = parseToUtcNoon(new Date());
    const rawElapsedDays = diffUtcDays(today, lmp);
    const elapsedDays = Math.max(0, Math.min(294, rawElapsedDays));
    const rangeStatus: 'normal' | 'future_lmp' | 'past_due_over_42w' =
      rawElapsedDays < 0
        ? 'future_lmp'
        : rawElapsedDays > 294
          ? 'past_due_over_42w'
          : 'normal';
    const weeks = Math.floor(elapsedDays / 7);
    const days = elapsedDays % 7;
    const daysRemaining = Math.max(0, diffUtcDays(due, today));
    const trimester = weeks <= 13 ? 1 : weeks <= 26 ? 2 : 3;
    const progressPercentage = Math.min(100, Math.max(0, Math.round((elapsedDays / 280) * 100)));

    return {
      lmpDate: lmp.toISOString(),
      dueDate: due.toISOString(),
      weeks,
      days,
      totalDays: elapsedDays,
      rawElapsedDays,
      isOutOfRange: rangeStatus !== 'normal',
      rangeStatus,
      daysRemaining,
      trimester,
      progressPercentage,
    };
  }
}
