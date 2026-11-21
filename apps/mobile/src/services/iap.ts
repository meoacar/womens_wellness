/**
 * In-App Purchase Manager Service
 * 
 * Handles all IAP operations including:
 * - Connection initialization
 * - Product loading
 * - Purchase flow
 * - Purchase restoration
 * - Receipt validation
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6
 */

import { Platform } from 'react-native';
import {
    initConnection,
    endConnection,
    fetchProducts,
    requestPurchase,
    finishTransaction,
    getAvailablePurchases,
    getReceiptDataIOS,
    getTransactionJwsIOS,
    purchaseUpdatedListener,
    purchaseErrorListener,
    type Product,
    type Purchase,
    type PurchaseError,
} from 'react-native-iap';
import { getAllProductIds, getProductId, type SubscriptionTier } from '../config/iap.config';
import { subscriptionService } from './api';
import { subscriptionSyncService } from './subscriptionSync';
import type { PurchaseRequest } from '../types/subscription';

export function buildPurchaseVerificationPayload(
    purchase: Purchase,
    platformOS: string = Platform.OS,
): PurchaseRequest | null {
    const provider = platformOS === 'ios' ? 'APPLE' : 'GOOGLE';
    const purchaseToken = (
        (purchase as any).purchaseToken ||
        (purchase as any).purchaseTokenAndroid ||
        ''
    ).trim();
    const legacyReceipt =
        platformOS === 'ios'
            ? ((purchase as any).transactionReceipt || '').trim()
            : '';
    const receipt =
        platformOS === 'ios'
            ? (purchaseToken || legacyReceipt)
            : purchaseToken;

    if (!receipt) {
        return null;
    }

    const transactionId = (
        purchase.transactionId ||
        (provider === 'GOOGLE' ? purchaseToken : '') ||
        ''
    ).trim();

    return {
        receipt,
        provider,
        productId: purchase.productId,
        transactionId,
        ...(purchaseToken ? { purchaseToken } : {}),
    };
}

/**
 * IAP Error Types
 * Requirement 2.8: Error handling for purchase failures
 */
export enum IAPErrorCode {
    NOT_INITIALIZED = 'NOT_INITIALIZED',
    INITIALIZATION_FAILED = 'INITIALIZATION_FAILED',
    PRODUCT_NOT_FOUND = 'PRODUCT_NOT_FOUND',
    PURCHASE_FAILED = 'PURCHASE_FAILED',
    VALIDATION_FAILED = 'VALIDATION_FAILED',
    RESTORE_FAILED = 'RESTORE_FAILED',
    USER_CANCELLED = 'USER_CANCELLED',
    ALREADY_OWNED = 'ALREADY_OWNED',
    NO_RECEIPT = 'NO_RECEIPT',
    NETWORK_ERROR = 'NETWORK_ERROR',
    ITEM_UNAVAILABLE = 'ITEM_UNAVAILABLE',
    SERVICE_ERROR = 'SERVICE_ERROR',
    RECEIPT_FAILED = 'RECEIPT_FAILED',
    PAYMENT_INVALID = 'PAYMENT_INVALID',
    PAYMENT_NOT_ALLOWED = 'PAYMENT_NOT_ALLOWED',
    STORE_PRODUCT_NOT_AVAILABLE = 'STORE_PRODUCT_NOT_AVAILABLE',
    CLOUD_SERVICE_PERMISSION_DENIED = 'CLOUD_SERVICE_PERMISSION_DENIED',
    CLOUD_SERVICE_NETWORK_CONNECTION_FAILED = 'CLOUD_SERVICE_NETWORK_CONNECTION_FAILED',
    CLOUD_SERVICE_REVOKED = 'CLOUD_SERVICE_REVOKED',
    PRIVACY_ACKNOWLEDGEMENT_REQUIRED = 'PRIVACY_ACKNOWLEDGEMENT_REQUIRED',
    UNAUTHORIZED_REQUEST_DATA = 'UNAUTHORIZED_REQUEST_DATA',
    INVALID_OFFER_IDENTIFIER = 'INVALID_OFFER_IDENTIFIER',
    INVALID_SIGNATURE = 'INVALID_SIGNATURE',
    MISSING_OFFER_PARAMS = 'MISSING_OFFER_PARAMS',
    INVALID_OFFER_PRICE = 'INVALID_OFFER_PRICE',
}

/**
 * Custom error class for IAP operations
 * Provides detailed error information for better error handling
 */
export class IAPServiceError extends Error {
    constructor(
        public code: IAPErrorCode,
        message: string,
        public originalError?: any,
        public userMessage?: string // User-friendly message for display
    ) {
        super(message);
        this.name = 'IAPServiceError';
    }

    /**
     * Get user-friendly error message
     */
    getUserMessage(): string {
        if (this.userMessage) return this.userMessage;

        // Default user messages based on error code
        switch (this.code) {
            case IAPErrorCode.USER_CANCELLED:
                return 'Satın alma işlemi iptal edildi.';
            case IAPErrorCode.ALREADY_OWNED:
                return 'Bu aboneliğe zaten sahipsiniz. Satın alımlarınızı geri yükleyebilirsiniz.';
            case IAPErrorCode.NETWORK_ERROR:
                return 'İnternet bağlantınızı kontrol edin ve tekrar deneyin.';
            case IAPErrorCode.ITEM_UNAVAILABLE:
                return 'Bu ürün şu anda satın alınamıyor. Lütfen daha sonra tekrar deneyin.';
            case IAPErrorCode.PAYMENT_INVALID:
                return 'Ödeme bilgileriniz geçersiz. Lütfen ödeme yönteminizi kontrol edin.';
            case IAPErrorCode.PAYMENT_NOT_ALLOWED:
                return 'Bu cihazda satın alma yapma izniniz yok. Lütfen cihaz ayarlarınızı kontrol edin.';
            case IAPErrorCode.VALIDATION_FAILED:
                return 'Satın alma doğrulanamadı. Lütfen destek ekibiyle iletişime geçin.';
            case IAPErrorCode.RESTORE_FAILED:
                return 'Satın alımlar geri yüklenemedi. Lütfen tekrar deneyin.';
            case IAPErrorCode.SERVICE_ERROR:
                return 'Mağaza servisi şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.';
            case IAPErrorCode.PRODUCT_NOT_FOUND:
                return 'Ürün bulunamadı. Lütfen uygulamayı güncelleyin.';
            default:
                return 'Bir hata oluştu. Lütfen tekrar deneyin.';
        }
    }

    /**
     * Check if error is recoverable (user can retry)
     */
    isRecoverable(): boolean {
        const recoverableErrors = [
            IAPErrorCode.NETWORK_ERROR,
            IAPErrorCode.SERVICE_ERROR,
            IAPErrorCode.CLOUD_SERVICE_NETWORK_CONNECTION_FAILED,
        ];
        return recoverableErrors.includes(this.code);
    }

    /**
     * Check if error requires user action
     */
    requiresUserAction(): boolean {
        const actionRequiredErrors = [
            IAPErrorCode.ALREADY_OWNED,
            IAPErrorCode.PAYMENT_INVALID,
            IAPErrorCode.PAYMENT_NOT_ALLOWED,
            IAPErrorCode.PRIVACY_ACKNOWLEDGEMENT_REQUIRED,
        ];
        return actionRequiredErrors.includes(this.code);
    }
}

/**
 * IAP Manager Class
 * Singleton service for managing in-app purchases
 */
class IAPManager {
    private products: Product[] = [];
    private isInitialized = false;
    private purchaseUpdateSubscription: any = null;
    private purchaseErrorSubscription: any = null;
    private initializationPromise: Promise<void> | null = null;

    /**
     * Initialize IAP connection and load products
     * Requirements: 2.1, 2.2, 2.3
     * 
     * @throws {IAPServiceError} If initialization fails
     */
    async initialize(): Promise<void> {
        // If already initialized, return immediately
        if (this.isInitialized) {
            console.log('[IAP] Already initialized');
            return;
        }

        // If initialization is in progress, wait for it
        if (this.initializationPromise) {
            console.log('[IAP] Initialization in progress, waiting...');
            return this.initializationPromise;
        }

        // Start initialization
        this.initializationPromise = this._initialize();

        try {
            await this.initializationPromise;
        } finally {
            this.initializationPromise = null;
        }
    }

    /**
     * Internal initialization method
     */
    private async _initialize(): Promise<void> {
        try {
            console.log('[IAP] Initializing connection...');

            // Initialize connection with retry logic
            let retries = 3;
            let lastError: any;

            while (retries > 0) {
                try {
                    await initConnection();
                    break;
                } catch (error) {
                    lastError = error;
                    retries--;
                    if (retries > 0) {
                        console.log(`[IAP] Connection failed, retrying... (${retries} attempts left)`);
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            }

            if (retries === 0) {
                throw new IAPServiceError(
                    IAPErrorCode.INITIALIZATION_FAILED,
                    'Failed to initialize IAP connection after multiple attempts',
                    lastError
                );
            }

            console.log('[IAP] Connection established');

            // Load products
            console.log('[IAP] Loading products...');
            await this.loadProducts();

            // Setup listeners
            console.log('[IAP] Setting up listeners...');
            this.setupListeners();

            this.isInitialized = true;
            console.log('[IAP] Initialization complete');
        } catch (error) {
            console.error('[IAP] Initialization failed:', error);

            if (error instanceof IAPServiceError) {
                throw error;
            }

            throw new IAPServiceError(
                IAPErrorCode.INITIALIZATION_FAILED,
                'Failed to initialize IAP',
                error
            );
        }
    }

    /**
     * Load available products from store
     * Requirements: 2.2, 2.3
     * 
     * @throws {IAPServiceError} If product loading fails
     */
    async loadProducts(): Promise<void> {
        try {
            const platform = Platform.OS as 'ios' | 'android';
            const productIds = getAllProductIds(platform);

            console.log('[IAP] Loading products for platform:', platform);
            console.log('[IAP] Product IDs:', productIds);

            if (productIds.length === 0) {
                throw new IAPServiceError(
                    IAPErrorCode.PRODUCT_NOT_FOUND,
                    'No product IDs configured for this platform'
                );
            }

            // Load subscriptions
            const result = await fetchProducts({ skus: productIds, type: 'subs' });
            this.products = result || [];

            console.log('[IAP] Products loaded:', this.products.length);

            if (this.products.length === 0) {
                console.warn('[IAP] No products returned from store');
            } else {
                this.products.forEach(product => {
                    console.log('[IAP] Product:', {
                        id: product.id,
                        title: product.title,
                        price: product.displayPrice,
                    });
                });
            }
        } catch (error) {
            console.error('[IAP] Failed to load products:', error);

            if (error instanceof IAPServiceError) {
                throw error;
            }

            throw new IAPServiceError(
                IAPErrorCode.PRODUCT_NOT_FOUND,
                'Failed to load products from store',
                error
            );
        }
    }

    /**
     * Get all loaded products
     * Requirements: 2.3
     * 
     * @returns Array of available products
     */
    getProducts(): Product[] {
        if (!this.isInitialized) {
            console.warn('[IAP] Getting products before initialization');
        }
        return [...this.products];
    }

    /**
     * Get specific product by tier
     * Requirements: 2.3
     * 
     * @param tier - Subscription tier (monthly or yearly)
     * @returns Product if found, undefined otherwise
     */
    getProduct(tier: SubscriptionTier): Product | undefined {
        if (!this.isInitialized) {
            console.warn('[IAP] Getting product before initialization');
        }

        const platform = Platform.OS as 'ios' | 'android';
        const productId = getProductId(tier, platform);

        const product = this.products.find(p => p.id === productId);

        if (!product) {
            console.warn(`[IAP] Product not found for tier: ${tier}, productId: ${productId}`);
        }

        return product;
    }

    /**
     * Check if IAP is initialized
     * 
     * @returns True if initialized, false otherwise
     */
    isReady(): boolean {
        return this.isInitialized;
    }

    /**
     * Request purchase for a subscription tier
     * Requirements: 2.4, 2.5, 2.6, 2.7, 2.8
     * 
     * Note: This method initiates the purchase flow.
     * The actual purchase result will be received through purchaseUpdatedListener.
     * 
     * @param tier - Subscription tier to purchase
     * @throws {IAPServiceError} If purchase request fails
     */
    async purchase(tier: SubscriptionTier): Promise<void> {
        // Check initialization
        if (!this.isInitialized) {
            throw new IAPServiceError(
                IAPErrorCode.NOT_INITIALIZED,
                'IAP not initialized. Call initialize() first.',
                undefined,
                'Satın alma sistemi hazır değil. Lütfen uygulamayı yeniden başlatın.'
            );
        }

        // Get product
        const product = this.getProduct(tier);
        if (!product) {
            throw new IAPServiceError(
                IAPErrorCode.PRODUCT_NOT_FOUND,
                `Product not found for tier: ${tier}`,
                undefined,
                'Ürün bulunamadı. Lütfen uygulamayı güncelleyin.'
            );
        }

        try {
            console.log('[IAP] Requesting purchase for:', {
                tier,
                productId: product.id,
                price: product.displayPrice,
            });

            // Request subscription
            // Note: requestPurchase is event-based, not promise-based
            // The actual purchase will be received through purchaseUpdatedListener
            await requestPurchase({
                skus: [product.id],
            } as any);

            console.log('[IAP] Purchase request sent successfully');
            console.log('[IAP] Waiting for purchase result through listener...');
        } catch (error: any) {
            console.error('[IAP] Purchase request failed:', error);

            // Map error codes to our error types
            const errorCode = error.code as string;

            // User cancelled
            if (errorCode === 'E_USER_CANCELLED') {
                throw new IAPServiceError(
                    IAPErrorCode.USER_CANCELLED,
                    'User cancelled the purchase',
                    error
                );
            }

            // Already owned
            if (errorCode === 'E_ALREADY_OWNED') {
                throw new IAPServiceError(
                    IAPErrorCode.ALREADY_OWNED,
                    'User already owns this subscription',
                    error
                );
            }

            // Item unavailable
            if (errorCode === 'E_ITEM_UNAVAILABLE') {
                throw new IAPServiceError(
                    IAPErrorCode.ITEM_UNAVAILABLE,
                    'Product is not available for purchase',
                    error
                );
            }

            // Network error
            if (errorCode === 'E_NETWORK_ERROR') {
                throw new IAPServiceError(
                    IAPErrorCode.NETWORK_ERROR,
                    'Network error during purchase',
                    error
                );
            }

            // Service error
            if (errorCode === 'E_SERVICE_ERROR') {
                throw new IAPServiceError(
                    IAPErrorCode.SERVICE_ERROR,
                    'Store service error',
                    error
                );
            }

            // Payment invalid
            if (errorCode === 'E_PAYMENT_INVALID') {
                throw new IAPServiceError(
                    IAPErrorCode.PAYMENT_INVALID,
                    'Payment information is invalid',
                    error
                );
            }

            // Payment not allowed
            if (errorCode === 'E_PAYMENT_NOT_ALLOWED') {
                throw new IAPServiceError(
                    IAPErrorCode.PAYMENT_NOT_ALLOWED,
                    'Payments are not allowed on this device',
                    error
                );
            }

            // Store product not available (iOS specific)
            if (errorCode === 'E_STORE_PRODUCT_NOT_AVAILABLE') {
                throw new IAPServiceError(
                    IAPErrorCode.STORE_PRODUCT_NOT_AVAILABLE,
                    'Product not available in store',
                    error
                );
            }

            // Cloud service errors (iOS specific)
            if (errorCode === 'E_CLOUD_SERVICE_PERMISSION_DENIED') {
                throw new IAPServiceError(
                    IAPErrorCode.CLOUD_SERVICE_PERMISSION_DENIED,
                    'Cloud service permission denied',
                    error,
                    'iCloud izni gerekli. Lütfen cihaz ayarlarınızdan iCloud\'u etkinleştirin.'
                );
            }

            if (errorCode === 'E_CLOUD_SERVICE_NETWORK_CONNECTION_FAILED') {
                throw new IAPServiceError(
                    IAPErrorCode.CLOUD_SERVICE_NETWORK_CONNECTION_FAILED,
                    'Cloud service network connection failed',
                    error
                );
            }

            if (errorCode === 'E_CLOUD_SERVICE_REVOKED') {
                throw new IAPServiceError(
                    IAPErrorCode.CLOUD_SERVICE_REVOKED,
                    'Cloud service access revoked',
                    error,
                    'iCloud erişimi iptal edildi. Lütfen cihaz ayarlarınızı kontrol edin.'
                );
            }

            // Privacy acknowledgement required (iOS 14+)
            if (errorCode === 'E_PRIVACY_ACKNOWLEDGEMENT_REQUIRED') {
                throw new IAPServiceError(
                    IAPErrorCode.PRIVACY_ACKNOWLEDGEMENT_REQUIRED,
                    'Privacy acknowledgement required',
                    error,
                    'Gizlilik onayı gerekli. Lütfen App Store ayarlarınızı kontrol edin.'
                );
            }

            // Offer errors (iOS specific)
            if (errorCode === 'E_UNAUTHORIZED_REQUEST_DATA') {
                throw new IAPServiceError(
                    IAPErrorCode.UNAUTHORIZED_REQUEST_DATA,
                    'Unauthorized request data',
                    error
                );
            }

            if (errorCode === 'E_INVALID_OFFER_IDENTIFIER') {
                throw new IAPServiceError(
                    IAPErrorCode.INVALID_OFFER_IDENTIFIER,
                    'Invalid offer identifier',
                    error
                );
            }

            if (errorCode === 'E_INVALID_SIGNATURE') {
                throw new IAPServiceError(
                    IAPErrorCode.INVALID_SIGNATURE,
                    'Invalid signature',
                    error
                );
            }

            if (errorCode === 'E_MISSING_OFFER_PARAMS') {
                throw new IAPServiceError(
                    IAPErrorCode.MISSING_OFFER_PARAMS,
                    'Missing offer parameters',
                    error
                );
            }

            if (errorCode === 'E_INVALID_OFFER_PRICE') {
                throw new IAPServiceError(
                    IAPErrorCode.INVALID_OFFER_PRICE,
                    'Invalid offer price',
                    error
                );
            }

            // Generic purchase failed
            throw new IAPServiceError(
                IAPErrorCode.PURCHASE_FAILED,
                'Purchase request failed',
                error,
                error.message || 'Satın alma başarısız oldu. Lütfen tekrar deneyin.'
            );
        }
    }

    /**
     * Restore previous purchases
     * Requirements: 2.5, 2.6, 2.7
     * 
     * @returns Array of restored purchases
     * @throws {IAPServiceError} If restore fails
     */
    async restorePurchases(): Promise<Purchase[]> {
        // Check initialization
        if (!this.isInitialized) {
            throw new IAPServiceError(
                IAPErrorCode.NOT_INITIALIZED,
                'IAP not initialized. Call initialize() first.',
                undefined,
                'Satın alma sistemi hazır değil. Lütfen uygulamayı yeniden başlatın.'
            );
        }

        try {
            console.log('[IAP] Restoring purchases...');

            // Get available purchases
            const purchases = await getAvailablePurchases();

            console.log('[IAP] Found purchases:', purchases.length);

            if (purchases.length === 0) {
                console.log('[IAP] No purchases to restore');
                // Return empty array - not an error, just no purchases found
                return [];
            }

            // Log purchase details
            purchases.forEach((purchase, index) => {
                console.log(`[IAP] Purchase ${index + 1}:`, {
                    productId: purchase.productId,
                    transactionId: purchase.transactionId,
                    transactionDate: purchase.transactionDate,
                });
            });

            // Filter only subscription purchases
            const subscriptionPurchases = purchases.filter(purchase => {
                const platform = Platform.OS as 'ios' | 'android';
                const productIds = getAllProductIds(platform);
                return productIds.includes(purchase.productId);
            });

            console.log('[IAP] Subscription purchases:', subscriptionPurchases.length);

            if (subscriptionPurchases.length === 0) {
                console.log('[IAP] No subscription purchases to restore');
                return [];
            }

            // Track validation results
            const validationResults: {
                success: Purchase[];
                failed: Array<{ purchase: Purchase; error: any }>;
            } = {
                success: [],
                failed: [],
            };

            // Validate each purchase with backend
            for (const purchase of subscriptionPurchases) {
                try {
                    await this.validatePurchase(purchase);
                    validationResults.success.push(purchase);
                    console.log('[IAP] Successfully validated purchase:', purchase.productId);
                } catch (error) {
                    console.error('[IAP] Failed to validate restored purchase:', error);
                    validationResults.failed.push({ purchase, error });
                    // Continue with other purchases even if one fails
                }
            }

            console.log('[IAP] Validation results:', {
                success: validationResults.success.length,
                failed: validationResults.failed.length,
            });

            // If all validations failed, throw error
            if (validationResults.success.length === 0 && validationResults.failed.length > 0) {
                const firstError = validationResults.failed[0].error;
                throw new IAPServiceError(
                    IAPErrorCode.VALIDATION_FAILED,
                    'All purchase validations failed',
                    firstError,
                    'Satın alımlar doğrulanamadı. Lütfen internet bağlantınızı kontrol edin ve tekrar deneyin.'
                );
            }

            // Sync subscription status after restore
            // Requirement 14.5: WHEN abonelik durumu değiştiğinde, THE System SHALL tüm cihazları günceller
            if (validationResults.success.length > 0) {
                console.log('[IAP] Syncing subscription after restore...');
                try {
                    await subscriptionSyncService.handleSubscriptionChange();
                } catch (syncError) {
                    console.error('[IAP] Failed to sync after restore:', syncError);
                    // Don't throw - restore was successful, sync can be retried later
                }
            }

            return validationResults.success;
        } catch (error: any) {
            console.error('[IAP] Restore failed:', error);

            if (error instanceof IAPServiceError) {
                throw error;
            }

            // Map specific error codes
            const errorCode = error.code as string;

            if (errorCode === 'E_NETWORK_ERROR') {
                throw new IAPServiceError(
                    IAPErrorCode.NETWORK_ERROR,
                    'Network error during restore',
                    error
                );
            }

            if (errorCode === 'E_SERVICE_ERROR') {
                throw new IAPServiceError(
                    IAPErrorCode.SERVICE_ERROR,
                    'Store service error during restore',
                    error
                );
            }

            if (errorCode === 'E_RECEIPT_FAILED') {
                throw new IAPServiceError(
                    IAPErrorCode.RECEIPT_FAILED,
                    'Receipt validation failed during restore',
                    error
                );
            }

            throw new IAPServiceError(
                IAPErrorCode.RESTORE_FAILED,
                'Failed to restore purchases',
                error,
                error.message || 'Satın alımlar geri yüklenemedi. Lütfen tekrar deneyin.'
            );
        }
    }

    /**
     * Validate purchase with backend
     * Requirements: 2.6, 2.7, 2.8
     * 
     * @param purchase - Purchase to validate
     * @throws {IAPServiceError} If validation fails
     */
    async validatePurchase(purchase: Purchase): Promise<void> {
        try {
            console.log('[IAP] Validating purchase with backend:', {
                productId: purchase.productId,
                transactionId: purchase.transactionId,
            });

            let payload = buildPurchaseVerificationPayload(purchase);

            if (!payload && Platform.OS === 'ios') {
                let iosToken = '';
                if (typeof getTransactionJwsIOS === 'function' && purchase.productId) {
                    iosToken = ((await getTransactionJwsIOS(purchase.productId)) || '').trim();
                }
                let iosLegacyReceipt = '';
                if (!iosToken && typeof getReceiptDataIOS === 'function') {
                    iosLegacyReceipt = ((await getReceiptDataIOS()) || '').trim();
                }
                if (iosToken || iosLegacyReceipt) {
                    payload = buildPurchaseVerificationPayload({
                        ...purchase,
                        ...(iosToken ? { purchaseToken: iosToken } : {}),
                        ...(iosLegacyReceipt ? { transactionReceipt: iosLegacyReceipt } : {}),
                    } as Purchase);
                }
            }

            // Check receipt exists
            if (!payload) {
                throw new IAPServiceError(
                    IAPErrorCode.NO_RECEIPT,
                    'No receipt found in purchase object',
                    undefined,
                    'Satın alma makbuzu bulunamadı. Lütfen destek ekibiyle iletişime geçin.'
                );
            }

            if (!payload.transactionId) {
                console.warn('[IAP] No transaction ID found, using empty string');
            }

            // Send to backend for validation with retry logic
            console.log('[IAP] Sending validation request to backend...');

            let lastError: any;
            let retries = 3;

            while (retries > 0) {
                try {
                    await subscriptionService.processPurchase(payload);

                    // Success - break retry loop
                    break;
                } catch (error: any) {
                    lastError = error;
                    retries--;

                    // Check if error is network-related and retryable
                    const isNetworkError =
                        error.message?.includes('network') ||
                        error.message?.includes('bağlantı') ||
                        error.message?.includes('internet') ||
                        error.name === 'TypeError' ||
                        error.name === 'NetworkError';

                    if (isNetworkError && retries > 0) {
                        console.log(`[IAP] Network error, retrying... (${retries} attempts left)`);
                        // Wait before retry (exponential backoff)
                        await new Promise(resolve => setTimeout(resolve, (4 - retries) * 1000));
                    } else {
                        // Non-network error or no retries left
                        throw error;
                    }
                }
            }

            if (retries === 0) {
                throw lastError;
            }

            console.log('[IAP] Purchase validated successfully by backend');

            // Finish transaction
            await this.finishTransaction(purchase);

            // Sync subscription status after successful purchase
            // Requirement 14.5: WHEN abonelik durumu değiştiğinde, THE System SHALL tüm cihazları günceller
            console.log('[IAP] Syncing subscription after purchase...');
            try {
                await subscriptionSyncService.handleSubscriptionChange();
            } catch (syncError) {
                console.error('[IAP] Failed to sync after validation:', syncError);
                // Don't throw - validation was successful, sync can be retried later
            }

            console.log('[IAP] Purchase validation complete');
        } catch (error: any) {
            console.error('[IAP] Validation failed:', error);

            if (error instanceof IAPServiceError) {
                throw error;
            }

            // Check for network errors
            const isNetworkError =
                error.message?.includes('network') ||
                error.message?.includes('bağlantı') ||
                error.message?.includes('internet') ||
                error.name === 'TypeError' ||
                error.name === 'NetworkError';

            if (isNetworkError) {
                throw new IAPServiceError(
                    IAPErrorCode.NETWORK_ERROR,
                    'Network error during validation',
                    error,
                    'İnternet bağlantınızı kontrol edin. Satın alımınız kaydedildi ve daha sonra doğrulanacak.'
                );
            }

            // Check for backend validation errors
            if (error.message?.includes('receipt') || error.message?.includes('makbuz')) {
                throw new IAPServiceError(
                    IAPErrorCode.RECEIPT_FAILED,
                    'Receipt validation failed',
                    error,
                    'Satın alma makbuzu doğrulanamadı. Lütfen destek ekibiyle iletişime geçin.'
                );
            }

            throw new IAPServiceError(
                IAPErrorCode.VALIDATION_FAILED,
                'Failed to validate purchase with backend',
                error,
                error.message || 'Satın alma doğrulanamadı. Lütfen destek ekibiyle iletişime geçin.'
            );
        }
    }

    /**
     * Finish transaction (acknowledge purchase)
     * Requirements: 2.8
     * 
     * @param purchase - Purchase to finish
     */
    async finishTransaction(purchase: Purchase): Promise<void> {
        try {
            console.log('[IAP] Finishing transaction:', {
                transactionId: purchase.transactionId,
                productId: purchase.productId,
            });

            // Finish transaction (works for both iOS and Android)
            await finishTransaction({
                purchase,
                isConsumable: false
            });

            console.log('[IAP] Transaction finished successfully');
        } catch (error) {
            console.error('[IAP] Failed to finish transaction:', error);
            // Don't throw - this is not critical
            // The purchase is already validated with backend
        }
    }

    /**
     * Setup purchase listeners
     * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6
     */
    private setupListeners(): void {
        console.log('[IAP] Setting up event listeners...');

        // Remove existing listeners if any
        this.removeListeners();

        // Listen for purchase updates
        this.purchaseUpdateSubscription = purchaseUpdatedListener(
            async (purchase: Purchase) => {
                console.log('[IAP] Purchase updated event received:', {
                    productId: purchase.productId,
                    transactionId: purchase.transactionId,
                    transactionDate: purchase.transactionDate,
                });

                // Verify receipt/purchaseToken presence before validating (iOS can fall back to StoreKit receipt/JWS helpers)
                const payload = buildPurchaseVerificationPayload(purchase);
                if (!payload && Platform.OS !== 'ios') {
                    console.error('[IAP] No receipt in purchase update');
                    return;
                }

                // Validate purchase automatically
                try {
                    console.log('[IAP] Auto-validating purchase...');
                    await this.validatePurchase(purchase);
                    console.log('[IAP] Auto-validation successful');
                } catch (error) {
                    console.error('[IAP] Auto-validation failed:', error);

                    // Log error details for debugging
                    if (error instanceof IAPServiceError) {
                        console.error('[IAP] Error code:', error.code);
                        console.error('[IAP] Error message:', error.message);
                    }
                }
            }
        );

        // Listen for purchase errors
        this.purchaseErrorSubscription = purchaseErrorListener(
            (error: PurchaseError) => {
                console.error('[IAP] Purchase error event received:', {
                    code: error.code,
                    message: error.message,
                });

                // Handle specific error codes
                const errorCode = error.code as string;
                switch (errorCode) {
                    case 'E_USER_CANCELLED':
                        console.log('[IAP] User cancelled the purchase');
                        break;

                    case 'E_ALREADY_OWNED':
                        console.log('[IAP] User already owns this subscription');
                        console.log('[IAP] Consider calling restorePurchases()');
                        break;

                    case 'E_ITEM_UNAVAILABLE':
                        console.error('[IAP] Product is not available for purchase');
                        break;

                    case 'E_NETWORK_ERROR':
                        console.error('[IAP] Network error during purchase');
                        break;

                    case 'E_SERVICE_ERROR':
                        console.error('[IAP] Store service error');
                        break;

                    case 'E_RECEIPT_FAILED':
                        console.error('[IAP] Receipt validation failed');
                        break;

                    case 'E_RECEIPT_FINISHED_FAILED':
                        console.error('[IAP] Failed to finish receipt');
                        break;

                    default:
                        console.error('[IAP] Unexpected purchase error:', error.message);
                        break;
                }
            }
        );

        console.log('[IAP] Event listeners setup complete');
    }

    /**
     * Remove purchase listeners
     */
    private removeListeners(): void {
        if (this.purchaseUpdateSubscription) {
            console.log('[IAP] Removing purchase update listener');
            this.purchaseUpdateSubscription.remove();
            this.purchaseUpdateSubscription = null;
        }

        if (this.purchaseErrorSubscription) {
            console.log('[IAP] Removing purchase error listener');
            this.purchaseErrorSubscription.remove();
            this.purchaseErrorSubscription = null;
        }
    }

    /**
     * Cleanup and disconnect
     * Requirements: 13.6
     * 
     * Should be called when app is closing or IAP is no longer needed
     */
    async cleanup(): Promise<void> {
        try {
            console.log('[IAP] Starting cleanup...');

            // Remove listeners
            this.removeListeners();

            // Clear products
            this.products = [];

            // End connection
            if (this.isInitialized) {
                console.log('[IAP] Ending IAP connection...');
                await endConnection();
            }

            // Reset state
            this.isInitialized = false;
            this.initializationPromise = null;

            console.log('[IAP] Cleanup complete');
        } catch (error) {
            console.error('[IAP] Cleanup failed:', error);
            // Don't throw - cleanup should be best effort
        }
    }

    /**
     * Check if IAP is available on this device
     * 
     * @returns True if IAP is available, false otherwise
     */
    async isAvailable(): Promise<boolean> {
        try {
            console.log('[IAP] Checking availability...');

            // Try to initialize connection
            await initConnection();
            await endConnection();

            console.log('[IAP] IAP is available');
            return true;
        } catch (error) {
            console.error('[IAP] IAP not available:', error);
            return false;
        }
    }

    /**
     * Get current initialization status
     * 
     * @returns Current initialization status
     */
    getStatus(): {
        isInitialized: boolean;
        productsLoaded: number;
        hasListeners: boolean;
    } {
        return {
            isInitialized: this.isInitialized,
            productsLoaded: this.products.length,
            hasListeners: !!(this.purchaseUpdateSubscription && this.purchaseErrorSubscription),
        };
    }
}

// Export singleton instance
export const iapManager = new IAPManager();

// Export types
export type { Product, Purchase, SubscriptionTier };
