const fs = require("fs");
const path = require("path");
const prisma = require("../../config/database");
const { parsePagination } = require("../../utils/pagination");
const { audit } = require("../../utils/audit");

// Justificatifs hors de src/uploads (servi statiquement, donc public) : accès
// uniquement via la route authentifiée de téléchargement.
const ATTACHMENTS_DIR = path.join(__dirname, "../../../storage/expenses");

const SELECT = {
  id: true,
  amount: true,
  currency: true,
  exchangeRate: true,
  category: true,
  date: true,
  notes: true,
  attachmentName: true,
  createdAt: true,
};

async function list(agencyId, req) {
  const { page, limit, skip } = parsePagination(req);
  const { from, to, category } = req.query;

  const where = {
    agencyId,
    ...(category ? { category } : {}),
    ...(from || to
      ? { date: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}) } }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.expense.findMany({ where, select: SELECT, orderBy: { date: "desc" }, skip, take: limit }),
    prisma.expense.count({ where }),
  ]);

  return { data, total, page, limit };
}

function normalize(data) {
  const out = { ...data };
  if (out.date !== undefined) out.date = out.date ? new Date(out.date) : undefined;
  return out;
}

async function create(agencyId, userId, data, req) {
  const expense = await prisma.expense.create({
    data: { ...normalize(data), agencyId, createdById: userId },
    select: SELECT,
  });
  audit({ action: "EXPENSE_CREATED", req, targetType: "expense", targetId: expense.id, details: { amount: data.amount, category: data.category } });
  return expense;
}

async function update(agencyId, id, data, req) {
  const existing = await prisma.expense.findFirst({ where: { id, agencyId } });
  if (!existing) throw Object.assign(new Error("Dépense introuvable"), { status: 404 });
  const expense = await prisma.expense.update({ where: { id }, data: normalize(data), select: SELECT });
  // Modifier une dépense change le bénéfice affiché : on trace avant/après.
  if (data.amount !== undefined && data.amount !== existing.amount) {
    audit({ action: "EXPENSE_UPDATED", req, targetType: "expense", targetId: id, details: { from: existing.amount, to: data.amount } });
  } else {
    audit({ action: "EXPENSE_UPDATED", req, targetType: "expense", targetId: id, details: { fields: Object.keys(data) } });
  }
  return expense;
}

async function remove(agencyId, id, req) {
  const existing = await prisma.expense.findFirst({ where: { id, agencyId } });
  if (!existing) throw Object.assign(new Error("Dépense introuvable"), { status: 404 });
  await prisma.expense.delete({ where: { id } });
  if (existing.attachment) {
    fs.promises.unlink(path.join(ATTACHMENTS_DIR, existing.attachment)).catch(() => {});
  }
  audit({ action: "EXPENSE_DELETED", req, targetType: "expense", targetId: id, details: { amount: existing.amount, category: existing.category } });
}

async function setAttachment(agencyId, id, file, req) {
  const existing = await prisma.expense.findFirst({ where: { id, agencyId } });
  if (!existing) throw Object.assign(new Error("Dépense introuvable"), { status: 404 });
  // Un seul justificatif par dépense : remplacer supprime l'ancien fichier.
  if (existing.attachment) {
    fs.promises.unlink(path.join(ATTACHMENTS_DIR, existing.attachment)).catch(() => {});
  }
  const expense = await prisma.expense.update({
    where: { id },
    data: { attachment: file.filename, attachmentName: file.originalname.slice(0, 200) },
    select: SELECT,
  });
  audit({ action: "EXPENSE_ATTACHMENT_ADDED", req, targetType: "expense", targetId: id });
  return expense;
}

async function getAttachmentFile(agencyId, id) {
  const expense = await prisma.expense.findFirst({
    where: { id, agencyId },
    select: { attachment: true, attachmentName: true },
  });
  if (!expense || !expense.attachment) throw Object.assign(new Error("Justificatif introuvable"), { status: 404 });
  const filePath = path.join(ATTACHMENTS_DIR, expense.attachment);
  if (!fs.existsSync(filePath)) throw Object.assign(new Error("Fichier absent du serveur"), { status: 410 });
  return { filePath, name: expense.attachmentName || "justificatif" };
}

module.exports = { list, create, update, remove, setAttachment, getAttachmentFile, ATTACHMENTS_DIR };
