const prisma = require("../config/database");
const logger = require("../utils/logger");
const invoicesService = require("../modules/invoices/invoices.service");
const { advance } = require("../modules/recurring/recurring.service");

// Génère les factures des récurrences arrivées à échéance. Respecte les
// limites de plan : une agence FREE au quota voit sa génération sautée
// (retentée à la prochaine passe si elle upgrade).
async function generateRecurring() {
  const due = await prisma.recurringInvoice.findMany({
    where: { active: true, nextRunAt: { lte: new Date() } },
    take: 200,
  });

  let created = 0;
  for (const rec of due) {
    try {
      const agency = await prisma.agency.findUnique({ where: { id: rec.agencyId } });
      if (!agency) continue;

      const client = await prisma.client.findFirst({ where: { id: rec.clientId, agencyId: rec.agencyId } });
      if (!client) {
        // Client supprimé : on désactive la récurrence plutôt que d'échouer en boucle.
        await prisma.recurringInvoice.update({ where: { id: rec.id }, data: { active: false } });
        continue;
      }

      const dueDate = new Date(Date.now() + rec.dueDays * 86400000).toISOString();
      await invoicesService.create(rec.agencyId, {
        clientId: rec.clientId,
        items: rec.items,
        tax: rec.tax,
        discount: rec.discount,
        notes: rec.notes,
        dueDate,
        docType: "FACTURE",
      });

      await prisma.recurringInvoice.update({
        where: { id: rec.id },
        data: { nextRunAt: advance(rec.nextRunAt, rec.frequency) },
      });
      created += 1;
    } catch (err) {
      logger.error(`Récurrence ${rec.id} échouée:`, err.message);
    }
  }

  return created;
}

module.exports = { generateRecurring };
