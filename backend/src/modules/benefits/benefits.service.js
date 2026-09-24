const prisma = require("../../config/database");

/**
 * GET /api/benefits?year=2025&month=2025-09
 *
 * Returns a complete financial picture for the agency owner:
 * - Revenue collected (payments APPROVED)
 * - Total invoiced
 * - Total expenses (all categories)
 * - Ad spend margin (amountBilled - actualSpend from AdSpendEntry)
 * - Employee salaries total
 * - Net profit = revenue - expenses
 * - Breakdown by expense category
 * - Monthly trend (last 6 months)
 */
async function getBenefits(agencyId, { month, year } = {}) {
  const now = new Date();

  // Determine date range
  let from, to;
  if (month) {
    // YYYY-MM → first day of month to last day
    const [y, m] = month.split("-").map(Number);
    from = new Date(y, m - 1, 1);
    to = new Date(y, m, 0, 23, 59, 59);
  } else if (year) {
    from = new Date(Number(year), 0, 1);
    to = new Date(Number(year), 11, 31, 23, 59, 59);
  } else {
    // Current month by default
    from = new Date(now.getFullYear(), now.getMonth(), 1);
    to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  }

  const [payments, invoices, expenses, adSpendEntries, employees, allTimePayments, allTimeExpenses] =
    await Promise.all([
      // Revenue collected (APPROVED payments on FACTURE invoices)
      prisma.payment.findMany({
        where: {
          agencyId,
          status: "APPROVED",
          createdAt: { gte: from, lte: to },
          invoice: { docType: "FACTURE", status: { not: "ANNULEE" } },
        },
        select: { amount: true, createdAt: true },
      }),

      // Invoiced (finalized, not draft/cancelled) for the period
      prisma.invoice.findMany({
        where: {
          agencyId,
          docType: "FACTURE",
          status: { notIn: ["DRAFT", "ANNULEE"] },
          createdAt: { gte: from, lte: to },
        },
        select: { total: true, status: true },
      }),

      // All expenses for the period
      prisma.expense.findMany({
        where: {
          agencyId,
          date: { gte: from, lte: to },
        },
        select: { amount: true, category: true, notes: true },
      }),

      // Ad spend entries for the period
      prisma.adSpendEntry.findMany({
        where: {
          agencyId,
          month: month
            ? month
            : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
        },
        select: {
          actualSpend: true,
          amountBilled: true,
          platform: true,
          campaignName: true,
          clientAdBudget: true,
          revenueGenerated: true,
          orders: true,
        },
      }),

      // Employee salaries
      prisma.employee.findMany({
        where: { agencyId, status: "ACTIVE" },
        select: { salary: true, name: true, position: true },
      }),

      // All-time revenue (for treasury)
      prisma.payment.aggregate({
        where: { agencyId, status: "APPROVED", invoice: { docType: "FACTURE", status: { not: "ANNULEE" } } },
        _sum: { amount: true },
      }),

      // All-time expenses
      prisma.expense.aggregate({
        where: { agencyId },
        _sum: { amount: true },
      }),
    ]);

  // ── Revenue ───────────────────────────────────────────
  const totalCollected = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const totalInvoiced = invoices.reduce((s, i) => s + (i.total || 0), 0);
  const totalPending = totalInvoiced - totalCollected;

  // ── Expenses breakdown ────────────────────────────────
  const expByCategory = {};
  let totalExpenses = 0;
  for (const e of expenses) {
    const cat = e.category || "AUTRE";
    expByCategory[cat] = (expByCategory[cat] || 0) + (e.amount || 0);
    totalExpenses += e.amount || 0;
  }

  // ── Ad Spend margin ───────────────────────────────────
  const totalAdSpend = adSpendEntries.reduce((s, e) => s + (e.actualSpend || 0), 0);
  const totalAdBilled = adSpendEntries.reduce((s, e) => s + (e.amountBilled || 0), 0);
  const totalAdMargin = totalAdBilled - totalAdSpend;
  const totalAdRevenue = adSpendEntries.reduce((s, e) => s + (e.revenueGenerated || 0), 0);
  const totalAdOrders = adSpendEntries.reduce((s, e) => s + (e.orders || 0), 0);
  const avgROAS = totalAdSpend > 0 ? totalAdRevenue / totalAdSpend : 0;

  // ── Salaries ──────────────────────────────────────────
  const totalSalaries = employees.reduce((s, e) => s + (e.salary || 0), 0);

  // ── Profit ───────────────────────────────────────────
  // Net profit = collected revenue - all expenses
  const netProfit = totalCollected - totalExpenses;
  const profitMargin = totalCollected > 0 ? (netProfit / totalCollected) * 100 : 0;

  // ── All-time treasury ─────────────────────────────────
  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: { openingBalance: true, currency: true },
  });
  const allTimeRev = allTimePayments._sum.amount || 0;
  const allTimeExp = allTimeExpenses._sum.amount || 0;
  const treasury = (agency?.openingBalance || 0) + allTimeRev - allTimeExp;

  // ── Monthly trend (last 6 months) ────────────────────
  const monthlyTrend = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mFrom = new Date(d.getFullYear(), d.getMonth(), 1);
    const mTo = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    const mLabel = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

    const [mPayments, mExpenses] = await Promise.all([
      prisma.payment.aggregate({
        where: { agencyId, status: "APPROVED", createdAt: { gte: mFrom, lte: mTo }, invoice: { docType: "FACTURE" } },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: { agencyId, date: { gte: mFrom, lte: mTo } },
        _sum: { amount: true },
      }),
    ]);

    const rev = mPayments._sum.amount || 0;
    const exp = mExpenses._sum.amount || 0;
    monthlyTrend.push({ month: mLabel, revenue: rev, expenses: exp, profit: rev - exp });
  }

  return {
    period: { from: from.toISOString(), to: to.toISOString(), month, year },
    revenue: {
      collected: totalCollected,
      invoiced: totalInvoiced,
      pending: Math.max(0, totalPending),
    },
    expenses: {
      total: totalExpenses,
      byCategory: expByCategory,
      salaries: totalSalaries,
    },
    adSpend: {
      totalSpent: totalAdSpend,
      totalBilled: totalAdBilled,
      margin: totalAdMargin,
      revenue: totalAdRevenue,
      orders: totalAdOrders,
      avgROAS: Math.round(avgROAS * 100) / 100,
    },
    profit: {
      net: netProfit,
      margin: Math.round(profitMargin * 10) / 10,
    },
    treasury,
    currency: agency?.currency || "DZD",
    monthlyTrend,
    employees: employees.map((e) => ({ name: e.name, role: e.position, salary: e.salary || 0 })),
  };
}

module.exports = { getBenefits };
