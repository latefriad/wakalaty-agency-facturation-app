const prisma = require("../../config/database");
const { parsePagination } = require("../../utils/pagination");

async function list(agencyId, req) {
  const { page, limit, search, skip } = parsePagination(req);

  const where = {
    agencyId,
    ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.portfolioItem.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
    prisma.portfolioItem.count({ where }),
  ]);

  return { data, total, page, limit };
}

async function getById(agencyId, id) {
  const item = await prisma.portfolioItem.findFirst({ where: { id, agencyId } });
  if (!item) throw Object.assign(new Error("Élément introuvable"), { status: 404 });
  return item;
}

async function create(agencyId, data) {
  return prisma.portfolioItem.create({ data: { ...data, agencyId } });
}

async function update(agencyId, id, data) {
  const existing = await prisma.portfolioItem.findFirst({ where: { id, agencyId } });
  if (!existing) throw Object.assign(new Error("Élément introuvable"), { status: 404 });
  return prisma.portfolioItem.update({ where: { id }, data });
}

async function remove(agencyId, id) {
  const existing = await prisma.portfolioItem.findFirst({ where: { id, agencyId } });
  if (!existing) throw Object.assign(new Error("Élément introuvable"), { status: 404 });
  return prisma.portfolioItem.delete({ where: { id } });
}

module.exports = { list, getById, create, update, remove };
