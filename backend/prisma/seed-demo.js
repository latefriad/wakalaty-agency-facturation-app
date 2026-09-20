/**
 * Données de démonstration réalistes pour visualiser chaque écran de l'app.
 * Usage : node prisma/seed-demo.js [email-admin]  (défaut: beuvryclub@gmail.com)
 * Idempotent-ish : ne recrée pas si des clients de démo existent déjà.
 */
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const invoicesService = require("../src/modules/invoices/invoices.service");

const prisma = new PrismaClient();

const MONTH = 30 * 86400000;

function monthsAgo(n, dayOffset = 0) {
  const d = new Date(Date.now() - n * MONTH + dayOffset * 86400000);
  return d;
}

async function main() {
  const adminEmail = process.argv[2] || "beuvryclub@gmail.com";
  const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) throw new Error(`Utilisateur ${adminEmail} introuvable`);
  const agencyId = admin.agencyId;
  console.log(`Seed démo pour l'agence de ${adminEmail} (${agencyId})`);

  const existing = await prisma.client.findFirst({ where: { agencyId, email: "contact@sarl-atlas.dz" } });
  if (existing) {
    console.log("Données de démo déjà présentes — rien à faire.");
    return;
  }

  // ── Clients ──
  const clientsData = [
    { name: "SARL Atlas Import", company: "Atlas Import/Export", email: "contact@sarl-atlas.dz", phone: "+213 550 12 34 56", address: "Alger, Hydra", defaultTaxRate: 19 },
    { name: "Restaurant Le Gourmet", company: "Le Gourmet", email: "legourmet@gmail.com", phone: "+213 661 22 33 44", address: "Oran, Front de mer", defaultTaxRate: 9 },
    { name: "Clinique Es-Salem", company: "Clinique Es-Salem", email: "direction@essalem.dz", phone: "+213 770 55 66 77", address: "Constantine", defaultTaxRate: 19 },
    { name: "Boutique Yasmine Mode", company: "Yasmine Mode", email: "yasmine.mode@outlook.com", phone: "+213 555 88 99 00", address: "Alger, Didouche Mourad" },
    { name: "Auto-École El Amane", company: "El Amane", email: "elamane.auto@gmail.com", phone: "+213 668 11 22 33", address: "Blida", defaultTaxRate: 19 },
    { name: "Promoteur Immobilier Dar", company: "Dar Invest", email: "dar.invest@yahoo.fr", phone: "+213 559 44 55 66", address: "Sétif" },
  ];
  const clients = [];
  for (const c of clientsData) {
    clients.push(await prisma.client.create({ data: { ...c, agencyId } }));
  }
  console.log(`✓ ${clients.length} clients`);

  // ── Services ──
  const servicesData = [
    { name: "Gestion page Facebook mensuelle", type: "Social Media", basePrice: 25000, salePrice: 25000, totalCharges: 8000, netProfit: 17000 },
    { name: "Gestion Instagram mensuelle", type: "Social Media", basePrice: 30000, salePrice: 30000, totalCharges: 9000, netProfit: 21000 },
    { name: "Campagne Meta Ads", type: "Publicité", basePrice: 40000, salePrice: 40000, totalCharges: 15000, netProfit: 25000 },
    { name: "Identité visuelle complète", type: "Design", basePrice: 50000, salePrice: 50000, totalCharges: 12000, netProfit: 38000 },
    { name: "Site web vitrine", type: "Développement", basePrice: 80000, salePrice: 80000, totalCharges: 20000, netProfit: 60000 },
    { name: "Production vidéo courte (4/mois)", type: "Vidéo", basePrice: 20000, salePrice: 20000, totalCharges: 7000, netProfit: 13000 },
  ];
  const services = [];
  for (const s of servicesData) {
    services.push(await prisma.service.create({ data: { ...s, agencyId } }));
  }
  console.log(`✓ ${services.length} services`);

  // ── Employés ──
  const employees = [];
  for (const e of [
    { name: "Amine Bouzid", email: "amine@agence.dz", position: "Community Manager", salary: 55000, jobType: "salarie" },
    { name: "Lina Khelifi", email: "lina@agence.dz", position: "Graphiste", salary: 60000, jobType: "salarie" },
    { name: "Karim Meziane", email: "karim.freelance@gmail.com", position: "Vidéaste", jobType: "freelancer", commissionRate: 15, commissionBalance: 12000, commissionPaid: 30000 },
    { name: "Sara Benali", email: "sara.seo@gmail.com", position: "Consultante SEO", jobType: "freelancer", commissionRate: 20, commissionBalance: 8000 },
  ]) {
    employees.push(await prisma.employee.create({ data: { ...e, agencyId } }));
  }
  console.log(`✓ ${employees.length} employés`);

  // ── Tâches ──
  const tasksData = [
    { title: "Calendrier éditorial d'août — Atlas Import", type: "WEEKLY", priority: "HIGH", status: "INPROGRESS", employeeId: employees[0].id, dueDate: monthsAgo(0, 4) },
    { title: "Maquettes logo Yasmine Mode (3 propositions)", type: "PROJECT", priority: "HIGH", status: "TODO", employeeId: employees[1].id, dueDate: monthsAgo(0, 7) },
    { title: "Tournage Reels — Le Gourmet", type: "PROJECT", priority: "MEDIUM", status: "TODO", employeeId: employees[2].id, dueDate: monthsAgo(0, 10) },
    { title: "Rapport mensuel Meta Ads — Clinique Es-Salem", type: "DAILY", priority: "MEDIUM", status: "DONE", employeeId: employees[0].id, dueDate: monthsAgo(0, -3) },
    { title: "Audit SEO site Dar Invest", type: "PROJECT", priority: "LOW", status: "INPROGRESS", employeeId: employees[3].id, dueDate: monthsAgo(0, -2) },
    { title: "Répondre aux commentaires Instagram", type: "DAILY", priority: "LOW", status: "DONE", employeeId: employees[0].id },
    { title: "Devis refonte site — Auto-École El Amane", type: "PROJECT", priority: "HIGH", status: "TODO", dueDate: monthsAgo(0, 2) },
    { title: "Stories promotion Ramadan — Yasmine Mode", type: "WEEKLY", priority: "MEDIUM", status: "DONE", employeeId: employees[1].id },
  ];
  for (const t of tasksData) {
    await prisma.task.create({ data: { ...t, agencyId } });
  }
  console.log(`✓ ${tasksData.length} tâches`);

  // ── Contrats ──
  const contractsData = [
    { title: "Contrat community management annuel", type: "MARKETING", status: "ACTIVE", clientId: clients[0].id, value: 300000, startDate: monthsAgo(6), endDate: monthsAgo(-6), serviceIdx: [0, 1] },
    { title: "Campagnes publicitaires T3", type: "ADS", status: "ACTIVE", clientId: clients[2].id, value: 120000, startDate: monthsAgo(2), endDate: monthsAgo(-1), serviceIdx: [2] },
    { title: "Refonte site vitrine", type: "WEBSITE", status: "ACTIVE", clientId: clients[4].id, value: 80000, startDate: monthsAgo(1), serviceIdx: [4] },
    { title: "Pack lancement boutique", type: "MARKETING", status: "EXPIRED", clientId: clients[3].id, value: 95000, startDate: monthsAgo(9), endDate: monthsAgo(3), serviceIdx: [3, 5] },
  ];
  for (const { serviceIdx, ...c } of contractsData) {
    await prisma.contract.create({
      data: { ...c, agencyId, services: { create: serviceIdx.map((i) => ({ serviceId: services[i].id })) } },
    });
  }
  console.log(`✓ ${contractsData.length} contrats`);

  // ── Factures (via le service : numérotation + totaux réels) ──
  // [clientIdx, items, backdateMonths, statut final, options]
  const invoicesPlan = [
    [0, [{ description: "Gestion Facebook + Instagram — février", quantity: 1, unitPrice: 55000 }], 5, "PAYEE"],
    [0, [{ description: "Gestion Facebook + Instagram — mars", quantity: 1, unitPrice: 55000 }], 4, "PAYEE"],
    [2, [{ description: "Campagne Meta Ads — mars", quantity: 1, unitPrice: 40000 }, { description: "Design visuels campagne", quantity: 10, unitPrice: 1500, taxRate: 9 }], 4, "PAYEE"],
    [3, [{ description: "Identité visuelle complète", quantity: 1, unitPrice: 50000 }], 3, "PAYEE"],
    [1, [{ description: "Production vidéo — 4 Reels", quantity: 4, unitPrice: 5000 }], 2, "PAYEE"],
    [4, [{ description: "Site web vitrine — acompte 50%", quantity: 1, unitPrice: 40000 }], 1, "PAYEE"],
    [0, [{ description: "Gestion Facebook + Instagram — juin", quantity: 1, unitPrice: 55000 }], 1, "EN_ATTENTE", { dueInDays: -20 }], // en retard
    [5, [{ description: "Shooting photo programme immobilier", quantity: 1, unitPrice: 35000 }], 0.7, "EN_ATTENTE", { dueInDays: -5 }], // en retard
    [2, [{ description: "Campagne Meta Ads — juillet", quantity: 1, unitPrice: 40000 }], 0.2, "EN_ATTENTE", { dueInDays: 20 }],
    [1, [{ description: "Menu digital + QR code", quantity: 1, unitPrice: 18000 }], 2, "ANNULEE"],
    [4, [{ description: "Site web vitrine — solde 50%", quantity: 1, unitPrice: 40000 }], 0.5, "PARTIAL", { dueInDays: 15, paid: 20000 }],
  ];

  let created = 0;
  for (const [ci, items, back, finalStatus, opts = {}] of invoicesPlan) {
    const dueDate = new Date(Date.now() + (opts.dueInDays ?? 30) * 86400000);
    const inv = await invoicesService.create(agencyId, {
      clientId: clients[ci].id,
      items,
      dueDate: dueDate.toISOString(),
      docType: "FACTURE",
    });
    const createdAt = monthsAgo(back);
    const data = { createdAt };
    if (finalStatus === "PAYEE") {
      data.status = "PAYEE";
      data.paidAt = new Date(createdAt.getTime() + 12 * 86400000);
    } else if (finalStatus === "ANNULEE") {
      data.status = "ANNULEE";
    }
    await prisma.invoice.update({ where: { id: inv.id }, data });
    if (finalStatus === "PARTIAL") {
      await invoicesService.addPayment(agencyId, inv.id, { amount: opts.paid, method: "virement", reference: "VIR-2026-0784" });
    }
    created += 1;
  }
  console.log(`✓ ${created} factures`);

  // ── Devis (dont un converti) ──
  const quote1 = await invoicesService.create(agencyId, {
    clientId: clients[5].id,
    items: [
      { description: "Stratégie digitale complète", quantity: 1, unitPrice: 30000 },
      { description: "Gestion réseaux sociaux (3 mois)", quantity: 3, unitPrice: 55000 },
    ],
    docType: "DEVIS",
  });
  await invoicesService.create(agencyId, {
    clientId: clients[3].id,
    items: [{ description: "Campagne lancement collection automne", quantity: 1, unitPrice: 65000 }],
    docType: "DEVIS",
  });
  await invoicesService.convertToInvoice(agencyId, quote1.id);
  console.log("✓ 2 devis (dont 1 converti en facture)");

  // ── Facture récurrente ──
  await prisma.recurringInvoice.create({
    data: {
      agencyId,
      clientId: clients[0].id,
      items: [{ description: "Gestion Facebook + Instagram — abonnement mensuel", quantity: 1, unitPrice: 55000 }],
      frequency: "MONTHLY",
      tax: 19,
      dueDays: 30,
      nextRunAt: monthsAgo(-1),
    },
  });
  console.log("✓ 1 facture récurrente mensuelle");

  // ── Portfolio ──
  for (const p of [
    { title: "Rebranding Yasmine Mode", category: "Branding", description: "Nouvelle identité visuelle et charte graphique complète." },
    { title: "Campagne Ramadan — Le Gourmet", category: "Social Media", description: "+180% d'engagement sur 30 jours." },
    { title: "Site vitrine El Amane", category: "Web", description: "Site responsive avec prise de rendez-vous en ligne." },
  ]) {
    await prisma.portfolioItem.create({ data: { ...p, agencyId } });
  }
  console.log("✓ 3 éléments de portfolio");

  console.log("\nSeed démo terminé ✅");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
