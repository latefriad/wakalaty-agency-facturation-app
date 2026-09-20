const prisma = require("../config/database");

// Toute référence croisée (clientId, employeeId, serviceIds…) reçue du client
// doit appartenir à l'agence de l'appelant, sinon une facture peut pointer le
// client d'une autre agence et exfiltrer ses données via les includes.
async function assertOwned(model, id, agencyId, label = "Ressource") {
  const record = await prisma[model].findFirst({
    where: { id, agencyId },
    select: { id: true },
  });
  if (!record) {
    throw Object.assign(new Error(`${label} introuvable`), { status: 404 });
  }
  return record;
}

async function assertAllOwned(model, ids, agencyId, label = "Ressource") {
  if (!ids || ids.length === 0) return;
  const count = await prisma[model].count({
    where: { id: { in: ids }, agencyId },
  });
  if (count !== new Set(ids).size) {
    throw Object.assign(new Error(`${label} introuvable`), { status: 404 });
  }
}

module.exports = { assertOwned, assertAllOwned };
