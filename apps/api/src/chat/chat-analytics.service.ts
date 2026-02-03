import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface TopQuestion {
    question: string;
    count: number;
    avgResponseTime: number;
}

interface PopularTopic {
    topic: string;
    count: number;
    percentage: number;
}

interface TrendData {
    date: string;
    count: number;
    avgTokens: number;
}

@Injectable()
export class ChatAnalyticsService {
    private readonly logger = new Logger(ChatAnalyticsService.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Get most frequently asked questions
     */
    async getTopQuestions(limit = 10, days = 30): Promise<TopQuestion[]> {
        const since = new Date();
        since.setDate(since.getDate() - days);

        // Get user messages with their corresponding assistant responses
        const conversations = await this.prisma.conversation.findMany({
            where: {
                createdAt: { gte: since },
            },
            include: {
                messages: {
                    select: {
                        role: true,
                        content: true,
                        createdAt: true,
                    },
                    orderBy: { createdAt: 'asc' },
                },
            },
        });

        // Group similar questions and calculate response times
        const questionMap = new Map<string, { count: number; responseTimes: number[] }>();

        for (const conv of conversations) {
            const messages = conv.messages;
            for (let i = 0; i < messages.length - 1; i++) {
                const msg = messages[i];
                const nextMsg = messages[i + 1];

                // If user message followed by assistant message
                if (msg.role === 'user' && nextMsg.role === 'assistant') {
                    const key = msg.content.substring(0, 100).toLowerCase().trim();
                    const responseTime = nextMsg.createdAt.getTime() - msg.createdAt.getTime();

                    if (!questionMap.has(key)) {
                        questionMap.set(key, { count: 0, responseTimes: [] });
                    }
                    const entry = questionMap.get(key)!;
                    entry.count++;
                    // Only count reasonable response times (< 30 seconds)
                    if (responseTime < 30000) {
                        entry.responseTimes.push(responseTime);
                    }
                }
            }
        }

        // Convert to array and sort by count
        const topQuestions = Array.from(questionMap.entries())
            .map(([question, data]) => {
                const avgResponseTime =
                    data.responseTimes.length > 0
                        ? Math.round(
                            data.responseTimes.reduce((sum, time) => sum + time, 0) /
                            data.responseTimes.length /
                            1000,
                        ) // Convert to seconds
                        : 0;

                return {
                    question,
                    count: data.count,
                    avgResponseTime,
                };
            })
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);

        return topQuestions;
    }

    /**
     * Get popular topics/categories
     */
    async getPopularTopics(days = 30): Promise<PopularTopic[]> {
        const since = new Date();
        since.setDate(since.getDate() - days);

        const messages = await this.prisma.message.findMany({
            where: {
                role: 'user',
                createdAt: { gte: since },
            },
            select: {
                content: true,
            },
        });

        // Simple keyword-based categorization
        const categories = {
            'Adet Dönemi': ['adet', 'regl', 'menstrüasyon', 'döngü', 'period'],
            'Hamilelik': ['hamile', 'gebelik', 'bebek', 'doğum', 'pregnancy'],
            'Beslenme': ['beslenme', 'diyet', 'yemek', 'vitamin', 'nutrition'],
            'Egzersiz': ['egzersiz', 'spor', 'hareket', 'fitness', 'exercise'],
            'Ruh Sağlığı': ['stres', 'anksiyete', 'depresyon', 'mental', 'mood'],
            'Uyku': ['uyku', 'yorgunluk', 'dinlenme', 'sleep'],
            'Cinsel Sağlık': ['cinsel', 'seks', 'libido', 'sexual'],
        };

        const topicCounts = new Map<string, number>();
        let totalMessages = messages.length;

        for (const msg of messages) {
            const content = msg.content.toLowerCase();
            for (const [topic, keywords] of Object.entries(categories)) {
                if (keywords.some((kw) => content.includes(kw))) {
                    topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
                }
            }
        }

        const topics = Array.from(topicCounts.entries())
            .map(([topic, count]) => ({
                topic,
                count,
                percentage: totalMessages > 0 ? (count / totalMessages) * 100 : 0,
            }))
            .sort((a, b) => b.count - a.count);

        return topics;
    }

    /**
     * Get chat trends over time
     */
    async getChatTrends(days = 30): Promise<TrendData[]> {
        const since = new Date();
        since.setDate(since.getDate() - days);

        const messages = await this.prisma.message.findMany({
            where: {
                createdAt: { gte: since },
            },
            select: {
                createdAt: true,
                tokens: true,
                role: true,
            },
            orderBy: { createdAt: 'asc' },
        });

        // Group by date
        const dateMap = new Map<string, { count: number; totalTokens: number; tokenCount: number }>();

        for (const msg of messages) {
            const dateKey = msg.createdAt.toISOString().split('T')[0];
            if (!dateMap.has(dateKey)) {
                dateMap.set(dateKey, { count: 0, totalTokens: 0, tokenCount: 0 });
            }
            const entry = dateMap.get(dateKey)!;
            entry.count++;
            if (msg.tokens) {
                entry.totalTokens += msg.tokens;
                entry.tokenCount++;
            }
        }

        const trends = Array.from(dateMap.entries())
            .map(([date, data]) => ({
                date,
                count: data.count,
                avgTokens: data.tokenCount > 0 ? Math.round(data.totalTokens / data.tokenCount) : 0,
            }))
            .sort((a, b) => a.date.localeCompare(b.date));

        return trends;
    }

    /**
     * Get overall chat statistics
     */
    async getChatStats(days = 30) {
        const since = new Date();
        since.setDate(since.getDate() - days);

        const [totalConversations, totalMessages, userMessages, assistantMessages, avgMessagesPerConv] =
            await Promise.all([
                // Total conversations
                this.prisma.conversation.count({
                    where: {
                        createdAt: { gte: since },
                        archivedAt: null,
                    },
                }),
                // Total messages
                this.prisma.message.count({
                    where: {
                        createdAt: { gte: since },
                    },
                }),
                // User messages
                this.prisma.message.count({
                    where: {
                        role: 'user',
                        createdAt: { gte: since },
                    },
                }),
                // Assistant messages
                this.prisma.message.count({
                    where: {
                        role: 'assistant',
                        createdAt: { gte: since },
                    },
                }),
                // Avg messages per conversation
                this.prisma.message.groupBy({
                    by: ['conversationId'],
                    where: {
                        createdAt: { gte: since },
                    },
                    _count: {
                        id: true,
                    },
                }),
            ]);

        const avgMessages =
            avgMessagesPerConv.length > 0
                ? avgMessagesPerConv.reduce((sum, conv) => sum + conv._count.id, 0) / avgMessagesPerConv.length
                : 0;

        return {
            totalConversations,
            totalMessages,
            userMessages,
            assistantMessages,
            avgMessagesPerConversation: Math.round(avgMessages * 10) / 10,
            responseRate: userMessages > 0 ? ((assistantMessages / userMessages) * 100).toFixed(1) : '0',
        };
    }

    /**
     * Get user engagement metrics
     */
    async getUserEngagement(days = 30) {
        const since = new Date();
        since.setDate(since.getDate() - days);

        const [activeUsers, returningUsers, newUsers] = await Promise.all([
            // Active users (users with messages)
            this.prisma.message
                .findMany({
                    where: {
                        createdAt: { gte: since },
                        role: 'user',
                    },
                    select: {
                        conversation: {
                            select: {
                                userId: true,
                            },
                        },
                    },
                    distinct: ['conversationId'],
                })
                .then((msgs) => new Set(msgs.map((m) => m.conversation.userId)).size),

            // Returning users (users with multiple conversations)
            this.prisma.conversation
                .groupBy({
                    by: ['userId'],
                    where: {
                        createdAt: { gte: since },
                    },
                    _count: {
                        id: true,
                    },
                    having: {
                        id: {
                            _count: {
                                gt: 1,
                            },
                        },
                    },
                })
                .then((result) => result.length),

            // New users
            this.prisma.user.count({
                where: {
                    createdAt: { gte: since },
                },
            }),
        ]);

        return {
            activeUsers,
            returningUsers,
            newUsers,
            retentionRate: activeUsers > 0 ? ((returningUsers / activeUsers) * 100).toFixed(1) : '0',
        };
    }
}
