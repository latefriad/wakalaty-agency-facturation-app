-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "revenueTarget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expenseBudgets" JSONB,
    "agencyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "budgets_agencyId_year_month_key" ON "budgets"("agencyId", "year", "month");

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
