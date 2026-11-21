import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CyclesService } from '../cycles/cycles.service';
import { WaterService } from '../water/water.service';
import { PregnancyService } from '../pregnancy/pregnancy.service';
import { WellnessService, WellnessSummary } from '../wellness/wellness.service';
import { DiscoverService } from '../discover/discover.service';

export interface HomeSnapshot {
  user: {
    displayName: string;
    profilePictureUrl?: string;
    lifeStage?: string;
  };
  streak: {
    current: number;
    longest: number;
    startDate?: Date;
  };
  todaySnapshot: {
    cycleDay?: number;
    cyclePhase?: {
      phase: 'MENSTRUAL' | 'FOLLICULAR' | 'OVULATION' | 'LUTEAL';
      title: string;
      summary: string;
      nutritionTip: string;
      exerciseTip: string;
      novaPrompt: string;
      color: string;
    };
    nextPeriodEstimate?: {
      date: Date;
      confidence: 'low' | 'medium' | 'high';
    };
    fertilityWindow?: {
      start: number;
      end: number;
    };
    ovulationEstimate?: Date;
    pregnancy?: {
      weeks: number;
      days: number;
      dueDate: Date;
    };
    waterProgress: {
      current: number; // mL
      target: number; // mL
      logs: number;
    };
    remindersToday: number;
    dataEntriesCount: number;
  };
  wellnessTiles?: WellnessSummary;
  priorityCards: PriorityCard[];
  educationalArticles: EducationalArticleDto[];
}

export interface PriorityCard {
  id: string;
  type: 'hydration' | 'cycle_insight' | 'medication' | 'reminder' | 'nova_prompt';
  priority: number;
  data: any;
  isDismissed: boolean;
  isPinned: boolean;
}

export interface EducationalArticleDto {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  tags: string[];
  imageUrl?: string;
  thumbnailUrl?: string;
  readTimeMin: number;
  publishedAt: Date;
  isSaved: boolean;
  isViewed: boolean;
}

@Injectable()
export class HomeService {
  constructor(
    private prisma: PrismaService,
    private cyclesService: CyclesService,
    private waterService: WaterService,
    private pregnancyService: PregnancyService,
    private wellnessService: WellnessService,
    private discoverService: DiscoverService,
  ) { }

  async getHomeSnapshot(userId: string, locale: string = 'tr'): Promise<HomeSnapshot> {
    // Get user profile
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true, homePreferences: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Get or create home preferences
    let preferences = user.homePreferences;
    if (!preferences) {
      preferences = await this.prisma.userHomePreferences.create({
        data: { userId },
      });
    }

    // Calculate water streak
    const streak = await this.calculateWaterStreak(userId, preferences);

    // Get today's snapshot data
    const todaySnapshot = await this.getTodaySnapshot(userId);

    // Get priority cards
    const priorityCards = await this.getPriorityCards(userId, preferences);

    // Get educational articles with personalization
    const educationalArticles = await this.getEducationalArticles(userId, locale);

    // Get wellness tiles summary
    const wellnessTiles = await this.wellnessService.getWellnessSummary(userId);

    return {
      user: {
        displayName: user.profile?.displayName || user.email.split('@')[0],
        profilePictureUrl: user.profile?.profilePictureUrl || undefined,
        lifeStage: user.profile?.lifeStage || 'CYCLE',
      },
      streak,
      todaySnapshot,
      wellnessTiles,
      priorityCards,
      educationalArticles,
    };
  }

  private async calculateWaterStreak(userId: string, preferences: any): Promise<{
    current: number;
    longest: number;
    startDate?: Date;
  }> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    // Check if user has logged in today
    const lastLoginDate = preferences.updatedAt ? new Date(preferences.updatedAt) : null;
    const lastLoginDateOnly = lastLoginDate
      ? new Date(lastLoginDate.getFullYear(), lastLoginDate.getMonth(), lastLoginDate.getDate(), 0, 0, 0, 0)
      : null;
    const todayDateOnly = today;

    let currentStreak = preferences.streakCount || 0;
    let longestStreak = preferences.longestStreak || 0;
    let streakStartDate = preferences.streakStartDate || null;

    // For users with no streak (brand new or existing with streak=0), initialize streak
    if (currentStreak === 0) {
      currentStreak = 1;
      longestStreak = 1;
      streakStartDate = today;

      await this.prisma.userHomePreferences.update({
        where: { userId },
        data: {
          streakCount: currentStreak,
          longestStreak,
          streakStartDate,
          updatedAt: new Date(),
        },
      });
    }
    // If this is a new day (first visit of the day)
    else if (lastLoginDateOnly && lastLoginDateOnly < todayDateOnly) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayDateOnly = yesterday;

      // Check if the user logged in yesterday (streak continues)
      if (lastLoginDateOnly.getTime() === yesterdayDateOnly.getTime()) {
        // Continue streak
        currentStreak++;
      }
      // Streak broken - start new streak
      else if (lastLoginDateOnly < yesterdayDateOnly) {
        currentStreak = 1;
        streakStartDate = today;
      }

      // Update longest streak if needed
      longestStreak = Math.max(currentStreak, longestStreak);

      // Update preferences with new streak info
      await this.prisma.userHomePreferences.update({
        where: { userId },
        data: {
          streakCount: currentStreak,
          longestStreak,
          streakStartDate,
          updatedAt: new Date(), // This marks the login
        },
      });
    }

    return {
      current: currentStreak,
      longest: longestStreak,
      startDate: streakStartDate || undefined,
    };
  }

  private async getTodaySnapshot(userId: string) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get cycle data
    const cycles = await this.cyclesService.getCycles(userId);
    let cycleDay: number | undefined;
    let nextPeriodEstimate;

    if (cycles && cycles.length > 0) {
      const latestCycle = cycles[0];
      const cycleStart = new Date(latestCycle.startDate);
      cycleDay = Math.floor((today.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      // Simple prediction based on average cycle length
      if (cycles.length >= 3) {
        const completedCycles = cycles.filter(c => c.endDate);
        if (completedCycles.length >= 2) {
          const avgCycleLength = completedCycles.reduce((sum, c) => {
            const start = new Date(c.startDate);
            const end = new Date(c.endDate!);
            return sum + Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          }, 0) / completedCycles.length;

          const variance = completedCycles.reduce((sum, c) => {
            const start = new Date(c.startDate);
            const end = new Date(c.endDate!);
            const cycleLength = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
            return sum + Math.abs(cycleLength - avgCycleLength);
          }, 0) / completedCycles.length;

          const estimatedNextPeriod = new Date(cycleStart);
          estimatedNextPeriod.setDate(estimatedNextPeriod.getDate() + Math.round(avgCycleLength));

          let confidence: 'low' | 'medium' | 'high' = 'low';
          if (variance < 2) confidence = 'high';
          else if (variance < 4) confidence = 'medium';

          nextPeriodEstimate = {
            date: estimatedNextPeriod,
            confidence,
          };
        }
      }
    }

    // Get pregnancy data
    let pregnancy;
    const pregnancyRecord = await this.pregnancyService.getPregnancy(userId);
    if (pregnancyRecord && pregnancyRecord.isActive) {
      const lmpDate = new Date(pregnancyRecord.lmpDate || pregnancyRecord.dueDate!);
      lmpDate.setDate(lmpDate.getDate() - 280); // Calculate LMP from due date if needed

      const daysSinceLMP = Math.floor((today.getTime() - lmpDate.getTime()) / (1000 * 60 * 60 * 24));
      const weeks = Math.floor(daysSinceLMP / 7);
      const days = daysSinceLMP % 7;

      pregnancy = {
        weeks,
        days,
        dueDate: pregnancyRecord.dueDate || new Date(),
      };
    }

    // Get water progress
    const waterToday = await this.waterService.getTodayTotal(userId);

    // Get user profile for water target
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
    });

    const waterTarget = profile?.weightKg ? Math.round(profile.weightKg * 30) : 2000; // 30ml per kg or default 2L

    // Get reminders count for today
    const [remindersToday, dailyLogsCount, totalWaterCount] = await Promise.all([
      this.prisma.reminder.count({
        where: {
          userId,
          active: true,
          nextRunAt: {
            gte: today,
            lt: tomorrow,
          },
        },
      }),
      this.prisma.dailyLog.count({ where: { userId } }),
      this.prisma.waterLog.count({ where: { userId } }),
    ]);

    const cyclePhase = this.getCyclePhaseGuidance(cycleDay);

    return {
      cycleDay,
      cyclePhase,
      nextPeriodEstimate,
      pregnancy,
      waterProgress: {
        current: waterToday.totalMl,
        target: waterTarget,
        logs: waterToday.logs.length,
      },
      remindersToday,
      dataEntriesCount: dailyLogsCount + totalWaterCount + (cycles?.length || 0),
    };
  }

  private getCyclePhaseGuidance(cycleDay?: number) {
    if (!cycleDay || cycleDay < 1 || cycleDay > 45) return undefined;
    if (cycleDay <= 5) {
      return {
        phase: 'MENSTRUAL' as const,
        title: 'Menstrual Faz (Dinlenme & Yenilenme)',
        summary: `Döngünün ${cycleDay}. günü. Enerji seviyen daha düşük olabilir; bedenine nazik davran.`,
        nutritionTip: 'Demir ve magnezyum zengini besinler (ıspanak, mercimek, bitter çikolata) ve ılık bitki çayları tercih et.',
        exerciseTip: 'Hafif yürüyüş, esneme veya kramp rahatlatıcı 4-7-8 nefes egzersizi idealdir.',
        novaPrompt: `Döngümün ${cycleDay}. günündeyim (Menstrual faz). Kramp ve yorgunluğu azaltacak bugüne özel beslenme ve bakım önerisi ver.`,
        color: '#EC4899',
      };
    }
    if (cycleDay <= 13) {
      return {
        phase: 'FOLLICULAR' as const,
        title: 'Foliküler Faz (Yükselen Enerji)',
        summary: `Döngünün ${cycleDay}. günü. Östrojen yükselişiyle odak ve motivasyon artışı başlar.`,
        nutritionTip: 'Taze yeşillikler, probiyotikler ve dengeli proteinlerle enerjini destekle.',
        exerciseTip: 'Tempolu yürüyüş, dans, pilates veya yeni hedefler için harika bir dönem.',
        novaPrompt: `Döngümün ${cycleDay}. günündeyim (Foliküler faz). Yüksek enerjimi verimli kullanmak için bugüne özel egzersiz ve beslenme planı öner.`,
        color: '#8B5CF6',
      };
    }
    if (cycleDay <= 16) {
      return {
        phase: 'OVULATION' as const,
        title: 'Ovulasyon Fazı (Zirve & İletişim)',
        summary: `Döngünün ${cycleDay}. günü. Sosyal enerji ve fiziksel canlılık en yüksek noktadadır.`,
        nutritionTip: 'Antioksidan meyveler, çiğ kuruyemişler ve bol su tüketimini ihmal etme.',
        exerciseTip: 'Kardiyo, güç antrenmanı veya açık hava aktiviteleri için en uygun zaman.',
        novaPrompt: `Döngümün ${cycleDay}. günündeyim (Ovulasyon fazı). Bu dönemde su ihtiyacı ve vücut sinyallerim için nelere dikkat etmeliyim?`,
        color: '#10B981',
      };
    }
    return {
      phase: 'LUTEAL' as const,
      title: 'Luteal Faz (Denge & Özen)',
      summary: `Döngünün ${cycleDay}. günü. Progesteron yükselirken şişkinlik veya tatlı isteği görülebilir.`,
      nutritionTip: 'Kompleks karbonhidratlar (yulaf, kinoa), B6 vitamini ve tuz dengesine dikkat et.',
      exerciseTip: 'Orta tempolu pilates, yoga ve akşam uyku hijyenini destekleyen nefes çalışmaları iyi gelir.',
      novaPrompt: `Döngümün ${cycleDay}. günündeyim (Luteal faz). PMS hassasiyeti ve tatlı isteğini dengelemek için öneriler paylaş.`,
      color: '#F59E0B',
    };
  }

  private async getPriorityCards(userId: string, preferences: any): Promise<PriorityCard[]> {
    const cards: PriorityCard[] = [];
    const dismissedCards = (preferences.dismissedCards as any) || {};
    const pinnedCards = preferences.pinnedCards || [];
    const now = new Date();

    // Get start of today for daily reset logic
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // Check which cards are dismissed (and not expired)
    const isDismissed = (cardId: string) => {
      const dismissedUntil = dismissedCards[cardId];
      if (!dismissedUntil) return false;
      const dismissedDate = new Date(dismissedUntil);

      // Check if dismissal has expired
      return dismissedDate > now;
    };

    // Get today snapshot for card data
    const snapshot = await this.getTodaySnapshot(userId);

    // Cycle insight card
    if (snapshot.nextPeriodEstimate) {
      const daysUntilPeriod = Math.floor(
        (snapshot.nextPeriodEstimate.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (Math.abs(daysUntilPeriod) <= 5) {
        cards.push({
          id: 'cycle_insight',
          type: 'cycle_insight',
          priority: 90,
          data: {
            estimate: snapshot.nextPeriodEstimate,
            daysUntil: daysUntilPeriod,
            cycleDay: snapshot.cycleDay,
          },
          isDismissed: isDismissed('cycle_insight'),
          isPinned: pinnedCards.includes('cycle_insight'),
        });
      }
    }

    // Reminders card
    if (snapshot.remindersToday > 0) {
      const nextReminder = await this.prisma.reminder.findFirst({
        where: {
          userId,
          active: true,
          nextRunAt: { gte: now },
        },
        orderBy: { nextRunAt: 'asc' },
      });

      if (nextReminder) {
        const hoursUntil = (nextReminder.nextRunAt.getTime() - now.getTime()) / (1000 * 60 * 60);

        cards.push({
          id: 'reminder',
          type: 'reminder',
          priority: hoursUntil < 3 ? 95 : 70,
          data: {
            count: snapshot.remindersToday,
            next: nextReminder,
          },
          isDismissed: isDismissed('reminder'),
          isPinned: pinnedCards.includes('reminder'),
        });
      }
    }

    // NOVA smart prompt (low priority, once per day)
    const lastNovaPrompt = dismissedCards['nova_prompt'];
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    if (!lastNovaPrompt || new Date(lastNovaPrompt) < oneDayAgo) {
      const proactivePrompt = await this.getProactiveNovaInsight(userId, snapshot);
      cards.push({
        id: 'nova_prompt',
        type: 'nova_prompt',
        priority: 50,
        data: {
          prompt: proactivePrompt,
        },
        isDismissed: false,
        isPinned: pinnedCards.includes('nova_prompt'),
      });
    }

    // Sort cards: pinned first, then by priority, filter dismissed
    return cards
      .filter(card => !card.isDismissed)
      .sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return b.priority - a.priority;
      });
  }

  private async getProactiveNovaInsight(userId: string, snapshot: any): Promise<string> {
    try {
      const profile = await this.prisma.profile.findUnique({
        where: { userId },
        select: { lifeStage: true },
      });

      if (profile?.lifeStage === 'POSTPARTUM') {
        return 'Anne & Bebek modundasın: Emzirme dönemi beslenme, sıvı dengesi ve lohusa uykusu için NOVA’dan kişisel öneri alabilirsin.';
      }

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentSleeps = await this.prisma.sleepLog.findMany({
        where: { userId, sleepDate: { gte: sevenDaysAgo } },
        select: { durationMin: true },
      });
      if (recentSleeps.length >= 2) {
        const avgHours =
          recentSleeps.reduce((s, x) => s + x.durationMin, 0) / recentSleeps.length / 60;
        if (avgHours < 6.5) {
          return `Son 7 günde uyku ortalaman ${avgHours.toFixed(1)} saat. Döngü fazına uygun akşam uyku rutini için NOVA’ya sor.`;
        }
      }

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recentCycleLogs = await this.prisma.dailyLog.findMany({
        where: { userId, date: { gte: thirtyDaysAgo } },
        select: { symptoms: true },
      });
      const symptomCounts: Record<string, number> = {};
      for (const log of recentCycleLogs) {
        for (const sym of log.symptoms || []) {
          symptomCounts[sym] = (symptomCounts[sym] || 0) + 1;
        }
      }
      const topSymptom = Object.entries(symptomCounts).sort((a, b) => b[1] - a[1])[0];
      if (topSymptom && topSymptom[1] >= 3) {
        return `Son 30 günde ${topSymptom[1]} kez "${topSymptom[0]}" kaydı ekledin. Doğal rahatlama ve beslenme önerileri için NOVA’ya sor.`;
      }
    } catch {
      // Fall back to contextual prompt
    }
    return this.getNovaPrompt(snapshot);
  }

  private getNovaPrompt(snapshot: any): string {
    // Generate contextual prompts based on user data
    const prompts = [
      'Bugün nasıl hissediyorsun? Enerji durumunu kaydetmek ister misin?',
      'Su içmeyi unutma! Hedefine ulaşmak için biraz daha içmelisin.',
      'Döngünü takip etmek sağlığın için önemli. Son durumunu kaydedelim mi?',
    ];

    if (snapshot.waterProgress.current < snapshot.waterProgress.target * 0.5) {
      return 'Su tüketimin hedefinin yarısının altında. Biraz su içmek için zamanı geldi! 💧';
    }

    if (snapshot.nextPeriodEstimate) {
      const daysUntil = Math.floor(
        (snapshot.nextPeriodEstimate.date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntil <= 2) {
        return 'Regl döneminiz yaklaşıyor. Kendine iyi bak! 💕';
      }
    }

    return prompts[Math.floor(Math.random() * prompts.length)];
  }

  private async getEducationalArticles(userId: string, locale: string): Promise<EducationalArticleDto[]> {
    // Use DiscoverService to get personalized home feed
    // This integrates the recommendation engine and user interaction status
    const articles = await this.discoverService.getHomeFeed(userId, locale, 5);

    return articles;
  }

  async dismissCard(userId: string, cardId: string, days: number = 7): Promise<void> {
    const preferences = await this.prisma.userHomePreferences.findUnique({
      where: { userId },
    });

    if (!preferences) {
      await this.prisma.userHomePreferences.create({
        data: { userId },
      });
    }

    const dismissedCards = (preferences?.dismissedCards as any) || {};
    const dismissUntil = new Date();

    // Dismiss cards until end of today - they will reappear tomorrow
    dismissUntil.setHours(23, 59, 59, 999);

    dismissedCards[cardId] = dismissUntil.toISOString();

    await this.prisma.userHomePreferences.update({
      where: { userId },
      data: { dismissedCards },
    });
  }

  async pinCard(userId: string, cardId: string): Promise<void> {
    const preferences = await this.prisma.userHomePreferences.findUnique({
      where: { userId },
    });

    const pinnedCards = preferences?.pinnedCards || [];
    if (!pinnedCards.includes(cardId)) {
      pinnedCards.push(cardId);

      await this.prisma.userHomePreferences.upsert({
        where: { userId },
        create: {
          userId,
          pinnedCards,
        },
        update: {
          pinnedCards,
        },
      });
    }
  }

  async unpinCard(userId: string, cardId: string): Promise<void> {
    const preferences = await this.prisma.userHomePreferences.findUnique({
      where: { userId },
    });

    if (preferences) {
      const pinnedCards = preferences.pinnedCards.filter(id => id !== cardId);

      await this.prisma.userHomePreferences.update({
        where: { userId },
        data: { pinnedCards },
      });
    }
  }

  async setVisiblePills(userId: string, pillIds: string[]): Promise<void> {
    await this.prisma.userHomePreferences.upsert({
      where: { userId },
      create: {
        userId,
        visiblePills: pillIds,
      },
      update: {
        visiblePills: pillIds,
      },
    });
  }
}
