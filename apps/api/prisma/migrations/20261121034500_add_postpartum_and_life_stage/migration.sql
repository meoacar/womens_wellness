-- AlterTable
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "lifeStage" TEXT NOT NULL DEFAULT 'CYCLE';

-- CreateTable
CREATE TABLE IF NOT EXISTS "BabyProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "gender" TEXT,
    "birthWeightGr" INTEGER,
    "birthHeightCm" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BabyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FeedingLog" (
    "id" TEXT NOT NULL,
    "babyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "durationSec" INTEGER,
    "amountMl" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedingLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DiaperLog" (
    "id" TEXT NOT NULL,
    "babyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiaperLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BabySleepLog" (
    "id" TEXT NOT NULL,
    "babyId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BabySleepLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BabyGrowthLog" (
    "id" TEXT NOT NULL,
    "babyId" TEXT NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weightKg" DOUBLE PRECISION,
    "heightCm" DOUBLE PRECISION,
    "headCm" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BabyGrowthLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BabyVaccineRecord" (
    "id" TEXT NOT NULL,
    "babyId" TEXT NOT NULL,
    "vaccineCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueMonth" INTEGER NOT NULL,
    "administeredAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BabyVaccineRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BabyProfile_userId_idx" ON "BabyProfile"("userId");
CREATE INDEX IF NOT EXISTS "FeedingLog_babyId_startedAt_idx" ON "FeedingLog"("babyId", "startedAt");
CREATE INDEX IF NOT EXISTS "DiaperLog_babyId_loggedAt_idx" ON "DiaperLog"("babyId", "loggedAt");
CREATE INDEX IF NOT EXISTS "BabySleepLog_babyId_startedAt_idx" ON "BabySleepLog"("babyId", "startedAt");
CREATE INDEX IF NOT EXISTS "BabyGrowthLog_babyId_measuredAt_idx" ON "BabyGrowthLog"("babyId", "measuredAt");
CREATE UNIQUE INDEX IF NOT EXISTS "BabyVaccineRecord_babyId_vaccineCode_key" ON "BabyVaccineRecord"("babyId", "vaccineCode");
CREATE INDEX IF NOT EXISTS "BabyVaccineRecord_babyId_dueMonth_idx" ON "BabyVaccineRecord"("babyId", "dueMonth");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BabyProfile_userId_fkey') THEN
    ALTER TABLE "BabyProfile" ADD CONSTRAINT "BabyProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FeedingLog_babyId_fkey') THEN
    ALTER TABLE "FeedingLog" ADD CONSTRAINT "FeedingLog_babyId_fkey" FOREIGN KEY ("babyId") REFERENCES "BabyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DiaperLog_babyId_fkey') THEN
    ALTER TABLE "DiaperLog" ADD CONSTRAINT "DiaperLog_babyId_fkey" FOREIGN KEY ("babyId") REFERENCES "BabyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BabySleepLog_babyId_fkey') THEN
    ALTER TABLE "BabySleepLog" ADD CONSTRAINT "BabySleepLog_babyId_fkey" FOREIGN KEY ("babyId") REFERENCES "BabyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BabyGrowthLog_babyId_fkey') THEN
    ALTER TABLE "BabyGrowthLog" ADD CONSTRAINT "BabyGrowthLog_babyId_fkey" FOREIGN KEY ("babyId") REFERENCES "BabyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BabyVaccineRecord_babyId_fkey') THEN
    ALTER TABLE "BabyVaccineRecord" ADD CONSTRAINT "BabyVaccineRecord_babyId_fkey" FOREIGN KEY ("babyId") REFERENCES "BabyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
