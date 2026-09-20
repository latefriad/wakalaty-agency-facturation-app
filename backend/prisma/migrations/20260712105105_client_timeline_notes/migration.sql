-- CreateEnum
CREATE TYPE "ClientEventType" AS ENUM ('CLIENT_CREATED', 'INVOICE_ISSUED', 'INVOICE_SENT', 'INVOICE_PAID', 'CONTRACT_SIGNED', 'TASK_CREATED', 'NOTE_ADDED');

-- CreateTable
CREATE TABLE "client_events" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "type" "ClientEventType" NOT NULL,
    "message" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_notes" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_events_clientId_createdAt_idx" ON "client_events"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "client_events_agencyId_idx" ON "client_events"("agencyId");

-- CreateIndex
CREATE INDEX "client_notes_clientId_createdAt_idx" ON "client_notes"("clientId", "createdAt");

-- AddForeignKey
ALTER TABLE "client_events" ADD CONSTRAINT "client_events_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_notes" ADD CONSTRAINT "client_notes_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
