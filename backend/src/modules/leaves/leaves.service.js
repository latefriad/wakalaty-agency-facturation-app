const prisma = require("../../config/database");
const { audit } = require("../../utils/audit");

const EMPLOYEE_LITE = { id: true, name: true, position: true };

// Jours ouvrés inclusifs entre deux dates, week-end algérien exclu
// (vendredi = 5, samedi = 6).
function workingDaysBetween(start, end) {
  let count = 0;
  const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  while (d <= last) {
    const day = d.getUTCDay();
    if (day !== 5 && day !== 6) count += 1;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}

// La fiche employé du compte connecté : TOUTES les opérations self-service
// partent du token (jamais d'un employeeId fourni par le client) — un employé
// ne peut ni demander ni consulter un congé pour quelqu'un d'autre.
async function getOwnEmployee(agencyId, userId) {
  const employee = await prisma.employee.findFirst({
    where: { agencyId, userId },
    select: { id: true, name: true, status: true },
  });
  if (!employee) {
    throw Object.assign(new Error("Aucune fiche employé liée à ce compte"), { status: 404 });
  }
  return employee;
}

async function getOrCreateBalance(tx, agencyId, employeeId, year) {
  return tx.leaveBalance.upsert({
    where: { employeeId_year: { employeeId, year } },
    create: { employeeId, agencyId, year },
    update: {},
  });
}

async function create(agencyId, userId, { type, startDate, endDate, reason }, req) {
  const employee = await getOwnEmployee(agencyId, userId);
  if (employee.status !== "ACTIVE") {
    throw Object.assign(new Error("Fiche employé désactivée"), { status: 403 });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (end < start) throw Object.assign(new Error("La date de fin précède la date de début"), { status: 400 });

  const days = workingDaysBetween(start, end);
  if (days <= 0) {
    throw Object.assign(new Error("La période ne contient aucun jour ouvré"), { status: 400 });
  }

  // Pas deux demandes actives sur la même période.
  const overlap = await prisma.leaveRequest.findFirst({
    where: {
      employeeId: employee.id,
      status: { in: ["PENDING", "APPROVED"] },
      startDate: { lte: end },
      endDate: { gte: start },
    },
    select: { id: true },
  });
  if (overlap) {
    throw Object.assign(new Error("Une demande existe déjà sur cette période"), { status: 409 });
  }

  // Contrôle de solde anticipé pour les congés annuels (le contrôle qui fait
  // foi reste celui, transactionnel, de l'approbation).
  if (type === "ANNUAL") {
    const balance = await prisma.$transaction((tx) => getOrCreateBalance(tx, agencyId, employee.id, start.getFullYear()));
    if (balance.usedDays + days > balance.allocatedDays) {
      throw Object.assign(
        new Error(`Solde insuffisant: ${balance.allocatedDays - balance.usedDays} jour(s) restant(s)`),
        { status: 409 }
      );
    }
  }

  const request = await prisma.leaveRequest.create({
    data: { type, startDate: start, endDate: end, days, reason, employeeId: employee.id, agencyId },
    include: { employee: { select: EMPLOYEE_LITE } },
  });

  audit({ action: "LEAVE_REQUESTED", req, targetType: "leave", targetId: request.id, details: { type, days } });
  return request;
}

async function myLeaves(agencyId, userId) {
  const employee = await getOwnEmployee(agencyId, userId);
  const year = new Date().getFullYear();
  const [requests, balance] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: { employeeId: employee.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.$transaction((tx) => getOrCreateBalance(tx, agencyId, employee.id, year)),
  ]);
  return {
    requests,
    balance: {
      year,
      allocatedDays: balance.allocatedDays,
      usedDays: balance.usedDays,
      remainingDays: balance.allocatedDays - balance.usedDays,
    },
  };
}

async function cancel(agencyId, userId, id, req) {
  const employee = await getOwnEmployee(agencyId, userId);
  // updateMany garde-fou : seule SA demande, et seulement tant qu'elle est
  // en attente (une demande approuvée a déjà décompté le solde).
  const result = await prisma.leaveRequest.updateMany({
    where: { id, agencyId, employeeId: employee.id, status: "PENDING" },
    data: { status: "CANCELLED" },
  });
  if (result.count !== 1) {
    throw Object.assign(new Error("Demande introuvable ou déjà traitée"), { status: 404 });
  }
  audit({ action: "LEAVE_CANCELLED", req, targetType: "leave", targetId: id });
  return prisma.leaveRequest.findUnique({ where: { id } });
}

// Périmètre de validation : ADMIN/SUPER_ADMIN voient toute l'agence ; un
// manager (fiche référencée comme managerId d'autres fiches) voit uniquement
// ses subordonnés directs. Tout autre profil → 403. Vérifié en base à chaque
// requête, jamais déduit d'un flag envoyé par le client.
async function getDecisionScope(agencyId, user) {
  if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") return { admin: true };
  const employee = await prisma.employee.findFirst({ where: { agencyId, userId: user.id }, select: { id: true } });
  if (employee) {
    const reports = await prisma.employee.findMany({
      where: { agencyId, managerId: employee.id },
      select: { id: true },
    });
    if (reports.length > 0) return { admin: false, reportIds: reports.map((r) => r.id) };
  }
  throw Object.assign(new Error("Accès interdit"), { status: 403 });
}

async function list(agencyId, user, { status }) {
  const scope = await getDecisionScope(agencyId, user);
  return prisma.leaveRequest.findMany({
    where: {
      agencyId,
      ...(status ? { status } : {}),
      ...(scope.admin ? {} : { employeeId: { in: scope.reportIds } }),
    },
    include: { employee: { select: EMPLOYEE_LITE } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
}

// Approbation transactionnelle : le passage PENDING→APPROVED et le décompte
// du solde réussissent ou échouent ENSEMBLE. Le updateMany conditionnel rend
// la décision idempotente (deux clics concurrents → un seul décompte).
async function approve(agencyId, approver, id, { note }, req) {
  const scope = await getDecisionScope(agencyId, approver);
  const request = await prisma.leaveRequest.findFirst({ where: { id, agencyId } });
  if (!request) throw Object.assign(new Error("Demande introuvable"), { status: 404 });
  if (!scope.admin && !scope.reportIds.includes(request.employeeId)) {
    throw Object.assign(new Error("Accès interdit"), { status: 403 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const claimed = await tx.leaveRequest.updateMany({
      where: { id, status: "PENDING" },
      data: { status: "APPROVED", decidedById: approver.id, decidedAt: new Date(), decisionNote: note || null },
    });
    if (claimed.count !== 1) {
      throw Object.assign(new Error("Demande déjà traitée"), { status: 409 });
    }

    // Seuls les congés annuels consomment le solde ; maladie/sans solde/
    // exceptionnel sont tracés sans décompte.
    if (request.type === "ANNUAL") {
      const year = request.startDate.getFullYear();
      const balance = await getOrCreateBalance(tx, agencyId, request.employeeId, year);
      if (balance.usedDays + request.days > balance.allocatedDays) {
        throw Object.assign(
          new Error(`Solde insuffisant: ${balance.allocatedDays - balance.usedDays} jour(s) restant(s)`),
          { status: 409 }
        );
      }
      await tx.leaveBalance.update({
        where: { id: balance.id },
        data: { usedDays: { increment: request.days } },
      });
    }

    return tx.leaveRequest.findUnique({ where: { id }, include: { employee: { select: EMPLOYEE_LITE } } });
  });

  audit({ action: "LEAVE_APPROVED", req, targetType: "leave", targetId: id, details: { days: request.days, type: request.type } });
  return updated;
}

async function reject(agencyId, approver, id, { note }, req) {
  const scope = await getDecisionScope(agencyId, approver);
  const result = await prisma.leaveRequest.updateMany({
    where: {
      id,
      agencyId,
      status: "PENDING",
      ...(scope.admin ? {} : { employeeId: { in: scope.reportIds } }),
    },
    data: { status: "REJECTED", decidedById: approver.id, decidedAt: new Date(), decisionNote: note || null },
  });
  if (result.count !== 1) {
    throw Object.assign(new Error("Demande introuvable ou déjà traitée"), { status: 404 });
  }
  audit({ action: "LEAVE_REJECTED", req, targetType: "leave", targetId: id });
  return prisma.leaveRequest.findUnique({ where: { id }, include: { employee: { select: EMPLOYEE_LITE } } });
}

// Ajustement du droit annuel par l'admin (ancienneté, temps partiel…).
async function setBalance(agencyId, employeeId, { year, allocatedDays }, req) {
  const employee = await prisma.employee.findFirst({ where: { id: employeeId, agencyId }, select: { id: true } });
  if (!employee) throw Object.assign(new Error("Employé introuvable"), { status: 404 });

  const balance = await prisma.$transaction(async (tx) => {
    const current = await getOrCreateBalance(tx, agencyId, employeeId, year);
    if (allocatedDays < current.usedDays) {
      throw Object.assign(new Error(`Impossible: ${current.usedDays} jour(s) déjà consommé(s)`), { status: 400 });
    }
    return tx.leaveBalance.update({ where: { id: current.id }, data: { allocatedDays } });
  });

  audit({ action: "LEAVE_BALANCE_UPDATED", req, targetType: "employee", targetId: employeeId, details: { year, allocatedDays } });
  return balance;
}

module.exports = { create, myLeaves, cancel, list, approve, reject, setBalance, workingDaysBetween };
