const prisma = require("../../config/database");
const { audit } = require("../../utils/audit");

const SELECT = { id: true, year: true, month: true, revenueTarget: true, expenseBudgets: true, updatedAt: true };

async function listYear(agencyId, year) {
  return prisma.budget.findMany({
    where: { agencyId, year },
    select: SELECT,
    orderBy: { month: "asc" },
  });
}

// Upsert : un budget par (agence, année, mois) — re-saisir écrase, simple et
// prévisible. Toute modification est auditée (le budget pilote des décisions).
async function upsert(agencyId, year, month, { revenueTarget, expenseBudgets }, req) {
  const budget = await prisma.budget.upsert({
    where: { agencyId_year_month: { agencyId, year, month } },
    create: { agencyId, year, month, revenueTarget, expenseBudgets: expenseBudgets || null },
    update: { revenueTarget, expenseBudgets: expenseBudgets || null },
    select: SELECT,
  });
  audit({
    action: "BUDGET_UPSERTED",
    req,
    targetType: "budget",
    targetId: budget.id,
    details: { year, month, revenueTarget },
  });
  return budget;
}

async function remove(agencyId, year, month, req) {
  const existing = await prisma.budget.findUnique({
    where: { agencyId_year_month: { agencyId, year, month } },
  });
  if (!existing) throw Object.assign(new Error("Budget introuvable"), { status: 404 });
  await prisma.budget.delete({ where: { id: existing.id } });
  audit({ action: "BUDGET_DELETED", req, targetType: "budget", targetId: existing.id, details: { year, month } });
}

module.exports = { listYear, upsert, remove };
