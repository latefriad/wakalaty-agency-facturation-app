const prisma = require("../../config/database");

// ─── Définitions des chiffres (à garder alignées avec l'UI) ─────────────
// ENCAISSÉ  : somme des Payments APPROVED de factures (docType FACTURE, non
//             annulées), datés par la date du paiement — les paiements
//             partiels comptent dès leur saisie. updateStatus→PAYEE crée le
//             paiement de solde : la table payments est l'UNIQUE source.
// FACTURÉ   : somme des factures finalisées (ni brouillon ni annulée), datées
//             par leur date d'émission. Jamais mélangé avec l'encaissé.
// ENCOURS   : par facture SENT/EN_ATTENTE, total − paiements approuvés
//             (photo à l'instant T, indépendante de la période).
// DÉPENSES  : saisies dans le module expenses, converties via leur taux figé.
// BÉNÉFICE  : encaissé − dépenses de la période (comptabilité de caisse,
//             affiché comme tel) ; marge = bénéfice ÷ encaissé.
// TRÉSORERIE: openingBalance (calage saisi par l'agence) + tous les
//             encaissements − toutes les dépenses, depuis toujours — c'est
//             une photo, indépendante de la période filtrée.
// DEVISES   : tous les montants sont convertis dans la devise de l'agence
//             via le taux figé sur chaque facture (exchangeRate) — les devis
//             sont exclus de tout.

// AGING     : ventilation de l'encours par ancienneté d'échéance (photo) —
//             à échoir, 1-30 j, 31-60 j, 60 j+ de retard. Une facture sans
//             échéance est « à échoir » (rien ne permet de la dire en retard).
// DSO       : délai moyen d'encaissement = moyenne des (date de paiement −
//             date d'émission), pondérée par les montants, sur les paiements
//             de la période. Null si rien n'est encaissé.

// BUDGET    : objectifs mensuels (module budgets) sommés sur les mois que la
//             période TOUCHE (mois entamé = mois compté, prévisible), comparés
//             au réalisé calculé avec les mêmes définitions.
// PRÉVISION : à 3 mois. Entrées attendues = restes dus par mois d'échéance
//             (échues ou sans échéance → mois courant : hypothèse affichée) ;
//             sorties prévues = budget de dépenses du mois s'il existe, sinon
//             moyenne des 3 derniers mois. Solde projeté cumulé depuis la
//             trésorerie actuelle.

const ALL_TIME = new Date("1970-01-01");

function monthsBetween(from, to, cap = 24) {
  const out = [];
  const d = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  while (d <= end && out.length < cap) {
    out.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}

function budgetExpenseTotal(b) {
  return Object.values(b.expenseBudgets || {}).reduce((s, v) => s + (Number(v) || 0), 0);
}

async function getDashboard(agencyId, { from, to }) {
  const now = new Date();
  const [counts, cash, cashSeries, billed, outstanding, statusBreakdown, topClients, recentInvoices, overdueTasks, agency, expenses, expensesByCategory, allTimeCash, allTimeExpenses, aging, worstOverdue, dso, clientProfit, budgetRows, expectedInflows, avgMonthlyExpenses, upcomingBudgets, payables, payablesSchedule] =
    await Promise.all([
      getCounts(agencyId),
      getCashReceived(agencyId, from, to),
      getCashSeries(agencyId, from, to),
      getBilled(agencyId, from, to),
      getOutstanding(agencyId),
      getStatusBreakdown(agencyId),
      getTopClients(agencyId, from, to),
      prisma.invoice.findMany({
        where: { agencyId },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { client: { select: { name: true } } },
      }),
      prisma.task.count({
        where: { agencyId, status: { not: "DONE" }, dueDate: { lt: new Date() } },
      }),
      prisma.agency.findUnique({ where: { id: agencyId }, select: { currency: true, openingBalance: true } }),
      getExpensesTotal(agencyId, from, to),
      getExpensesByCategory(agencyId, from, to),
      getCashReceived(agencyId, ALL_TIME, now),
      getExpensesTotal(agencyId, ALL_TIME, now),
      getAging(agencyId),
      getWorstOverdue(agencyId),
      getDso(agencyId, from, to),
      getClientProfit(agencyId, from, to),
      getBudgetRows(agencyId, monthsBetween(from, to)),
      getExpectedInflows(agencyId),
      getAvgMonthlyExpenses(agencyId),
      getBudgetRows(agencyId, monthsBetween(now, new Date(now.getFullYear(), now.getMonth() + 2, 1))),
      getPayables(agencyId),
      getPayablesSchedule(agencyId),
    ]);

  const net = cash.received - expenses.total;
  const profit = {
    net,
    // Marge nulle (pas 0) quand rien n'est encaissé : afficher 0 % serait faux.
    margin: cash.received > 0 ? net / cash.received : null,
  };

  const treasury = {
    balance: (agency?.openingBalance || 0) + allTimeCash.received - allTimeExpenses.total,
    openingBalance: agency?.openingBalance || 0,
    totalReceived: allTimeCash.received,
    totalSpent: allTimeExpenses.total,
  };

  // Budget vs réel sur la période : objectifs sommés sur les mois touchés,
  // réalisé = les chiffres déjà calculés (mêmes définitions).
  const revenueTarget = budgetRows.reduce((s, b) => s + b.revenueTarget, 0);
  const expenseBudgetByCat = {};
  budgetRows.forEach((b) => {
    Object.entries(b.expenseBudgets || {}).forEach(([cat, v]) => {
      expenseBudgetByCat[cat] = (expenseBudgetByCat[cat] || 0) + (Number(v) || 0);
    });
  });
  const actualByCat = Object.fromEntries(expensesByCategory.map((r) => [r.category, r.total]));
  const budgetCategories = [...new Set([...Object.keys(expenseBudgetByCat), ...Object.keys(actualByCat)])];
  const budget = {
    defined: budgetRows.length > 0,
    monthsCovered: budgetRows.length,
    revenueTarget,
    revenueActual: cash.received,
    expenseBudgetTotal: Object.values(expenseBudgetByCat).reduce((s, v) => s + v, 0),
    expenseActualTotal: expenses.total,
    byCategory: budgetCategories
      .map((cat) => ({ category: cat, budget: expenseBudgetByCat[cat] || 0, actual: actualByCat[cat] || 0 }))
      .sort((a, b) => b.budget - a.budget || b.actual - a.actual),
  };

  // Prévision de trésorerie à 3 mois, cumulée depuis la trésorerie actuelle.
  const inflowsByMonth = Object.fromEntries(expectedInflows.map((r) => [r.month, r.expected]));
  const payablesByMonth = Object.fromEntries(payablesSchedule.map((r) => [r.month, r.due]));
  const upcomingByMonth = Object.fromEntries(
    upcomingBudgets.map((b) => [`${b.year}-${String(b.month).padStart(2, "0")}`, b])
  );
  let projected = treasury.balance;
  const forecastMonths = [];
  for (let k = 0; k < 3; k += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() + k, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthBudget = upcomingByMonth[key];
    const hasExpenseBudget = monthBudget && Object.keys(monthBudget.expenseBudgets || {}).length > 0;
    const expectedIn = inflowsByMonth[key] || 0;
    const baseline = hasExpenseBudget ? budgetExpenseTotal(monthBudget) : avgMonthlyExpenses;
    // L'échéancier fournisseurs est un PLANCHER d'engagements fermes : si les
    // factures à payer du mois dépassent le train de vie estimé (budget ou
    // moyenne), ce sont elles qui font la sortie prévue. On ne les additionne
    // pas au train de vie : une facture payée devient une dépense — l'ajouter
    // aux deux la compterait deux fois.
    const payablesDue = payablesByMonth[key] || 0;
    const expectedOut = Math.max(baseline, payablesDue);
    projected += expectedIn - expectedOut;
    forecastMonths.push({
      month: key,
      expectedIn,
      expectedOut,
      payablesDue,
      // D'où vient la sortie prévue : budget saisi, moyenne 3 mois ou
      // échéancier fournisseurs — l'UI l'affiche pour ne jamais faire passer
      // une hypothèse pour un fait.
      expectedOutSource: payablesDue > baseline ? "payables" : hasExpenseBudget ? "budget" : "average",
      projectedBalance: projected,
    });
  }
  const forecast = { startingBalance: treasury.balance, months: forecastMonths };

  return {
    currency: agency?.currency || "DZD",
    period: { from, to },
    counts,
    treasury,
    cash,
    expenses: { ...expenses, byCategory: expensesByCategory },
    profit,
    cashSeries,
    billed,
    outstanding,
    aging,
    worstOverdue,
    dso,
    clientProfit,
    budget,
    forecast,
    payables,
    statusBreakdown,
    topClients,
    recentInvoices,
    overdueTasks,
  };
}

async function getExpensesTotal(agencyId, from, to) {
  const [row] = await prisma.$queryRaw`
    SELECT COALESCE(SUM("amount" * "exchangeRate"), 0)::float AS total,
           COUNT(*)::int AS count
    FROM "expenses"
    WHERE "agencyId" = ${agencyId}
      AND "date" >= ${from} AND "date" <= ${to}
  `;
  return row;
}

async function getExpensesByCategory(agencyId, from, to) {
  return prisma.$queryRaw`
    SELECT "category", COALESCE(SUM("amount" * "exchangeRate"), 0)::float AS total
    FROM "expenses"
    WHERE "agencyId" = ${agencyId}
      AND "date" >= ${from} AND "date" <= ${to}
    GROUP BY 1
    ORDER BY 2 DESC
  `;
}

async function getCounts(agencyId) {
  const [clients, invoices, employees, tasks] = await Promise.all([
    prisma.client.count({ where: { agencyId } }),
    prisma.invoice.count({ where: { agencyId } }),
    prisma.employee.count({ where: { agencyId } }),
    prisma.task.count({ where: { agencyId } }),
  ]);
  return { clients, invoices, employees, tasks };
}

async function getCashReceived(agencyId, from, to) {
  const [row] = await prisma.$queryRaw`
    SELECT COALESCE(SUM(p."amount" * i."exchangeRate"), 0)::float AS received,
           COUNT(*)::int AS "paymentsCount"
    FROM "payments" p
    JOIN "invoices" i ON i."id" = p."invoiceId"
    WHERE p."agencyId" = ${agencyId}
      AND p."status" = 'APPROVED'
      AND i."docType" = 'FACTURE'
      AND i."status" <> 'ANNULEE'
      AND p."createdAt" >= ${from} AND p."createdAt" <= ${to}
  `;
  return { received: row.received, paymentsCount: row.paymentsCount };
}

// Encaissé par mois sur la période (une seule requête agrégée en base).
async function getCashSeries(agencyId, from, to) {
  return prisma.$queryRaw`
    SELECT to_char(date_trunc('month', p."createdAt"), 'YYYY-MM') AS month,
           COALESCE(SUM(p."amount" * i."exchangeRate"), 0)::float AS received
    FROM "payments" p
    JOIN "invoices" i ON i."id" = p."invoiceId"
    WHERE p."agencyId" = ${agencyId}
      AND p."status" = 'APPROVED'
      AND i."docType" = 'FACTURE'
      AND i."status" <> 'ANNULEE'
      AND p."createdAt" >= ${from} AND p."createdAt" <= ${to}
    GROUP BY 1
    ORDER BY 1
  `;
}

async function getBilled(agencyId, from, to) {
  const [row] = await prisma.$queryRaw`
    SELECT COALESCE(SUM("total" * "exchangeRate"), 0)::float AS total,
           COUNT(*)::int AS count
    FROM "invoices"
    WHERE "agencyId" = ${agencyId}
      AND "docType" = 'FACTURE'
      AND "status" NOT IN ('DRAFT', 'ANNULEE')
      AND "createdAt" >= ${from} AND "createdAt" <= ${to}
  `;
  return row;
}

// Photo de l'encours à l'instant T : reste à payer réel (total − paiements
// approuvés) des factures émises non soldées, SENT comprises.
async function getOutstanding(agencyId) {
  const [row] = await prisma.$queryRaw`
    SELECT COALESCE(SUM(remaining), 0)::float AS total,
           COUNT(*)::int AS count,
           COALESCE(SUM(remaining) FILTER (WHERE "dueDate" IS NOT NULL AND "dueDate" < now()), 0)::float AS overdue,
           (COUNT(*) FILTER (WHERE "dueDate" IS NOT NULL AND "dueDate" < now()))::int AS "overdueCount"
    FROM (
      SELECT (i."total" - COALESCE(p."paid", 0)) * i."exchangeRate" AS remaining, i."dueDate"
      FROM "invoices" i
      LEFT JOIN (
        SELECT "invoiceId", SUM("amount") AS "paid"
        FROM "payments" WHERE "status" = 'APPROVED' GROUP BY "invoiceId"
      ) p ON p."invoiceId" = i."id"
      WHERE i."agencyId" = ${agencyId}
        AND i."docType" = 'FACTURE'
        AND i."status" IN ('SENT', 'EN_ATTENTE')
        AND i."total" - COALESCE(p."paid", 0) > 0.001
    ) t
  `;
  return row;
}

// Ventilation de l'encours par ancienneté, calculée en une requête sur le
// reste à payer réel (les buckets bougent tout seuls avec le temps).
async function getAging(agencyId) {
  const [row] = await prisma.$queryRaw`
    SELECT
      COALESCE(SUM(remaining) FILTER (WHERE "dueDate" IS NULL OR "dueDate" >= now()), 0)::float AS "notDue",
      COALESCE(SUM(remaining) FILTER (WHERE "dueDate" < now() AND "dueDate" >= now() - interval '30 days'), 0)::float AS "days1to30",
      COALESCE(SUM(remaining) FILTER (WHERE "dueDate" < now() - interval '30 days' AND "dueDate" >= now() - interval '60 days'), 0)::float AS "days31to60",
      COALESCE(SUM(remaining) FILTER (WHERE "dueDate" < now() - interval '60 days'), 0)::float AS "days60plus"
    FROM (
      SELECT (i."total" - COALESCE(p."paid", 0)) * i."exchangeRate" AS remaining, i."dueDate"
      FROM "invoices" i
      LEFT JOIN (
        SELECT "invoiceId", SUM("amount") AS "paid"
        FROM "payments" WHERE "status" = 'APPROVED' GROUP BY "invoiceId"
      ) p ON p."invoiceId" = i."id"
      WHERE i."agencyId" = ${agencyId}
        AND i."docType" = 'FACTURE'
        AND i."status" IN ('SENT', 'EN_ATTENTE')
        AND i."total" - COALESCE(p."paid", 0) > 0.001
    ) t
  `;
  return row;
}

// Les 5 plus gros restes dus en retard : la liste de relance prioritaire.
async function getWorstOverdue(agencyId) {
  return prisma.$queryRaw`
    SELECT i."id", i."number", i."dueDate", c."name" AS "clientName",
           ((i."total" - COALESCE(p."paid", 0)) * i."exchangeRate")::float AS remaining,
           (EXTRACT(EPOCH FROM (now() - i."dueDate")) / 86400)::int AS "daysLate"
    FROM "invoices" i
    JOIN "clients" c ON c."id" = i."clientId"
    LEFT JOIN (
      SELECT "invoiceId", SUM("amount") AS "paid"
      FROM "payments" WHERE "status" = 'APPROVED' GROUP BY "invoiceId"
    ) p ON p."invoiceId" = i."id"
    WHERE i."agencyId" = ${agencyId}
      AND i."docType" = 'FACTURE'
      AND i."status" IN ('SENT', 'EN_ATTENTE')
      AND i."dueDate" IS NOT NULL AND i."dueDate" < now()
      AND i."total" - COALESCE(p."paid", 0) > 0.001
    ORDER BY remaining DESC
    LIMIT 5
  `;
}

// DSO pondéré par montant : chaque dinar encaissé « pèse » son délai réel
// émission→paiement — plus juste qu'une moyenne simple par facture.
async function getDso(agencyId, from, to) {
  const [row] = await prisma.$queryRaw`
    SELECT CASE
      WHEN SUM(p."amount" * i."exchangeRate") > 0 THEN
        (SUM((EXTRACT(EPOCH FROM (p."createdAt" - i."createdAt")) / 86400) * p."amount" * i."exchangeRate")
         / SUM(p."amount" * i."exchangeRate"))::float
      ELSE NULL
    END AS days
    FROM "payments" p
    JOIN "invoices" i ON i."id" = p."invoiceId"
    WHERE p."agencyId" = ${agencyId}
      AND p."status" = 'APPROVED'
      AND i."docType" = 'FACTURE'
      AND i."status" <> 'ANNULEE'
      AND p."createdAt" >= ${from} AND p."createdAt" <= ${to}
  `;
  return { days: row.days == null ? null : Math.round(row.days * 10) / 10 };
}

// Vue par client : encaissé (période), encours (photo), coûts directs
// (service_charges rattachées au client — non datées, comptées en totalité,
// 0 si non renseignées) et profit = encaissé − coûts directs. Les charges
// générales (loyer, salaires…) ne sont PAS ventilées par client : ce chiffre
// mesure la contribution du client, pas un résultat comptable.
async function getClientProfit(agencyId, from, to) {
  return prisma.$queryRaw`
    SELECT c."id" AS "clientId", c."name",
           COALESCE(r."received", 0)::float AS received,
           COALESCE(o."outstanding", 0)::float AS outstanding,
           COALESCE(ch."charges", 0)::float AS "directCosts",
           (COALESCE(r."received", 0) - COALESCE(ch."charges", 0))::float AS profit
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
    ORDER BY profit DESC
    LIMIT 20
  `;
}

function getBudgetRows(agencyId, months) {
  if (months.length === 0) return Promise.resolve([]);
  return prisma.budget.findMany({
    where: { agencyId, OR: months.map((m) => ({ year: m.year, month: m.month })) },
    orderBy: [{ year: "asc" }, { month: "asc" }],
  });
}

// Entrées attendues des 3 prochains mois : restes dus réels groupés par mois
// d'échéance. Hypothèse (affichée UI) : les factures échues ou sans échéance
// rentrent le mois courant ; au-delà de l'horizon, exclues.
async function getExpectedInflows(agencyId) {
  return prisma.$queryRaw`
    SELECT to_char(bucket, 'YYYY-MM') AS month, SUM(remaining)::float AS expected
    FROM (
      SELECT (i."total" - COALESCE(p."paid", 0)) * i."exchangeRate" AS remaining,
             date_trunc('month', CASE
               WHEN i."dueDate" IS NULL OR i."dueDate" < now() THEN now()
               ELSE i."dueDate"
             END) AS bucket
      FROM "invoices" i
      LEFT JOIN (
        SELECT "invoiceId", SUM("amount") AS "paid"
        FROM "payments" WHERE "status" = 'APPROVED' GROUP BY "invoiceId"
      ) p ON p."invoiceId" = i."id"
      WHERE i."agencyId" = ${agencyId}
        AND i."docType" = 'FACTURE'
        AND i."status" IN ('SENT', 'EN_ATTENTE')
        AND i."total" - COALESCE(p."paid", 0) > 0.001
    ) t
    WHERE bucket < date_trunc('month', now()) + interval '3 months'
    GROUP BY 1
    ORDER BY 1
  `;
}

async function getAvgMonthlyExpenses(agencyId) {
  const [row] = await prisma.$queryRaw`
    SELECT (COALESCE(SUM("amount" * "exchangeRate"), 0) / 3)::float AS avg
    FROM "expenses"
    WHERE "agencyId" = ${agencyId}
      AND "date" >= now() - interval '3 months'
  `;
  return row.avg;
}

// Dettes fournisseurs à payer : photo à l'instant T, convertie.
async function getPayables(agencyId) {
  const [row] = await prisma.$queryRaw`
    SELECT COALESCE(SUM("amount" * "exchangeRate"), 0)::float AS total,
           COUNT(*)::int AS count,
           COALESCE(SUM("amount" * "exchangeRate") FILTER (WHERE "dueDate" IS NOT NULL AND "dueDate" < now()), 0)::float AS overdue,
           (COUNT(*) FILTER (WHERE "dueDate" IS NOT NULL AND "dueDate" < now()))::int AS "overdueCount"
    FROM "supplier_bills"
    WHERE "agencyId" = ${agencyId} AND "status" = 'A_PAYER'
  `;
  return row;
}

// Échéancier fournisseurs des 3 prochains mois : mêmes conventions que les
// entrées attendues (échues ou sans échéance → mois courant).
async function getPayablesSchedule(agencyId) {
  return prisma.$queryRaw`
    SELECT to_char(bucket, 'YYYY-MM') AS month, SUM(due)::float AS due
    FROM (
      SELECT "amount" * "exchangeRate" AS due,
             date_trunc('month', CASE
               WHEN "dueDate" IS NULL OR "dueDate" < now() THEN now()
               ELSE "dueDate"
             END) AS bucket
      FROM "supplier_bills"
      WHERE "agencyId" = ${agencyId} AND "status" = 'A_PAYER'
    ) t
    WHERE bucket < date_trunc('month', now()) + interval '3 months'
    GROUP BY 1
    ORDER BY 1
  `;
}

async function getStatusBreakdown(agencyId) {
  const rows = await prisma.invoice.groupBy({
    by: ["status"],
    where: { agencyId, docType: "FACTURE" },
    _count: true,
  });
  return rows.map((r) => ({ status: r.status, count: r._count }));
}

// Top 5 clients par ENCAISSÉ sur la période (pas par facturé).
async function getTopClients(agencyId, from, to) {
  return prisma.$queryRaw`
    SELECT i."clientId", c."name",
           COALESCE(SUM(p."amount" * i."exchangeRate"), 0)::float AS received
    FROM "payments" p
    JOIN "invoices" i ON i."id" = p."invoiceId"
    JOIN "clients" c ON c."id" = i."clientId"
    WHERE p."agencyId" = ${agencyId}
      AND p."status" = 'APPROVED'
      AND i."docType" = 'FACTURE'
      AND i."status" <> 'ANNULEE'
      AND p."createdAt" >= ${from} AND p."createdAt" <= ${to}
    GROUP BY 1, 2
    ORDER BY 3 DESC
    LIMIT 5
  `;
}

module.exports = { getDashboard, getClientProfit };
