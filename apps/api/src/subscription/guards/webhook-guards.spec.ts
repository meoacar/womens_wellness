import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import * as crypto from 'crypto';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { MonitoringModule } from '../../common/monitoring/monitoring.module';
import { SubscriptionModule } from '../subscription.module';
import { SubscriptionController } from '../subscription.controller';
import { AppleWebhookGuard } from './apple-webhook.guard';
import { GoogleWebhookGuard } from './google-webhook.guard';

function generateEcP256Chain() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apple-x5c-test-'));
    const runSsl = (args: string[]) => execFileSync('openssl', args, { cwd: dir, stdio: 'pipe' });

    fs.writeFileSync(
        path.join(dir, 'ext.cnf'),
        [
            '[ca]',
            'basicConstraints = critical,CA:true',
            'keyUsage = critical,keyCertSign,cRLSign',
            'subjectKeyIdentifier = hash',
            'authorityKeyIdentifier = keyid:always,issuer',
            '[leaf]',
            'basicConstraints = critical,CA:false',
            'keyUsage = critical,digitalSignature',
        ].join('\n'),
    );

    // Root CA
    runSsl(['ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', 'root.key']);
    runSsl([
        'req', '-new', '-x509', '-key', 'root.key', '-sha256', '-days', '30',
        '-subj', '/CN=Test Apple Root CA/O=Apple Test',
        '-extensions', 'ca', '-config', 'ext.cnf',
        '-out', 'root.crt',
    ]);

    // Intermediate CA signed by Root
    runSsl(['ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', 'inter.key']);
    runSsl(['req', '-new', '-key', 'inter.key', '-subj', '/CN=Test Apple WWDR/O=Apple Test', '-out', 'inter.csr']);
    runSsl([
        'x509', '-req', '-in', 'inter.csr', '-CA', 'root.crt', '-CAkey', 'root.key', '-CAcreateserial',
        '-sha256', '-days', '15', '-extensions', 'ca', '-extfile', 'ext.cnf', '-out', 'inter.crt',
    ]);

    // Leaf signing cert signed by Intermediate
    runSsl(['ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', 'leaf.key']);
    runSsl(['req', '-new', '-key', 'leaf.key', '-subj', '/CN=App Store Signer/O=Apple Test', '-out', 'leaf.csr']);
    runSsl([
        'x509', '-req', '-in', 'leaf.csr', '-CA', 'inter.crt', '-CAkey', 'inter.key', '-CAcreateserial',
        '-sha256', '-days', '7', '-extensions', 'leaf', '-extfile', 'ext.cnf', '-out', 'leaf.crt',
    ]);

    // Rogue self-signed chain (not anchored to trusted root)
    runSsl(['ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', 'rogue.key']);
    runSsl(['req', '-new', '-x509', '-key', 'rogue.key', '-sha256', '-days', '7', '-subj', '/CN=Rogue CA', '-out', 'rogue.crt']);

    const toDerB64 = (pemFile: string) =>
        new crypto.X509Certificate(fs.readFileSync(path.join(dir, pemFile))).raw.toString('base64');

    const rootCert = new crypto.X509Certificate(fs.readFileSync(path.join(dir, 'root.crt')));
    const leafKey = fs.readFileSync(path.join(dir, 'leaf.key'), 'utf8');
    const rogueKey = fs.readFileSync(path.join(dir, 'rogue.key'), 'utf8');
    const x5c = [toDerB64('leaf.crt'), toDerB64('inter.crt'), toDerB64('root.crt')];
    const rogueX5c = [toDerB64('rogue.crt'), toDerB64('rogue.crt')];

    fs.rmSync(dir, { recursive: true, force: true });
    return { rootCert, leafKey, x5c, rogueKey, rogueX5c };
}

function signEs256Jws(payload: Record<string, any>, privateKeyPem: string, x5c: string[], alg = 'ES256'): string {
    const headerB64 = Buffer.from(JSON.stringify({ alg, x5c })).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signingInput = `${headerB64}.${payloadB64}`;
    const signature = crypto.sign('sha256', Buffer.from(signingInput), {
        key: privateKeyPem,
        dsaEncoding: 'ieee-p1363',
    });
    return `${signingInput}.${signature.toString('base64url')}`;
}

function createHttpContext(request: any): ExecutionContext {
    return {
        switchToHttp: () => ({
            getRequest: () => request,
        }),
    } as unknown as ExecutionContext;
}

describe('AppleWebhookGuard & GoogleWebhookGuard', () => {
    const chain = generateEcP256Chain();
    const origEnv = { ...process.env };

    beforeEach(() => {
        process.env = { ...origEnv, NODE_ENV: 'test', SKIP_WEBHOOK_VERIFICATION: 'false' };
    });

    afterAll(() => {
        process.env = origEnv;
    });

    describe('AppleWebhookGuard (App Store Server Notifications V2)', () => {
        it('verifies a valid App Store V2 ES256 JWS chained to trusted Apple Root CA without requiring appleid.apple.com iss', async () => {
            process.env.APPLE_BUNDLE_ID = 'com.wellness.companion';
            const guard = new AppleWebhookGuard([chain.rootCert]);

            const payload = {
                notificationType: 'DID_RENEW',
                notificationUUID: 'uuid-1234',
                version: '2.0',
                signedDate: Date.now(),
                data: {
                    bundleId: 'com.wellness.companion',
                    environment: 'Sandbox',
                    signedTransactionInfo: 'header.payload.sig',
                },
            };
            const req: any = {
                body: { signedPayload: signEs256Jws(payload, chain.leafKey, chain.x5c) },
            };

            await expect(guard.canActivate(createHttpContext(req))).resolves.toBe(true);
            expect(req.appleWebhookPayload).toEqual(payload);
        });

        it('rejects a valid JWS signed by an untrusted / rogue certificate chain', async () => {
            process.env.APPLE_BUNDLE_ID = 'com.wellness.companion';
            const guard = new AppleWebhookGuard([chain.rootCert]);

            const req: any = {
                body: {
                    signedPayload: signEs256Jws(
                        {
                            notificationType: 'DID_RENEW',
                            notificationUUID: 'uuid-evil',
                            data: { bundleId: 'com.wellness.companion', environment: 'Production' },
                        },
                        chain.rogueKey,
                        chain.rogueX5c,
                    ),
                },
            };

            await expect(guard.canActivate(createHttpContext(req))).rejects.toThrow(
                UnauthorizedException,
            );
        });

        it('rejects when bundleId does not match configured APPLE_BUNDLE_ID', async () => {
            process.env.APPLE_BUNDLE_ID = 'com.wellness.companion';
            const guard = new AppleWebhookGuard([chain.rootCert]);

            const req: any = {
                body: {
                    signedPayload: signEs256Jws(
                        {
                            notificationType: 'DID_RENEW',
                            notificationUUID: 'uuid-1234',
                            data: { bundleId: 'com.attacker.app', environment: 'Sandbox' },
                        },
                        chain.leafKey,
                        chain.x5c,
                    ),
                },
            };

            await expect(guard.canActivate(createHttpContext(req))).rejects.toThrow(
                UnauthorizedException,
            );
        });

        it('defaults APPLE_BUNDLE_ID to com.kadinatlasi.wellness when unset', async () => {
            delete process.env.APPLE_BUNDLE_ID;
            const guard = new AppleWebhookGuard([chain.rootCert]);

            const req: any = {
                body: {
                    signedPayload: signEs256Jws(
                        {
                            notificationType: 'DID_RENEW',
                            notificationUUID: 'uuid-default-bundle',
                            data: { bundleId: 'com.kadinatlasi.wellness', environment: 'Production' },
                        },
                        chain.leafKey,
                        chain.x5c,
                    ),
                },
            };

            await expect(guard.canActivate(createHttpContext(req))).resolves.toBe(true);
        });
    });

    describe('GoogleWebhookGuard (Cloud Pub/Sub Push Authentication)', () => {
        it('verifies Google Pub/Sub Bearer OIDC JWT via OAuth2Client.verifyIdToken and decodes message', async () => {
            process.env.GOOGLE_PUBSUB_AUDIENCE = 'https://api.kadinatlasi.com/subscription/webhook/google';
            process.env.GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL = 'pubsub-push@project.iam.gserviceaccount.com';

            const mockOAuthClient = {
                verifyIdToken: jest.fn().mockResolvedValue({
                    getPayload: () => ({
                        iss: 'https://accounts.google.com',
                        aud: 'https://api.kadinatlasi.com/subscription/webhook/google',
                        email: 'pubsub-push@project.iam.gserviceaccount.com',
                        email_verified: true,
                    }),
                }),
            } as any;

            const guard = new GoogleWebhookGuard(mockOAuthClient);
            const rtdn = {
                version: '1.0',
                packageName: 'com.kadinatlasi.wellness',
                subscriptionNotification: {
                    version: '1.0',
                    notificationType: 2,
                    purchaseToken: 'tok-abc',
                    subscriptionId: 'premium_monthly',
                },
            };
            const req: any = {
                headers: { authorization: 'Bearer valid-google-oidc-jwt' },
                body: {
                    message: {
                        data: Buffer.from(JSON.stringify(rtdn)).toString('base64'),
                    },
                },
            };

            await expect(guard.canActivate(createHttpContext(req))).resolves.toBe(true);
            expect(mockOAuthClient.verifyIdToken).toHaveBeenCalledWith({
                idToken: 'valid-google-oidc-jwt',
                audience: 'https://api.kadinatlasi.com/subscription/webhook/google',
            });
            expect(req.googleWebhookData).toEqual(rtdn);
        });

        it('rejects OIDC token when email_verified is false or service account email mismatches', async () => {
            process.env.GOOGLE_PUBSUB_AUDIENCE = 'https://api.kadinatlasi.com/subscription/webhook/google';
            process.env.GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL = 'pubsub-push@project.iam.gserviceaccount.com';

            const mockOAuthClient = {
                verifyIdToken: jest.fn().mockResolvedValue({
                    getPayload: () => ({
                        iss: 'https://accounts.google.com',
                        aud: 'https://api.kadinatlasi.com/subscription/webhook/google',
                        email: 'attacker@gmail.com',
                        email_verified: true,
                    }),
                }),
            } as any;

            const guard = new GoogleWebhookGuard(mockOAuthClient);
            const req: any = {
                headers: { authorization: 'Bearer token' },
                body: { message: { data: Buffer.from('{}').toString('base64') } },
            };

            await expect(guard.canActivate(createHttpContext(req))).rejects.toThrow(
                UnauthorizedException,
            );
        });

        it('validates constant-time shared push token fallback when Bearer is omitted', async () => {
            process.env.GOOGLE_PUBSUB_PUSH_TOKEN = 'super-strong-random-pubsub-token-123456';
            const guard = new GoogleWebhookGuard();

            const reqBad: any = {
                headers: {},
                query: { token: 'wrong-token' },
                body: { message: { data: Buffer.from('{}').toString('base64') } },
            };
            await expect(guard.canActivate(createHttpContext(reqBad))).rejects.toThrow(
                UnauthorizedException,
            );

            const reqOk: any = {
                headers: {},
                query: { token: 'super-strong-random-pubsub-token-123456' },
                body: { message: { data: Buffer.from('{"ok":true}').toString('base64') } },
            };
            await expect(guard.canActivate(createHttpContext(reqOk))).resolves.toBe(true);
            expect(reqOk.googleWebhookData).toEqual({ ok: true });
        });
    });

    describe('NestJS Dependency Injection resolution', () => {
        it('instantiates AppleWebhookGuard, GoogleWebhookGuard, and SubscriptionController without DB', async () => {
            const moduleRef = await Test.createTestingModule({
                imports: [MonitoringModule, SubscriptionModule],
            })
                .overrideProvider(PrismaService)
                .useValue({ $connect: jest.fn(), $disconnect: jest.fn() })
                .overrideProvider(getQueueToken('reminders'))
                .useValue({ add: jest.fn(), getJobCounts: jest.fn(), client: Promise.resolve({ ping: jest.fn() }) })
                .compile();

            const appleGuard = moduleRef.get(AppleWebhookGuard);
            const googleGuard = moduleRef.get(GoogleWebhookGuard);
            const controller = moduleRef.get(SubscriptionController);

            expect(appleGuard).toBeInstanceOf(AppleWebhookGuard);
            expect(googleGuard).toBeInstanceOf(GoogleWebhookGuard);
            expect(controller).toBeInstanceOf(SubscriptionController);

            await moduleRef.close();
        });
    });
});
