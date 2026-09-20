const prisma = require("../../config/database");

function parseDateRange(query) {
  const now = new Date();
  let from, to;

  if (query.from && query.to) {
    from = new Date(query.from);
    to = new Date(query.to);
    // End of day for `to`
    to.setHours(23, 59, 59, 999);
  } else {
    // Default to current month
    from = new Date(now.getFullYear(), now.getMonth(), 1);
    to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  return { from, to };
}

function calculateRecurringMonthlyAmount(rec) {
  let items = [];
  try {
    items = typeof rec.items === "string" ? JSON.parse(rec.items) : (rec.items || []);
  } catch {
    items = [];
  }

  const subtotal = items.reduce(
    (sum, it) => sum + Number(it.unitPrice || 0) * Number(it.quantity || 1),
    0
  );
  const afterDiscount = Math.max(0, subtotal - Number(rec.discount || 0));
  const total = afterDiscount * (1 + Number(rec.tax || 0) / 100);

  if (rec.frequency === "YEARLY") {
    return total / 12;
  }
  if (rec.frequency === "QUARTERLY") {
    return total / 3;
  }
  return total; // MONTHLY
}

async function getExtras(agencyId, req) {
  const { from, to } = parseDateRange(req.query);

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // 1. MRR (Monthly Recurring Revenue)
  const activeRecurring = await prisma.recurringInvoice.findMany({
    where: { agencyId, active: true },
  });

  const mrr = activeRecurring.reduce((sum, rec) => sum + calculateRecurringMonthlyAmount(rec), 0);

  // 2. Collection Rate (for selected period)
  // Encaissé: paiements APPROVED de factures non-annulées
  const [paymentsAggregate, billedAggregate] = await Promise.all([
    prisma.$queryRaw`
      SELECT COALESCE(SUM(p."amount" * i."exchangeRate"), 0)::float AS "totalReceived"
      FROM "payments" p
      JOIN "invoices" i ON i."id" = p."invoiceId"
      WHERE p."agencyId" = ${agencyId}
        AND p."status" = 'APPROVED'
        AND i."docType" = 'FACTURE'
        AND i."status" <> 'ANNULEE'
        AND p."createdAt" >= ${from}
        AND p."createdAt" <= ${to}
    `,
    prisma.$queryRaw`
      SELECT COALESCE(SUM(i."total" * i."exchangeRate"), 0)::float AS "totalBilled"
      FROM "invoices" i
      WHERE i."agencyId" = ${agencyId}
        AND i."docType" = 'FACTURE'
        AND i."status" NOT IN ('DRAFT', 'ANNULEE')
        AND i."createdAt" >= ${from}
        AND i."createdAt" <= ${to}
    `,
  ]);

  const totalReceived = paymentsAggregate[0]?.totalReceived || 0;
  const totalBilled = billedAggregate[0]?.totalBilled || 0;
  const collectionRate = totalBilled > 0 ? Number(((totalReceived / totalBilled) * 100).toFixed(1)) : 0;

  // 3. Monthly Revenue Goal Progress
  const selectedMonthStr = req.query.month || currentMonthStr;

  const [goalRecord, monthPaymentsAggregate] = await Promise.all([
    prisma.agencyGoal.findFirst({
      where: { agencyId, month: selectedMonthStr },
    }),
    prisma.$queryRaw`
      SELECT COALESCE(SUM(p."amount" * i."exchangeRate"), 0)::float AS "collectedThisMonth"
      FROM "payments" p
      JOIN "invoices" i ON i."id" = p."invoiceId"
      WHERE p."agencyId" = ${agencyId}
        AND p."status" = 'APPROVED'
        AND i."docType" = 'FACTURE'
        AND i."status" <> 'ANNULEE'
        AND p."createdAt" >= ${startOfCurrentMonth}
        AND p."createdAt" <= ${endOfCurrentMonth}
    `,
  ]);

  const targetAmount = goalRecord?.targetAmount || 0;
  const collectedThisMonth = monthPaymentsAggregate[0]?.collectedThisMonth || 0;
  const goalProgress =
    targetAmount > 0 ? Number(((collectedThisMonth / targetAmount) * 100).toFixed(1)) : 0;

  // 4. Top 5 Clients by Profit (reusing exact formula: received - direct costs)
  const topClientsProfit = await prisma.$queryRaw`
    SELECT c."id" AS "clientId", c."name", c."company",
           COALESCE(r."received", 0)::float AS "received",
           COALESCE(o."outstanding", 0)::float AS "outstanding",
           COALESCE(ch."charges", 0)::float AS "directCosts",
           (COALESCE(r."received", 0) - COALESCE(ch."charges", 0))::float AS "profit"
    FROM "clients" c
    LEFT JOIN (
      SELECT i."clientId", SUM(p."amount" * i."exchangeRate") AS "received"
      FROM "payments" p
      JOIN "invoices" i ON i."id" = p."invoiceId"
      WHERE p."agencyId" = ${agencyId} AND p."status" = 'APPROVED'
        AND i."docType" = 'FACTURE' AND i."status" <> 'ANNULEE'
        AND p."createdAt" >= ${from} AND p."createdAt" <= ${to}
      GROUP BY i."clientId"
    ) r ON r."clientId" = c."id"
    LEFT JOIN (
      SELECT i."clientId", SUM((i."total" - COALESCE(pp."paid", 0)) * i."exchangeRate") AS "outstanding"
      FROM "invoices" i
      LEFT JOIN (
        SELECT "invoiceId", SUM("amount") AS "paid"
        FROM "payments" WHERE "status" = 'APPROVED' GROUP BY "invoiceId"
      ) pp ON pp."invoiceId" = i."id"
      WHERE i."agencyId" = ${agencyId} AND i."docType" = 'FACTURE'
        AND i."status" IN ('SENT', 'EN_ATTENTE')
        AND i."total" - COALESCE(pp."paid", 0) > 0.001
      GROUP BY i."clientId"
    ) o ON o."clientId" = c."id"
    LEFT JOIN (
      SELECT "clientId", SUM("amount") AS "charges"
      FROM "service_charges" GROUP BY "clientId"
    ) ch ON ch."clientId" = c."id"
    WHERE c."agencyId" = ${agencyId}
      AND (COALESCE(r."received", 0) + COALESCE(o."outstanding", 0) + COALESCE(ch."charges", 0)) > 0
    ORDER BY "profit" DESC
    LIMIT 5
  `;

  return {
    mrr: Number(mrr.toFixed(2)),
    activeSubscriptionsCount: activeRecurring.length,
    collectionRate: {
      rate: collectionRate,
      totalReceived: Number(totalReceived.toFixed(2)),
      totalBilled: Number(totalBilled.toFixed(2)),
    },
    goalProgress: {
      month: selectedMonthStr,
      targetAmount: Number(targetAmount.toFixed(2)),
      collectedThisMonth: Number(collectedThisMonth.toFixed(2)),
      progress: goalProgress,
    },
    topClientsProfit,
  };
}

async function setGoal(agencyId, { month, targetAmount }) {
  const target = Math.max(0, Number(targetAmount || 0));

  const goal = await prisma.agencyGoal.upsert({
    where: {
      agencyId_month: {
        agencyId,
        month,
      },
    },
    update: {
      targetAmount: target,
    },
    create: {
      agencyId,
      month,
      targetAmount: target,
    },
  });

  return goal;
}

module.exports = {
  getExtras,
  setGoal,
};
