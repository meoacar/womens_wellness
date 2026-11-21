import {
  buildAuditMetadata,
  isRedactedContentKey,
  isSensitiveSecretKey,
  sanitizeBody,
  shouldOmitAuditBody,
} from './audit-log.interceptor';

describe('AuditLogInterceptor privacy & secret masking', () => {
  it('masks apiKey and other credential fields regardless of casing or naming prefix', () => {
    expect(isSensitiveSecretKey('apiKey')).toBe(true);
    expect(isSensitiveSecretKey('api_key')).toBe(true);
    expect(isSensitiveSecretKey('openaiApiKey')).toBe(true);
    expect(isSensitiveSecretKey('webhookSecret')).toBe(true);
    expect(isSensitiveSecretKey('receiptData')).toBe(true);
    expect(isSensitiveSecretKey('purchaseToken')).toBe(true);
    expect(isSensitiveSecretKey('Authorization')).toBe(true);

    const sanitized = sanitizeBody({
      provider: 'openai',
      apiKey: 'sk-live-super-secret',
      nested: {
        clientSecret: 'sec-123',
        webhook_secret: 'whsec-456',
      },
      isActive: true,
    });

    expect(sanitized).toEqual({
      provider: 'openai',
      apiKey: '[MASKED]',
      nested: {
        clientSecret: '[MASKED]',
        webhook_secret: '[MASKED]',
      },
      isActive: true,
    });
  });

  it('redacts health notes, symptoms, and message content fields inside bodies', () => {
    expect(isRedactedContentKey('healthNotes')).toBe(true);
    expect(isRedactedContentKey('sexNotes')).toBe(true);
    expect(isRedactedContentKey('doctorNotes')).toBe(true);
    expect(isRedactedContentKey('message')).toBe(true);
    expect(isRedactedContentKey('content')).toBe(true);

    const sanitized = sanitizeBody({
      status: 'OPEN',
      healthNotes: 'Private health note',
      sexNotes: 'Intimate note',
      message: 'User message content',
      nested: {
        symptoms: ['cramp'],
        doctorNotes: 'OB/GYN visit note',
      },
    });

    expect(sanitized).toEqual({
      status: 'OPEN',
      healthNotes: '[REDACTED]',
      sexNotes: '[REDACTED]',
      message: '[REDACTED]',
      nested: {
        symptoms: '[REDACTED]',
        doctorNotes: '[REDACTED]',
      },
    });
  });

  it('omits entire request body for user health, chat, Q&A, support, and auth routes', () => {
    expect(shouldOmitAuditBody('/chat/message')).toBe(true);
    expect(shouldOmitAuditBody('/cycles/daily-log')).toBe(true);
    expect(shouldOmitAuditBody('/pregnancy/notes')).toBe(true);
    expect(shouldOmitAuditBody('/qna/questions')).toBe(true);
    expect(shouldOmitAuditBody('/support/tickets')).toBe(true);
    expect(shouldOmitAuditBody('/me')).toBe(true);
    expect(shouldOmitAuditBody('/ai-providers/123')).toBe(false);

    const chatMeta = buildAuditMetadata('POST', '/chat/message', {
      content: 'Very sensitive personal medical question',
      healthNotes: 'Private symptom note',
    });
    expect(chatMeta).toEqual({
      method: 'POST',
      path: '/chat/message',
      bodyRedacted: true,
      fieldCount: 2,
    });
    expect(JSON.stringify(chatMeta)).not.toContain('sensitive');

    const adminMeta = buildAuditMetadata('PATCH', '/ai-providers/openai', {
      apiKey: 'sk-12345',
      isActive: true,
    });
    expect(adminMeta).toEqual({
      method: 'PATCH',
      path: '/ai-providers/openai',
      body: {
        apiKey: '[MASKED]',
        isActive: true,
      },
    });
  });
});
