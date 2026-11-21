import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

describe('AuthService session & credential security', () => {
  const ACCESS_SECRET = 'test-access-secret-32-chars-minimum';
  const REFRESH_SECRET = 'test-refresh-secret-32-chars-minimum';

  function createHarness() {
    const records = new Map<string, any>();
    let seq = 1;

    const refreshTokenDelegate = {
      create: jest.fn(async ({ data }: any) => {
        const rec = {
          id: `rt-${seq++}`,
          revokedAt: null,
          replacedById: null,
          createdAt: new Date(),
          ...data,
        };
        records.set(rec.id, rec);
        return rec;
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        for (const rec of records.values()) {
          if (where.tokenHash && rec.tokenHash === where.tokenHash) return { ...rec };
          if (where.id && rec.id === where.id) return { ...rec };
        }
        return null;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const rec = records.get(where.id);
        if (!rec) throw new Error('Not found');
        Object.assign(rec, data);
        return { ...rec };
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const rec of records.values()) {
          if (where.id && rec.id !== where.id) continue;
          if (where.userId && rec.userId !== where.userId) continue;
          if (where.familyId && rec.familyId !== where.familyId) continue;
          if (where.revokedAt === null && rec.revokedAt !== null) continue;
          Object.assign(rec, data);
          count += 1;
        }
        return { count };
      }),
    };

    const userObj = {
      id: 'user-1',
      email: 'alice@example.com',
      username: 'alice',
      password: '',
      status: 'ACTIVE',
      pinEnabled: false,
      isAdmin: false,
      profile: { displayName: 'Alice' },
    };

    const prisma: any = {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(async ({ where }: any) =>
          where?.id === userObj.id || where?.email === userObj.email ? { ...userObj } : null,
        ),
        update: jest.fn(async ({ data }: any) => ({ ...userObj, ...data })),
      },
      passwordResetToken: {
        findUnique: jest.fn(),
        update: jest.fn(async () => ({})),
      },
      refreshToken: refreshTokenDelegate,
      $transaction: jest.fn(async (arg: any) => {
        if (typeof arg === 'function') {
          return arg(prisma);
        }
        return Promise.all(arg);
      }),
    };

    const jwtService = new JwtService({});
    const configService: any = {
      get: jest.fn((key: string) => {
        if (key === 'JWT_SECRET') return ACCESS_SECRET;
        if (key === 'JWT_REFRESH_SECRET') return REFRESH_SECRET;
        if (key === 'ACCESS_TOKEN_TTL_MIN') return 15;
        if (key === 'REFRESH_TOKEN_TTL_DAYS') return 30;
        return undefined;
      }),
    };

    const authService = new AuthService(prisma, jwtService, configService);
    return { authService, prisma, jwtService, configService, userObj, records };
  }

  describe('validateUser exact password enforcement', () => {
    it('accepts only the exact password and rejects case or whitespace variants', async () => {
      const { authService, prisma, userObj } = createHarness();
      userObj.password = await bcrypt.hash('SecretPass1!', 4);
      prisma.user.findFirst.mockResolvedValue(userObj);

      await expect(authService.validateUser('alice', 'SecretPass1!')).resolves.toMatchObject({
        id: 'user-1',
      });
      await expect(authService.validateUser('alice', 'secretPass1!')).resolves.toBeNull();
      await expect(authService.validateUser('alice', ' SecretPass1! ')).resolves.toBeNull();
      await expect(authService.validateUser('alice', 'SecretPass1! ')).resolves.toBeNull();
    });
  });

  describe('refresh token persistence, rotation, reuse detection, and revocation', () => {
    it('hashes refresh token in DB, rotates atomically, and revokes entire family on reuse', async () => {
      const { authService, records } = createHarness();

      const loginRes = await authService.login({
        id: 'user-1',
        email: 'alice@example.com',
        username: 'alice',
        status: 'ACTIVE',
        pinEnabled: false,
        isAdmin: false,
        profile: { displayName: 'Alice' },
      });

      expect(records.size).toBe(1);
      const firstRecord = Array.from(records.values())[0];
      expect(firstRecord.tokenHash).toBe(
        createHash('sha256').update(loginRes.refreshToken).digest('hex'),
      );
      expect(firstRecord.tokenHash).not.toBe(loginRes.refreshToken);

      // Legitimate rotation issues new token in same family and links replacedById
      const rotatedRes = await authService.refreshToken(loginRes.refreshToken);
      expect(rotatedRes.refreshToken).not.toBe(loginRes.refreshToken);
      expect(records.size).toBe(2);

      const secondRecord = Array.from(records.values())[1];
      expect(secondRecord.familyId).toBe(firstRecord.familyId);
      expect(firstRecord.revokedAt).not.toBeNull();
      expect(firstRecord.replacedById).toBe(secondRecord.id);

      // Reusing the already-rotated first refresh token triggers reuse detection & kills family
      await expect(authService.refreshToken(loginRes.refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(secondRecord.revokedAt).not.toBeNull();

      // Even the second token is now invalid because the family was revoked
      await expect(authService.refreshToken(rotatedRes.refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('revokes token family on logout', async () => {
      const { authService, records } = createHarness();

      const loginRes = await authService.login({
        id: 'user-1',
        email: 'alice@example.com',
        username: 'alice',
        status: 'ACTIVE',
        pinEnabled: false,
        isAdmin: false,
        profile: { displayName: 'Alice' },
      });

      await authService.logout(loginRes.refreshToken);
      const stored = Array.from(records.values())[0];
      expect(stored.revokedAt).not.toBeNull();

      await expect(authService.refreshToken(loginRes.refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('revokes all active user refresh tokens on resetPassword', async () => {
      const { authService, prisma, records } = createHarness();

      const loginRes = await authService.login({
        id: 'user-1',
        email: 'alice@example.com',
        username: 'alice',
        status: 'ACTIVE',
        pinEnabled: false,
        isAdmin: false,
        profile: { displayName: 'Alice' },
      });

      prisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 'prt-1',
        email: 'alice@example.com',
        token: 'reset-tok',
        used: false,
        expiresAt: new Date(Date.now() + 60_000),
      });

      await authService.resetPassword('reset-tok', 'NewStrongPass1!');
      const stored = Array.from(records.values())[0];
      expect(stored.revokedAt).not.toBeNull();

      await expect(authService.refreshToken(loginRes.refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects access tokens presented to refreshToken or refresh tokens presented to JwtStrategy', async () => {
      const { authService, prisma, jwtService, configService } = createHarness();

      const loginRes = await authService.login({
        id: 'user-1',
        email: 'alice@example.com',
        username: 'alice',
        status: 'ACTIVE',
        pinEnabled: false,
        isAdmin: false,
        profile: { displayName: 'Alice' },
      });

      // Access token signed with refresh secret still rejected if type is access
      const forged = jwtService.sign(
        { sub: 'user-1', email: 'alice@example.com', type: 'access' },
        { secret: REFRESH_SECRET, expiresIn: '15m' },
      );
      await expect(authService.refreshToken(forged)).rejects.toThrow(UnauthorizedException);

      // Refresh token payload rejected by JwtStrategy
      const strategy = new JwtStrategy(prisma, configService);
      const decodedRefresh = jwtService.decode(loginRes.refreshToken) as any;
      await expect(strategy.validate(decodedRefresh)).rejects.toThrow(UnauthorizedException);
    });
  });
});
