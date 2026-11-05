/*
  Warnings:

  - You are about to drop the column `askedIds` on the `AssessmentSession` table. All the data in the column will be lost.
  - You are about to drop the column `currentDifficulty` on the `AssessmentSession` table. All the data in the column will be lost.
  - Added the required column `position` to the `UserAnswer` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Question" ADD COLUMN "figure" TEXT;
ALTER TABLE "Question" ADD COLUMN "stimulus" TEXT;
ALTER TABLE "Question" ADD COLUMN "stimulusSec" INTEGER;

-- AlterTable
ALTER TABLE "QuestionOption" ADD COLUMN "figure" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AssessmentSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assessmentId" TEXT NOT NULL,
    "userId" TEXT,
    "guestToken" TEXT,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "adaptState" TEXT NOT NULL DEFAULT '{}',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" DATETIME,
    "lastSavedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssessmentSession_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AssessmentSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AssessmentSession" ("assessmentId", "guestToken", "id", "lastSavedAt", "startedAt", "status", "submittedAt", "userId") SELECT "assessmentId", "guestToken", "id", "lastSavedAt", "startedAt", "status", "submittedAt", "userId" FROM "AssessmentSession";
DROP TABLE "AssessmentSession";
ALTER TABLE "new_AssessmentSession" RENAME TO "AssessmentSession";
CREATE UNIQUE INDEX "AssessmentSession_guestToken_key" ON "AssessmentSession"("guestToken");
CREATE INDEX "AssessmentSession_userId_status_idx" ON "AssessmentSession"("userId", "status");
CREATE TABLE "new_UserAnswer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "questionId" TEXT NOT NULL,
    "optionId" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "servedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stimulusSeenAt" DATETIME,
    "isCorrect" BOOLEAN,
    "difficulty" INTEGER NOT NULL,
    "timeMs" INTEGER NOT NULL DEFAULT 0,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "answeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserAnswer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AssessmentSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_UserAnswer" ("answeredAt", "difficulty", "flagged", "id", "isCorrect", "optionId", "questionId", "sessionId", "timeMs") SELECT "answeredAt", "difficulty", "flagged", "id", "isCorrect", "optionId", "questionId", "sessionId", "timeMs" FROM "UserAnswer";
DROP TABLE "UserAnswer";
ALTER TABLE "new_UserAnswer" RENAME TO "UserAnswer";
CREATE UNIQUE INDEX "UserAnswer_sessionId_questionId_key" ON "UserAnswer"("sessionId", "questionId");
CREATE UNIQUE INDEX "UserAnswer_sessionId_position_key" ON "UserAnswer"("sessionId", "position");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
