import { Module } from '@nestjs/common';
import { QnaService } from './qna.service';
import { VoteService } from './vote.service';
import { ReputationService } from './reputation.service';
import { ModerationService } from './moderation.service';
import { QnaNotificationService } from './qna-notification.service';
import { AnalyticsService } from './analytics.service';
import { SharingService } from './sharing.service';
import { QuestionsController } from './questions.controller';
import { AnswersController } from './answers.controller';
import { CommentsController } from './comments.controller';
import { InteractionsController } from './interactions.controller';
import { VoteController } from './vote.controller';
import { ReputationController } from './reputation.controller';
import { ModerationController } from './moderation.controller';
import { NotificationController } from './notification.controller';
import { AnalyticsController } from './analytics.controller';
import { SharingController } from './sharing.controller';
import { CommunitySettingsService } from './community-settings.service';
import { CommunitySettingsController } from './community-settings.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { RemindersModule } from '../reminders/reminders.module';
import { GamificationModule } from '../gamification/gamification.module';
import { OwnerGuard, QuestionOwnerGuard, AdminGuard } from './guards';

@Module({
    imports: [PrismaModule, RemindersModule, GamificationModule],
    controllers: [
        QuestionsController,
        AnswersController,
        CommentsController,
        InteractionsController,
        VoteController,
        ReputationController,
        ModerationController,
        NotificationController,
        AnalyticsController,
        SharingController,
        CommunitySettingsController,
    ],
    providers: [
        QnaService,
        VoteService,
        ReputationService,
        ModerationService,
        QnaNotificationService,
        AnalyticsService,
        SharingService,
        CommunitySettingsService,
        // Guards
        OwnerGuard,
        QuestionOwnerGuard,
        AdminGuard,
    ],
    exports: [
        QnaService,
        VoteService,
        ReputationService,
        ModerationService,
        QnaNotificationService,
        AnalyticsService,
        SharingService,
        CommunitySettingsService,
    ],
})
export class QnaModule { }
