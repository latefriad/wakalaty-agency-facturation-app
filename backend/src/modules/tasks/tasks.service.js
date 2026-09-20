const prisma = require("../../config/database");
const { parsePagination } = require("../../utils/pagination");
const { assertOwned } = require("../../utils/ownership");
const { logClientEvent } = require("../../utils/clientEvents");

// Le Kanban charge toutes les cartes d'un coup : plafond relevé pour ce module
// (une agence dépasse rarement quelques centaines de tâches actives).
const MAX_LIMIT = 500;

const TASK_INCLUDE = {
  employee: { select: { id: true, name: true, userId: true } },
  client: { select: { id: true, name: true, company: true } },
};

function isAdminRole(role) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

// Employé (fiche RH) rattaché au compte connecté — null si aucun.
async function linkedEmployeeId(user) {
  const emp = await prisma.employee.findFirst({
    where: { userId: user.id, agencyId: user.agencyId },
    select: { id: true },
  });
  return emp ? emp.id : null;
}

// "En retard" est TOUJOURS calculé, jamais stocké : un statut stocké se
// périme (la tâche redevient "à faire" si l'échéance est repoussée) et
// écraserait le vrai statut au premier enregistrement.
function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function withOverdue(task) {
  const isOverdue =
    !!task.dueDate && task.status !== "DONE" && new Date(task.dueDate) < startOfToday();
  return { ...task, isOverdue };
}

function parseDates(data) {
  const out = { ...data };
  for (const field of ["startDate", "dueDate"]) {
    if (out[field] !== undefined && out[field] !== null) {
      out[field] = new Date(out[field]);
    }
  }
  return out;
}

function assertDateOrder(startDate, dueDate) {
  if (startDate && dueDate && startDate > dueDate) {
    throw Object.assign(new Error("La date de début doit précéder l'échéance"), { status: 400 });
  }
}

async function checkRefs(agencyId, data) {
  if (data.employeeId) await assertOwned("employee", data.employeeId, agencyId, "Employé");
  if (data.clientId) await assertOwned("client", data.clientId, agencyId, "Client");
}

// Filtres communs à toutes les vues (Kanban/liste/calendrier lisent la même
// requête). Un non-admin est restreint côté serveur à ses propres tâches :
// le filtrage côté client est contournable.
async function buildWhere(user, query) {
  const where = { agencyId: user.agencyId };

  if (query.search) {
    where.title = { contains: query.search, mode: "insensitive" };
  }
  if (query.status) where.status = query.status;
  if (query.priority) where.priority = query.priority;
  if (query.clientId) where.clientId = query.clientId;
  if (query.overdue === "1") {
    where.dueDate = { lt: startOfToday() };
    where.status = { not: "DONE" };
  }
  // Fenêtre calendrier : tâches dont l'échéance tombe dans [from, to].
  if (query.from || query.to) {
    where.dueDate = {
      ...(where.dueDate || {}),
      ...(query.from ? { gte: new Date(query.from) } : {}),
      ...(query.to ? { lte: new Date(query.to) } : {}),
    };
  }

  if (isAdminRole(user.role)) {
    if (query.employeeId) where.employeeId = query.employeeId;
  } else {
    const empId = await linkedEmployeeId(user);
    // Compte non relié à une fiche employé : aucune tâche visible (plutôt
    // que toutes — on échoue du côté restrictif).
    where.employeeId = empId || "__none__";
  }

  return where;
}

async function list(user, req) {
  const { page, limit, skip } = parsePagination(req, MAX_LIMIT);
  const where = await buildWhere(user, req.query);

  const [data, total] = await Promise.all([
    prisma.task.findMany({
      where,
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      skip,
      take: limit,
      include: TASK_INCLUDE,
    }),
    prisma.task.count({ where }),
  ]);

  return { data: data.map(withOverdue), total, page, limit };
}

// Vue "Mon travail" : les tâches de l'employé lié au compte, découpées
// côté serveur en retard / aujourd'hui / à venir / sans échéance.
async function myWork(user) {
  const empId = await linkedEmployeeId(user);
  if (!empId) {
    return { linked: false, overdue: [], today: [], upcoming: [], noDate: [], doneCount: 0 };
  }

  const today = startOfToday();
  const tomorrow = new Date(today.getTime() + 86400000);

  const [open, doneCount] = await Promise.all([
    prisma.task.findMany({
      where: { agencyId: user.agencyId, employeeId: empId, status: { not: "DONE" } },
      orderBy: [{ dueDate: "asc" }, { priority: "asc" }],
      take: MAX_LIMIT,
      include: TASK_INCLUDE,
    }),
    prisma.task.count({
      where: { agencyId: user.agencyId, employeeId: empId, status: "DONE" },
    }),
  ]);

  const groups = { overdue: [], today: [], upcoming: [], noDate: [] };
  for (const raw of open) {
    const task = withOverdue(raw);
    if (!task.dueDate) groups.noDate.push(task);
    else if (task.isOverdue) groups.overdue.push(task);
    else if (new Date(task.dueDate) < tomorrow) groups.today.push(task);
    else groups.upcoming.push(task);
  }

  return { linked: true, ...groups, doneCount };
}

async function getById(user, id) {
  const where = { id, agencyId: user.agencyId };
  if (!isAdminRole(user.role)) {
    where.employeeId = (await linkedEmployeeId(user)) || "__none__";
  }
  const task = await prisma.task.findFirst({ where, include: TASK_INCLUDE });
  if (!task) throw Object.assign(new Error("Tâche introuvable"), { status: 404 });
  return withOverdue(task);
}

async function create(user, data) {
  const parsed = parseDates(data);
  assertDateOrder(parsed.startDate, parsed.dueDate);
  await checkRefs(user.agencyId, parsed);
  const task = await prisma.task.create({
    data: { ...parsed, agencyId: user.agencyId },
    include: TASK_INCLUDE,
  });
  // Timeline client : point d'écriture unique, best-effort (n'échoue jamais
  // l'opération). Conserve le comportement du module d'origine.
  if (task.clientId) {
    await logClientEvent(prisma, {
      agencyId: user.agencyId,
      clientId: task.clientId,
      type: "TASK_CREATED",
      message: task.title,
      meta: { taskId: task.id, dueDate: task.dueDate },
    });
  }
  return withOverdue(task);
}

// Champs qu'un non-admin peut modifier sur SES tâches : déplacer une carte
// dans le Kanban, rien d'autre (le contenu reste sous contrôle admin).
const EMPLOYEE_PATCHABLE = new Set(["status", "order"]);

async function update(user, id, data) {
  const existing = await prisma.task.findFirst({ where: { id, agencyId: user.agencyId } });
  if (!existing) throw Object.assign(new Error("Tâche introuvable"), { status: 404 });

  if (!isAdminRole(user.role)) {
    const empId = await linkedEmployeeId(user);
    if (!empId || existing.employeeId !== empId) {
      throw Object.assign(new Error("Accès interdit"), { status: 403 });
    }
    const forbidden = Object.keys(data).filter((k) => !EMPLOYEE_PATCHABLE.has(k));
    if (forbidden.length > 0) {
      throw Object.assign(
        new Error("Un employé ne peut modifier que le statut de ses tâches"),
        { status: 403 }
      );
    }
  }

  const parsed = parseDates(data);
  assertDateOrder(
    parsed.startDate !== undefined ? parsed.startDate : existing.startDate,
    parsed.dueDate !== undefined ? parsed.dueDate : existing.dueDate
  );
  await checkRefs(user.agencyId, parsed);

  const task = await prisma.task.update({
    where: { id },
    data: parsed,
    include: TASK_INCLUDE,
  });
  return withOverdue(task);
}

async function remove(agencyId, id) {
  const existing = await prisma.task.findFirst({ where: { id, agencyId } });
  if (!existing) throw Object.assign(new Error("Tâche introuvable"), { status: 404 });
  return prisma.task.delete({ where: { id } });
}

module.exports = { list, myWork, getById, create, update, remove };
