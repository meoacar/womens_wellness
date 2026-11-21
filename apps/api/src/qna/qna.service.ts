import { Injectable, NotFoundException, ForbiddenException, Logger, BadRequestException, forwardRef, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuestionDto, AdminCreateQuestionDto, UpdateQuestionDto, AdminUpdateQuestionDto, CreateAnswerDto, UpdateAnswerDto, CreateCommentDto, QuestionFiltersDto, SortType } from './dto';
import { Question, Answer, QuestionComment, AnswerComment, QuestionStatus, SubscriptionStatus } from '@prisma/client';
import { ReputationService } from './reputation.service';
import { ModerationService } from './moderation.service';
import { QnaNotificationService } from './qna-notification.service';
import {
    sanitizeQuestionResponse,
    sanitizeAnswerResponse,
    sanitizeCommentResponse,
    sanitizePublicAuthor,
} from './utils/sanitize-author';

export interface QuestionDetail extends Question {
    user: {
        id: string;
        username: string | null;
        profile?: {
            firstName?: string | null;
            lastName?: string | null;
            profilePictureUrl?: string | null;
        } | null;
    };
    _count: {
        answers: number;
        comments: number;
        favorites: number;
        followers: number;
    };
    isFavorited?: boolean;
    isFollowing?: boolean;
}

export interface PaginatedQuestions {
    questions: QuestionDetail[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
}

export interface AnswerDetail extends Answer {
    user: {
        id: string;
        username: string | null;
        profile?: {
            firstName?: string | null;
            lastName?: string | null;
            profilePictureUrl?: string | null;
        } | null;
    };
    _count: {
        comments: number;
    };
    userVote?: 'UPVOTE' | 'DOWNVOTE' | null;
}

@Injectable()
export class QnaService {
    private readonly logger = new Logger(QnaService.name);

    constructor(
        private prisma: PrismaService,
        @Inject(forwardRef(() => ReputationService))
        private reputationService: ReputationService,
        @Inject(forwardRef(() => ModerationService))
        private moderationService: ModerationService,
        @Inject(forwardRef(() => QnaNotificationService))
        private notificationService: QnaNotificationService,
    ) { }

    // ==================== QUESTIONS ====================

    async createQuestion(userId: string, dto: CreateQuestionDto): Promise<any> {
        try {
            // Spam kontrolü
            const isSpam = this.moderationService.checkSpam(dto.title + ' ' + dto.content);
            if (isSpam) {
                throw new BadRequestException('İçeriğiniz spam olarak algılandı. Lütfen tekrar deneyin.');
            }

            // Check quota and get premium status
            const { isPremium, canAsk } = await this.checkQuota(userId);

            if (!canAsk) {
                throw new BadRequestException(
                    isPremium
                        ? 'Aylık soru limitinize ulaştınız (20 soru). Lütfen gelecek ay tekrar deneyin.'
                        : 'Aylık soru limitinize ulaştınız (5 soru). Premium üyelik ile ayda 20 soru sorabilirsiniz.'
                );
            }

            const question = await this.prisma.question.create({
                data: {
                    userId,
                    title: dto.title,
                    content: dto.content,
                    category: dto.category,
                    tags: dto.tags || [],
                    isAnonymous: dto.isAnonymous || false,
                    isPremium,
                },
            });

            // Update quota
            await this.incrementQuota(userId);

            // Update reputation stats
            await this.reputationService.incrementQuestionsAsked(userId);

            // Notify followers (async, don't wait)
            if (!dto.isAnonymous) {
                this.notificationService.notifyFollowedUserAsked(question.id, userId).catch(err => {
                    this.logger.error(`Failed to send follower notifications for question ${question.id}:`, err);
                });
            }

            this.logger.log(`Question created: ${question.id} by user ${userId} (premium: ${isPremium})`);
            return sanitizeQuestionResponse(question, userId);
        } catch (error) {
            if (error instanceof BadRequestException) {
                throw error;
            }
            this.logger.error(`Error creating question for user ${userId}:`, error);
            throw error;
        }
    }

    async getQuestions(filters: QuestionFiltersDto, userId?: string): Promise<any> {
        try {
            const { category, tags, status, sort, search, page = 1, limit = 20, sortBy, sortOrder } = filters;
            const skip = (page - 1) * limit;

            // Build where clause
            const where: any = {};

            if (category) {
                where.category = category;
            }

            if (status) {
                where.status = status;
            }

            if (tags) {
                const tagArray = tags.split(',').map(t => t.trim());
                where.tags = { hasSome: tagArray };
            }

            if (search) {
                where.OR = [
                    { title: { contains: search, mode: 'insensitive' } },
                    { content: { contains: search, mode: 'insensitive' } },
                    { tags: { has: search.toLowerCase() } }, // Search in tags array
                ];
            }

            // Build orderBy clause
            let orderBy: any = { createdAt: 'desc' };

            const allowedSortFields = ['createdAt', 'viewCount', 'status', 'title', 'category'];
            if (sortBy && allowedSortFields.includes(sortBy)) {
                orderBy = { [sortBy]: sortOrder === 'asc' ? 'asc' : 'desc' };
            } else if (sort === SortType.POPULAR) {
                orderBy = [
                    { isPremium: 'desc' },
                    { viewCount: 'desc' },
                    { createdAt: 'desc' },
                ];
            } else if (sort === SortType.UNANSWERED) {
                where.status = QuestionStatus.OPEN;
                orderBy = { createdAt: 'desc' };
            } else if (sort === SortType.RECENT) {
                orderBy = [
                    { isPremium: 'desc' },
                    { createdAt: 'desc' },
                ];
            }

            // Get total count
            const total = await this.prisma.question.count({ where });

            // Get questions
            const questions = await this.prisma.question.findMany({
                where,
                orderBy,
                skip,
                take: limit,
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            profile: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                    profilePictureUrl: true,
                                },
                            },
                            reputation: {
                                select: {
                                    totalPoints: true,
                                },
                            },
                        },
                    },
                    _count: {
                        select: {
                            answers: true,
                            comments: true,
                            favorites: true,
                            followers: true,
                        },
                    },
                },
            });

            // Transform user data and get user interactions
            let favoriteMap = new Map();
            let followMap = new Map();

            if (userId) {
                const favorites = await this.prisma.questionFavorite.findMany({
                    where: {
                        userId,
                        questionId: { in: questions.map(q => q.id) },
                    },
                });

                const follows = await this.prisma.questionFollower.findMany({
                    where: {
                        userId,
                        questionId: { in: questions.map(q => q.id) },
                    },
                });

                favoriteMap = new Map(favorites.map(f => [f.questionId, true]));
                followMap = new Map(follows.map(f => [f.questionId, true]));
            }

            const questionsWithInteractions = questions.map(q => ({
                ...sanitizeQuestionResponse(q, userId),
                isFavorited: favoriteMap.get(q.id) || false,
                isFollowing: followMap.get(q.id) || false,
            }));

            return {
                questions: questionsWithInteractions,
                total,
                page,
                limit,
                hasMore: skip + questions.length < total,
            };
        } catch (error) {
            this.logger.error('Error fetching questions:', error);
            throw error;
        }
    }

    async getQuestionById(id: string, userId?: string): Promise<any> {
        try {
            const question = await this.prisma.question.findUnique({
                where: { id },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            profile: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                    profilePictureUrl: true,
                                },
                            },
                            reputation: {
                                select: {
                                    totalPoints: true,
                                },
                            },
                        },
                    },
                    answers: {
                        orderBy: [
                            { isBestAnswer: 'desc' },
                            { voteCount: 'desc' },
                            { createdAt: 'desc' },
                        ],
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true,
                                    profile: {
                                        select: {
                                            firstName: true,
                                            lastName: true,
                                            profilePictureUrl: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                    _count: {
                        select: {
                            answers: true,
                            comments: true,
                            favorites: true,
                            followers: true,
                        },
                    },
                },
            });

            if (!question) {
                throw new NotFoundException('Soru bulunamadı');
            }

            // Increment view count
            await this.prisma.question.update({
                where: { id },
                data: { viewCount: { increment: 1 } },
            });

            const transformedQuestion = sanitizeQuestionResponse(question, userId);

            // Get user interactions if userId provided
            if (userId) {
                const favorite = await this.prisma.questionFavorite.findUnique({
                    where: {
                        questionId_userId: {
                            questionId: id,
                            userId,
                        },
                    },
                });

                const follow = await this.prisma.questionFollower.findUnique({
                    where: {
                        questionId_userId: {
                            questionId: id,
                            userId,
                        },
                    },
                });

                return {
                    ...transformedQuestion,
                    isFavorited: !!favorite,
                    isFollowing: !!follow,
                };
            }

            return transformedQuestion;
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            this.logger.error(`Error fetching question ${id}:`, error);
            throw error;
        }
    }

    async updateQuestion(id: string, userId: string, dto: UpdateQuestionDto): Promise<Question> {
        try {
            const question = await this.prisma.question.findUnique({
                where: { id },
            });

            if (!question) {
                throw new NotFoundException('Soru bulunamadı');
            }

            if (question.userId !== userId) {
                throw new ForbiddenException('Bu soruyu düzenleme yetkiniz yok');
            }

            const updated = await this.prisma.question.update({
                where: { id },
                data: {
                    ...(dto.title && { title: dto.title }),
                    ...(dto.content && { content: dto.content }),
                    ...(dto.category && { category: dto.category }),
                    ...(dto.tags && { tags: dto.tags }),
                },
            });

            this.logger.log(`Question updated: ${id} by user ${userId}`);
            return sanitizeQuestionResponse(updated, userId) as Question;
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof ForbiddenException) {
                throw error;
            }
            this.logger.error(`Error updating question ${id}:`, error);
            throw error;
        }
    }

    async deleteQuestion(id: string, userId: string): Promise<void> {
        try {
            const question = await this.prisma.question.findUnique({
                where: { id },
            });

            if (!question) {
                throw new NotFoundException('Soru bulunamadı');
            }

            if (question.userId !== userId) {
                throw new ForbiddenException('Bu soruyu silme yetkiniz yok');
            }

            await this.prisma.question.delete({
                where: { id },
            });

            this.logger.log(`Question deleted: ${id} by user ${userId}`);
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof ForbiddenException) {
                throw error;
            }
            this.logger.error(`Error deleting question ${id}:`, error);
            throw error;
        }
    }

    async adminCreateQuestion(adminUserId: string, dto: AdminCreateQuestionDto): Promise<Question> {
        const question = await this.prisma.question.create({
            data: {
                userId: adminUserId,
                title: dto.title,
                content: dto.content,
                category: dto.category,
                tags: dto.tags || [],
                isAnonymous: dto.isAnonymous || false,
                status: dto.status || QuestionStatus.OPEN,
                isPremium: dto.isPremium ?? true,
            },
        });
        this.logger.log(`Question created by admin: ${question.id}`);
        return question;
    }

    async adminUpdateQuestion(id: string, dto: AdminUpdateQuestionDto): Promise<Question> {
        const question = await this.prisma.question.findUnique({ where: { id } });
        if (!question) {
            throw new NotFoundException('Soru bulunamadı');
        }

        const updated = await this.prisma.question.update({
            where: { id },
            data: {
                ...(dto.title !== undefined && { title: dto.title }),
                ...(dto.content !== undefined && { content: dto.content }),
                ...(dto.category !== undefined && { category: dto.category }),
                ...(dto.tags !== undefined && { tags: dto.tags }),
                ...(dto.status !== undefined && { status: dto.status }),
                ...(dto.isAnonymous !== undefined && { isAnonymous: dto.isAnonymous }),
                ...(dto.isPremium !== undefined && { isPremium: dto.isPremium }),
            },
        });
        this.logger.log(`Question updated by admin: ${id}`);
        return updated;
    }

    async adminDeleteQuestion(id: string): Promise<void> {
        const question = await this.prisma.question.findUnique({ where: { id } });
        if (!question) {
            throw new NotFoundException('Soru bulunamadı');
        }

        await this.prisma.question.delete({ where: { id } });
        this.logger.log(`Question deleted by admin: ${id}`);
    }

    async adminCreateAnswer(questionId: string, adminUserId: string, dto: CreateAnswerDto): Promise<any> {
        const question = await this.prisma.question.findUnique({ where: { id: questionId } });
        if (!question) {
            throw new NotFoundException('Soru bulunamadı');
        }

        const answer = await this.prisma.answer.create({
            data: {
                questionId,
                userId: adminUserId,
                content: dto.content,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        profile: {
                            select: {
                                firstName: true,
                                lastName: true,
                                profilePictureUrl: true,
                            },
                        },
                    },
                },
                _count: {
                    select: {
                        comments: true,
                    },
                },
            },
        });

        if (question.status === QuestionStatus.OPEN) {
            await this.prisma.question.update({
                where: { id: questionId },
                data: { status: QuestionStatus.ANSWERED },
            });
        }

        this.notificationService.notifyNewAnswer(questionId, answer.id, adminUserId).catch(err => {
            this.logger.error(`Failed to send notification for admin answer ${answer.id}:`, err);
        });

        return answer;
    }

    async adminMarkBestAnswer(questionId: string, answerId: string): Promise<void> {
        const question = await this.prisma.question.findUnique({ where: { id: questionId } });
        if (!question) {
            throw new NotFoundException('Soru bulunamadı');
        }

        const answer = await this.prisma.answer.findUnique({ where: { id: answerId } });
        if (!answer || answer.questionId !== questionId) {
            throw new NotFoundException('Cevap bulunamadı');
        }

        await this.prisma.answer.updateMany({
            where: { questionId, isBestAnswer: true },
            data: { isBestAnswer: false },
        });

        await this.prisma.answer.update({
            where: { id: answerId },
            data: { isBestAnswer: true },
        });

        if (question.status === QuestionStatus.OPEN) {
            await this.prisma.question.update({
                where: { id: questionId },
                data: { status: QuestionStatus.ANSWERED },
            });
        }

        await this.reputationService.addReputationPoints(
            answer.userId,
            'BEST_ANSWER_SELECTED' as any,
            { questionId, answerId },
        );
        this.logger.log(`Best answer marked by admin: ${answerId} on question ${questionId}`);
    }

    // ==================== ANSWERS ====================

    async createAnswer(questionId: string, userId: string, dto: CreateAnswerDto): Promise<any> {
        try {
            // Spam kontrolü
            const isSpam = this.moderationService.checkSpam(dto.content);
            if (isSpam) {
                throw new BadRequestException('İçeriğiniz spam olarak algılandı. Lütfen tekrar deneyin.');
            }

            // Check if question exists
            const question = await this.prisma.question.findUnique({
                where: { id: questionId },
            });

            if (!question) {
                throw new NotFoundException('Soru bulunamadı');
            }

            const answer = await this.prisma.answer.create({
                data: {
                    questionId,
                    userId,
                    content: dto.content,
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            profile: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                    profilePictureUrl: true,
                                },
                            },
                            reputation: {
                                select: {
                                    totalPoints: true,
                                },
                            },
                        },
                    },
                    _count: {
                        select: {
                            comments: true,
                        },
                    },
                },
            });

            // Update question status to ANSWERED if it was OPEN
            if (question.status === QuestionStatus.OPEN) {
                await this.prisma.question.update({
                    where: { id: questionId },
                    data: { status: QuestionStatus.ANSWERED },
                });
            }

            // Update reputation stats
            await this.reputationService.incrementAnswersGiven(userId);

            // Send notifications (async, don't wait)
            this.notificationService.notifyNewAnswer(questionId, answer.id, userId).catch(err => {
                this.logger.error(`Failed to send new answer notifications for answer ${answer.id}:`, err);
            });

            this.logger.log(`Answer created: ${answer.id} for question ${questionId} by user ${userId}`);

            return {
                ...sanitizeAnswerResponse(answer, userId, {
                    isAnonymousQuestion: question.isAnonymous,
                    questionOwnerId: question.userId,
                }),
                userVote: null,
            };
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            this.logger.error(`Error creating answer for question ${questionId}:`, error);
            throw error;
        }
    }

    async getAllAnswers(userId?: string): Promise<any[]> {
        try {
            const answers = await this.prisma.answer.findMany({
                orderBy: [
                    { createdAt: 'desc' },
                ],
                include: {
                    question: {
                        select: {
                            id: true,
                            title: true,
                            isAnonymous: true,
                            userId: true,
                        },
                    },
                    user: {
                        select: {
                            id: true,
                            username: true,
                            profile: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                    profilePictureUrl: true,
                                },
                            },
                        },
                    },
                    _count: {
                        select: {
                            comments: true,
                        },
                    },
                },
            });

            return answers.map(a => sanitizeAnswerResponse(a, userId));
        } catch (error) {
            this.logger.error('Error fetching all answers:', error);
            throw error;
        }
    }

    async getAnswerById(id: string, userId?: string): Promise<any> {
        try {
            const answer = await this.prisma.answer.findUnique({
                where: { id },
                include: {
                    question: {
                        select: {
                            id: true,
                            title: true,
                            isAnonymous: true,
                            userId: true,
                        },
                    },
                    user: {
                        select: {
                            id: true,
                            username: true,
                            profile: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                    profilePictureUrl: true,
                                },
                            },
                        },
                    },
                    _count: {
                        select: {
                            comments: true,
                        },
                    },
                },
            });

            if (!answer) {
                throw new NotFoundException('Cevap bulunamadı');
            }

            return sanitizeAnswerResponse(answer, userId);
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            this.logger.error(`Error fetching answer ${id}:`, error);
            throw error;
        }
    }

    async getAnswers(questionId: string, userId?: string): Promise<any[]> {
        try {
            const [question, answers] = await Promise.all([
                this.prisma.question.findUnique({
                    where: { id: questionId },
                    select: { isAnonymous: true, userId: true },
                }),
                this.prisma.answer.findMany({
                    where: { questionId },
                    orderBy: [
                        { isBestAnswer: 'desc' },
                        { voteCount: 'desc' },
                        { createdAt: 'asc' },
                    ],
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                profile: {
                                    select: {
                                        firstName: true,
                                        lastName: true,
                                        profilePictureUrl: true,
                                    },
                                },
                                reputation: {
                                    select: {
                                        totalPoints: true,
                                    },
                                },
                            },
                        },
                        _count: {
                            select: {
                                comments: true,
                            },
                        },
                    },
                }),
            ]);

            // Get user votes if userId provided
            let voteMap = new Map();
            if (userId) {
                const votes = await this.prisma.answerVote.findMany({
                    where: {
                        userId,
                        answerId: { in: answers.map(a => a.id) },
                    },
                });

                voteMap = new Map(votes.map(v => [v.answerId, v.voteType]));
            }

            return answers.map(a => ({
                ...sanitizeAnswerResponse(a, userId, {
                    isAnonymousQuestion: question?.isAnonymous,
                    questionOwnerId: question?.userId,
                }),
                userVote: voteMap.get(a.id) || null,
            }));
        } catch (error) {
            this.logger.error(`Error fetching answers for question ${questionId}:`, error);
            throw error;
        }
    }

    async updateAnswer(id: string, userId: string, dto: UpdateAnswerDto): Promise<Answer> {
        try {
            const answer = await this.prisma.answer.findUnique({
                where: { id },
            });

            if (!answer) {
                throw new NotFoundException('Cevap bulunamadı');
            }

            if (answer.userId !== userId) {
                throw new ForbiddenException('Bu cevabı düzenleme yetkiniz yok');
            }

            const updated = await this.prisma.answer.update({
                where: { id },
                data: { content: dto.content },
            });

            this.logger.log(`Answer updated: ${id} by user ${userId}`);
            return updated;
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof ForbiddenException) {
                throw error;
            }
            this.logger.error(`Error updating answer ${id}:`, error);
            throw error;
        }
    }

    async adminUpdateAnswer(id: string, dto: UpdateAnswerDto): Promise<Answer> {
        try {
            const answer = await this.prisma.answer.findUnique({
                where: { id },
            });

            if (!answer) {
                throw new NotFoundException('Cevap bulunamadı');
            }

            const updated = await this.prisma.answer.update({
                where: { id },
                data: { content: dto.content },
            });

            this.logger.log(`Answer updated by admin: ${id}`);
            return updated;
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            this.logger.error(`Error updating answer ${id}:`, error);
            throw error;
        }
    }

    async deleteAnswer(id: string, userId: string): Promise<void> {
        try {
            const answer = await this.prisma.answer.findUnique({
                where: { id },
            });

            if (!answer) {
                throw new NotFoundException('Cevap bulunamadı');
            }

            if (answer.userId !== userId) {
                throw new ForbiddenException('Bu cevabı silme yetkiniz yok');
            }

            await this.prisma.answer.delete({
                where: { id },
            });

            this.logger.log(`Answer deleted: ${id} by user ${userId}`);
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof ForbiddenException) {
                throw error;
            }
            this.logger.error(`Error deleting answer ${id}:`, error);
            throw error;
        }
    }

    async adminDeleteAnswer(id: string): Promise<void> {
        try {
            const answer = await this.prisma.answer.findUnique({
                where: { id },
            });

            if (!answer) {
                throw new NotFoundException('Cevap bulunamadı');
            }

            await this.prisma.answer.delete({
                where: { id },
            });

            this.logger.log(`Answer deleted by admin: ${id}`);
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            this.logger.error(`Error deleting answer ${id}:`, error);
            throw error;
        }
    }

    async markBestAnswer(questionId: string, answerId: string, userId: string): Promise<void> {
        try {
            // Check if question exists and user is the owner
            const question = await this.prisma.question.findUnique({
                where: { id: questionId },
            });

            if (!question) {
                throw new NotFoundException('Soru bulunamadı');
            }

            if (question.userId !== userId) {
                throw new ForbiddenException('Sadece soru sahibi en iyi cevabı seçebilir');
            }

            // Check if answer exists and belongs to the question
            const answer = await this.prisma.answer.findUnique({
                where: { id: answerId },
            });

            if (!answer || answer.questionId !== questionId) {
                throw new NotFoundException('Cevap bulunamadı');
            }

            // Remove previous best answer if exists
            await this.prisma.answer.updateMany({
                where: {
                    questionId,
                    isBestAnswer: true,
                },
                data: { isBestAnswer: false },
            });

            // Mark new best answer
            await this.prisma.answer.update({
                where: { id: answerId },
                data: { isBestAnswer: true },
            });

            // Award reputation points to answer author
            await this.reputationService.addReputationPoints(
                answer.userId,
                'BEST_ANSWER_SELECTED' as any,
                { questionId, answerId },
            );

            // Send notification (async, don't wait)
            this.notificationService.notifyBestAnswerSelected(answerId, questionId).catch(err => {
                this.logger.error(`Failed to send best answer notification for answer ${answerId}:`, err);
            });

            this.logger.log(`Best answer marked: ${answerId} for question ${questionId}`);
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof ForbiddenException) {
                throw error;
            }
            this.logger.error(`Error marking best answer ${answerId}:`, error);
            throw error;
        }
    }

    // ==================== COMMENTS ====================

    async createQuestionComment(questionId: string, userId: string, dto: CreateCommentDto): Promise<any> {
        try {
            // Spam kontrolü
            const isSpam = this.moderationService.checkSpam(dto.content);
            if (isSpam) {
                throw new BadRequestException('İçeriğiniz spam olarak algılandı. Lütfen tekrar deneyin.');
            }

            const question = await this.prisma.question.findUnique({
                where: { id: questionId },
            });

            if (!question) {
                throw new NotFoundException('Soru bulunamadı');
            }

            const comment = await this.prisma.questionComment.create({
                data: {
                    questionId,
                    userId,
                    content: dto.content,
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            profile: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                    profilePictureUrl: true,
                                },
                            },
                        },
                    },
                },
            });

            // Send notification (async, don't wait)
            this.notificationService.notifyQuestionCommented(questionId, comment.id, userId).catch(err => {
                this.logger.error(`Failed to send question comment notification for comment ${comment.id}:`, err);
            });

            this.logger.log(`Question comment created: ${comment.id} for question ${questionId}`);

            return sanitizeCommentResponse(comment, userId, {
                isAnonymousQuestion: question.isAnonymous,
                questionOwnerId: question.userId,
            });
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            this.logger.error(`Error creating question comment:`, error);
            throw error;
        }
    }

    async createAnswerComment(answerId: string, userId: string, dto: CreateCommentDto): Promise<any> {
        try {
            // Spam kontrolü
            const isSpam = this.moderationService.checkSpam(dto.content);
            if (isSpam) {
                throw new BadRequestException('İçeriğiniz spam olarak algılandı. Lütfen tekrar deneyin.');
            }

            const answer = await this.prisma.answer.findUnique({
                where: { id: answerId },
                include: {
                    question: {
                        select: { isAnonymous: true, userId: true },
                    },
                },
            });

            if (!answer) {
                throw new NotFoundException('Cevap bulunamadı');
            }

            const comment = await this.prisma.answerComment.create({
                data: {
                    answerId,
                    userId,
                    content: dto.content,
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            profile: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                    profilePictureUrl: true,
                                },
                            },
                        },
                    },
                },
            });

            // Send notification (async, don't wait)
            this.notificationService.notifyAnswerCommented(answerId, comment.id, userId).catch(err => {
                this.logger.error(`Failed to send answer comment notification for comment ${comment.id}:`, err);
            });

            this.logger.log(`Answer comment created: ${comment.id} for answer ${answerId}`);

            return sanitizeCommentResponse(comment, userId, {
                isAnonymousQuestion: answer.question?.isAnonymous,
                questionOwnerId: answer.question?.userId,
            });
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            this.logger.error(`Error creating answer comment:`, error);
            throw error;
        }
    }

    async getQuestionComments(questionId: string, viewerUserId?: string): Promise<any[]> {
        try {
            const [question, comments] = await Promise.all([
                this.prisma.question.findUnique({
                    where: { id: questionId },
                    select: { isAnonymous: true, userId: true },
                }),
                this.prisma.questionComment.findMany({
                    where: { questionId },
                    orderBy: { createdAt: 'asc' },
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                profile: {
                                    select: {
                                        firstName: true,
                                        lastName: true,
                                        profilePictureUrl: true,
                                    },
                                },
                            },
                        },
                    },
                }),
            ]);

            return comments.map(c =>
                sanitizeCommentResponse(c, viewerUserId, {
                    isAnonymousQuestion: question?.isAnonymous,
                    questionOwnerId: question?.userId,
                }),
            );
        } catch (error) {
            this.logger.error(`Error fetching question comments:`, error);
            throw error;
        }
    }

    async getAnswerComments(answerId: string, viewerUserId?: string): Promise<any[]> {
        try {
            const [answer, comments] = await Promise.all([
                this.prisma.answer.findUnique({
                    where: { id: answerId },
                    include: {
                        question: {
                            select: { isAnonymous: true, userId: true },
                        },
                    },
                }),
                this.prisma.answerComment.findMany({
                    where: { answerId },
                    orderBy: { createdAt: 'asc' },
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                profile: {
                                    select: {
                                        firstName: true,
                                        lastName: true,
                                        profilePictureUrl: true,
                                    },
                                },
                            },
                        },
                    },
                }),
            ]);

            return comments.map(c =>
                sanitizeCommentResponse(c, viewerUserId, {
                    isAnonymousQuestion: answer?.question?.isAnonymous,
                    questionOwnerId: answer?.question?.userId,
                }),
            );
        } catch (error) {
            this.logger.error(`Error fetching answer comments:`, error);
            throw error;
        }
    }

    async deleteQuestionComment(id: string, userId: string): Promise<void> {
        try {
            const comment = await this.prisma.questionComment.findUnique({
                where: { id },
            });

            if (!comment) {
                throw new NotFoundException('Yorum bulunamadı');
            }

            if (comment.userId !== userId) {
                throw new ForbiddenException('Bu yorumu silme yetkiniz yok');
            }

            await this.prisma.questionComment.delete({
                where: { id },
            });

            this.logger.log(`Question comment deleted: ${id}`);
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof ForbiddenException) {
                throw error;
            }
            this.logger.error(`Error deleting question comment ${id}:`, error);
            throw error;
        }
    }

    async deleteAnswerComment(id: string, userId: string): Promise<void> {
        try {
            const comment = await this.prisma.answerComment.findUnique({
                where: { id },
            });

            if (!comment) {
                throw new NotFoundException('Yorum bulunamadı');
            }

            if (comment.userId !== userId) {
                throw new ForbiddenException('Bu yorumu silme yetkiniz yok');
            }

            await this.prisma.answerComment.delete({
                where: { id },
            });

            this.logger.log(`Answer comment deleted: ${id}`);
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof ForbiddenException) {
                throw error;
            }
            this.logger.error(`Error deleting answer comment ${id}:`, error);
            throw error;
        }
    }

    // ==================== USER QUESTIONS ====================

    async getMyQuestions(userId: string, filters: QuestionFiltersDto): Promise<any> {
        try {
            const { category, tags, status, sort, search, page = 1, limit = 20 } = filters;
            const skip = (page - 1) * limit;

            // Build where clause with userId filter
            const where: any = { userId };

            if (category) {
                where.category = category;
            }

            if (status) {
                where.status = status;
            }

            if (tags) {
                const tagArray = tags.split(',').map(t => t.trim());
                where.tags = { hasSome: tagArray };
            }

            if (search) {
                where.OR = [
                    { title: { contains: search, mode: 'insensitive' } },
                    { content: { contains: search, mode: 'insensitive' } },
                    { tags: { has: search.toLowerCase() } }, // Search in tags array
                ];
            }

            // Build orderBy clause
            let orderBy: any = { createdAt: 'desc' };

            if (sort === SortType.POPULAR) {
                orderBy = [
                    { viewCount: 'desc' },
                    { createdAt: 'desc' },
                ];
            } else if (sort === SortType.UNANSWERED) {
                where.status = QuestionStatus.OPEN;
                orderBy = { createdAt: 'desc' };
            } else if (sort === SortType.RECENT) {
                orderBy = { createdAt: 'desc' };
            }

            // Get total count
            const total = await this.prisma.question.count({ where });

            // Get questions
            const questions = await this.prisma.question.findMany({
                where,
                orderBy,
                skip,
                take: limit,
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            profile: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                    profilePictureUrl: true,
                                },
                            },
                            reputation: {
                                select: {
                                    totalPoints: true,
                                },
                            },
                        },
                    },
                    answers: {
                        orderBy: [
                            { isBestAnswer: 'desc' },
                            { voteCount: 'desc' },
                            { createdAt: 'desc' },
                        ],
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true,
                                    profile: {
                                        select: {
                                            firstName: true,
                                            lastName: true,
                                            profilePictureUrl: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                    _count: {
                        select: {
                            answers: true,
                            comments: true,
                            favorites: true,
                            followers: true,
                        },
                    },
                },
            });

            // Get user interactions
            const favorites = await this.prisma.questionFavorite.findMany({
                where: {
                    userId,
                    questionId: { in: questions.map(q => q.id) },
                },
            });

            const follows = await this.prisma.questionFollower.findMany({
                where: {
                    userId,
                    questionId: { in: questions.map(q => q.id) },
                },
            });

            const favoriteMap = new Map(favorites.map(f => [f.questionId, true]));
            const followMap = new Map(follows.map(f => [f.questionId, true]));

            const questionsWithInteractions = questions.map(q => ({
                ...sanitizeQuestionResponse(q, userId),
                isFavorited: favoriteMap.get(q.id) || false,
                isFollowing: followMap.get(q.id) || false,
            }));

            return {
                questions: questionsWithInteractions,
                total,
                page,
                limit,
                hasMore: skip + questions.length < total,
            };
        } catch (error) {
            this.logger.error('Error fetching user questions:', error);
            throw error;
        }
    }

    async getFavoriteQuestions(userId: string, filters: QuestionFiltersDto): Promise<any> {
        try {
            const { category, tags, status, sort, search, page = 1, limit = 20 } = filters;
            const skip = (page - 1) * limit;

            // First get user's favorite question IDs
            const favoriteIds = await this.prisma.questionFavorite.findMany({
                where: { userId },
                select: { questionId: true },
            });

            const questionIds = favoriteIds.map(f => f.questionId);

            if (questionIds.length === 0) {
                return {
                    questions: [],
                    total: 0,
                    page,
                    limit,
                    hasMore: false,
                };
            }

            // Build where clause with favorite filter
            const where: any = {
                id: { in: questionIds },
            };

            if (category) {
                where.category = category;
            }

            if (status) {
                where.status = status;
            }

            if (tags) {
                const tagArray = tags.split(',').map(t => t.trim());
                where.tags = { hasSome: tagArray };
            }

            if (search) {
                where.OR = [
                    { title: { contains: search, mode: 'insensitive' } },
                    { content: { contains: search, mode: 'insensitive' } },
                    { tags: { has: search.toLowerCase() } }, // Search in tags array
                ];
            }

            // Build orderBy clause
            let orderBy: any = { createdAt: 'desc' };

            if (sort === SortType.POPULAR) {
                orderBy = [
                    { isPremium: 'desc' },
                    { viewCount: 'desc' },
                    { createdAt: 'desc' },
                ];
            } else if (sort === SortType.UNANSWERED) {
                where.status = QuestionStatus.OPEN;
                orderBy = { createdAt: 'desc' };
            } else if (sort === SortType.RECENT) {
                orderBy = [
                    { isPremium: 'desc' },
                    { createdAt: 'desc' },
                ];
            }

            // Get total count
            const total = await this.prisma.question.count({ where });

            // Get questions
            const questions = await this.prisma.question.findMany({
                where,
                orderBy,
                skip,
                take: limit,
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            profile: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                    profilePictureUrl: true,
                                },
                            },
                            reputation: {
                                select: {
                                    totalPoints: true,
                                },
                            },
                        },
                    },
                    answers: {
                        orderBy: [
                            { isBestAnswer: 'desc' },
                            { voteCount: 'desc' },
                            { createdAt: 'desc' },
                        ],
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true,
                                    profile: {
                                        select: {
                                            firstName: true,
                                            lastName: true,
                                            profilePictureUrl: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                    _count: {
                        select: {
                            answers: true,
                            comments: true,
                            favorites: true,
                            followers: true,
                        },
                    },
                },
            });

            // Get user interactions
            const follows = await this.prisma.questionFollower.findMany({
                where: {
                    userId,
                    questionId: { in: questions.map(q => q.id) },
                },
            });

            const followMap = new Map(follows.map(f => [f.questionId, true]));

            const questionsWithInteractions = questions.map(q => ({
                ...sanitizeQuestionResponse(q, userId),
                isFavorited: true, // All questions in this list are favorited
                isFollowing: followMap.get(q.id) || false,
            }));

            return {
                questions: questionsWithInteractions,
                total,
                page,
                limit,
                hasMore: skip + questions.length < total,
            };
        } catch (error) {
            this.logger.error('Error fetching favorite questions:', error);
            throw error;
        }
    }

    async getFollowingQuestions(userId: string, filters: QuestionFiltersDto): Promise<any> {
        try {
            const { category, tags, status, sort, search, page = 1, limit = 20 } = filters;
            const skip = (page - 1) * limit;

            // First get user's following question IDs
            const followingIds = await this.prisma.questionFollower.findMany({
                where: { userId },
                select: { questionId: true },
            });

            const questionIds = followingIds.map(f => f.questionId);

            if (questionIds.length === 0) {
                return {
                    questions: [],
                    total: 0,
                    page,
                    limit,
                    hasMore: false,
                };
            }

            // Build where clause with following filter
            const where: any = {
                id: { in: questionIds },
            };

            if (category) {
                where.category = category;
            }

            if (status) {
                where.status = status;
            }

            if (tags) {
                const tagArray = tags.split(',').map(t => t.trim());
                where.tags = { hasSome: tagArray };
            }

            if (search) {
                where.OR = [
                    { title: { contains: search, mode: 'insensitive' } },
                    { content: { contains: search, mode: 'insensitive' } },
                    { tags: { has: search.toLowerCase() } }, // Search in tags array
                ];
            }

            // Build orderBy clause
            let orderBy: any = { createdAt: 'desc' };

            if (sort === SortType.POPULAR) {
                orderBy = [
                    { isPremium: 'desc' },
                    { viewCount: 'desc' },
                    { createdAt: 'desc' },
                ];
            } else if (sort === SortType.UNANSWERED) {
                where.status = QuestionStatus.OPEN;
                orderBy = { createdAt: 'desc' };
            } else if (sort === SortType.RECENT) {
                orderBy = [
                    { isPremium: 'desc' },
                    { createdAt: 'desc' },
                ];
            }

            // Get total count
            const total = await this.prisma.question.count({ where });

            // Get questions
            const questions = await this.prisma.question.findMany({
                where,
                orderBy,
                skip,
                take: limit,
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            profile: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                    profilePictureUrl: true,
                                },
                            },
                            reputation: {
                                select: {
                                    totalPoints: true,
                                },
                            },
                        },
                    },
                    answers: {
                        orderBy: [
                            { isBestAnswer: 'desc' },
                            { voteCount: 'desc' },
                            { createdAt: 'desc' },
                        ],
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true,
                                    profile: {
                                        select: {
                                            firstName: true,
                                            lastName: true,
                                            profilePictureUrl: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                    _count: {
                        select: {
                            answers: true,
                            comments: true,
                            favorites: true,
                            followers: true,
                        },
                    },
                },
            });

            // Get user interactions
            const favorites = await this.prisma.questionFavorite.findMany({
                where: {
                    userId,
                    questionId: { in: questions.map(q => q.id) },
                },
            });

            const favoriteMap = new Map(favorites.map(f => [f.questionId, true]));

            const questionsWithInteractions = questions.map(q => ({
                ...sanitizeQuestionResponse(q, userId),
                isFavorited: favoriteMap.get(q.id) || false,
                isFollowing: true, // All questions in this list are followed
            }));

            return {
                questions: questionsWithInteractions,
                total,
                page,
                limit,
                hasMore: skip + questions.length < total,
            };
        } catch (error) {
            this.logger.error('Error fetching following questions:', error);
            throw error;
        }
    }

    // ==================== INTERACTIONS ====================

    async favoriteQuestion(questionId: string, userId: string): Promise<void> {
        try {
            const question = await this.prisma.question.findUnique({
                where: { id: questionId },
            });

            if (!question) {
                throw new NotFoundException('Soru bulunamadı');
            }

            // Create favorite
            await this.prisma.questionFavorite.create({
                data: {
                    questionId,
                    userId,
                },
            });

            // Auto-follow when favoriting
            try {
                await this.prisma.questionFollower.create({
                    data: {
                        questionId,
                        userId,
                    },
                });
                this.logger.log(`Question auto-followed on favorite: ${questionId} by user ${userId}`);
            } catch (followError) {
                // Ignore if already following (duplicate error)
                if (followError.code !== 'P2002') {
                    this.logger.warn(`Could not auto-follow question ${questionId}:`, followError);
                }
            }

            this.logger.log(`Question favorited: ${questionId} by user ${userId}`);
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            // Ignore duplicate errors
            if (error.code === 'P2002') {
                return;
            }
            this.logger.error(`Error favoriting question ${questionId}:`, error);
            throw error;
        }
    }

    async unfavoriteQuestion(questionId: string, userId: string): Promise<void> {
        try {
            await this.prisma.questionFavorite.delete({
                where: {
                    questionId_userId: {
                        questionId,
                        userId,
                    },
                },
            });

            // Auto-unfollow when unfavoriting
            try {
                await this.prisma.questionFollower.delete({
                    where: {
                        questionId_userId: {
                            questionId,
                            userId,
                        },
                    },
                });
                this.logger.log(`Question auto-unfollowed on unfavorite: ${questionId} by user ${userId}`);
            } catch (unfollowError) {
                // Ignore if not following (not found error)
                if (unfollowError.code !== 'P2025') {
                    this.logger.warn(`Could not auto-unfollow question ${questionId}:`, unfollowError);
                }
            }

            this.logger.log(`Question unfavorited: ${questionId} by user ${userId}`);
        } catch (error) {
            // Ignore not found errors
            if (error.code === 'P2025') {
                return;
            }
            this.logger.error(`Error unfavoriting question ${questionId}:`, error);
            throw error;
        }
    }

    async followQuestion(questionId: string, userId: string): Promise<void> {
        try {
            const question = await this.prisma.question.findUnique({
                where: { id: questionId },
            });

            if (!question) {
                throw new NotFoundException('Soru bulunamadı');
            }

            await this.prisma.questionFollower.create({
                data: {
                    questionId,
                    userId,
                },
            });

            this.logger.log(`Question followed: ${questionId} by user ${userId}`);
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            // Ignore duplicate errors
            if (error.code === 'P2002') {
                return;
            }
            this.logger.error(`Error following question ${questionId}:`, error);
            throw error;
        }
    }

    async unfollowQuestion(questionId: string, userId: string): Promise<void> {
        try {
            await this.prisma.questionFollower.delete({
                where: {
                    questionId_userId: {
                        questionId,
                        userId,
                    },
                },
            });

            this.logger.log(`Question unfollowed: ${questionId} by user ${userId}`);
        } catch (error) {
            // Ignore not found errors
            if (error.code === 'P2025') {
                return;
            }
            this.logger.error(`Error unfollowing question ${questionId}:`, error);
            throw error;
        }
    }

    async followUser(targetUserId: string, userId: string): Promise<void> {
        try {
            if (targetUserId === userId) {
                throw new ForbiddenException('Kendinizi takip edemezsiniz');
            }

            await this.prisma.userFollower.create({
                data: {
                    followerId: userId,
                    followingId: targetUserId,
                },
            });

            this.logger.log(`User followed: ${targetUserId} by user ${userId}`);
        } catch (error) {
            if (error instanceof ForbiddenException) {
                throw error;
            }
            // Ignore duplicate errors
            if (error.code === 'P2002') {
                return;
            }
            this.logger.error(`Error following user ${targetUserId}:`, error);
            throw error;
        }
    }

    async unfollowUser(targetUserId: string, userId: string): Promise<void> {
        try {
            await this.prisma.userFollower.delete({
                where: {
                    followerId_followingId: {
                        followerId: userId,
                        followingId: targetUserId,
                    },
                },
            });

            this.logger.log(`User unfollowed: ${targetUserId} by user ${userId}`);
        } catch (error) {
            // Ignore not found errors
            if (error.code === 'P2025') {
                return;
            }
            this.logger.error(`Error unfollowing user ${targetUserId}:`, error);
            throw error;
        }
    }

    async getUserFollowers(userId: string): Promise<any[]> {
        try {
            const followers = await this.prisma.userFollower.findMany({
                where: { followingId: userId },
                include: {
                    follower: {
                        select: {
                            id: true,
                            username: true,
                            profile: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                    profilePictureUrl: true,
                                },
                            },
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            });

            return followers.map(f => ({
                ...sanitizePublicAuthor(f.follower),
                followedAt: f.createdAt,
            }));
        } catch (error) {
            this.logger.error(`Error fetching followers for user ${userId}:`, error);
            throw error;
        }
    }

    async getUserFollowing(userId: string): Promise<any[]> {
        try {
            const following = await this.prisma.userFollower.findMany({
                where: { followerId: userId },
                include: {
                    following: {
                        select: {
                            id: true,
                            username: true,
                            profile: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                    profilePictureUrl: true,
                                },
                            },
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            });

            return following.map(f => ({
                ...sanitizePublicAuthor(f.following),
                followedAt: f.createdAt,
            }));
        } catch (error) {
            this.logger.error(`Error fetching following for user ${userId}:`, error);
            throw error;
        }
    }

    // ==================== QUOTA MANAGEMENT ====================

    /**
     * Check if user can ask a question based on quota
     * Returns premium status and whether user can ask
     */
    private async checkQuota(userId: string): Promise<{ isPremium: boolean; canAsk: boolean }> {
        try {
            // Get user subscription
            const subscription = await this.prisma.subscription.findUnique({
                where: { userId },
            });

            const isPremium = subscription?.status === SubscriptionStatus.ACTIVE;
            const limit = isPremium ? 20 : 5;

            // Get or create quota for current month
            const monthKey = this.getCurrentMonthKey();
            let quota = await this.prisma.qnaQuota.findUnique({
                where: {
                    userId_monthKey: {
                        userId,
                        monthKey,
                    },
                },
            });

            if (!quota) {
                // Create new quota for this month
                quota = await this.prisma.qnaQuota.create({
                    data: {
                        userId,
                        monthKey,
                        questionsAsked: 0,
                        freeUserLimit: 5,
                        premiumUserLimit: 20,
                        resetsAt: this.getNextMonthStart(),
                    },
                });
            }

            const canAsk = quota.questionsAsked < limit;

            return { isPremium, canAsk };
        } catch (error) {
            this.logger.error(`Error checking quota for user ${userId}:`, error);
            throw error;
        }
    }

    /**
     * Increment question count in quota
     */
    private async incrementQuota(userId: string): Promise<void> {
        try {
            const monthKey = this.getCurrentMonthKey();

            await this.prisma.qnaQuota.upsert({
                where: {
                    userId_monthKey: {
                        userId,
                        monthKey,
                    },
                },
                update: {
                    questionsAsked: {
                        increment: 1,
                    },
                },
                create: {
                    userId,
                    monthKey,
                    questionsAsked: 1,
                    freeUserLimit: 5,
                    premiumUserLimit: 20,
                    resetsAt: this.getNextMonthStart(),
                },
            });
        } catch (error) {
            this.logger.error(`Error incrementing quota for user ${userId}:`, error);
            throw error;
        }
    }

    /**
     * Get current month key (YYYY-MM format)
     */
    private getCurrentMonthKey(): string {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    }

    /**
     * Get the start of next month
     */
    private getNextMonthStart(): Date {
        const now = new Date();
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return nextMonth;
    }

    /**
     * Get user's quota status
     * Public method for controllers to check quota
     */
    async getQuotaStatus(userId: string): Promise<{
        questionsAsked: number;
        limit: number;
        remaining: number;
        isPremium: boolean;
        resetsAt: Date;
    }> {
        try {
            this.logger.log(`Getting quota status for user: ${userId}`);

            if (!userId) {
                this.logger.error('No userId provided to getQuotaStatus');
                // Return default free user quota
                return {
                    questionsAsked: 0,
                    limit: 5,
                    remaining: 5,
                    isPremium: false,
                    resetsAt: this.getNextMonthStart(),
                };
            }

            const { isPremium } = await this.checkQuota(userId);
            const limit = isPremium ? 20 : 5;
            const monthKey = this.getCurrentMonthKey();

            this.logger.log(`User ${userId} - isPremium: ${isPremium}, limit: ${limit}, monthKey: ${monthKey}`);

            const quota = await this.prisma.qnaQuota.findUnique({
                where: {
                    userId_monthKey: {
                        userId,
                        monthKey,
                    },
                },
            });

            const questionsAsked = quota?.questionsAsked || 0;
            const remaining = Math.max(0, limit - questionsAsked);

            const result = {
                questionsAsked,
                limit,
                remaining,
                isPremium,
                resetsAt: quota?.resetsAt || this.getNextMonthStart(),
            };

            this.logger.log(`Quota result for user ${userId}:`, JSON.stringify(result));

            return result;
        } catch (error) {
            this.logger.error(`Error getting quota status for user ${userId}:`, error);
            // Return default free user quota on error
            return {
                questionsAsked: 0,
                limit: 5,
                remaining: 5,
                isPremium: false,
                resetsAt: this.getNextMonthStart(),
            };
        }
    }
}
