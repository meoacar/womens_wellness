import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly lastSeenTouchMap = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    if (payload?.type && payload.type !== 'access') {
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN_TYPE',
        message: 'Geçersiz erişim anahtarı.',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        profile: true,
        subscription: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException({
        code: 'ACCOUNT_NOT_FOUND',
        message: 'Geçersiz oturum. Lütfen tekrar giriş yapın.',
      });
    }

    if (user.status === 'SUSPENDED') {
      throw new ForbiddenException({
        code: 'ACCOUNT_SUSPENDED',
        message: 'Hesabınız yönetici tarafından askıya alınmıştır. Destek ekibiyle iletişime geçin.',
      });
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException({
        code: 'ACCOUNT_DELETED',
        message: 'Bu hesap kapatılmış veya silinmiştir.',
      });
    }

    if (
      (user as any).sessionsRevokedAt &&
      typeof payload?.iat === 'number' &&
      payload.iat * 1000 < new Date((user as any).sessionsRevokedAt).getTime()
    ) {
      throw new UnauthorizedException({
        code: 'SESSION_REVOKED',
        message: 'Oturumunuz yönetici tarafından sonlandırıldı. Lütfen tekrar giriş yapın.',
      });
    }

    // Throttled live-presence heartbeat (max 1 DB write per minute per user)
    const now = Date.now();
    const lastTouch = this.lastSeenTouchMap.get(user.id) || 0;
    if (now - lastTouch >= 60_000) {
      this.lastSeenTouchMap.set(user.id, now);
      this.prisma.user
        .update({
          where: { id: user.id },
          data: { updatedAt: new Date(now), lastSeenAt: new Date(now) },
        })
        .catch(() => {});
    }

    return user;
  }
}
