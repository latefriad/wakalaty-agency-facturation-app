const prisma = require("../config/database");
const logger = require("./logger");

// Journalisation best-effort : un échec d'écriture d'audit ne doit jamais
// faire échouer l'action métier elle-même (on log l'erreur et on continue).
async function audit({ action, req, actor, agencyId, targetType, targetId, details }) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        actorId: actor?.id || req?.user?.id || null,
        actorEmail: actor?.email || req?.user?.email || null,
        agencyId: agencyId || req?.agencyId || null,
        targetType: targetType || null,
        targetId: targetId || null,
        details: details || null,
        ip: req?.ip || null,
      },
    });
  } catch (err) {
    logger.error("Audit log échoué:", err.message);
  }
}

module.exports = { audit };
