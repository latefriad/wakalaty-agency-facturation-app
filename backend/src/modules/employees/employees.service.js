const fs = require("fs");
const path = require("path");
const prisma = require("../../config/database");
const { parsePagination } = require("../../utils/pagination");
const { audit } = require("../../utils/audit");

// Hors de src/uploads : ce dossier-là est servi statiquement (public). Les
// documents RH ne sont accessibles QUE via les routes authentifiées.
const DOCS_DIR = path.join(__dirname, "../../../storage/employee-docs");

// ─── Sérialisation à deux niveaux (allow-list) ──────────────────────────
// PUBLIC : ce qu'un membre connecté quelconque de l'agence peut voir
// (assignation de tâches, organigramme). Jamais de données RH.
// RH : la fiche complète, salaire et commissions compris — réservée aux rôles
// RH (ADMIN/SUPER_ADMIN) et à l'intéressé sur SA propre fiche via /me.
// On liste explicitement ce qui SORT plutôt que d'exclure : un futur champ
// sensible ajouté au modèle ne fuira pas tant qu'il n'est pas listé ici.
const PUBLIC_SELECT = { id: true, name: true, position: true, userId: true };
const HR_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  position: true,
  salary: true,
  jobType: true,
  hireDate: true,
  contractType: true,
  commissionRate: true,
  commissionBalance: true,
  commissionPaid: true,
  isPaid: true,
  paymentDate: true,
  status: true,
  offboardedAt: true,
  managerId: true,
  manager: { select: { id: true, name: true } },
  userId: true,
  createdAt: true,
  updatedAt: true,
};

// Métadonnées de document renvoyées à l'API : jamais le nom de fichier
// physique (interne au serveur).
const DOC_SELECT = { id: true, name: true, mimeType: true, size: true, createdAt: true };

// La fiche RH contient le salaire : chaque lecture est journalisée (qui,
// quand, quoi), y compris la consultation de sa propre fiche.
async function list(agencyId, req) {
  const { page, limit, search, skip } = parsePagination(req);

  const where = {
    agencyId,
    ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.employee.findMany({ where, select: HR_SELECT, orderBy: { createdAt: "desc" }, skip, take: limit }),
    prisma.employee.count({ where }),
  ]);

  audit({ action: "EMPLOYEE_LIST_VIEWED", req, targetType: "employee", details: { count: data.length } });

  return { data, total, page, limit };
}

async function getById(agencyId, id, req) {
  const employee = await prisma.employee.findFirst({ where: { id, agencyId }, select: HR_SELECT });
  if (!employee) throw Object.assign(new Error("Employé introuvable"), { status: 404 });
  audit({ action: "EMPLOYEE_VIEWED", req, targetType: "employee", targetId: id });
  return employee;
}

// Fiche de l'employé CONNECTÉ (self-service). L'identité vient du token
// (jamais d'un paramètre) : impossible de demander la fiche d'un autre.
async function getMyProfile(agencyId, userId, req) {
  const employee = await prisma.employee.findFirst({ where: { agencyId, userId }, select: HR_SELECT });
  if (!employee) throw Object.assign(new Error("Aucune fiche employé liée à ce compte"), { status: 404 });
  audit({ action: "EMPLOYEE_VIEWED", req, targetType: "employee", targetId: employee.id, details: { self: true } });
  return employee;
}

// Commissions du freelance connecté : remplace l'ancien accès du dashboard
// employé à GET /services (qui exposait les commissions de tout le monde).
async function getMyCommissions(agencyId, userId) {
  const employee = await prisma.employee.findFirst({ where: { agencyId, userId }, select: { id: true } });
  if (!employee) throw Object.assign(new Error("Aucune fiche employé liée à ce compte"), { status: 404 });
  return prisma.service.findMany({
    where: { agencyId, freelancerId: employee.id, commissionAmount: { gt: 0 } },
    select: { id: true, name: true, commissionAmount: true, commissionType: true, commissionValue: true },
    orderBy: { name: "asc" },
  });
}

// Liste allégée pour l'assignation de tâches : uniquement l'identité, pas
// les données RH (salaires, commissions) réservées aux admins.
async function listAssignable(agencyId) {
  return prisma.employee.findMany({
    // Un employé parti (offboardé) ne doit plus recevoir de tâches.
    where: { agencyId, status: "ACTIVE" },
    select: PUBLIC_SELECT,
    orderBy: { name: "asc" },
  });
}

// Rattache la fiche employé au compte utilisateur dont l'e-mail correspond
// dans la même agence — le pont qui permet à un employé connecté de voir
// SES tâches. Silencieux si aucun compte ne correspond (employé sans accès).
async function autoLinkUser(employee) {
  if (employee.userId || !employee.email) return employee;
  const user = await prisma.user.findFirst({
    where: {
      agencyId: employee.agencyId,
      email: { equals: employee.email, mode: "insensitive" },
      employee: null,
    },
    select: { id: true },
  });
  if (!user) return employee;
  return prisma.employee.update({ where: { id: employee.id }, data: { userId: user.id }, select: HR_SELECT });
}

// Convertit la date d'embauche reçue en chaîne (input date du front) en Date
// pour Prisma. Zod a déjà validé le format.
function normalizeDates(data) {
  const out = { ...data };
  if (out.hireDate !== undefined) out.hireDate = out.hireDate ? new Date(out.hireDate) : null;
  return out;
}

// Garde-fous hiérarchie : le manager doit exister dans la MÊME agence, ne pas
// être l'employé lui-même, et ne pas créer de boucle (A manage B qui manage A) —
// sinon l'organigramme et la validation des congés tournent en rond.
async function assertValidManager(agencyId, employeeId, managerId) {
  if (!managerId) return;
  if (employeeId && managerId === employeeId) {
    throw Object.assign(new Error("Un employé ne peut pas être son propre manager"), { status: 400 });
  }
  const manager = await prisma.employee.findFirst({
    where: { id: managerId, agencyId },
    select: { id: true, managerId: true },
  });
  if (!manager) throw Object.assign(new Error("Manager introuvable"), { status: 404 });

  let current = manager;
  let hops = 0;
  while (current?.managerId && hops < 50) {
    if (employeeId && current.managerId === employeeId) {
      throw Object.assign(new Error("Hiérarchie circulaire"), { status: 400 });
    }
    current = await prisma.employee.findUnique({ where: { id: current.managerId }, select: { managerId: true } });
    hops += 1;
  }
}

async function create(agencyId, data, req) {
  await assertValidManager(agencyId, null, data.managerId);
  const employee = await prisma.employee.create({
    data: { ...normalizeDates(data), agencyId },
    select: { ...HR_SELECT, agencyId: true },
  });
  audit({
    action: "EMPLOYEE_CREATED",
    req,
    targetType: "employee",
    targetId: employee.id,
    details: { name: employee.name, salarySet: data.salary != null },
  });
  const linked = await autoLinkUser(employee);
  const { agencyId: _drop, ...rest } = linked;
  return rest;
}

async function update(agencyId, id, data, req) {
  const existing = await prisma.employee.findFirst({ where: { id, agencyId } });
  if (!existing) throw Object.assign(new Error("Employé introuvable"), { status: 404 });
  if (data.managerId !== undefined) await assertValidManager(agencyId, id, data.managerId);

  const clean = normalizeDates(data);
  const employee = await prisma.employee.update({ where: { id }, data: clean, select: { ...HR_SELECT, agencyId: true } });

  const changedFields = Object.keys(data).filter((k) => {
    const before = existing[k] instanceof Date ? existing[k].toISOString() : existing[k];
    const after = clean[k] instanceof Date ? clean[k].toISOString() : clean[k];
    return before !== after;
  });
  audit({ action: "EMPLOYEE_UPDATED", req, targetType: "employee", targetId: id, details: { fields: changedFields } });
  // Événement dédié pour les changements de salaire, avec avant/après : le
  // journal (réservé aux admins) doit permettre de reconstituer qui a payé
  // quoi et quand en cas de litige.
  if (data.salary !== undefined && existing.salary !== data.salary) {
    audit({
      action: "EMPLOYEE_SALARY_UPDATED",
      req,
      targetType: "employee",
      targetId: id,
      details: { from: existing.salary, to: data.salary },
    });
  }

  const linked = await autoLinkUser(employee);
  const { agencyId: _drop, ...rest } = linked;
  return rest;
}

// Offboarding : révoque l'accès (compte désactivé — effet immédiat, le
// middleware auth relit isActive à chaque requête) SANS suppression : les
// tâches, commissions et l'historique d'audit restent rattachés à la fiche.
async function offboard(agencyId, id, req) {
  const existing = await prisma.employee.findFirst({ where: { id, agencyId } });
  if (!existing) throw Object.assign(new Error("Employé introuvable"), { status: 404 });
  // Un admin ne peut pas s'offboarder lui-même (agence sans administrateur).
  if (existing.userId && existing.userId === req.user.id) {
    throw Object.assign(new Error("Impossible de désactiver son propre compte"), { status: 400 });
  }

  const employee = await prisma.$transaction(async (tx) => {
    const emp = await tx.employee.update({
      where: { id },
      data: { status: "OFFBOARDED", offboardedAt: new Date() },
      select: HR_SELECT,
    });
    if (existing.userId) {
      await tx.user.update({ where: { id: existing.userId }, data: { isActive: false } });
    }
    return emp;
  });

  audit({ action: "EMPLOYEE_OFFBOARDED", req, targetType: "employee", targetId: id, details: { name: existing.name } });
  return employee;
}

async function reactivate(agencyId, id, req) {
  const existing = await prisma.employee.findFirst({ where: { id, agencyId } });
  if (!existing) throw Object.assign(new Error("Employé introuvable"), { status: 404 });

  const employee = await prisma.$transaction(async (tx) => {
    const emp = await tx.employee.update({
      where: { id },
      data: { status: "ACTIVE", offboardedAt: null },
      select: HR_SELECT,
    });
    if (existing.userId) {
      await tx.user.update({ where: { id: existing.userId }, data: { isActive: true } });
    }
    return emp;
  });

  audit({ action: "EMPLOYEE_REACTIVATED", req, targetType: "employee", targetId: id, details: { name: existing.name } });
  return employee;
}

async function remove(agencyId, id, req) {
  const existing = await prisma.employee.findFirst({ where: { id, agencyId } });
  if (!existing) throw Object.assign(new Error("Employé introuvable"), { status: 404 });
  await prisma.employee.delete({ where: { id } });
  audit({ action: "EMPLOYEE_DELETED", req, targetType: "employee", targetId: id, details: { name: existing.name } });
}

// ─── Documents RH ────────────────────────────────────────────────────────

async function assertEmployeeInAgency(agencyId, employeeId) {
  const employee = await prisma.employee.findFirst({ where: { id: employeeId, agencyId }, select: { id: true } });
  if (!employee) throw Object.assign(new Error("Employé introuvable"), { status: 404 });
  return employee;
}

async function listDocuments(agencyId, employeeId) {
  await assertEmployeeInAgency(agencyId, employeeId);
  return prisma.employeeDocument.findMany({
    where: { employeeId, agencyId },
    select: DOC_SELECT,
    orderBy: { createdAt: "desc" },
  });
}

async function listMyDocuments(agencyId, userId) {
  const employee = await prisma.employee.findFirst({ where: { agencyId, userId }, select: { id: true } });
  if (!employee) throw Object.assign(new Error("Aucune fiche employé liée à ce compte"), { status: 404 });
  return listDocuments(agencyId, employee.id);
}

async function addDocument(agencyId, employeeId, file, name, req) {
  await assertEmployeeInAgency(agencyId, employeeId);
  const doc = await prisma.employeeDocument.create({
    data: {
      name: (name || file.originalname || "Document").slice(0, 200),
      filename: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      employeeId,
      agencyId,
      uploadedById: req.user.id,
    },
    select: DOC_SELECT,
  });
  audit({ action: "EMPLOYEE_DOC_UPLOADED", req, targetType: "employee_document", targetId: doc.id, details: { employeeId, name: doc.name } });
  return doc;
}

// Renvoie le chemin physique pour res.download après contrôle d'accès.
// `ownerUserId` : en self-service, le document doit appartenir à la fiche de
// l'utilisateur connecté — pas de docId d'un collègue.
async function getDocumentFile(agencyId, docId, { employeeId, ownerUserId }, req) {
  const where = { id: docId, agencyId };
  if (employeeId) where.employeeId = employeeId;
  if (ownerUserId) where.employee = { userId: ownerUserId };

  const doc = await prisma.employeeDocument.findFirst({
    where,
    select: { id: true, name: true, filename: true, mimeType: true, employeeId: true },
  });
  if (!doc) throw Object.assign(new Error("Document introuvable"), { status: 404 });

  const filePath = path.join(DOCS_DIR, doc.filename);
  if (!fs.existsSync(filePath)) {
    throw Object.assign(new Error("Fichier absent du serveur"), { status: 410 });
  }

  audit({
    action: "EMPLOYEE_DOC_DOWNLOADED",
    req,
    targetType: "employee_document",
    targetId: doc.id,
    details: { employeeId: doc.employeeId, self: Boolean(ownerUserId) },
  });
  return { filePath, name: doc.name, mimeType: doc.mimeType };
}

async function removeDocument(agencyId, employeeId, docId, req) {
  const doc = await prisma.employeeDocument.findFirst({
    where: { id: docId, agencyId, employeeId },
    select: { id: true, filename: true, name: true },
  });
  if (!doc) throw Object.assign(new Error("Document introuvable"), { status: 404 });
  await prisma.employeeDocument.delete({ where: { id: doc.id } });
  // Suppression du fichier best-effort : la ligne en base fait foi.
  fs.promises.unlink(path.join(DOCS_DIR, doc.filename)).catch(() => {});
  audit({ action: "EMPLOYEE_DOC_DELETED", req, targetType: "employee_document", targetId: docId, details: { employeeId, name: doc.name } });
}

module.exports = {
  list,
  listAssignable,
  getById,
  getMyProfile,
  getMyCommissions,
  create,
  update,
  offboard,
  reactivate,
  remove,
  listDocuments,
  listMyDocuments,
  addDocument,
  getDocumentFile,
  removeDocument,
  DOCS_DIR,
};
