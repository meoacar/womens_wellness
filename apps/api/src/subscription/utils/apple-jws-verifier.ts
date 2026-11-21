import { UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';

export interface VerifiedAppleJws<TPayload = Record<string, any>> {
    header: {
        alg: string;
        x5c: string[];
        [key: string]: any;
    };
    payload: TPayload;
}

export interface AppleJwsVerifyOptions {
    rootCertificates?: crypto.X509Certificate[];
    effectiveDate?: Date;
}

const PEM_CERT_REGEX = /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g;

export function isCompactJws(value: string): boolean {
    if (!value || typeof value !== 'string') {
        return false;
    }
    return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value.trim());
}

export function parseAppleRootCertificatesFromPemOrB64(raw: string): crypto.X509Certificate[] {
    const certs: crypto.X509Certificate[] = [];
    if (!raw || !raw.trim()) {
        return certs;
    }

    const pemMatches = raw.match(PEM_CERT_REGEX);
    if (pemMatches && pemMatches.length > 0) {
        for (const pem of pemMatches) {
            certs.push(new crypto.X509Certificate(pem));
        }
    } else {
        for (const token of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
            certs.push(new crypto.X509Certificate(Buffer.from(token, 'base64')));
        }
    }
    return certs;
}

/**
 * Load trusted Apple Root CA X.509 certificates from PEM strings, base64 DERs, or file paths.
 */
export function loadAppleRootCertificates(): crypto.X509Certificate[] {
    const inlineRaw =
        process.env.APPLE_ROOT_CA_CERTS || process.env.APPLE_ROOT_CA_PEM || '';
    const certs: crypto.X509Certificate[] = parseAppleRootCertificatesFromPemOrB64(inlineRaw);

    const pathRaw = process.env.APPLE_ROOT_CA_PATH || '';
    if (pathRaw.trim()) {
        for (const certPath of pathRaw.split(',').map((s) => s.trim()).filter(Boolean)) {
            if (fs.existsSync(certPath)) {
                const fileBuf = fs.readFileSync(certPath);
                const text = fileBuf.toString('utf8');
                const pemMatches = text.match(PEM_CERT_REGEX);
                if (pemMatches && pemMatches.length > 0) {
                    for (const pem of pemMatches) {
                        certs.push(new crypto.X509Certificate(pem));
                    }
                } else {
                    certs.push(new crypto.X509Certificate(fileBuf));
                }
            }
        }
    }

    return certs;
}

/**
 * Cryptographically verifies an Apple App Store Server API / Notifications v2 JWS
 * using the `x5c` X.509 certificate chain and ES256 (ECDSA P-256) signature.
 *
 * Aligns with Apple's `@apple/app-store-server-library` SignedDataVerifier specification:
 * - Requires ES256 algorithm and an `x5c` certificate chain
 * - Verifies each certificate's issuer/signature up the chain
 * - Validates certificate time windows against `signedDate` (or current time)
 * - Anchors the chain against pinned Apple Root CA certificate(s)
 * - Verifies the JWS signature using IEEE-P1363 ECDSA encoding
 */
export function verifyAppleJws<TPayload = Record<string, any>>(
    signedJws: string,
    options: AppleJwsVerifyOptions = {},
): VerifiedAppleJws<TPayload> {
    if (!signedJws || typeof signedJws !== 'string') {
        throw new UnauthorizedException('Missing Apple JWS token');
    }

    const parts = signedJws.split('.');
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
        throw new UnauthorizedException('Invalid JWS format');
    }

    let header: any;
    let payload: any;
    try {
        header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
        payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    } catch {
        throw new UnauthorizedException('Malformed JWS JSON segments');
    }

    if (header?.alg !== 'ES256') {
        throw new UnauthorizedException(`Unsupported Apple JWS algorithm: ${header?.alg}`);
    }

    if (!Array.isArray(header?.x5c) || header.x5c.length < 2) {
        throw new UnauthorizedException('Missing or incomplete x5c certificate chain');
    }

    let certs: crypto.X509Certificate[];
    try {
        certs = header.x5c.map(
            (b64: string) => new crypto.X509Certificate(Buffer.from(b64, 'base64')),
        );
    } catch {
        throw new UnauthorizedException('Invalid X.509 certificate in x5c header');
    }

    const rootCertificates =
        options.rootCertificates !== undefined
            ? options.rootCertificates
            : loadAppleRootCertificates();

    if (rootCertificates.length === 0) {
        throw new UnauthorizedException(
            'Apple Root CA certificates are not configured (set APPLE_ROOT_CA_CERTS or APPLE_ROOT_CA_PATH)',
        );
    }

    const effectiveTime =
        options.effectiveDate ??
        (typeof payload?.signedDate === 'number' && Number.isFinite(payload.signedDate)
            ? new Date(payload.signedDate)
            : new Date());

    // 1. Validate time window and signature links across x5c chain
    for (let i = 0; i < certs.length; i++) {
        const cert = certs[i];
        const validFrom = new Date(cert.validFrom);
        const validTo = new Date(cert.validTo);
        if (effectiveTime < validFrom || effectiveTime > validTo) {
            throw new UnauthorizedException('Certificate in x5c chain is outside its validity period');
        }

        if (i < certs.length - 1) {
            const issuerCert = certs[i + 1];
            if (!cert.checkIssued(issuerCert) || !cert.verify(issuerCert.publicKey)) {
                throw new UnauthorizedException('Broken signature link in Apple x5c certificate chain');
            }
        }
    }

    // 2. Anchor top of chain against a trusted Apple Root CA certificate
    const topCert = certs[certs.length - 1];
    const trustedByRoot = rootCertificates.some((root) => {
        if (Buffer.compare(topCert.raw, root.raw) === 0) {
            const rootFrom = new Date(root.validFrom);
            const rootTo = new Date(root.validTo);
            return effectiveTime >= rootFrom && effectiveTime <= rootTo && root.verify(root.publicKey);
        }
        return topCert.checkIssued(root) && topCert.verify(root.publicKey);
    });

    if (!trustedByRoot) {
        throw new UnauthorizedException('Apple x5c chain is not anchored to a trusted Apple Root CA');
    }

    // 3. Verify JWS ES256 signature with the leaf certificate's EC P-256 public key
    const signingInput = Buffer.from(`${parts[0]}.${parts[1]}`, 'utf8');
    const signature = Buffer.from(parts[2], 'base64url');
    const isSignatureValid = crypto.verify(
        'sha256',
        signingInput,
        { key: certs[0].publicKey, dsaEncoding: 'ieee-p1363' },
        signature,
    );

    if (!isSignatureValid) {
        throw new UnauthorizedException('Invalid Apple JWS signature');
    }

    return { header, payload };
}
