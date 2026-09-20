-- DropIndex
DROP INDEX "tasks_agencyId_idx";

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "startDate" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "employees_userId_key" ON "employees"("userId");

-- CreateIndex
CREATE INDEX "tasks_agencyId_status_idx" ON "tasks"("agencyId", "status");

-- CreateIndex
CREATE INDEX "tasks_agencyId_dueDate_idx" ON "tasks"("agencyId", "dueDate");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Rattrapage : lie chaque employé existant à son compte utilisateur quand
-- l'e-mail correspond dans la même agence. DISTINCT ON garantit qu'un compte
-- n'est lié qu'à un seul employé (contrainte unique sur userId).
UPDATE "employees" e
SET "userId" = m."userId"
FROM (
  SELECT DISTINCT ON (u."id") e2."id" AS "employeeId", u."id" AS "userId"
  FROM "employees" e2
  JOIN "users" u
    ON LOWER(u."email") = LOWER(e2."email")
   AND u."agencyId" = e2."agencyId"
  WHERE e2."userId" IS NULL AND e2."email" IS NOT NULL
  ORDER BY u."id", e2."createdAt"
) m
WHERE e."id" = m."employeeId";
