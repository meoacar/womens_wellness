const DEFAULT_DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:8081',
];

function normalizeOrigin(raw: string): string {
  return raw.trim().replace(/\/+$/, '');
}

/**
 * Resolves allowed CORS origins from environment configuration.
 * Never returns wildcard `*` or localhost fallbacks in production.
 */
export function resolveAllowedOrigins(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const isProd = env.NODE_ENV === 'production';
  const raw = env.CORS_ALLOWED_ORIGINS || env.CORS_ORIGINS || env.FRONTEND_URL;

  if (!raw || !raw.trim()) {
    return isProd ? [] : [...DEFAULT_DEV_ORIGINS];
  }

  const parsed = raw
    .split(',')
    .map(normalizeOrigin)
    .filter((origin) => Boolean(origin) && origin !== '*');

  if (parsed.length === 0) {
    return isProd ? [] : [...DEFAULT_DEV_ORIGINS];
  }

  return Array.from(new Set(parsed));
}

/**
 * Builds a Fastify / Socket.IO CORS origin validator callback.
 * Allows requests with no `Origin` header (native mobile apps, health checks)
 * and strictly checks browser `Origin` headers against `allowedOrigins`.
 */
export function createCorsOriginValidator(allowedOrigins: string[]) {
  const allowSet = new Set(allowedOrigins.map(normalizeOrigin));

  return (
    origin: string | undefined,
    callback: (err: Error | null, allow: boolean) => void,
  ): void => {
    if (!origin) {
      callback(null, true);
      return;
    }

    const normalized = normalizeOrigin(origin);
    if (allowSet.has(normalized)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin not allowed by CORS: ${normalized}`), false);
  };
}
