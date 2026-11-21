import {
  createCorsOriginValidator,
  resolveAllowedOrigins,
} from './cors';

describe('CORS allowlist enforcement', () => {
  it('parses CORS_ALLOWED_ORIGINS and ignores bare wildcard entries', () => {
    const origins = resolveAllowedOrigins({
      NODE_ENV: 'production',
      CORS_ALLOWED_ORIGINS: ' https://kadinatlasi.com/ , *, https://admin.kadinatlasi.com ',
    } as any);

    expect(origins).toEqual([
      'https://kadinatlasi.com',
      'https://admin.kadinatlasi.com',
    ]);
  });

  it('does not fall back to localhost in production when env is empty', () => {
    const origins = resolveAllowedOrigins({ NODE_ENV: 'production' } as any);
    expect(origins).toEqual([]);
  });

  it('falls back to localhost dev origins outside production when env is unset', () => {
    const origins = resolveAllowedOrigins({ NODE_ENV: 'development' } as any);
    expect(origins).toContain('http://localhost:3001');
  });

  it('allows explicitly configured browser origins and native requests without Origin, rejects others', () => {
    const validator = createCorsOriginValidator([
      'https://kadinatlasi.com',
      'https://admin.kadinatlasi.com',
    ]);

    const check = (origin?: string) =>
      new Promise<boolean>((resolve, reject) => {
        validator(origin, (err, allow) => {
          if (err) reject(err);
          else resolve(allow);
        });
      });

    return Promise.all([
      expect(check(undefined)).resolves.toBe(true),
      expect(check('https://kadinatlasi.com')).resolves.toBe(true),
      expect(check('https://admin.kadinatlasi.com/')).resolves.toBe(true),
      expect(check('https://evil.example.com')).rejects.toThrow('not allowed by CORS'),
      expect(check('http://kadinatlasi.com')).rejects.toThrow('not allowed by CORS'),
    ]);
  });
});
