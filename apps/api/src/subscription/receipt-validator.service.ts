import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import {
    isCompactJws,
    loadAppleRootCertificates,
    parseAppleRootCertificatesFromPemOrB64,
    verifyAppleJws,
} from './utils/apple-jws-verifier';

// Apple Receipt Types
interface AppleReceiptData {
    transactionId: string;
    originalTransactionId: string;
    productId: string;
    purchaseDate: Date;
    expiresDate: Date;
    isTrialPeriod: boolean;
    isActive: boolean;
    environment: 'Production' | 'Sandbox';
}

interface AppleVerificationResponse {
    status: number;
    environment: string;
    receipt?: any;
    latest_receipt_info?: any[];
    pending_renewal_info?: any[];
}

// Google Receipt Types
interface GoogleReceiptData {
    transactionId: string;
    originalTransactionId: string;
    productId: string;
    purchaseDate: Date;
    expiresDate: Date;
    isTrialPeriod: boolean;
    isActive: boolean;
    autoRenewing: boolean;
}

interface GoogleSubscriptionResponse {
    kind: string;
    startTimeMillis: string;
    expiryTimeMillis: string;
    autoRenewing: boolean;
    priceCurrencyCode: string;
    priceAmountMicros: string;
    countryCode: string;
    developerPayload: string;
    paymentState?: number;
    cancelReason?: number;
    orderId: string;
    purchaseType?: number;
    acknowledgementState?: number;
}

/**
 * Receipt Validator Service
 * Handles validation of purchase receipts from Apple App Store and Google Play Store
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */
@Injectable()
export class ReceiptValidatorService {
    private readonly logger = new Logger(ReceiptValidatorService.name);

    // Apple verification endpoints
    private readonly APPLE_PRODUCTION_URL = 'https://buy.itunes.apple.com/verifyReceipt';
    private readonly APPLE_SANDBOX_URL = 'https://sandbox.itunes.apple.com/verifyReceipt';

    constructor(private readonly configService: ConfigService) { }

    /**
     * Validate Apple App Store receipt (StoreKit 2 signed JWS or legacy StoreKit 1 base64 receipt)
     * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
     */
    async validateAppleReceipt(receiptData: string): Promise<AppleReceiptData> {
        const trimmed = (receiptData || '').trim();
        if (!trimmed) {
            throw new BadRequestException('Apple makbuz verisi eksik');
        }

        if (isCompactJws(trimmed)) {
            this.logger.log('Validating Apple StoreKit 2 JWS transaction');
            return this.validateAppleJwsTransaction(trimmed);
        }

        this.logger.log('Validating legacy Apple receipt via verifyReceipt');

        const sharedSecret = this.configService.get<string>('APPLE_SHARED_SECRET');
        if (!sharedSecret) {
            throw new BadRequestException('Apple shared secret yapılandırılmamış');
        }

        // Try production environment first
        let response = await this.verifyAppleReceiptWithEndpoint(
            trimmed,
            sharedSecret,
            this.APPLE_PRODUCTION_URL,
        );

        // If status is 21007, receipt is from sandbox, try sandbox endpoint
        if (response.status === 21007) {
            this.logger.log('Receipt is from sandbox, trying sandbox endpoint');
            response = await this.verifyAppleReceiptWithEndpoint(
                trimmed,
                sharedSecret,
                this.APPLE_SANDBOX_URL,
            );
        }

        // Check response status
        if (response.status !== 0) {
            throw new BadRequestException(
                `Apple receipt doğrulama başarısız: ${this.getAppleErrorMessage(response.status)}`,
            );
        }

        // Parse and return receipt data
        return this.parseAppleReceipt(response);
    }

    private validateAppleJwsTransaction(signedJws: string): AppleReceiptData {
        let rootCertificates = loadAppleRootCertificates();
        if (rootCertificates.length === 0) {
            const configCerts =
                this.configService.get<string>('APPLE_ROOT_CA_CERTS') ||
                this.configService.get<string>('APPLE_ROOT_CA_PEM') ||
                '';
            rootCertificates = parseAppleRootCertificatesFromPemOrB64(configCerts);
        }

        let decoded: Record<string, any>;
        try {
            decoded = verifyAppleJws<Record<string, any>>(signedJws, {
                rootCertificates,
            }).payload;
        } catch (error) {
            throw new BadRequestException(
                `Apple StoreKit 2 JWS doğrulama başarısız: ${error instanceof Error ? error.message : 'Geçersiz imza'}`,
            );
        }

        const expectedBundleId =
            this.configService.get<string>('APPLE_BUNDLE_ID') ||
            process.env.APPLE_BUNDLE_ID ||
            'com.kadinatlasi.wellness';
        if (expectedBundleId && decoded.bundleId !== expectedBundleId) {
            throw new BadRequestException(
                `Apple bundleId eşleşmiyor (beklenen: ${expectedBundleId}, gelen: ${decoded.bundleId || 'yok'})`,
            );
        }

        const expectedEnvironment =
            this.configService.get<string>('APPLE_ENVIRONMENT') || process.env.APPLE_ENVIRONMENT;
        if (expectedEnvironment && decoded.environment !== expectedEnvironment) {
            throw new BadRequestException(
                `Apple environment eşleşmiyor (beklenen: ${expectedEnvironment}, gelen: ${decoded.environment || 'yok'})`,
            );
        }

        if (!decoded?.transactionId || !decoded?.originalTransactionId || !decoded?.productId) {
            throw new BadRequestException('Apple StoreKit 2 JWS işlem alanları eksik');
        }

        const purchaseDate = new Date(Number(decoded.purchaseDate));
        const expiresDate = new Date(Number(decoded.expiresDate));
        if (
            !Number.isFinite(purchaseDate.getTime()) ||
            !Number.isFinite(expiresDate.getTime())
        ) {
            throw new BadRequestException('Apple StoreKit 2 JWS tarih bilgileri geçersiz');
        }

        const now = new Date();
        const isCancelled = Boolean(decoded.revocationDate);
        const isActive = !isCancelled && expiresDate > now;
        const isTrialPeriod =
            decoded.offerDiscountType === 'FREE_TRIAL' ||
            (decoded.offerType === 1 && Number(decoded.price) === 0);

        return {
            transactionId: String(decoded.transactionId),
            originalTransactionId: String(decoded.originalTransactionId),
            productId: String(decoded.productId),
            purchaseDate,
            expiresDate,
            isTrialPeriod,
            isActive,
            environment: decoded.environment === 'Sandbox' ? 'Sandbox' : 'Production',
        };
    }

    /**
     * Validate Google Play Store receipt
     * Uses Google Play Developer API
     * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
     */
    async validateGoogleReceipt(
        packageName: string,
        productId: string,
        purchaseToken: string,
    ): Promise<GoogleReceiptData> {
        this.logger.log('Validating Google receipt');

        const serviceAccountKey = this.configService.get<string>('GOOGLE_SERVICE_ACCOUNT_KEY');
        if (!serviceAccountKey) {
            throw new BadRequestException('Google service account key yapılandırılmamış');
        }

        try {
            // Get access token
            const accessToken = await this.getGoogleAccessToken(serviceAccountKey);

            // Verify purchase with Google Play Developer API
            const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new BadRequestException(
                    `Google receipt doğrulama başarısız: ${response.status} - ${errorText}`,
                );
            }

            const data: GoogleSubscriptionResponse = await response.json();

            // Parse and return receipt data
            return this.parseGoogleReceipt(data, productId, purchaseToken);
        } catch (error) {
            this.logger.error('Google receipt validation error:', error);
            throw new BadRequestException(
                `Google receipt doğrulama hatası: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`,
            );
        }
    }

    /**
     * Check if receipt is valid and active
     * Requirements: 10.3, 10.4
     */
    isReceiptActive(receiptData: AppleReceiptData | GoogleReceiptData): boolean {
        // Check if subscription is still active
        if (!receiptData.isActive) {
            return false;
        }

        // Check if expiration date is in the future
        const now = new Date();
        if (receiptData.expiresDate && receiptData.expiresDate < now) {
            return false;
        }

        return true;
    }

    // Private helper methods

    /**
     * Verify Apple receipt with specific endpoint
     */
    private async verifyAppleReceiptWithEndpoint(
        receiptData: string,
        sharedSecret: string,
        endpoint: string,
    ): Promise<AppleVerificationResponse> {
        const requestBody = {
            'receipt-data': receiptData,
            password: sharedSecret,
            'exclude-old-transactions': true,
        };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            throw new BadRequestException(
                `Apple verification endpoint hatası: ${response.status}`,
            );
        }

        return await response.json();
    }

    /**
     * Parse Apple receipt response
     */
    private parseAppleReceipt(response: AppleVerificationResponse): AppleReceiptData {
        // Get the latest receipt info
        const latestReceiptInfo = response.latest_receipt_info;
        if (!latestReceiptInfo || latestReceiptInfo.length === 0) {
            throw new BadRequestException('Receipt bilgisi bulunamadı');
        }

        // Sort by purchase date and get the most recent
        const sortedReceipts = latestReceiptInfo.sort((a, b) => {
            return parseInt(b.purchase_date_ms) - parseInt(a.purchase_date_ms);
        });

        const latestReceipt = sortedReceipts[0];

        if (
            !latestReceipt?.transaction_id ||
            !latestReceipt?.original_transaction_id ||
            !latestReceipt?.product_id
        ) {
            throw new BadRequestException('Apple receipt alanları eksik');
        }

        // Parse dates
        const purchaseDate = new Date(parseInt(latestReceipt.purchase_date_ms, 10));
        const expiresDate = new Date(parseInt(latestReceipt.expires_date_ms, 10));
        if (
            !Number.isFinite(purchaseDate.getTime()) ||
            !Number.isFinite(expiresDate.getTime())
        ) {
            throw new BadRequestException('Apple receipt tarih bilgileri geçersiz');
        }

        // Check if active and not refunded/cancelled
        const now = new Date();
        const isCancelled = Boolean(latestReceipt.cancellation_date_ms);
        const isActive = !isCancelled && expiresDate > now;

        return {
            transactionId: latestReceipt.transaction_id,
            originalTransactionId: latestReceipt.original_transaction_id,
            productId: latestReceipt.product_id,
            purchaseDate,
            expiresDate,
            isTrialPeriod: latestReceipt.is_trial_period === 'true',
            isActive,
            environment: response.environment as 'Production' | 'Sandbox',
        };
    }

    /**
     * Parse Google receipt response
     */
    private parseGoogleReceipt(
        response: GoogleSubscriptionResponse,
        productId: string,
        purchaseToken: string,
    ): GoogleReceiptData {
        if (!response.orderId) {
            throw new BadRequestException('Google receipt sipariş numarası eksik');
        }

        // Parse dates
        const purchaseDate = new Date(parseInt(response.startTimeMillis, 10));
        const expiresDate = new Date(parseInt(response.expiryTimeMillis, 10));
        if (
            !Number.isFinite(purchaseDate.getTime()) ||
            !Number.isFinite(expiresDate.getTime())
        ) {
            throw new BadRequestException('Google receipt tarih bilgileri geçersiz');
        }

        // Check if active: not expired, not cancelled/revoked, and payment received (1) or free trial (2)
        const now = new Date();
        const isPaidOrTrial = response.paymentState === 1 || response.paymentState === 2;
        const isActive =
            expiresDate > now &&
            isPaidOrTrial &&
            response.cancelReason === undefined;

        // Check if trial period
        const isTrialPeriod = response.purchaseType === 0 || response.paymentState === 2;

        return {
            transactionId: response.orderId,
            originalTransactionId: response.orderId,
            productId,
            purchaseDate,
            expiresDate,
            isTrialPeriod,
            isActive,
            autoRenewing: response.autoRenewing,
        };
    }

    /**
     * Get Google access token from service account
     */
    private async getGoogleAccessToken(serviceAccountKey: string): Promise<string> {
        try {
            // Parse service account key
            const credentials = JSON.parse(serviceAccountKey);

            // Create JWT
            const now = Math.floor(Date.now() / 1000);
            const jwtHeader = {
                alg: 'RS256',
                typ: 'JWT',
            };

            const jwtClaim = {
                iss: credentials.client_email,
                scope: 'https://www.googleapis.com/auth/androidpublisher',
                aud: 'https://oauth2.googleapis.com/token',
                exp: now + 3600,
                iat: now,
            };

            // For production, you should use a proper JWT library
            // This is a simplified version for demonstration
            // In real implementation, use 'jsonwebtoken' or similar library

            // Request access token
            const response = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                    assertion: await this.createJWT(jwtHeader, jwtClaim, credentials.private_key),
                }),
            });

            if (!response.ok) {
                throw new Error(`Token request failed: ${response.status}`);
            }

            const data = await response.json();
            return data.access_token;
        } catch (error) {
            this.logger.error('Failed to get Google access token:', error);
            throw new BadRequestException('Google access token alınamadı');
        }
    }

    /**
     * Create JWT for Google authentication
     */
    private async createJWT(
        header: any,
        payload: any,
        privateKey: string,
    ): Promise<string> {
        return jwt.sign(payload, privateKey, {
            algorithm: 'RS256',
            header,
        });
    }

    /**
     * Get human-readable error message for Apple status codes
     */
    private getAppleErrorMessage(status: number): string {
        const errorMessages: Record<number, string> = {
            21000: 'App Store isteği işleyemedi',
            21002: 'Receipt data geçersiz',
            21003: 'Receipt doğrulanamadı',
            21004: 'Shared secret eşleşmiyor',
            21005: 'Receipt sunucusu şu anda kullanılamıyor',
            21006: 'Receipt geçerli ancak abonelik süresi dolmuş',
            21007: 'Receipt sandbox ortamından',
            21008: 'Receipt production ortamından',
            21009: 'Internal data access hatası',
            21010: 'Kullanıcı hesabı bulunamadı',
        };

        return errorMessages[status] || `Bilinmeyen hata (${status})`;
    }
}
