import { Injectable, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import type { ClientTelemetry } from '../common/utils/client-telemetry';

@Injectable()
export class GoogleAuthService {
  private client = new OAuth2Client();
  private audiences = (process.env.GOOGLE_OAUTH_AUDIENCES ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) { }

  async verifyIdToken(idToken: string): Promise<TokenPayload> {
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.audiences,
      });

      const payload = ticket.getPayload();

      if (!payload?.email || !payload?.sub) {
        throw new UnauthorizedException('Invalid Google token');
      }

      if (payload.email_verified === false) {
        throw new UnauthorizedException('Email not verified');
      }

      return payload;
    } catch (error) {
      throw new UnauthorizedException('Google token verification failed');
    }
  }

  async exchangeIdToken(idToken: string, telemetry?: ClientTelemetry) {
    const googlePayload = await this.verifyIdToken(idToken);

    // Use upsert to handle race conditions and ensure idempotency
    // First, try to find existing OAuth account
    const existingOAuth = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider: 'google',
          providerUserId: googlePayload.sub!,
        },
      },
      include: {
        user: {
          include: { profile: true },
        },
      },
    });

    let user: any;

    if (existingOAuth) {
      // User already exists via Google OAuth
      user = existingOAuth.user;

      // Update OAuth account data
      await this.prisma.oAuthAccount.update({
        where: {
          provider_providerUserId: {
            provider: 'google',
            providerUserId: googlePayload.sub!,
          },
        },
        data: {
          email: googlePayload.email!,
          rawJson: googlePayload as any,
        },
      });
    } else {
      // Check if user exists with this email
      const existingUser = await this.prisma.user.findUnique({
        where: { email: googlePayload.email! },
        include: { profile: true },
      });

      if (existingUser) {
        // Link existing user to Google OAuth
        user = existingUser;

        await this.prisma.oAuthAccount.create({
          data: {
            userId: user.id,
            provider: 'google',
            providerUserId: googlePayload.sub!,
            email: googlePayload.email!,
            rawJson: googlePayload as any,
          },
        });
      } else {
        // Create new user with Google OAuth in a transaction
        try {
          const result = await this.prisma.$transaction(async (tx) => {
            const newUser = await tx.user.create({
              data: {
                email: googlePayload.email!,
                profile: {
                  create: {
                    displayName: googlePayload.name || googlePayload.email!.split('@')[0],
                    timezone: 'Europe/Istanbul',
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

            await tx.oAuthAccount.create({
              data: {
                userId: newUser.id,
                provider: 'google',
                providerUserId: googlePayload.sub!,
                email: googlePayload.email!,
                rawJson: googlePayload as any,
              },
            });

            return newUser;
          });

          user = result;
        } catch (error: any) {
          // Handle race condition: if user was created by another request, fetch and link
          if (error.code === 'P2002') {
            const existingUser = await this.prisma.user.findUnique({
              where: { email: googlePayload.email! },
              include: { profile: true },
            });

            if (existingUser) {
              user = existingUser;

              // Try to create OAuth account if it doesn't exist
              try {
                await this.prisma.oAuthAccount.create({
                  data: {
                    userId: user.id,
                    provider: 'google',
                    providerUserId: googlePayload.sub!,
                    email: googlePayload.email!,
                    rawJson: googlePayload as any,
                  },
                });
              } catch (oauthError: any) {
                // OAuth account might have been created by another request, ignore
                if (oauthError.code !== 'P2002') {
                  throw oauthError;
                }
              }
            } else {
              throw error;
            }
          } else {
            throw error;
          }
        }
      }
    }

    return this.authService.login(user, telemetry);
  }
}
