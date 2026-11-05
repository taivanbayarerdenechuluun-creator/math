-- AlterTable
ALTER TABLE "QuestionOption" ADD COLUMN "labelMn" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Assessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "titleMn" TEXT NOT NULL,
    "descEn" TEXT NOT NULL,
    "descMn" TEXT NOT NULL,
    "questionCount" INTEGER NOT NULL DEFAULT 20,
    "durationSec" INTEGER,
    "adaptive" BOOLEAN NOT NULL DEFAULT true,
    "difficultyMin" INTEGER NOT NULL DEFAULT 1,
    "difficultyMax" INTEGER NOT NULL DEFAULT 5,
    "categoryWeights" TEXT NOT NULL DEFAULT '{}',
    "categorySlugs" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Assessment" ("active", "adaptive", "categorySlugs", "createdAt", "descEn", "descMn", "durationSec", "id", "questionCount", "slug", "titleEn", "titleMn", "version") SELECT "active", "adaptive", "categorySlugs", "createdAt", "descEn", "descMn", "durationSec", "id", "questionCount", "slug", "titleEn", "titleMn", "version" FROM "Assessment";
DROP TABLE "Assessment";
ALTER TABLE "new_Assessment" RENAME TO "Assessment";
CREATE UNIQUE INDEX "Assessment_slug_key" ON "Assessment"("slug");
CREATE TABLE "new_Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "promptMn" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'text',
    "assetUrl" TEXT,
    "figure" TEXT,
    "stimulus" TEXT,
    "stimulusSec" INTEGER,
    "explanationMn" TEXT,
    "stimulusMn" TEXT,
    "bankKey" TEXT,
    "origin" TEXT NOT NULL DEFAULT 'bank',
    "difficulty" INTEGER NOT NULL DEFAULT 3,
    "explanation" TEXT NOT NULL,
    "timeLimitSec" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Question_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Question" ("active", "assetUrl", "categoryId", "createdAt", "difficulty", "explanation", "figure", "id", "kind", "prompt", "promptMn", "stimulus", "stimulusSec", "timeLimitSec", "updatedAt", "version") SELECT "active", "assetUrl", "categoryId", "createdAt", "difficulty", "explanation", "figure", "id", "kind", "prompt", "promptMn", "stimulus", "stimulusSec", "timeLimitSec", "updatedAt", "version" FROM "Question";
DROP TABLE "Question";
ALTER TABLE "new_Question" RENAME TO "Question";
CREATE UNIQUE INDEX "Question_bankKey_key" ON "Question"("bankKey");
CREATE INDEX "Question_categoryId_difficulty_active_idx" ON "Question"("categoryId", "difficulty", "active");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "XPTransaction_userId_reason_refId_key" ON "XPTransaction"("userId", "reason", "refId");

