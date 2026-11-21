import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
    Logger,
    Optional,
    Inject,
} from '@nestjs/common';

export const GOOGLE_OAUTH_CLIENT = 'GOOGLE_OAUTH_CLIENT';
import * as crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { MonitoringService } from '../../common/monitoring/monitoring.service';

/**
 * Guard to verify Google Play Real-time Developer Notifications delivered via Cloud Pub/Sub push.
 *
 * Verifies the Bearer OIDC JWT using `google-auth-library` (`OAuth2Client.verifyIdToken`),
 * validating issuer, audience, `email_verified`, and optional service account email per:
 * https://docs.cloud.google.com/pubsub/docs/authenticate-push-subscriptions
 */
@Injectable()
export class GoogleWebhookGuard implements CanActivate {
    private readonly logger = new Logger(GoogleWebhookGuard.name);
    private readonly oauthClient: OAuth2Client;

    constructor(
        @Optional() @Inject(GOOGLE_OAUTH_CLIENT) oauthClient?: OAuth2Client,
        @Optional() private readonly monitoring?: MonitoringService,
    ) {
        this.oauthClient = oauthClient ?? new OAuth2Client();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();

        // Allow explicit opt-out ONLY in local development when explicitly requested
        if (
            process.env.NODE_ENV === 'development' &&
            process.env.SKIP_WEBHOOK_VERIFICATION === 'true'
        ) {
            this.logger.warn('⚠️  Google webhook verification SKIPPED (development mode)');
            if (request.body?.message?.data) {
                try {
                    const decoded = Buffer.from(request.body.message.data, 'base64').toString('utf8');
                    request.googleWebhookData = JSON.parse(decoded);
                } catch {
                    // Ignore malformed dev body
                }
            }
            return true;
        }

        try {
            const message = request.body?.message;
            if (!message || typeof message !== 'object') {
                throw new UnauthorizedException('Missing message in Google webhook');
            }

            const authHeader = request.headers?.authorization;

            if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
                const token = authHeader.slice(7).trim();
                await this.verifyGooglePubSubOidcToken(token);
            } else {
                this.verifyPushEndpointToken(request.query?.token);
            }

            if (!message.data || typeof message.data !== 'string') {
                throw new UnauthorizedException('Missing message.data in Google webhook');
            }

            const decodedData = Buffer.from(message.data, 'base64').toString('utf8');
            request.googleWebhookData = JSON.parse(decodedData);

            this.logger.log('✅ Google Pub/Sub push notification verified');
            return true;
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            this.logger.error('❌ Google webhook verification failed:', msg);
            await this.monitoring?.recordFailure(
                'payment_webhook',
                `Google webhook verification failed: ${msg}`,
                { provider: 'GOOGLE' },
                error,
            );
            throw new UnauthorizedException('Invalid Google webhook signature');
        }
    }

    /**
     * Verify Google Cloud Pub/Sub OIDC Bearer token using google-auth-library.
     */
    private async verifyGooglePubSubOidcToken(idToken: string): Promise<void> {
        if (!idToken) {
            throw new UnauthorizedException('Empty Bearer token in Google webhook');
        }

        const expectedAudiences = [
            process.env.GOOGLE_PUBSUB_AUDIENCE,
            process.env.GOOGLE_CLOUD_PROJECT_ID,
        ]
            .map((v) => v?.trim())
            .filter((v): v is string => Boolean(v));

        if (expectedAudiences.length === 0) {
            throw new UnauthorizedException(
                'Google Pub/Sub audience is not configured (set GOOGLE_PUBSUB_AUDIENCE)',
            );
        }

        const ticket = await this.oauthClient.verifyIdToken({
            idToken,
            audience:
                expectedAudiences.length === 1 ? expectedAudiences[0] : expectedAudiences,
        });

        const payload = ticket.getPayload();
        if (!payload) {
            throw new UnauthorizedException('Empty OIDC token payload');
        }

        const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
        if (!payload.iss || !validIssuers.includes(payload.iss)) {
            throw new UnauthorizedException(`Invalid Google OIDC issuer: ${payload.iss}`);
        }

        if (payload.email_verified !== true) {
            throw new UnauthorizedException('Google Pub/Sub service account email is not verified');
        }

        const expectedEmail = process.env.GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL?.trim();
        if (expectedEmail && payload.email !== expectedEmail) {
            throw new UnauthorizedException('Google Pub/Sub service account email mismatch');
        }
    }

    /**
     * Fallback shared push-secret verification when OIDC Authorization header is not used.
     */
    private verifyPushEndpointToken(rawToken: unknown): void {
        const expectedToken = process.env.GOOGLE_PUBSUB_PUSH_TOKEN?.trim();
        if (
            !expectedToken ||
            expectedToken.includes('GENERATE_WITH_OPENSSL') ||
            typeof rawToken !== 'string' ||
            !rawToken
        ) {
            throw new UnauthorizedException('Invalid or missing Google webhook token');
        }

        const providedBuf = Buffer.from(rawToken, 'utf8');
        const expectedBuf = Buffer.from(expectedToken, 'utf8');
        if (
            providedBuf.length !== expectedBuf.length ||
            !crypto.timingSafeEqual(providedBuf, expectedBuf)
        ) {
            throw new UnauthorizedException('Google webhook push token mismatch');
        }
    }
}
