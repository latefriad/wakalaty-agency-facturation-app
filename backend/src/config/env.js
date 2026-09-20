require("dotenv").config();

const required = ["DATABASE_URL", "JWT_SECRET"];
const missing = required.filter((k) => !process.env[k]);

if (missing.length > 0) {
  console.error(`Missing required env: ${missing.join(", ")}`);
  process.exit(1);
}

module.exports = {
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL || process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  PORT: parseInt(process.env.PORT, 10) || 4000,
  NODE_ENV: process.env.NODE_ENV || "development",
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:3000",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || null,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || null,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || null,
  // Paire Ed25519 des licences (générée par scripts/generate-license-keypair.js).
  // Optionnelles au boot : le module licences se désactive proprement si absentes,
  // pour ne pas empêcher le serveur de démarrer en environnement de dev.
  LICENSE_PRIVATE_KEY: process.env.LICENSE_PRIVATE_KEY || null,
  LICENSE_PUBLIC_KEY: process.env.LICENSE_PUBLIC_KEY || null,
  // Tolérance hors-ligne / retard de renouvellement avant blocage dur (heures).
  LICENSE_GRACE_HOURS: parseInt(process.env.LICENSE_GRACE_HOURS, 10) || 72,
};
