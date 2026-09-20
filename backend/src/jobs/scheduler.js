const cron = require("node-cron");
const logger = require("../utils/logger");
const { sendReminders } = require("./sendReminders");
const { generateRecurring } = require("./generateRecurring");

function startScheduler() {
  // Tous les jours à 02:00 — et une passe au démarrage pour rattraper les
  // expirations manquées pendant que le dyno dormait (Render free s'endort).
  // Relances d'impayés en matinée, heure d'envoi raisonnable pour le client.
  cron.schedule("0 9 * * *", runReminders);

  // Factures récurrentes : génération quotidienne + passe au démarrage
  // (rattrapage si le dyno dormait à 06:00).
  cron.schedule("0 6 * * *", runRecurring);
  runRecurring();

  logger.info("Scheduler démarré (expiration: 02:00, relances impayés: 09:00)");
}

async function runRecurring() {
  try {
    const n = await generateRecurring();
    if (n > 0) logger.info(`${n} facture(s) récurrente(s) générée(s)`);
  } catch (err) {
    logger.error("Job récurrences:", err.message);
  }
}

async function runReminders() {
  try {
    const n = await sendReminders();
    if (n > 0) logger.info(`${n} relance(s) d'impayé envoyée(s)`);
  } catch (err) {
    logger.error("Job relances:", err.message);
  }
}





module.exports = { startScheduler };
