const prisma = require("../../config/database");
const { parsePagination } = require("../../utils/pagination");
const { logClientEvent } = require("../../utils/clientEvents");

// Une facture « compte » dans l'encours si c'est une FACTURE finalisée et non
// annulée (les brouillons et devis sont hors du chiffre facturé).
const COUNTED_STATUSES = ["EN_ATTENTE", "SENT", "PAYEE"];

function paidOf(invoice) {
  return (invoice.payments || [])
    .filter((p) => p.status === "APPROVED")
    .reduce((s, p) => s + p.amount, 0);
}

// Encours financier d'un lot de factures (déjà chargées avec leurs paiements) :
// facturé / payé / dû / en retard. Calcul en mémoire, sur des données récupérées
// en UNE requête → pas de N+1.
function computeEncours(invoices) {
  const now = new Date();
  let invoiced = 0, paid = 0, overdue = 0;
  for (const inv of invoices) {
    if (inv.docType !== "FACTURE" || !COUNTED_STATUSES.includes(inv.status)) continue;
    const p = paidOf(inv);
    const balance = Math.max(0, inv.total - p);
    invoiced += inv.total;
    paid += p;
    if (balance > 0 && inv.status !== "PAYEE" && inv.dueDate && new Date(inv.dueDate) < now) {
      overdue += balance;
    }
  }
  return { invoiced, paid, due: Math.max(0, invoiced - paid), overdue };
}

async function list(agencyId, req) {
  const { page, limit, search, skip } = parsePagination(req);

  // Recherche élargie : nom, e-mail ou société (avant : nom seulement).
  // Filtre optionnel par tag/segment.
  const where = {
    agencyId,
    ...(req.query.tag ? { tags: { has: req.query.tag } } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { company: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.client.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
    prisma.client.count({ where }),
  ]);

  // Encours par client pour la page courante, en UNE seule requête factures
  // (paiements inclus) regroupée par clientId → pas de N+1.
  const ids = data.map((c) => c.id);
  const byClient = new Map(ids.map((id) => [id, []]));
  if (ids.length) {
    const invoices = await prisma.invoice.findMany({
      where: { agencyId, clientId: { in: ids }, docType: "FACTURE" },
      select: { clientId: true, docType: true, total: true, status: true, dueDate: true, payments: { where: { status: "APPROVED" }, select: { amount: true, status: true } } },
    });
    for (const inv of invoices) byClient.get(inv.clientId)?.push(inv);
  }

  const enriched = data.map((c) => ({ ...c, encours: computeEncours(byClient.get(c.id) || []) }));
  return { data: enriched, total, page, limit };
}

async function getById(agencyId, id) {
  const client = await prisma.client.findFirst({ where: { id, agencyId } });
  if (!client) throw Object.assign(new Error("Client introuvable"), { status: 404 });
  return client;
}

// Vue 360° : le client, ses factures/contrats/tâches et son encours financier.
// Tout est chargé en quelques requêtes bornées (pas de boucle N+1).
async function overview(agencyId, id) {
  const client = await prisma.client.findFirst({ where: { id, agencyId } });
  if (!client) throw Object.assign(new Error("Client introuvable"), { status: 404 });

  const [invoices, contracts, tasks, events, notes] = await Promise.all([
    prisma.invoice.findMany({
      where: { agencyId, clientId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, number: true, docType: true, status: true, total: true, dueDate: true,
        createdAt: true, payments: { where: { status: "APPROVED" }, select: { amount: true, status: true } },
      },
    }),
    prisma.contract.findMany({ where: { agencyId, clientId: id }, orderBy: { createdAt: "desc" } }),
    prisma.task.findMany({ where: { agencyId, clientId: id }, orderBy: [{ status: "asc" }, { dueDate: "asc" }] }),
    prisma.clientEvent.findMany({ where: { agencyId, clientId: id }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.clientNote.findMany({ where: { agencyId, clientId: id }, orderBy: { createdAt: "desc" } }),
  ]);

  const now = new Date();
  const decoratedInvoices = invoices.map((inv) => {
    const paid = paidOf(inv);
    const balance = Math.max(0, inv.total - paid);
    const isOverdue = inv.docType === "FACTURE" && balance > 0 && inv.status !== "PAYEE" && inv.dueDate && new Date(inv.dueDate) < now;
    return { ...inv, paidAmount: paid, balance, isOverdue: Boolean(isOverdue) };
  });

  // Timeline unifiée : événements auto + notes, triés du plus récent au plus
  // ancien. La note devient une entrée de type NOTE_ADDED (kind:"note") pour
  // être rendue et supprimable côté fiche.
  const timeline = [
    // Les NOTE_ADDED sont rendus depuis la table notes (kind:"note", éditables),
    // on les exclut donc des événements pour ne pas les afficher en double.
    ...events.filter((e) => e.type !== "NOTE_ADDED").map((e) => ({ kind: "event", id: e.id, type: e.type, message: e.message, meta: e.meta, createdAt: e.createdAt })),
    ...notes.map((n) => ({ kind: "note", id: n.id, type: "NOTE_ADDED", message: n.content, meta: { author: n.authorName }, createdAt: n.createdAt })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return {
    ...client,
    encours: computeEncours(invoices),
    invoices: decoratedInvoices,
    contracts,
    tasks,
    notes,
    timeline,
    counts: { invoices: invoices.length, contracts: contracts.length, tasks: tasks.length, notes: notes.length },
  };
}

// Normalise les tags : trim, retrait des vides, dédoublonnage insensible à la
// casse (en conservant la 1re graphie rencontrée).
function normalizeTags(tags) {
  if (!Array.isArray(tags)) return undefined;
  const seen = new Set();
  const out = [];
  for (const raw of tags) {
    const tag = String(raw).trim();
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

async function create(agencyId, data) {
  const tags = normalizeTags(data.tags);
  const client = await prisma.client.create({ data: { ...data, ...(tags ? { tags } : {}), agencyId } });
  await logClientEvent(prisma, { agencyId, clientId: client.id, type: "CLIENT_CREATED", message: client.name });
  return client;
}

async function update(agencyId, id, data) {
  const existing = await prisma.client.findFirst({ where: { id, agencyId } });
  if (!existing) throw Object.assign(new Error("Client introuvable"), { status: 404 });
  const tags = normalizeTags(data.tags);
  return prisma.client.update({ where: { id }, data: { ...data, ...(tags ? { tags } : {}) } });
}

// Normalisation pour comparaison de doublons : minuscules, sans accents,
// espaces réduits. L'e-mail est simplement trim + minuscules.
function normalizeText(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}
function normalizeEmail(s) {
  return String(s || "").trim().toLowerCase();
}

// Détection de doublons (NON bloquante) : renvoie les clients existants dont
// l'e-mail OU le nom OU la société correspondent, après normalisation. On
// compare en mémoire sur un lot borné pour rester tolérant aux accents/casse
// que SQL ne gère pas nativement.
async function findDuplicates(agencyId, { email, name, company } = {}, excludeId) {
  const emailN = normalizeEmail(email);
  const nameN = normalizeText(name);
  const companyN = normalizeText(company);
  if (!emailN && !nameN && !companyN) return [];

  const candidates = await prisma.client.findMany({
    where: { agencyId, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true, name: true, email: true, company: true },
    take: 2000,
  });

  const out = [];
  for (const c of candidates) {
    const reasons = [];
    if (emailN && normalizeEmail(c.email) === emailN) reasons.push("email");
    if (nameN && normalizeText(c.name) === nameN) reasons.push("name");
    if (companyN && c.company && normalizeText(c.company) === companyN) reasons.push("company");
    if (reasons.length) out.push({ id: c.id, name: c.name, email: c.email, company: c.company, reasons });
  }
  return out;
}

// Tags distincts de l'agence, pour alimenter les filtres/segments.
async function listTags(agencyId) {
  const rows = await prisma.client.findMany({ where: { agencyId }, select: { tags: true } });
  const seen = new Map(); // clé lowercase → graphie affichée
  for (const r of rows) for (const tag of r.tags || []) {
    const key = tag.toLowerCase();
    if (!seen.has(key)) seen.set(key, tag);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

async function remove(agencyId, id) {
  const existing = await prisma.client.findFirst({ where: { id, agencyId } });
  if (!existing) throw Object.assign(new Error("Client introuvable"), { status: 404 });
  return prisma.client.delete({ where: { id } });
}

// ── Notes horodatées ──────────────────────────────────────
async function listNotes(agencyId, clientId) {
  await getById(agencyId, clientId); // garantit l'appartenance à l'agence
  return prisma.clientNote.findMany({ where: { clientId, agencyId }, orderBy: { createdAt: "desc" } });
}

async function addNote(agencyId, clientId, { content }, author = {}) {
  await getById(agencyId, clientId);
  const note = await prisma.clientNote.create({
    data: { clientId, agencyId, content, authorId: author.id || null, authorName: author.name || null },
  });
  await logClientEvent(prisma, {
    agencyId, clientId, type: "NOTE_ADDED",
    message: content.length > 120 ? content.slice(0, 117) + "…" : content,
    meta: { noteId: note.id, author: author.name || null },
  });
  return note;
}

async function removeNote(agencyId, clientId, noteId) {
  const note = await prisma.clientNote.findFirst({ where: { id: noteId, clientId, agencyId } });
  if (!note) throw Object.assign(new Error("Note introuvable"), { status: 404 });
  return prisma.clientNote.delete({ where: { id: noteId } });
}

module.exports = { list, getById, overview, create, update, remove, computeEncours, listNotes, addNote, removeNote, listTags, normalizeTags, findDuplicates };
