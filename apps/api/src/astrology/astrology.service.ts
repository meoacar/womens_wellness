import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

export interface BirthChartInput {
    birthDate: string; // ISO date string
    birthTime: string; // HH:MM format
    city: string; // City name
}

export interface BirthChartResult {
    sunSign: string;
    risingSign: string;
    moonSign: string;
    sunDegree: number;
    risingDegree: number;
    moonDegree: number;
    birthDate?: Date | string;
    birthTime?: string;
    city?: string;
    source?: 'ephemeris' | 'astronomical-fallback';
}

export interface HoroscopeUpsertInput {
    sign: string;
    period: string;
    title?: string;
    summary: string;
    loveText?: string;
    careerText?: string;
    healthText?: string;
    loveScore?: number;
    careerScore?: number;
    healthScore?: number;
    energyScore?: number;
    luckyNumber?: number;
    luckyColor?: string;
    luckyStone?: string;
    affirmation?: string;
    isActive?: boolean;
}

export interface CosmicOverviewInput {
    moonPhase: string;
    moonSign: string;
    cosmicTheme: string;
    retrogradeNote?: string;
    dailyAffirmation: string;
    energyIndex: number;
    isActive?: boolean;
}

const ELEMENT_MAP: Record<string, 'fire' | 'earth' | 'air' | 'water'> = {
    aries: 'fire',
    leo: 'fire',
    sagittarius: 'fire',
    taurus: 'earth',
    virgo: 'earth',
    capricorn: 'earth',
    gemini: 'air',
    libra: 'air',
    aquarius: 'air',
    cancer: 'water',
    scorpio: 'water',
    pisces: 'water',
};

const MODALITY_MAP: Record<string, 'cardinal' | 'fixed' | 'mutable'> = {
    aries: 'cardinal',
    cancer: 'cardinal',
    libra: 'cardinal',
    capricorn: 'cardinal',
    taurus: 'fixed',
    leo: 'fixed',
    scorpio: 'fixed',
    aquarius: 'fixed',
    gemini: 'mutable',
    virgo: 'mutable',
    sagittarius: 'mutable',
    pisces: 'mutable',
};

@Injectable()
export class AstrologyService {
    private readonly logger = new Logger(AstrologyService.name);

    private readonly zodiacSigns = [
        'aries', 'taurus', 'gemini', 'cancer',
        'leo', 'virgo', 'libra', 'scorpio',
        'sagittarius', 'capricorn', 'aquarius', 'pisces',
    ];

    constructor(private readonly prisma: PrismaService) { }

    // ────────────────────────────────────────────────────────────────────────────
    // Horoscopes & Cosmic Sky (User-facing)
    // ────────────────────────────────────────────────────────────────────────────

    async getCosmicOverview() {
        const current = await this.prisma.cosmicOverview.findUnique({
            where: { key: 'current' },
        });

        if (current && current.isActive) {
            return current;
        }

        return {
            key: 'current',
            moonPhase: 'İlk Dördün',
            moonSign: 'Balık',
            cosmicTheme: 'Sezgisel Dengelenme ve Nazik Başlangıçlar',
            retrogradeNote: 'Gökyüzü enerjisi net ve akıcı; iç sesinizi dinlemek için güzel bir gün.',
            dailyAffirmation: 'Bedenimin ritmine kulak veriyor, bugünü huzurla kucaklıyorum.',
            energyIndex: 84,
            isActive: true,
        };
    }

    async getHoroscopes(period: string = 'daily', sign?: string) {
        const where: any = {
            period,
            isActive: true,
        };
        if (sign) {
            where.sign = sign.toLowerCase();
        }

        const entries = await this.prisma.horoscopeEntry.findMany({
            where,
            orderBy: { sign: 'asc' },
        });

        if (sign) {
            return entries[0] || null;
        }
        return entries;
    }

    async getSignHoroscopes(sign: string) {
        const normalized = sign.toLowerCase();
        if (!this.zodiacSigns.includes(normalized)) {
            throw new BadRequestException('Geçersiz burç');
        }

        const entries = await this.prisma.horoscopeEntry.findMany({
            where: {
                sign: normalized,
                isActive: true,
            },
        });

        return {
            sign: normalized,
            daily: entries.find((e) => e.period === 'daily') || null,
            weekly: entries.find((e) => e.period === 'weekly') || null,
            monthly: entries.find((e) => e.period === 'monthly') || null,
        };
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Birth Chart (Microservice + Astronomical Fallback + Persistence)
    // ────────────────────────────────────────────────────────────────────────────

    async getMyBirthChart(userId: string) {
        return this.prisma.birthChartProfile.findUnique({
            where: { userId },
        });
    }

    private extractBirthDateParts(
        birthDate: string | Date,
        timeZone = 'Europe/Istanbul',
    ): { year: number; month: number; day: number } {
        if (typeof birthDate === 'string') {
            const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate.trim());
            if (dateOnlyMatch) {
                return {
                    year: Number(dateOnlyMatch[1]),
                    month: Number(dateOnlyMatch[2]),
                    day: Number(dateOnlyMatch[3]),
                };
            }
        }

        const date = birthDate instanceof Date ? birthDate : new Date(birthDate);
        if (isNaN(date.getTime())) {
            const now = new Date();
            return {
                year: now.getUTCFullYear(),
                month: now.getUTCMonth() + 1,
                day: now.getUTCDate(),
            };
        }

        // If stored at UTC noon (safe normalized date), UTC parts are unambiguous worldwide
        const utcHour = date.getUTCHours();
        if (utcHour >= 6 && utcHour <= 18) {
            return {
                year: date.getUTCFullYear(),
                month: date.getUTCMonth() + 1,
                day: date.getUTCDate(),
            };
        }

        // Otherwise interpret midnight-ish ISO timestamps in the user's local timezone
        try {
            const formatted = new Intl.DateTimeFormat('en-CA', {
                timeZone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
            }).format(date);
            const [y, m, d] = formatted.split('-').map(Number);
            if (y && m && d) {
                return { year: y, month: m, day: d };
            }
        } catch {
            // Fallback below
        }

        return {
            year: date.getUTCFullYear(),
            month: date.getUTCMonth() + 1,
            day: date.getUTCDate(),
        };
    }

    async calculateBirthChart(userId: string, input: BirthChartInput): Promise<BirthChartResult> {
        const { birthDate, birthTime, city } = input;
        const parts = this.extractBirthDateParts(birthDate);
        const normalizedBirthDateStr = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
        let result: BirthChartResult;

        try {
            const pythonServiceUrl = process.env.ASTROLOGY_SERVICE_URL || 'http://localhost:5001';
            const response = await axios.post(
                `${pythonServiceUrl}/calculate-birth-chart`,
                { birthDate: normalizedBirthDateStr, birthTime, city },
                { timeout: 3000 },
            );

            const data = response.data;
            result = {
                sunSign: data.sunSign,
                risingSign: data.risingSign,
                moonSign: data.moonSign,
                sunDegree: Math.round((data.sunDegree || 0) * 10) / 10,
                risingDegree: Math.round((data.risingDegree || 0) * 10) / 10,
                moonDegree: Math.round((data.moonDegree || 0) * 10) / 10,
                source: 'ephemeris',
            };
        } catch (error: any) {
            this.logger.warn(
                `Python astrology microservice unreachable (${error?.message}), using astronomical calculation fallback`,
            );
            result = this.calculateAstronomicalFallback(normalizedBirthDateStr, birthTime, city);
        }

        // Persist user's birth chart profile at UTC noon so calendar day never shifts across timezones
        if (userId) {
            const parsedDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0));
            if (!isNaN(parsedDate.getTime())) {
                await this.prisma.birthChartProfile.upsert({
                    where: { userId },
                    update: {
                        birthDate: parsedDate,
                        birthTime,
                        city: city.trim(),
                        sunSign: result.sunSign,
                        moonSign: result.moonSign,
                        risingSign: result.risingSign,
                        sunDegree: result.sunDegree,
                        moonDegree: result.moonDegree,
                        risingDegree: result.risingDegree,
                    },
                    create: {
                        userId,
                        birthDate: parsedDate,
                        birthTime,
                        city: city.trim(),
                        sunSign: result.sunSign,
                        moonSign: result.moonSign,
                        risingSign: result.risingSign,
                        sunDegree: result.sunDegree,
                        moonDegree: result.moonDegree,
                        risingDegree: result.risingDegree,
                    },
                });
            }
        }

        return {
            ...result,
            birthDate: normalizedBirthDateStr,
            birthTime,
            city: city.trim(),
        };
    }

    private calculateAstronomicalFallback(
        birthDate: string,
        birthTime: string,
        city: string,
    ): BirthChartResult {
        const { year, month, day } = this.extractBirthDateParts(birthDate);
        const [hourStr = '12', minStr = '0'] = (birthTime || '12:00').split(':');
        const hours = Math.min(23, Math.max(0, parseInt(hourStr, 10) || 12));
        const minutes = Math.min(59, Math.max(0, parseInt(minStr, 10) || 0));

        // Ecliptic longitude approximation relative to Aries 0° (approx March 21)
        const refUtc = Date.UTC(year, 2, 21, 0, 0, 0);
        const targetUtc = Date.UTC(year, month - 1, day, hours, minutes, 0);
        let daysSinceEquinox = (targetUtc - refUtc) / (1000 * 60 * 60 * 24);
        if (daysSinceEquinox < 0) daysSinceEquinox += 365.2422;

        const sunLongitude = ((daysSinceEquinox / 365.2422) * 360) % 360;
        const sunDegree = Math.round((sunLongitude % 30) * 10) / 10;

        // Sidereal Moon position from J2000 reference (2000-01-01 Moon ~ 218.3°)
        const j2000 = Date.UTC(2000, 0, 1, 12, 0, 0);
        const daysSinceJ2000 = (targetUtc - j2000) / (1000 * 60 * 60 * 24);
        const moonLongitude = ((218.316 + 13.176396 * daysSinceJ2000) % 360 + 360) % 360;
        const moonIndex = Math.floor(moonLongitude / 30) % 12;
        const moonDegree = Math.round((moonLongitude % 30) * 10) / 10;

        // Ascendant shifts roughly 360° every 24h (~15°/hour) relative to Sun at ~6 AM sunrise
        const cityOffsetDeg = (city.trim().length % 7) * 1.4;
        const hoursFromSunrise = hours + minutes / 60 - 6;
        const risingLongitude = ((sunLongitude + hoursFromSunrise * 15 + cityOffsetDeg) % 360 + 360) % 360;
        const risingIndex = Math.floor(risingLongitude / 30) % 12;
        const risingDegree = Math.round((risingLongitude % 30) * 10) / 10;

        const sunSign = this.getSimpleSunSign(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);

        return {
            sunSign,
            moonSign: this.zodiacSigns[moonIndex],
            risingSign: this.zodiacSigns[risingIndex],
            sunDegree,
            moonDegree,
            risingDegree,
            source: 'astronomical-fallback',
        };
    }

    calculateCompatibility(sign1Raw: string, sign2Raw: string) {
        const sign1 = sign1Raw.toLowerCase();
        const sign2 = sign2Raw.toLowerCase();

        if (!this.zodiacSigns.includes(sign1) || !this.zodiacSigns.includes(sign2)) {
            throw new BadRequestException('Geçersiz burç seçimi');
        }

        const el1 = ELEMENT_MAP[sign1];
        const el2 = ELEMENT_MAP[sign2];
        const mod1 = MODALITY_MAP[sign1];
        const mod2 = MODALITY_MAP[sign2];

        const idx1 = this.zodiacSigns.indexOf(sign1);
        const idx2 = this.zodiacSigns.indexOf(sign2);
        const distance = Math.min(Math.abs(idx1 - idx2), 12 - Math.abs(idx1 - idx2));

        let baseScore = 66;
        if (sign1 === sign2) baseScore = 84;
        else if (el1 === el2) baseScore = 90;
        else if (
            (el1 === 'fire' && el2 === 'air') ||
            (el1 === 'air' && el2 === 'fire') ||
            (el1 === 'water' && el2 === 'earth') ||
            (el1 === 'earth' && el2 === 'water')
        ) {
            baseScore = 82;
        } else if (distance === 6) {
            // Opposite signs: magnetic attraction
            baseScore = 76;
        } else if (distance === 3) {
            // Square aspect: intense growth
            baseScore = 62;
        }

        const loveScore = Math.min(98, Math.max(48, baseScore + (distance === 4 || distance === 6 ? 6 : 2)));
        const communicationScore = Math.min(
            98,
            Math.max(48, baseScore + (el1 === 'air' || el2 === 'air' || mod1 !== mod2 ? 5 : -3)),
        );
        const trustScore = Math.min(
            98,
            Math.max(48, baseScore + (el1 === 'earth' || el2 === 'earth' || el1 === 'water' ? 4 : -2)),
        );
        const overallScore = Math.round((loveScore + communicationScore + trustScore) / 3);

        let headline = 'Dengeli ve Geliştirici Bir Bağ';
        let advice =
            'Farklı bakış açılarınızı merakla dinlediğinizde birbirinizi harika tamamlayabilirsiniz.';

        if (overallScore >= 85) {
            headline = 'Doğal Kozmik Uyum';
            advice =
                'Elementleriniz birbirini zahmetsizce besliyor. Ortak hayaller kurmak ve spontane anlar yaratmak ilişkinizi parlatır.';
        } else if (overallScore >= 75) {
            headline = 'Çekim ve Tamamlayıcı Enerji';
            advice =
                'Birinizin güçlü yönü diğerinin eksikliğini zarifçe dengeliyor. Açık iletişim bağı çok daha sağlam kılar.';
        } else if (overallScore < 65) {
            headline = 'Öğretici ve Dönüştürücü İlişki';
            advice =
                'Farklı ritimler sabır gerektirir ancak birbirinize empati ve sınır anlayışıyla yaklaştığınızda güçlü bir büyüme yaşarsınız.';
        }

        return {
            sign1,
            sign2,
            overallScore,
            loveScore,
            communicationScore,
            trustScore,
            headline,
            advice,
        };
    }

    /**
     * Simple sun sign calculation
     */
    getSimpleSunSign(birthDate: string, timeZone = 'Europe/Istanbul'): string {
        const { month, day } = this.extractBirthDateParts(birthDate, timeZone);

        if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return 'aries';
        if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return 'taurus';
        if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return 'gemini';
        if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return 'cancer';
        if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return 'leo';
        if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return 'virgo';
        if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return 'libra';
        if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return 'scorpio';
        if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return 'sagittarius';
        if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return 'capricorn';
        if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return 'aquarius';
        return 'pisces';
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Admin Management Methods
    // ────────────────────────────────────────────────────────────────────────────

    async adminListHoroscopes(params: {
        sign?: string;
        period?: string;
        search?: string;
        isActive?: string;
        page?: number;
        limit?: number;
    }) {
        const page = Math.max(1, Number(params.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
        const skip = (page - 1) * limit;

        const where: any = {};
        if (params.sign) where.sign = params.sign.toLowerCase();
        if (params.period) where.period = params.period;
        if (params.isActive !== undefined && params.isActive !== '') {
            where.isActive = params.isActive === 'true';
        }
        if (params.search?.trim()) {
            where.OR = [
                { title: { contains: params.search.trim(), mode: 'insensitive' } },
                { summary: { contains: params.search.trim(), mode: 'insensitive' } },
                { luckyColor: { contains: params.search.trim(), mode: 'insensitive' } },
            ];
        }

        const [data, total] = await Promise.all([
            this.prisma.horoscopeEntry.findMany({
                where,
                skip,
                take: limit,
                orderBy: [{ period: 'asc' }, { sign: 'asc' }],
            }),
            this.prisma.horoscopeEntry.count({ where }),
        ]);

        return { data, total, page, limit };
    }

    async adminGetHoroscope(id: string) {
        const entry = await this.prisma.horoscopeEntry.findUnique({ where: { id } });
        if (!entry) {
            throw new NotFoundException('Burç yorumu bulunamadı');
        }
        return entry;
    }

    async adminUpsertHoroscope(dto: HoroscopeUpsertInput) {
        const sign = dto.sign.toLowerCase();
        if (!this.zodiacSigns.includes(sign)) {
            throw new BadRequestException('Geçersiz burç');
        }
        if (!['daily', 'weekly', 'monthly'].includes(dto.period)) {
            throw new BadRequestException('Geçersiz dönem (daily, weekly, monthly)');
        }

        return this.prisma.horoscopeEntry.upsert({
            where: { sign_period: { sign, period: dto.period } },
            update: {
                title: dto.title,
                summary: dto.summary,
                loveText: dto.loveText,
                careerText: dto.careerText,
                healthText: dto.healthText,
                loveScore: dto.loveScore ?? 4,
                careerScore: dto.careerScore ?? 4,
                healthScore: dto.healthScore ?? 4,
                energyScore: dto.energyScore ?? 82,
                luckyNumber: dto.luckyNumber ?? 7,
                luckyColor: dto.luckyColor || 'Gül Kurusu',
                luckyStone: dto.luckyStone,
                affirmation: dto.affirmation,
                isActive: dto.isActive ?? true,
            },
            create: {
                sign,
                period: dto.period,
                title: dto.title,
                summary: dto.summary,
                loveText: dto.loveText,
                careerText: dto.careerText,
                healthText: dto.healthText,
                loveScore: dto.loveScore ?? 4,
                careerScore: dto.careerScore ?? 4,
                healthScore: dto.healthScore ?? 4,
                energyScore: dto.energyScore ?? 82,
                luckyNumber: dto.luckyNumber ?? 7,
                luckyColor: dto.luckyColor || 'Gül Kurusu',
                luckyStone: dto.luckyStone,
                affirmation: dto.affirmation,
                isActive: dto.isActive ?? true,
            },
        });
    }

    async adminUpdateHoroscope(id: string, dto: Partial<HoroscopeUpsertInput>) {
        const existing = await this.prisma.horoscopeEntry.findUnique({ where: { id } });
        if (!existing) {
            throw new NotFoundException('Burç yorumu bulunamadı');
        }

        return this.prisma.horoscopeEntry.update({
            where: { id },
            data: {
                ...(dto.sign !== undefined && { sign: dto.sign.toLowerCase() }),
                ...(dto.period !== undefined && { period: dto.period }),
                ...(dto.title !== undefined && { title: dto.title }),
                ...(dto.summary !== undefined && { summary: dto.summary }),
                ...(dto.loveText !== undefined && { loveText: dto.loveText }),
                ...(dto.careerText !== undefined && { careerText: dto.careerText }),
                ...(dto.healthText !== undefined && { healthText: dto.healthText }),
                ...(dto.loveScore !== undefined && { loveScore: dto.loveScore }),
                ...(dto.careerScore !== undefined && { careerScore: dto.careerScore }),
                ...(dto.healthScore !== undefined && { healthScore: dto.healthScore }),
                ...(dto.energyScore !== undefined && { energyScore: dto.energyScore }),
                ...(dto.luckyNumber !== undefined && { luckyNumber: dto.luckyNumber }),
                ...(dto.luckyColor !== undefined && { luckyColor: dto.luckyColor }),
                ...(dto.luckyStone !== undefined && { luckyStone: dto.luckyStone }),
                ...(dto.affirmation !== undefined && { affirmation: dto.affirmation }),
                ...(dto.isActive !== undefined && { isActive: dto.isActive }),
            },
        });
    }

    async adminDeleteHoroscope(id: string) {
        const existing = await this.prisma.horoscopeEntry.findUnique({ where: { id } });
        if (!existing) {
            throw new NotFoundException('Burç yorumu bulunamadı');
        }
        await this.prisma.horoscopeEntry.delete({ where: { id } });
        return { success: true };
    }

    async adminGetCosmicOverview() {
        return this.getCosmicOverview();
    }

    async adminUpdateCosmicOverview(dto: CosmicOverviewInput) {
        return this.prisma.cosmicOverview.upsert({
            where: { key: 'current' },
            update: {
                moonPhase: dto.moonPhase,
                moonSign: dto.moonSign,
                cosmicTheme: dto.cosmicTheme,
                retrogradeNote: dto.retrogradeNote,
                dailyAffirmation: dto.dailyAffirmation,
                energyIndex: dto.energyIndex,
                isActive: dto.isActive ?? true,
            },
            create: {
                key: 'current',
                moonPhase: dto.moonPhase,
                moonSign: dto.moonSign,
                cosmicTheme: dto.cosmicTheme,
                retrogradeNote: dto.retrogradeNote,
                dailyAffirmation: dto.dailyAffirmation,
                energyIndex: dto.energyIndex,
                isActive: dto.isActive ?? true,
            },
        });
    }

    async adminGetStats() {
        const [totalHoroscopes, activeHoroscopes, savedBirthCharts, distinctSigns] =
            await Promise.all([
                this.prisma.horoscopeEntry.count(),
                this.prisma.horoscopeEntry.count({ where: { isActive: true } }),
                this.prisma.birthChartProfile.count(),
                this.prisma.horoscopeEntry.groupBy({
                    by: ['sign'],
                    where: { isActive: true },
                }),
            ]);

        return {
            totalHoroscopes,
            activeHoroscopes,
            coveredSigns: distinctSigns.length,
            savedBirthCharts,
        };
    }
}
