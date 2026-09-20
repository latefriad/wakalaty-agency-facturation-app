-- Backfill : les factures marquées PAYEE sans lignes de paiement (l'ancien
-- updateStatus ne créait pas de Payment) reçoivent un paiement de solde daté
-- de paidAt, pour que « encaissé » = somme des Payments APPROVED soit exact
-- sur l'historique. Idempotent : ne touche que les factures dont le cumul
-- payé ne couvre pas le total.
INSERT INTO "payments" ("id", "amount", "status", "notes", "agencyId", "invoiceId", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  i."total" - COALESCE(p."paid", 0),
  'APPROVED',
  'Backfill : facture marquée payée',
  i."agencyId",
  i."id",
  COALESCE(i."paidAt", i."updatedAt"),
  now()
FROM "invoices" i
LEFT JOIN (
  SELECT "invoiceId", SUM("amount") AS "paid"
  FROM "payments"
  WHERE "status" = 'APPROVED'
  GROUP BY "invoiceId"
) p ON p."invoiceId" = i."id"
WHERE i."docType" = 'FACTURE'
  AND i."status" = 'PAYEE'
  AND i."total" - COALESCE(p."paid", 0) > 0.001;
