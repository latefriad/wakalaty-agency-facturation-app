-- AlterTable
ALTER TABLE "agencies" ADD COLUMN     "openingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'DZD',
    "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "category" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "attachment" TEXT,
    "attachmentName" TEXT,
    "agencyId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expenses_agencyId_date_idx" ON "expenses"("agencyId", "date");

-- CreateIndex
CREATE INDEX "expenses_agencyId_category_idx" ON "expenses"("agencyId", "category");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
