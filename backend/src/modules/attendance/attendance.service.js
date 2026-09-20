const prisma = require("../../config/database");
const { audit } = require("../../utils/audit");

const EMPLOYEE_LITE = { id: true, name: true, position: true };

// Comme pour les congés : toutes les opérations self-service partent du
// token — impossible de pointer (ou consulter) pour un collègue.
async function getOwnEmployee(agencyId, userId) {
  const employee = await prisma.employee.findFirst({
    where: { agencyId, userId },
    select: { id: true, status: true },
  });
  if (!employee) {
    throw Object.assign(new Error("Aucune fiche employé liée à ce compte"), { status: 404 });
  }
  return employee;
}

function findOpenEntry(employeeId) {
  return prisma.timeEntry.findFirst({
    where: { employeeId, clockOut: null },
    orderBy: { clockIn: "desc" },
  });
}

// L'heure d'arrivée est CELLE DU SERVEUR : le client n'envoie qu'une note
// facultative — pas moyen d'antidater son pointage.
async function clockIn(agencyId, userId, { note }) {
  const employee = await getOwnEmployee(agencyId, userId);
  if (employee.status !== "ACTIVE") {
    throw Object.assign(new Error("Fiche employé désactivée"), { status: 403 });
  }

  const open = await findOpenEntry(employee.id);
  if (open) {
    throw Object.assign(new Error("Pointage déjà en cours — pointez d'abord votre départ"), { status: 409 });
  }

  return prisma.timeEntry.create({
    data: { clockIn: new Date(), note: note || null, employeeId: employee.id, agencyId },
  });
}

async function clockOut(agencyId, userId) {
  const employee = await getOwnEmployee(agencyId, userId);
  const open = await findOpenEntry(employee.id);
  if (!open) {
    throw Object.assign(new Error("Aucun pointage en cours"), { status: 409 });
  }

  const now = new Date();
  // updateMany conditionnel : un double clic ne ferme l'entrée qu'une fois
  // (même garde-fou que l'approbation des congés).
  const closed = await prisma.timeEntry.updateMany({
    where: { id: open.id, clockOut: null },
    data: { clockOut: now, minutes: Math.max(0, Math.round((now - open.clockIn) / 60000)) },
  });
  if (closed.count !== 1) {
    throw Object.assign(new Error("Aucun pointage en cours"), { status: 409 });
  }
  return prisma.timeEntry.findUnique({ where: { id: open.id } });
}

// Semaine algérienne : commence le dimanche.
function startOfWeek(d) {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  out.setDate(out.getDate() - out.getDay());
  return out;
}

async function myAttendance(agencyId, userId) {
  const employee = await getOwnEmployee(agencyId, userId);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekStart = startOfWeek(now);

  const [open, entries] = await Promise.all([
    findOpenEntry(employee.id),
    prisma.timeEntry.findMany({
      where: { employeeId: employee.id, clockIn: { gte: monthStart } },
      orderBy: { clockIn: "desc" },
      take: 100,
    }),
  ]);

  const sum = (rows) => rows.reduce((s, e) => s + (e.minutes || 0), 0);
  return {
    open,
    entries,
    totals: {
      weekMinutes: sum(entries.filter((e) => e.clockIn >= weekStart)),
      monthMinutes: sum(entries),
    },
  };
}

// Vue admin : présence de l'agence sur une période (défaut : aujourd'hui).
async function list(agencyId, { employeeId, from, to }) {
  const start = from ? new Date(from) : new Date(new Date().setHours(0, 0, 0, 0));
  const end = to ? new Date(new Date(to).setHours(23, 59, 59, 999)) : undefined;

  return prisma.timeEntry.findMany({
    where: {
      agencyId,
      ...(employeeId ? { employeeId } : {}),
      clockIn: { gte: start, ...(end ? { lte: end } : {}) },
    },
    include: { employee: { select: EMPLOYEE_LITE } },
    orderBy: { clockIn: "desc" },
    take: 300,
  });
}

// Correction admin (oubli de départ, erreur) : suppression uniquement, et
// auditée — pas d'édition d'horaires qui rendrait le pointage falsifiable
// silencieusement.
async function remove(agencyId, id, req) {
  const entry = await prisma.timeEntry.findFirst({
    where: { id, agencyId },
    include: { employee: { select: { name: true } } },
  });
  if (!entry) throw Object.assign(new Error("Pointage introuvable"), { status: 404 });
  await prisma.timeEntry.delete({ where: { id } });
  audit({
    action: "TIME_ENTRY_DELETED",
    req,
    targetType: "time_entry",
    targetId: id,
    details: { employee: entry.employee.name, clockIn: entry.clockIn, minutes: entry.minutes },
  });
}

module.exports = { clockIn, clockOut, myAttendance, list, remove };
