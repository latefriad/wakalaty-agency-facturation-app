#!/usr/bin/env node
/**
 * Crée le PREMIER admin de l'instance. Le rôle ADMIN n'est pas
 * assignable via l'API (sécurité) ; ce script est le seul moyen d'amorcer la
 * console de gestion sur un déploiement neuf.
 *
 *   node scripts/create-admin.js <email> <nom> <mot_de_passe>
 *   node scripts/create-admin.js admin@wakalati.app "Nom Admin" 'MotDePasseFort'
 *
 * Ré-exécutable : si l'email existe déjà, le compte est promu ADMIN et
 * son mot de passe réinitialisé (utile pour récupérer un accès).
 */
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const [email, name, password] = process.argv.slice(2);
  if (!email || !name || !password) {
    console.error('Usage: node scripts/create-admin.js <email> <nom> <mot_de_passe>');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Le mot de passe doit faire au moins 8 caractères.");
    process.exit(1);
  }

  const hashed = await bcrypt.hash(password, 12);

  // Les admins partagent une agence technique (le modèle User exige un
  // agencyId ; ce ne sont pas de vraies agences clientes).
  const agency = await prisma.agency.upsert({
    where: { email: "contact@adpowersdigital.com" },
    update: { name: "Adpowers Digital" },
    create: {
      name: "Adpowers Digital",
      email: "contact@adpowersdigital.com",
      website: "https://adpowersdigital.netlify.app",
      tagline: "On transforme votre budget en croissance",
      primaryColor: "#2563eb",
      secondaryColor: "#0f172a",
      onboarded: true,
    },
  });

  const user = await prisma.user.upsert({
    where: { email },
    update: { password: hashed, role: "ADMIN", name },
    create: { email, name, password: hashed, role: "ADMIN", agencyId: agency.id },
  });

  console.log(`✅ Super-admin prêt : ${user.email} (rôle ${user.role})`);
  console.log("   Connecte-toi puis va sur /admin.");
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
