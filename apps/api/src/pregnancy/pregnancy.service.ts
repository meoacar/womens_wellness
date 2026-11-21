import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PregnancyService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────
  // Pregnancy Profile
  // ─────────────────────────────────────────────────────────────

  async createOrUpdatePregnancy(
    userId: string,
    data: {
      lmpDate?: string;
      dueDate?: string;
      doctorNotes?: string;
      isActive?: boolean;
      anonymousMode?: boolean;
    },
  ) {
    const existing = await this.prisma.pregnancy.findUnique({
      where: { userId },
    });

    const pregnancyData: any = {
      ...(data.lmpDate && { lmpDate: new Date(data.lmpDate) }),
      ...(data.dueDate && { dueDate: new Date(data.dueDate) }),
      ...(data.doctorNotes !== undefined && { doctorNotes: data.doctorNotes }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.anonymousMode !== undefined && {
        anonymousMode: data.anonymousMode,
      }),
    };

    // Derive missing LMP or dueDate automatically so week/trimester always compute cleanly
    const effectiveLmp = data.lmpDate
      ? new Date(data.lmpDate)
      : existing?.lmpDate ||
        (data.dueDate
          ? new Date(new Date(data.dueDate).getTime() - 280 * 24 * 60 * 60 * 1000)
          : existing?.dueDate
            ? new Date(new Date(existing.dueDate).getTime() - 280 * 24 * 60 * 60 * 1000)
            : null);

    if (effectiveLmp) {
      if (!pregnancyData.lmpDate && !existing?.lmpDate) {
        pregnancyData.lmpDate = effectiveLmp;
      }
      if (!pregnancyData.dueDate && !existing?.dueDate) {
        pregnancyData.dueDate = new Date(effectiveLmp.getTime() + 280 * 24 * 60 * 60 * 1000);
      }
      const weeks = this.calculateWeeksFromLMP(effectiveLmp);
      pregnancyData.weekCache = weeks;
      pregnancyData.trimester = this.calculateTrimester(weeks);
    }

    if (existing) {
      return this.prisma.pregnancy.update({
        where: { userId },
        data: pregnancyData,
      });
    }

    return this.prisma.pregnancy.create({
      data: {
        userId,
        ...pregnancyData,
      },
    });
  }

  async getPregnancy(userId: string) {
    const pregnancy = await this.prisma.pregnancy.findUnique({
      where: { userId },
      include: {
        kickCounts: {
          orderBy: { sessionDate: 'desc' },
          take: 10,
        },
        contractions: {
          orderBy: { startTime: 'desc' },
          take: 20,
        },
        appointments: {
          orderBy: { appointmentAt: 'desc' },
        },
        medications: {
          orderBy: { createdAt: 'desc' },
        },
        birthPlan: true,
        hospitalBagItems: {
          orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
        },
        pregnancyNotes: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!pregnancy) {
      return null;
    }

    // Update week cache if needed
    if (pregnancy.lmpDate) {
      const currentWeek = this.calculateWeeksFromLMP(pregnancy.lmpDate);
      if (currentWeek !== pregnancy.weekCache) {
        await this.prisma.pregnancy.update({
          where: { userId },
          data: {
            weekCache: currentWeek,
            trimester: this.calculateTrimester(currentWeek),
          },
        });
        pregnancy.weekCache = currentWeek;
        pregnancy.trimester = this.calculateTrimester(currentWeek);
      }
    }

    return pregnancy;
  }

  async getPregnancySummary(userId: string) {
    const pregnancy = await this.getPregnancy(userId);

    if (!pregnancy) {
      return null;
    }

    const referenceLmp =
      pregnancy.lmpDate ||
      (pregnancy.dueDate
        ? new Date(new Date(pregnancy.dueDate).getTime() - 280 * 24 * 60 * 60 * 1000)
        : null);
    const weeks = referenceLmp ? this.calculateWeeksFromLMP(referenceLmp) : pregnancy.weekCache || 0;
    const days = referenceLmp ? this.calculateDaysInWeek(referenceLmp) : 0;

    return {
      id: pregnancy.id,
      gestationalAge: {
        weeks,
        days,
        totalDays: weeks * 7 + days,
      },
      dueDate: pregnancy.dueDate,
      trimester: pregnancy.trimester,
      isActive: pregnancy.isActive,
      anonymousMode: pregnancy.anonymousMode,
      weeklyTip: this.getWeeklyTip(weeks),
    };
  }

  async deletePregnancy(userId: string) {
    return this.prisma.pregnancy.delete({
      where: { userId },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Kick Counter
  // ─────────────────────────────────────────────────────────────

  async logKickCount(
    userId: string,
    data: {
      sessionDate: string;
      kickCount: number;
      durationMin: number;
      notes?: string;
    },
  ) {
    const pregnancy = await this.ensurePregnancy(userId);

    return this.prisma.kickCount.create({
      data: {
        pregnancyId: pregnancy.id,
        sessionDate: new Date(data.sessionDate),
        kickCount: data.kickCount,
        durationMin: data.durationMin,
        notes: data.notes,
      },
    });
  }

  async getKickCounts(userId: string, limit = 30) {
    const pregnancy = await this.ensurePregnancy(userId);

    return this.prisma.kickCount.findMany({
      where: { pregnancyId: pregnancy.id },
      orderBy: { sessionDate: 'desc' },
      take: limit,
    });
  }

  async deleteKickCount(userId: string, kickCountId: string) {
    const pregnancy = await this.ensurePregnancy(userId);

    return this.prisma.kickCount.delete({
      where: {
        id: kickCountId,
        pregnancyId: pregnancy.id,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Contraction Timer
  // ─────────────────────────────────────────────────────────────

  async logContraction(
    userId: string,
    data: {
      startTime: string;
      endTime: string;
      durationSec: number;
      intensity?: number;
      notes?: string;
    },
  ) {
    const pregnancy = await this.ensurePregnancy(userId);

    return this.prisma.contraction.create({
      data: {
        pregnancyId: pregnancy.id,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        durationSec: data.durationSec,
        intensity: data.intensity,
        notes: data.notes,
      },
    });
  }

  async getContractions(userId: string, hours = 24) {
    const pregnancy = await this.ensurePregnancy(userId);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    return this.prisma.contraction.findMany({
      where: {
        pregnancyId: pregnancy.id,
        startTime: {
          gte: since,
        },
      },
      orderBy: { startTime: 'desc' },
    });
  }

  async getContractionsSummary(userId: string) {
    const contractions = await this.getContractions(userId, 2);

    if (contractions.length < 2) {
      return {
        count: contractions.length,
        frequency: null,
        avgDuration: null,
        regular: false,
      };
    }

    // Calculate frequency (minutes between contractions)
    const intervals: number[] = [];
    for (let i = 0; i < contractions.length - 1; i++) {
      const interval =
        (contractions[i].startTime.getTime() -
          contractions[i + 1].startTime.getTime()) /
        60000;
      intervals.push(interval);
    }

    const avgInterval =
      intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const avgDuration =
      contractions.reduce((sum, c) => sum + c.durationSec, 0) /
      contractions.length;

    // Check regularity (standard deviation < 2 minutes)
    const variance =
      intervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0) /
      intervals.length;
    const stdDev = Math.sqrt(variance);
    const regular = stdDev < 2;

    return {
      count: contractions.length,
      frequency: avgInterval,
      avgDuration,
      regular,
    };
  }

  async deleteContraction(userId: string, contractionId: string) {
    const pregnancy = await this.ensurePregnancy(userId);

    return this.prisma.contraction.delete({
      where: {
        id: contractionId,
        pregnancyId: pregnancy.id,
      },
    });
  }

  async deleteAllContractions(userId: string) {
    const pregnancy = await this.ensurePregnancy(userId);

    return this.prisma.contraction.deleteMany({
      where: { pregnancyId: pregnancy.id },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Appointments
  // ─────────────────────────────────────────────────────────────

  async createAppointment(
    userId: string,
    data: {
      appointmentAt: string;
      clinic?: string;
      doctorName?: string;
      notes?: string;
      vitals?: any;
    },
  ) {
    const pregnancy = await this.ensurePregnancy(userId);

    return this.prisma.pregnancyAppointment.create({
      data: {
        pregnancyId: pregnancy.id,
        appointmentAt: new Date(data.appointmentAt),
        clinic: data.clinic,
        doctorName: data.doctorName,
        notes: data.notes,
        vitalsJson: data.vitals || {},
      },
    });
  }

  async getAppointments(userId: string) {
    const pregnancy = await this.ensurePregnancy(userId);

    return this.prisma.pregnancyAppointment.findMany({
      where: { pregnancyId: pregnancy.id },
      orderBy: { appointmentAt: 'desc' },
    });
  }

  async getAppointment(userId: string, appointmentId: string) {
    const pregnancy = await this.ensurePregnancy(userId);

    return this.prisma.pregnancyAppointment.findFirst({
      where: {
        id: appointmentId,
        pregnancyId: pregnancy.id,
      },
    });
  }

  async updateAppointment(
    userId: string,
    appointmentId: string,
    data: {
      appointmentAt?: string;
      clinic?: string;
      doctorName?: string;
      notes?: string;
      vitals?: any;
    },
  ) {
    const pregnancy = await this.ensurePregnancy(userId);

    return this.prisma.pregnancyAppointment.update({
      where: {
        id: appointmentId,
        pregnancyId: pregnancy.id,
      },
      data: {
        ...(data.appointmentAt && {
          appointmentAt: new Date(data.appointmentAt),
        }),
        ...(data.clinic !== undefined && { clinic: data.clinic }),
        ...(data.doctorName !== undefined && { doctorName: data.doctorName }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.vitals !== undefined && { vitalsJson: data.vitals }),
      },
    });
  }

  async deleteAppointment(userId: string, appointmentId: string) {
    const pregnancy = await this.ensurePregnancy(userId);

    return this.prisma.pregnancyAppointment.delete({
      where: {
        id: appointmentId,
        pregnancyId: pregnancy.id,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Medications
  // ─────────────────────────────────────────────────────────────

  async addMedication(
    userId: string,
    data: {
      name: string;
      dosage?: string;
      frequency?: string;
      safetyRating?: string;
      notes?: string;
      startDate?: string;
      endDate?: string;
    },
  ) {
    const pregnancy = await this.ensurePregnancy(userId);

    return this.prisma.pregnancyMedication.create({
      data: {
        pregnancyId: pregnancy.id,
        name: data.name,
        dosage: data.dosage,
        frequency: data.frequency,
        safetyRating: data.safetyRating,
        notes: data.notes,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
      },
    });
  }

  async getMedications(userId: string) {
    const pregnancy = await this.ensurePregnancy(userId);

    return this.prisma.pregnancyMedication.findMany({
      where: { pregnancyId: pregnancy.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateMedication(userId: string, medicationId: string, data: any) {
    const pregnancy = await this.ensurePregnancy(userId);

    return this.prisma.pregnancyMedication.update({
      where: {
        id: medicationId,
        pregnancyId: pregnancy.id,
      },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.dosage !== undefined && { dosage: data.dosage }),
        ...(data.frequency !== undefined && { frequency: data.frequency }),
        ...(data.safetyRating !== undefined && {
          safetyRating: data.safetyRating,
        }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.startDate && { startDate: new Date(data.startDate) }),
        ...(data.endDate && { endDate: new Date(data.endDate) }),
      },
    });
  }

  async deleteMedication(userId: string, medicationId: string) {
    const pregnancy = await this.ensurePregnancy(userId);

    return this.prisma.pregnancyMedication.delete({
      where: {
        id: medicationId,
        pregnancyId: pregnancy.id,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Birth Plan
  // ─────────────────────────────────────────────────────────────

  async createOrUpdateBirthPlan(userId: string, content: any) {
    const pregnancy = await this.ensurePregnancy(userId);

    const existing = await this.prisma.birthPlan.findUnique({
      where: { pregnancyId: pregnancy.id },
    });

    if (existing) {
      return this.prisma.birthPlan.update({
        where: { pregnancyId: pregnancy.id },
        data: { contentJson: content },
      });
    }

    return this.prisma.birthPlan.create({
      data: {
        pregnancyId: pregnancy.id,
        contentJson: content,
      },
    });
  }

  async getBirthPlan(userId: string) {
    const pregnancy = await this.ensurePregnancy(userId);

    return this.prisma.birthPlan.findUnique({
      where: { pregnancyId: pregnancy.id },
    });
  }

  async deleteBirthPlan(userId: string) {
    const pregnancy = await this.ensurePregnancy(userId);

    return this.prisma.birthPlan.delete({
      where: { pregnancyId: pregnancy.id },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Hospital Bag Checklist
  // ─────────────────────────────────────────────────────────────

  async addHospitalBagItem(
    userId: string,
    data: {
      category: string;
      itemName: string;
      sortOrder?: number;
    },
  ) {
    const pregnancy = await this.ensurePregnancy(userId);

    return this.prisma.hospitalBagItem.create({
      data: {
        pregnancyId: pregnancy.id,
        category: data.category,
        itemName: data.itemName,
        sortOrder: data.sortOrder || 0,
      },
    });
  }

  async getHospitalBagItems(userId: string) {
    const pregnancy = await this.ensurePregnancy(userId);

    return this.prisma.hospitalBagItem.findMany({
      where: { pregnancyId: pregnancy.id },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  async updateHospitalBagItem(
    userId: string,
    itemId: string,
    data: {
      isPacked?: boolean;
      itemName?: string;
      sortOrder?: number;
    },
  ) {
    const pregnancy = await this.ensurePregnancy(userId);

    return this.prisma.hospitalBagItem.update({
      where: {
        id: itemId,
        pregnancyId: pregnancy.id,
      },
      data: {
        ...(data.isPacked !== undefined && { isPacked: data.isPacked }),
        ...(data.itemName !== undefined && { itemName: data.itemName }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      },
    });
  }

  async deleteHospitalBagItem(userId: string, itemId: string) {
    const pregnancy = await this.ensurePregnancy(userId);

    return this.prisma.hospitalBagItem.delete({
      where: {
        id: itemId,
        pregnancyId: pregnancy.id,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Notes
  // ─────────────────────────────────────────────────────────────

  async createNote(
    userId: string,
    data: {
      title?: string;
      content: string;
      tags?: string[];
    },
  ) {
    const pregnancy = await this.ensurePregnancy(userId);

    return this.prisma.pregnancyNote.create({
      data: {
        pregnancyId: pregnancy.id,
        title: data.title,
        content: data.content,
        tags: data.tags || [],
      },
    });
  }

  async getNotes(userId: string) {
    const pregnancy = await this.ensurePregnancy(userId);

    return this.prisma.pregnancyNote.findMany({
      where: { pregnancyId: pregnancy.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getNote(userId: string, noteId: string) {
    const pregnancy = await this.ensurePregnancy(userId);

    return this.prisma.pregnancyNote.findFirst({
      where: {
        id: noteId,
        pregnancyId: pregnancy.id,
      },
    });
  }

  async updateNote(
    userId: string,
    noteId: string,
    data: {
      title?: string;
      content?: string;
      tags?: string[];
    },
  ) {
    const pregnancy = await this.ensurePregnancy(userId);

    return this.prisma.pregnancyNote.update({
      where: {
        id: noteId,
        pregnancyId: pregnancy.id,
      },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.content !== undefined && { content: data.content }),
        ...(data.tags !== undefined && { tags: data.tags }),
      },
    });
  }

  async deleteNote(userId: string, noteId: string) {
    const pregnancy = await this.ensurePregnancy(userId);

    return this.prisma.pregnancyNote.delete({
      where: {
        id: noteId,
        pregnancyId: pregnancy.id,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Weekly Content
  // ─────────────────────────────────────────────────────────────

  async getWeeklyContent(userId: string) {
    const pregnancy = await this.getPregnancy(userId);

    if (!pregnancy || !pregnancy.weekCache) {
      return null;
    }

    const week = pregnancy.weekCache;
    return {
      week,
      trimester: pregnancy.trimester,
      content: this.getWeeklyTip(week),
      developmentSummary: this.getDevelopmentSummary(week),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Helper Methods
  // ─────────────────────────────────────────────────────────────

  private async ensurePregnancy(userId: string) {
    const pregnancy = await this.prisma.pregnancy.findUnique({
      where: { userId },
    });

    if (!pregnancy) {
      throw new NotFoundException('Pregnancy record not found');
    }

    return pregnancy;
  }

  private getElapsedDaysFromLMP(lmpDate: Date): number {
    const MS_PER_DAY = 1000 * 60 * 60 * 24;
    const now = new Date();
    const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const lmp = new Date(lmpDate);
    const lmpUtc = Date.UTC(lmp.getUTCFullYear(), lmp.getUTCMonth(), lmp.getUTCDate());
    return Math.max(0, Math.round((todayUtc - lmpUtc) / MS_PER_DAY));
  }

  private calculateWeeksFromLMP(lmpDate: Date): number {
    return Math.floor(this.getElapsedDaysFromLMP(lmpDate) / 7);
  }

  private calculateDaysInWeek(lmpDate: Date): number {
    return this.getElapsedDaysFromLMP(lmpDate) % 7;
  }

  private calculateTrimester(weeks: number): number {
    if (weeks <= 13) return 1;
    if (weeks <= 26) return 2;
    return 3;
  }

  private getWeeklyTip(week: number): string {
    // Turkish tips for each week (sample implementation)
    const tips: Record<number, string> = {
      4: 'Bu hafta embriyonuz çok küçük, ancak hızla gelişiyor.',
      5: 'Bebek kalp atışları başladı! İlk ultrason muayeneniz için doktorunuza başvurabilirsiniz.',
      6: 'Bebeğiniz şimdi bir bezelye tanesi kadar büyüklükte.',
      8: 'Bebeğiniz artık tüm temel organları oluştu ve hızla büyüyor.',
      12: 'İlk trimester sonuna yaklaşıyorsunuz! Mide bulantısı azalmaya başlayabilir.',
      16: 'İkinci trimester başladı. Enerji seviyeniz artabilir.',
      20: 'Bebeğinizin hareketlerini hissetmeye başlayabilirsiniz.',
      24: 'Bebeğiniz seslerinizi duyabilir ve yanıt verebilir.',
      28: 'Üçüncü trimester başladı! Bebeğiniz hızla kilo alıyor.',
      32: 'Bebeğiniz düzenli bir uyku döngüsüne girebilir.',
      36: 'Doğum yaklaşıyor! Hastane çantanızı hazırlamaya başlayabilirsiniz.',
      40: 'Doğum haftanız! Bebeğinizle tanışmaya hazır olun.',
    };

    // Find closest week tip
    const availableWeeks = Object.keys(tips)
      .map(Number)
      .sort((a, b) => a - b);
    const closestWeek =
      availableWeeks.find((w) => w >= week) || availableWeeks[availableWeeks.length - 1];

    return tips[closestWeek] || 'Hamilelik yolculuğunuzda her gün özel!';
  }

  private getDevelopmentSummary(week: number): string {
    // Development milestones by trimester
    if (week <= 13) {
      return 'İlk trimester: Tüm temel organlar oluşuyor.';
    } else if (week <= 26) {
      return 'İkinci trimester: Hızlı büyüme ve hareket dönemi.';
    } else {
      return 'Üçüncü trimester: Bebek doğuma hazırlanıyor.';
    }
  }
}
