import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export interface PartnerLinkMeta {
  partnerUserId: string;
  partnerDisplayName: string;
  role: 'owner' | 'partner';
  connectedAt: string;
}

@Injectable()
export class PartnerService {
  constructor(private readonly prisma: PrismaService) {}

  private async isPartnerModeEnabled(): Promise<boolean> {
    const flag = await this.prisma.featureFlag.findUnique({
      where: { key: 'partner_mode_enabled' },
    });
    return !(flag && flag.valueJson === false);
  }

  private async assertPartnerModeEnabled() {
    if (!(await this.isPartnerModeEnabled())) {
      throw new ForbiddenException(
        'Partner Modu şu anda yönetici tarafından geçici olarak devre dışı bırakılmıştır.',
      );
    }
  }

  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[randomInt(0, chars.length)];
    }
    return code;
  }

  async createInvite(userId: string) {
    await this.assertPartnerModeEnabled();

    const [user, existingLink] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { status: true, profile: { select: { id: true } } },
      }),
      this.prisma.partnerLink.findFirst({
        where: { OR: [{ ownerUserId: userId }, { partnerUserId: userId }] },
      }),
    ]);

    if (!user || user.status !== 'ACTIVE' || !user.profile) {
      throw new NotFoundException('Profil bulunamadı');
    }

    if (existingLink) {
      throw new ConflictException(
        'Zaten aktif bir partner bağlantınız var. Yeni davet kodu için önce mevcut bağlantıyı kaldırın.',
      );
    }

    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    let code = this.generateCode();

    for (let attempt = 0; attempt < 5; attempt++) {
      const collision = await this.prisma.partnerInvite.findUnique({ where: { code } });
      if (!collision || collision.ownerUserId === userId) break;
      code = this.generateCode();
    }

    await this.prisma.partnerInvite.upsert({
      where: { ownerUserId: userId },
      update: { code, expiresAt },
      create: { code, ownerUserId: userId, expiresAt },
    });

    return {
      code,
      expiresAt: expiresAt.toISOString(),
      message: 'Bu 6 haneli davet kodunu eşiniz veya partnerinizle paylaşabilirsiniz.',
    };
  }

  async acceptInvite(partnerUserId: string, rawCode: string) {
    await this.assertPartnerModeEnabled();
    const code = (rawCode || '').trim().toUpperCase();
    if (!code || code.length < 4) {
      throw new BadRequestException('Geçerli bir davet kodu girin.');
    }

    const link = await this.prisma.$transaction(async (tx) => {
      const invite = await tx.partnerInvite.findUnique({
        where: { code },
      });

      if (!invite) {
        throw new NotFoundException('Davet kodu bulunamadı veya süresi doldu.');
      }

      if (invite.expiresAt.getTime() < Date.now()) {
        await tx.partnerInvite.delete({ where: { id: invite.id } });
        throw new BadRequestException('Bu davet kodunun süresi dolmuş.');
      }

      if (invite.ownerUserId === partnerUserId) {
        throw new BadRequestException('Kendi davet kodunuzu kullanamazsınız.');
      }

      const [owner, partner, existingLink] = await Promise.all([
        tx.user.findUnique({
          where: { id: invite.ownerUserId },
          select: { id: true, status: true, profile: { select: { displayName: true } } },
        }),
        tx.user.findUnique({
          where: { id: partnerUserId },
          select: { id: true, status: true, profile: { select: { displayName: true } } },
        }),
        tx.partnerLink.findFirst({
          where: {
            OR: [
              { ownerUserId: { in: [invite.ownerUserId, partnerUserId] } },
              { partnerUserId: { in: [invite.ownerUserId, partnerUserId] } },
            ],
          },
        }),
      ]);

      if (!owner || owner.status !== 'ACTIVE' || !owner.profile || !partner || partner.status !== 'ACTIVE' || !partner.profile) {
        throw new NotFoundException('Kullanıcı profili bulunamadı.');
      }

      if (existingLink) {
        throw new ConflictException(
          'Kullanıcılardan birinin zaten aktif bir partner bağlantısı bulunuyor.',
        );
      }

      const createdLink = await tx.partnerLink.create({
        data: {
          ownerUserId: invite.ownerUserId,
          partnerUserId,
        },
      });

      await tx.partnerInvite.delete({ where: { id: invite.id } });

      const linkMeta: PartnerLinkMeta = {
        partnerUserId: invite.ownerUserId,
        partnerDisplayName: owner.profile.displayName || 'Kullanıcı',
        role: 'partner',
        connectedAt: createdLink.connectedAt.toISOString(),
      };

      return linkMeta;
    });

    return { connected: true, link };
  }

  async unlink(userId: string) {
    await this.prisma.$transaction(async (tx) => {
      const existingLink = await tx.partnerLink.findFirst({
        where: { OR: [{ ownerUserId: userId }, { partnerUserId: userId }] },
      });

      if (existingLink) {
        await tx.partnerLink.delete({ where: { id: existingLink.id } });
      }

      // Remove any legacy partnerLink metadata if it still existed in profile preferences
      const affectedUserIds = existingLink
        ? [existingLink.ownerUserId, existingLink.partnerUserId]
        : [userId];

      for (const uid of affectedUserIds) {
        const prof = await tx.profile.findUnique({
          where: { userId: uid },
          select: { preferencesJson: true },
        });
        const prefs = prof?.preferencesJson as Record<string, any> | null;
        if (prefs && typeof prefs === 'object' && 'partnerLink' in prefs) {
          const { partnerLink: _removed, ...restPrefs } = prefs;
          await tx.profile.update({
            where: { userId: uid },
            data: { preferencesJson: restPrefs as any },
          });
        }
      }
    });

    return { connected: false };
  }

  async getStatus(userId: string) {
    if (!(await this.isPartnerModeEnabled())) {
      return { connected: false, link: null, partnerSummary: null };
    }

    // Authoritative server-controlled mutual link lookup; never read from user-editable preferencesJson
    const linkRecord = await this.prisma.partnerLink.findFirst({
      where: {
        OR: [{ ownerUserId: userId }, { partnerUserId: userId }],
      },
      include: {
        owner: {
          select: {
            id: true,
            status: true,
            profile: { select: { displayName: true } },
          },
        },
        partner: {
          select: {
            id: true,
            status: true,
            profile: { select: { displayName: true } },
          },
        },
      },
    });

    if (
      !linkRecord ||
      linkRecord.ownerUserId === linkRecord.partnerUserId ||
      linkRecord.owner.status !== 'ACTIVE' ||
      linkRecord.partner.status !== 'ACTIVE'
    ) {
      return { connected: false, link: null, partnerSummary: null };
    }

    const isVerifiedPartner = linkRecord.partnerUserId === userId;
    const isVerifiedOwner = linkRecord.ownerUserId === userId;

    if (!isVerifiedPartner && !isVerifiedOwner) {
      return { connected: false, link: null, partnerSummary: null };
    }

    const link: PartnerLinkMeta = isVerifiedPartner
      ? {
          partnerUserId: linkRecord.ownerUserId,
          partnerDisplayName: linkRecord.owner.profile?.displayName || 'Kullanıcı',
          role: 'partner',
          connectedAt: linkRecord.connectedAt.toISOString(),
        }
      : {
          partnerUserId: linkRecord.partnerUserId,
          partnerDisplayName: linkRecord.partner.profile?.displayName || 'Partner',
          role: 'owner',
          connectedAt: linkRecord.connectedAt.toISOString(),
        };

    // Strict privacy boundary: ONLY when viewer is the verified partner on a mutual link,
    // expose high-level phase & support tip for the linked owner.
    if (!isVerifiedPartner) {
      return { connected: true, link, partnerSummary: null };
    }

    const latestCycles = await this.prisma.periodCycle.findMany({
      where: { userId: linkRecord.ownerUserId },
      orderBy: { startDate: 'desc' },
      take: 3,
      select: { startDate: true },
    });

    let cycleDay: number | null = null;
    let phaseTitle = 'Döngü Verisi Bekleniyor';
    let supportTip = 'Bugün ona küçük bir sürpriz yapıp nasıl hissettiğini sorabilirsin. 🤍';
    let daysUntilNextPeriod: number | null = null;

    if (latestCycles.length > 0) {
      const latestStart = new Date(latestCycles[0].startDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      latestStart.setHours(0, 0, 0, 0);
      cycleDay = Math.max(
        1,
        Math.floor((today.getTime() - latestStart.getTime()) / (1000 * 60 * 60 * 24)) + 1,
      );

      let avgLength = 28;
      if (latestCycles.length >= 2) {
        const lengths: number[] = [];
        for (let i = 0; i < latestCycles.length - 1; i++) {
          const diff = Math.round(
            (new Date(latestCycles[i].startDate).getTime() -
              new Date(latestCycles[i + 1].startDate).getTime()) /
              (1000 * 60 * 60 * 24),
          );
          if (diff >= 20 && diff <= 45) lengths.push(diff);
        }
        if (lengths.length > 0) {
          avgLength = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
        }
      }

      daysUntilNextPeriod = Math.max(0, avgLength - cycleDay);

      if (cycleDay <= 5) {
        phaseTitle = 'Menstrual Faz (Hassas & Dinlenme Dönemi)';
        supportTip =
          'Regl döneminde olabilir; sıcak bir çay, bitki çayı veya sorumluluk paylaşımı bugün ona çok iyi gelir. 🫖';
      } else if (cycleDay <= 13) {
        phaseTitle = 'Foliküler Faz (Enerjik Dönem)';
        supportTip =
          'Enerjisi yükseliyor! Birlikte açık hava yürüyüşü veya yeni bir aktivite planlamak için harika zaman. ✨';
      } else if (cycleDay <= 16) {
        phaseTitle = 'Ovulasyon Fazı (Sosyal & Canlı Dönem)';
        supportTip =
          'Sosyal enerjisinin en yüksek olduğu günler; keyifli bir akşam planı harika olabilir. 🌷';
      } else {
        phaseTitle = 'Luteal / PMS Fazı (Ekstra Anlayış Dönemi)';
        supportTip =
          'Regl öncesi hassasiyet ve yorgunluk artabilir. Ekstra sabır, sevdiği bir atıştırmalık ve sarılmak iyi gelir. 💕';
      }
    }

    return {
      connected: true,
      link,
      partnerSummary: {
        ownerDisplayName: link.partnerDisplayName,
        cycleDay,
        phaseTitle,
        daysUntilNextPeriod,
        supportTip,
        privacyNote: 'Gizlilik gereği yalnızca genel faz ve destek önerileri paylaşılır.',
      },
    };
  }
}
