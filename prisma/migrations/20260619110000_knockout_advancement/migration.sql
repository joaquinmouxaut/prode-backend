-- Knockout advancement: register who advances + how the tie was decided, and add the
-- 2026 Round of 32 phase. All new columns are nullable: safe over existing data.

-- 1. New 2026 knockout phase, ordered before Round of 16.
ALTER TYPE "Phase" ADD VALUE IF NOT EXISTS 'ROUND_OF_32' BEFORE 'ROUND_OF_16';

-- 2. Enums for knockout resolution.
CREATE TYPE "TeamSide" AS ENUM ('HOME', 'AWAY');
CREATE TYPE "MatchDecision" AS ENUM ('REGULAR', 'EXTRA_TIME', 'PENALTIES');

-- 3. Match: which side advances and how the result was decided.
ALTER TABLE "Match" ADD COLUMN "winnerSide" "TeamSide";
ALTER TABLE "Match" ADD COLUMN "decidedBy" "MatchDecision";

-- 4. Prediction: which team the player thinks advances (knockout only).
ALTER TABLE "Prediction" ADD COLUMN "advancingTeam" "TeamSide";
