const prisma = require("../config/database");
const logger = require("./logger");

// Point d'écriture UNIQUE de la timeline client. Les modules (factures,
// contrats, tâches, notes) l'appellent à leur moment clé. Best-effort : une
// panne de journalisation ne doit jamais faire échouer l'opération métier,
// donc on avale l'erreur (et on la logue) au lieu de la propager.
//
// `client` peut être le prisma global ou un client de transaction (tx), pour
// journaliser dans la même transaction que l'opération quand c'est utile.
async function logClientEvent(db, { agencyId, clientId, type, message = null, meta = null }) {
  if (!clientId || !agencyId || !type) return null;
  try {
    return await db.clientEvent.create({
      data: { agencyId, clientId, type, message, meta: meta ?? undefined },
    });
  } catch (err) {
    logger.error(`logClientEvent(${type}) échoué:`, err.message);
    return null;
  }
}

module.exports = { logClientEvent };
