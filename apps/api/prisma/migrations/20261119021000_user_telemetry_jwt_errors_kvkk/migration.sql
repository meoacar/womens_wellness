-- Add telemetry & JWT session revocation columns to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastIpAddress" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastDeviceModel" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastOsVersion" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastAppVersion" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastUserAgent" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sessionsRevokedAt" TIMESTAMP(3);

-- Add telemetry columns to refresh_tokens
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "accessJti" TEXT;
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "ipAddress" TEXT;
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "deviceModel" TEXT;
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "osVersion" TEXT;
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "appVersion" TEXT;
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "userAgent" TEXT;
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "lastUsedAt" TIMESTAMP(3);

-- Create user_error_logs table
CREATE TABLE IF NOT EXISTS "user_error_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'API',
    "level" TEXT NOT NULL DEFAULT 'ERROR',
    "statusCode" INTEGER,
    "method" TEXT,
    "path" TEXT,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "ipAddress" TEXT,
    "deviceModel" TEXT,
    "osVersion" TEXT,
    "appVersion" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_error_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "user_error_logs_userId_createdAt_idx" ON "user_error_logs"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "user_error_logs_createdAt_idx" ON "user_error_logs"("createdAt");

DO $$ BEGIN
  ALTER TABLE "user_error_logs"
    ADD CONSTRAINT "user_error_logs_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create kvkk_consent_logs table
CREATE TABLE IF NOT EXISTS "kvkk_consent_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "consentType" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "version" TEXT DEFAULT '1.0',
    "source" TEXT,
    "ipAddress" TEXT,
    "deviceModel" TEXT,
    "osVersion" TEXT,
    "appVersion" TEXT,
    "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kvkk_consent_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "kvkk_consent_logs_userId_consentedAt_idx" ON "kvkk_consent_logs"("userId", "consentedAt");

DO $$ BEGIN
  ALTER TABLE "kvkk_consent_logs"
    ADD CONSTRAINT "kvkk_consent_logs_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
