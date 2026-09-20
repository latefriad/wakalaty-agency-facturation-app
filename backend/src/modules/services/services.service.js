const prisma = require("../../config/database");
const { parsePagination } = require("../../utils/pagination");

async function list(agencyId, req) {
  const { page, limit, search, skip } = parsePagination(req);

  const where = {
    agencyId,
    ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.service.findMany({ where, orderBy: { name: "asc" }, skip, take: limit }),
    prisma.service.count({ where }),
  ]);

  return { data, total, page, limit };
}

async function getById(agencyId, id) {
  const service = await prisma.service.findFirst({ where: { id, agencyId } });
  if (!service) throw Object.assign(new Error("Service introuvable"), { status: 404 });
  return service;
}

async function create(agencyId, data) {
  const service = await prisma.service.create({ data: { ...data, agencyId } });

  // Update freelancer commission balance
  if (data.freelancerId && data.commissionAmount > 0) {
    await prisma.employee.update({
      where: { id: data.freelancerId },
      data: {
        commissionBalance: { increment: data.commissionAmount },
        isPaid: false,
      },
    });
  }

  return service;
}

async function update(agencyId, id, data) {
  const existing = await prisma.service.findFirst({ where: { id, agencyId } });
  if (!existing) throw Object.assign(new Error("Service introuvable"), { status: 404 });
  return prisma.service.update({ where: { id }, data });
}

async function remove(agencyId, id) {
  const existing = await prisma.service.findFirst({ where: { id, agencyId } });
  if (!existing) throw Object.assign(new Error("Service introuvable"), { status: 404 });
  return prisma.service.delete({ where: { id } });
}

module.exports = { list, getById, create, update, remove };
