-- CreateEnum
CREATE TYPE "DocType" AS ENUM ('FACTURE', 'DEVIS');

-- CreateEnum
CREATE TYPE "RecurringFreq" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');

-- AlterTable
ALTER TABLE "agencies" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'DZD',
ADD COLUMN     "remindersEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "defaultTaxRate" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "invoice_items" ADD COLUMN     "taxRate" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "convertedFromId" TEXT,
ADD COLUMN     "docType" "DocType" NOT NULL DEFAULT 'FACTURE',
ADD COLUMN     "lastReminderAt" TIMESTAMP(3),
ADD COLUMN     "publicToken" TEXT,
ADD COLUMN     "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Backfill des tokens publics pour les factures existantes, puis NOT NULL
UPDATE "invoices" SET "publicToken" = gen_random_uuid()::text WHERE "publicToken" IS NULL;
ALTER TABLE "invoices" ALTER COLUMN "publicToken" SET NOT NULL;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "invoiceId" TEXT;

-- CreateTable
CREATE TABLE "doc_counters" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "docType" "DocType" NOT NULL,
    "year" INTEGER NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "doc_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_invoices" (
    "id" TEXT NOT NULL,
    "frequency" "RecurringFreq" NOT NULL DEFAULT 'MONTHLY',
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "items" JSONB NOT NULL,
    "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "dueDays" INTEGER NOT NULL DEFAULT 30,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "doc_counters_agencyId_docType_year_key" ON "doc_counters"("agencyId", "docType", "year");

-- CreateIndex
CREATE INDEX "recurring_invoices_agencyId_idx" ON "recurring_invoices"("agencyId");

-- CreateIndex
CREATE INDEX "recurring_invoices_nextRunAt_active_idx" ON "recurring_invoices"("nextRunAt", "active");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_publicToken_key" ON "invoices"("publicToken");

-- CreateIndex
CREATE INDEX "invoices_agencyId_status_idx" ON "invoices"("agencyId", "status");

-- CreateIndex
CREATE INDEX "payments_invoiceId_idx" ON "payments"("invoiceId");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

