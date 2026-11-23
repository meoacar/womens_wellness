import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ModelSelectorService } from './model-selector.service';
import { ContextBuilderService } from './context-builder.service';
import { AIProviderService } from '../ai-provider/ai-provider.service';
import { ModelPolicyService } from '../model-policy/model-policy.service';
import { streamText } from 'ai';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import type { AIProvider } from '@prisma/client';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly modelSelector: ModelSelectorService,
    private readonly contextBuilder: ContextBuilderService,
    private readonly aiProviderService: AIProviderService,
    private readonly modelPolicyService: ModelPolicyService,
  ) { }

  async getOrCreateConversation(userId: string, conversationId?: string) {
    if (conversationId) {
      const conversation = await this.prisma.conversation.findFirst({
        where: {
          id: conversationId,
          userId,
        },
      });
      if (conversation) return conversation;
    }

    // Create new conversation
    return this.prisma.conversation.create({
      data: {
        userId,
        title: 'Yeni Sohbet',
      },
    });
  }

  async saveMessage(
    conversationId: string,
    role: 'user' | 'assistant' | 'tool',
    content: string,
    tokens?: number,
  ) {
    return this.prisma.message.create({
      data: {
        conversationId,
        role,
        content,
        tokens,
      },
    });
  }

  async getConversationHistory(conversationId: string, limit = 20) {
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        role: true,
        content: true,
        createdAt: true,
      },
    });
  }

  async streamResponse(
    userId: string,
    conversationId: string,
    userMessage: string,
    options?: { overrideGoogleModel?: string; abortSignal?: AbortSignal },
  ) {
    // Build user context with health data
    const userContext = await this.contextBuilder.buildUserContext(userId);
    const systemPrompt = this.contextBuilder.buildSystemPrompt(userContext);

    // Get conversation history
    const history = await this.getConversationHistory(conversationId, 10);

    // Build messages array (reverse to get chronological order)
    // Filter out any 'tool' role messages and only include user/assistant
    const messages = [
      ...history.reverse()
        .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
        .map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
      { role: 'user' as const, content: userMessage },
    ];

    // Get user's subscription plan
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    const userPlan = user?.subscription?.status === 'ACTIVE' ? 'premium' : 'free';
    this.logger.log(`User ${userId} has plan: ${userPlan}`);

    // Get model policy for user's plan
    const modelPolicy = await this.modelPolicyService.findByPlan(userPlan);

    let model;
    let activeModelName = '';
    let activeProvider = '';
    let temperature = 0.8;
    let maxTokens = 4096;

    if (options?.overrideGoogleModel) {
      const googleCfg = await this.aiProviderService.getByProvider('google' as AIProvider);
      const apiKey = googleCfg?.apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      if (!apiKey) {
        throw new Error('No Google AI API key configured for fallback');
      }
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = apiKey;
      model = google(options.overrideGoogleModel);
      activeProvider = 'google';
      activeModelName = options.overrideGoogleModel;
      temperature = modelPolicy?.temperature ?? 0.8;
      maxTokens = modelPolicy?.maxTokens ?? 4096;
      this.logger.warn(`Using fallback Google model: ${options.overrideGoogleModel}`);
    } else if (modelPolicy) {
      // Use model policy configuration with automatic active/env fallback
      this.logger.log(`Using model policy: ${modelPolicy.provider}/${modelPolicy.modelName}`);

      const providerConfig = await this.aiProviderService.getByProvider(modelPolicy.provider);
      if (providerConfig && providerConfig.isActive) {
        model = this.getModelFromConfig(
          modelPolicy.provider,
          modelPolicy.modelName,
          providerConfig.apiKey
        );
        activeProvider = String(modelPolicy.provider);
        activeModelName = modelPolicy.modelName;
        temperature = modelPolicy.temperature;
        maxTokens = modelPolicy.maxTokens;
      } else {
        this.logger.warn(
          `Model policy provider "${modelPolicy.provider}" is not active/configured; falling back to active provider.`,
        );
      }
    }

    if (!model) {
      // Fallback to active provider in DB
      const providerConfig = await this.aiProviderService.getActiveProvider();

      if (providerConfig) {
        this.logger.log(`✅ Using active fallback provider: ${providerConfig.provider}, model: ${providerConfig.modelName}`);
        model = this.getModelFromConfig(providerConfig.provider, providerConfig.modelName, providerConfig.apiKey);
        activeProvider = String(providerConfig.provider);
        activeModelName = providerConfig.modelName;
      } else {
        // Final fallback to environment variable
        this.logger.warn('No active provider in database, falling back to env variable');
        const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        if (!apiKey) {
          throw new Error('No AI provider configured');
        }
        process.env.GOOGLE_GENERATIVE_AI_API_KEY = apiKey;
        activeProvider = 'google';
        activeModelName = 'gemini-3-flash-preview';
        model = google(activeModelName);
      }
    }

    // Gemini 2.5 / 3.x thinking models count internal reasoning tokens inside maxOutputTokens,
    // so a 1024-token cap can truncate visible Turkish replies mid-sentence.
    const isThinkingGemini =
      activeProvider === 'google' &&
      (activeModelName.includes('gemini-2.5') || activeModelName.includes('gemini-3'));
    const effectiveMaxTokens = isThinkingGemini ? Math.max(maxTokens, 4096) : maxTokens;

    // Stream the response with system prompt as separate parameter
    const result = streamText({
      model,
      system: systemPrompt,
      messages,
      temperature,
      maxOutputTokens: effectiveMaxTokens,
      abortSignal: options?.abortSignal,
    });

    return result;
  }

  private getModelFromConfig(provider: AIProvider, modelName: string, apiKey: string) {
    // Set API key as environment variable temporarily for the SDK
    // Supported providers: google, openai, anthropic, deepseek
    const providerStr = provider as string;

    switch (providerStr) {
      case 'google':
        process.env.GOOGLE_GENERATIVE_AI_API_KEY = apiKey;
        return google(modelName);
      case 'openai':
        process.env.OPENAI_API_KEY = apiKey;
        return openai(modelName);
      case 'anthropic':
        process.env.ANTHROPIC_API_KEY = apiKey;
        return anthropic(modelName);
      case 'deepseek':
        // DeepSeek uses OpenAI-compatible API
        const deepseek = createOpenAI({
          apiKey,
          baseURL: 'https://api.deepseek.com/v1',
        });
        return deepseek.chat(modelName);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  private getModel(provider: string, modelName: string) {
    switch (provider) {
      case 'openai':
        return openai(modelName);

      case 'anthropic':
        return anthropic(modelName);

      case 'google':
        return google(modelName);

      default:
        // Fallback to OpenAI
        return openai('gpt-4o-mini');
    }
  }

  async getUserConversations(userId: string) {
    return this.prisma.conversation.findMany({
      where: {
        userId,
        archivedAt: null,
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async deleteConversation(userId: string, conversationId: string) {
    // Soft delete by archiving
    return this.prisma.conversation.update({
      where: {
        id: conversationId,
        userId,
      },
      data: {
        archivedAt: new Date(),
      },
    });
  }

  async forgetConversation(userId: string, conversationId: string) {
    // Verify ownership
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId,
      },
    });

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Delete all messages in this conversation
    await this.prisma.message.deleteMany({
      where: { conversationId },
    });

    // Delete conversation-scoped memory
    await this.prisma.memory.deleteMany({
      where: {
        userId,
        scope: 'conversation',
        key: { startsWith: `conv:${conversationId}:` },
      },
    });

    return { deleted: true };
  }

  async reportMessage(
    userId: string,
    payload: {
      messageId?: string;
      conversationId?: string;
      messageContent: string;
      reason: string;
      description?: string;
    },
  ) {
    const content = (payload.messageContent || '').trim();
    if (!content) {
      throw new Error('Bildirilecek mesaj içeriği boş olamaz');
    }

    const report = await this.prisma.aiMessageReport.create({
      data: {
        userId,
        conversationId: payload.conversationId || null,
        messageId: payload.messageId || null,
        messageContent: content.slice(0, 4000),
        reason: (payload.reason || 'Uygunsuz içerik').trim(),
        description: payload.description?.trim() || null,
      },
    });

    return {
      success: true,
      reportId: report.id,
      message: 'Bildiriminiz alındı. Ekibimiz tarafından incelenecektir.',
    };
  }
}
