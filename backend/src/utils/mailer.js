const nodemailer = require("nodemailer");
const logger = require("./logger");

// SMTP générique par variables d'env (Brevo, Gmail, OVH…) :
// SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM.
let transporter = null;

function isConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);
}

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: process.env.SMTP_PORT === "465",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

async function sendMail({ to, subject, html }) {
  if (!isConfigured()) {
    throw Object.assign(
      new Error("Envoi d'e-mail non configuré (variables SMTP_* manquantes)"),
      { status: 503 }
    );
  }
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  const info = await getTransporter().sendMail({ from, to, subject, html });
  logger.info(`Mail envoyé à ${to}: ${subject}`);
  return info;
}

module.exports = { sendMail, isConfigured };
