const prisma = require("../../config/database");

function getPeriodDates(period, customFrom, customTo) {
  const now = new Date();
  let from, to;

  switch (period) {
    case "today":
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      break;
    case "this_week": {
      const day = now.getDay() || 7; // Sunday is 0
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1);
      to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 6, 23, 59, 59);
      break;
    }
    case "this_month":
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      break;
    case "last_month":
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      break;
    case "this_year":
      from = new Date(now.getFullYear(), 0, 1);
      to = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      break;
    case "custom":
      from = customFrom ? new Date(customFrom) : new Date(now.getFullYear(), 0, 1);
      to = customTo ? new Date(customTo) : new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      if (to) {
        to.setHours(23, 59, 59, 999);
      }
      break;
    default: // fallback this month
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  }
  return { from, to };
}

async function getBenefits(agencyId, query = {}) {
  const { period, customFrom, customTo } = query;
  const { from, to } = getPeriodDates(period, customFrom, customTo);

  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: { openingBalance: true, currency: true },
  });

  const [
    payments,
    expenses,
    personalTx,
    allPayments,
    allExpenses,
    allPersonalTx
  ] = await Promise.all([
    prisma.payment.findMany({
      where: { agencyId, status: "APPROVED", createdAt: { gte: from, lte: to }, invoice: { docType: "FACTURE", status: { not: "ANNULEE" } } },
      include: { invoice: { select: { number: true, client: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" }
    }),
    prisma.expense.findMany({
      where: { agencyId, date: { gte: from, lte: to } },
      orderBy: { date: "desc" }
    }),
    prisma.personalTransaction.findMany({
      where: { agencyId, date: { gte: from, lte: to } },
      orderBy: { date: "desc" }
    }),
    prisma.payment.aggregate({
      where: { agencyId, status: "APPROVED", invoice: { docType: "FACTURE", status: { not: "ANNULEE" } } },
      _sum: { amount: true }
    }),
    prisma.expense.aggregate({
      where: { agencyId },
      _sum: { amount: true }
    }),
    prisma.personalTransaction.findMany({
      where: { agencyId },
      select: { type: true, amount: true, isPersonal: true }
    })
  ]);

  // Combine Transactions
  const unifiedTransactions = [];

  payments.forEach(p => {
    unifiedTransactions.push({
      id: p.id,
      originalId: p.id,
      date: p.createdAt.toISOString(),
      type: "REVENUE",
      category: "Client Payment",
      description: `Paiement sur facture ${p.invoice?.number || ""}`,
      amount: p.amount,
      paymentMethod: p.method || "Bank",
      clientName: p.invoice?.client?.name || null,
      sourceType: "payment",
      isEditable: false
    });
  });

  expenses.forEach(e => {
    unifiedTransactions.push({
      id: e.id,
      originalId: e.id,
      date: e.date.toISOString(),
      type: "EXPENSE",
      category: e.category,
      description: e.notes || "",
      amount: e.amount,
      paymentMethod: "Other",
      clientName: null,
      sourceType: "expense",
      isEditable: false
    });
  });

  personalTx.forEach(tx => {
    unifiedTransactions.push({
      id: tx.id,
      originalId: tx.id,
      date: tx.date.toISOString(),
      type: tx.type,
      category: tx.category,
      description: tx.description || "",
      amount: tx.amount,
      paymentMethod: tx.paymentMethod || "Cash",
      clientName: tx.source || null,
      sourceType: "manual",
      isEditable: true
    });
  });

  unifiedTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Compute Current Period KPIs
  let periodRevenues = 0;
  let periodExpenses = 0;
  let periodWithdrawals = 0;
  const expenseByCategory = {};

  unifiedTransactions.forEach(tx => {
    if (tx.type === "REVENUE") {
      periodRevenues += tx.amount;
    } else if (tx.type === "EXPENSE") {
      periodExpenses += tx.amount;
      expenseByCategory[tx.category] = (expenseByCategory[tx.category] || 0) + tx.amount;
    } else if (tx.type === "WITHDRAWAL") {
      periodWithdrawals += tx.amount;
    }
  });

  const netProfit = periodRevenues - periodExpenses;

  // Compute All-Time Available Balance
  let allTimeRevenues = allPayments._sum.amount || 0;
  let allTimeExpenses = allExpenses._sum.amount || 0;
  let allTimeWithdrawals = 0;

  allPersonalTx.forEach(tx => {
    if (tx.type === "REVENUE") allTimeRevenues += tx.amount;
    if (tx.type === "EXPENSE") allTimeExpenses += tx.amount;
    if (tx.type === "WITHDRAWAL") allTimeWithdrawals += tx.amount;
  });

  const availableBalance = (agency?.openingBalance || 0) + allTimeRevenues - allTimeExpenses - allTimeWithdrawals;

  // Monthly summary (for the charts & table)
  // We need to fetch the last 6 months regardless of the period filter to populate the chart.
  const monthlyTrend = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mFrom = new Date(d.getFullYear(), d.getMonth(), 1);
    const mTo = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    const mLabel = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

    const [mPayments, mExpenses, mPersonal] = await Promise.all([
      prisma.payment.aggregate({
        where: { agencyId, status: "APPROVED", createdAt: { gte: mFrom, lte: mTo }, invoice: { docType: "FACTURE" } },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: { agencyId, date: { gte: mFrom, lte: mTo } },
        _sum: { amount: true },
      }),
      prisma.personalTransaction.findMany({
        where: { agencyId, date: { gte: mFrom, lte: mTo } },
      })
    ]);

    let rev = mPayments._sum.amount || 0;
    let exp = mExpenses._sum.amount || 0;
    let wit = 0;

    mPersonal.forEach(tx => {
      if (tx.type === "REVENUE") rev += tx.amount;
      if (tx.type === "EXPENSE") exp += tx.amount;
      if (tx.type === "WITHDRAWAL") wit += tx.amount;
    });

    monthlyTrend.push({
      month: mLabel,
      revenue: rev,
      expenses: exp,
      profit: rev - exp,
      withdrawals: wit
    });
  }

  return {
    kpis: {
      availableBalance,
      netProfit,
      revenues: periodRevenues,
      expenses: periodExpenses,
      withdrawals: periodWithdrawals,
    },
    expenseByCategory,
    monthlyTrend,
    transactions: unifiedTransactions,
    currency: agency?.currency || "DZD",
  };
}

async function addPersonalTransaction(agencyId, data) {
  return prisma.personalTransaction.create({
    data: {
      agencyId,
      type: data.type,
      category: data.category || "Other",
      amount: Number(data.amount),
      date: data.date ? new Date(data.date) : new Date(),
      description: data.description,
      paymentMethod: data.paymentMethod,
      source: data.client, // we store client name in source
    }
  });
}

async function updatePersonalTransaction(agencyId, txId, data) {
  return prisma.personalTransaction.updateMany({
    where: { id: txId, agencyId },
    data: {
      type: data.type,
      category: data.category,
      amount: Number(data.amount),
      date: data.date ? new Date(data.date) : undefined,
      description: data.description,
      paymentMethod: data.paymentMethod,
      source: data.client,
    }
  });
}

async function deletePersonalTransaction(agencyId, txId) {
  return prisma.personalTransaction.deleteMany({
    where: { id: txId, agencyId },
  });
}

module.exports = {
  getBenefits,
  addPersonalTransaction,
  updatePersonalTransaction,
  deletePersonalTransaction
};
