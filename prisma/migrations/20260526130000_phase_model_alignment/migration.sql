-- Replace the coarse knockout phase with the 2026 fixture phases used by the frontend.
CREATE TYPE "Phase_new" AS ENUM (
    'GROUPS_1',
    'GROUPS_2',
    'GROUPS_3',
    'ROUND_OF_16',
    'QUARTER_FINAL',
    'SEMI_FINAL',
    'THIRD_PLACE',
    'FINAL'
);

ALTER TABLE "Match"
    ALTER COLUMN "phase" TYPE "Phase_new"
    USING (
        CASE "phase"::text
            WHEN 'KNOCKOUT' THEN 'ROUND_OF_16'
            ELSE "phase"::text
        END
    )::"Phase_new";

ALTER TYPE "Phase" RENAME TO "Phase_old";
ALTER TYPE "Phase_new" RENAME TO "Phase";
DROP TYPE "Phase_old";
