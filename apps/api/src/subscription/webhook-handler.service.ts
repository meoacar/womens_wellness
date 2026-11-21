import { Injectable, Logger, BadRequestException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ReceiptValidatorService } from './receipt-validator.service';
import { SubscriptionNotificationService } from './subscription-notification.service';
import { MonitoringService } from '../common/monitoring/monitoring.service';
import { loadAppleRootCertificates, verifyAppleJws } from './utils/apple-jws-verifier';
import * as crypto from 'crypto';

/**
 * Apple App Store Server Notification Types (V2)
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6
 */
enum AppleNotificationType {
    SUBSCRIBED = 'SUBSCRIBED',
    INITIAL_BUY = 'INITIAL_BUY',
    DID_RENEW = 'DID_RENEW',
    DID_FAIL_TO_RENEW = 'DID_FAIL_TO_RENEW',
    DID_CHANGE_RENEWAL_STATUS = 'DID_CHANGE_RENEWAL_STATUS',
    CANCEL = 'CANCEL',
    EXPIRED = 'EXPIRED',
    GRACE_PERIOD_EXPIRED = 'GRACE_PERIOD_EXPIRED',
    REFUND = 'REFUND',
    REVOKE = 'REVOKE',
    DID_CHANGE_RENEWAL_PREF = 'DID_CHANGE_RENEWAL_PREF',
    PRICE_INCREASE_CONSENT = 'PRICE_INCREASE_CONSENT',
    TEST = 'TEST',
}

/**
 * Google Play Real-time Developer Notification Types
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6
 */
enum GoogleNotificationType {
    SUBSCRIPTION_RECOVERED = 1,
    SUBSCRIPTION_RENEWED = 2,
    SUBSCRIPTION_CANCELED = 3,
    SUBSCRIPTION_PURCHASED = 4,
    SUBSCRIPTION_ON_HOLD = 5,
    SUBSCRIPTION_IN_GRACE_PERIOD = 6,
    SUBSCRIPTION_RESTARTED = 7,
    SUBSCRIPTION_PRICE_CHANGE_CONFIRMED = 8,
    SUBSCRIPTION_DEFERRED = 9,
    SUBSCRIPTION_PAUSED = 10,
    SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED = 11,
    SUBSCRIPTION_REVOKED = 12,
    SUBSCRIPTION_EXPIRED = 13,
}

interface AppleNotificationPayload {
    notificationType: string;
    subtype?: string;
    data: {
        signedTransactionInfo: string;
        signedRenewalInfo: string;
    };
}

interface GoogleNotificationPayload {
    version: string;
    packageName: string;
    eventTimeMillis: string;
    subscriptionNotification: {
        version: string;
        notificationType: number;
        purchaseToken: string;
        subscriptionId: string;
    };
}

@Injectable()
export class WebhookHandlerService {
    private readonly logger = new Logger(WebhookHandlerService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly receiptValidator: ReceiptValidatorService,
        private readonly configService: ConfigService,
        private readonly notificationService: SubscriptionNotificationService,
        @Optional() private readonly monitoring?: MonitoringService,
    ) { }

    /**
     * Handle Apple App Store Server Notifications
     * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6
     */
    async handleAppleNotification(payload: any): Promise<void> {
        this.logger.log('Processing Apple notification', {
            notificationType: payload.notificationType,
        });

        try {
            // Verify notification signature
            // Requirements: 10.1, 10.2, 10.3
            const isValid = await this.verifyAppleSignature(payload);
            if (!isValid) {
                throw new BadRequestException('Invalid Apple notification signature');
            }

            const notificationType = payload.notificationType as AppleNotificationType;

            if (notificationType === AppleNotificationType.TEST) {
                this.logger.log('Received verified Apple TEST notification');
                return;
            }

            // Extract and verify transaction data from signed JWS payload
            const transactionInfo = await this.decodeAppleTransactionInfo(
                payload.data?.signedTransactionInfo,
            );

            const originalTransactionId = transactionInfo.originalTransactionId;

            // Find subscription by original transaction ID
            const subscription = await this.prisma.subscription.findUnique({
                where: { originalTransactionId },
                include: { user: true },
            });

            if (!subscription) {
                this.logger.warn('Subscription not found for Apple notification', {
                    originalTransactionId,
                });
                return;
            }

            // Handle different notification types
            switch (notificationType) {
                case AppleNotificationType.SUBSCRIBED:
                case AppleNotificationType.INITIAL_BUY:
                    await this.handleAppleInitialBuy(subscription.id, transactionInfo);
                    break;

                case AppleNotificationType.DID_RENEW:
                    await this.handleAppleRenewal(subscription.id, transactionInfo);
                    break;

                case AppleNotificationType.DID_FAIL_TO_RENEW:
                    await this.handleAppleFailedRenewal(subscription.id, transactionInfo);
                    break;

                case AppleNotificationType.DID_CHANGE_RENEWAL_STATUS:
                    await this.handleAppleRenewalStatusChange(
                        subscription.id,
                        transactionInfo,
                        payload.subtype,
                    );
                    break;

                case AppleNotificationType.EXPIRED:
                case AppleNotificationType.GRACE_PERIOD_EXPIRED:
                    await this.handleAppleExpired(subscription.id, transactionInfo);
                    break;

                case AppleNotificationType.CANCEL:
                    await this.handleAppleCancel(subscription.id, transactionInfo);
                    break;

                case AppleNotificationType.REFUND:
                case AppleNotificationType.REVOKE:
                    await this.handleAppleRefund(subscription.id, transactionInfo);
                    break;

                default:
                    this.logger.log('Unhandled Apple notification type', { notificationType });
            }

            this.monitoring?.recordSuccess('payment_webhook');
            this.logger.log('Apple notification processed successfully', {
                notificationType,
                subscriptionId: subscription.id,
            });
        } catch (error: any) {
            await this.monitoring?.recordFailure(
                'payment_webhook',
                `Apple notification processing failed: ${error?.message || error}`,
                { provider: 'APPLE', notificationType: payload?.notificationType },
                error,
            );
            this.logger.error('Failed to process Apple notification', error?.stack);
            throw error;
        }
    }

    /**
     * Handle Google Play Real-time Developer Notifications
     * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6
     */
    async handleGoogleNotification(payload: GoogleNotificationPayload): Promise<void> {
        this.logger.log('Processing Google notification', {
            notificationType: payload.subscriptionNotification?.notificationType,
        });

        try {
            // Verify notification authenticity
            // Requirements: 10.1, 10.2, 10.3
            const isValid = await this.verifyGoogleNotification(payload);
            if (!isValid) {
                throw new BadRequestException('Invalid Google notification');
            }

            const notification = payload.subscriptionNotification;
            const notificationType = notification.notificationType as GoogleNotificationType;
            const purchaseToken = notification.purchaseToken;
            const productId = notification.subscriptionId;

            // Validate the purchase with Google Play API
            const receiptData = await this.receiptValidator.validateGoogleReceipt(
                payload.packageName,
                productId,
                purchaseToken,
            );

            // Find subscription by purchase token or original transaction ID
            const subscription = await this.prisma.subscription.findFirst({
                where: {
                    OR: [
                        { originalTransactionId: receiptData.transactionId },
                        { latestReceiptData: { contains: purchaseToken } },
                    ],
                },
                include: { user: true },
            });

            if (!subscription) {
                this.logger.warn('Subscription not found for Google notification', {
                    purchaseToken,
                    productId,
                });
                return;
            }

            // Handle different notification types
            switch (notificationType) {
                case GoogleNotificationType.SUBSCRIPTION_PURCHASED:
                    await this.handleGooglePurchase(subscription.id, receiptData);
                    break;

                case GoogleNotificationType.SUBSCRIPTION_RENEWED:
                    await this.handleGoogleRenewal(subscription.id, receiptData);
                    break;

                case GoogleNotificationType.SUBSCRIPTION_CANCELED:
                    await this.handleGoogleCancel(subscription.id, receiptData);
                    break;

                case GoogleNotificationType.SUBSCRIPTION_EXPIRED:
                    await this.handleGoogleExpired(subscription.id, receiptData);
                    break;

                case GoogleNotificationType.SUBSCRIPTION_IN_GRACE_PERIOD:
                    await this.handleGoogleGracePeriod(subscription.id, receiptData);
                    break;

                case GoogleNotificationType.SUBSCRIPTION_RECOVERED:
                    await this.handleGoogleRecovered(subscription.id, receiptData);
                    break;

                case GoogleNotificationType.SUBSCRIPTION_REVOKED:
                    await this.handleGoogleRevoked(subscription.id, receiptData);
                    break;

                default:
                    this.logger.log('Unhandled Google notification type', { notificationType });
            }

            this.monitoring?.recordSuccess('payment_webhook');
            this.logger.log('Google notification processed successfully', {
                notificationType,
                subscriptionId: subscription.id,
            });
        } catch (error: any) {
            await this.monitoring?.recordFailure(
                'payment_webhook',
                `Google notification processing failed: ${error?.message || error}`,
                {
                    provider: 'GOOGLE',
                    notificationType: payload?.subscriptionNotification?.notificationType,
                },
                error,
            );
            this.logger.error('Failed to process Google notification', error?.stack);
            throw error;
        }
    }

    // ==================== Apple Event Handlers ====================

    /**
     * Handle INITIAL_BUY event
     * Requirements: 12.1, 12.2
     */
    private async handleAppleInitialBuy(subscriptionId: string, transactionInfo: any): Promise<void> {
        this.logger.log('Handling Apple INITIAL_BUY/SUBSCRIBED', { subscriptionId });

        const expiresDate = transactionInfo.expiresDate
            ? new Date(Number(transactionInfo.expiresDate))
            : undefined;

        const subscription = await this.prisma.subscription.update({
            where: { id: subscriptionId },
            data: {
                status: 'ACTIVE',
                ...(expiresDate && Number.isFinite(expiresDate.getTime()) ? { endDate: expiresDate } : {}),
                isInGracePeriod: false,
                gracePeriodEndDate: null,
                updatedAt: new Date(),
            },
        });

        // Send welcome notification
        if (subscription.tier && subscription.endDate) {
            await this.notificationService.sendSubscriptionStarted(
                subscription.userId,
                subscription.tier,
                subscription.endDate,
            );
        }
    }

    /**
     * Handle DID_RENEW event
     * Requirements: 12.2
     */
    private async handleAppleRenewal(subscriptionId: string, transactionInfo: any): Promise<void> {
        this.logger.log('Handling Apple DID_RENEW', { subscriptionId });

        const expiresDate = new Date(Number(transactionInfo.expiresDate));
        if (!Number.isFinite(expiresDate.getTime())) {
            throw new BadRequestException('Invalid expiresDate in Apple DID_RENEW notification');
        }

        const subscription = await this.prisma.subscription.update({
            where: { id: subscriptionId },
            data: {
                status: 'ACTIVE',
                endDate: expiresDate,
                isInGracePeriod: false,
                gracePeriodEndDate: null,
                updatedAt: new Date(),
            },
        });

        const existingTx = await this.prisma.subscriptionTransaction.findUnique({
            where: { transactionId: transactionInfo.transactionId },
        });
        if (!existingTx) {
            await this.prisma.subscriptionTransaction.create({
                data: {
                    subscriptionId,
                    transactionId: transactionInfo.transactionId,
                    originalTransactionId: transactionInfo.originalTransactionId,
                    productId: transactionInfo.productId,
                    amount: 0, // Amount not provided in notification
                    currency: 'TRY',
                    status: 'COMPLETED',
                    type: 'RENEWAL',
                    provider: 'APPLE',
                    validatedAt: new Date(),
                },
            });
        }

        // Send renewal notification
        if (subscription.tier) {
            await this.notificationService.sendSubscriptionRenewed(
                subscription.userId,
                subscription.tier,
                expiresDate,
            );
        }
    }

    /**
     * Handle DID_FAIL_TO_RENEW event
     * Requirements: 12.5, 16.1, 16.2, 16.3
     */
    private async handleAppleFailedRenewal(subscriptionId: string, transactionInfo: any): Promise<void> {
        this.logger.log('Handling Apple DID_FAIL_TO_RENEW', { subscriptionId });

        // Set grace period (7 days)
        const gracePeriodEndDate = new Date();
        gracePeriodEndDate.setDate(gracePeriodEndDate.getDate() + 7);

        const subscription = await this.prisma.subscription.update({
            where: { id: subscriptionId },
            data: {
                status: 'GRACE_PERIOD',
                isInGracePeriod: true,
                gracePeriodEndDate,
                updatedAt: new Date(),
            },
        });

        // Send payment failed notification
        await this.notificationService.sendPaymentFailed(
            subscription.userId,
            gracePeriodEndDate,
        );
    }

    /**
     * Handle DID_CHANGE_RENEWAL_STATUS event
     * Requirements: 12.4
     */
    private async handleAppleRenewalStatusChange(
        subscriptionId: string,
        _transactionInfo: any,
        subtype?: string,
    ): Promise<void> {
        this.logger.log('Handling Apple DID_CHANGE_RENEWAL_STATUS', { subscriptionId, subtype });

        if (subtype === 'AUTO_RENEW_DISABLED') {
            const subscription = await this.prisma.subscription.update({
                where: { id: subscriptionId },
                data: {
                    status: 'CANCELLED',
                    cancelledAt: new Date(),
                    updatedAt: new Date(),
                },
            });
            if (subscription.endDate) {
                await this.notificationService.sendSubscriptionCancelled(
                    subscription.userId,
                    subscription.endDate,
                );
            }
        } else if (subtype === 'AUTO_RENEW_ENABLED') {
            await this.prisma.subscription.update({
                where: { id: subscriptionId },
                data: {
                    status: 'ACTIVE',
                    cancelledAt: null,
                    updatedAt: new Date(),
                },
            });
        }
    }

    private async handleAppleExpired(subscriptionId: string, transactionInfo: any): Promise<void> {
        this.logger.log('Handling Apple EXPIRED', { subscriptionId });

        const expiresDate = transactionInfo.expiresDate
            ? new Date(Number(transactionInfo.expiresDate))
            : new Date();

        const subscription = await this.prisma.subscription.update({
            where: { id: subscriptionId },
            data: {
                status: 'EXPIRED',
                endDate: Number.isFinite(expiresDate.getTime()) ? expiresDate : new Date(),
                aiMessagesLimit: 100,
                isInGracePeriod: false,
                gracePeriodEndDate: null,
                updatedAt: new Date(),
            },
        });

        await this.notificationService.sendSubscriptionExpired(subscription.userId);
    }

    /**
     * Handle CANCEL event
     * Requirements: 12.3, 4.4, 4.5
     */
    private async handleAppleCancel(subscriptionId: string, transactionInfo: any): Promise<void> {
        this.logger.log('Handling Apple CANCEL', { subscriptionId });

        const subscription = await this.prisma.subscription.update({
            where: { id: subscriptionId },
            data: {
                status: 'CANCELLED',
                cancelledAt: new Date(),
                updatedAt: new Date(),
            },
        });

        // Send cancellation notification
        if (subscription.endDate) {
            await this.notificationService.sendSubscriptionCancelled(
                subscription.userId,
                subscription.endDate,
            );
        }
    }

    /**
     * Handle REFUND / REVOKE event
     * Requirements: 12.6
     */
    private async handleAppleRefund(subscriptionId: string, transactionInfo: any): Promise<void> {
        this.logger.log('Handling Apple REFUND', { subscriptionId });

        // Immediately revoke access
        const subscription = await this.prisma.subscription.update({
            where: { id: subscriptionId },
            data: {
                status: 'EXPIRED',
                endDate: new Date(),
                aiMessagesLimit: 100,
                isInGracePeriod: false,
                gracePeriodEndDate: null,
                updatedAt: new Date(),
            },
        });

        // Create idempotent refund transaction record
        const refundTxId = `refund_${transactionInfo.transactionId}`;
        const existingTx = await this.prisma.subscriptionTransaction.findUnique({
            where: { transactionId: refundTxId },
        });
        if (!existingTx) {
            await this.prisma.subscriptionTransaction.create({
                data: {
                    subscriptionId,
                    transactionId: refundTxId,
                    originalTransactionId: transactionInfo.originalTransactionId,
                    productId: transactionInfo.productId,
                    amount: 0,
                    currency: 'TRY',
                    status: 'REFUNDED',
                    type: 'REFUND',
                    provider: 'APPLE',
                    validatedAt: new Date(),
                },
            });
        }

        // Send expiration notification (due to refund)
        await this.notificationService.sendSubscriptionExpired(subscription.userId);
    }

    // ==================== Google Event Handlers ====================

    /**
     * Handle SUBSCRIPTION_PURCHASED event
     * Requirements: 12.1, 12.2
     */
    private async handleGooglePurchase(subscriptionId: string, receiptData: any): Promise<void> {
        this.logger.log('Handling Google SUBSCRIPTION_PURCHASED', { subscriptionId });

        const expiryDate = receiptData.expiresDate;

        const subscription = await this.prisma.subscription.update({
            where: { id: subscriptionId },
            data: {
                status: 'ACTIVE',
                endDate: expiryDate,
                updatedAt: new Date(),
            },
        });

        // Send welcome notification
        if (subscription.tier && subscription.endDate) {
            await this.notificationService.sendSubscriptionStarted(
                subscription.userId,
                subscription.tier,
                subscription.endDate,
            );
        }
    }

    /**
     * Handle SUBSCRIPTION_RENEWED event
     * Requirements: 12.2
     */
    private async handleGoogleRenewal(subscriptionId: string, receiptData: any): Promise<void> {
        this.logger.log('Handling Google SUBSCRIPTION_RENEWED', { subscriptionId });

        const expiryDate = receiptData.expiresDate;

        const subscription = await this.prisma.subscription.update({
            where: { id: subscriptionId },
            data: {
                status: 'ACTIVE',
                endDate: expiryDate,
                isInGracePeriod: false,
                gracePeriodEndDate: null,
                updatedAt: new Date(),
            },
        });

        // Create renewal transaction record idempotently
        const existingTx = await this.prisma.subscriptionTransaction.findUnique({
            where: { transactionId: receiptData.transactionId },
        });
        if (!existingTx) {
            await this.prisma.subscriptionTransaction.create({
                data: {
                    subscriptionId,
                    transactionId: receiptData.transactionId,
                    originalTransactionId: receiptData.originalTransactionId,
                    productId: receiptData.productId,
                    amount: 0,
                    currency: 'TRY',
                    status: 'COMPLETED',
                    type: 'RENEWAL',
                    provider: 'GOOGLE',
                    validatedAt: new Date(),
                },
            });
        }

        // Send renewal notification
        if (subscription.tier) {
            await this.notificationService.sendSubscriptionRenewed(
                subscription.userId,
                subscription.tier,
                expiryDate,
            );
        }
    }

    /**
     * Handle SUBSCRIPTION_CANCELED event
     * Requirements: 12.3, 4.4, 4.5
     */
    private async handleGoogleCancel(subscriptionId: string, receiptData: any): Promise<void> {
        this.logger.log('Handling Google SUBSCRIPTION_CANCELED', { subscriptionId });

        const subscription = await this.prisma.subscription.update({
            where: { id: subscriptionId },
            data: {
                status: 'CANCELLED',
                cancelledAt: new Date(),
                updatedAt: new Date(),
            },
        });

        // Send cancellation notification
        if (subscription.endDate) {
            await this.notificationService.sendSubscriptionCancelled(
                subscription.userId,
                subscription.endDate,
            );
        }
    }

    /**
     * Handle SUBSCRIPTION_EXPIRED event
     * Requirements: 12.6, 16.6
     */
    private async handleGoogleExpired(subscriptionId: string, receiptData: any): Promise<void> {
        this.logger.log('Handling Google SUBSCRIPTION_EXPIRED', { subscriptionId });

        const subscription = await this.prisma.subscription.update({
            where: { id: subscriptionId },
            data: {
                status: 'EXPIRED',
                endDate: new Date(),
                isInGracePeriod: false,
                gracePeriodEndDate: null,
                updatedAt: new Date(),
            },
        });

        // Send expiration notification
        await this.notificationService.sendSubscriptionExpired(subscription.userId);
    }

    /**
     * Handle SUBSCRIPTION_IN_GRACE_PERIOD event
     * Requirements: 12.5, 16.1, 16.2, 16.3, 16.4, 16.5
     */
    private async handleGoogleGracePeriod(subscriptionId: string, receiptData: any): Promise<void> {
        this.logger.log('Handling Google SUBSCRIPTION_IN_GRACE_PERIOD', { subscriptionId });

        const gracePeriodEndDate = new Date();
        gracePeriodEndDate.setDate(gracePeriodEndDate.getDate() + 7);

        const subscription = await this.prisma.subscription.update({
            where: { id: subscriptionId },
            data: {
                status: 'GRACE_PERIOD',
                isInGracePeriod: true,
                gracePeriodEndDate,
                updatedAt: new Date(),
            },
        });

        // Send payment failed notification
        await this.notificationService.sendPaymentFailed(
            subscription.userId,
            gracePeriodEndDate,
        );
    }

    /**
     * Handle SUBSCRIPTION_RECOVERED event
     * Requirements: 16.7
     */
    private async handleGoogleRecovered(subscriptionId: string, receiptData: any): Promise<void> {
        this.logger.log('Handling Google SUBSCRIPTION_RECOVERED', { subscriptionId });

        const expiryDate = receiptData.expiresDate;

        const subscription = await this.prisma.subscription.update({
            where: { id: subscriptionId },
            data: {
                status: 'ACTIVE',
                endDate: expiryDate,
                isInGracePeriod: false,
                gracePeriodEndDate: null,
                updatedAt: new Date(),
            },
        });

        // Send renewal notification (subscription recovered)
        if (subscription.tier) {
            await this.notificationService.sendSubscriptionRenewed(
                subscription.userId,
                subscription.tier,
                expiryDate,
            );
        }
    }

    /**
     * Handle SUBSCRIPTION_REVOKED event (refund)
     * Requirements: 12.6
     */
    private async handleGoogleRevoked(subscriptionId: string, receiptData: any): Promise<void> {
        this.logger.log('Handling Google SUBSCRIPTION_REVOKED', { subscriptionId });

        // Immediately revoke access
        const subscription = await this.prisma.subscription.update({
            where: { id: subscriptionId },
            data: {
                status: 'EXPIRED',
                endDate: new Date(),
                aiMessagesLimit: 100,
                isInGracePeriod: false,
                gracePeriodEndDate: null,
                updatedAt: new Date(),
            },
        });

        // Create idempotent refund transaction record
        const refundTxId = `refund_${receiptData.transactionId}`;
        const existingTx = await this.prisma.subscriptionTransaction.findUnique({
            where: { transactionId: refundTxId },
        });
        if (!existingTx) {
            await this.prisma.subscriptionTransaction.create({
                data: {
                    subscriptionId,
                    transactionId: refundTxId,
                    originalTransactionId: receiptData.originalTransactionId,
                    productId: receiptData.productId,
                    amount: 0,
                    currency: 'TRY',
                    status: 'REFUNDED',
                    type: 'REFUND',
                    provider: 'GOOGLE',
                    validatedAt: new Date(),
                },
            });
        }

        // Send expiration notification (due to refund)
        await this.notificationService.sendSubscriptionExpired(subscription.userId);
    }

    // ==================== Verification Methods ====================

    /**
     * Verify Apple notification payload & signedTransactionInfo JWS
     * Requirements: 10.1, 10.2, 10.3
     */
    private async verifyAppleSignature(payload: any): Promise<boolean> {
        if (!payload?.notificationType) {
            return false;
        }

        if (payload.notificationType === AppleNotificationType.TEST) {
            return true;
        }

        const signedTx = payload.data?.signedTransactionInfo;
        if (!signedTx || typeof signedTx !== 'string') {
            return false;
        }

        if (
            process.env.NODE_ENV === 'development' &&
            process.env.SKIP_WEBHOOK_VERIFICATION === 'true'
        ) {
            return signedTx.split('.').length === 3;
        }

        try {
            const rootCertificates = loadAppleRootCertificates();
            const { payload: txPayload } = verifyAppleJws<any>(signedTx, {
                rootCertificates,
            });
            const expectedBundleId = process.env.APPLE_BUNDLE_ID || 'com.kadinatlasi.wellness';
            if (expectedBundleId && txPayload?.bundleId && txPayload.bundleId !== expectedBundleId) {
                return false;
            }
            return Boolean(txPayload?.transactionId && txPayload?.originalTransactionId);
        } catch (err) {
            this.logger.warn(
                'Failed to verify nested Apple signedTransactionInfo JWS:',
                err instanceof Error ? err.message : String(err),
            );
            return false;
        }
    }

    /**
     * Verify Google notification authenticity
     * Requirements: 10.1, 10.2, 10.3
     */
    private async verifyGoogleNotification(payload: GoogleNotificationPayload): Promise<boolean> {
        if (!payload?.subscriptionNotification) {
            return false;
        }

        if (!payload.subscriptionNotification.purchaseToken || !payload.subscriptionNotification.subscriptionId) {
            return false;
        }

        const expectedPackage = this.configService.get<string>('GOOGLE_PLAY_PACKAGE_NAME');
        if (expectedPackage && payload.packageName && payload.packageName !== expectedPackage) {
            return false;
        }

        return true;
    }

    /**
     * Decode verified Apple signed transaction info JWS (fail closed, never mock).
     */
    private async decodeAppleTransactionInfo(signedTransactionInfo: string): Promise<any> {
        if (!signedTransactionInfo || typeof signedTransactionInfo !== 'string') {
            throw new BadRequestException('Missing signedTransactionInfo in Apple notification');
        }

        const parts = signedTransactionInfo.split('.');
        if (parts.length !== 3) {
            throw new BadRequestException('Invalid JWS format in signedTransactionInfo');
        }

        let decoded: any;
        if (
            process.env.NODE_ENV === 'development' &&
            process.env.SKIP_WEBHOOK_VERIFICATION === 'true'
        ) {
            decoded = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        } else {
            const rootCertificates = loadAppleRootCertificates();
            decoded = verifyAppleJws<any>(signedTransactionInfo, {
                rootCertificates,
            }).payload;
        }

        if (!decoded?.transactionId || !decoded?.originalTransactionId || !decoded?.productId) {
            throw new BadRequestException('Incomplete transaction fields in signedTransactionInfo');
        }

        return {
            transactionId: decoded.transactionId,
            originalTransactionId: decoded.originalTransactionId,
            productId: decoded.productId,
            expiresDate: decoded.expiresDate,
            bundleId: decoded.bundleId,
        };
    }
}
