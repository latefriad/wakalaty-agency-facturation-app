const prisma = require("../../config/database");

// Recherche globale transverse (clients, factures, contrats) scellée à
// l'agence. Chaque catégorie est bornée pour rester rapide et affichable en
// menu déroulant.
async function globalSearch(agencyId, rawTerm) {
  const term = (rawTerm || "").trim();
  if (term.length < 2) return { clients: [], invoices: [], contracts: [] };

  const like = { contains: term, mode: "insensitive" };

  const [clients, invoices, contracts] = await Promise.all([
    prisma.client.findMany({
      where: { agencyId, OR: [{ name: like }, { email: like }, { company: like }] },
      take: 6,
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, company: true, email: true },
    }),
    prisma.invoice.findMany({
      where: { agencyId, OR: [{ number: like }, { client: { name: like } }] },
      take: 6,
      orderBy: { createdAt: "desc" },
      select: { id: true, number: true, docType: true, status: true, total: true, client: { select: { name: true } } },
    }),
    prisma.contract.findMany({
      where: { agencyId, OR: [{ title: like }, { client: { name: like } }] },
      take: 6,
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, status: true, client: { select: { name: true } } },
    }),
  ]);

  return { clients, invoices, contracts };
}

module.exports = { globalSearch };
