import {
    Injectable,
    BadRequestException,
    ConflictException,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionStatus, Subscription, PaymentProvider, SubscriptionTier, TransactionStatus, TransactionType } from '@prisma/client';
import { ReceiptValidatorService } from './receipt-validator.service';
import { isCompactJws } from './utils/apple-jws-verifier';
import { SubscriptionNotificationService } from './subscription-notification.service';
import { SubscriptionAnalyticsService } from './subscription-analytics.service';
import {
    DEFAULT_PAYWALL_CONFIG,
    PAYWALL_CONFIG_FLAG_KEY,
    type PremiumPaywallConfig,
} from './paywall-config.defaults';
import { PurchaseDto, RestoreDto, type GoogleRestoreReceiptItem, type RestoreReceiptInput } from './dto';

@Injectable()
export class SubscriptionService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly receiptValidator: ReceiptValidatorService,
        private readonly notificationService: SubscriptionNotificationService,
        private readonly analyticsService: SubscriptionAnalyticsService,
    ) { }

    /**
     * Get user subscription with status check
     * Automatically updates expired subscriptions
     * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
     */
    async getSubscription(userId: string): Promise<Subscription> {
        let subscription = await this.prisma.subscription.findUnique({
            where: { userId },
            include: {
                transactions: {
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                },
            },
        });

        // Create subscription if it doesn't exist
        if (!subscription) {
            subscription = await this.prisma.subscription.create({
                data: {
                    userId,
                    status: SubscriptionStatus.FREE,
                    aiMessagesLimit: 100,
                    aiMessagesUsed: 0,
                    quotaResetDate: this.getNextMonthStart(),
                },
                include: {
                    transactions: true,
                },
            });
            return subscription;
        }

        // Check if active or trial subscription has expired
        if (
            (subscription.status === SubscriptionStatus.ACTIVE ||
                subscription.status === SubscriptionStatus.TRIAL) &&
            subscription.endDate &&
            new Date() > subscription.endDate
        ) {
            // Handle expiration
            await this.handleExpiration(subscription.id);
            // Refetch updated subscription
            const updatedSubscription = await this.prisma.subscription.findUnique({
                where: { userId },
                include: {
                    transactions: {
                        orderBy: { createdAt: 'desc' },
                        take: 10,
                    },
                },
            });
            if (!updatedSubscription) {
                throw new NotFoundException('Abonelik bulunamadı');
            }
            return updatedSubscription;
        }

        // Check if grace period has ended
        if (
            subscription.status === SubscriptionStatus.GRACE_PERIOD &&
            subscription.gracePeriodEndDate &&
            new Date() > subscription.gracePeriodEndDate
        ) {
            // Grace period ended, downgrade to free
            await this.handleExpiration(subscription.id);
            // Refetch updated subscription
            const updatedSubscription = await this.prisma.subscription.findUnique({
                where: { userId },
                include: {
                    transactions: {
                        orderBy: { createdAt: 'desc' },
                        take: 10,
                    },
                },
            });
            if (!updatedSubscription) {
                throw new NotFoundException('Abonelik bulunamadı');
            }
            return updatedSubscription;
        }

        return subscription;
    }

    /**
     * Check AI message quota
     * Returns quota status with usage information
     * Requirements: 6.1, 6.2, 6.3, 6.4
     */
    async checkQuota(userId: string): Promise<{
        hasQuota: boolean;
        used: number;
        limit: number;
        remaining: number;
        resetDate: Date;
        percentage: number;
    }> {
        const subscription = await this.getSubscription(userId);

        // Check if quota needs to be reset
        if (new Date() >= subscription.quotaResetDate) {
            await this.resetQuota(userId);
            // Refetch after reset
            const updatedSubscription = await this.getSubscription(userId);
            return this.calculateQuotaStatus(updatedSubscription);
        }

        return this.calculateQuotaStatus(subscription);
    }

    /**
     * Increment AI message usage
     * Throws error if quota exceeded
     * Requirements: 6.2, 6.3, 6.4, 6.5
     */
    async incrementMessageUsage(userId: string): Promise<void> {
        const subscription = await this.getSubscription(userId);

        // Check if user has quota
        if (subscription.aiMessagesUsed >= subscription.aiMessagesLimit) {
            throw new BadRequestException('AI mesaj kotanız doldu. Premium\'a geçerek sınırsız mesaj gönderin.');
        }

        // Increment usage
        await this.prisma.subscription.update({
            where: { userId },
            data: {
                aiMessagesUsed: {
                    increment: 1,
                },
            },
        });

        // Check if user is approaching limit (20% remaining)
        const newUsage = subscription.aiMessagesUsed + 1;
        const percentage = (newUsage / subscription.aiMessagesLimit) * 100;

        if (percentage >= 80 && percentage < 85) {
            // Send warning notification when 80% quota used
            await this.notificationService.sendQuotaWarning(
                userId,
                newUsage,
                subscription.aiMessagesLimit,
                subscription.quotaResetDate,
            );
        }
    }

    /**
     * Reset monthly quota
     * Called automatically when quota reset date is reached
     * Requirements: 6.7
     */
    async resetQuota(userId: string): Promise<void> {
        const subscription = await this.getSubscription(userId);

        // Determine new limit based on subscription status
        let newLimit = 100; // Free tier default
        if (
            subscription.status === SubscriptionStatus.ACTIVE ||
            subscription.status === SubscriptionStatus.TRIAL
        ) {
            newLimit = 1000; // Premium tier
        }

        await this.prisma.subscription.update({
            where: { userId },
            data: {
                aiMessagesUsed: 0,
                aiMessagesLimit: newLimit,
                quotaResetDate: this.getNextMonthStart(),
            },
        });
    }

    /**
     * Handle subscription expiration
     * Downgrades to free tier and sends notification
     * Requirements: 16.1, 16.2, 16.3, 16.4
     */
    async handleExpiration(subscriptionId: string): Promise<void> {
        const subscription = await this.prisma.subscription.findUnique({
            where: { id: subscriptionId },
        });

        if (!subscription) {
            throw new NotFoundException('Abonelik bulunamadı');
        }

        // Update subscription to expired status
        await this.prisma.subscription.update({
            where: { id: subscriptionId },
            data: {
                status: SubscriptionStatus.EXPIRED,
                aiMessagesLimit: 100, // Reset to free tier limit
                isInGracePeriod: false,
                gracePeriodEndDate: null,
            },
        });

        // Send expiration notification
        await this.notificationService.sendSubscriptionExpired(subscription.userId);

        // Track churn event
        await this.analyticsService.trackChurn(
            subscription.userId,
            'expired',
            {
                tier: subscription.tier,
                endDate: subscription.endDate?.toISOString(),
            },
        );

        // Log subscription event
        await this.analyticsService.logSubscriptionEvent(
            subscription.userId,
            'subscription_expired',
            {
                tier: subscription.tier,
                endDate: subscription.endDate?.toISOString(),
            },
        );
    }

    /**
     * Handle subscription renewal
     * Extends subscription and creates transaction record
     * Requirements: 16.1, 16.2, 16.3
     */
    async handleRenewal(
        subscriptionId: string,
        transactionId: string,
        receiptData: string,
    ): Promise<void> {
        const subscription = await this.prisma.subscription.findUnique({
            where: { id: subscriptionId },
        });

        if (!subscription) {
            throw new NotFoundException('Abonelik bulunamadı');
        }

        // Calculate new end date based on tier
        const currentEndDate = subscription.endDate || new Date();
        let newEndDate: Date;

        if (subscription.tier === 'MONTHLY') {
            newEndDate = new Date(currentEndDate);
            newEndDate.setMonth(newEndDate.getMonth() + 1);
        } else if (subscription.tier === 'YEARLY') {
            newEndDate = new Date(currentEndDate);
            newEndDate.setFullYear(newEndDate.getFullYear() + 1);
        } else {
            throw new BadRequestException('Geçersiz abonelik seviyesi');
        }

        // Update subscription
        await this.prisma.subscription.update({
            where: { id: subscriptionId },
            data: {
                status: SubscriptionStatus.ACTIVE,
                endDate: newEndDate,
                isInGracePeriod: false,
                gracePeriodEndDate: null,
                latestReceiptData: receiptData,
            },
        });

        // Send renewal confirmation notification
        if (subscription.tier) {
            await this.notificationService.sendSubscriptionRenewed(
                subscription.userId,
                subscription.tier,
                newEndDate,
            );
        }

        // Log renewal event
        await this.analyticsService.logSubscriptionEvent(
            subscription.userId,
            'subscription_renewed',
            {
                tier: subscription.tier,
                transactionId,
                newEndDate: newEndDate.toISOString(),
            },
        );
    }

    /**
     * Handle grace period for failed payments
     * Gives user 7 days to fix payment issues
     * Requirements: 16.5, 16.6, 16.7
     */
    async handleGracePeriod(subscriptionId: string): Promise<void> {
        const subscription = await this.prisma.subscription.findUnique({
            where: { id: subscriptionId },
        });

        if (!subscription) {
            throw new NotFoundException('Abonelik bulunamadı');
        }

        // Set grace period (7 days from now)
        const gracePeriodEndDate = new Date();
        gracePeriodEndDate.setDate(gracePeriodEndDate.getDate() + 7);

        await this.prisma.subscription.update({
            where: { id: subscriptionId },
            data: {
                status: SubscriptionStatus.GRACE_PERIOD,
                isInGracePeriod: true,
                gracePeriodEndDate,
            },
        });

        // Send payment failure notification
        await this.notificationService.sendPaymentFailed(
            subscription.userId,
            gracePeriodEndDate,
        );

        // Track churn event (payment failed)
        await this.analyticsService.trackChurn(
            subscription.userId,
            'payment_failed',
            {
                tier: subscription.tier,
                gracePeriodEndDate: gracePeriodEndDate.toISOString(),
            },
        );

        // Log grace period event
        await this.analyticsService.logSubscriptionEvent(
            subscription.userId,
            'subscription_grace_period',
            {
                tier: subscription.tier,
                gracePeriodEndDate: gracePeriodEndDate.toISOString(),
            },
        );
    }

    // Helper methods

    /**
     * Calculate quota status from subscription
     */
    private calculateQuotaStatus(subscription: Subscription) {
        const used = subscription.aiMessagesUsed;
        const limit = subscription.aiMessagesLimit;
        const remaining = Math.max(0, limit - used);
        const percentage = (used / limit) * 100;

        return {
            hasQuota: remaining > 0,
            used,
            limit,
            remaining,
            resetDate: subscription.quotaResetDate,
            percentage: Math.round(percentage),
        };
    }

    /**
     * Get the start of next month
     */
    private getNextMonthStart(): Date {
        const now = new Date();
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return nextMonth;
    }

    private resolveTierFromStoreProductId(
        productId: string,
        paywallConfig: PremiumPaywallConfig,
    ): SubscriptionTier {
        const yearlyIds = new Set(
            [
                paywallConfig.plans.YEARLY.iosProductId,
                paywallConfig.plans.YEARLY.androidProductId,
                'com.wellness.premium.yearly',
                'premium_yearly',
            ].filter(Boolean),
        );
        const monthlyIds = new Set(
            [
                paywallConfig.plans.MONTHLY.iosProductId,
                paywallConfig.plans.MONTHLY.androidProductId,
                'com.wellness.premium.monthly',
                'premium_monthly',
            ].filter(Boolean),
        );

        if (yearlyIds.has(productId)) {
            return SubscriptionTier.YEARLY;
        }
        if (monthlyIds.has(productId)) {
            return SubscriptionTier.MONTHLY;
        }

        throw new BadRequestException(`Tanımsız abonelik ürünü: ${productId}`);
    }

    private async activateFromValidatedReceipt(params: {
        userId: string;
        provider: PaymentProvider;
        receipt: string;
        validatedData: {
            transactionId: string;
            originalTransactionId?: string;
            productId: string;
            purchaseDate: Date | string;
            expiresDate: Date | string;
            isTrialPeriod?: boolean;
            isActive: boolean;
        };
        googlePurchaseToken?: string;
    }): Promise<Subscription> {
        const { userId, provider, receipt, validatedData, googlePurchaseToken } = params;

        if (!this.receiptValidator.isReceiptActive(validatedData as any)) {
            throw new BadRequestException('Abonelik makbuzu aktif değil veya süresi dolmuş');
        }

        const storeProductId = validatedData.productId;
        const storeTransactionId = validatedData.transactionId;
        const storeOriginalTransactionId =
            validatedData.originalTransactionId || validatedData.transactionId;
        const storeStartDate =
            validatedData.purchaseDate instanceof Date
                ? validatedData.purchaseDate
                : new Date(validatedData.purchaseDate);
        const storeEndDate =
            validatedData.expiresDate instanceof Date
                ? validatedData.expiresDate
                : new Date(validatedData.expiresDate);

        if (!storeProductId || !storeTransactionId || !storeOriginalTransactionId) {
            throw new BadRequestException('Mağaza makbuzunda gerekli kimlik bilgileri eksik');
        }

        if (
            !Number.isFinite(storeStartDate.getTime()) ||
            !Number.isFinite(storeEndDate.getTime()) ||
            storeEndDate <= new Date()
        ) {
            throw new BadRequestException('Mağaza abonelik tarihleri geçersiz veya süresi dolmuş');
        }

        const paywallConfig = await this.getPaywallConfig();
        const tier = this.resolveTierFromStoreProductId(storeProductId, paywallConfig);
        const plan = paywallConfig.plans[tier];
        const targetStatus = validatedData.isTrialPeriod
            ? SubscriptionStatus.TRIAL
            : SubscriptionStatus.ACTIVE;
        const trialEndDate = validatedData.isTrialPeriod ? storeEndDate : null;
        const aiMessagesLimit = Number(paywallConfig.premiumAiMessageLimit || 1000);
        const storedReceipt =
            provider === PaymentProvider.GOOGLE ? googlePurchaseToken || receipt : receipt;

        const { subscription, isReplay } = await this.prisma.$transaction(async (tx) => {
            // 1. Verify originalTransactionId is not bound to another account
            const ownerSub = await tx.subscription.findUnique({
                where: { originalTransactionId: storeOriginalTransactionId },
            });
            if (ownerSub && ownerSub.userId !== userId) {
                throw new ConflictException('Bu abonelik başka bir kullanıcı hesabına ait');
            }

            // 2. For Google Play, also ensure purchaseToken cannot be replayed by another user
            if (provider === PaymentProvider.GOOGLE && googlePurchaseToken) {
                const existingTokenTx = await tx.subscriptionTransaction.findFirst({
                    where: {
                        provider: PaymentProvider.GOOGLE,
                        receiptData: googlePurchaseToken,
                    },
                    include: { subscription: { select: { userId: true } } },
                });
                if (existingTokenTx && existingTokenTx.subscription.userId !== userId) {
                    throw new ConflictException('Bu satın alma jetonu başka bir kullanıcıya ait');
                }
            }

            // 3. Replay / ownership check on store transactionId BEFORE modifying entitlement
            const existingTx = await tx.subscriptionTransaction.findUnique({
                where: { transactionId: storeTransactionId },
                include: { subscription: true },
            });

            if (existingTx) {
                if (existingTx.subscription.userId !== userId) {
                    throw new ConflictException('Bu satın alma işlemi başka bir hesaba ait');
                }
                if (existingTx.status === TransactionStatus.COMPLETED) {
                    return { subscription: existingTx.subscription, isReplay: true };
                }
            }

            // 4. Atomically upsert subscription and record transaction in the same DB tx
            const existingUserSub = await tx.subscription.findUnique({
                where: { userId },
            });

            const savedSubscription = existingUserSub
                ? await tx.subscription.update({
                      where: { userId },
                      data: {
                          status: targetStatus,
                          tier,
                          startDate: storeStartDate,
                          endDate: storeEndDate,
                          trialEndDate,
                          ...(validatedData.isTrialPeriod ? { hasHadTrial: true } : {}),
                          provider,
                          originalTransactionId: storeOriginalTransactionId,
                          latestReceiptData: storedReceipt,
                          aiMessagesLimit,
                          isInGracePeriod: false,
                          gracePeriodEndDate: null,
                      },
                  })
                : await tx.subscription.create({
                      data: {
                          userId,
                          status: targetStatus,
                          tier,
                          startDate: storeStartDate,
                          endDate: storeEndDate,
                          trialEndDate,
                          hasHadTrial: Boolean(validatedData.isTrialPeriod),
                          provider,
                          originalTransactionId: storeOriginalTransactionId,
                          latestReceiptData: storedReceipt,
                          aiMessagesLimit,
                          aiMessagesUsed: 0,
                          quotaResetDate: this.getNextMonthStart(),
                      },
                  });

            await tx.subscriptionTransaction.create({
                data: {
                    subscriptionId: savedSubscription.id,
                    transactionId: storeTransactionId,
                    originalTransactionId: storeOriginalTransactionId,
                    productId: storeProductId,
                    amount: Number(plan?.price || (tier === SubscriptionTier.YEARLY ? 999 : 99)),
                    currency: plan?.currency || process.env.SUBSCRIPTION_CURRENCY || 'TRY',
                    status: TransactionStatus.COMPLETED,
                    type: TransactionType.INITIAL_PURCHASE,
                    provider,
                    receiptData: storedReceipt,
                    validatedAt: new Date(),
                },
            });

            return { subscription: savedSubscription, isReplay: false };
        });

        if (!isReplay) {
            await this.notificationService.sendSubscriptionStarted(
                userId,
                tier,
                storeEndDate,
            );

            await this.analyticsService.trackConversion(
                userId,
                tier,
                Number(plan?.price || (tier === SubscriptionTier.YEARLY ? 999 : 99)),
                'mobile_app',
            );

            await this.analyticsService.logSubscriptionEvent(
                userId,
                'subscription_started',
                {
                    tier,
                    provider,
                    startDate: storeStartDate.toISOString(),
                    endDate: storeEndDate.toISOString(),
                },
            );
        }

        return subscription;
    }

    private resolveGooglePurchaseToken(purchaseDto: PurchaseDto): string {
        const explicitToken = purchaseDto.purchaseToken?.trim();
        if (explicitToken) {
            return explicitToken;
        }

        const rawReceipt = purchaseDto.receipt?.trim();
        if (rawReceipt) {
            if (rawReceipt.startsWith('{')) {
                try {
                    const parsed = JSON.parse(rawReceipt);
                    if (
                        typeof parsed?.purchaseToken === 'string' &&
                        parsed.purchaseToken.trim()
                    ) {
                        return parsed.purchaseToken.trim();
                    }
                } catch {
                    // Treat as raw token string below
                }
            }
            return rawReceipt;
        }

        const fallbackTransactionId = purchaseDto.transactionId?.trim();
        if (fallbackTransactionId && !fallbackTransactionId.startsWith('GPA.')) {
            return fallbackTransactionId;
        }

        throw new BadRequestException('Google Play satın alma jetonu (purchaseToken) gerekli');
    }

    /**
     * Process new purchase
     * Validates receipt with store and grants store-verified entitlements atomically
     * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8
     */
    async processPurchase(userId: string, purchaseDto: PurchaseDto): Promise<Subscription> {
        const { receipt, provider, productId, purchaseToken } = purchaseDto;
        const googlePurchaseToken =
            provider === PaymentProvider.GOOGLE
                ? this.resolveGooglePurchaseToken(purchaseDto)
                : undefined;
        const appleReceiptOrJws =
            provider === PaymentProvider.APPLE && purchaseToken?.trim() && isCompactJws(purchaseToken.trim())
                ? purchaseToken.trim()
                : receipt;

        // Validate receipt with provider
        let validatedData: any;
        try {
            if (provider === PaymentProvider.APPLE) {
                validatedData = await this.receiptValidator.validateAppleReceipt(appleReceiptOrJws);
            } else if (provider === PaymentProvider.GOOGLE) {
                const packageName =
                    process.env.GOOGLE_PLAY_PACKAGE_NAME || 'com.kadinatlasi.wellness';
                validatedData = await this.receiptValidator.validateGoogleReceipt(
                    packageName,
                    productId,
                    googlePurchaseToken!,
                );
            } else {
                throw new BadRequestException('Geçersiz ödeme sağlayıcısı');
            }
        } catch (error) {
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException(
                'Makbuz doğrulaması başarısız: ' +
                    (error instanceof Error ? error.message : 'Bilinmeyen hata'),
            );
        }

        if (productId && validatedData.productId && validatedData.productId !== productId) {
            throw new BadRequestException('Ürün kimliği mağaza makbuzu ile eşleşmiyor');
        }

        return this.activateFromValidatedReceipt({
            userId,
            provider,
            receipt: provider === PaymentProvider.APPLE ? appleReceiptOrJws : receipt,
            validatedData,
            googlePurchaseToken,
        });
    }

    private parseGoogleRestoreInput(
        item: RestoreReceiptInput,
    ): { productId: string; purchaseToken: string; packageName?: string; rawReceipt: string } | null {
        if (!item) return null;

        let parsed: GoogleRestoreReceiptItem;
        let rawReceipt: string;

        if (typeof item === 'string') {
            rawReceipt = item;
            try {
                const json = JSON.parse(item);
                if (!json || typeof json !== 'object') return null;
                parsed = json;
            } catch {
                return null;
            }
        } else if (typeof item === 'object') {
            parsed = item;
            rawReceipt = item.receipt || JSON.stringify(item);
        } else {
            return null;
        }

        const productId = (parsed.productId || '').trim();
        const purchaseToken = (parsed.purchaseToken || parsed.transactionId || '').trim();
        if (!productId || !purchaseToken) {
            return null;
        }

        return {
            productId,
            purchaseToken,
            packageName: parsed.packageName?.trim(),
            rawReceipt,
        };
    }

    /**
     * Restore purchases
     * Validates receipts for both Apple and Google Play, requires active store entitlement,
     * and restores the active subscription with the furthest expiration date atomically.
     * Requirements: 2.5, 2.6, 14.1, 14.2, 14.3, 14.4, 14.5
     */
    async restorePurchases(userId: string, restoreDto: RestoreDto): Promise<Subscription> {
        const { receipts, purchases, provider } = restoreDto;
        const inputs: RestoreReceiptInput[] = [
            ...(Array.isArray(receipts) ? receipts : []),
            ...(Array.isArray(purchases) ? purchases : []),
        ];

        if (inputs.length === 0) {
            throw new BadRequestException('En az bir makbuz gerekli');
        }

        const configuredGooglePackage =
            process.env.GOOGLE_PLAY_PACKAGE_NAME || 'com.kadinatlasi.wellness';

        // Validate all receipts and select only active ones with the furthest store expiration date
        let mostRecentReceipt: {
            receipt: string;
            validatedData: any;
            googlePurchaseToken?: string;
        } | null = null;
        let mostRecentDate: Date | null = null;

        for (const item of inputs) {
            try {
                if (provider === PaymentProvider.APPLE) {
                    const appleReceipt =
                        typeof item === 'string'
                            ? item
                            : typeof item === 'object'
                              ? item?.purchaseToken && isCompactJws(item.purchaseToken.trim())
                                  ? item.purchaseToken.trim()
                                  : item?.receipt || item?.purchaseToken || ''
                              : '';
                    if (!appleReceipt) continue;

                    const validatedData =
                        await this.receiptValidator.validateAppleReceipt(appleReceipt);
                    if (!this.receiptValidator.isReceiptActive(validatedData)) {
                        continue;
                    }

                    const receiptDate = new Date(validatedData.expiresDate);
                    if (!mostRecentDate || receiptDate > mostRecentDate) {
                        mostRecentDate = receiptDate;
                        mostRecentReceipt = { receipt: appleReceipt, validatedData };
                    }
                } else if (provider === PaymentProvider.GOOGLE) {
                    const parsedGoogle = this.parseGoogleRestoreInput(item);
                    if (!parsedGoogle) continue;

                    if (
                        parsedGoogle.packageName &&
                        parsedGoogle.packageName !== configuredGooglePackage
                    ) {
                        continue;
                    }

                    const validatedData = await this.receiptValidator.validateGoogleReceipt(
                        configuredGooglePackage,
                        parsedGoogle.productId,
                        parsedGoogle.purchaseToken,
                    );
                    if (!this.receiptValidator.isReceiptActive(validatedData)) {
                        continue;
                    }

                    const receiptDate = new Date(validatedData.expiresDate);
                    if (!mostRecentDate || receiptDate > mostRecentDate) {
                        mostRecentDate = receiptDate;
                        mostRecentReceipt = {
                            receipt: parsedGoogle.purchaseToken,
                            validatedData,
                            googlePurchaseToken: parsedGoogle.purchaseToken,
                        };
                    }
                } else {
                    throw new BadRequestException('Geçersiz ödeme sağlayıcısı');
                }
            } catch (error) {
                if (error instanceof BadRequestException && error.message === 'Geçersiz ödeme sağlayıcısı') {
                    throw error;
                }
                console.log(
                    `Skipping invalid receipt: ${error instanceof Error ? error.message : error}`,
                );
            }
        }

        if (!mostRecentReceipt) {
            throw new BadRequestException('Geçerli ve aktif bir abonelik bulunamadı');
        }

        return this.activateFromValidatedReceipt({
            userId,
            provider,
            receipt: mostRecentReceipt.receipt,
            validatedData: mostRecentReceipt.validatedData,
            googlePurchaseToken: mostRecentReceipt.googlePurchaseToken,
        });
    }

    /**
     * Cancel subscription
     * Marks subscription as cancelled but maintains access until end date
     * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
     */
    async cancelSubscription(userId: string): Promise<void> {
        const subscription = await this.getSubscription(userId);

        if (subscription.status !== SubscriptionStatus.ACTIVE) {
            throw new BadRequestException('Sadece aktif abonelikler iptal edilebilir');
        }

        // Mark as cancelled but keep access until end date
        await this.prisma.subscription.update({
            where: { userId },
            data: {
                status: SubscriptionStatus.CANCELLED,
                cancelledAt: new Date(),
            },
        });

        // Send cancellation confirmation notification
        if (subscription.endDate) {
            await this.notificationService.sendSubscriptionCancelled(
                userId,
                subscription.endDate,
            );
        }

        // Track churn event
        await this.analyticsService.trackChurn(
            userId,
            'cancelled',
            {
                tier: subscription.tier,
                cancelledAt: new Date().toISOString(),
                endDate: subscription.endDate?.toISOString(),
            },
        );

        // Log subscription event
        await this.analyticsService.logSubscriptionEvent(
            userId,
            'subscription_cancelled',
            {
                tier: subscription.tier,
                cancelledAt: new Date().toISOString(),
            },
        );
    }

    /**
     * Get transaction history
     * Returns all transactions for user's subscription
     * Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6
     */
    async getTransactions(userId: string) {
        const subscription = await this.getSubscription(userId);

        return this.prisma.subscriptionTransaction.findMany({
            where: { subscriptionId: subscription.id },
            orderBy: { createdAt: 'desc' },
            take: 12, // Last 12 transactions (1 year for monthly)
        });
    }

    /**
     * Get usage statistics
     * Returns feature usage and benefits
     * Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6
     */
    async getUsageStats(userId: string) {
        const subscription = await this.getSubscription(userId);
        const monthKey = new Date().toISOString().slice(0, 7);

        const [
            featureUsage,
            gamification,
            userMessagesCount,
            insightsCount,
            completedBadges,
            usageQuota,
        ] = await Promise.all([
            this.prisma.premiumFeatureUsage.findMany({
                where: { userId },
                orderBy: { usageCount: 'desc' },
            }),
            this.prisma.userGamification.findUnique({
                where: { userId },
            }),
            this.prisma.message.count({
                where: {
                    conversation: { userId },
                    role: 'user',
                },
            }),
            this.prisma.userInsight.count({
                where: { userId },
            }),
            this.prisma.userAchievement.count({
                where: { userId, isCompleted: true },
            }),
            this.prisma.usageQuota.findUnique({
                where: { userId_monthKey: { userId, monthKey } },
            }),
        ]);

        const totalMessages = Math.max(
            subscription.aiMessagesUsed || 0,
            usageQuota?.aiRequests || 0,
            userMessagesCount,
        );

        // Calculate time saved (estimate: 2 minutes per AI message)
        const timeSaved = totalMessages * 2;

        // Count insights generated
        const insightsFeature = featureUsage.find((f) => f.feature === 'insights');
        const insightsGenerated = Math.max(insightsFeature?.usageCount || 0, insightsCount);

        const currentStreak = gamification?.currentStreak || 0;
        const longestStreak = gamification?.longestStreak || 0;
        const totalDataEntries = gamification?.totalDataEntries || 0;

        // Member since date
        const memberSince =
            subscription.startDate?.toISOString() || subscription.createdAt.toISOString();

        return {
            totalMessages,
            premiumFeaturesUsed: featureUsage.map((f) => ({
                feature: f.feature,
                count: f.usageCount,
            })),
            timeSaved,
            insightsGenerated,
            memberSince,
            currentStreak,
            longestStreak,
            totalDataEntries,
            completedBadges,
        };
    }

    async getPaywallConfig(): Promise<PremiumPaywallConfig> {
        const flag = await this.prisma.featureFlag.findUnique({
            where: { key: PAYWALL_CONFIG_FLAG_KEY },
        });
        const stored = (flag?.valueJson as Partial<PremiumPaywallConfig>) || {};
        return {
            ...DEFAULT_PAYWALL_CONFIG,
            ...stored,
            plans: {
                MONTHLY: {
                    ...DEFAULT_PAYWALL_CONFIG.plans.MONTHLY,
                    ...(stored.plans?.MONTHLY || {}),
                },
                YEARLY: {
                    ...DEFAULT_PAYWALL_CONFIG.plans.YEARLY,
                    ...(stored.plans?.YEARLY || {}),
                },
            },
            benefits: Array.isArray(stored.benefits)
                ? stored.benefits
                : DEFAULT_PAYWALL_CONFIG.benefits,
            comparisonRows: Array.isArray(stored.comparisonRows)
                ? stored.comparisonRows
                : DEFAULT_PAYWALL_CONFIG.comparisonRows,
            faqs: Array.isArray(stored.faqs)
                ? stored.faqs
                : DEFAULT_PAYWALL_CONFIG.faqs,
            heroHighlights: Array.isArray(stored.heroHighlights)
                ? stored.heroHighlights
                : DEFAULT_PAYWALL_CONFIG.heroHighlights,
            updatedAt: flag?.updatedAt?.toISOString(),
        };
    }

    async updatePaywallConfig(
        payload: Partial<PremiumPaywallConfig>,
    ): Promise<PremiumPaywallConfig> {
        const current = await this.getPaywallConfig();
        const next: PremiumPaywallConfig = {
            ...current,
            ...payload,
            plans: {
                MONTHLY: {
                    ...current.plans.MONTHLY,
                    ...(payload.plans?.MONTHLY || {}),
                    price: Number(
                        payload.plans?.MONTHLY?.price ?? current.plans.MONTHLY.price,
                    ),
                    trialDays: Number(
                        payload.plans?.MONTHLY?.trialDays ?? current.plans.MONTHLY.trialDays,
                    ),
                },
                YEARLY: {
                    ...current.plans.YEARLY,
                    ...(payload.plans?.YEARLY || {}),
                    price: Number(
                        payload.plans?.YEARLY?.price ?? current.plans.YEARLY.price,
                    ),
                    trialDays: Number(
                        payload.plans?.YEARLY?.trialDays ?? current.plans.YEARLY.trialDays,
                    ),
                },
            },
            premiumAiMessageLimit: Number(
                payload.premiumAiMessageLimit ?? current.premiumAiMessageLimit,
            ),
            freeAiMessageLimit: Number(
                payload.freeAiMessageLimit ?? current.freeAiMessageLimit,
            ),
        };
        delete next.updatedAt;

        const saved = await this.prisma.featureFlag.upsert({
            where: { key: PAYWALL_CONFIG_FLAG_KEY },
            update: { valueJson: next as any },
            create: { key: PAYWALL_CONFIG_FLAG_KEY, valueJson: next as any },
        });

        return {
            ...next,
            updatedAt: saved.updatedAt.toISOString(),
        };
    }

    async resetPaywallConfig(): Promise<PremiumPaywallConfig> {
        const saved = await this.prisma.featureFlag.upsert({
            where: { key: PAYWALL_CONFIG_FLAG_KEY },
            update: { valueJson: DEFAULT_PAYWALL_CONFIG as any },
            create: {
                key: PAYWALL_CONFIG_FLAG_KEY,
                valueJson: DEFAULT_PAYWALL_CONFIG as any,
            },
        });
        return {
            ...DEFAULT_PAYWALL_CONFIG,
            updatedAt: saved.updatedAt.toISOString(),
        };
    }

    async getAdminSubscriptionOverview() {
        const [activeCount, trialCount, freeCount, monthlyCount, yearlyCount] =
            await Promise.all([
                this.prisma.subscription.count({ where: { status: 'ACTIVE' } }),
                this.prisma.subscription.count({ where: { status: 'TRIAL' } }),
                this.prisma.subscription.count({ where: { status: 'FREE' } }),
                this.prisma.subscription.count({
                    where: { status: 'ACTIVE', tier: 'MONTHLY' },
                }),
                this.prisma.subscription.count({
                    where: { status: 'ACTIVE', tier: 'YEARLY' },
                }),
            ]);

        return {
            activeCount,
            trialCount,
            freeCount,
            monthlyCount,
            yearlyCount,
        };
    }

    async adminUpdateUserSubscription(
        subscriptionId: string,
        body: {
            status?: any;
            tier?: any;
            endDate?: string | null;
            aiMessagesLimit?: number;
        },
    ) {
        const existing = await this.prisma.subscription.findUnique({
            where: { id: subscriptionId },
        });
        if (!existing) {
            throw new BadRequestException('Abonelik bulunamadı');
        }

        const data: any = {};
        if (body.status !== undefined) data.status = body.status;
        if (body.tier !== undefined) data.tier = body.tier || null;
        if (body.endDate !== undefined) {
            data.endDate = body.endDate ? new Date(body.endDate) : null;
        }
        if (body.aiMessagesLimit !== undefined) {
            data.aiMessagesLimit = Number(body.aiMessagesLimit);
        }
        if (body.status === 'ACTIVE' && !existing.startDate) {
            data.startDate = new Date();
        }

        return this.prisma.subscription.update({
            where: { id: subscriptionId },
            data,
            include: {
                user: { select: { id: true, email: true, username: true } },
            },
        });
    }
}
