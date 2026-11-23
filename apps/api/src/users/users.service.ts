import { Injectable, BadRequestException, ConflictException, NotFoundException, Optional } from '@nestjs/common';
import { SubscriptionStatus, SubscriptionTier } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { resolveUploadsDir } from '../common/utils/uploads';
import type { ClientTelemetry } from '../common/utils/client-telemetry';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly mailService?: MailService,
  ) { }

  async isUsernameAvailable(username: string): Promise<boolean> {
    const normalizedUsername = username.toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { username: normalizedUsername },
    });
    return !user;
  }

  async getUserWithProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        subscription: true,
        usageQuota: true,
      },
    });

    if (!user) {
      return null;
    }

    // Remove password and pinHash from response
    const { password, pinHash, ...userWithoutSensitive } = user;

    return userWithoutSensitive;
  }

  async updateProfile(userId: string, data: any) {
    const updateData: any = {};
    const userUpdateData: any = {};

    // Get current profile to merge with updates
    const currentProfile = await this.prisma.profile.findUnique({
      where: { userId },
    });

    if (!currentProfile) {
      throw new BadRequestException('Profile not found');
    }

    // Update name fields and regenerate displayName
    if (data.firstName !== undefined || data.lastName !== undefined) {
      const firstName = data.firstName !== undefined ? data.firstName : currentProfile.firstName;
      const lastName = data.lastName !== undefined ? data.lastName : currentProfile.lastName;

      updateData.firstName = firstName;
      updateData.lastName = lastName;
      updateData.displayName = `${firstName} ${lastName}`.trim();
    }

    // Physical attributes
    if (data.heightCm !== undefined) updateData.heightCm = data.heightCm;
    if (data.weightKg !== undefined) updateData.weightKg = data.weightKg;

    // Location and preferences
    if (data.timezone !== undefined) updateData.timezone = data.timezone;
    if (data.country !== undefined) updateData.country = data.country;
    if (data.profilePictureUrl !== undefined) {
      const localRelPath = this.extractLocalUploadRelativePath(data.profilePictureUrl);
      if (localRelPath) {
        const ownedFile = await this.prisma.uploadedFile.findUnique({
          where: { relativePath: localRelPath },
          select: { userId: true },
        });
        if (!ownedFile || ownedFile.userId !== userId) {
          throw new BadRequestException('Invalid profilePictureUrl ownership');
        }
      }
      updateData.profilePictureUrl = data.profilePictureUrl;
    }
    if (data.preferencesJson !== undefined) {
      if (
        data.preferencesJson === null ||
        typeof data.preferencesJson !== 'object' ||
        Array.isArray(data.preferencesJson)
      ) {
        throw new BadRequestException('Invalid preferencesJson format');
      }

      const RESERVED_SERVER_KEYS = new Set([
        'partnerLink',
        'pendingWinbackBanner',
        'winbackRecoveredAt',
      ]);

      const existingPrefs =
        currentProfile.preferencesJson &&
        typeof currentProfile.preferencesJson === 'object' &&
        !Array.isArray(currentProfile.preferencesJson)
          ? (currentProfile.preferencesJson as Record<string, any>)
          : {};

      const sanitizedPrefs: Record<string, any> = {};
      for (const [key, value] of Object.entries(data.preferencesJson as Record<string, any>)) {
        if (!RESERVED_SERVER_KEYS.has(key)) {
          sanitizedPrefs[key] = value;
        }
      }

      // Preserve server-managed retention metadata; partner relationships never live in preferencesJson
      for (const serverKey of ['pendingWinbackBanner', 'winbackRecoveredAt'] as const) {
        if (existingPrefs[serverKey] !== undefined) {
          sanitizedPrefs[serverKey] = existingPrefs[serverKey];
        }
      }

      updateData.preferencesJson = sanitizedPrefs;
    }

    // Handle date of birth
    if (data.dateOfBirth !== undefined) {
      updateData.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null;
    }

    // Update email in user table if provided
    if (data.email !== undefined) {
      userUpdateData.email = data.email;
    }

    // Update profile
    if (Object.keys(updateData).length > 0) {
      await this.prisma.profile.update({
        where: { userId },
        data: updateData,
      });
    }

    // Update user email if provided
    if (Object.keys(userUpdateData).length > 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: userUpdateData,
      });
    }

    return this.getUserWithProfile(userId);
  }

  async updateUsername(userId: string, newUsername: string) {
    const normalizedUsername = newUsername.toLowerCase();

    // Validate format
    if (!/^[a-z0-9._]+$/.test(normalizedUsername)) {
      throw new BadRequestException(
        'Username can only contain lowercase letters, numbers, dots, and underscores',
      );
    }

    if (normalizedUsername.length < 3 || normalizedUsername.length > 24) {
      throw new BadRequestException('Username must be between 3 and 24 characters');
    }

    // Check availability
    const existing = await this.prisma.user.findUnique({
      where: { username: normalizedUsername },
    });

    if (existing && existing.id !== userId) {
      throw new ConflictException('Username already taken');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { username: normalizedUsername },
    });

    return this.getUserWithProfile(userId);
  }

  // Admin methods
  async createUser(data: any) {
    if (!data.email || !data.password) {
      throw new BadRequestException('E-posta ve şifre zorunludur');
    }

    const existingEmail = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existingEmail) {
      throw new ConflictException('Bu e-posta adresi zaten kullanılıyor');
    }

    let normalizedUsername: string | undefined;
    if (data.username) {
      normalizedUsername = data.username.toLowerCase();
      const existingUsername = await this.prisma.user.findUnique({
        where: { username: normalizedUsername },
      });
      if (existingUsername) {
        throw new ConflictException('Bu kullanıcı adı zaten kullanılıyor');
      }
    }

    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const firstName = data.profile?.firstName || '';
    const lastName = data.profile?.lastName || '';
    const displayName =
      data.profile?.displayName || `${firstName} ${lastName}`.trim() || normalizedUsername || data.email.split('@')[0];

    const created = await this.prisma.user.create({
      data: {
        email: data.email,
        username: normalizedUsername,
        password: hashedPassword,
        status: data.status || 'ACTIVE',
        isAdmin: Boolean(data.isAdmin),
        profile: {
          create: {
            firstName: firstName || null,
            lastName: lastName || null,
            displayName,
            dateOfBirth: data.profile?.dateOfBirth ? new Date(data.profile.dateOfBirth) : null,
            heightCm: data.profile?.heightCm ?? null,
            weightKg: data.profile?.weightKg ?? null,
            country: data.profile?.country || 'TR',
            timezone: data.profile?.timezone || 'Europe/Istanbul',
          },
        },
      },
    });

    return this.getUserWithProfile(created.id);
  }

  async getAllUsers(page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        include: {
          profile: true,
          subscription: true,
          _count: {
            select: {
              periodCycles: true,
              dailyLogs: true,
              waterLogs: true,
              reminders: true,
              conversations: true,
              questions: true,
              answers: true,
              articleInteractions: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.user.count(),
    ]);

    // Remove passwords and pinHash from response
    const usersWithoutSensitive = users.map(({ password, pinHash, ...user }) => user);

    return {
      data: usersWithoutSensitive,
      total,
      page,
      limit,
    };
  }

  async getUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        subscription: true,
        usageQuota: true,
        pregnancy: {
          select: {
            id: true,
            isActive: true,
            weekCache: true,
            trimester: true,
            dueDate: true,
          },
        },
        _count: {
          select: {
            periodCycles: true,
            dailyLogs: true,
            waterLogs: true,
            dailySteps: true,
            sleepLogs: true,
            meditationSessions: true,
            healthMetrics: true,
            reminders: true,
            conversations: true,
            questions: true,
            answers: true,
            articleInteractions: true,
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    const [waterAgg, stepsAgg, sleepAgg, meditationAgg] = await Promise.all([
      this.prisma.waterLog.aggregate({ where: { userId }, _sum: { amountMl: true } }),
      this.prisma.dailySteps.aggregate({ where: { userId }, _sum: { count: true } }),
      this.prisma.sleepLog.aggregate({ where: { userId }, _sum: { durationMin: true } }),
      this.prisma.meditationSession.aggregate({ where: { userId }, _sum: { durationMin: true } }),
    ]);

    const currentMonthKey = new Date().toISOString().slice(0, 7);
    const currentQuota = Array.isArray(user.usageQuota)
      ? user.usageQuota.find((q) => q.monthKey === currentMonthKey)
      : null;

    const syncedSubscription = user.subscription
      ? {
          ...user.subscription,
          aiMessagesUsed: currentQuota
            ? currentQuota.aiRequests
            : user.subscription.aiMessagesUsed,
          aiMessagesLimit: currentQuota
            ? currentQuota.limit
            : user.subscription.aiMessagesLimit,
        }
      : null;

    const { password, pinHash, ...userWithoutSensitive } = user;
    return {
      ...userWithoutSensitive,
      subscription: syncedSubscription,
      wellnessTotals: {
        totalWaterMl: waterAgg._sum.amountMl || 0,
        totalSteps: stepsAgg._sum.count || 0,
        totalSleepHours: Math.round(((sleepAgg._sum.durationMin || 0) / 60) * 10) / 10,
        totalMeditationMin: meditationAgg._sum.durationMin || 0,
      },
    };
  }

  async updateUser(userId: string, data: any) {
    const existingTarget = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!existingTarget) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    const updateData: any = {};
    const profileData: any = {};

    // Check for email uniqueness if email is being updated
    if (data.email && data.email.trim()) {
      const cleanEmail = data.email.trim().toLowerCase();
      const existingUser = await this.prisma.user.findUnique({
        where: { email: cleanEmail },
      });

      if (existingUser && existingUser.id !== userId) {
        throw new ConflictException('Bu e-posta adresi zaten kullanılıyor');
      }

      updateData.email = cleanEmail;
    }

    // Check for username uniqueness if username is being updated
    if (data.username !== undefined && data.username !== null && String(data.username).trim() !== '') {
      const normalizedUsername = String(data.username).trim().toLowerCase();

      // Validate username format
      if (!/^[a-z0-9._]+$/.test(normalizedUsername)) {
        throw new BadRequestException('Kullanıcı adı sadece küçük harf, rakam, nokta ve alt çizgi içerebilir');
      }

      if (normalizedUsername.length < 3 || normalizedUsername.length > 24) {
        throw new BadRequestException('Kullanıcı adı 3-24 karakter arasında olmalıdır');
      }

      const existingUser = await this.prisma.user.findUnique({
        where: { username: normalizedUsername },
      });

      if (existingUser && existingUser.id !== userId) {
        throw new ConflictException('Bu kullanıcı adı zaten kullanılıyor');
      }

      updateData.username = normalizedUsername;
    }

    // User fields
    if (data.status) updateData.status = data.status;
    if (data.isAdmin !== undefined) updateData.isAdmin = Boolean(data.isAdmin);
    if (data.pinEnabled !== undefined) {
      updateData.pinEnabled = Boolean(data.pinEnabled);
      // If disabling PIN, also clear the PIN hash
      if (data.pinEnabled === false) {
        updateData.pinHash = null;
      }
    }

    // Handle password change (admin can set new password)
    if (data.newPassword && String(data.newPassword).trim().length > 0) {
      const newPwd = String(data.newPassword).trim();
      if (newPwd.length < 6) {
        throw new BadRequestException('Şifre en az 6 karakter olmalıdır');
      }

      if (data.confirmPassword && newPwd !== String(data.confirmPassword).trim()) {
        throw new BadRequestException('Şifreler eşleşmiyor');
      }

      const bcrypt = require('bcrypt');
      updateData.password = await bcrypt.hash(newPwd, 10);
    }

    // Profile fields
    if (data.profile) {
      if (data.profile.firstName !== undefined) profileData.firstName = data.profile.firstName;
      if (data.profile.lastName !== undefined) profileData.lastName = data.profile.lastName;
      if (data.profile.displayName !== undefined) profileData.displayName = data.profile.displayName;
      if (data.profile.dateOfBirth !== undefined) {
        if (!data.profile.dateOfBirth) {
          profileData.dateOfBirth = null;
        } else {
          const rawDob = String(data.profile.dateOfBirth).trim();
          const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(rawDob);
          profileData.dateOfBirth = dateOnly
            ? new Date(Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 12, 0, 0))
            : new Date(rawDob);
        }
      }
      if (data.profile.heightCm !== undefined) profileData.heightCm = data.profile.heightCm;
      if (data.profile.weightKg !== undefined) profileData.weightKg = data.profile.weightKg;
      if (data.profile.country !== undefined) profileData.country = data.profile.country;
      if (data.profile.timezone !== undefined) profileData.timezone = data.profile.timezone;
    }

    // Update user and profile in a transaction
    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(updateData).length > 0) {
        await tx.user.update({
          where: { id: userId },
          data: updateData,
        });

        if (
          updateData.password !== undefined ||
          (updateData.status !== undefined && updateData.status !== 'ACTIVE')
        ) {
          await (tx as any).refreshToken?.updateMany?.({
            where: { userId, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
      }

      if (Object.keys(profileData).length > 0) {
        const fallbackDisplayName =
          profileData.displayName ||
          existingTarget.profile?.displayName ||
          `${profileData.firstName || ''} ${profileData.lastName || ''}`.trim() ||
          existingTarget.username ||
          existingTarget.email.split('@')[0];

        await tx.profile.upsert({
          where: { userId },
          update: profileData,
          create: {
            userId,
            ...profileData,
            displayName: fallbackDisplayName,
          },
        });
      }
    });

    return this.getUserById(userId);
  }

  async adminUpdateUserSubscription(
    userId: string,
    body: {
      status?: SubscriptionStatus;
      tier?: SubscriptionTier | null;
      endDate?: string | null;
      aiMessagesLimit?: number;
      resetAiUsage?: boolean;
    },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    const existing = user.subscription;
    const status = body.status ?? existing?.status ?? SubscriptionStatus.FREE;
    const tier =
      body.tier !== undefined
        ? body.tier
        : status === SubscriptionStatus.ACTIVE
          ? existing?.tier ?? SubscriptionTier.MONTHLY
          : existing?.tier ?? null;
    const endDate =
      body.endDate !== undefined
        ? body.endDate
          ? new Date(body.endDate)
          : null
        : existing?.endDate ??
          (status === SubscriptionStatus.ACTIVE || status === SubscriptionStatus.TRIAL
            ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            : null);

    const defaultLimit = status === SubscriptionStatus.ACTIVE || status === SubscriptionStatus.TRIAL ? 500 : 20;
    const aiMessagesLimit =
      body.aiMessagesLimit !== undefined
        ? Math.max(0, Number(body.aiMessagesLimit))
        : existing?.aiMessagesLimit ?? defaultLimit;

    const startDate =
      existing?.startDate ||
      (status === SubscriptionStatus.ACTIVE || status === SubscriptionStatus.TRIAL ? new Date() : null);

    await this.prisma.subscription.upsert({
      where: { userId },
      update: {
        status,
        tier,
        startDate,
        endDate,
        aiMessagesLimit,
        ...(body.resetAiUsage ? { aiMessagesUsed: 0 } : {}),
      },
      create: {
        userId,
        status,
        tier,
        startDate,
        endDate,
        aiMessagesLimit,
        aiMessagesUsed: 0,
        quotaResetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
      },
    });

    const monthKey = new Date().toISOString().slice(0, 7);
    const nextMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);

    await this.prisma.usageQuota.upsert({
      where: {
        userId_monthKey: {
          userId,
          monthKey,
        },
      },
      update: {
        limit: aiMessagesLimit,
        ...(body.resetAiUsage ? { aiRequests: 0 } : {}),
      },
      create: {
        userId,
        monthKey,
        aiRequests: 0,
        limit: aiMessagesLimit,
        resetsAt: nextMonthStart,
      },
    });

    return this.getUserById(userId);
  }

  private extractLocalUploadRelativePath(fileUrl?: string | null): string | null {
    if (!fileUrl || typeof fileUrl !== 'string') return null;

    let pathname = fileUrl.trim();
    if (!pathname) return null;

    if (pathname.startsWith('http://') || pathname.startsWith('https://')) {
      try {
        pathname = new URL(pathname).pathname;
      } catch {
        return null;
      }
    }

    const uploadsPrefix = '/uploads/';
    const prefixIdx = pathname.indexOf(uploadsPrefix);
    if (prefixIdx === -1) return null;

    const relative = pathname.slice(prefixIdx + uploadsPrefix.length).replace(/^\/+/, '');
    if (!relative || relative.includes('..')) return null;
    return relative;
  }

  async saveUploadedProfilePicture(
    userId: string,
    file: {
      relativePath: string;
      mimeType: string;
      sizeBytes: number;
      profilePictureUrl: string;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.uploadedFile.create({
        data: {
          userId,
          relativePath: file.relativePath,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
        },
      });

      return tx.profile.update({
        where: { userId },
        data: { profilePictureUrl: file.profilePictureUrl },
      });
    });
  }

  private async removeOwnedUploadFiles(relativePaths: string[]): Promise<void> {
    const uploadsRoot = path.resolve(resolveUploadsDir());
    for (const relative of relativePaths) {
      if (!relative || relative.includes('..') || path.isAbsolute(relative)) {
        continue;
      }
      const resolvedPath = path.resolve(uploadsRoot, relative);
      if (!resolvedPath.startsWith(`${uploadsRoot}${path.sep}`)) {
        continue;
      }
      await fs.promises.unlink(resolvedPath).catch(() => undefined);
    }
  }

  private async findUserSupportTicketFlags(userId: string) {
    const ticketFlags = await this.prisma.featureFlag.findMany({
      where: { key: { startsWith: 'support_ticket_' } },
    });

    return ticketFlags.filter((flag) => {
      const val = flag.valueJson as Record<string, any> | null;
      return Boolean(val && val.userId === userId);
    });
  }

  async deleteUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    // Delete only server-tracked files owned by this user, never trusting user-editable URLs
    const [ownedFiles, userSupportTickets] = await Promise.all([
      this.prisma.uploadedFile.findMany({
        where: { userId },
        select: { relativePath: true },
      }),
      this.findUserSupportTicketFlags(userId),
      this.prisma.kvkkConsentLog
        ? this.prisma.kvkkConsentLog.findMany({
            where: { userId },
            orderBy: { consentedAt: 'desc' },
          })
        : Promise.resolve([]),
    ]);

    const ownedRelativePaths = ownedFiles.map((f) => f.relativePath);
    const supportTicketKeys = userSupportTickets.map((f) => f.key);

    await this.prisma.$transaction(async (tx) => {
      await tx.auditLog.deleteMany({
        where: {
          OR: [{ userId }, { entity: 'User', entityId: userId }],
        },
      });

      if (user.email) {
        await tx.passwordResetToken.deleteMany({
          where: { email: user.email },
        });
      }

      if (supportTicketKeys.length > 0) {
        await tx.featureFlag.deleteMany({
          where: { key: { in: supportTicketKeys } },
        });
      }

      await tx.uploadedFile.deleteMany({
        where: { userId },
      });

      await tx.user.delete({
        where: { id: userId },
      });
    });

    await this.removeOwnedUploadFiles(ownedRelativePaths);

    return { success: true };
  }

  async exportUserData(userId: string) {
    // Gather all user data for export (KVKK Article 11 compliance)
    const [
      user,
      healthMetrics,
      dailyLogs,
      waterLogs,
      stepsLogs,
      dailySteps,
      sleepLogs,
      meditationSessions,
      wellnessPreferences,
      cycles,
      pregnancy,
      reminders,
      conversations,
      messages,
      memories,
      usageQuota,
      birthChartProfile,
      gamification,
      userAchievements,
      insights,
      homePreferences,
      contentPreferences,
      articleInteractions,
      questions,
      answers,
      questionComments,
      answerComments,
      answerVotes,
      questionFavorites,
      questionFollowers,
      partnerLinkAsOwner,
      partnerLinkAsPartner,
      partnerInvite,
      supportTicketFlags,
      kvkkConsentLogs,
    ] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          profile: true,
          subscription: true,
        },
      }),
      this.prisma.healthMetric.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.dailyLog.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
      }),
      this.prisma.waterLog.findMany({
        where: { userId },
        orderBy: { loggedAt: 'desc' },
      }),
      this.prisma.stepsLog.findMany({
        where: { userId },
        orderBy: { loggedAt: 'desc' },
      }),
      this.prisma.dailySteps.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
      }),
      this.prisma.sleepLog.findMany({
        where: { userId },
        orderBy: { sleepDate: 'desc' },
      }),
      this.prisma.meditationSession.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
      }),
      this.prisma.wellnessPreferences.findUnique({
        where: { userId },
      }),
      this.prisma.periodCycle.findMany({
        where: { userId },
        orderBy: { startDate: 'desc' },
      }),
      this.prisma.pregnancy.findMany({
        where: { userId },
        orderBy: { dueDate: 'desc' },
        include: {
          kickCounts: { orderBy: { sessionDate: 'desc' } },
          contractions: { orderBy: { startTime: 'desc' } },
          appointments: { orderBy: { appointmentAt: 'desc' } },
          medications: { orderBy: { createdAt: 'desc' } },
          birthPlan: true,
          hospitalBagItems: { orderBy: { sortOrder: 'asc' } },
          pregnancyNotes: { orderBy: { createdAt: 'desc' } },
        },
      }),
      this.prisma.reminder.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.conversation.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.message.findMany({
        where: { conversation: { userId } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.memory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.usageQuota.findUnique({
        where: { userId },
      }),
      this.prisma.birthChartProfile.findUnique({
        where: { userId },
      }),
      this.prisma.userGamification.findUnique({
        where: { userId },
      }),
      this.prisma.userAchievement.findMany({
        where: { userId },
        include: { achievement: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.userInsight.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.userHomePreferences.findUnique({
        where: { userId },
      }),
      this.prisma.userContentPreferences.findUnique({
        where: { userId },
      }),
      this.prisma.articleInteraction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.question.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.answer.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.questionComment.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.answerComment.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.answerVote.findMany({
        where: { userId },
      }),
      this.prisma.questionFavorite.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.questionFollower.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.partnerLink.findUnique({
        where: { ownerUserId: userId },
      }),
      this.prisma.partnerLink.findUnique({
        where: { partnerUserId: userId },
      }),
      this.prisma.partnerInvite.findUnique({
        where: { ownerUserId: userId },
      }),
      this.findUserSupportTicketFlags(userId),
      this.prisma.kvkkConsentLog
        ? this.prisma.kvkkConsentLog.findMany({
            where: { userId },
            orderBy: { consentedAt: 'desc' },
          })
        : Promise.resolve([]),
    ]);

    if (!user) {
      throw new BadRequestException('Kullanıcı bulunamadı');
    }

    // Remove sensitive data
    const { password, pinHash, ...userWithoutSensitive } = user;

    return {
      exportDate: new Date().toISOString(),
      exportVersion: '1.1',
      user: userWithoutSensitive,
      healthMetrics,
      dailyLogs,
      waterLogs,
      stepsLogs,
      dailySteps,
      sleepLogs,
      meditationSessions,
      wellnessPreferences,
      cycles,
      pregnancy,
      reminders,
      conversations,
      messages,
      memories,
      usageQuota,
      birthChartProfile,
      gamification,
      userAchievements,
      insights,
      homePreferences,
      contentPreferences,
      articleInteractions,
      qna: {
        questions,
        answers,
        questionComments,
        answerComments,
        answerVotes,
        questionFavorites,
        questionFollowers,
      },
      partner: {
        linkedAsOwner: partnerLinkAsOwner,
        linkedAsPartner: partnerLinkAsPartner,
        activeInvite: partnerInvite,
      },
      supportTickets: supportTicketFlags.map((f) => f.valueJson),
      kvkkConsentLogs,
    };
  }

  async sendBackupToEmail(userId: string) {
    if (!this.mailService) {
      throw new BadRequestException('E-posta servisi şu an kullanılamıyor.');
    }
    const exportData = await this.exportUserData(userId);
    const email = exportData.user?.email;
    if (!email) {
      throw new BadRequestException('Hesabınıza tanımlı e-posta adresi bulunamadı.');
    }
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `kadin-atlasi-yedek-${dateStr}.json`;
    const jsonContent = JSON.stringify(exportData, null, 2);

    await this.mailService.sendBackupEmail(email, filename, jsonContent);
    return { success: true, sentTo: email, filename };
  }

  async restoreUserBackup(userId: string, payload: any) {
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Geçersiz yedek dosyası formatı.');
    }

    let restoredCycles = 0;
    let restoredDailyLogs = 0;
    let restoredWaterLogs = 0;
    let restoredSleepLogs = 0;

    if (Array.isArray(payload.cycles)) {
      const existingCycles = await this.prisma.periodCycle.findMany({
        where: { userId },
        select: { startDate: true },
      });
      const existingDays = new Set(
        existingCycles.map((c) => new Date(c.startDate).toISOString().slice(0, 10)),
      );

      for (const c of payload.cycles) {
        if (!c?.startDate) continue;
        const start = new Date(c.startDate);
        if (Number.isNaN(start.getTime())) continue;
        const dayKey = start.toISOString().slice(0, 10);
        if (existingDays.has(dayKey)) continue;

        const end = c.endDate ? new Date(c.endDate) : null;
        await this.prisma.periodCycle.create({
          data: {
            userId,
            startDate: start,
            endDate: end && !Number.isNaN(end.getTime()) ? end : null,
            notes: typeof c.notes === 'string' ? c.notes : null,
          },
        });
        existingDays.add(dayKey);
        restoredCycles++;
      }
    }

    if (Array.isArray(payload.dailyLogs)) {
      for (const d of payload.dailyLogs) {
        if (!d?.date) continue;
        const dt = new Date(d.date);
        if (Number.isNaN(dt.getTime())) continue;
        await this.prisma.dailyLog.upsert({
          where: { userId_date: { userId, date: dt } },
          update: {},
          create: {
            userId,
            date: dt,
            flow: d.flow ?? null,
            cramps: typeof d.cramps === 'number' ? d.cramps : null,
            symptoms: Array.isArray(d.symptoms) ? d.symptoms : [],
            mood: Array.isArray(d.mood) ? d.mood : [],
            healthNotes: typeof d.healthNotes === 'string' ? d.healthNotes : null,
          },
        });
        restoredDailyLogs++;
      }
    }

    if (Array.isArray(payload.waterLogs)) {
      const existingWater = await this.prisma.waterLog.findMany({
        where: { userId },
        select: { loggedAt: true, amountMl: true },
      });
      const waterKeys = new Set(
        existingWater.map((w) => `${new Date(w.loggedAt).toISOString()}:${w.amountMl}`),
      );
      for (const w of payload.waterLogs) {
        if (!w?.loggedAt || typeof w.amountMl !== 'number') continue;
        const dt = new Date(w.loggedAt);
        if (Number.isNaN(dt.getTime())) continue;
        const key = `${dt.toISOString()}:${w.amountMl}`;
        if (waterKeys.has(key)) continue;
        await this.prisma.waterLog.create({
          data: { userId, loggedAt: dt, amountMl: w.amountMl },
        });
        waterKeys.add(key);
        restoredWaterLogs++;
      }
    }

    if (Array.isArray(payload.sleepLogs)) {
      const existingSleep = await this.prisma.sleepLog.findMany({
        where: { userId },
        select: { sleepDate: true, durationMin: true },
      });
      const sleepKeys = new Set(
        existingSleep.map((s) => `${new Date(s.sleepDate).toISOString().slice(0, 10)}:${s.durationMin}`),
      );
      for (const s of payload.sleepLogs) {
        if (!s?.sleepDate || typeof s.durationMin !== 'number') continue;
        const dt = new Date(s.sleepDate);
        if (Number.isNaN(dt.getTime())) continue;
        const key = `${dt.toISOString().slice(0, 10)}:${s.durationMin}`;
        if (sleepKeys.has(key)) continue;
        await this.prisma.sleepLog.create({
          data: {
            userId,
            sleepDate: dt,
            durationMin: s.durationMin,
            quality: typeof s.quality === 'number' ? s.quality : null,
          },
        });
        sleepKeys.add(key);
        restoredSleepLogs++;
      }
    }

    return {
      success: true,
      restored: {
        cycles: restoredCycles,
        dailyLogs: restoredDailyLogs,
        waterLogs: restoredWaterLogs,
        sleepLogs: restoredSleepLogs,
      },
    };
  }

  // PIN Management
  async setupPin(userId: string, pin: string) {
    // Validate PIN (4-6 digits)
    if (!/^\d{4,6}$/.test(pin)) {
      throw new BadRequestException('PIN must be 4-6 digits');
    }

    const bcrypt = require('bcrypt');
    const pinHash = await bcrypt.hash(pin, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        pinHash,
        pinEnabled: true,
      },
    });

    return { success: true, message: 'PIN başarıyla oluşturuldu' };
  }

  async verifyPin(userId: string, pin: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { pinHash: true, pinEnabled: true },
    });

    if (!user || !user.pinEnabled || !user.pinHash) {
      throw new BadRequestException('PIN ayarlanmamış');
    }

    const bcrypt = require('bcrypt');
    const isValid = await bcrypt.compare(pin, user.pinHash);

    if (!isValid) {
      throw new BadRequestException('Yanlış PIN');
    }

    return { success: true, message: 'PIN doğrulandı' };
  }

  async disablePin(userId: string, pin: string) {
    // Verify PIN before disabling
    await this.verifyPin(userId, pin);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        pinHash: null,
        pinEnabled: false,
      },
    });

    return { success: true, message: 'PIN devre dışı bırakıldı' };
  }

  async changePin(userId: string, oldPin: string, newPin: string) {
    // Verify old PIN
    await this.verifyPin(userId, oldPin);

    // Validate new PIN
    if (!/^\d{4,6}$/.test(newPin)) {
      throw new BadRequestException('Yeni PIN 4-6 rakam olmalıdır');
    }

    const bcrypt = require('bcrypt');
    const pinHash = await bcrypt.hash(newPin, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { pinHash },
    });

    return { success: true, message: 'PIN başarıyla değiştirildi' };
  }

  async getPinStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { pinEnabled: true },
    });

    return { pinEnabled: user?.pinEnabled || false };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const bcrypt = require('bcrypt');

    // Get user with password
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    });

    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      throw new BadRequestException('Mevcut şifre yanlış');
    }

    // Validate new password
    if (newPassword.length < 6) {
      throw new BadRequestException('Yeni şifre en az 6 karakter olmalıdır');
    }

    // Check if new password is same as current
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      throw new BadRequestException('Yeni şifre mevcut şifre ile aynı olamaz');
    }

    // Hash new password
    const password = await bcrypt.hash(newPassword, 10);

    // Update password and revoke active refresh tokens
    await this.prisma.user.update({
      where: { id: userId },
      data: { password },
    });
    await (this.prisma as any).refreshToken?.updateMany?.({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { success: true, message: 'Şifre başarıyla değiştirildi' };
  }

  async getMyRetentionOffer(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        updatedAt: true,
        profile: { select: { preferencesJson: true } },
      },
    });
    if (!user) return { banner: null };

    // Touch user activity timestamp at most once per 30 minutes for accurate DAU/WAU/MAU
    const msSinceUpdate = Date.now() - new Date(user.updatedAt).getTime();
    if (msSinceUpdate > 30 * 60 * 1000) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { updatedAt: new Date() },
      });
    }

    const prefs = ((user.profile?.preferencesJson as Record<string, any>) || {});
    return {
      banner: prefs.pendingWinbackBanner || null,
    };
  }

  async ackMyRetentionOffer(userId: string, action: 'dismiss' | 'claim') {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile) {
      return { success: true, bonusGranted: 0 };
    }

    const prefs = ((profile.preferencesJson as Record<string, any>) || {});
    const pending = prefs.pendingWinbackBanner;
    const { pendingWinbackBanner: _removed, ...rest } = prefs;

    let bonusGranted = 0;
    if (action === 'claim' && pending?.incentive === 'nova_bonus') {
      bonusGranted = 10;
      await Promise.all([
        this.prisma.usageQuota.updateMany({
          where: { userId },
          data: { limit: { increment: bonusGranted } },
        }),
        this.prisma.subscription.updateMany({
          where: { userId },
          data: { aiMessagesLimit: { increment: bonusGranted } },
        }),
      ]);
    }

    await this.prisma.profile.update({
      where: { userId },
      data: {
        preferencesJson: {
          ...rest,
          ...(action === 'claim' ? { winbackRecoveredAt: new Date().toISOString() } : {}),
        } as any,
      },
    });

    return {
      success: true,
      action,
      bonusGranted,
    };
  }

  async recordKvkkConsentHistory(
    userId: string,
    consents: Record<string, any>,
    telemetry?: ClientTelemetry,
  ) {
    if (!this.prisma.kvkkConsentLog || !consents || typeof consents !== 'object') {
      return { recorded: 0 };
    }

    const now = new Date();
    const mapping: Array<{ field: string; consentType: string }> = [
      { field: 'dataProcessing', consentType: 'DATA_PROCESSING' },
      { field: 'privacyPolicyAccepted', consentType: 'PRIVACY_POLICY_AND_TERMS' },
      { field: 'aiMemoryConsent', consentType: 'AI_MEMORY' },
      { field: 'marketingConsent', consentType: 'MARKETING' },
      { field: 'analyticsConsent', consentType: 'ANALYTICS' },
      { field: 'thirdPartyConsent', consentType: 'THIRD_PARTY' },
    ];

    const rows = mapping
      .filter(({ field }) => typeof consents[field] === 'boolean')
      .map(({ field, consentType }) => ({
        userId,
        consentType,
        granted: Boolean(consents[field]),
        version: String(consents.version || '1.0'),
        source: String(consents.source || 'SETTINGS'),
        ipAddress: telemetry?.ipAddress,
        deviceModel: telemetry?.deviceModel,
        osVersion: telemetry?.osVersion,
        appVersion: telemetry?.appVersion,
        consentedAt: now,
      }));

    if (rows.length === 0) {
      return { recorded: 0 };
    }

    await this.prisma.kvkkConsentLog.createMany({ data: rows });
    return { recorded: rows.length };
  }

  async recordClientError(
    userId: string | undefined,
    payload: {
      message: string;
      stack?: string;
      path?: string;
      level?: string;
      metadataJson?: any;
    },
    telemetry?: ClientTelemetry,
  ) {
    if (!this.prisma.userErrorLog || !payload?.message?.trim()) {
      return { logged: false };
    }

    await this.prisma.userErrorLog.create({
      data: {
        userId: userId || null,
        source: 'MOBILE',
        level: payload.level || 'ERROR',
        path: payload.path ? String(payload.path).slice(0, 200) : null,
        message: String(payload.message).slice(0, 500),
        stack: payload.stack ? String(payload.stack).slice(0, 2000) : null,
        ipAddress: telemetry?.ipAddress,
        deviceModel: telemetry?.deviceModel,
        osVersion: telemetry?.osVersion,
        appVersion: telemetry?.appVersion,
        metadataJson: payload.metadataJson || undefined,
      },
    });

    return { logged: true };
  }
}
