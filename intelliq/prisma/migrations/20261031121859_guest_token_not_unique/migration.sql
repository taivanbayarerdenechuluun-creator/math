-- DropIndex
DROP INDEX "AssessmentSession_guestToken_key";

-- CreateIndex
CREATE INDEX "AssessmentSession_guestToken_status_idx" ON "AssessmentSession"("guestToken", "status");
