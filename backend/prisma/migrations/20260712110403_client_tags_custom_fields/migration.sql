-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "customFields" JSONB,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
