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
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function generateWithAI(agencyId, { prompt, clientId }) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Clé API Gemini manquante dans la configuration.");
  }

  // Vérifier si le client appartient à l'agence
  await assertOwned("client", clientId, agencyId);

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  // On utilise flash car c'est rapide
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const systemPrompt = `Tu es un assistant juridique expert pour une agence digitale algérienne.
Le nom de l'utilisateur a fait une requête pour générer un contrat.
Tu dois répondre STRICTEMENT en JSON valide sans aucun formatage markdown (sans \`\`\`json).
Le JSON doit contenir les champs suivants :
- "title": (chaîne) un titre professionnel pour le contrat.
- "type": (chaîne) DOIT être l'une de ces valeurs exactes : "MARKETING", "ADS", "WEBSITE", "CAHIER". Choisis la plus proche.
- "value": (nombre) le montant total en dinars algériens (DZD). Si non spécifié, mets 0.
- "notes": (chaîne) le contenu complet et détaillé du contrat (termes, conditions, durée). Ce texte peut être long, structuré de façon professionnelle.

Requête de l'utilisateur : "${prompt}"`;

  const result = await model.generateContent(systemPrompt);
  const text = result.response.text();
  
  // Nettoyage au cas où Gemini renvoie des backticks markdown
  const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();
  
  let aiData;
  try {
    aiData = JSON.parse(cleanedText);
  } catch (err) {
    console.error("Erreur parsing JSON Gemini:", text);
    throw new Error("L'IA n'a pas pu générer un contrat valide. Veuillez reformuler votre demande.");
  }

  // Création du contrat en BDD
  const contract = await prisma.contract.create({
    data: {
      agencyId,
      clientId,
      title: aiData.title || "Contrat généré par IA",
      type: ["MARKETING", "ADS", "WEBSITE", "CAHIER"].includes(aiData.type) ? aiData.type : "MARKETING",
      value: Number(aiData.value) || 0,
      notes: aiData.notes || "",
      startDate: new Date(),
    },
    include: {
      client: { select: { id: true, name: true } },
    }
  });

  // Enregistrer l'événement
  await logClientEvent(clientId, "CONTRACT_CREATED", `Contrat généré par IA : ${contract.title}`);

  return contract;
}

module.exports.generateWithAI = generateWithAI;
