import { BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { WebhookHandlerService } from './webhook-handler.service';

function generateAppleTestPki() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apple-wh-test-'));
    const runSsl = (args: string[]) => execFileSync('openssl', args, { cwd: dir, stdio: 'pipe' });

    fs.writeFileSync(
        path.join(dir, 'ext.cnf'),
        [
            '[ca]',
            'basicConstraints = critical,CA:true',
            'keyUsage = critical,keyCertSign,cRLSign',
            '[leaf]',
            'basicConstraints = critical,CA:false',
            'keyUsage = critical,digitalSignature',
        ].join('\n'),
    );

    runSsl(['ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', 'root.key']);
    runSsl([
        'req', '-new', '-x509', '-key', 'root.key', '-sha256', '-days', '30',
        '-subj', '/CN=Test Apple Root/O=Apple', '-extensions', 'ca', '-config', 'ext.cnf',
        '-out', 'root.crt',
    ]);
    runSsl(['ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', 'leaf.key']);
    runSsl(['req', '-new', '-key', 'leaf.key', '-subj', '/CN=Apple Signer/O=Apple', '-out', 'leaf.csr']);
    runSsl([
        'x509', '-req', '-in', 'leaf.csr', '-CA', 'root.crt', '-CAkey', 'root.key', '-CAcreateserial',
        '-sha256', '-days', '7', '-extensions', 'leaf', '-extfile', 'ext.cnf', '-out', 'leaf.crt',
    ]);

    const rootPem = fs.readFileSync(path.join(dir, 'root.crt'), 'utf8');
    const leafKey = fs.readFileSync(path.join(dir, 'leaf.key'), 'utf8');
    const toDerB64 = (pemFile: string) =>
        new crypto.X509Certificate(fs.readFileSync(path.join(dir, pemFile))).raw.toString('base64');
    const x5c = [toDerB64('leaf.crt'), toDerB64('root.crt')];
    fs.rmSync(dir, { recursive: true, force: true });
    return { rootPem, leafKey, x5c };
}

function signAppleJws(payload: Record<string, any>, leafKey: string, x5c: string[]): string {
    const headerB64 = Buffer.from(JSON.stringify({ alg: 'ES256', x5c })).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const input = `${headerB64}.${payloadB64}`;
    const sig = crypto.sign('sha256', Buffer.from(input), {
        key: leafKey,
        dsaEncoding: 'ieee-p1363',
    });
    return `${input}.${sig.toString('base64url')}`;
}

describe('WebhookHandlerService (Apple & Google lifecycle events)', () => {
    const pki = generateAppleTestPki();
    const origEnv = { ...process.env };

    beforeEach(() => {
        process.env = {
            ...origEnv,
            NODE_ENV: 'test',
            SKIP_WEBHOOK_VERIFICATION: 'false',
            APPLE_ROOT_CA_CERTS: pki.rootPem,
            APPLE_BUNDLE_ID: 'com.wellness.companion',
        };
    });

    afterAll(() => {
        process.env = origEnv;
    });

    function createService() {
        const prisma = {
            subscription: {
                findUnique: jest.fn(),
                findFirst: jest.fn(),
                update: jest.fn(),
            },
            subscriptionTransaction: {
                findUnique: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockResolvedValue({ id: 'tx-1' }),
            },
        } as any;

        const receiptValidator = {
            validateGoogleReceipt: jest.fn(),
        } as any;

        const configService = {
            get: jest.fn((key: string) =>
                key === 'GOOGLE_PLAY_PACKAGE_NAME' ? 'com.kadinatlasi.wellness' : undefined,
            ),
        } as any;

        const notificationService = {
            sendSubscriptionStarted: jest.fn().mockResolvedValue(undefined),
            sendSubscriptionRenewed: jest.fn().mockResolvedValue(undefined),
            sendSubscriptionCancelled: jest.fn().mockResolvedValue(undefined),
            sendSubscriptionExpired: jest.fn().mockResolvedValue(undefined),
            sendPaymentFailed: jest.fn().mockResolvedValue(undefined),
        } as any;

        const service = new WebhookHandlerService(
            prisma,
            receiptValidator,
            configService,
            notificationService,
        );

        return { service, prisma, receiptValidator, notificationService };
    }

    it('processes verified Apple DID_RENEW, DID_CHANGE_RENEWAL_STATUS (cancel), and REFUND idempotently', async () => {
        const { service, prisma, notificationService } = createService();
        const futureExpiry = Date.now() + 30 * 24 * 60 * 60 * 1000;

        prisma.subscription.findUnique.mockResolvedValue({
            id: 'sub-1',
            userId: 'user-1',
            tier: 'MONTHLY',
            endDate: new Date(futureExpiry),
        });
        prisma.subscription.update.mockResolvedValue({
            id: 'sub-1',
            userId: 'user-1',
            tier: 'MONTHLY',
            endDate: new Date(futureExpiry),
        });

        const txJws = signAppleJws(
            {
                transactionId: 'apple-renew-2',
                originalTransactionId: 'apple-orig-1',
                productId: 'com.wellness.premium.monthly',
                bundleId: 'com.wellness.companion',
                expiresDate: futureExpiry,
                signedDate: Date.now(),
            },
            pki.leafKey,
            pki.x5c,
        );

        // 1. Renewal
        await service.handleAppleNotification({
            notificationType: 'DID_RENEW',
            data: { signedTransactionInfo: txJws },
        });
        expect(prisma.subscription.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    status: 'ACTIVE',
                    endDate: new Date(futureExpiry),
                }),
            }),
        );
        expect(notificationService.sendSubscriptionRenewed).toHaveBeenCalledTimes(1);

        // 2. Auto-renew disabled (cancel)
        await service.handleAppleNotification({
            notificationType: 'DID_CHANGE_RENEWAL_STATUS',
            subtype: 'AUTO_RENEW_DISABLED',
            data: { signedTransactionInfo: txJws },
        });
        expect(notificationService.sendSubscriptionCancelled).toHaveBeenCalledTimes(1);

        // 3. Refund
        await service.handleAppleNotification({
            notificationType: 'REFUND',
            data: { signedTransactionInfo: txJws },
        });
        expect(prisma.subscriptionTransaction.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    transactionId: 'refund_apple-renew-2',
                    status: 'REFUNDED',
                    type: 'REFUND',
                }),
            }),
        );
        expect(notificationService.sendSubscriptionExpired).toHaveBeenCalledTimes(1);
    });

    it('rejects unsigned or forged nested Apple signedTransactionInfo (no mock fallback)', async () => {
        const { service } = createService();

        await expect(
            service.handleAppleNotification({
                notificationType: 'DID_RENEW',
                data: {
                    signedTransactionInfo: 'not-a-valid-jws',
                },
            }),
        ).rejects.toThrow(BadRequestException);
    });

    it('handles Google Play RTDN renewal and revocation without duplicate transaction collisions', async () => {
        const { service, prisma, receiptValidator, notificationService } = createService();
        const futureExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        receiptValidator.validateGoogleReceipt.mockResolvedValue({
            transactionId: 'GPA.9999-8888',
            originalTransactionId: 'GPA.9999-8888',
            productId: 'premium_monthly',
            purchaseDate: new Date(),
            expiresDate: futureExpiry,
            isTrialPeriod: false,
            isActive: true,
            autoRenewing: true,
        });
        prisma.subscription.findFirst.mockResolvedValue({
            id: 'sub-g-1',
            userId: 'user-g-1',
            tier: 'MONTHLY',
            endDate: futureExpiry,
        });
        prisma.subscription.update.mockResolvedValue({
            id: 'sub-g-1',
            userId: 'user-g-1',
            tier: 'MONTHLY',
            endDate: futureExpiry,
        });

        await service.handleGoogleNotification({
            version: '1.0',
            packageName: 'com.kadinatlasi.wellness',
            eventTimeMillis: String(Date.now()),
            subscriptionNotification: {
                version: '1.0',
                notificationType: 2, // RENEWED
                purchaseToken: 'tok-g-1',
                subscriptionId: 'premium_monthly',
            },
        });
        expect(notificationService.sendSubscriptionRenewed).toHaveBeenCalledTimes(1);

        await service.handleGoogleNotification({
            version: '1.0',
            packageName: 'com.kadinatlasi.wellness',
            eventTimeMillis: String(Date.now()),
            subscriptionNotification: {
                version: '1.0',
                notificationType: 12, // REVOKED
                purchaseToken: 'tok-g-1',
                subscriptionId: 'premium_monthly',
            },
        });
        expect(prisma.subscriptionTransaction.create).toHaveBeenLastCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    transactionId: 'refund_GPA.9999-8888',
                    status: 'REFUNDED',
                    type: 'REFUND',
                    provider: 'GOOGLE',
                }),
            }),
        );
        expect(notificationService.sendSubscriptionExpired).toHaveBeenCalledTimes(1);
    });
});
