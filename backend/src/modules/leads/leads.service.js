const prisma = require("../../config/database");
const { parsePagination } = require("../../utils/pagination");
const clientsService = require("../clients/clients.service");

async function list(agencyId, req) {
  const isAll = req.query.all === "true" || req.query.view === "kanban";
  const { page, limit, search, skip } = parsePagination(req, isAll ? 1000 : 100);
  const actualLimit = isAll ? 1000 : limit;
  const actualSkip = isAll ? 0 : skip;

  const { stage, source, assignee, overdue } = req.query;

  const now = new Date();

  const where = {
    agencyId,
    ...(stage ? { stage } : {}),
    ...(source ? { source } : {}),
    ...(assignee ? { assignedToId: assignee } : {}),
    ...(overdue === "true"
      ? {
          followUpDate: { lt: now },
          stage: { notIn: ["WON", "LOST"] },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { company: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [data, total, allLeadsForStats] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: [{ stage: "asc" }, { updatedAt: "desc" }],
      skip: actualSkip,
      take: actualLimit,
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        _count: {
          select: { notesList: true },
        },
      },
    }),
    prisma.lead.count({ where }),
    prisma.lead.findMany({
      where: { agencyId },
      select: {
        id: true,
        stage: true,
        estimatedValue: true,
        followUpDate: true,
      },
    }),
  ]);

  // Calcul des statistiques globales du pipeline
  const totalAll = allLeadsForStats.length;
  const wonCount = allLeadsForStats.filter((l) => l.stage === "WON").length;
  const conversionRate = totalAll > 0 ? Number(((wonCount / totalAll) * 100).toFixed(1)) : 0;

  const pipelineValue = allLeadsForStats
    .filter((l) => l.stage !== "LOST")
    .reduce((sum, l) => sum + (l.estimatedValue || 0), 0);

  const overdueCount = allLeadsForStats.filter(
    (l) =>
      l.followUpDate &&
      new Date(l.followUpDate) < now &&
      l.stage !== "WON" &&
      l.stage !== "LOST"
  ).length;

  return {
    data,
    total,
    page: isAll ? 1 : page,
    limit: actualLimit,
    stats: {
      totalLeads: totalAll,
      wonCount,
      conversionRate,
      pipelineValue,
      overdueCount,
    },
  };
}

async function getById(agencyId, id) {
  const lead = await prisma.lead.findFirst({
    where: { id, agencyId },
    include: {
      assignedTo: {
        select: { id: true, name: true, email: true, avatar: true },
      },
      notesList: {
        orderBy: { createdAt: "desc" },
        include: {
          author: {
            select: { id: true, name: true, avatar: true },
          },
        },
      },
    },
  });

  if (!lead) {
    throw Object.assign(new Error("Prospect introuvable"), { status: 404 });
  }

  return lead;
}

async function create(agencyId, data) {
  const {
    name,
    phone,
    email,
    company,
    source,
    stage,
    estimatedValue,
    followUpDate,
    lostReason,
    notes,
    assignedToId,
  } = data;

  const lead = await prisma.lead.create({
    data: {
      agencyId,
      name,
      phone: phone || null,
      email: email || null,
      company: company || null,
      source: source || "OTHER",
      stage: stage || "NEW",
      estimatedValue: estimatedValue != null ? Number(estimatedValue) : null,
      followUpDate: followUpDate ? new Date(followUpDate) : null,
      lostReason: lostReason || null,
      notes: notes || null,
      assignedToId: assignedToId || null,
    },
    include: {
      assignedTo: {
        select: { id: true, name: true, email: true, avatar: true },
      },
      _count: {
        select: { notesList: true },
      },
    },
  });

  return lead;
}

async function update(agencyId, id, data) {
  const existing = await prisma.lead.findFirst({ where: { id, agencyId } });
  if (!existing) {
    throw Object.assign(new Error("Prospect introuvable"), { status: 404 });
  }

  const payload = { ...data };
  if ("followUpDate" in payload) {
    payload.followUpDate = payload.followUpDate ? new Date(payload.followUpDate) : null;
  }
  if ("assignedToId" in payload) {
    payload.assignedToId = payload.assignedToId || null;
  }
  if ("email" in payload) {
    payload.email = payload.email || null;
  }
  if ("phone" in payload) {
    payload.phone = payload.phone || null;
  }
  if ("company" in payload) {
    payload.company = payload.company || null;
  }
  if ("estimatedValue" in payload) {
    payload.estimatedValue = payload.estimatedValue != null ? Number(payload.estimatedValue) : null;
  }

  return prisma.lead.update({
    where: { id },
    data: payload,
    include: {
      assignedTo: {
        select: { id: true, name: true, email: true, avatar: true },
      },
      _count: {
        select: { notesList: true },
      },
    },
  });
}

async function changeStage(agencyId, id, { stage, lostReason }) {
  const existing = await prisma.lead.findFirst({ where: { id, agencyId } });
  if (!existing) {
    throw Object.assign(new Error("Prospect introuvable"), { status: 404 });
  }

  return prisma.lead.update({
    where: { id },
    data: {
      stage,
      lostReason: stage === "LOST" ? (lostReason || null) : null,
    },
    include: {
      assignedTo: {
        select: { id: true, name: true, email: true, avatar: true },
      },
      _count: {
        select: { notesList: true },
      },
    },
  });
}

async function remove(agencyId, id) {
  const existing = await prisma.lead.findFirst({ where: { id, agencyId } });
  if (!existing) {
    throw Object.assign(new Error("Prospect introuvable"), { status: 404 });
  }

  await prisma.lead.delete({ where: { id } });
  return { id };
}

async function addNote(agencyId, leadId, authorId, content) {
  const existing = await prisma.lead.findFirst({ where: { id: leadId, agencyId } });
  if (!existing) {
    throw Object.assign(new Error("Prospect introuvable"), { status: 404 });
  }

  return prisma.leadNote.create({
    data: {
      leadId,
      agencyId,
      authorId,
      content,
    },
    include: {
      author: {
        select: { id: true, name: true, avatar: true },
      },
    },
  });
}

async function convertToClient(agencyId, id, authorId) {
  const lead = await prisma.lead.findFirst({ where: { id, agencyId } });
  if (!lead) {
    throw Object.assign(new Error("Prospect introuvable"), { status: 404 });
  }

  if (lead.convertedClientId) {
    const existingClient = await prisma.client.findFirst({
      where: { id: lead.convertedClientId, agencyId },
    });
    if (existingClient) {
      return { lead, client: existingClient, alreadyConverted: true };
    }
  }

  // Appeler la création client existante (qui gère aussi le logClientEvent CLIENT_CREATED)
  const newClient = await clientsService.create(agencyId, {
    name: lead.name,
    email: lead.email || undefined,
    phone: lead.phone || undefined,
    company: lead.company || undefined,
    notes: lead.notes || undefined,
  });

  // Mettre à jour le prospect en WON avec l'ID du client converti
  const updatedLead = await prisma.lead.update({
    where: { id },
    data: {
      stage: "WON",
      convertedClientId: newClient.id,
    },
    include: {
      assignedTo: {
        select: { id: true, name: true, email: true, avatar: true },
      },
    },
  });

  // Ajouter une note automatique sur le prospect
  await prisma.leadNote.create({
    data: {
      leadId: id,
      agencyId,
      authorId: authorId || null,
      content: `Prospect converti en client officiel: ${newClient.name}`,
    },
  });

  return { lead: updatedLead, client: newClient };
}

async function listAssignees(agencyId) {
  return prisma.user.findMany({
    where: { agencyId, isActive: true },
    select: { id: true, name: true, email: true, role: true, avatar: true },
    orderBy: { name: "asc" },
  });
}

module.exports = {
  list,
  getById,
  create,
  update,
  changeStage,
  remove,
  addNote,
  convertToClient,
  listAssignees,
};
