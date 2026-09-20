-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "agencyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_bills" (
    "id" TEXT NOT NULL,
    "reference" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'DZD',
    "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "category" TEXT NOT NULL DEFAULT 'AUTRE',
    "status" TEXT NOT NULL DEFAULT 'A_PAYER',
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,
    "paidAt" TIMESTAMP(3),
    "expenseId" TEXT,
    "supplierId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_bills_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "suppliers_agencyId_idx" ON "suppliers"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_bills_expenseId_key" ON "supplier_bills"("expenseId");

-- CreateIndex
CREATE INDEX "supplier_bills_agencyId_status_idx" ON "supplier_bills"("agencyId", "status");

-- CreateIndex
CREATE INDEX "supplier_bills_agencyId_dueDate_idx" ON "supplier_bills"("agencyId", "dueDate");

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_bills" ADD CONSTRAINT "supplier_bills_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_bills" ADD CONSTRAINT "supplier_bills_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
