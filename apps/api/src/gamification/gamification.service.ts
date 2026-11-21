import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GamificationService {
    constructor(private prisma: PrismaService) { }

    // Get or create user gamification profile
    async getUserGamification(userId: string) {
        let gamification = await this.prisma.userGamification.findUnique({
            where: { userId },
        });

        if (!gamification) {
            gamification = await this.prisma.userGamification.create({
                data: { userId },
            });
        }

        return gamification;
    }

    // Update streak
    async updateStreak(userId: string) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const gamification = await this.getUserGamification(userId);
        const lastActivity = gamification.lastActivityDate
            ? new Date(gamification.lastActivityDate)
            : null;

        if (lastActivity) {
            lastActivity.setHours(0, 0, 0, 0);
        }

        let newStreak = gamification.currentStreak;
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        // Check if last activity was yesterday (continue streak)
        if (lastActivity && lastActivity.getTime() === yesterday.getTime()) {
            newStreak += 1;
        }
        // Check if last activity was today (already logged today)
        else if (lastActivity && lastActivity.getTime() === today.getTime()) {
            return gamification; // No change needed
        }
        // Streak broken
        else if (lastActivity && lastActivity.getTime() < yesterday.getTime()) {
            newStreak = 1;
        }
        // First time or new streak
        else {
            newStreak = 1;
        }

        const longestStreak = Math.max(newStreak, gamification.longestStreak);

        return this.prisma.userGamification.update({
            where: { userId },
            data: {
                currentStreak: newStreak,
                longestStreak,
                lastActivityDate: today,
            },
        });
    }

    // Add XP and check for level up
    async addXp(userId: string, xpAmount: number) {
        const gamification = await this.getUserGamification(userId);
        const newTotalXp = gamification.totalXp + xpAmount;
        const newLevel = this.calculateLevel(newTotalXp);
        const xpForCurrentLevel = this.getXpForLevel(newLevel);
        const xpForNextLevel = this.getXpForLevel(newLevel + 1);
        const currentXp = newTotalXp - xpForCurrentLevel;

        const updated = await this.prisma.userGamification.update({
            where: { userId },
            data: {
                totalXp: newTotalXp,
                currentXp,
                level: newLevel,
            },
        });

        // Check if leveled up
        const leveledUp = newLevel > gamification.level;

        return {
            ...updated,
            leveledUp,
            xpGained: xpAmount,
            xpForNextLevel: xpForNextLevel - xpForCurrentLevel,
        };
    }

    // Calculate level from total XP
    private calculateLevel(totalXp: number): number {
        // Level formula: Level = floor(sqrt(totalXp / 100))
        // Level 1: 0-99 XP
        // Level 2: 100-399 XP
        // Level 3: 400-899 XP
        // etc.
        return Math.floor(Math.sqrt(totalXp / 100)) + 1;
    }

    // Get XP required for a specific level
    private getXpForLevel(level: number): number {
        return Math.pow(level - 1, 2) * 100;
    }

    // Increment data entry count
    async incrementDataEntry(
        userId: string,
        options?: { wellness?: boolean; symptomsCount?: number },
    ) {
        await this.getUserGamification(userId);
        await this.prisma.userGamification.update({
            where: { userId },
            data: {
                totalDataEntries: { increment: 1 },
                ...(options?.wellness ? { totalWellnessLogs: { increment: 1 } } : {}),
                ...(options?.symptomsCount && options.symptomsCount > 0
                    ? { totalSymptoms: { increment: options.symptomsCount } }
                    : {}),
            },
        });

        // Update streak
        await this.updateStreak(userId);

        // Add XP
        return this.addXp(userId, 5); // 5 XP per data entry
    }

    private getTodayUtcRange() {
        const now = new Date();
        const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
        const end = new Date(start);
        end.setUTCDate(end.getUTCDate() + 1);
        const dateKey = start.toISOString().split('T')[0];
        return { start, end, dateKey };
    }

    // Get today's 3 mini tasks & check-in state
    async getDailyTasks(userId: string) {
        const { start, end, dateKey } = this.getTodayUtcRange();
        const localStart = new Date();
        localStart.setHours(0, 0, 0, 0);
        const localEnd = new Date(localStart);
        localEnd.setDate(localEnd.getDate() + 1);

        const localMidnightUtc = new Date(
            Date.UTC(localStart.getFullYear(), localStart.getMonth(), localStart.getDate(), 0, 0, 0, 0),
        );
        const queryDates =
            localMidnightUtc.getTime() === start.getTime()
                ? [start]
                : [start, localMidnightUtc];
        const minDate = localMidnightUtc.getTime() < start.getTime() ? localMidnightUtc : start;

        const gamification = await this.getUserGamification(userId);

        const [todayLog, waterLogs, stepsRecord, meditationCount, sleepRecord] = await Promise.all([
            this.prisma.dailyLog.findFirst({
                where: { userId, date: { in: queryDates } },
                orderBy: { updatedAt: 'desc' },
            }),
            this.prisma.waterLog.findMany({
                where: { userId, loggedAt: { gte: localStart, lt: localEnd } },
            }),
            this.prisma.dailySteps.findFirst({
                where: { userId, date: { in: queryDates } },
                orderBy: { count: 'desc' },
            }),
            this.prisma.meditationSession.count({
                where: { userId, date: { gte: minDate, lt: end } },
            }),
            this.prisma.sleepLog.findFirst({
                where: { userId, sleepDate: { gte: new Date(minDate.getTime() - 24 * 60 * 60 * 1000), lt: end } },
            }),
        ]);

        const storedChallenge = (gamification.dailyChallengeJson as any) || {};
        const isSameChallengeDay = storedChallenge.dateKey === dateKey;
        const awardedTaskIds: string[] = isSameChallengeDay && Array.isArray(storedChallenge.awardedTaskIds)
            ? [...storedChallenge.awardedTaskIds]
            : [];
        let bonusAwarded = isSameChallengeDay ? Boolean(storedChallenge.bonusAwarded) : false;

        const waterTotalMl = waterLogs.reduce((sum, l) => sum + l.amountMl, 0);
        const hasCheckin = Boolean(
            todayLog &&
            ((todayLog.mood && todayLog.mood.length > 0) ||
                (todayLog.symptoms && todayLog.symptoms.length > 0) ||
                todayLog.healthNotes),
        );
        const hasWellness =
            (stepsRecord?.count ?? 0) > 0 || meditationCount > 0 || Boolean(sleepRecord);

        const tasks = [
            {
                id: 'checkin',
                title: '5 Saniyelik Check-in',
                description: 'Bugünkü ruh halini ve belirtilerini kaydet',
                xp: 15,
                completed: hasCheckin,
                actionRoute: '/(tabs)/home',
            },
            {
                id: 'water',
                title: 'En Az 1 Litre Su',
                description:
                    waterTotalMl >= 1000
                        ? `Bugün ${(waterTotalMl / 1000).toFixed(waterTotalMl % 1000 === 0 ? 0 : 1)} L (${waterTotalMl} ml) içildi`
                        : `Bugün ${waterTotalMl} / 1000 ml içildi`,
                xp: 10,
                completed: waterTotalMl >= 1000,
                actionRoute: '/water',
            },
            {
                id: 'wellness',
                title: 'Beden & Zihin Bakımı',
                description: 'Adım, uyku veya 4-7-8 nefes egzersizi kaydet',
                xp: 15,
                completed: hasWellness,
                actionRoute: '/wellness/meditation',
            },
        ];

        let xpAwardedNow = 0;
        for (const task of tasks) {
            if (task.completed && !awardedTaskIds.includes(task.id)) {
                awardedTaskIds.push(task.id);
                xpAwardedNow += task.xp;
            }
        }

        const allCompleted = tasks.every((t) => t.completed);
        if (allCompleted && !bonusAwarded) {
            bonusAwarded = true;
            xpAwardedNow += 20;
        }

        if (xpAwardedNow > 0 || !isSameChallengeDay) {
            await this.prisma.userGamification.update({
                where: { userId },
                data: {
                    dailyChallengeDate: start,
                    dailyChallengeJson: {
                        dateKey,
                        awardedTaskIds,
                        bonusAwarded,
                        checkinMeta: isSameChallengeDay ? storedChallenge.checkinMeta || null : null,
                    } as any,
                },
            });
            if (xpAwardedNow > 0) {
                await this.updateStreak(userId);
                await this.addXp(userId, xpAwardedNow);
            }
        }

        const latestStored = isSameChallengeDay ? storedChallenge : {};
        return {
            dateKey,
            completedCount: tasks.filter((t) => t.completed).length,
            totalCount: tasks.length,
            allCompleted,
            bonusXp: 20,
            bonusAwarded,
            tasks,
            todayCheckin: todayLog
                ? {
                    mood: todayLog.mood?.[0] || null,
                    symptoms: todayLog.symptoms || [],
                    note: todayLog.healthNotes || null,
                    energy: latestStored?.checkinMeta?.energy ?? null,
                }
                : null,
        };
    }

    // Submit quick daily check-in from Home screen
    async submitDailyCheckin(
        userId: string,
        body: {
            mood?: string;
            energy?: number;
            symptoms?: string[];
            water250?: boolean;
            note?: string;
        },
    ) {
        const { start, dateKey } = this.getTodayUtcRange();
        const existing = await this.prisma.dailyLog.findUnique({
            where: { userId_date: { userId, date: start } },
        });

        const moodArr = body.mood ? [body.mood] : existing?.mood || [];
        const symptomsArr = Array.isArray(body.symptoms) ? body.symptoms : existing?.symptoms || [];
        const healthNotes = body.note !== undefined ? body.note : existing?.healthNotes;

        await this.prisma.dailyLog.upsert({
            where: { userId_date: { userId, date: start } },
            create: {
                userId,
                date: start,
                mood: moodArr,
                symptoms: symptomsArr,
                healthNotes: healthNotes || undefined,
            },
            update: {
                mood: moodArr,
                symptoms: symptomsArr,
                healthNotes: healthNotes || undefined,
            },
        });

        if (body.water250) {
            await this.prisma.waterLog.create({
                data: {
                    userId,
                    amountMl: 200,
                    loggedAt: new Date(),
                },
            });
        }

        const gamification = await this.getUserGamification(userId);
        const prevChallenge = (gamification.dailyChallengeJson as any) || {};
        const prevMeta = prevChallenge.dateKey === dateKey ? prevChallenge : { dateKey, awardedTaskIds: [], bonusAwarded: false };

        await this.prisma.userGamification.update({
            where: { userId },
            data: {
                dailyChallengeDate: start,
                dailyChallengeJson: {
                    ...prevMeta,
                    dateKey,
                    checkinMeta: {
                        energy: body.energy ?? prevMeta?.checkinMeta?.energy ?? 3,
                        updatedAt: new Date().toISOString(),
                    },
                } as any,
            },
        });

        if (!existing) {
            await this.incrementDataEntry(userId, {
                wellness: Boolean(body.water250),
                symptomsCount: symptomsArr.length,
            });
        } else {
            await this.updateStreak(userId);
        }

        const summary = await this.getDailyTasks(userId);
        const stats = await this.getUserStats(userId);

        return {
            ...summary,
            streak: stats.currentStreak,
            level: stats.level,
            totalXp: stats.totalXp,
        };
    }

    // Get user stats
    async getUserStats(userId: string) {
        const gamification = await this.getUserGamification(userId);
        const [
            achievements,
            totalBadges,
            unreadInsights,
            dailyLogsCount,
            waterLogsCount,
            cyclesCount,
        ] = await Promise.all([
            this.prisma.userAchievement.findMany({
                where: { userId, isCompleted: true },
                include: { achievement: true },
                orderBy: { completedAt: 'desc' },
            }),
            this.prisma.achievement.count({ where: { isActive: true } }),
            this.prisma.userInsight.count({
                where: {
                    userId,
                    isRead: false,
                    OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
                },
            }),
            this.prisma.dailyLog.count({ where: { userId } }),
            this.prisma.waterLog.count({ where: { userId } }),
            this.prisma.periodCycle.count({ where: { userId } }),
        ]);

        const xpForNextLevel = this.getXpForLevel(gamification.level + 1);
        const xpForCurrentLevel = this.getXpForLevel(gamification.level);
        const xpNeeded = Math.max(0, xpForNextLevel - gamification.totalXp);
        const xpProgress = Math.max(0, gamification.totalXp - xpForCurrentLevel);
        const xpTotal = Math.max(1, xpForNextLevel - xpForCurrentLevel);

        return {
            ...gamification,
            totalDataEntries: Math.max(
                gamification.totalDataEntries,
                dailyLogsCount + waterLogsCount + cyclesCount,
            ),
            totalWellnessLogs: Math.max(gamification.totalWellnessLogs, waterLogsCount),
            achievements: achievements.length,
            totalBadges,
            unreadInsights,
            xpNeeded,
            xpProgress,
            xpTotal,
            levelProgress: Math.min(100, (xpProgress / xpTotal) * 100),
        };
    }

    // Reset user gamification data
    async resetUserGamification(userId: string) {
        // Delete all user achievements
        await this.prisma.userAchievement.deleteMany({
            where: { userId },
        });

        // Delete all user insights
        await this.prisma.userInsight.deleteMany({
            where: { userId },
        });

        // Reset gamification stats
        const gamification = await this.prisma.userGamification.findUnique({
            where: { userId },
        });

        if (gamification) {
            await this.prisma.userGamification.update({
                where: { userId },
                data: {
                    level: 1,
                    totalXp: 0,
                    currentXp: 0,
                    currentStreak: 0,
                    longestStreak: 0,
                    lastActivityDate: null,
                    totalDataEntries: 0,
                    totalSymptoms: 0,
                    totalWellnessLogs: 0,
                    dailyChallengeDate: null,
                    dailyChallengeJson: { set: null },
                },
            });
        }

        return { message: 'Gamification data reset successfully' };
    }
}
