-- CreateTable
CREATE TABLE "leave_requests" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'ANNUAL',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "days" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "employeeId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_balances" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "allocatedDays" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "usedDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "employeeId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,

    CONSTRAINT "leave_balances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leave_requests_agencyId_status_idx" ON "leave_requests"("agencyId", "status");

-- CreateIndex
CREATE INDEX "leave_requests_employeeId_createdAt_idx" ON "leave_requests"("employeeId", "createdAt");

-- CreateIndex
CREATE INDEX "leave_balances_agencyId_idx" ON "leave_balances"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "leave_balances_employeeId_year_key" ON "leave_balances"("employeeId", "year");

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
