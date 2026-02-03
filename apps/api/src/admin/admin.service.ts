import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, UserStatus, SubscriptionStatus } from '@prisma/client';

export interface DashboardStats {
    users: {
        total: number;
        active: number;
        new: number;
        growth: number;
    };
    subscriptions: {
        total: number;
        active: number;
        revenue: number;
        growth: number;
    };
    engagement: {
        dailyActive: number;
        weeklyActive: number;
        monthlyActive: number;
        avgSessionTime: number;
    };
    content: {
        questions: number;
        answers: number;
        articles: number;
        conversations: number;
    };
}

export interface ChartData {
    labels: string[];
    datasets: Array<{
        label: string;
        data: number[];
        backgroundColor?: string;
        borderColor?: string;
    }>;
}

export interface BulkOperationResult {
    success: number;
    failed: number;
    errors: string[];
}

@Injectable()
export class AdminService {
    constructor(private prisma: PrismaService) { }

    /**
     * Dashboard Statistics with Charts
     */
    async getDashboardStats(startDate?: Date, endDate?: Date): Promise<DashboardStats> {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

        const start = startDate || thirtyDaysAgo;
        const end = endDate || now;

        // User stats - using updatedAt as proxy for activity since lastLoginAt doesn't exist
        const [totalUsers, activeUsers, newUsers, previousPeriodUsers] = await Promise.all([
            this.prisma.user.count(),
            this.prisma.user.count({
                where: {
                    updatedAt: { gte: start },
                },
            }),
            this.prisma.user.count({
                where: {
                    createdAt: { gte: start, lte: end },
                },
            }),
            this.prisma.user.count({
                where: {
                    createdAt: { gte: sixtyDaysAgo, lt: start },
                },
            }),
        ]);

        const userGrowth = previousPeriodUsers > 0
            ? ((newUsers - previousPeriodUsers) / previousPeriodUsers) * 100
            : 0;

        // Subscription stats
        const [totalSubs, activeSubs, previousPeriodSubs] = await Promise.all([
            this.prisma.subscription.count(),
            this.prisma.subscription.count({
                where: {
                    status: SubscriptionStatus.ACTIVE,
                },
            }),
            this.prisma.subscription.count({
                where: {
                    createdAt: { gte: sixtyDaysAgo, lt: start },
                    status: SubscriptionStatus.ACTIVE,
                },
            }),
        ]);

        // Calculate revenue from active subscriptions based on tier
        const activeSubscriptions = await this.prisma.subscription.findMany({
            where: { status: SubscriptionStatus.ACTIVE },
            select: { tier: true },
        });

        const tierPrices = { FREE: 0, PREMIUM: 9.99, PREMIUM_PLUS: 19.99 };
        const revenue = activeSubscriptions.reduce((sum, sub) => {
            return sum + (tierPrices[sub.tier || 'FREE'] || 0);
        }, 0);

        // Calculate subscription growth
        const currentPeriodNewSubs = await this.prisma.subscription.count({
            where: {
                createdAt: { gte: start, lte: end },
                status: SubscriptionStatus.ACTIVE,
            },
        });
        const subscriptionGrowth = previousPeriodSubs > 0
            ? ((currentPeriodNewSubs - previousPeriodSubs) / previousPeriodSubs) * 100
            : 0;

        // Engagement stats - using message activity as proxy for session time
        const [dailyActive, weeklyActive, monthlyActive] = await Promise.all([
            this.prisma.user.count({
                where: {
                    updatedAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
                },
            }),
            this.prisma.user.count({
                where: {
                    updatedAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
                },
            }),
            this.prisma.user.count({
                where: {
                    updatedAt: { gte: thirtyDaysAgo },
                },
            }),
        ]);

        // Calculate average session time from conversation activity
        const recentConversations = await this.prisma.conversation.findMany({
            where: {
                createdAt: { gte: start },
            },
            include: {
                messages: {
                    select: {
                        createdAt: true,
                    },
                    orderBy: {
                        createdAt: 'asc',
                    },
                },
            },
        });

        let totalSessionTime = 0;
        let sessionCount = 0;

        for (const conv of recentConversations) {
            if (conv.messages.length >= 2) {
                const firstMsg = conv.messages[0];
                const lastMsg = conv.messages[conv.messages.length - 1];
                const sessionDuration = lastMsg.createdAt.getTime() - firstMsg.createdAt.getTime();
                // Only count sessions between 1 minute and 2 hours
                if (sessionDuration >= 60000 && sessionDuration <= 7200000) {
                    totalSessionTime += sessionDuration;
                    sessionCount++;
                }
            }
        }

        const avgSessionTime = sessionCount > 0
            ? Math.round(totalSessionTime / sessionCount / 1000) // Convert to seconds
            : 0;

        // Content stats
        const [questions, answers, conversations] = await Promise.all([
            this.prisma.question.count(),
            this.prisma.answer.count(),
            this.prisma.conversation.count(),
        ]);

        return {
            users: {
                total: totalUsers,
                active: activeUsers,
                new: newUsers,
                growth: userGrowth,
            },
            subscriptions: {
                total: totalSubs,
                active: activeSubs,
                revenue,
                growth: subscriptionGrowth,
            },
            engagement: {
                dailyActive,
                weeklyActive,
                monthlyActive,
                avgSessionTime,
            },
            content: {
                questions,
                answers,
                articles: 0, // Article model doesn't exist
                conversations,
            },
        };
    }

    /**
     * User Growth Chart Data
     */
    async getUserGrowthChart(days: number = 30): Promise<ChartData> {
        const now = new Date();
        const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

        const users = await this.prisma.user.groupBy({
            by: ['createdAt'],
            where: {
                createdAt: { gte: startDate },
            },
            _count: true,
        });

        // Group by day
        const dailyCounts = new Map<string, number>();
        for (let i = 0; i < days; i++) {
            const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
            const dateStr = date.toISOString().split('T')[0];
            dailyCounts.set(dateStr, 0);
        }

        users.forEach((user) => {
            const dateStr = user.createdAt.toISOString().split('T')[0];
            dailyCounts.set(dateStr, (dailyCounts.get(dateStr) || 0) + user._count);
        });

        return {
            labels: Array.from(dailyCounts.keys()),
            datasets: [
                {
                    label: 'New Users',
                    data: Array.from(dailyCounts.values()),
                    backgroundColor: 'rgba(99, 102, 241, 0.5)',
                    borderColor: 'rgb(99, 102, 241)',
                },
            ],
        };
    }

    /**
     * Revenue Chart Data
     */
    async getRevenueChart(days: number = 30): Promise<ChartData> {
        const now = new Date();
        const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

        const subscriptions = await this.prisma.subscription.findMany({
            where: {
                createdAt: { gte: startDate },
                status: SubscriptionStatus.ACTIVE,
            },
            select: {
                createdAt: true,
                tier: true,
            },
        });

        // Group by day
        const dailyRevenue = new Map<string, number>();
        for (let i = 0; i < days; i++) {
            const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
            const dateStr = date.toISOString().split('T')[0];
            dailyRevenue.set(dateStr, 0);
        }

        const tierPrices = { FREE: 0, PREMIUM: 9.99, PREMIUM_PLUS: 19.99 };
        subscriptions.forEach((sub) => {
            const dateStr = sub.createdAt.toISOString().split('T')[0];
            const price = tierPrices[sub.tier || 'FREE'] || 0;
            dailyRevenue.set(dateStr, (dailyRevenue.get(dateStr) || 0) + price);
        });

        return {
            labels: Array.from(dailyRevenue.keys()),
            datasets: [
                {
                    label: 'Revenue',
                    data: Array.from(dailyRevenue.values()),
                    backgroundColor: 'rgba(34, 197, 94, 0.5)',
                    borderColor: 'rgb(34, 197, 94)',
                },
            ],
        };
    }

    /**
     * Bulk Operations
     */
    async bulkUpdateUsers(
        userIds: string[],
        data: { status?: UserStatus; pinEnabled?: boolean },
    ): Promise<BulkOperationResult> {
        const result: BulkOperationResult = {
            success: 0,
            failed: 0,
            errors: [],
        };

        for (const userId of userIds) {
            try {
                await this.prisma.user.update({
                    where: { id: userId },
                    data,
                });
                result.success++;
            } catch (error: any) {
                result.failed++;
                result.errors.push(`User ${userId}: ${error.message}`);
            }
        }

        return result;
    }

    async bulkDeleteUsers(userIds: string[]): Promise<BulkOperationResult> {
        const result: BulkOperationResult = {
            success: 0,
            failed: 0,
            errors: [],
        };

        for (const userId of userIds) {
            try {
                await this.prisma.user.delete({
                    where: { id: userId },
                });
                result.success++;
            } catch (error: any) {
                result.failed++;
                result.errors.push(`User ${userId}: ${error.message}`);
            }
        }

        return result;
    }

    async bulkSendNotifications(
        userIds: string[],
        notification: { title: string; body: string },
    ): Promise<BulkOperationResult> {
        const result: BulkOperationResult = {
            success: 0,
            failed: 0,
            errors: [],
        };

        for (const userId of userIds) {
            try {
                // TODO: Integrate with notification service
                // await this.notificationService.send(userId, notification);
                result.success++;
            } catch (error: any) {
                result.failed++;
                result.errors.push(`User ${userId}: ${error.message}`);
            }
        }

        return result;
    }

    /**
     * Advanced Filtering
     */
    async searchUsers(filters: {
        search?: string;
        status?: UserStatus;
        subscriptionStatus?: SubscriptionStatus;
        createdAfter?: Date;
        createdBefore?: Date;
        hasSubscription?: boolean;
        page?: number;
        limit?: number;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
    }) {
        const {
            search,
            status,
            subscriptionStatus,
            createdAfter,
            createdBefore,
            hasSubscription,
            page = 1,
            limit = 20,
            sortBy = 'createdAt',
            sortOrder = 'desc',
        } = filters;

        const where: Prisma.UserWhereInput = {};

        // Search in email, username, or profile name
        if (search) {
            where.OR = [
                { email: { contains: search, mode: 'insensitive' } },
                { username: { contains: search, mode: 'insensitive' } },
                {
                    profile: {
                        OR: [
                            { firstName: { contains: search, mode: 'insensitive' } },
                            { lastName: { contains: search, mode: 'insensitive' } },
                            { displayName: { contains: search, mode: 'insensitive' } },
                        ],
                    },
                },
            ];
        }

        if (status) {
            where.status = status;
        }

        if (createdAfter || createdBefore) {
            where.createdAt = {};
            if (createdAfter) where.createdAt.gte = createdAfter;
            if (createdBefore) where.createdAt.lte = createdBefore;
        }

        if (hasSubscription !== undefined) {
            if (hasSubscription) {
                where.subscription = { isNot: null };
            } else {
                where.subscription = null;
            }
        }

        if (subscriptionStatus) {
            where.subscription = {
                status: subscriptionStatus,
            };
        }

        const skip = (page - 1) * limit;

        const [users, total] = await Promise.all([
            this.prisma.user.findMany({
                where,
                skip,
                take: limit,
                include: {
                    profile: true,
                    subscription: true,
                    _count: {
                        select: {
                            conversations: true,
                            questions: true,
                            answers: true,
                        },
                    },
                },
                orderBy: { [sortBy]: sortOrder },
            }),
            this.prisma.user.count({ where }),
        ]);

        // Remove sensitive data
        const usersWithoutSensitive = users.map(({ password, pinHash, ...user }) => user);

        return {
            data: usersWithoutSensitive,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    /**
     * User Impersonation
     */
    async impersonateUser(adminId: string, targetUserId: string) {
        // Verify admin - check if user has admin email domain
        const admin = await this.prisma.user.findUnique({
            where: { id: adminId },
            select: { email: true },
        });

        if (!admin) {
            throw new BadRequestException('Admin bulunamadı');
        }

        // Check admin status (simplified - in production use proper role system)
        const isAdmin = admin.email.endsWith('@admin.wellnesscompanion.com') ||
            (process.env.ADMIN_EMAILS || '').split(',').includes(admin.email);

        if (!isAdmin) {
            throw new BadRequestException('Admin yetkisi gerekli');
        }

        // Get target user
        const targetUser = await this.prisma.user.findUnique({
            where: { id: targetUserId },
            include: {
                profile: true,
                subscription: true,
            },
        });

        if (!targetUser) {
            throw new NotFoundException('Kullanıcı bulunamadı');
        }

        // Log impersonation for audit
        await this.prisma.auditLog.create({
            data: {
                userId: adminId,
                action: 'USER_IMPERSONATION',
                entity: 'User',
                entityId: targetUserId,
                metadataJson: {
                    adminEmail: admin.email,
                    targetEmail: targetUser.email,
                    timestamp: new Date().toISOString(),
                },
            },
        });

        // Remove sensitive data
        const { password, pinHash, ...userWithoutSensitive } = targetUser;

        return {
            user: userWithoutSensitive,
            impersonationToken: this.generateImpersonationToken(adminId, targetUserId),
        };
    }

    private generateImpersonationToken(adminId: string, targetUserId: string): string {
        // TODO: Generate JWT token with special claims
        return Buffer.from(`${adminId}:${targetUserId}:${Date.now()}`).toString('base64');
    }

    /**
     * System Health Metrics
     */
    async getSystemHealth() {
        const startTime = Date.now();
        const [
            dbStatus,
            userCount,
            activeConnections,
        ] = await Promise.all([
            this.checkDatabaseHealth(),
            this.prisma.user.count(),
            this.getActiveConnections(),
        ]);
        const dbResponseTime = Date.now() - startTime;

        // Calculate error rate from recent audit logs (if any errors logged)
        const errorRate = await this.getErrorRate();

        return {
            status: dbStatus ? 'healthy' : 'unhealthy',
            database: {
                connected: dbStatus,
                responseTime: dbResponseTime,
            },
            users: {
                total: userCount,
                active: activeConnections,
            },
            errors: {
                rate: errorRate,
                threshold: 0.05, // 5% error rate threshold
            },
            timestamp: new Date().toISOString(),
        };
    }

    private async checkDatabaseHealth(): Promise<boolean> {
        try {
            await this.prisma.$queryRaw`SELECT 1`;
            return true;
        } catch {
            return false;
        }
    }

    private async getActiveConnections(): Promise<number> {
        // Count users with activity in last 5 minutes
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const activeUsers = await this.prisma.user.count({
            where: {
                updatedAt: { gte: fiveMinutesAgo },
            },
        });
        return activeUsers;
    }

    private async getErrorRate(): Promise<number> {
        // Calculate error rate from audit logs in last hour
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

        const [totalActions, errorActions] = await Promise.all([
            this.prisma.auditLog.count({
                where: {
                    createdAt: { gte: oneHourAgo },
                },
            }),
            this.prisma.auditLog.count({
                where: {
                    createdAt: { gte: oneHourAgo },
                    action: {
                        contains: 'ERROR',
                    },
                },
            }),
        ]);

        return totalActions > 0 ? errorActions / totalActions : 0;
    }
}
