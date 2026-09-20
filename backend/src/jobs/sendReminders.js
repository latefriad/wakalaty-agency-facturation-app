const prisma = require("../config/database");
const logger = require("../utils/logger");
const { sendMail, isConfigured } = require("../utils/mailer");
const { reminderEmail } = require("../utils/invoiceEmail");

const REMINDER_INTERVAL_DAYS = 3;

// Statuts d'une facture impayée susceptible d'être relancée.
const UNPAID = ["EN_ATTENTE", "SENT"];

async function dispatch(invoice, variant) {
  const paid = invoice.payments.reduce((s, p) => s + p.amount, 0);
  const publicUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/f/${invoice.publicToken}`;
  const { subject, html } = reminderEmail({
    invoice: { ...invoice, balance: Math.max(0, invoice.total - paid) },
    agency: invoice.agency,
    publicUrl,
    variant,
  });
  await sendMail({ to: invoice.client.email, subject, html });
}

const INCLUDE = {
  client: { select: { email: true, name: true } },
  agency: { select: { name: true, currency: true } },
  payments: { where: { status: "APPROVED" }, select: { amount: true } },
};

// Borne haute du délai de courtoisie : personne ne préviendra plus de 30 jours
// à l'avance. Sert à réduire la fenêtre SQL à une seule requête.
const MAX_LEAD_DAYS = 30;

// Relance de courtoisie AVANT échéance : une seule fois, quand il reste
// ≤ reminderLeadDays jours (délai propre à chaque agence, 0 = désactivé).
// Une seule requête bornée puis filtrage en mémoire selon le délai de chaque
// agence — pas de boucle de requêtes par agence.
async function sendPreReminders(now) {
  const maxWindow = new Date(now.getTime() + MAX_LEAD_DAYS * 86400000);
  const candidates = await prisma.invoice.findMany({
    where: {
      docType: "FACTURE",
      status: { in: UNPAID },
      preReminderAt: null,
      dueDate: { gte: now, lte: maxWindow },
      client: { email: { not: null } },
      agency: { remindersEnabled: true, reminderLeadDays: { gt: 0 } },
    },
    include: { ...INCLUDE, agency: { select: { name: true, currency: true, reminderLeadDays: true } } },
    take: 500,
  });

  let sent = 0;
  for (const invoice of candidates) {
    // Ne relancer que si l'échéance est bien dans la fenêtre de cette agence.
    const windowEnd = now.getTime() + invoice.agency.reminderLeadDays * 86400000;
    if (new Date(invoice.dueDate).getTime() > windowEnd) continue;
    try {
      await dispatch(invoice, "pre");
      await prisma.invoice.update({ where: { id: invoice.id }, data: { preReminderAt: new Date() } });
      sent += 1;
    } catch (err) {
      logger.error(`Rappel pré-échéance ${invoice.number} échoué:`, err.message);
    }
  }
  return sent;
}

// Relance APRÈS échéance : factures échues et impayées, au plus une fois tous
// les 3 jours, pour les agences ayant laissé les relances activées.
async function sendOverdueReminders(now) {
  const cutoff = new Date(now.getTime() - REMINDER_INTERVAL_DAYS * 86400000);
  const overdue = await prisma.invoice.findMany({
    where: {
      docType: "FACTURE",
      status: { in: UNPAID },
      dueDate: { lt: now },
      agency: { remindersEnabled: true },
      client: { email: { not: null } },
      OR: [{ lastReminderAt: null }, { lastReminderAt: { lt: cutoff } }],
    },
    include: INCLUDE,
    take: 200,
  });

  let sent = 0;
  for (const invoice of overdue) {
    try {
      await dispatch(invoice, "post");
      await prisma.invoice.update({ where: { id: invoice.id }, data: { lastReminderAt: new Date() } });
      sent += 1;
    } catch (err) {
      logger.error(`Relance ${invoice.number} échouée:`, err.message);
    }
  }
  return sent;
}

async function sendReminders() {
  if (!isConfigured()) {
    logger.info("Relances ignorées : SMTP non configuré");
    return 0;
  }
  const now = new Date();
  const pre = await sendPreReminders(now);
  const post = await sendOverdueReminders(now);
  return pre + post;
}

module.exports = { sendReminders };
