-- CreateEnum
CREATE TYPE "Editability" AS ENUM ('LOCKED', 'APPROVALS', 'OPEN');

-- CreateEnum
CREATE TYPE "VersionStatus" AS ENUM ('PUBLISHED', 'PENDING_APPROVAL', 'REJECTED');

-- AlterTable: add editability and activeBranch to tables
ALTER TABLE "tables" ADD COLUMN "editability" "Editability" NOT NULL DEFAULT 'OPEN';
ALTER TABLE "tables" ADD COLUMN "activeBranch" TEXT NOT NULL DEFAULT 'main';

-- AlterTable: add branch and status to table_versions
ALTER TABLE "table_versions" ADD COLUMN "branch" TEXT NOT NULL DEFAULT 'main';
ALTER TABLE "table_versions" ADD COLUMN "status" "VersionStatus" NOT NULL DEFAULT 'PUBLISHED';

-- Drop old unique index and create new one with branch
DROP INDEX "table_versions_tableId_version_key";
CREATE UNIQUE INDEX "table_versions_tableId_version_branch_key" ON "table_versions"("tableId", "version", "branch");

-- CreateTable
CREATE TABLE "table_bans" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "bannedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "table_bans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "table_bans_tableId_profileId_key" ON "table_bans"("tableId", "profileId");

-- AddForeignKey
ALTER TABLE "table_bans" ADD CONSTRAINT "table_bans_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_bans" ADD CONSTRAINT "table_bans_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_bans" ADD CONSTRAINT "table_bans_bannedBy_fkey" FOREIGN KEY ("bannedBy") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
