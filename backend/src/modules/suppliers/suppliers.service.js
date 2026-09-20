const prisma = require("../../config/database");
const { audit } = require("../../utils/audit");

const BILL_INCLUDE = { supplier: { select: { id: true, name: true } } };

// ─── Fournisseurs ────────────────────────────────────────────────────────

async function listSuppliers(agencyId) {
  const suppliers = await prisma.supplier.findMany({
    where: { agencyId },
    orderBy: { name: "asc" },
  });
  // Encours à payer par fournisseur, en une requête agrégée.
  const outstanding = await prisma.$queryRaw`
    SELECT "supplierId", COALESCE(SUM("amount" * "exchangeRate"), 0)::float AS total, COUNT(*)::int AS count
    FROM "supplier_bills"
    WHERE "agencyId" = ${agencyId} AND "status" = 'A_PAYER'
    GROUP BY "supplierId"
  `;
  const byId = Object.fromEntries(outstanding.map((r) => [r.supplierId, r]));
  return suppliers.map((s) => ({
    ...s,
    outstanding: byId[s.id]?.total || 0,
    pendingBills: byId[s.id]?.count || 0,
  }));
}

async function createSupplier(agencyId, data, req) {
  const supplier = await prisma.supplier.create({ data: { ...data, agencyId } });
  audit({ action: "SUPPLIER_CREATED", req, targetType: "supplier", targetId: supplier.id, details: { name: supplier.name } });
  return supplier;
}

async function updateSupplier(agencyId, id, data, req) {
  const existing = await prisma.supplier.findFirst({ where: { id, agencyId } });
  if (!existing) throw Object.assign(new Error("Fournisseur introuvable"), { status: 404 });
  const supplier = await prisma.supplier.update({ where: { id }, data });
  audit({ action: "SUPPLIER_UPDATED", req, targetType: "supplier", targetId: id });
  return supplier;
}

// Un fournisseur avec des factures porte de l'historique de dettes : on
// refuse la suppression plutôt que d'effacer silencieusement des engagements.
async function removeSupplier(agencyId, id, req) {
  const existing = await prisma.supplier.findFirst({
    where: { id, agencyId },
    include: { _count: { select: { bills: true } } },
  });
  if (!existing) throw Object.assign(new Error("Fournisseur introuvable"), { status: 404 });
  if (existing._count.bills > 0) {
    throw Object.assign(new Error("Ce fournisseur a des factures — annulez-les d'abord"), { status: 409 });
  }
  await prisma.supplier.delete({ where: { id } });
  audit({ action: "SUPPLIER_DELETED", req, targetType: "supplier", targetId: id, details: { name: existing.name } });
}

// ─── Factures fournisseurs (échéancier) ──────────────────────────────────

async function listBills(agencyId, { status }) {
  return prisma.supplierBill.findMany({
    where: { agencyId, ...(status ? { status } : {}) },
    include: BILL_INCLUDE,
    // Échéancier : les plus urgentes d'abord (sans échéance à la fin).
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    take: 200,
  });
}

async function createBill(agencyId, supplierId, data, req) {
  const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, agencyId }, select: { id: true, name: true } });
  if (!supplier) throw Object.assign(new Error("Fournisseur introuvable"), { status: 404 });

  const bill = await prisma.supplierBill.create({
    data: {
      ...data,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      supplierId,
      agencyId,
    },
    include: BILL_INCLUDE,
  });
  audit({ action: "SUPPLIER_BILL_CREATED", req, targetType: "supplier_bill", targetId: bill.id, details: { supplier: supplier.name, amount: bill.amount } });
  return bill;
}

async function updateBill(agencyId, id, data, req) {
  const existing = await prisma.supplierBill.findFirst({ where: { id, agencyId } });
  if (!existing) throw Object.assign(new Error("Facture introuvable"), { status: 404 });
  // Une facture payée est de l'historique comptable : plus modifiable.
  if (existing.status !== "A_PAYER") {
    throw Object.assign(new Error("Seule une facture à payer est modifiable"), { status: 400 });
  }
  const bill = await prisma.supplierBill.update({
    where: { id },
    data: { ...data, ...(data.dueDate !== undefined ? { dueDate: data.dueDate ? new Date(data.dueDate) : null } : {}) },
    include: BILL_INCLUDE,
  });
  audit({ action: "SUPPLIER_BILL_UPDATED", req, targetType: "supplier_bill", targetId: id, details: { fields: Object.keys(data) } });
  return bill;
}

// Payer = LE décaissement : création de la dépense (module expenses) et
// passage PAYEE dans la même transaction — la trésorerie et le bénéfice du
// dashboard restent alimentés par la seule table expenses (pas de double
// comptage). Le updateMany conditionnel rend le paiement idempotent.
async function payBill(agencyId, userId, id, req) {
  const bill = await prisma.supplierBill.findFirst({ where: { id, agencyId }, include: BILL_INCLUDE });
  if (!bill) throw Object.assign(new Error("Facture introuvable"), { status: 404 });

  const paid = await prisma.$transaction(async (tx) => {
    const claimed = await tx.supplierBill.updateMany({
      where: { id, status: "A_PAYER" },
      data: { status: "PAYEE", paidAt: new Date() },
    });
    if (claimed.count !== 1) {
      throw Object.assign(new Error("Facture déjà payée ou annulée"), { status: 409 });
    }

    const expense = await tx.expense.create({
      data: {
        amount: bill.amount,
        currency: bill.currency,
        exchangeRate: bill.exchangeRate,
        category: bill.category,
        date: new Date(),
        notes: `Fournisseur ${bill.supplier.name}${bill.reference ? ` — ${bill.reference}` : ""}`,
        agencyId,
        createdById: userId,
      },
    });

    return tx.supplierBill.update({ where: { id }, data: { expenseId: expense.id }, include: BILL_INCLUDE });
  });

  audit({ action: "SUPPLIER_BILL_PAID", req, targetType: "supplier_bill", targetId: id, details: { supplier: bill.supplier.name, amount: bill.amount } });
  return paid;
}

async function cancelBill(agencyId, id, req) {
  // Une facture payée a créé sa dépense : l'annuler créerait un écart entre
  // l'échéancier et la trésorerie — on ne peut annuler qu'un engagement.
  const result = await prisma.supplierBill.updateMany({
    where: { id, agencyId, status: "A_PAYER" },
    data: { status: "ANNULEE" },
  });
  if (result.count !== 1) {
    throw Object.assign(new Error("Facture introuvable ou déjà traitée"), { status: 404 });
  }
  audit({ action: "SUPPLIER_BILL_CANCELLED", req, targetType: "supplier_bill", targetId: id });
  return prisma.supplierBill.findUnique({ where: { id }, include: BILL_INCLUDE });
}

module.exports = {
  listSuppliers,
  createSupplier,
  updateSupplier,
  removeSupplier,
  listBills,
  createBill,
  updateBill,
  payBill,
  cancelBill,
};
