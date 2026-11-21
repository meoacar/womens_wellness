-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uploaded_files" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "relativePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uploaded_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StepsLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "steps" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StepsLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "horoscope_entries" (
    "id" TEXT NOT NULL,
    "sign" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "title" TEXT,
    "summary" TEXT NOT NULL,
    "loveText" TEXT,
    "careerText" TEXT,
    "healthText" TEXT,
    "loveScore" INTEGER NOT NULL DEFAULT 4,
    "careerScore" INTEGER NOT NULL DEFAULT 4,
    "healthScore" INTEGER NOT NULL DEFAULT 4,
    "energyScore" INTEGER NOT NULL DEFAULT 82,
    "luckyNumber" INTEGER NOT NULL DEFAULT 7,
    "luckyColor" TEXT NOT NULL DEFAULT 'Gül Kurusu',
    "luckyStone" TEXT,
    "affirmation" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "horoscope_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cosmic_overviews" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT 'current',
    "moonPhase" TEXT NOT NULL,
    "moonSign" TEXT NOT NULL,
    "cosmicTheme" TEXT NOT NULL,
    "retrogradeNote" TEXT,
    "dailyAffirmation" TEXT NOT NULL,
    "energyIndex" INTEGER NOT NULL DEFAULT 84,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cosmic_overviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "birth_chart_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "birthTime" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "sunSign" TEXT NOT NULL,
    "moonSign" TEXT NOT NULL,
    "risingSign" TEXT NOT NULL,
    "sunDegree" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "moonDegree" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "risingDegree" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "birth_chart_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_links" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "partnerUserId" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_invites" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_familyId_idx" ON "refresh_tokens"("familyId");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "uploaded_files_relativePath_key" ON "uploaded_files"("relativePath");

-- CreateIndex
CREATE INDEX "uploaded_files_userId_idx" ON "uploaded_files"("userId");

-- CreateIndex
CREATE INDEX "StepsLog_userId_loggedAt_idx" ON "StepsLog"("userId", "loggedAt");

-- CreateIndex
CREATE INDEX "horoscope_entries_period_isActive_idx" ON "horoscope_entries"("period", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "horoscope_entries_sign_period_key" ON "horoscope_entries"("sign", "period");

-- CreateIndex
CREATE UNIQUE INDEX "cosmic_overviews_key_key" ON "cosmic_overviews"("key");

-- CreateIndex
CREATE UNIQUE INDEX "birth_chart_profiles_userId_key" ON "birth_chart_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "partner_links_ownerUserId_key" ON "partner_links"("ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "partner_links_partnerUserId_key" ON "partner_links"("partnerUserId");

-- CreateIndex
CREATE INDEX "partner_links_ownerUserId_idx" ON "partner_links"("ownerUserId");

-- CreateIndex
CREATE INDEX "partner_links_partnerUserId_idx" ON "partner_links"("partnerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "partner_invites_code_key" ON "partner_invites"("code");

-- CreateIndex
CREATE UNIQUE INDEX "partner_invites_ownerUserId_key" ON "partner_invites"("ownerUserId");

-- CreateIndex
CREATE INDEX "partner_invites_code_idx" ON "partner_invites"("code");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StepsLog" ADD CONSTRAINT "StepsLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "birth_chart_profiles" ADD CONSTRAINT "birth_chart_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_links" ADD CONSTRAINT "partner_links_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_links" ADD CONSTRAINT "partner_links_partnerUserId_fkey" FOREIGN KEY ("partnerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_invites" ADD CONSTRAINT "partner_invites_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
