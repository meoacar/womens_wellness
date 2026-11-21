import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

export interface ShareLink {
    url: string;
    shortUrl?: string;
}

export interface ShareMetadata {
    title: string;
    description: string;
    image?: string;
    url: string;
    type: 'question' | 'answer';
}

@Injectable()
export class SharingService {
    private baseUrl: string;

    constructor(
        private prisma: PrismaService,
        private configService: ConfigService,
    ) {
        this.baseUrl = this.configService.get<string>('APP_URL') || 'https://app.example.com';
    }

    async generateQuestionShareLink(questionId: string): Promise<ShareLink> {
        // Verify question exists
        const question = await this.prisma.question.findUnique({
            where: { id: questionId },
        });

        if (!question) {
            throw new NotFoundException('Question not found');
        }

        const url = `${this.baseUrl}/community/${questionId}`;

        return {
            url,
            shortUrl: url, // In production, you could use a URL shortener service
        };
    }

    async generateAnswerShareLink(answerId: string): Promise<ShareLink> {
        // Verify answer exists and get question
        const answer = await this.prisma.answer.findUnique({
            where: { id: answerId },
            include: {
                question: true,
            },
        });

        if (!answer) {
            throw new NotFoundException('Answer not found');
        }

        const url = `${this.baseUrl}/community/${answer.questionId}?answer=${answerId}`;

        return {
            url,
            shortUrl: url,
        };
    }

    async getQuestionShareMetadata(questionId: string): Promise<ShareMetadata> {
        const question = await this.prisma.question.findUnique({
            where: { id: questionId },
            include: {
                user: {
                    select: {
                        username: true,
                        profile: {
                            select: {
                                profilePictureUrl: true,
                            },
                        },
                    },
                },
                _count: {
                    select: {
                        answers: true,
                    },
                },
            },
        });

        if (!question) {
            throw new NotFoundException('Question not found');
        }

        // Create a clean description (first 200 chars of content)
        const description = question.content.length > 200
            ? question.content.substring(0, 200) + '...'
            : question.content;

        // Use user profile picture only when question is not anonymous
        const image = question.isAnonymous
            ? undefined
            : question.user.profile?.profilePictureUrl || undefined;

        const answerText = question._count.answers === 1 ? 'cevap' : 'cevap';
        const title = `${question.title} - ${question._count.answers} ${answerText}`;

        return {
            title,
            description,
            image,
            url: `${this.baseUrl}/community/${questionId}`,
            type: 'question',
        };
    }

    async getAnswerShareMetadata(answerId: string): Promise<ShareMetadata> {
        const answer = await this.prisma.answer.findUnique({
            where: { id: answerId },
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
                        username: true,
                        profile: {
                            select: {
                                profilePictureUrl: true,
                            },
                        },
                    },
                },
            },
        });

        if (!answer) {
            throw new NotFoundException('Answer not found');
        }

        // Create a clean description (first 200 chars of answer content)
        const description = answer.content.length > 200
            ? answer.content.substring(0, 200) + '...'
            : answer.content;

        const isAnonymousAuthor = Boolean(
            answer.question.isAnonymous && answer.userId === answer.question.userId,
        );
        const image = isAnonymousAuthor
            ? undefined
            : answer.user.profile?.profilePictureUrl || undefined;

        const authorLabel = isAnonymousAuthor
            ? 'Anonim kullanıcı'
            : answer.user.username || 'Topluluk Üyesi';
        const title = `${authorLabel} cevabı: ${answer.question.title}`;

        return {
            title,
            description,
            image,
            url: `${this.baseUrl}/community/${answer.question.id}?answer=${answerId}`,
            type: 'answer',
        };
    }

    async trackShare(questionId: string): Promise<void> {
        // Track share event - could be used for analytics
        // For now, we'll just increment view count as a proxy
        await this.prisma.question.update({
            where: { id: questionId },
            data: {
                viewCount: {
                    increment: 1,
                },
            },
        });
    }
}
