import { BadRequestException, ConflictException } from '@nestjs/common';
import {
    PaymentProvider,
    SubscriptionStatus,
    SubscriptionTier,
    TransactionStatus,
} from '@prisma/client';
import { SubscriptionService } from './subscription.service';

describe('SubscriptionService (store entitlement, ownership, replay & atomicity)', () => {
    const futureDate = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const pastDate = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    function createHarness() {
        const tx = {
            subscription: {
                findUnique: jest.fn().mockResolvedValue(null),
                update: jest.fn(),
                create: jest.fn(),
            },
            subscriptionTransaction: {
                findUnique: jest.fn().mockResolvedValue(null),
                findFirst: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockResolvedValue({ id: 'tx-db-1' }),
            },
        };

        const prisma = {
            featureFlag: { findUnique: jest.fn().mockResolvedValue(null) },
            subscription: {
                findUnique: jest.fn().mockResolvedValue(null),
                create: jest.fn(),
                update: jest.fn(),
            },
            $transaction: jest.fn(async (cb: any) => cb(tx)),
        } as any;

        const receiptValidator = {
            validateAppleReceipt: jest.fn(),
            validateGoogleReceipt: jest.fn(),
            isReceiptActive: jest.fn((data: any) => Boolean(data?.isActive && data?.expiresDate > new Date())),
        } as any;

        const notificationService = {
            sendSubscriptionStarted: jest.fn().mockResolvedValue(undefined),
        } as any;

        const analyticsService = {
            trackConversion: jest.fn().mockResolvedValue(undefined),
            logSubscriptionEvent: jest.fn().mockResolvedValue(undefined),
        } as any;

        const service = new SubscriptionService(
            prisma,
            receiptValidator,
            notificationService,
            analyticsService,
        );

        return { service, prisma, tx, receiptValidator, notificationService, analyticsService };
    }

    it('uses store-verified dates, tier, trial status, and transactionId inside an atomic $transaction', async () => {
        const { service, prisma, tx, receiptValidator, notificationService, analyticsService } =
            createHarness();

        const storeStart = pastDate(1);
        const storeEnd = futureDate(6); // e.g., 7-day trial, NOT 30 or 365 days from today!
        receiptValidator.validateAppleReceipt.mockResolvedValue({
            transactionId: 'apple-tx-999',
            originalTransactionId: 'apple-orig-100',
            productId: 'com.wellness.premium.monthly',
            purchaseDate: storeStart,
            expiresDate: storeEnd,
            isTrialPeriod: true,
            isActive: true,
            environment: 'Production',
        });

        tx.subscription.findUnique
            .mockResolvedValueOnce(null) // owner check by originalTransactionId
            .mockResolvedValueOnce(null); // existing user subscription
        tx.subscription.create.mockResolvedValue({
            id: 'sub-1',
            userId: 'user-1',
            status: SubscriptionStatus.TRIAL,
            tier: SubscriptionTier.MONTHLY,
            startDate: storeStart,
            endDate: storeEnd,
        });

        const result = await service.processPurchase('user-1', {
            receipt: 'base64-receipt',
            provider: PaymentProvider.APPLE,
            productId: 'com.wellness.premium.monthly',
            transactionId: 'client-spoofed-tx-id',
        });

        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        expect(tx.subscription.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: 'user-1',
                status: SubscriptionStatus.TRIAL,
                tier: SubscriptionTier.MONTHLY,
                startDate: storeStart,
                endDate: storeEnd,
                trialEndDate: storeEnd,
                originalTransactionId: 'apple-orig-100',
            }),
        });
        expect(tx.subscriptionTransaction.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                subscriptionId: 'sub-1',
                transactionId: 'apple-tx-999',
                originalTransactionId: 'apple-orig-100',
                productId: 'com.wellness.premium.monthly',
            }),
        });
        expect(result.endDate).toEqual(storeEnd);
        expect(notificationService.sendSubscriptionStarted).toHaveBeenCalledWith(
            'user-1',
            SubscriptionTier.MONTHLY,
            storeEnd,
        );
        expect(analyticsService.trackConversion).toHaveBeenCalledTimes(1);
    });

    it('prefers StoreKit 2 JWS purchaseToken when validating Apple purchases', async () => {
        const { service, tx, receiptValidator } = createHarness();
        const storeEnd = futureDate(30);
        const jwsToken = 'eyJhbGciOiJFUzI1NiJ9.eyJ0cmFuc2FjdGlvbklkIjoiMjAwMDAwMDk5OSJ9.c2ln';

        receiptValidator.validateAppleReceipt.mockResolvedValue({
            transactionId: '2000000999',
            originalTransactionId: '2000000100',
            productId: 'com.wellness.premium.monthly',
            purchaseDate: pastDate(1),
            expiresDate: storeEnd,
            isTrialPeriod: false,
            isActive: true,
            environment: 'Production',
        });

        tx.subscription.findUnique
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null);
        tx.subscription.create.mockResolvedValue({
            id: 'sub-apple-sk2',
            userId: 'user-ios-sk2',
            status: SubscriptionStatus.ACTIVE,
            tier: SubscriptionTier.MONTHLY,
            endDate: storeEnd,
        });

        await service.processPurchase('user-ios-sk2', {
            receipt: jwsToken,
            purchaseToken: jwsToken,
            provider: PaymentProvider.APPLE,
            productId: 'com.wellness.premium.monthly',
            transactionId: '2000000999',
        });

        expect(receiptValidator.validateAppleReceipt).toHaveBeenCalledWith(jwsToken);
        expect(tx.subscription.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                originalTransactionId: '2000000100',
                latestReceiptData: jwsToken,
            }),
        });
    });

    it('rejects expired or inactive store receipts without touching DB', async () => {
        const { service, prisma, receiptValidator } = createHarness();

        receiptValidator.validateAppleReceipt.mockResolvedValue({
            transactionId: 'apple-tx-old',
            originalTransactionId: 'apple-orig-old',
            productId: 'com.wellness.premium.yearly',
            purchaseDate: pastDate(400),
            expiresDate: pastDate(35),
            isTrialPeriod: false,
            isActive: false,
        });

        await expect(
            service.processPurchase('user-1', {
                receipt: 'expired-receipt',
                provider: PaymentProvider.APPLE,
                productId: 'com.wellness.premium.yearly',
                transactionId: 'apple-tx-old',
            }),
        ).rejects.toThrow(BadRequestException);

        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects client productId spoofing when store productId differs', async () => {
        const { service, prisma, receiptValidator } = createHarness();

        receiptValidator.validateAppleReceipt.mockResolvedValue({
            transactionId: 'apple-tx-1',
            originalTransactionId: 'apple-orig-1',
            productId: 'com.wellness.premium.monthly',
            purchaseDate: pastDate(1),
            expiresDate: futureDate(29),
            isTrialPeriod: false,
            isActive: true,
        });

        await expect(
            service.processPurchase('user-1', {
                receipt: 'monthly-receipt',
                provider: PaymentProvider.APPLE,
                productId: 'com.wellness.premium.yearly', // spoofed yearly!
                transactionId: 'apple-tx-1',
            }),
        ).rejects.toThrow(BadRequestException);

        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects transactions or originalTransactionIds already owned by another account', async () => {
        const { service, tx, receiptValidator } = createHarness();

        receiptValidator.validateAppleReceipt.mockResolvedValue({
            transactionId: 'apple-tx-shared',
            originalTransactionId: 'apple-orig-victim',
            productId: 'com.wellness.premium.yearly',
            purchaseDate: pastDate(1),
            expiresDate: futureDate(364),
            isTrialPeriod: false,
            isActive: true,
        });

        tx.subscription.findUnique.mockResolvedValueOnce({
            id: 'sub-victim',
            userId: 'victim-user',
            originalTransactionId: 'apple-orig-victim',
        });

        await expect(
            service.processPurchase('attacker-user', {
                receipt: 'stolen-receipt',
                provider: PaymentProvider.APPLE,
                productId: 'com.wellness.premium.yearly',
                transactionId: 'apple-tx-shared',
            }),
        ).rejects.toThrow(ConflictException);

        expect(tx.subscription.update).not.toHaveBeenCalled();
        expect(tx.subscriptionTransaction.create).not.toHaveBeenCalled();
    });

    it('prevents Google purchaseToken replay by another account', async () => {
        const { service, tx, receiptValidator } = createHarness();

        receiptValidator.validateGoogleReceipt.mockResolvedValue({
            transactionId: 'GPA.1111-2222-3333',
            originalTransactionId: 'GPA.1111-2222-3333',
            productId: 'premium_monthly',
            purchaseDate: pastDate(1),
            expiresDate: futureDate(29),
            isTrialPeriod: false,
            isActive: true,
            autoRenewing: true,
        });

        tx.subscription.findUnique.mockResolvedValueOnce(null);
        tx.subscriptionTransaction.findFirst.mockResolvedValueOnce({
            id: 'tx-victim',
            subscription: { userId: 'victim-user' },
        });

        await expect(
            service.processPurchase('attacker-user', {
                receipt: 'google-token',
                provider: PaymentProvider.GOOGLE,
                productId: 'premium_monthly',
                transactionId: 'GPA.1111-2222-3333',
                purchaseToken: 'google-purchase-token-123',
            }),
        ).rejects.toThrow(ConflictException);

        expect(receiptValidator.validateGoogleReceipt).toHaveBeenCalledWith(
            expect.any(String),
            'premium_monthly',
            'google-purchase-token-123',
        );
        expect(tx.subscription.create).not.toHaveBeenCalled();
        expect(tx.subscriptionTransaction.create).not.toHaveBeenCalled();
    });

    it('uses explicit Google purchaseToken instead of order transactionId during purchase validation', async () => {
        const { service, tx, receiptValidator } = createHarness();
        const storeStart = pastDate(1);
        const storeEnd = futureDate(30);

        receiptValidator.validateGoogleReceipt.mockResolvedValue({
            transactionId: 'GPA.9999-8888-7777',
            originalTransactionId: 'GPA.9999-8888-7777',
            productId: 'premium_monthly',
            purchaseDate: storeStart,
            expiresDate: storeEnd,
            isTrialPeriod: false,
            isActive: true,
            autoRenewing: true,
        });

        tx.subscription.findUnique
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null);
        tx.subscription.create.mockResolvedValue({
            id: 'sub-google-explicit',
            userId: 'user-android-1',
            status: SubscriptionStatus.ACTIVE,
            tier: SubscriptionTier.MONTHLY,
            endDate: storeEnd,
        });

        await service.processPurchase('user-android-1', {
            receipt: 'tok-google-real-xyz',
            provider: PaymentProvider.GOOGLE,
            productId: 'premium_monthly',
            transactionId: 'GPA.9999-8888-7777',
            purchaseToken: 'tok-google-real-xyz',
        });

        expect(receiptValidator.validateGoogleReceipt).toHaveBeenCalledWith(
            expect.any(String),
            'premium_monthly',
            'tok-google-real-xyz',
        );
        expect(tx.subscriptionTransaction.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    provider: PaymentProvider.GOOGLE,
                    receiptData: 'tok-google-real-xyz',
                },
            }),
        );
        expect(tx.subscription.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                originalTransactionId: 'GPA.9999-8888-7777',
                latestReceiptData: 'tok-google-real-xyz',
            }),
        });
    });

    it('falls back to receipt token instead of GPA orderId when legacy Google client omits purchaseToken', async () => {
        const { service, tx, receiptValidator } = createHarness();
        const storeEnd = futureDate(30);

        receiptValidator.validateGoogleReceipt.mockResolvedValue({
            transactionId: 'GPA.4444-5555-6666',
            originalTransactionId: 'GPA.4444-5555-6666',
            productId: 'premium_monthly',
            purchaseDate: pastDate(1),
            expiresDate: storeEnd,
            isTrialPeriod: false,
            isActive: true,
            autoRenewing: true,
        });

        tx.subscription.findUnique
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null);
        tx.subscription.create.mockResolvedValue({
            id: 'sub-google-legacy',
            userId: 'user-android-legacy',
            status: SubscriptionStatus.ACTIVE,
            tier: SubscriptionTier.MONTHLY,
            endDate: storeEnd,
        });

        await service.processPurchase('user-android-legacy', {
            receipt: 'tok-from-legacy-receipt',
            provider: PaymentProvider.GOOGLE,
            productId: 'premium_monthly',
            transactionId: 'GPA.4444-5555-6666',
        });

        expect(receiptValidator.validateGoogleReceipt).toHaveBeenCalledWith(
            expect.any(String),
            'premium_monthly',
            'tok-from-legacy-receipt',
        );
    });

    it('handles repeated transaction for the same owner idempotently without extending dates or duplicating records', async () => {
        const { service, tx, receiptValidator, notificationService, analyticsService } =
            createHarness();

        const storeEnd = futureDate(29);
        receiptValidator.validateAppleReceipt.mockResolvedValue({
            transactionId: 'apple-tx-dup',
            originalTransactionId: 'apple-orig-1',
            productId: 'com.wellness.premium.monthly',
            purchaseDate: pastDate(1),
            expiresDate: storeEnd,
            isTrialPeriod: false,
            isActive: true,
        });

        const existingSub = {
            id: 'sub-1',
            userId: 'user-1',
            status: SubscriptionStatus.ACTIVE,
            tier: SubscriptionTier.MONTHLY,
            endDate: storeEnd,
        };
        tx.subscription.findUnique.mockResolvedValueOnce(existingSub);
        tx.subscriptionTransaction.findUnique.mockResolvedValueOnce({
            id: 'tx-existing',
            transactionId: 'apple-tx-dup',
            status: TransactionStatus.COMPLETED,
            subscription: existingSub,
        });

        const result = await service.processPurchase('user-1', {
            receipt: 'base64-receipt',
            provider: PaymentProvider.APPLE,
            productId: 'com.wellness.premium.monthly',
            transactionId: 'apple-tx-dup',
        });

        expect(result).toEqual(existingSub);
        expect(tx.subscription.update).not.toHaveBeenCalled();
        expect(tx.subscriptionTransaction.create).not.toHaveBeenCalled();
        expect(notificationService.sendSubscriptionStarted).not.toHaveBeenCalled();
        expect(analyticsService.trackConversion).not.toHaveBeenCalled();
    });

    it('restorePurchases ignores expired receipts and refuses restore when no active receipt exists', async () => {
        const { service, prisma, receiptValidator } = createHarness();

        receiptValidator.validateAppleReceipt.mockResolvedValue({
            transactionId: 'apple-tx-expired',
            originalTransactionId: 'apple-orig-expired',
            productId: 'com.wellness.premium.yearly',
            purchaseDate: pastDate(400),
            expiresDate: pastDate(10),
            isTrialPeriod: false,
            isActive: false,
        });

        await expect(
            service.restorePurchases('user-1', {
                receipts: ['expired-receipt'],
                provider: PaymentProvider.APPLE,
            }),
        ).rejects.toThrow(BadRequestException);

        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('restores Google Play subscriptions from Android purchase JSON strings and picks furthest active expiry', async () => {
        const { service, tx, receiptValidator } = createHarness();

        const closerEnd = futureDate(10);
        const furthestEnd = futureDate(200);
        const expiredEnd = pastDate(5);

        receiptValidator.validateGoogleReceipt
            .mockResolvedValueOnce({
                transactionId: 'GPA.EXPIRED',
                originalTransactionId: 'GPA.EXPIRED',
                productId: 'premium_monthly',
                purchaseDate: pastDate(35),
                expiresDate: expiredEnd,
                isTrialPeriod: false,
                isActive: false,
                autoRenewing: false,
            })
            .mockResolvedValueOnce({
                transactionId: 'GPA.MONTHLY',
                originalTransactionId: 'GPA.MONTHLY',
                productId: 'premium_monthly',
                purchaseDate: pastDate(20),
                expiresDate: closerEnd,
                isTrialPeriod: false,
                isActive: true,
                autoRenewing: true,
            })
            .mockResolvedValueOnce({
                transactionId: 'GPA.YEARLY',
                originalTransactionId: 'GPA.YEARLY',
                productId: 'premium_yearly',
                purchaseDate: pastDate(165),
                expiresDate: furthestEnd,
                isTrialPeriod: false,
                isActive: true,
                autoRenewing: true,
            });

        tx.subscription.findUnique
            .mockResolvedValueOnce(null) // owner check
            .mockResolvedValueOnce(null); // user's existing subscription
        tx.subscription.create.mockResolvedValue({
            id: 'sub-google-1',
            userId: 'user-android',
            status: SubscriptionStatus.ACTIVE,
            tier: SubscriptionTier.YEARLY,
            endDate: furthestEnd,
        });

        const result = await service.restorePurchases('user-android', {
            provider: PaymentProvider.GOOGLE,
            receipts: [
                JSON.stringify({
                    productId: 'premium_monthly',
                    purchaseToken: 'tok-expired',
                    packageName: 'com.kadinatlasi.wellness',
                }),
                JSON.stringify({
                    productId: 'premium_monthly',
                    purchaseToken: 'tok-monthly',
                    packageName: 'com.kadinatlasi.wellness',
                }),
                {
                    productId: 'premium_yearly',
                    purchaseToken: 'tok-yearly',
                    packageName: 'com.kadinatlasi.wellness',
                },
            ],
        });

        expect(receiptValidator.validateGoogleReceipt).toHaveBeenCalledTimes(3);
        expect(tx.subscription.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: 'user-android',
                tier: SubscriptionTier.YEARLY,
                endDate: furthestEnd,
                originalTransactionId: 'GPA.YEARLY',
                latestReceiptData: 'tok-yearly',
            }),
        });
        expect(tx.subscriptionTransaction.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                transactionId: 'GPA.YEARLY',
                productId: 'premium_yearly',
                receiptData: 'tok-yearly',
            }),
        });
        expect(result.endDate).toEqual(furthestEnd);
    });
});
