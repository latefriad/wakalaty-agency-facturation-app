-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "agencyId" TEXT;

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "contractType" TEXT,
ADD COLUMN     "hireDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "audit_logs_agencyId_createdAt_idx" ON "audit_logs"("agencyId", "createdAt");
