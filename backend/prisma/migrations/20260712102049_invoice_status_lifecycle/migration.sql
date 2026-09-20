-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InvoiceStatus" ADD VALUE 'DRAFT';
ALTER TYPE "InvoiceStatus" ADD VALUE 'SENT';

-- AlterTable
ALTER TABLE "agencies" ADD COLUMN     "reminderLeadDays" INTEGER NOT NULL DEFAULT 3;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "preReminderAt" TIMESTAMP(3),
ADD COLUMN     "sentAt" TIMESTAMP(3),
ADD COLUMN     "viewedAt" TIMESTAMP(3),
ALTER COLUMN "number" DROP NOT NULL;
