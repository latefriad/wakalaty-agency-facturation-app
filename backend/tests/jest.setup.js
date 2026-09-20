// Génère une paire Ed25519 éphémère AVANT que l'app ne charge config/env, pour
// que le module licences soit actif pendant les tests sans dépendre du .env.
// (setupFiles s'exécute avant l'import des modules de test.)
const crypto = require("crypto");

if (!process.env.LICENSE_PRIVATE_KEY || !process.env.LICENSE_PUBLIC_KEY) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  process.env.LICENSE_PRIVATE_KEY = privateKey.export({ type: "pkcs8", format: "pem" });
  process.env.LICENSE_PUBLIC_KEY = publicKey.export({ type: "spki", format: "pem" });
}
process.env.LICENSE_GRACE_HOURS = process.env.LICENSE_GRACE_HOURS || "72";
