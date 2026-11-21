import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
    Logger,
    Optional,
    Inject,
} from '@nestjs/common';

export const APPLE_ROOT_CERTIFICATES = 'APPLE_ROOT_CERTIFICATES';
import * as crypto from 'crypto';
import { MonitoringService } from '../../common/monitoring/monitoring.service';
import {
    loadAppleRootCertificates,
    verifyAppleJws,
} from '../utils/apple-jws-verifier';

/**
 * Guard to verify Apple App Store Server Notifications V2 JWS payloads.
 *
 * Apple signs V2 notifications using ES256 and includes the X.509 certificate chain
 * in the JWS `x5c` header, anchored to an Apple Root CA certificate.
 * Documentation: https://developer.apple.com/documentation/appstoreservernotifications
 */
@Injectable()
export class AppleWebhookGuard implements CanActivate {
    private readonly logger = new Logger(AppleWebhookGuard.name);
    private readonly customRootCertificates?: crypto.X509Certificate[];

    constructor(
        @Optional() @Inject(APPLE_ROOT_CERTIFICATES) rootCertificates?: crypto.X509Certificate[],
        @Optional() private readonly monitoring?: MonitoringService,
    ) {
        this.customRootCertificates = rootCertificates;
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();

        // Allow explicit opt-out ONLY in local development when explicitly requested
        if (
            process.env.NODE_ENV === 'development' &&
            process.env.SKIP_WEBHOOK_VERIFICATION === 'true'
        ) {
            this.logger.warn('⚠️  Apple webhook verification SKIPPED (development mode)');
            if (request.body?.signedPayload && typeof request.body.signedPayload === 'string') {
                const parts = request.body.signedPayload.split('.');
                if (parts.length === 3) {
                    try {
                        request.appleWebhookPayload = JSON.parse(
                            Buffer.from(parts[1], 'base64url').toString('utf8'),
                        );
                    } catch {
                        // Fall through to raw body
                    }
                }
            }
            return true;
        }

        try {
            const signedPayload = request.body?.signedPayload;
            if (!signedPayload || typeof signedPayload !== 'string') {
                throw new UnauthorizedException('Missing signedPayload in Apple webhook');
            }

            const rootCertificates =
                this.customRootCertificates ?? loadAppleRootCertificates();
            const { payload } = verifyAppleJws<any>(signedPayload, {
                rootCertificates,
            });

            this.validateAppStoreNotificationClaims(payload);

            request.appleWebhookPayload = payload;
            this.logger.log('✅ Apple App Store Notification v2 signature verified');
            return true;
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            this.logger.error('❌ Apple webhook verification failed:', msg);
            await this.monitoring?.recordFailure(
                'payment_webhook',
                `Apple webhook signature verification failed: ${msg}`,
                { provider: 'APPLE' },
                error,
            );
            throw new UnauthorizedException('Invalid Apple webhook signature');
        }
    }

    /**
     * Validate App Store Server Notifications V2 payload claims
     * (never checks Sign-In-With-Apple `iss: https://appleid.apple.com`).
     */
    private validateAppStoreNotificationClaims(payload: any): void {
        if (!payload || typeof payload !== 'object') {
            throw new UnauthorizedException('Empty Apple notification payload');
        }

        if (!payload.notificationType || typeof payload.notificationType !== 'string') {
            throw new UnauthorizedException('Missing notificationType in Apple payload');
        }

        if (!payload.notificationUUID || typeof payload.notificationUUID !== 'string') {
            throw new UnauthorizedException('Missing notificationUUID in Apple payload');
        }

        if (!payload.data || typeof payload.data !== 'object') {
            throw new UnauthorizedException('Missing data object in Apple payload');
        }

        const expectedBundleId = process.env.APPLE_BUNDLE_ID || 'com.kadinatlasi.wellness';
        if (expectedBundleId && payload.data.bundleId !== expectedBundleId) {
            throw new UnauthorizedException(
                `Bundle ID mismatch: expected ${expectedBundleId}, got ${payload.data.bundleId}`,
            );
        }

        const env = payload.data.environment;
        if (env && env !== 'Production' && env !== 'Sandbox') {
            throw new UnauthorizedException(`Invalid Apple environment: ${env}`);
        }

        if (process.env.APPLE_ENVIRONMENT && env !== process.env.APPLE_ENVIRONMENT) {
            throw new UnauthorizedException(
                `Apple environment mismatch: expected ${process.env.APPLE_ENVIRONMENT}, got ${env}`,
            );
        }
    }
}
