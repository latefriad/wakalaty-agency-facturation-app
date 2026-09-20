const prisma = require("../../config/database");
const { assertOwned } = require("../../utils/ownership");

const MONTHS = { MONTHLY: 1, QUARTERLY: 3, YEARLY: 12 };

function advance(date, frequency) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + MONTHS[frequency]);
  return next;
}

async function list(agencyId) {
  const rows = await prisma.recurringInvoice.findMany({
    where: { agencyId },
    orderBy: { createdAt: "desc" },
  });
  // Pas de relation Prisma clientId→Client (le client peut être supprimé) :
  // on joint les noms à la main.
  const clients = await prisma.client.findMany({
    where: { id: { in: rows.map((r) => r.clientId) } },
    select: { id: true, name: true },
  });
  const nameById = Object.fromEntries(clients.map((c) => [c.id, c.name]));
  return rows.map((r) => ({ ...r, clientName: nameById[r.clientId] || "?" }));
}

async function create(agencyId, { clientId, items, frequency = "MONTHLY", tax, discount = 0, notes, dueDays = 30, startDate }) {
  await assertOwned("client", clientId, agencyId, "Client");
  const nextRunAt = startDate ? new Date(startDate) : new Date();
  return prisma.recurringInvoice.create({
    data: { agencyId, clientId, items, frequency, tax: tax ?? 0, discount, notes, dueDays, nextRunAt },
  });
}

async function update(agencyId, id, data) {
  const existing = await prisma.recurringInvoice.findFirst({ where: { id, agencyId } });
  if (!existing) throw Object.assign(new Error("Récurrence introuvable"), { status: 404 });
  return prisma.recurringInvoice.update({ where: { id }, data });
}

async function remove(agencyId, id) {
  const existing = await prisma.recurringInvoice.findFirst({ where: { id, agencyId } });
  if (!existing) throw Object.assign(new Error("Récurrence introuvable"), { status: 404 });
  return prisma.recurringInvoice.delete({ where: { id } });
}

module.exports = { list, create, update, remove, advance };
