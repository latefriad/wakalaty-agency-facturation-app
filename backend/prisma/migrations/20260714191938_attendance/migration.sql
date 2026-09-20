-- CreateTable
CREATE TABLE "time_entries" (
    "id" TEXT NOT NULL,
    "clockIn" TIMESTAMP(3) NOT NULL,
    "clockOut" TIMESTAMP(3),
    "minutes" INTEGER,
    "note" TEXT,
    "employeeId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "time_entries_agencyId_clockIn_idx" ON "time_entries"("agencyId", "clockIn");

-- CreateIndex
CREATE INDEX "time_entries_employeeId_clockIn_idx" ON "time_entries"("employeeId", "clockIn");

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
