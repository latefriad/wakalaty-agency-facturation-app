const prisma = require("../../config/database");
const { parsePagination } = require("../../utils/pagination");
const { assertOwned, assertAllOwned } = require("../../utils/ownership");
const { logClientEvent } = require("../../utils/clientEvents");

async function list(agencyId, req) {
  const { page, limit, search, skip } = parsePagination(req);

  const where = {
    agencyId,
    ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.contract.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        client: { select: { id: true, name: true } },
        services: { include: { service: { select: { id: true, name: true } } } },
      },
    }),
    prisma.contract.count({ where }),
  ]);

  return { data, total, page, limit };
}

async function getById(agencyId, id) {
  const contract = await prisma.contract.findFirst({
    where: { id, agencyId },
    include: { client: true, services: { include: { service: true } } },
  });
  if (!contract) throw Object.assign(new Error("Contrat introuvable"), { status: 404 });
  return contract;
}

async function create(agencyId, { serviceIds, ...data }) {
  await assertOwned("client", data.clientId, agencyId, "Client");
  await assertAllOwned("service", serviceIds, agencyId, "Service");
  const contract = await prisma.contract.create({
    data: {
      ...data,
      agencyId,
      startDate: data.startDate ? new Date(data.startDate) : new Date(),
      endDate: data.endDate ? new Date(data.endDate) : null,
      services: serviceIds?.length
        ? { create: serviceIds.map((serviceId) => ({ serviceId })) }
        : undefined,
    },
    include: { services: { include: { service: true } } },
  });
  await logClientEvent(prisma, { agencyId, clientId: contract.clientId, type: "CONTRACT_SIGNED", message: contract.title, meta: { contractId: contract.id, value: contract.value } });
  return contract;
}

async function update(agencyId, id, { serviceIds, ...data }) {
  const existing = await prisma.contract.findFirst({ where: { id, agencyId } });
  if (!existing) throw Object.assign(new Error("Contrat introuvable"), { status: 404 });

  if (data.clientId) await assertOwned("client", data.clientId, agencyId, "Client");
  await assertAllOwned("service", serviceIds, agencyId, "Service");

  if (serviceIds) {
    await prisma.contractService.deleteMany({ where: { contractId: id } });
    if (serviceIds.length) {
      await prisma.contractService.createMany({
        data: serviceIds.map((serviceId) => ({ contractId: id, serviceId })),
      });
    }
  }

  return prisma.contract.update({
    where: { id },
    data: {
      ...data,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
    },
    include: { services: { include: { service: true } } },
  });
}

async function remove(agencyId, id) {
  const existing = await prisma.contract.findFirst({ where: { id, agencyId } });
  if (!existing) throw Object.assign(new Error("Contrat introuvable"), { status: 404 });
  return prisma.contract.delete({ where: { id } });
}

module.exports = { list, getById, create, update, remove };
