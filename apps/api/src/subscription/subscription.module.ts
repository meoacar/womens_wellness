import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SubscriptionService } from './subscription.service';
import { ReceiptValidatorService } from './receipt-validator.service';
import { WebhookHandlerService } from './webhook-handler.service';
import { SubscriptionSchedulerService } from './subscription-scheduler.service';
import { SubscriptionNotificationService } from './subscription-notification.service';
import { SubscriptionAnalyticsService } from './subscription-analytics.service';
import { FinancialAnalyticsService } from './financial-analytics.service';
import { FinancialAnalyticsController } from './financial-analytics.controller';
import { SubscriptionController } from './subscription.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { RemindersModule } from '../reminders/reminders.module';
import { PremiumGuard } from './guards/premium.guard';
import { FeatureGuard } from './guards/feature.guard';
import { AppleWebhookGuard } from './guards/apple-webhook.guard';
import { GoogleWebhookGuard } from './guards/google-webhook.guard';

@Module({
    imports: [PrismaModule, ConfigModule, RemindersModule],
    controllers: [SubscriptionController, FinancialAnalyticsController],
    providers: [
        SubscriptionService,
        ReceiptValidatorService,
        WebhookHandlerService,
        SubscriptionSchedulerService,
        SubscriptionNotificationService,
        SubscriptionAnalyticsService,
        FinancialAnalyticsService,
        PremiumGuard,
        FeatureGuard,
        AppleWebhookGuard,
        GoogleWebhookGuard,
    ],
    exports: [
        SubscriptionService,
        ReceiptValidatorService,
        WebhookHandlerService,
        SubscriptionSchedulerService,
        SubscriptionNotificationService,
        SubscriptionAnalyticsService,
        FinancialAnalyticsService,
        PremiumGuard,
        FeatureGuard,
    ],
})
export class SubscriptionModule { }
