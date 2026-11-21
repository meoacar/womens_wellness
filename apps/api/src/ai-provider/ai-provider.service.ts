import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AIProvider } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { generateText } from 'ai';
import { createOpenAI, openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { PrismaService } from '../prisma/prisma.service';

export class CreateAIProviderDto {
    @IsEnum(AIProvider, { message: 'Geçersiz AI sağlayıcı' })
    provider!: AIProvider;

    @IsString()
    @IsNotEmpty({ message: 'API anahtarı gereklidir' })
    apiKey!: string;

    @IsString()
    @IsNotEmpty({ message: 'Model adı gereklidir' })
    modelName!: string;

    @IsString()
    @IsNotEmpty({ message: 'Görünen ad gereklidir' })
    displayName!: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(1000)
    priority?: number;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class UpdateAIProviderDto {
    @IsOptional()
    @IsString()
    apiKey?: string;

    @IsOptional()
    @IsString()
    @IsNotEmpty({ message: 'Model adı boş olamaz' })
    modelName?: string;

    @IsOptional()
    @IsString()
    @IsNotEmpty({ message: 'Görünen ad boş olamaz' })
    displayName?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(1000)
    priority?: number;
}

@Injectable()
export class AIProviderService {
    private readonly logger = new Logger(AIProviderService.name);

    constructor(private readonly prisma: PrismaService) { }

    async getAll() {
        return this.prisma.aIProviderConfig.findMany({
            orderBy: { priority: 'desc' },
        });
    }

    async getActive() {
        return this.prisma.aIProviderConfig.findMany({
            where: { isActive: true },
            orderBy: { priority: 'desc' },
        });
    }

    async getByProvider(provider: AIProvider) {
        return this.prisma.aIProviderConfig.findUnique({
            where: { provider },
        });
    }

    async getActiveProvider(): Promise<{
        provider: AIProvider;
        apiKey: string;
        modelName: string;
    } | null> {
        const config = await this.prisma.aIProviderConfig.findFirst({
            where: { isActive: true },
            orderBy: { priority: 'desc' },
        });

        if (!config) {
            this.logger.warn('No active AI provider found');
            return null;
        }

        return {
            provider: config.provider,
            apiKey: config.apiKey,
            modelName: config.modelName,
        };
    }

    async create(data: CreateAIProviderDto) {
        const existing = await this.getByProvider(data.provider);
        if (existing) {
            throw new BadRequestException(
                `"${data.provider}" sağlayıcısı zaten kayıtlı. Düzenle ekranından güncelleyebilirsiniz.`,
            );
        }

        return this.prisma.aIProviderConfig.create({
            data: {
                provider: data.provider,
                apiKey: data.apiKey?.trim(),
                modelName: data.modelName,
                displayName: data.displayName,
                description: data.description,
                priority: data.priority ?? 0,
                isActive: data.isActive ?? true,
            },
        });
    }

    async update(provider: AIProvider, data: UpdateAIProviderDto) {
        const existing = await this.getByProvider(provider);
        if (!existing) {
            throw new NotFoundException(`AI sağlayıcı bulunamadı: ${provider}`);
        }

        const updateData: UpdateAIProviderDto = {
            modelName: data.modelName,
            displayName: data.displayName,
            description: data.description,
            isActive: data.isActive,
            priority: data.priority,
        };

        // Preserve existing real key if form submitted masked placeholder or empty value
        const trimmedKey = data.apiKey?.trim();
        if (trimmedKey && !trimmedKey.includes('...') && trimmedKey !== '***') {
            updateData.apiKey = trimmedKey;
        }

        return this.prisma.aIProviderConfig.update({
            where: { provider },
            data: updateData,
        });
    }

    async delete(provider: AIProvider) {
        return this.prisma.aIProviderConfig.delete({
            where: { provider },
        });
    }

    async toggleActive(provider: AIProvider) {
        const config = await this.getByProvider(provider);
        if (!config) {
            throw new NotFoundException('Provider not found');
        }

        return this.prisma.aIProviderConfig.update({
            where: { provider },
            data: { isActive: !config.isActive },
        });
    }

    async getRuntimeStatus() {
        const [providers, policies] = await Promise.all([
            this.prisma.aIProviderConfig.findMany({ orderBy: { priority: 'desc' } }),
            this.prisma.modelPolicy.findMany({ orderBy: { updatedAt: 'desc' } }),
        ]);

        const activeFallback = providers.find((p) => p.isActive) || null;
        const resolvePlan = (plan: 'free' | 'premium') => {
            const policy = policies.find((p) => p.plan === plan) || null;
            if (policy) {
                const matchedProvider = providers.find(
                    (p) => p.provider === policy.provider && p.isActive,
                );
                if (matchedProvider) {
                    return {
                        plan,
                        source: 'model_policy',
                        provider: policy.provider,
                        modelName: policy.modelName,
                        temperature: policy.temperature,
                        maxTokens: policy.maxTokens,
                        warning: null,
                    };
                }
                return {
                    plan,
                    source: activeFallback ? 'active_provider_fallback' : 'env_fallback',
                    provider: activeFallback?.provider || 'google',
                    modelName: activeFallback?.modelName || 'gemini-3.8-flash',
                    temperature: policy.temperature,
                    maxTokens: policy.maxTokens,
                    warning: `Model politikası "${policy.provider}/${policy.modelName}" aktif sağlayıcıda bulunamadı; aktif sağlayıcıya düşüldü.`,
                };
            }
            return {
                plan,
                source: activeFallback ? 'active_provider' : 'env_fallback',
                provider: activeFallback?.provider || 'google',
                modelName: activeFallback?.modelName || 'gemini-3.8-flash',
                temperature: 0.8,
                maxTokens: 1024,
                warning: null,
            };
        };

        return {
            free: resolvePlan('free'),
            premium: resolvePlan('premium'),
            activeProvidersCount: providers.filter((p) => p.isActive).length,
            hasEnvGeminiKey: Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY),
        };
    }

    async testConnection(provider: AIProvider, customPrompt?: string) {
        const config = await this.getByProvider(provider);
        if (!config) {
            throw new NotFoundException(`AI sağlayıcı bulunamadı: ${provider}`);
        }

        let model: any;
        const pStr = provider as string;
        if (pStr === 'google') {
            process.env.GOOGLE_GENERATIVE_AI_API_KEY = config.apiKey;
            model = google(config.modelName);
        } else if (pStr === 'openai') {
            process.env.OPENAI_API_KEY = config.apiKey;
            model = openai(config.modelName);
        } else if (pStr === 'anthropic') {
            process.env.ANTHROPIC_API_KEY = config.apiKey;
            model = anthropic(config.modelName);
        } else if (pStr === 'deepseek') {
            const deepseek = createOpenAI({
                apiKey: config.apiKey,
                baseURL: 'https://api.deepseek.com/v1',
            });
            model = deepseek.chat(config.modelName);
        } else {
            throw new BadRequestException(`Desteklenmeyen sağlayıcı: ${provider}`);
        }

        const start = Date.now();
        try {
            const res = await generateText({
                model,
                prompt: customPrompt?.trim() || 'Reply with OK.',
                maxOutputTokens: customPrompt?.trim() ? 120 : 10,
            });
            return {
                ok: true,
                provider,
                modelName: config.modelName,
                latencyMs: Date.now() - start,
                sample: res.text?.trim() || 'OK',
            };
        } catch (error: any) {
            return {
                ok: false,
                provider,
                modelName: config.modelName,
                latencyMs: Date.now() - start,
                error: error?.message || 'Bağlantı testi başarısız',
            };
        }
    }
}
