-- AlterTable
ALTER TABLE "tables" ADD COLUMN     "forkedFromId" TEXT;

-- AddForeignKey
ALTER TABLE "tables" ADD CONSTRAINT "tables_forkedFromId_fkey" FOREIGN KEY ("forkedFromId") REFERENCES "tables"("id") ON DELETE SET NULL ON UPDATE CASCADE;
