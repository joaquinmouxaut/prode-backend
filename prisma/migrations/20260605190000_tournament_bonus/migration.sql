-- AlterTable
ALTER TABLE "User" ADD COLUMN "championPoints" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "topScorerPoints" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "TournamentConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "championTeam" TEXT,
    "topScorerPlayer" TEXT,

    CONSTRAINT "TournamentConfig_pkey" PRIMARY KEY ("id")
);

INSERT INTO "TournamentConfig" ("id") VALUES (1);
