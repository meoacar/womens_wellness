import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ReceiptValidatorService } from './receipt-validator.service';

function generateTestAppleChain() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apple-sk2-test-'));
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

    runSsl(['ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', 'root.key']);
    runSsl([
        'req', '-new', '-x509', '-key', 'root.key', '-sha256', '-days', '30',
        '-subj', '/CN=Test Apple Root CA', '-extensions', 'ca', '-config', 'ext.cnf', '-out', 'root.crt',
    ]);

    runSsl(['ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', 'leaf.key']);
    runSsl(['req', '-new', '-key', 'leaf.key', '-subj', '/CN=Test StoreKit Signer', '-out', 'leaf.csr']);
    runSsl([
        'x509', '-req', '-in', 'leaf.csr', '-CA', 'root.crt', '-CAkey', 'root.key', '-CAcreateserial',
        '-sha256', '-days', '7', '-extensions', 'leaf', '-extfile', 'ext.cnf', '-out', 'leaf.crt',
    ]);

    runSsl(['ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', 'rogue.key']);
    runSsl(['req', '-new', '-x509', '-key', 'rogue.key', '-sha256', '-days', '7', '-subj', '/CN=Rogue CA', '-out', 'rogue.crt']);

    const rootPem = fs.readFileSync(path.join(dir, 'root.crt'), 'utf8');
    const leafKey = fs.readFileSync(path.join(dir, 'leaf.key'), 'utf8');
    const rogueKey = fs.readFileSync(path.join(dir, 'rogue.key'), 'utf8');
    const toDerB64 = (file: string) =>
        new crypto.X509Certificate(fs.readFileSync(path.join(dir, file))).raw.toString('base64');
    const x5c = [toDerB64('leaf.crt'), toDerB64('root.crt')];
    const rogueX5c = [toDerB64('rogue.crt'), toDerB64('rogue.crt')];

    fs.rmSync(dir, { recursive: true, force: true });
    return { rootPem, leafKey, x5c, rogueKey, rogueX5c };
}

function signStoreKit2Jws(
    payload: Record<string, any>,
    privateKeyPem: string,
    x5c: string[],
): string {
    const headerB64 = Buffer.from(JSON.stringify({ alg: 'ES256', x5c })).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signingInput = `${headerB64}.${payloadB64}`;
    const sig = crypto.sign('sha256', Buffer.from(signingInput), {
        key: privateKeyPem,
        dsaEncoding: 'ieee-p1363',
    });
    return `${signingInput}.${sig.toString('base64url')}`;
}

describe('ReceiptValidatorService', () => {
    let service: ReceiptValidatorService;
    let configService: ConfigService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ReceiptValidatorService,
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn((key: string) => {
                            if (key === 'APPLE_SHARED_SECRET') return 'test-secret';
                            if (key === 'GOOGLE_SERVICE_ACCOUNT_KEY') return JSON.stringify({
                                client_email: 'test@test.com',
                                private_key: 'test-key',
                            });
                            return null;
                        }),
                    },
                },
            ],
        }).compile();

        service = module.get<ReceiptValidatorService>(ReceiptValidatorService);
        configService = module.get<ConfigService>(ConfigService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('validateAppleReceipt', () => {
        const chain = generateTestAppleChain();
        const origEnv = { ...process.env };
        const origFetch = global.fetch;

        afterEach(() => {
            process.env = { ...origEnv };
            global.fetch = origFetch;
        });

        it('should throw error if shared secret is not configured for legacy base64 receipt', async () => {
            jest.spyOn(configService, 'get').mockReturnValue(null);

            await expect(service.validateAppleReceipt('bGVnYWN5LXBrY3M3LXJlY2VpcHQ=')).rejects.toThrow(
                BadRequestException,
            );
        });

        it('validates StoreKit 2 JWS locally via Apple Root CA without calling legacy verifyReceipt', async () => {
            const fetchSpy = jest.fn();
            global.fetch = fetchSpy as any;
            process.env.APPLE_ROOT_CA_CERTS = chain.rootPem;
            process.env.APPLE_BUNDLE_ID = 'com.kadinatlasi.wellness';
            jest.spyOn(configService, 'get').mockReturnValue(null); // no APPLE_SHARED_SECRET needed!

            const now = Date.now();
            const expires = now + 30 * 24 * 60 * 60 * 1000;
            const jws = signStoreKit2Jws(
                {
                    transactionId: '2000000555666',
                    originalTransactionId: '2000000111222',
                    productId: 'com.wellness.premium.monthly',
                    bundleId: 'com.kadinatlasi.wellness',
                    purchaseDate: now,
                    expiresDate: expires,
                    offerDiscountType: 'FREE_TRIAL',
                    environment: 'Production',
                    signedDate: now,
                },
                chain.leafKey,
                chain.x5c,
            );

            const parsed = await service.validateAppleReceipt(jws);

            expect(fetchSpy).not.toHaveBeenCalled();
            expect(parsed).toEqual({
                transactionId: '2000000555666',
                originalTransactionId: '2000000111222',
                productId: 'com.wellness.premium.monthly',
                purchaseDate: new Date(now),
                expiresDate: new Date(expires),
                isTrialPeriod: true,
                isActive: true,
                environment: 'Production',
            });
        });

        it('rejects untrusted or bundleId-mismatched StoreKit 2 JWS tokens', async () => {
            process.env.APPLE_ROOT_CA_CERTS = chain.rootPem;
            process.env.APPLE_BUNDLE_ID = 'com.kadinatlasi.wellness';

            const now = Date.now();
            const rogueJws = signStoreKit2Jws(
                {
                    transactionId: '2000000999',
                    originalTransactionId: '2000000999',
                    productId: 'com.wellness.premium.monthly',
                    bundleId: 'com.kadinatlasi.wellness',
                    purchaseDate: now,
                    expiresDate: now + 60_000,
                    signedDate: now,
                },
                chain.rogueKey,
                chain.rogueX5c,
            );
            await expect(service.validateAppleReceipt(rogueJws)).rejects.toThrow(BadRequestException);

            const wrongBundleJws = signStoreKit2Jws(
                {
                    transactionId: '2000000999',
                    originalTransactionId: '2000000999',
                    productId: 'com.wellness.premium.monthly',
                    bundleId: 'com.attacker.app',
                    purchaseDate: now,
                    expiresDate: now + 60_000,
                    signedDate: now,
                },
                chain.leafKey,
                chain.x5c,
            );
            await expect(service.validateAppleReceipt(wrongBundleJws)).rejects.toThrow(BadRequestException);
        });
    });

    describe('validateGoogleReceipt', () => {
        it('should throw error if service account key is not configured', async () => {
            jest.spyOn(configService, 'get').mockReturnValue(null);

            await expect(
                service.validateGoogleReceipt('com.test.app', 'product-id', 'token'),
            ).rejects.toThrow(BadRequestException);
        });
    });

    describe('isReceiptActive', () => {
        it('should return false if receipt is not active', () => {
            const receipt = {
                transactionId: 'test',
                originalTransactionId: 'test',
                productId: 'test',
                purchaseDate: new Date(),
                expiresDate: new Date(),
                isTrialPeriod: false,
                isActive: false,
                environment: 'Production' as const,
            };

            expect(service.isReceiptActive(receipt)).toBe(false);
        });

        it('should return false if expiration date is in the past', () => {
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 1);

            const receipt = {
                transactionId: 'test',
                originalTransactionId: 'test',
                productId: 'test',
                purchaseDate: new Date(),
                expiresDate: pastDate,
                isTrialPeriod: false,
                isActive: true,
                environment: 'Production' as const,
            };

            expect(service.isReceiptActive(receipt)).toBe(false);
        });

        it('should return true if receipt is active and not expired', () => {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 30);

            const receipt = {
                transactionId: 'test',
                originalTransactionId: 'test',
                productId: 'test',
                purchaseDate: new Date(),
                expiresDate: futureDate,
                isTrialPeriod: false,
                isActive: true,
                environment: 'Production' as const,
            };

            expect(service.isReceiptActive(receipt)).toBe(true);
        });
    });
});
