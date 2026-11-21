import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../reminders/push.service';
import {
    QnaNotificationType,
    QnaNotificationData,
    QnaNotificationPreferences,
} from './dto/notification.dto';

@Injectable()
export class QnaNotificationService {
    private readonly logger = new Logger(QnaNotificationService.name);

    constructor(
        private prisma: PrismaService,
        private pushService: PushService,
    ) { }

    /**
     * Get user's QnA notification preferences
     */
    async getNotificationPreferences(
        userId: string,
    ): Promise<QnaNotificationPreferences> {
        const profile = await this.prisma.profile.findUnique({
            where: { userId },
        });

        if (!profile) {
            return this.getDefaultPreferences();
        }

        const preferencesJson = profile.preferencesJson as any;
        const qnaPreferences = preferencesJson?.qnaNotifications;

        if (!qnaPreferences) {
            return this.getDefaultPreferences();
        }

        return {
            newAnswers: qnaPreferences.newAnswers ?? true,
            answerVotes: qnaPreferences.answerVotes ?? true,
            bestAnswerSelected: qnaPreferences.bestAnswerSelected ?? true,
            comments: qnaPreferences.comments ?? true,
            followedContent: qnaPreferences.followedContent ?? true,
            badgesEarned: qnaPreferences.badgesEarned ?? true,
        };
    }

    /**
     * Update user's QnA notification preferences
     */
    async updateNotificationPreferences(
        userId: string,
        preferences: Partial<QnaNotificationPreferences>,
    ): Promise<QnaNotificationPreferences> {
        const profile = await this.prisma.profile.findUnique({
            where: { userId },
        });

        if (!profile) {
            throw new Error('Profile not found');
        }

        const preferencesJson = profile.preferencesJson as any;
        const currentQnaPreferences = preferencesJson?.qnaNotifications || {};

        const updatedQnaPreferences = {
            ...currentQnaPreferences,
            ...preferences,
        };

        await this.prisma.profile.update({
            where: { userId },
            data: {
                preferencesJson: {
                    ...preferencesJson,
                    qnaNotifications: updatedQnaPreferences,
                } as any,
            },
        });

        return updatedQnaPreferences;
    }

    /**
     * Send QnA notification to user
     */
    async sendNotification(
        userId: string,
        data: QnaNotificationData,
    ): Promise<void> {
        try {
            // Check if user wants this type of notification
            const preferences = await this.getNotificationPreferences(userId);
            if (!this.shouldSendNotification(data.type, preferences)) {
                this.logger.debug(
                    `Skipping notification for user ${userId} - preference disabled`,
                );
                return;
            }

            // Get notification content
            const { title, body } = this.getNotificationContent(data);

            // Send push notification
            const result = await this.pushService.sendPush(userId, {
                to: '', // Will be replaced by actual push token in PushService
                title,
                body,
                data: {
                    type: 'qna',
                    notificationType: data.type,
                    questionId: data.questionId,
                    answerId: data.answerId,
                    commentId: data.commentId,
                },
                sound: 'default',
            });

            if (result.status === 'ok') {
                this.logger.log(
                    `QnA notification sent to user ${userId}: ${data.type}`,
                );
            } else {
                this.logger.warn(
                    `Failed to send QnA notification to user ${userId}: ${result.message}`,
                );
            }
        } catch (error: any) {
            this.logger.error(
                `Error sending QnA notification to user ${userId}: ${error.message}`,
            );
        }
    }

    /**
     * Send notification to multiple users
     */
    async sendBatchNotifications(
        notifications: Array<{ userId: string; data: QnaNotificationData }>,
    ): Promise<void> {
        await Promise.all(
            notifications.map((n) => this.sendNotification(n.userId, n.data)),
        );
    }

    /**
     * Notify when new answer is posted
     */
    async notifyNewAnswer(
        questionId: string,
        answerId: string,
        answerUserId: string,
    ): Promise<void> {
        // Get question details
        const question = await this.prisma.question.findUnique({
            where: { id: questionId },
            include: {
                user: {
                    select: { id: true, username: true },
                },
            },
        });

        if (!question) return;

        const answer = await this.prisma.answer.findUnique({
            where: { id: answerId },
            include: {
                user: {
                    select: { username: true },
                },
            },
        });

        if (!answer) return;

        const actorName =
            question.isAnonymous && answerUserId === question.userId
                ? 'Soru Sahibi (Anonim)'
                : answer.user.username || 'Anonim';

        const notifications: Array<{ userId: string; data: QnaNotificationData }> =
            [];

        // Notify question author (if not the answer author)
        if (question.userId !== answerUserId) {
            notifications.push({
                userId: question.userId,
                data: {
                    type: QnaNotificationType.NEW_ANSWER,
                    questionId,
                    answerId,
                    questionTitle: question.title,
                    username: actorName,
                },
            });
        }

        // Notify followers of the question
        const followers = await this.prisma.questionFollower.findMany({
            where: {
                questionId,
                userId: { not: answerUserId }, // Don't notify the answer author
            },
            select: { userId: true },
        });

        followers.forEach((follower) => {
            notifications.push({
                userId: follower.userId,
                data: {
                    type: QnaNotificationType.FOLLOWED_QUESTION_ANSWERED,
                    questionId,
                    answerId,
                    questionTitle: question.title,
                    username: actorName,
                },
            });
        });

        await this.sendBatchNotifications(notifications);
    }

    /**
     * Notify when answer is voted
     */
    async notifyAnswerVoted(
        answerId: string,
        voteType: 'UPVOTE' | 'DOWNVOTE',
        voterId: string,
    ): Promise<void> {
        const answer = await this.prisma.answer.findUnique({
            where: { id: answerId },
            include: {
                question: {
                    select: { title: true },
                },
                user: {
                    select: { id: true },
                },
            },
        });

        if (!answer || answer.userId === voterId) return;

        // Only notify on upvotes (downvotes might be discouraging)
        if (voteType === 'UPVOTE') {
            await this.sendNotification(answer.userId, {
                type: QnaNotificationType.ANSWER_VOTED,
                answerId,
                questionId: answer.questionId,
                questionTitle: answer.question.title,
                voteType,
            });
        }
    }

    /**
     * Notify when answer is marked as best
     */
    async notifyBestAnswerSelected(
        answerId: string,
        questionId: string,
    ): Promise<void> {
        const answer = await this.prisma.answer.findUnique({
            where: { id: answerId },
            include: {
                question: {
                    select: { title: true, userId: true },
                },
                user: {
                    select: { id: true },
                },
            },
        });

        if (!answer) return;

        // Don't notify if question author selected their own answer
        if (answer.userId === answer.question.userId) return;

        await this.sendNotification(answer.userId, {
            type: QnaNotificationType.BEST_ANSWER_SELECTED,
            answerId,
            questionId,
            questionTitle: answer.question.title,
        });
    }

    /**
     * Notify when question is commented
     */
    async notifyQuestionCommented(
        questionId: string,
        commentId: string,
        commenterId: string,
    ): Promise<void> {
        const question = await this.prisma.question.findUnique({
            where: { id: questionId },
            include: {
                user: {
                    select: { id: true },
                },
            },
        });

        if (!question || question.userId === commenterId) return;

        const comment = await this.prisma.questionComment.findUnique({
            where: { id: commentId },
            include: {
                user: {
                    select: { username: true },
                },
            },
        });

        if (!comment) return;

        await this.sendNotification(question.userId, {
            type: QnaNotificationType.QUESTION_COMMENTED,
            questionId,
            commentId,
            questionTitle: question.title,
            username: comment.user.username || 'Anonim',
        });
    }

    /**
     * Notify when answer is commented
     */
    async notifyAnswerCommented(
        answerId: string,
        commentId: string,
        commenterId: string,
    ): Promise<void> {
        const answer = await this.prisma.answer.findUnique({
            where: { id: answerId },
            include: {
                question: {
                    select: { title: true, isAnonymous: true, userId: true },
                },
                user: {
                    select: { id: true },
                },
            },
        });

        if (!answer || answer.userId === commenterId) return;

        const comment = await this.prisma.answerComment.findUnique({
            where: { id: commentId },
            include: {
                user: {
                    select: { username: true },
                },
            },
        });

        if (!comment) return;

        const actorName =
            answer.question.isAnonymous && commenterId === answer.question.userId
                ? 'Soru Sahibi (Anonim)'
                : comment.user.username || 'Anonim';

        await this.sendNotification(answer.userId, {
            type: QnaNotificationType.ANSWER_COMMENTED,
            answerId,
            commentId,
            questionId: answer.questionId,
            questionTitle: answer.question.title,
            username: actorName,
        });
    }

    /**
     * Notify followers when user asks a question
     */
    async notifyFollowedUserAsked(
        questionId: string,
        userId: string,
    ): Promise<void> {
        const question = await this.prisma.question.findUnique({
            where: { id: questionId },
            include: {
                user: {
                    select: { username: true },
                },
            },
        });

        if (!question) return;

        // Get user's followers
        const followers = await this.prisma.userFollower.findMany({
            where: { followingId: userId },
            select: { followerId: true },
        });

        const notifications = followers.map((follower) => ({
            userId: follower.followerId,
            data: {
                type: QnaNotificationType.FOLLOWED_USER_ASKED,
                questionId,
                userId,
                questionTitle: question.title,
                username: question.user.username || 'Anonim',
            } as QnaNotificationData,
        }));

        await this.sendBatchNotifications(notifications);
    }

    /**
     * Notify when user earns a badge
     */
    async notifyBadgeEarned(
        userId: string,
        badgeId: string,
    ): Promise<void> {
        const badge = await this.prisma.badge.findUnique({
            where: { id: badgeId },
        });

        if (!badge) return;

        await this.sendNotification(userId, {
            type: QnaNotificationType.BADGE_EARNED,
            badgeId,
            badgeName: badge.nameTr, // Use Turkish name by default
        });
    }

    /**
     * Check if notification should be sent based on preferences
     */
    private shouldSendNotification(
        type: QnaNotificationType,
        preferences: QnaNotificationPreferences,
    ): boolean {
        switch (type) {
            case QnaNotificationType.NEW_ANSWER:
                return preferences.newAnswers;
            case QnaNotificationType.ANSWER_VOTED:
                return preferences.answerVotes;
            case QnaNotificationType.BEST_ANSWER_SELECTED:
                return preferences.bestAnswerSelected;
            case QnaNotificationType.QUESTION_COMMENTED:
            case QnaNotificationType.ANSWER_COMMENTED:
                return preferences.comments;
            case QnaNotificationType.FOLLOWED_QUESTION_ANSWERED:
            case QnaNotificationType.FOLLOWED_USER_ASKED:
                return preferences.followedContent;
            case QnaNotificationType.BADGE_EARNED:
                return preferences.badgesEarned;
            default:
                return true;
        }
    }

    /**
     * Get notification title and body based on type
     */
    private getNotificationContent(data: QnaNotificationData): {
        title: string;
        body: string;
    } {
        switch (data.type) {
            case QnaNotificationType.NEW_ANSWER:
                return {
                    title: 'Yeni Cevap',
                    body: `${data.username} sorunuza cevap verdi: "${this.truncate(data.questionTitle || '', 50)}"`,
                };

            case QnaNotificationType.ANSWER_VOTED:
                return {
                    title: 'Cevabınız Beğenildi',
                    body: `Cevabınız olumlu oy aldı: "${this.truncate(data.questionTitle || '', 50)}"`,
                };

            case QnaNotificationType.BEST_ANSWER_SELECTED:
                return {
                    title: '🏆 En İyi Cevap',
                    body: `Cevabınız en iyi cevap seçildi: "${this.truncate(data.questionTitle || '', 50)}"`,
                };

            case QnaNotificationType.QUESTION_COMMENTED:
                return {
                    title: 'Yeni Yorum',
                    body: `${data.username} sorunuza yorum yaptı: "${this.truncate(data.questionTitle || '', 50)}"`,
                };

            case QnaNotificationType.ANSWER_COMMENTED:
                return {
                    title: 'Yeni Yorum',
                    body: `${data.username} cevabınıza yorum yaptı: "${this.truncate(data.questionTitle || '', 50)}"`,
                };

            case QnaNotificationType.FOLLOWED_QUESTION_ANSWERED:
                return {
                    title: 'Takip Ettiğiniz Soru',
                    body: `${data.username} takip ettiğiniz soruya cevap verdi: "${this.truncate(data.questionTitle || '', 50)}"`,
                };

            case QnaNotificationType.FOLLOWED_USER_ASKED:
                return {
                    title: 'Takip Ettiğiniz Kullanıcı',
                    body: `${data.username} yeni bir soru sordu: "${this.truncate(data.questionTitle || '', 50)}"`,
                };

            case QnaNotificationType.BADGE_EARNED:
                return {
                    title: '🎖️ Yeni Rozet',
                    body: `Tebrikler! "${data.badgeName}" rozetini kazandınız!`,
                };

            default:
                return {
                    title: 'Topluluk Bildirimi',
                    body: 'Yeni bir aktivite var',
                };
        }
    }

    /**
     * Get default notification preferences
     */
    private getDefaultPreferences(): QnaNotificationPreferences {
        return {
            newAnswers: true,
            answerVotes: true,
            bestAnswerSelected: true,
            comments: true,
            followedContent: true,
            badgesEarned: true,
        };
    }

    /**
     * Truncate text to specified length
     */
    private truncate(text: string, maxLength: number): string {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }
}
