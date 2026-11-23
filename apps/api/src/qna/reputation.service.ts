import { Injectable, NotFoundException, Optional, forwardRef, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserReputation, Badge, ReputationHistory } from '@prisma/client';
import { QnaNotificationService } from './qna-notification.service';
import { GamificationService } from '../gamification/gamification.service';
import { CommunitySettingsService } from './community-settings.service';

export enum ReputationReason {
    BEST_ANSWER_SELECTED = 'BEST_ANSWER_SELECTED',
    ANSWER_UPVOTED = 'ANSWER_UPVOTED',
    ANSWER_DOWNVOTED = 'ANSWER_DOWNVOTED',
    QUESTION_UPVOTED = 'QUESTION_UPVOTED',
    QUESTION_DOWNVOTED = 'QUESTION_DOWNVOTED',
    QUESTION_ASKED = 'QUESTION_ASKED',
    ANSWER_GIVEN = 'ANSWER_GIVEN',
}

export const REPUTATION_POINTS = {
    [ReputationReason.BEST_ANSWER_SELECTED]: 15,
    [ReputationReason.ANSWER_UPVOTED]: 5,
    [ReputationReason.ANSWER_DOWNVOTED]: -2,
    [ReputationReason.QUESTION_UPVOTED]: 3,
    [ReputationReason.QUESTION_DOWNVOTED]: -1,
    [ReputationReason.QUESTION_ASKED]: 5,
    [ReputationReason.ANSWER_GIVEN]: 10,
};

export interface ReputationDetail extends UserReputation {
    user: {
        id: string;
        username: string | null;
        profile: {
            displayName: string;
            profilePictureUrl: string | null;
        } | null;
    };
    badges: Array<{
        id: string;
        badge: Badge;
        earnedAt: Date;
    }>;
}

export interface LeaderboardEntry {
    userId: string;
    username: string | null;
    displayName: string;
    profilePictureUrl: string | null;
    totalPoints: number;
    questionsAsked: number;
    answersGiven: number;
    bestAnswers: number;
    upvotesReceived: number;
    rank: number;
}

@Injectable()
export class ReputationService {
    constructor(
        private prisma: PrismaService,
        @Inject(forwardRef(() => QnaNotificationService))
        private notificationService: QnaNotificationService,
        @Optional() private gamificationService?: GamificationService,
        @Optional() private communitySettings?: CommunitySettingsService,
    ) { }

    /**
     * Get or create user reputation record
     */
    async getOrCreateReputation(userId: string): Promise<UserReputation> {
        let reputation = await this.prisma.userReputation.findUnique({
            where: { userId },
        });

        if (!reputation) {
            reputation = await this.prisma.userReputation.create({
                data: { userId },
            });
        }

        return reputation;
    }

    /**
     * Add reputation points to user
     */
    async addReputationPoints(
        userId: string,
        reason: ReputationReason,
        metadata?: any,
    ): Promise<UserReputation> {
        let points = REPUTATION_POINTS[reason];
        let xpMultiplier = 1;
        if (this.communitySettings) {
            const settings = await this.communitySettings.getSettings().catch(() => null);
            if (settings) {
                xpMultiplier = settings.xpPerReputationPoint;
                if (reason === ReputationReason.QUESTION_ASKED) points = settings.pointsPerQuestion;
                else if (reason === ReputationReason.ANSWER_GIVEN) points = settings.pointsPerAnswer;
                else if (reason === ReputationReason.BEST_ANSWER_SELECTED) points = settings.pointsPerBestAnswer;
            }
        }

        const reputation = await this.getOrCreateReputation(userId);

        // Update reputation
        const updatedReputation = await this.prisma.userReputation.update({
            where: { userId },
            data: {
                totalPoints: { increment: points },
                ...(reason === ReputationReason.BEST_ANSWER_SELECTED && {
                    bestAnswers: { increment: 1 },
                }),
                ...(reason === ReputationReason.ANSWER_UPVOTED && {
                    upvotesReceived: { increment: 1 },
                }),
            },
        });

        // Create history record
        await this.prisma.reputationHistory.create({
            data: {
                reputationId: reputation.id,
                points,
                reason,
                metadata: metadata || {},
            },
        });

        // Also award proportional Gamification XP when points > 0
        if (points > 0 && xpMultiplier > 0 && this.gamificationService) {
            const xp = Math.round(points * xpMultiplier);
            if (xp > 0) {
                await this.gamificationService.addXp(userId, xp).catch(() => null);
            }
        }

        // Check and award badges
        await this.checkAndAwardBadges(userId);

        return updatedReputation;
    }

    /**
     * Calculate total reputation for a user
     */
    async calculateReputation(userId: string): Promise<number> {
        const reputation = await this.getOrCreateReputation(userId);
        return reputation.totalPoints;
    }

    /**
     * Get user reputation details
     */
    async getUserReputation(userId: string): Promise<ReputationDetail> {
        await this.getOrCreateReputation(userId);
        const reputation = await this.prisma.userReputation.findUnique({
            where: { userId },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        profile: {
                            select: {
                                displayName: true,
                                profilePictureUrl: true,
                            },
                        },
                    },
                },
                badges: {
                    include: {
                        badge: true,
                    },
                    orderBy: {
                        earnedAt: 'desc',
                    },
                },
            },
        });

        if (!reputation) {
            throw new NotFoundException('User reputation not found');
        }

        return reputation as ReputationDetail;
    }

    /**
     * Get reputation history for a user
     */
    async getReputationHistory(
        userId: string,
        limit: number = 50,
    ): Promise<ReputationHistory[]> {
        const reputation = await this.getOrCreateReputation(userId);

        return this.prisma.reputationHistory.findMany({
            where: { reputationId: reputation.id },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    }

    /**
     * Get leaderboard
     */
    async getLeaderboard(limit: number = 50): Promise<LeaderboardEntry[]> {
        const topUsers = await this.prisma.userReputation.findMany({
            where: {
                totalPoints: { gt: 0 },
            },
            orderBy: {
                totalPoints: 'desc',
            },
            take: limit,
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        profile: {
                            select: {
                                displayName: true,
                                profilePictureUrl: true,
                            },
                        },
                    },
                },
            },
        });

        return topUsers.map((rep, index) => ({
            userId: rep.user.id,
            username: rep.user.username,
            displayName: rep.user.profile?.displayName || 'Unknown',
            profilePictureUrl: rep.user.profile?.profilePictureUrl || null,
            totalPoints: rep.totalPoints,
            questionsAsked: rep.questionsAsked,
            answersGiven: rep.answersGiven,
            bestAnswers: rep.bestAnswers,
            upvotesReceived: rep.upvotesReceived,
            rank: index + 1,
        }));
    }

    /**
     * Get all available badges
     */
    async getAllBadges(): Promise<Badge[]> {
        return this.prisma.badge.findMany({
            orderBy: {
                createdAt: 'asc',
            },
        });
    }

    /**
     * Get user's earned badges
     */
    async getUserBadges(userId: string): Promise<Badge[]> {
        const reputation = await this.getOrCreateReputation(userId);

        const userBadges = await this.prisma.userBadge.findMany({
            where: { reputationId: reputation.id },
            include: {
                badge: true,
            },
            orderBy: {
                earnedAt: 'desc',
            },
        });

        return userBadges.map((ub) => ub.badge);
    }

    /**
     * Check and award badges based on user achievements
     */
    async checkAndAwardBadges(userId: string): Promise<Badge[]> {
        const reputation = await this.getOrCreateReputation(userId);
        const allBadges = await this.getAllBadges();
        const earnedBadges = await this.getUserBadges(userId);
        const earnedBadgeKeys = new Set(earnedBadges.map((b) => b.key));

        const newlyEarnedBadges: Badge[] = [];

        for (const badge of allBadges) {
            // Skip if already earned
            if (earnedBadgeKeys.has(badge.key)) continue;

            // Check if user meets requirements
            const requirement = badge.requirement as any;
            let shouldAward = false;

            switch (requirement.type) {
                case 'best_answers':
                    shouldAward = reputation.bestAnswers >= requirement.count;
                    break;
                case 'answers_given':
                    shouldAward = reputation.answersGiven >= requirement.count;
                    break;
                case 'questions_asked':
                    shouldAward = reputation.questionsAsked >= requirement.count;
                    break;
                case 'total_points':
                    shouldAward = reputation.totalPoints >= requirement.count;
                    break;
                case 'upvotes_received':
                    shouldAward = reputation.upvotesReceived >= requirement.count;
                    break;
            }

            if (shouldAward) {
                await this.prisma.userBadge.create({
                    data: {
                        reputationId: reputation.id,
                        badgeId: badge.id,
                    },
                });
                newlyEarnedBadges.push(badge);

                // Send badge notification (async, don't wait)
                this.notificationService.notifyBadgeEarned(userId, badge.id).catch(() => {
                    // Silently fail - notification is not critical
                });
            }
        }

        return newlyEarnedBadges;
    }

    /**
     * Update reputation stats when user asks a question
     */
    async incrementQuestionsAsked(userId: string): Promise<void> {
        await this.getOrCreateReputation(userId);

        await this.prisma.userReputation.update({
            where: { userId },
            data: {
                questionsAsked: { increment: 1 },
            },
        });

        await this.addReputationPoints(userId, ReputationReason.QUESTION_ASKED);
    }

    /**
     * Update reputation stats when user gives an answer
     */
    async incrementAnswersGiven(userId: string): Promise<void> {
        await this.getOrCreateReputation(userId);

        await this.prisma.userReputation.update({
            where: { userId },
            data: {
                answersGiven: { increment: 1 },
            },
        });

        await this.addReputationPoints(userId, ReputationReason.ANSWER_GIVEN);
    }
}
