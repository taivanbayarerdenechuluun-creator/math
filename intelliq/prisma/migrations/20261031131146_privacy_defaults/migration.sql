-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "imageUrl" TEXT,
    "emailVerifiedAt" DATETIME,
    "verifyToken" TEXT,
    "resetTokenHash" TEXT,
    "resetTokenExpiry" DATETIME,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "publicProfile" BOOLEAN NOT NULL DEFAULT false,
    "showOnLeaderboard" BOOLEAN NOT NULL DEFAULT false,
    "disabledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_User" ("createdAt", "disabledAt", "email", "emailVerifiedAt", "id", "imageUrl", "name", "passwordHash", "publicProfile", "resetTokenExpiry", "resetTokenHash", "roleId", "showOnLeaderboard", "updatedAt", "verifyToken", "xp") SELECT "createdAt", "disabledAt", "email", "emailVerifiedAt", "id", "imageUrl", "name", "passwordHash", "publicProfile", "resetTokenExpiry", "resetTokenHash", "roleId", "showOnLeaderboard", "updatedAt", "verifyToken", "xp" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_verifyToken_key" ON "User"("verifyToken");
CREATE INDEX "User_roleId_idx" ON "User"("roleId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
