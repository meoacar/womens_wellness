import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Req,
  Sse,
  Logger,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { ChatService } from './chat.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { QuotaGuard } from '../quota/quota.guard';
import { QuotaService } from '../quota/quota.service';

interface MessageEvent {
  data: string;
  type?: 'token' | 'done' | 'error';
}

enum ErrorType {
  TIMEOUT = 'timeout',
  RATE_LIMIT = 'rate_limit',
  API_KEY = 'api_key',
  NETWORK = 'network',
  INVALID_REQUEST = 'invalid_request',
  UNKNOWN = 'unknown',
}

@Controller('chat')
@UseGuards(AuthGuard('jwt'))
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly quotaService: QuotaService,
  ) { }

  /**
   * Classifies error type based on error message and properties
   */
  private classifyError(error: any): ErrorType {
    const errorMessage = error.message?.toLowerCase() || '';
    const errorCode = error.code?.toLowerCase() || '';
    const statusCode = error.statusCode || error.status;

    // Timeout errors
    if (
      errorMessage.includes('timeout') ||
      errorMessage.includes('timed out') ||
      errorCode === 'etimedout' ||
      errorCode === 'econnaborted'
    ) {
      return ErrorType.TIMEOUT;
    }

    // Rate limit errors
    if (
      errorMessage.includes('rate limit') ||
      errorMessage.includes('too many requests') ||
      statusCode === 429 ||
      errorCode === 'rate_limit_exceeded'
    ) {
      return ErrorType.RATE_LIMIT;
    }

    // API key errors
    if (
      errorMessage.includes('api key') ||
      errorMessage.includes('api_key') ||
      errorMessage.includes('authentication') ||
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('invalid key') ||
      statusCode === 401
    ) {
      return ErrorType.API_KEY;
    }

    // Network errors
    if (
      errorMessage.includes('network') ||
      errorMessage.includes('econnrefused') ||
      errorMessage.includes('enotfound') ||
      errorMessage.includes('econnreset') ||
      errorCode === 'econnrefused' ||
      errorCode === 'enotfound' ||
      errorCode === 'econnreset' ||
      statusCode === 503
    ) {
      return ErrorType.NETWORK;
    }

    // Invalid request errors
    if (
      errorMessage.includes('invalid') ||
      errorMessage.includes('bad request') ||
      statusCode === 400
    ) {
      return ErrorType.INVALID_REQUEST;
    }

    return ErrorType.UNKNOWN;
  }

  /**
   * Returns user-friendly Turkish error message based on error type
   */
  private getUserFriendlyMessage(errorType: ErrorType): string {
    const messages: Record<ErrorType, string> = {
      [ErrorType.TIMEOUT]:
        'İstek zaman aşımına uğradı, lütfen tekrar deneyin',
      [ErrorType.RATE_LIMIT]:
        'Sistem yoğun, lütfen birkaç saniye bekleyip tekrar deneyin',
      [ErrorType.API_KEY]: 'Sistem yapılandırma hatası oluştu',
      [ErrorType.NETWORK]:
        'Bağlantı hatası, internet bağlantınızı kontrol edin',
      [ErrorType.INVALID_REQUEST]: 'Geçersiz istek',
      [ErrorType.UNKNOWN]: 'Yanıt alınamadı, lütfen tekrar deneyin',
    };

    return messages[errorType];
  }

  /**
   * Logs error with context information
   */
  private logError(
    error: any,
    context: string,
    userId?: string,
    conversationId?: string,
  ): void {
    const errorType = this.classifyError(error);
    const errorDetails = {
      type: errorType,
      message: error.message,
      stack: error.stack,
      code: error.code,
      statusCode: error.statusCode || error.status,
      userId,
      conversationId,
      timestamp: new Date().toISOString(),
    };

    // Log based on severity
    if (errorType === ErrorType.API_KEY) {
      this.logger.error(
        `[${context}] Critical error - API configuration issue`,
        errorDetails,
      );
    } else if (
      errorType === ErrorType.TIMEOUT ||
      errorType === ErrorType.RATE_LIMIT
    ) {
      this.logger.warn(`[${context}] Transient error`, errorDetails);
    } else {
      this.logger.error(`[${context}] Error occurred`, errorDetails);
    }

    // In production, this could send to error tracking service (e.g., Sentry)
    if (process.env.NODE_ENV === 'production') {
      // Example: Sentry.captureException(error, {
      //   user: { id: userId },
      //   tags: { context, errorType },
      //   extra: errorDetails,
      // });
    }
  }

  @Post(':conversationId/message')
  @UseGuards(QuotaGuard)
  async sendMessage(
    @CurrentUser() user: any,
    @Param('conversationId') conversationId: string,
    @Body('content') content: string,
  ) {
    const config = await this.quotaService.getLimitsConfig();
    if (!config.isNovaEnabled) {
      throw new ServiceUnavailableException(config.maintenanceMessage);
    }
    const trimmed = (content || '').trim();
    if (!trimmed) {
      throw new BadRequestException('Mesaj boş olamaz');
    }
    if (trimmed.length > config.maxMessageLength) {
      throw new BadRequestException(
        `Mesaj en fazla ${config.maxMessageLength} karakter olabilir`,
      );
    }

    // Ensure conversation exists or create it
    const conversation = await this.chatService.getOrCreateConversation(
      user.id,
      conversationId,
    );

    // Save user message
    const message = await this.chatService.saveMessage(
      conversation.id,
      'user',
      trimmed,
    );

    return { messageId: message.id, conversationId: conversation.id };
  }

  @Sse(':conversationId/stream')
  @UseGuards(QuotaGuard)
  async stream(
    @CurrentUser() user: any,
    @Param('conversationId') conversationId: string,
  ): Promise<Observable<MessageEvent>> {
    const config = await this.quotaService.getLimitsConfig();
    if (!config.isNovaEnabled) {
      throw new ServiceUnavailableException(config.maintenanceMessage);
    }

    // Get the last user message from this conversation
    const history = await this.chatService.getConversationHistory(
      conversationId,
      1,
    );

    this.logger.debug(`[Stream] History length: ${history.length}, conversationId: ${conversationId}`);

    const lastMessage = history[0];

    if (!lastMessage) {
      this.logger.error(`[Stream] No messages found for conversation ${conversationId}`);
      throw new Error('No messages found in conversation');
    }

    if (lastMessage.role !== 'user') {
      this.logger.error(`[Stream] Last message is not from user: ${lastMessage.role}`);
      throw new Error('Last message must be from user');
    }

    // Create abort controller for client disconnect
    const abort = new AbortController();

    return new Observable((subscriber) => {
      (async () => {
        try {
          let fullResponse = '';
          let tokenCount = 0;

          const consumeStream = async (overrideGoogleModel?: string) => {
            const attemptAbort = new AbortController();
            const result = await this.chatService.streamResponse(
              user.id,
              conversationId,
              lastMessage.content,
              { overrideGoogleModel, abortSignal: attemptAbort.signal },
            );

            const iterator = result.textStream[Symbol.asyncIterator]();
            const firstChunk = await Promise.race([
              iterator.next(),
              new Promise<never>((_, reject) =>
                setTimeout(() => {
                  attemptAbort.abort();
                  reject(new Error('AI_FIRST_TOKEN_TIMEOUT'));
                }, 12000),
              ),
            ]);

            if (!firstChunk.done && firstChunk.value) {
              fullResponse += firstChunk.value;
              tokenCount++;
              subscriber.next({ data: firstChunk.value, type: 'token' } as any);
            }

            while (!firstChunk.done) {
              if (abort.signal.aborted) break;
              const nextChunk = await iterator.next();
              if (nextChunk.done) break;
              if (nextChunk.value) {
                fullResponse += nextChunk.value;
                tokenCount++;
                subscriber.next({ data: nextChunk.value, type: 'token' } as any);
              }
            }
          };

          try {
            await consumeStream();
          } catch (primaryErr: any) {
            if (tokenCount > 0 || abort.signal.aborted) {
              throw primaryErr;
            }
            this.logger.warn(
              `[Stream] Primary AI model failed/timed out (${primaryErr?.message}); retrying with gemini-3-flash-preview`,
            );
            await consumeStream('gemini-3-flash-preview');
          }

          // Save assistant response to database
          if (!abort.signal.aborted) {
            await this.chatService.saveMessage(
              conversationId,
              'assistant',
              fullResponse,
              tokenCount,
            );

            // Increment quota counter
            await this.quotaService.increment(user.id);

            subscriber.next({
              data: JSON.stringify({ tokens: tokenCount }),
              type: 'done',
            } as any);
          }

          subscriber.complete();
        } catch (error) {
          // Classify error and get user-friendly message
          const errorType = this.classifyError(error);
          const userMessage = this.getUserFriendlyMessage(errorType);

          // Log error with context
          this.logError(error, 'ChatStream', user.id, conversationId);

          // Send user-friendly error to client
          subscriber.next({
            data: JSON.stringify({
              message: userMessage,
              errorType,
            }),
            type: 'error',
          } as any);
          subscriber.error(error);
        }
      })();
    });
  }

  @Post(':conversationId/forget')
  async forgetConversation(
    @CurrentUser() user: any,
    @Param('conversationId') conversationId: string,
  ) {
    // Delete all messages in conversation
    await this.chatService.forgetConversation(user.id, conversationId);

    return { status: 'ok', message: 'Conversation forgotten' };
  }

  @Get('conversations')
  async getConversations(@CurrentUser() user: any) {
    return this.chatService.getUserConversations(user.id);
  }

  @Get(':conversationId/history')
  async getHistory(
    @CurrentUser() user: any,
    @Param('conversationId') conversationId: string,
  ) {
    const messages = await this.chatService.getConversationHistory(
      conversationId,
    );
    return { conversationId, messages };
  }

  @Post('report')
  async reportAiMessage(
    @CurrentUser() user: any,
    @Body()
    body: {
      messageId?: string;
      conversationId?: string;
      messageContent: string;
      reason: string;
      description?: string;
    },
  ) {
    if (!body?.messageContent || !body?.reason) {
      throw new BadRequestException('messageContent ve reason zorunludur');
    }
    return this.chatService.reportMessage(user.id, body);
  }
}
