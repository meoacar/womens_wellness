import { NativeModules, Platform } from 'react-native';
import { getZodiacSign, ZODIAC_SIGNS } from '../utils/astrology';

const KadinAtlasiWidget = NativeModules.KadinAtlasiWidget as
  | {
      updateWidgetData: (data: Record<string, string | number>) => void;
      clearWidgetData: () => void;
      consumePendingRoute?: () => Promise<string | null>;
    }
  | undefined;

export interface WidgetSnapshotInput {
  streak?: {
    current: number;
    longest: number;
  };
  todaySnapshot?: {
    cycleDay?: number;
    cyclePhase?: {
      phase: 'MENSTRUAL' | 'FOLLICULAR' | 'OVULATION' | 'LUTEAL';
      title: string;
      summary: string;
    };
    nextPeriodEstimate?: {
      date: string;
    };
    pregnancy?: {
      weeks: number;
      days: number;
      dueDate: string;
    };
    waterProgress?: {
      current: number;
      target: number;
    };
    remindersToday?: number;
  };
  wellnessTiles?: {
    steps?: {
      today: number;
      goal: number;
    } | null;
    meditation?: {
      todayMin: number;
      goalMin: number;
    } | null;
  };
}

const formatNum = (val: number): string =>
  new Intl.NumberFormat('tr-TR').format(Math.max(0, Math.round(val)));

const getNowTimeText = (): string => {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

const getDaysUntilDate = (isoDate?: string): number | null => {
  if (!isoDate) return null;
  const target = new Date(isoDate);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  const targetMid = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((targetMid.getTime() - todayMid.getTime()) / (1000 * 60 * 60 * 24));
};

class WidgetSyncService {
  private lastStepsGoal = 7000;

  public syncFromSnapshot(
    snapshot: WidgetSnapshotInput,
    autoSteps = 0,
    dateOfBirth?: string | null,
  ): void {
    if (Platform.OS !== 'android' || !KadinAtlasiWidget?.updateWidgetData) {
      return;
    }

    const t = snapshot.todaySnapshot;
    const stepsToday = Math.max(snapshot.wellnessTiles?.steps?.today || 0, autoSteps);
    const stepsGoal = snapshot.wellnessTiles?.steps?.goal || this.lastStepsGoal || 7000;
    this.lastStepsGoal = stepsGoal;

    const stepsPct =
      stepsGoal > 0 ? Math.min(100, Math.round((stepsToday / stepsGoal) * 100)) : 0;

    const waterCurrent = t?.waterProgress?.current || 0;
    const waterTarget = t?.waterProgress?.target || 2000;
    const waterPct =
      waterTarget > 0 ? Math.min(100, Math.round((waterCurrent / waterTarget) * 100)) : 0;

    const medToday = snapshot.wellnessTiles?.meditation?.todayMin || 0;
    const medGoal = snapshot.wellnessTiles?.meditation?.goalMin || 10;
    const streakCount = snapshot.streak?.current || 0;

    let phaseLabel = 'Döngü Takibi';
    let headline = 'Bugünkü sağlık özetin';
    let subline = 'Takvim ve günlük kayıtların güncel';
    let cycleValue = '-';
    let cycleSub = 'Takvimi aç';
    let cycleBigValue = '-';
    let cycleBigSub = 'Takvimi açarak tarih ekle';
    let cycleFooter = 'Takvime Git →';

    if (t?.pregnancy) {
      phaseLabel = 'Hamilelik';
      headline = `${t.pregnancy.weeks}. Hafta ${t.pregnancy.days}. Gün`;
      const dueStr = t.pregnancy.dueDate
        ? new Date(t.pregnancy.dueDate).toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'long',
          })
        : '';
      subline = dueStr ? `Tahmini doğum: ${dueStr}` : 'Hamilelik takibin aktif';
      cycleValue = `${t.pregnancy.weeks}h ${t.pregnancy.days}g`;
      cycleSub = 'gebelik';
      cycleBigValue = `${t.pregnancy.weeks}. Hafta`;
      cycleBigSub = dueStr ? `Tahmini: ${dueStr}` : `${t.pregnancy.days}. gün`;
      cycleFooter = 'Hamilelik Takibi →';
    } else if (t?.cycleDay || t?.cyclePhase || t?.nextPeriodEstimate) {
      const daysUntil = getDaysUntilDate(t?.nextPeriodEstimate?.date);
      const nextDateStr = t?.nextPeriodEstimate?.date
        ? new Date(t.nextPeriodEstimate.date).toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'short',
          })
        : '';

      if (t?.cyclePhase?.title) {
        phaseLabel = t.cyclePhase.title;
      } else if (t?.cycleDay) {
        phaseLabel = `Döngü ${t.cycleDay}. Gün`;
      }

      if (t?.cyclePhase?.phase === 'MENSTRUAL' && t?.cycleDay) {
        headline = `Regl döneminin ${t.cycleDay}. günü`;
        cycleBigValue = `${t.cycleDay}. Gün`;
        cycleBigSub = 'Regl dönemin devam ediyor';
      } else if (daysUntil !== null) {
        if (daysUntil > 0) {
          headline = `Sonraki regle ${daysUntil} gün`;
          cycleBigValue = `${daysUntil} gün`;
          cycleBigSub = nextDateStr ? `Tahmin: ${nextDateStr}` : 'Sonraki regle kalan';
        } else if (daysUntil === 0) {
          headline = 'Tahmini regl başlangıcı bugün';
          cycleBigValue = 'Bugün';
          cycleBigSub = 'Tahmini regl başlangıcı';
        } else {
          headline = `Tahmini tarih ${Math.abs(daysUntil)} gün geçti`;
          cycleBigValue = `+${Math.abs(daysUntil)} gün`;
          cycleBigSub = 'Tahmini başlangıç geçti';
        }
      } else if (t?.cycleDay) {
        headline = `Döngünün ${t.cycleDay}. günündesin`;
        cycleBigValue = `${t.cycleDay}. Gün`;
        cycleBigSub = 'Aktif döngü günü';
      }

      if (t?.cyclePhase?.summary) {
        subline = t.cyclePhase.summary;
      } else if (nextDateStr) {
        subline = `Tahmini sonraki başlangıç: ${nextDateStr}`;
      }

      if (daysUntil !== null && daysUntil >= 0 && t?.cyclePhase?.phase !== 'MENSTRUAL') {
        cycleValue = `${daysUntil} gün`;
        cycleSub = nextDateStr ? `tahmin ${nextDateStr}` : 'regle kalan';
      } else if (t?.cycleDay) {
        cycleValue = `${t.cycleDay}. Gün`;
        cycleSub = t?.cyclePhase?.phase === 'MENSTRUAL' ? 'regl dönemi' : 'döngü günü';
      }
      cycleFooter = t?.cycleDay ? `Döngü ${t.cycleDay}. Gün →` : 'Takvime Git →';
    }

    let zodiacBadge = '✨ Astroloji';
    let astroSignValue = 'Günlük Burç';
    if (dateOfBirth) {
      try {
        const sign = getZodiacSign(dateOfBirth);
        const info = ZODIAC_SIGNS[sign];
        if (info) {
          zodiacBadge = `${info.emoji} ${info.nameTr}`;
          astroSignValue = `${info.emoji} ${info.nameTr}`;
        }
      } catch {
        // Fallback
      }
    }

    const streakBadge = streakCount > 0 ? `🔥 ${streakCount} gün seri` : '✨ Günlük seri';
    const mindHeadline =
      t?.cyclePhase?.summary ||
      'Kendine birkaç dakikalık nefes ve farkındalık molası ayır.';

    try {
      KadinAtlasiWidget.updateWidgetData({
        phaseLabel,
        headline,
        subline,
        cycleValue,
        cycleSub,
        cycleBigValue,
        cycleBigSub,
        cycleFooter,
        waterValue: `${formatNum(waterCurrent)} ml`,
        waterSub: `/ ${formatNum(waterTarget)} ml`,
        waterPct,
        stepsValue: formatNum(stepsToday),
        stepsSub: `/ ${formatNum(stepsGoal)} adım`,
        stepsPct,
        zodiacBadge,
        streakBadge,
        mindHeadline,
        astroSignValue,
        meditationText: `${medToday} / ${medGoal} dk`,
        updatedAt: getNowTimeText(),
      });
    } catch {
      // Ignore native widget failures
    }
  }

  public syncStepsOnly(stepsToday: number, stepsGoal?: number): void {
    if (Platform.OS !== 'android' || !KadinAtlasiWidget?.updateWidgetData) {
      return;
    }
    const goal = stepsGoal || this.lastStepsGoal || 7000;
    this.lastStepsGoal = goal;
    const stepsPct = goal > 0 ? Math.min(100, Math.round((stepsToday / goal) * 100)) : 0;

    try {
      KadinAtlasiWidget.updateWidgetData({
        stepsValue: formatNum(stepsToday),
        stepsSub: `/ ${formatNum(goal)} adım`,
        stepsPct,
        updatedAt: getNowTimeText(),
      });
    } catch {
      // Ignore
    }
  }

  public async consumePendingRoute(): Promise<string | null> {
    if (Platform.OS !== 'android' || !KadinAtlasiWidget?.consumePendingRoute) {
      return null;
    }
    try {
      return await KadinAtlasiWidget.consumePendingRoute();
    } catch {
      return null;
    }
  }

  public clear(): void {
    if (Platform.OS !== 'android' || !KadinAtlasiWidget?.clearWidgetData) {
      return;
    }
    try {
      KadinAtlasiWidget.clearWidgetData();
    } catch {
      // Ignore
    }
  }
}

export const widgetSyncService = new WidgetSyncService();
