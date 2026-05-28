-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- AlterTable
ALTER TABLE "User"
    ADD COLUMN "passwordHash" TEXT,
    ADD COLUMN "role" "Role" NOT NULL DEFAULT 'USER';

-- Backfill-safe default hash for existing rows before enforcing NOT NULL.
UPDATE "User"
SET "passwordHash" = '$2b$12$9CWj4fVItP6hNf4f5M8hL.0j3W.6j2QRTsR6tL.7zQb64v5h6w7Iq'
WHERE "passwordHash" IS NULL;

-- Enforce required credential hash.
ALTER TABLE "User"
    ALTER COLUMN "passwordHash" SET NOT NULL;
