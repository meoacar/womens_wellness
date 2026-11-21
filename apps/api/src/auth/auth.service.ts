import { Injectable, UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { hash, compare } from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import type { ClientTelemetry } from '../common/utils/client-telemetry';

export interface RegisterConsentInput {
  acceptPrivacy?: boolean;
  privacyAcceptedAt?: string;
  aiMemoryOptIn?: boolean;
  aiMemoryAcceptedAt?: string;
  version?: string;
  source?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) { }

  async isEmailAvailable(email: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    return !user;
  }

  async isUsernameAvailable(username: string): Promise<boolean> {
    const normalizedUsername = username.toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { username: normalizedUsername },
    });
    return !user;
  }

  /**
   * Validates user credentials
   * @param identifier - Can be either email or username
   * @param password - User's password
   */
  async validateUser(identifier: string, password: string) {
    const cleanIdentifier = (identifier || '').trim().toLowerCase();
    const isEmail = cleanIdentifier.includes('@');

    let user;
    if (isEmail) {
      user = await this.prisma.user.findFirst({
        where: { email: { equals: cleanIdentifier, mode: 'insensitive' } },
        include: { profile: true },
      });
    } else {
      user = await this.prisma.user.findFirst({
        where: {
          OR: [
            { username: { equals: cleanIdentifier, mode: 'insensitive' } },
            { email: { startsWith: `${cleanIdentifier}@`, mode: 'insensitive' } },
          ],
        },
        include: { profile: true },
      });
    }

    if (!user || !user.password) {
      console.warn(`[Auth] User not found or has no password for identifier: "${cleanIdentifier}"`);
      return null;
    }

    if (typeof password !== 'string' || password.length === 0) {
      return null;
    }

    const isValid = await compare(password, user.password);

    if (!isValid) {
      console.warn(`[Auth] Password mismatch for user: ${user.email} (username: ${user.username})`);
      return null;
    }

    return user;
  }

  async register(
    email: string,
    password: string,
    username: string,
    firstName: string,
    lastName: string,
    dateOfBirth?: Date,
    telemetry?: ClientTelemetry,
    kvkkConsents?: RegisterConsentInput,
  ) {
    // Normalize inputs
    const normalizedEmail = email.toLowerCase();
    const normalizedUsername = username.toLowerCase();

    // Validate username format (alphanumeric, dots, underscores only)
    if (!/^[a-z0-9._]+$/.test(normalizedUsername)) {
      throw new BadRequestException(
        'Username can only contain lowercase letters, numbers, dots, and underscores',
      );
    }

    if (normalizedUsername.length < 3 || normalizedUsername.length > 24) {
      throw new BadRequestException('Username must be between 3 and 24 characters');
    }

    // Check if email already exists
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingEmail) {
      throw new UnauthorizedException('Email already exists');
    }

    // Check if username already exists
    const existingUsername = await this.prisma.user.findUnique({
      where: { username: normalizedUsername },
    });

    if (existingUsername) {
      throw new UnauthorizedException('Username already taken');
    }

    const hashedPassword = await hash(
      password,
      parseInt(process.env.BCRYPT_SALT_ROUNDS || '10'),
    );

    const displayName = `${firstName} ${lastName}`;

    const now = new Date();
    const privacyAcceptedAt =
      kvkkConsents?.privacyAcceptedAt && !Number.isNaN(Date.parse(kvkkConsents.privacyAcceptedAt))
        ? new Date(kvkkConsents.privacyAcceptedAt)
        : now;
    const aiMemoryOptIn = Boolean(kvkkConsents?.aiMemoryOptIn);
    const aiMemoryAcceptedAt =
      aiMemoryOptIn && kvkkConsents?.aiMemoryAcceptedAt && !Number.isNaN(Date.parse(kvkkConsents.aiMemoryAcceptedAt))
        ? new Date(kvkkConsents.aiMemoryAcceptedAt)
        : aiMemoryOptIn
          ? now
          : null;

    const initialKvkkPrefs = {
      dataProcessing: true,
      dataProcessingAt: privacyAcceptedAt.toISOString(),
      privacyPolicyAccepted: kvkkConsents?.acceptPrivacy ?? true,
      privacyAcceptedAt: privacyAcceptedAt.toISOString(),
      aiMemoryConsent: aiMemoryOptIn,
      aiMemoryConsentAt: aiMemoryAcceptedAt ? aiMemoryAcceptedAt.toISOString() : null,
      marketingConsent: false,
      analyticsConsent: false,
      thirdPartyConsent: false,
      version: kvkkConsents?.version || '1.0',
      updatedAt: now.toISOString(),
    };

    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        username: normalizedUsername,
        password: hashedPassword,
        ...(telemetry?.ipAddress ? { lastIpAddress: telemetry.ipAddress } : {}),
        ...(telemetry?.deviceModel ? { lastDeviceModel: telemetry.deviceModel } : {}),
        ...(telemetry?.osVersion ? { lastOsVersion: telemetry.osVersion } : {}),
        ...(telemetry?.appVersion ? { lastAppVersion: telemetry.appVersion } : {}),
        ...(telemetry?.userAgent ? { lastUserAgent: telemetry.userAgent } : {}),
        lastSeenAt: now,
        profile: {
          create: {
            firstName,
            lastName,
            displayName,
            dateOfBirth,
            timezone: 'Europe/Istanbul',
            preferencesJson: {
              kvkkConsents: initialKvkkPrefs,
            },
          },
        },
        subscription: {
          create: {
            status: 'FREE',
            aiMessagesLimit: 100,
            aiMessagesUsed: 0,
            quotaResetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
          },
        },
        usageQuota: {
          create: {
            monthKey: new Date().toISOString().slice(0, 7),
            aiRequests: 0,
            limit: 100,
            resetsAt: new Date(
              new Date().getFullYear(),
              new Date().getMonth() + 1,
              1,
            ),
          },
        },
      },
      include: { profile: true },
    });

    if (this.prisma.kvkkConsentLog) {
      const consentRows = [
        {
          userId: user.id,
          consentType: 'PRIVACY_POLICY_AND_TERMS',
          granted: kvkkConsents?.acceptPrivacy ?? true,
          version: kvkkConsents?.version || '1.0',
          source: kvkkConsents?.source || 'ONBOARDING',
          ipAddress: telemetry?.ipAddress,
          deviceModel: telemetry?.deviceModel,
          osVersion: telemetry?.osVersion,
          appVersion: telemetry?.appVersion,
          consentedAt: privacyAcceptedAt,
        },
        {
          userId: user.id,
          consentType: 'DATA_PROCESSING',
          granted: true,
          version: kvkkConsents?.version || '1.0',
          source: kvkkConsents?.source || 'ONBOARDING',
          ipAddress: telemetry?.ipAddress,
          deviceModel: telemetry?.deviceModel,
          osVersion: telemetry?.osVersion,
          appVersion: telemetry?.appVersion,
          consentedAt: privacyAcceptedAt,
        },
      ];
      if (aiMemoryAcceptedAt) {
        consentRows.push({
          userId: user.id,
          consentType: 'AI_MEMORY',
          granted: true,
          version: kvkkConsents?.version || '1.0',
          source: kvkkConsents?.source || 'ONBOARDING',
          ipAddress: telemetry?.ipAddress,
          deviceModel: telemetry?.deviceModel,
          osVersion: telemetry?.osVersion,
          appVersion: telemetry?.appVersion,
          consentedAt: aiMemoryAcceptedAt,
        });
      }
      await this.prisma.kvkkConsentLog.createMany({ data: consentRows }).catch(() => {});
    }

    return this.login(user, telemetry);
  }

  private assertUserIsActive(user: { status?: string } | null) {
    if (!user) {
      throw new UnauthorizedException({
        code: 'ACCOUNT_NOT_FOUND',
        message: 'Kullanıcı bulunamadı.',
      });
    }
    if (user.status === 'SUSPENDED') {
      throw new ForbiddenException({
        code: 'ACCOUNT_SUSPENDED',
        message: 'Hesabınız yönetici tarafından askıya alınmıştır. Destek ekibiyle iletişime geçin.',
      });
    }
    if (user.status && user.status !== 'ACTIVE') {
      throw new UnauthorizedException({
        code: 'ACCOUNT_DELETED',
        message: 'Bu hesap kapatılmış veya silinmiştir.',
      });
    }
  }

  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private getRefreshSecret(): string {
    const secret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ||
      process.env.JWT_REFRESH_SECRET;
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET is not configured');
    }
    return secret;
  }

  private getAccessSecret(): string {
    const secret =
      this.configService.get<string>('JWT_SECRET') || process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }
    return secret;
  }

  private async issueTokens(user: any, existingFamilyId?: string) {
    const accessTtlMinutes =
      Number(this.configService.get<number>('ACCESS_TOKEN_TTL_MIN')) || 15;
    const refreshTtlDays =
      Number(this.configService.get<number>('REFRESH_TOKEN_TTL_DAYS')) || 30;
    const familyId = existingFamilyId || randomBytes(16).toString('hex');
    const accessJti = randomBytes(8).toString('hex');

    const accessToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        jti: accessJti,
        type: 'access',
      },
      {
        secret: this.getAccessSecret(),
        expiresIn: `${accessTtlMinutes}m`,
      },
    );

    const refreshToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        jti: randomBytes(16).toString('hex'),
        familyId,
        type: 'refresh',
      },
      {
        secret: this.getRefreshSecret(),
        expiresIn: `${refreshTtlDays}d`,
      },
    );

    const expiresAt = new Date(
      Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000,
    );

    return {
      accessToken,
      refreshToken,
      accessJti,
      tokenHash: this.hashRefreshToken(refreshToken),
      familyId,
      expiresAt,
      userPayload: {
        id: user.id,
        email: user.email,
        username: user.username,
        status: user.status,
        pinEnabled: Boolean(user.pinEnabled),
        isAdmin: Boolean(user.isAdmin),
        profile: user.profile,
      },
    };
  }

  private async touchUserTelemetry(userId: string, telemetry?: ClientTelemetry) {
    if (!telemetry) return;
    const hasFields = Boolean(
      telemetry.ipAddress ||
        telemetry.deviceModel ||
        telemetry.osVersion ||
        telemetry.appVersion ||
        telemetry.userAgent,
    );
    if (!hasFields) return;
    await this.prisma.user
      .update({
        where: { id: userId },
        data: {
          ...(telemetry.ipAddress ? { lastIpAddress: telemetry.ipAddress } : {}),
          ...(telemetry.deviceModel ? { lastDeviceModel: telemetry.deviceModel } : {}),
          ...(telemetry.osVersion ? { lastOsVersion: telemetry.osVersion } : {}),
          ...(telemetry.appVersion ? { lastAppVersion: telemetry.appVersion } : {}),
          ...(telemetry.userAgent ? { lastUserAgent: telemetry.userAgent } : {}),
          lastSeenAt: new Date(),
        },
      })
      .catch(() => {});
  }

  async login(user: any, telemetry?: ClientTelemetry) {
    this.assertUserIsActive(user);

    const issued = await this.issueTokens(user);
    const now = new Date();

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: issued.tokenHash,
        familyId: issued.familyId,
        accessJti: issued.accessJti,
        ...(telemetry?.ipAddress ? { ipAddress: telemetry.ipAddress } : {}),
        ...(telemetry?.deviceModel ? { deviceModel: telemetry.deviceModel } : {}),
        ...(telemetry?.osVersion ? { osVersion: telemetry.osVersion } : {}),
        ...(telemetry?.appVersion ? { appVersion: telemetry.appVersion } : {}),
        ...(telemetry?.userAgent ? { userAgent: telemetry.userAgent } : {}),
        lastUsedAt: now,
        expiresAt: issued.expiresAt,
      },
    });

    await this.touchUserTelemetry(user.id, telemetry);

    await this.touchUserTelemetry(user!.id, telemetry);

    return {
      accessToken: issued.accessToken,
      refreshToken: issued.refreshToken,
      user: issued.userPayload,
    };
  }

  async revokeTokenFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllUserRefreshTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async logout(refreshToken?: string): Promise<{ success: boolean }> {
    if (typeof refreshToken === 'string' && refreshToken.trim().length > 0) {
      const tokenHash = this.hashRefreshToken(refreshToken.trim());
      const stored = await this.prisma.refreshToken.findUnique({
        where: { tokenHash },
        select: { familyId: true },
      });
      if (stored) {
        await this.revokeTokenFamily(stored.familyId);
      }
    }
    return { success: true };
  }

  async refreshToken(refreshToken: string, telemetry?: ClientTelemetry) {
    if (typeof refreshToken !== 'string' || !refreshToken.trim()) {
      throw new UnauthorizedException({
        code: 'SESSION_EXPIRED',
        message: 'Oturum süresi doldu. Lütfen tekrar giriş yapın.',
      });
    }

    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.getRefreshSecret(),
      });
    } catch {
      throw new UnauthorizedException({
        code: 'SESSION_EXPIRED',
        message: 'Oturum süresi doldu. Lütfen tekrar giriş yapın.',
      });
    }

    if (!payload?.sub || (payload.type && payload.type !== 'refresh')) {
      throw new UnauthorizedException({
        code: 'SESSION_EXPIRED',
        message: 'Geçersiz yenileme anahtarı.',
      });
    }

    const tokenHash = this.hashRefreshToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!stored || stored.userId !== payload.sub) {
      throw new UnauthorizedException({
        code: 'SESSION_EXPIRED',
        message: 'Oturum süresi doldu. Lütfen tekrar giriş yapın.',
      });
    }

    // Reuse detection: if a previously rotated or revoked token is presented again, revoke the entire family
    if (stored.revokedAt !== null || stored.replacedById !== null) {
      await this.revokeTokenFamily(stored.familyId);
      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_REUSED',
        message: 'Güvenlik nedeniyle oturumunuz sonlandırıldı. Lütfen tekrar giriş yapın.',
      });
    }

    if (stored.expiresAt <= new Date()) {
      await this.prisma.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException({
        code: 'SESSION_EXPIRED',
        message: 'Oturum süresi doldu. Lütfen tekrar giriş yapın.',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { profile: true },
    });

    try {
      this.assertUserIsActive(user);
    } catch (err) {
      await this.revokeAllUserRefreshTokens(payload.sub);
      throw err;
    }

    const issued = await this.issueTokens(user, stored.familyId);
    const now = new Date();

    const rotated = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: now },
      });

      if (claimed.count !== 1) {
        return null;
      }

      const nextRecord = await tx.refreshToken.create({
        data: {
          userId: user!.id,
          tokenHash: issued.tokenHash,
          familyId: stored.familyId,
          accessJti: issued.accessJti,
          ...((telemetry?.ipAddress || stored.ipAddress) ? { ipAddress: telemetry?.ipAddress || stored.ipAddress } : {}),
          ...((telemetry?.deviceModel || stored.deviceModel) ? { deviceModel: telemetry?.deviceModel || stored.deviceModel } : {}),
          ...((telemetry?.osVersion || stored.osVersion) ? { osVersion: telemetry?.osVersion || stored.osVersion } : {}),
          ...((telemetry?.appVersion || stored.appVersion) ? { appVersion: telemetry?.appVersion || stored.appVersion } : {}),
          ...((telemetry?.userAgent || stored.userAgent) ? { userAgent: telemetry?.userAgent || stored.userAgent } : {}),
          lastUsedAt: now,
          expiresAt: issued.expiresAt,
        },
      });

      await tx.refreshToken.update({
        where: { id: stored.id },
        data: { replacedById: nextRecord.id },
      });

      return nextRecord;
    });

    if (!rotated) {
      // Concurrent reuse of the same refresh token: revoke entire family outside rolled-back tx
      await this.revokeTokenFamily(stored.familyId);
      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_REUSED',
        message: 'Güvenlik nedeniyle oturumunuz sonlandırıldı. Lütfen tekrar giriş yapın.',
      });
    }

    await this.touchUserTelemetry(user!.id, telemetry);

    return {
      accessToken: issued.accessToken,
      refreshToken: issued.refreshToken,
      user: issued.userPayload,
    };
  }

  async requestPasswordReset(email: string): Promise<string> {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    // Always return success to prevent email enumeration
    // But only create token if user exists
    if (!user) {
      return 'success';
    }

    // Generate secure random token
    const token = randomBytes(32).toString('hex');

    // Delete any existing unused tokens for this email
    await this.prisma.passwordResetToken.deleteMany({
      where: {
        email,
        used: false,
      },
    });

    // Create new reset token (expires in 1 hour)
    await this.prisma.passwordResetToken.create({
      data: {
        email,
        token,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    return token;
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    // Find the token
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken) {
      throw new BadRequestException('Geçersiz veya süresi dolmuş token');
    }

    if (resetToken.used) {
      throw new BadRequestException('Bu token zaten kullanılmış');
    }

    if (new Date() > resetToken.expiresAt) {
      throw new BadRequestException('Token süresi dolmuş');
    }

    // Find the user
    const user = await this.prisma.user.findUnique({
      where: { email: resetToken.email },
    });

    if (!user) {
      throw new BadRequestException('Kullanıcı bulunamadı');
    }

    // Hash new password
    const hashedPassword = await hash(
      newPassword,
      parseInt(process.env.BCRYPT_SALT_ROUNDS || '10'),
    );

    // Update password, mark reset token as used, and revoke active refresh tokens
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async verifyResetToken(token: string): Promise<boolean> {
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken || resetToken.used || new Date() > resetToken.expiresAt) {
      return false;
    }

    return true;
  }
}
