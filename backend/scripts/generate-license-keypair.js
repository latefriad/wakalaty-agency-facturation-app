#!/usr/bin/env node
/**
 * Génère UNE FOIS la paire de clés Ed25519 qui signe/vérifie les licences.
 *
 *   node scripts/generate-license-keypair.js
 *
 * Copiez les deux variables affichées dans les variables d'environnement du
 * serveur (Plesk → Node.js → Environment Variables). La clé PRIVÉE ne doit
 * JAMAIS être commitée ni quitter le serveur. Perdre la privée = ne plus
 * pouvoir émettre de licences (les existantes restent vérifiables tant que la
 * publique est inchangée). Voir LICENSING.md pour la rotation.
 */
const crypto = require("crypto");

const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");

const priv = privateKey.export({ type: "pkcs8", format: "pem" }).trim();
const pub = publicKey.export({ type: "spki", format: "pem" }).trim();

// \n échappés : les panneaux d'env (dont Plesk) gèrent mal le multi-ligne.
const escape = (s) => s.replace(/\n/g, "\\n");

console.log("\n# ─── Clés de licence Ed25519 (généré le " + new Date().toISOString() + ") ───");
console.log("# À coller dans Plesk → Node.js → Environment Variables.");
console.log("# GARDEZ LA PRIVÉE SECRÈTE. Ne la commitez jamais.\n");
console.log(`LICENSE_PRIVATE_KEY="${escape(priv)}"`);
console.log(`LICENSE_PUBLIC_KEY="${escape(pub)}"`);
console.log("");
