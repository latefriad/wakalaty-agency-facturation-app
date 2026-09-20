const crypto = require("crypto");

// ─── Format de clé publique ────────────────────────────────────────────────
// WKLY-XXXX-XXXX-XXXX-XXXX en Crockford base32 (pas de I/L/O/U : évite les
// confusions à la lecture/dictée par le support). 16 symboles = 80 bits
// d'entropie : impossible à deviner, surtout avec le rate limit sur l'activation.
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const PREFIX = "WKLY";

function generateLicenseKey() {
  const bytes = crypto.randomBytes(10); // 80 bits
  let out = "";
  for (let i = 0; i < 16; i++) {
    // 5 bits par symbole ; on relit l'octet par pas de 5 bits.
    const bitPos = i * 5;
    const bytePos = Math.floor(bitPos / 8);
    const val = ((bytes[bytePos] << 8) | (bytes[bytePos + 1] || 0)) >> (11 - (bitPos % 8));
    out += CROCKFORD[val & 31];
  }
  const groups = out.match(/.{1,4}/g).join("-");
  return `${PREFIX}-${groups}`;
}

// La clé claire n'est jamais stockée : on garde son SHA-256. Un dump SQL ne
// permet donc pas de retrouver des clés activables.
function hashLicenseKey(key) {
  return crypto.createHash("sha256").update(key.trim().toUpperCase()).digest("hex");
}

// Préfixe affichable pour la recherche/le support sans exposer la clé entière.
function keyPrefix(key) {
  return key.trim().toUpperCase().slice(0, 9); // "WKLY-XXXX"
}

// ─── Signature Ed25519 ─────────────────────────────────────────────────────
// Le payload signé rend la licence autoportante et infalsifiable : même un
// attaquant avec accès en écriture à la base ne peut pas fabriquer une licence
// exploitable sans la clé PRIVÉE (qui ne vit qu'en variable d'env serveur).

function b64url(buf) {
  return Buffer.from(buf).toString("base64url");
}

function loadPrivateKey() {
  const pem = process.env.LICENSE_PRIVATE_KEY;
  if (!pem) throw new Error("LICENSE_PRIVATE_KEY manquante");
  return crypto.createPrivateKey(pem.replace(/\\n/g, "\n"));
}

function loadPublicKey() {
  const pem = process.env.LICENSE_PUBLIC_KEY;
  if (!pem) throw new Error("LICENSE_PUBLIC_KEY manquante");
  return crypto.createPublicKey(pem.replace(/\\n/g, "\n"));
}

// Retourne "payloadB64.signatureB64". Le payload contient tout ce qui est
// contractuel (client, plan, features, expiry) pour être revérifiable seul.
function signPayload(payload) {
  const json = JSON.stringify(payload);
  const sig = crypto.sign(null, Buffer.from(json), loadPrivateKey()); // Ed25519 = algo null
  return `${b64url(json)}.${b64url(sig)}`;
}

function verifyPayload(signed) {
  if (typeof signed !== "string" || !signed.includes(".")) return null;
  const [payloadB64, sigB64] = signed.split(".");
  try {
    const json = Buffer.from(payloadB64, "base64url");
    const sig = Buffer.from(sigB64, "base64url");
    if (!crypto.verify(null, json, loadPublicKey(), sig)) return null;
    return JSON.parse(json.toString());
  } catch {
    return null;
  }
}

module.exports = {
  generateLicenseKey,
  hashLicenseKey,
  keyPrefix,
  signPayload,
  verifyPayload,
};
