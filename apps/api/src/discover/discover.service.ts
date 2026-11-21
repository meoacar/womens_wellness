import { Injectable, NotFoundException, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecommendationEngine } from './recommendation-engine.service';

export interface ArticleCardDto {
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

export interface ArticleDetailDto extends ArticleCardDto {
    content: string;
    author?: string;
    relatedArticles: ArticleCardDto[];
}

export interface PaginatedArticlesDto {
    articles: ArticleCardDto[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
}

export interface UserContentPreferencesDto {
    categoryWeights: Record<string, number>;
    favoriteCategories: string[];
    showPregnancyContent: boolean;
    showCycleContent: boolean;
}

export interface ArticleFilters {
    category?: string;
    search?: string;
}

export interface Pagination {
    page: number;
    limit: number;
}

@Injectable()
export class DiscoverService {
    private readonly logger = new Logger(DiscoverService.name);

    constructor(
        private prisma: PrismaService,
        private recommendationEngine: RecommendationEngine,
    ) { }

    // Get personalized feed for home screen
    async getHomeFeed(
        userId: string,
        locale: string,
        limit: number,
    ): Promise<ArticleCardDto[]> {
        try {
            // 1. Get active articles (optimized query with select)
            const articles = await this.prisma.educationalArticle.findMany({
                where: {
                    isActive: true,
                    OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
                },
                select: {
                    id: true,
                    titleTr: true,
                    titleEn: true,
                    excerpt: true,
                    contentEn: true,
                    category: true,
                    tags: true,
                    imageUrl: true,
                    thumbnailUrl: true,
                    readTimeMin: true,
                    publishedAt: true,
                    priority: true,
                },
                orderBy: [{ priority: 'desc' }, { publishedAt: 'desc' }],
                take: 50, // Get more for scoring
            });

            if (articles.length === 0) {
                return [];
            }

            // 2. Get recommendation scores
            const scores = await this.recommendationEngine.calculateScores(
                userId,
                articles,
            );

            // 3. Sort by score and take top N
            const sortedArticles = articles
                .map((article) => ({
                    article,
                    score: scores.get(article.id) || 0,
                }))
                .sort((a, b) => b.score - a.score)
                .slice(0, limit)
                .map((item) => item.article);

            // 4. Get interaction status
            const interactions = await this.prisma.articleInteraction.findMany({
                where: {
                    userId,
                    articleId: { in: sortedArticles.map((a) => a.id) },
                },
            });

            const interactionMap = new Map(
                interactions.map((i) => [i.articleId, i]),
            );

            // 5. Return formatted cards
            return sortedArticles.map((article) => {
                const interaction = interactionMap.get(article.id);
                return this.formatArticleCard(article, locale, interaction);
            });
        } catch (error) {
            this.logger.error(`Error fetching home feed for user ${userId}:`, error);
            throw new InternalServerErrorException('Failed to fetch home feed');
        }
    }

    // Get articles with filters
    async getArticles(
        userId: string | null,
        filters: ArticleFilters,
        locale: string,
        pagination: Pagination,
    ): Promise<PaginatedArticlesDto> {
        try {
            const { page, limit } = pagination;
            const skip = (page - 1) * limit;

            // Build where clause
            const andConditions: any[] = [
                {
                    OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
                },
            ];

            if (filters.search) {
                const searchTerm = filters.search.trim();
                andConditions.push({
                    OR: [
                        { titleTr: { contains: searchTerm, mode: 'insensitive' } },
                        { titleEn: { contains: searchTerm, mode: 'insensitive' } },
                        { excerpt: { contains: searchTerm, mode: 'insensitive' } },
                        { tags: { hasSome: [searchTerm.toLowerCase()] } },
                    ],
                });
            }

            const where: any = {
                isActive: true,
                AND: andConditions,
            };

            if (filters.category) {
                where.category = filters.category;
            }

            // Get total count
            const total = await this.prisma.educationalArticle.count({ where });

            // Get articles (optimized with select)
            const articles = await this.prisma.educationalArticle.findMany({
                where,
                select: {
                    id: true,
                    titleTr: true,
                    titleEn: true,
                    excerpt: true,
                    contentEn: true,
                    category: true,
                    tags: true,
                    imageUrl: true,
                    thumbnailUrl: true,
                    readTimeMin: true,
                    publishedAt: true,
                    priority: true,
                    isActive: true,
                    author: true,
                    expiresAt: true,
                },
                orderBy: [{ priority: 'desc' }, { publishedAt: 'desc' }],
                skip,
                take: limit,
            });

            // Get interaction status (only when authenticated)
            const interactions = userId
                ? await this.prisma.articleInteraction.findMany({
                    where: {
                        userId,
                        articleId: { in: articles.map((a) => a.id) },
                    },
                })
                : [];

            const interactionMap = new Map(
                interactions.map((i) => [i.articleId, i]),
            );

            return {
                articles: articles.map((article) => {
                    const interaction = interactionMap.get(article.id);
                    return this.formatArticleCard(article, locale, interaction);
                }),
                total,
                page,
                limit,
                hasMore: skip + articles.length < total,
            };
        } catch (error) {
            this.logger.error(`Error fetching articles for user ${userId}:`, error);
            throw new InternalServerErrorException('Failed to fetch articles');
        }
    }

    // Get article detail
    async getArticle(
        userId: string | null,
        articleId: string,
        locale: string,
    ): Promise<ArticleDetailDto> {
        try {
            // 1. Fetch article
            const article = await this.prisma.educationalArticle.findUnique({
                where: { id: articleId },
            });

            if (!article || (!userId && !article.isActive)) {
                throw new NotFoundException('Article not found');
            }

            // 2. Get interaction status
            const interaction = userId
                ? await this.prisma.articleInteraction.findUnique({
                    where: {
                        userId_articleId: {
                            userId,
                            articleId,
                        },
                    },
                })
                : null;

            // 3. Get related articles (same category, different article)
            const relatedArticles = await this.prisma.educationalArticle.findMany({
                where: {
                    category: article.category,
                    id: { not: articleId },
                    isActive: true,
                    OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
                },
                orderBy: [{ priority: 'desc' }, { publishedAt: 'desc' }],
                take: 3,
            });

            const relatedInteractions = userId
                ? await this.prisma.articleInteraction.findMany({
                    where: {
                        userId,
                        articleId: { in: relatedArticles.map((a) => a.id) },
                    },
                })
                : [];

            const relatedInteractionMap = new Map(
                relatedInteractions.map((i) => [i.articleId, i]),
            );

            // 4. Return full detail
            const baseCard = this.formatArticleCard(article, locale, interaction);

            return {
                ...baseCard,
                content:
                    locale === 'en' && article.contentEn
                        ? article.contentEn
                        : article.contentTr,
                contentTr: article.contentTr,
                contentEn: article.contentEn || undefined,
                author: article.author || undefined,
                updatedAt: article.updatedAt,
                expiresAt: article.expiresAt || undefined,
                relatedArticles: relatedArticles.map((a) => {
                    const relatedInteraction = relatedInteractionMap.get(a.id);
                    return this.formatArticleCard(a, locale, relatedInteraction);
                }),
            } as any;
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            this.logger.error(`Error fetching article ${articleId} for user ${userId}:`, error);
            throw new InternalServerErrorException('Failed to fetch article');
        }
    }

    // Get saved articles
    async getSavedArticles(
        userId: string,
        locale: string,
    ): Promise<ArticleCardDto[]> {
        try {
            const interactions = await this.prisma.articleInteraction.findMany({
                where: {
                    userId,
                    saved: true,
                },
                include: {
                    article: {
                        select: {
                            id: true,
                            titleTr: true,
                            titleEn: true,
                            excerpt: true,
                            category: true,
                            tags: true,
                            imageUrl: true,
                            thumbnailUrl: true,
                            readTimeMin: true,
                            publishedAt: true,
                            isActive: true,
                        },
                    },
                },
                orderBy: {
                    savedAt: 'desc',
                },
            });

            return interactions
                .filter((i) => i.article.isActive)
                .map((i) => this.formatArticleCard(i.article, locale, i));
        } catch (error) {
            this.logger.error(`Error fetching saved articles for user ${userId}:`, error);
            throw new InternalServerErrorException('Failed to fetch saved articles');
        }
    }

    // Toggle save status
    async toggleSaveArticle(userId: string, articleId: string): Promise<boolean> {
        try {
            // Check if article exists
            const article = await this.prisma.educationalArticle.findUnique({
                where: { id: articleId },
            });

            if (!article) {
                throw new NotFoundException('Article not found');
            }

            // Get or create interaction
            const interaction = await this.prisma.articleInteraction.findUnique({
                where: {
                    userId_articleId: {
                        userId,
                        articleId,
                    },
                },
            });

            const newSavedStatus = !interaction?.saved;

            if (interaction) {
                // Update existing
                await this.prisma.articleInteraction.update({
                    where: { id: interaction.id },
                    data: {
                        saved: newSavedStatus,
                        savedAt: newSavedStatus ? new Date() : null,
                    },
                });
            } else {
                // Create new
                await this.prisma.articleInteraction.create({
                    data: {
                        userId,
                        articleId,
                        saved: true,
                        savedAt: new Date(),
                    },
                });
            }

            // Update user preferences
            if (newSavedStatus) {
                await this.updateCategoryWeight(userId, article.category, 0.1);
            }

            return newSavedStatus;
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            this.logger.error(`Error toggling save for article ${articleId}, user ${userId}:`, error);
            throw new InternalServerErrorException('Failed to save article');
        }
    }

    // Track article view
    async trackView(
        userId: string,
        articleId: string,
        readTimeMs?: number,
    ): Promise<void> {
        try {
            const article = await this.prisma.educationalArticle.findUnique({
                where: { id: articleId },
            });

            if (!article) {
                throw new NotFoundException('Article not found');
            }

            await this.prisma.articleInteraction.upsert({
                where: {
                    userId_articleId: {
                        userId,
                        articleId,
                    },
                },
                create: {
                    userId,
                    articleId,
                    viewed: true,
                    viewedAt: new Date(),
                    readTimeMs,
                },
                update: {
                    viewed: true,
                    viewedAt: new Date(),
                    readTimeMs,
                },
            });

            // Update user preferences
            await this.updateCategoryWeight(userId, article.category, 0.05);
            await this.incrementArticlesRead(userId);
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            this.logger.error(`Error tracking view for article ${articleId}, user ${userId}:`, error);
            // Don't throw error for tracking - fail silently
        }
    }

    // Track article share
    async trackShare(userId: string, articleId: string): Promise<void> {
        try {
            const article = await this.prisma.educationalArticle.findUnique({
                where: { id: articleId },
            });

            if (!article) {
                throw new NotFoundException('Article not found');
            }

            await this.prisma.articleInteraction.upsert({
                where: {
                    userId_articleId: {
                        userId,
                        articleId,
                    },
                },
                create: {
                    userId,
                    articleId,
                    shared: true,
                    sharedAt: new Date(),
                },
                update: {
                    shared: true,
                    sharedAt: new Date(),
                },
            });

            // Update user preferences (sharing indicates strong interest)
            await this.updateCategoryWeight(userId, article.category, 0.15);
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            this.logger.error(`Error tracking share for article ${articleId}, user ${userId}:`, error);
            // Don't throw error for tracking - fail silently
        }
    }

    // Get user preferences
    async getPreferences(userId: string): Promise<UserContentPreferencesDto> {
        const preferences = await this.prisma.userContentPreferences.findUnique({
            where: { userId },
        });

        if (!preferences) {
            // Return defaults
            return {
                categoryWeights: {},
                favoriteCategories: [],
                showPregnancyContent: false,
                showCycleContent: true,
            };
        }

        return {
            categoryWeights: preferences.categoryWeights as Record<string, number>,
            favoriteCategories: preferences.favoriteCategories,
            showPregnancyContent: preferences.showPregnancyContent,
            showCycleContent: preferences.showCycleContent,
        };
    }

    // Update user preferences
    async updatePreferences(
        userId: string,
        data: {
            categoryWeights?: Record<string, number>;
            showPregnancyContent?: boolean;
            showCycleContent?: boolean;
        },
    ): Promise<UserContentPreferencesDto> {
        const preferences = await this.prisma.userContentPreferences.upsert({
            where: { userId },
            create: {
                userId,
                categoryWeights: data.categoryWeights || {},
                showPregnancyContent: data.showPregnancyContent ?? false,
                showCycleContent: data.showCycleContent ?? true,
            },
            update: {
                ...(data.categoryWeights && { categoryWeights: data.categoryWeights }),
                ...(data.showPregnancyContent !== undefined && {
                    showPregnancyContent: data.showPregnancyContent,
                }),
                ...(data.showCycleContent !== undefined && {
                    showCycleContent: data.showCycleContent,
                }),
            },
        });

        return {
            categoryWeights: preferences.categoryWeights as Record<string, number>,
            favoriteCategories: preferences.favoriteCategories,
            showPregnancyContent: preferences.showPregnancyContent,
            showCycleContent: preferences.showCycleContent,
        };
    }

    // Helper: Format article to card DTO
    private buildExcerptFromMarkdown(markdown: string, maxLen = 175): string {
        const lines = (markdown || '')
            .replace(/\r\n/g, '\n')
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l.length > 0 && !l.startsWith('#'));

        const plain = lines
            .join(' ')
            .replace(/\*\*([^*]+)\*\*/g, '$1')
            .replace(/\*([^*]+)\*/g, '$1')
            .replace(/^[-*]\s+/gm, '')
            .replace(/\s+/g, ' ')
            .trim();

        if (plain.length <= maxLen) return plain;
        const cut = plain.slice(0, maxLen);
        const lastSpace = cut.lastIndexOf(' ');
        return `${(lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trim()}…`;
    }

    private formatArticleCard(
        article: any,
        locale: string,
        interaction?: any,
    ): ArticleCardDto {
        const excerpt =
            locale === 'en' && article.contentEn
                ? this.buildExcerptFromMarkdown(article.contentEn)
                : article.excerpt || '';

        return {
            id: article.id,
            title:
                locale === 'en' && article.titleEn ? article.titleEn : article.titleTr,
            titleTr: article.titleTr,
            titleEn: article.titleEn || undefined,
            excerpt,
            category: article.category,
            tags: article.tags,
            imageUrl: article.imageUrl || undefined,
            thumbnailUrl: article.thumbnailUrl || undefined,
            readTimeMin: article.readTimeMin,
            publishedAt: article.publishedAt,
            priority: article.priority ?? 0,
            isActive: article.isActive ?? true,
            isSaved: interaction?.saved || false,
            isViewed: interaction?.viewed || false,
        } as any;
    }

    // Helper: Update category weight
    private async updateCategoryWeight(
        userId: string,
        category: string,
        increment: number,
    ): Promise<void> {
        const preferences = await this.prisma.userContentPreferences.findUnique({
            where: { userId },
        });

        const weights = (preferences?.categoryWeights as Record<string, number>) || {};
        weights[category] = Math.min((weights[category] || 0) + increment, 1.0);

        // Update favorite categories (top 3)
        const sortedCategories = Object.entries(weights)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([cat]) => cat);

        await this.prisma.userContentPreferences.upsert({
            where: { userId },
            create: {
                userId,
                categoryWeights: weights,
                favoriteCategories: sortedCategories,
            },
            update: {
                categoryWeights: weights,
                favoriteCategories: sortedCategories,
            },
        });
    }

    // Helper: Increment articles read count
    private async incrementArticlesRead(userId: string): Promise<void> {
        await this.prisma.userContentPreferences.upsert({
            where: { userId },
            create: {
                userId,
                totalArticlesRead: 1,
            },
            update: {
                totalArticlesRead: { increment: 1 },
            },
        });
    }
}
