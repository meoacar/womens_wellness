import {
    BadRequestException,
    ConflictException,
    Injectable,
    Logger,
    NotFoundException,
    OnModuleInit,
} from '@nestjs/common';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_LEGAL_PAGES, SLUG_ALIAS_MAP } from './pages.defaults';

export class CreatePageDto {
    @IsString()
    @IsNotEmpty({ message: 'Slug gereklidir' })
    @MaxLength(160)
    slug!: string;

    @IsString()
    @IsNotEmpty({ message: 'Türkçe başlık gereklidir' })
    @MaxLength(255)
    titleTr!: string;

    @IsOptional()
    @IsString()
    @MaxLength(255)
    titleEn?: string;

    @IsString()
    @IsNotEmpty({ message: 'Türkçe içerik gereklidir' })
    contentTr!: string;

    @IsOptional()
    @IsString()
    contentEn?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    @IsInt()
    @Min(0)
    sortOrder?: number;
}

export class UpdatePageDto {
    @IsOptional()
    @IsString()
    @IsNotEmpty({ message: 'Slug boş olamaz' })
    @MaxLength(160)
    slug?: string;

    @IsOptional()
    @IsString()
    @IsNotEmpty({ message: 'Türkçe başlık boş olamaz' })
    @MaxLength(255)
    titleTr?: string;

    @IsOptional()
    @IsString()
    @MaxLength(255)
    titleEn?: string;

    @IsOptional()
    @IsString()
    @IsNotEmpty({ message: 'Türkçe içerik boş olamaz' })
    contentTr?: string;

    @IsOptional()
    @IsString()
    contentEn?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    @IsInt()
    @Min(0)
    sortOrder?: number;
}

@Injectable()
export class PagesService implements OnModuleInit {
    private readonly logger = new Logger(PagesService.name);

    constructor(private prisma: PrismaService) { }

    async onModuleInit() {
        try {
            await this.ensureDefaultLegalPages(false);
        } catch (err) {
            this.logger.warn(`Failed to seed default legal pages on startup: ${(err as Error).message}`);
        }
    }

    async ensureDefaultLegalPages(forceOverwrite = false) {
        const updated: string[] = [];
        for (const def of DEFAULT_LEGAL_PAGES) {
            const existing = await this.prisma.page.findUnique({
                where: { slug: def.slug },
            });

            if (!existing) {
                await this.prisma.page.create({
                    data: {
                        slug: def.slug,
                        titleTr: def.titleTr,
                        titleEn: def.titleEn,
                        contentTr: def.contentTr,
                        contentEn: def.contentEn,
                        isActive: def.isActive,
                        sortOrder: def.sortOrder,
                    },
                });
                updated.push(def.slug);
            } else if (
                forceOverwrite ||
                !existing.contentTr ||
                existing.contentTr.trim().length < 400
            ) {
                await this.prisma.page.update({
                    where: { id: existing.id },
                    data: {
                        titleTr: def.titleTr,
                        titleEn: def.titleEn,
                        contentTr: def.contentTr,
                        contentEn: def.contentEn,
                        isActive: def.isActive,
                        sortOrder: def.sortOrder,
                    },
                });
                updated.push(def.slug);
            }
        }
        return { updated };
    }

    getTemplates() {
        return DEFAULT_LEGAL_PAGES;
    }

    async restoreDefaultBySlug(slug: string) {
        if (slug === 'ALL') {
            return this.ensureDefaultLegalPages(true);
        }
        const canonical = SLUG_ALIAS_MAP[slug] || slug;
        const def = DEFAULT_LEGAL_PAGES.find((d) => d.slug === canonical);
        if (!def) {
            throw new NotFoundException(`No default template found for slug "${slug}"`);
        }
        const page = await this.prisma.page.upsert({
            where: { slug: def.slug },
            update: {
                titleTr: def.titleTr,
                titleEn: def.titleEn,
                contentTr: def.contentTr,
                contentEn: def.contentEn,
                isActive: def.isActive,
                sortOrder: def.sortOrder,
            },
            create: {
                slug: def.slug,
                titleTr: def.titleTr,
                titleEn: def.titleEn,
                contentTr: def.contentTr,
                contentEn: def.contentEn,
                isActive: def.isActive,
                sortOrder: def.sortOrder,
            },
        });
        return page;
    }

    async findAll(isActive?: boolean) {
        return this.prisma.page.findMany({
            where: isActive !== undefined ? { isActive } : undefined,
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        });
    }

    async findBySlug(slug: string) {
        const normalized = (slug || '').trim().toLowerCase();
        // 1. Try exact slug match first
        let page = await this.prisma.page.findUnique({
            where: { slug: normalized },
        });

        // 2. Fall back to canonical alias (e.g. privacy-policy -> gizlilik-politikasi)
        if (!page && SLUG_ALIAS_MAP[normalized]) {
            page = await this.prisma.page.findUnique({
                where: { slug: SLUG_ALIAS_MAP[normalized] },
            });
        }

        if (!page) {
            throw new NotFoundException(`Page with slug "${slug}" not found`);
        }

        return page;
    }

    async findById(id: string) {
        const page = await this.prisma.page.findUnique({
            where: { id },
        });

        if (!page) {
            throw new NotFoundException(`Page with id "${id}" not found`);
        }

        return page;
    }

    private normalizeSlug(rawSlug: string): string {
        const normalized = (rawSlug || '').trim().toLowerCase();
        if (!normalized) {
            throw new BadRequestException('Slug alanı boş bırakılamaz.');
        }
        return normalized;
    }

    private async ensureSlugAvailable(slug: string, excludeId?: string) {
        const existing = await this.prisma.page.findUnique({
            where: { slug },
            select: { id: true },
        });
        if (existing && existing.id !== excludeId) {
            throw new ConflictException(
                `Bu slug ("${slug}") zaten başka bir sayfada kullanılıyor.`,
            );
        }
    }

    private isUniqueSlugError(err: any): boolean {
        return err?.code === 'P2002';
    }

    async create(data: CreatePageDto) {
        const slug = this.normalizeSlug(data.slug);
        await this.ensureSlugAvailable(slug);

        try {
            return await this.prisma.page.create({
                data: {
                    slug,
                    titleTr: data.titleTr,
                    titleEn: data.titleEn,
                    contentTr: data.contentTr,
                    contentEn: data.contentEn,
                    isActive: data.isActive ?? true,
                    sortOrder: data.sortOrder ?? 0,
                },
            });
        } catch (err) {
            if (this.isUniqueSlugError(err)) {
                throw new ConflictException(
                    `Bu slug ("${slug}") zaten başka bir sayfada kullanılıyor.`,
                );
            }
            throw err;
        }
    }

    async update(id: string, data: UpdatePageDto) {
        await this.findById(id);

        const updateData: Record<string, any> = {};
        if (data.slug !== undefined) {
            const slug = this.normalizeSlug(data.slug);
            await this.ensureSlugAvailable(slug, id);
            updateData.slug = slug;
        }
        if (data.titleTr !== undefined) updateData.titleTr = data.titleTr;
        if (data.titleEn !== undefined) updateData.titleEn = data.titleEn;
        if (data.contentTr !== undefined) updateData.contentTr = data.contentTr;
        if (data.contentEn !== undefined) updateData.contentEn = data.contentEn;
        if (data.isActive !== undefined) updateData.isActive = data.isActive;
        if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

        try {
            return await this.prisma.page.update({
                where: { id },
                data: updateData,
            });
        } catch (err) {
            if (this.isUniqueSlugError(err)) {
                throw new ConflictException(
                    `Bu slug ("${updateData.slug}") zaten başka bir sayfada kullanılıyor.`,
                );
            }
            throw err;
        }
    }

    async delete(id: string) {
        await this.findById(id);

        return this.prisma.page.delete({
            where: { id },
        });
    }
}
