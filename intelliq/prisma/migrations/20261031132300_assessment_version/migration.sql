-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AssessmentResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "reportCode" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "correct" INTEGER NOT NULL,
    "incorrect" INTEGER NOT NULL,
    "unanswered" INTEGER NOT NULL,
    "accuracy" REAL NOT NULL,
    "performanceScore" REAL NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "scoringVersion" INTEGER NOT NULL DEFAULT 1,
    "assessmentVersion" INTEGER NOT NULL DEFAULT 1,
    "aiInsight" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssessmentResult_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AssessmentSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssessmentResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AssessmentResult" ("accuracy", "aiInsight", "correct", "createdAt", "durationSec", "id", "incorrect", "performanceScore", "reportCode", "scoringVersion", "sessionId", "total", "unanswered", "userId") SELECT "accuracy", "aiInsight", "correct", "createdAt", "durationSec", "id", "incorrect", "performanceScore", "reportCode", "scoringVersion", "sessionId", "total", "unanswered", "userId" FROM "AssessmentResult";
DROP TABLE "AssessmentResult";
ALTER TABLE "new_AssessmentResult" RENAME TO "AssessmentResult";
CREATE UNIQUE INDEX "AssessmentResult_sessionId_key" ON "AssessmentResult"("sessionId");
CREATE UNIQUE INDEX "AssessmentResult_reportCode_key" ON "AssessmentResult"("reportCode");
CREATE INDEX "AssessmentResult_userId_createdAt_idx" ON "AssessmentResult"("userId", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
