jest.mock('react-native', () => ({
    Platform: { OS: 'android' },
}));

jest.mock('react-native-iap', () => ({
    initConnection: jest.fn(),
    endConnection: jest.fn(),
    fetchProducts: jest.fn(),
    requestPurchase: jest.fn(),
    finishTransaction: jest.fn(),
    getAvailablePurchases: jest.fn(),
    purchaseUpdatedListener: jest.fn(),
    purchaseErrorListener: jest.fn(),
}));

jest.mock('../api', () => ({
    subscriptionService: {
        processPurchase: jest.fn(),
    },
}));

jest.mock('../subscriptionSync', () => ({
    subscriptionSyncService: {
        handleSubscriptionChange: jest.fn(),
    },
}));

import { buildPurchaseVerificationPayload, iapManager } from '../iap';
import { subscriptionService } from '../api';
import { subscriptionSyncService } from '../subscriptionSync';

describe('Android & iOS IAP purchase verification payload', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('sends explicit purchaseToken alongside order transactionId on Android', async () => {
        const purchase = {
            productId: 'premium_monthly',
            transactionId: 'GPA.1234-5678-9012-34567',
            purchaseToken: 'google-play-token-abc',
            transactionDate: Date.now(),
        } as any;

        const payload = buildPurchaseVerificationPayload(purchase, 'android');
        expect(payload).toEqual({
            receipt: 'google-play-token-abc',
            provider: 'GOOGLE',
            productId: 'premium_monthly',
            transactionId: 'GPA.1234-5678-9012-34567',
            purchaseToken: 'google-play-token-abc',
        });

        await iapManager.validatePurchase(purchase);

        expect(subscriptionService.processPurchase).toHaveBeenCalledWith({
            receipt: 'google-play-token-abc',
            provider: 'GOOGLE',
            productId: 'premium_monthly',
            transactionId: 'GPA.1234-5678-9012-34567',
            purchaseToken: 'google-play-token-abc',
        });
        expect(subscriptionSyncService.handleSubscriptionChange).toHaveBeenCalledTimes(1);
    });

    it('sends StoreKit 2 iOS purchaseToken (JWS) when transactionReceipt is absent', () => {
        const jwsToken = 'eyJhbGciOiJFUzI1NiJ9.eyJ0cmFuc2FjdGlvbklkIjoiMjAwMDAwMDEyMyJ9.c2ln';
        const purchase = {
            productId: 'com.wellness.premium.monthly',
            transactionId: '2000000123456',
            purchaseToken: jwsToken,
            transactionDate: Date.now(),
        } as any;

        expect(buildPurchaseVerificationPayload(purchase, 'ios')).toEqual({
            receipt: jwsToken,
            provider: 'APPLE',
            productId: 'com.wellness.premium.monthly',
            transactionId: '2000000123456',
            purchaseToken: jwsToken,
        });
    });

    it('sends legacy transactionReceipt without purchaseToken on iOS StoreKit 1', () => {
        const purchase = {
            productId: 'com.wellness.premium.monthly',
            transactionId: '2000000123456',
            transactionReceipt: 'apple-base64-receipt',
            transactionDate: Date.now(),
        } as any;

        expect(buildPurchaseVerificationPayload(purchase, 'ios')).toEqual({
            receipt: 'apple-base64-receipt',
            provider: 'APPLE',
            productId: 'com.wellness.premium.monthly',
            transactionId: '2000000123456',
        });
    });

    it('returns null when Android purchaseToken is missing', () => {
        const purchase = {
            productId: 'premium_monthly',
            transactionId: 'GPA.1234-5678-9012-34567',
            transactionDate: Date.now(),
        } as any;

        expect(buildPurchaseVerificationPayload(purchase, 'android')).toBeNull();
    });
});
