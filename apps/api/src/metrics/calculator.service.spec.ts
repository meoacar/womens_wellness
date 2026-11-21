import { CalculatorService } from './calculator.service';

describe('CalculatorService', () => {
  let service: CalculatorService;

  beforeEach(() => {
    service = new CalculatorService();
  });

  describe('calculateBMI', () => {
    it('calculates BMI and classifies categories accurately', () => {
      expect(service.calculateBMI(50, 170)).toEqual({ bmi: 17.3, category: 'underweight' });
      expect(service.calculateBMI(65, 170)).toEqual({ bmi: 22.5, category: 'normal' });
      expect(service.calculateBMI(78, 170)).toEqual({ bmi: 27, category: 'overweight' });
      expect(service.calculateBMI(95, 170)).toEqual({ bmi: 32.9, category: 'obese' });
    });
  });

  describe('calculateBMR & calculateTDEE', () => {
    it('computes Mifflin-St Jeor BMR accurately for female and male', () => {
      // Female: 10*60 + 6.25*165 - 5*28 - 161 = 1330.25
      expect(service.calculateBMR(60, 165, 28, 'female')).toBeCloseTo(1330.25, 2);
      // Male: 10*80 + 6.25*180 - 5*30 + 5 = 1780
      expect(service.calculateBMR(80, 180, 30, 'male')).toBe(1780);
    });

    it('computes TDEE for all activity levels including legacy extreme alias without NaN', () => {
      const bmr = 1330.25;
      expect(service.calculateTDEE(bmr, 'sedentary')).toBe(Math.round(bmr * 1.2));
      expect(service.calculateTDEE(bmr, 'light')).toBe(Math.round(bmr * 1.375));
      expect(service.calculateTDEE(bmr, 'moderate')).toBe(Math.round(bmr * 1.55));
      expect(service.calculateTDEE(bmr, 'active')).toBe(Math.round(bmr * 1.725));
      expect(service.calculateTDEE(bmr, 'very_active')).toBe(Math.round(bmr * 1.9));
      expect(service.calculateTDEE(bmr, 'extreme')).toBe(Math.round(bmr * 1.9));
      expect(service.calculateTDEE(bmr, 'unknown' as any)).toBe(Math.round(bmr * 1.55));
    });
  });

  describe('calculateDailyWaterNeed', () => {
    it('computes daily water ml for standard and legacy mobile activity/climate keys', () => {
      // 60 * 33 * 1.15 + 250 = 2527
      expect(service.calculateDailyWaterNeed(60, 'moderate', 'temperate')).toBe(2527);
      // Legacy mobile keys: low -> sedentary (1.0), cold -> cool (0) => 60 * 33 = 1980
      expect(service.calculateDailyWaterNeed(60, 'low', 'cold')).toBe(1980);
      // Legacy mobile keys: high -> active (1.3), hot -> hot (500) => 60 * 33 * 1.3 + 500 = 3074
      expect(service.calculateDailyWaterNeed(60, 'high', 'hot')).toBe(3074);
      // Legacy mobile climate 'moderate' -> temperate (250)
      expect(service.calculateDailyWaterNeed(60, 'sedentary', 'moderate')).toBe(2230);
    });
  });

  describe('calculateCycleEstimate', () => {
    it('aligns ovulationDate to 14 days before nextPeriodDate and projects past cycles forward', () => {
      const now = new Date();
      const todayIso = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 14),
      )
        .toISOString()
        .split('T')[0];

      const est = service.calculateCycleEstimate({
        lastPeriodDate: todayIso,
        cycleLength: 28,
        periodLength: 5,
      });

      expect(est.currentCycleDay).toBe(15);
      expect(est.currentPhase).toBe('OVULATION');
      const nextPeriodMs = new Date(est.nextPeriodDate).getTime();
      const ovulationMs = new Date(est.ovulationDate).getTime();
      expect(Math.round((nextPeriodMs - ovulationMs) / (1000 * 60 * 60 * 24))).toBe(14);
      expect(est.upcomingCycles[0].startDate).toBe(est.nextPeriodDate);
    });

    it('projects nextPeriodDate into the future when multiple cycles have passed', () => {
      const now = new Date();
      const seventyDaysAgo = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 70),
      )
        .toISOString()
        .split('T')[0];

      const est = service.calculateCycleEstimate({
        lastPeriodDate: seventyDaysAgo,
        cycleLength: 28,
      });

      expect(new Date(est.nextPeriodDate).getTime()).toBeGreaterThan(now.getTime());
    });
  });

  describe('calculatePregnancyWeek & calculatePregnancyEstimate', () => {
    it('computes exact weeks and days without off-by-one drift', () => {
      const now = new Date();
      const sixDaysAgo = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6),
      );
      expect(service.calculatePregnancyWeek(sixDaysAgo)).toBe(0);

      const fourteenDaysAgo = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 14),
      );
      expect(service.calculatePregnancyWeek(fourteenDaysAgo)).toBe(2);

      const est = service.calculatePregnancyEstimate({
        lmpDate: sixDaysAgo.toISOString().split('T')[0],
      });
      expect(est.weeks).toBe(0);
      expect(est.days).toBe(6);
      expect(est.daysRemaining).toBe(274);
    });
  });
});
