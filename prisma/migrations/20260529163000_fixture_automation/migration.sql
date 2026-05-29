-- CreateEnum
CREATE TYPE "MatchResultSource" AS ENUM ('ADMIN', 'API', 'IMPORT');

-- AlterTable
ALTER TABLE "Match"
ADD COLUMN "externalId" TEXT,
ADD COLUMN "externalStatus" TEXT,
ADD COLUMN "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN "manualOverride" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "resultSource" "MatchResultSource";

-- CreateIndex
CREATE UNIQUE INDEX "Match_externalId_key" ON "Match"("externalId");

