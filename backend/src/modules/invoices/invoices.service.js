const prisma = require("../../config/database");
const { parsePagination } = require("../../utils/pagination");
const { assertOwned } = require("../../utils/ownership");
const { sendMail } = require("../../utils/mailer");
const { invoiceEmail } = require("../../utils/invoiceEmail");
const { logClientEvent } = require("../../utils/clientEvents");

const PREFIX = { FACTURE: "FAC", DEVIS: "DEV" };

// Numéro séquentiel légal : continu, par agence/type/année, attribué dans la
// même transaction que la création (un échec rend le numéro, pas de trou).
// INSERT..ON CONFLICT est atomique côté Postgres : deux créations simultanées
// ne peuvent pas obtenir le même numéro.
async function allocateNumber(tx, agencyId, docType) {
  const year = new Date().getFullYear();
  const [row] = await tx.$queryRaw`
    INSERT INTO "doc_counters" ("id", "agencyId", "docType", "year", "value")
    VALUES (gen_random_uuid()::text, ${agencyId}, ${docType}::"DocType", ${year}, 1)
    ON CONFLICT ("agencyId", "docType", "year")
    DO UPDATE SET "value" = "doc_counters"."value" + 1
    RETURNING "value"
  `;
  return `${PREFIX[docType]}-${year}-${String(row.value).padStart(5, "0")}`;
}

// Totaux calculés serveur (jamais confiés au client) :
// TVA par ligne (taxRate) sinon taux global de la facture.
function computeTotals(items, tax, discount) {
  let subtotal = 0;
  let taxAmount = 0;
  const lines = items.map((i) => {
    const lineTotal = i.quantity * i.unitPrice;
    const rate = i.taxRate ?? tax ?? 0;
    subtotal += lineTotal;
    taxAmount += (lineTotal * rate) / 100;
    return { ...i, total: lineTotal };
  });
  const total = subtotal + taxAmount - (discount || 0);
  return { lines, subtotal, taxAmount, total };
}

function paidAmount(invoice) {
  return (invoice.payments || [])
    .filter((p) => p.status === "APPROVED")
    .reduce((s, p) => s + p.amount, 0);
}

// Acompte à verser, calculé serveur : montant fixe ou % du total. Borné au
// total (un acompte ne dépasse jamais la facture).
function computeDeposit(depositType, depositValue, total) {
  if (!depositType || !depositValue || depositValue <= 0) return 0;
  const raw = depositType === "PERCENT" ? (total * depositValue) / 100 : depositValue;
  return Math.round(Math.min(raw, total) * 100) / 100;
}

// EN_RETARD et VUE sont des états calculés, pas stockés : le premier dépend de
// l'horloge, le second de la présence d'un viewedAt. Cycle de vie affiché :
// DRAFT → SENT → VUE → (EN_RETARD | PAYEE).
function decorate(invoice) {
  const paid = paidAmount(invoice);
  const unpaid =
    invoice.docType === "FACTURE" &&
    (invoice.status === "EN_ATTENTE" || invoice.status === "SENT");
  const isOverdue = unpaid && invoice.dueDate && new Date(invoice.dueDate) < new Date();
  let displayStatus = invoice.status;
  if (isOverdue) displayStatus = "EN_RETARD";
  else if (unpaid && invoice.viewedAt) displayStatus = "VUE";
  const balance = Math.max(0, invoice.total - paid);
  // Pénalité de retard calculée (pas stockée) : % du solde d'une facture échue.
  const penaltyAmount =
    isOverdue && invoice.penaltyRate > 0
      ? Math.round(balance * invoice.penaltyRate) / 100
      : 0;
  return {
    ...invoice,
    paidAmount: paid,
    balance,
    penaltyAmount,
    totalWithPenalty: invoice.total + penaltyAmount,
    isOverdue: Boolean(isOverdue),
    displayStatus,
  };
}

async function list(agencyId, req) {
  const { page, limit, search, skip } = parsePagination(req);
  const { docType, status } = req.query;

  const where = {
    agencyId,
    ...(docType ? { docType } : {}),
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { number: { contains: search, mode: "insensitive" } },
            { client: { name: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        client: { select: { id: true, name: true, email: true } },
        items: true,
        payments: { select: { id: true, amount: true, status: true, createdAt: true, method: true } },
      },
    }),
    prisma.invoice.count({ where }),
  ]);

  return { data: data.map(decorate), total, page, limit };
}

async function getById(agencyId, id) {
  const invoice = await prisma.invoice.findFirst({
    where: { id, agencyId },
    include: { client: true, items: true, payments: true },
  });
  if (!invoice) throw Object.assign(new Error("Facture introuvable"), { status: 404 });
  return decorate(invoice);
}

async function create(agencyId, { clientId, items, tax, discount = 0, notes, dueDate, docType = "FACTURE", status, currency, exchangeRate, depositType, depositValue, penaltyRate }) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, agencyId },
    select: { id: true, defaultTaxRate: true },
  });
  if (!client) throw Object.assign(new Error("Client introuvable"), { status: 404 });

  // Priorité du taux global : facture > taux par défaut du client > 0.
  const effectiveTax = tax ?? client.defaultTaxRate ?? 0;
  const { lines, subtotal, taxAmount, total } = computeTotals(items, effectiveTax, discount);
  const depositAmount = computeDeposit(depositType, depositValue, total);

  // Un brouillon n'obtient pas de numéro (préserve la séquence légale) : il ne
  // sera numéroté qu'à la finalisation (finalize / envoi au client).
  const asDraft = status === "DRAFT";

  const invoice = await prisma.$transaction(async (tx) => {
    const number = asDraft ? null : await allocateNumber(tx, agencyId, docType);
    return tx.invoice.create({
      data: {
        number,
        docType,
        status: asDraft ? "DRAFT" : "EN_ATTENTE",
        clientId,
        agencyId,
        tax: effectiveTax,
        discount,
        subtotal,
        taxAmount,
        total,
        currency: currency || "DZD",
        exchangeRate: exchangeRate || 1,
        depositType: depositType || null,
        depositValue: depositValue ?? null,
        depositAmount,
        penaltyRate: penaltyRate || 0,
        notes,
        dueDate: dueDate ? new Date(dueDate) : null,
        items: { create: lines },
      },
      include: { items: true, client: { select: { id: true, name: true, email: true } }, payments: true },
    });
  });

  if (invoice.status !== "DRAFT" && invoice.docType === "FACTURE") {
    await logClientEvent(prisma, { agencyId, clientId, type: "INVOICE_ISSUED", message: invoice.number, meta: { invoiceId: invoice.id, number: invoice.number, total: invoice.total } });
  }
  return decorate(invoice);
}

// Finalisation d'un brouillon : attribue le numéro séquentiel légal (dans la
// même transaction que le changement d'état) et passe le document EN_ATTENTE.
async function finalize(agencyId, id) {
  const draft = await prisma.invoice.findFirst({ where: { id, agencyId } });
  if (!draft) throw Object.assign(new Error("Document introuvable"), { status: 404 });
  if (draft.status !== "DRAFT") {
    throw Object.assign(new Error("Le document est déjà finalisé"), { status: 400 });
  }

  const invoice = await prisma.$transaction(async (tx) => {
    const number = await allocateNumber(tx, agencyId, draft.docType);
    return tx.invoice.update({
      where: { id },
      data: { number, status: "EN_ATTENTE" },
      include: { items: true, client: { select: { id: true, name: true, email: true } }, payments: true },
    });
  });

  if (invoice.docType === "FACTURE") {
    await logClientEvent(prisma, { agencyId, clientId: invoice.clientId, type: "INVOICE_ISSUED", message: invoice.number, meta: { invoiceId: invoice.id, number: invoice.number, total: invoice.total } });
  }
  return decorate(invoice);
}

async function updateStatus(agencyId, id, status) {
  const invoice = await prisma.invoice.findFirst({ where: { id, agencyId }, include: { payments: true } });
  if (!invoice) throw Object.assign(new Error("Facture introuvable"), { status: 404 });

  // Un brouillon doit d'abord être finalisé (pour obtenir son numéro légal)
  // avant tout changement de statut : on refuse la transition directe.
  if (invoice.status === "DRAFT") {
    throw Object.assign(new Error("Finalisez d'abord le brouillon"), { status: 400 });
  }

  const ops = [
    prisma.invoice.update({
      where: { id },
      data: { status, paidAt: status === "PAYEE" ? new Date() : null },
    }),
  ];

  // Marquer PAYEE sans passer par les paiements = un encaissement du solde
  // restant : on crée la ligne Payment correspondante pour que « encaissé »
  // (somme des Payments APPROVED) reste l'UNIQUE source de vérité du
  // dashboard. Sans ça, paiements partiels et soldes se contrediraient.
  // Idempotent : si le cumul couvre déjà le total, rien n'est créé.
  if (status === "PAYEE" && invoice.docType === "FACTURE") {
    const remaining = invoice.total - paidAmount(invoice);
    if (remaining > 0.001) {
      ops.push(
        prisma.payment.create({
          data: { agencyId, invoiceId: id, amount: remaining, status: "APPROVED", notes: "Solde marqué payé" },
        })
      );
    }
  }

  const [updated] = await prisma.$transaction(ops);
  return updated;
}

// Paiement partiel enregistré par l'agence ; la facture passe PAYEE quand le
// cumul couvre le total.
async function addPayment(agencyId, id, { amount, method, reference, notes }) {
  const invoice = await prisma.invoice.findFirst({
    where: { id, agencyId, docType: "FACTURE" },
    include: { payments: true },
  });
  if (!invoice) throw Object.assign(new Error("Facture introuvable"), { status: 404 });
  if (invoice.status === "ANNULEE") {
    throw Object.assign(new Error("Facture annulée"), { status: 400 });
  }

  const alreadyPaid = paidAmount(invoice);
  if (alreadyPaid + amount > invoice.total + 0.001) {
    throw Object.assign(
      new Error(`Montant trop élevé : reste ${(invoice.total - alreadyPaid).toFixed(2)} à payer`),
      { status: 400 }
    );
  }

  const fullyPaid = alreadyPaid + amount >= invoice.total - 0.001;

  const [payment] = await prisma.$transaction([
    prisma.payment.create({
      data: { agencyId, invoiceId: id, amount, method, reference, notes, status: "APPROVED" },
    }),
    prisma.invoice.update({
      where: { id },
      data: fullyPaid ? { status: "PAYEE", paidAt: new Date() } : {},
    }),
  ]);

  if (fullyPaid) {
    await logClientEvent(prisma, { agencyId, clientId: invoice.clientId, type: "INVOICE_PAID", message: invoice.number, meta: { invoiceId: id, number: invoice.number, total: invoice.total } });
  }
  return { payment, fullyPaid };
}

// Devis → facture : nouveau document, nouveau numéro FAC, lien de traçabilité.
async function convertToInvoice(agencyId, id) {
  const quote = await prisma.invoice.findFirst({
    where: { id, agencyId, docType: "DEVIS" },
    include: { items: true },
  });
  if (!quote) throw Object.assign(new Error("Devis introuvable"), { status: 404 });
  if (quote.status === "ANNULEE") {
    throw Object.assign(new Error("Devis annulé"), { status: 400 });
  }

  const existing = await prisma.invoice.findFirst({
    where: { agencyId, convertedFromId: id },
    select: { id: true, number: true },
  });
  if (existing) {
    throw Object.assign(
      new Error(`Déjà converti en facture ${existing.number}`),
      { status: 409 }
    );
  }

  const invoice = await prisma.$transaction(async (tx) => {
    const number = await allocateNumber(tx, agencyId, "FACTURE");
    return tx.invoice.create({
      data: {
        number,
        docType: "FACTURE",
        convertedFromId: id,
        clientId: quote.clientId,
        agencyId,
        tax: quote.tax,
        discount: quote.discount,
        subtotal: quote.subtotal,
        taxAmount: quote.taxAmount,
        total: quote.total,
        currency: quote.currency,
        exchangeRate: quote.exchangeRate,
        depositType: quote.depositType,
        depositValue: quote.depositValue,
        depositAmount: quote.depositAmount,
        penaltyRate: quote.penaltyRate,
        notes: quote.notes,
        dueDate: quote.dueDate,
        items: {
          create: quote.items.map(({ description, quantity, unitPrice, taxRate, total }) => ({
            description, quantity, unitPrice, taxRate, total,
          })),
        },
      },
      include: { items: true, client: { select: { id: true, name: true, email: true } }, payments: true },
    });
  });

  await logClientEvent(prisma, { agencyId, clientId: invoice.clientId, type: "INVOICE_ISSUED", message: invoice.number, meta: { invoiceId: invoice.id, number: invoice.number, total: invoice.total, fromQuote: id } });
  return decorate(invoice);
}

// Envoi de la facture au client : récap HTML + lien public de consultation.
// Un brouillon est d'abord finalisé (numéro attribué), puis marqué « envoyée ».
async function sendToClient(agencyId, id) {
  let invoice = await getById(agencyId, id);
  if (!invoice.client?.email) {
    throw Object.assign(new Error("Le client n'a pas d'adresse e-mail"), { status: 400 });
  }
  if (invoice.status === "DRAFT") {
    invoice = await finalize(agencyId, id);
  }
  const agency = await prisma.agency.findUnique({ where: { id: agencyId } });
  const publicUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/f/${invoice.publicToken}`;
  const { subject, html } = invoiceEmail({ invoice, agency, publicUrl });
  await sendMail({ to: invoice.client.email, subject, html });
  // Passe EN_ATTENTE → SENT et horodate l'envoi ; ne rétrograde jamais une
  // facture déjà payée/annulée.
  await prisma.invoice.update({
    where: { id },
    data: {
      sentAt: new Date(),
      ...(invoice.status === "EN_ATTENTE" ? { status: "SENT" } : {}),
    },
  });
  await logClientEvent(prisma, { agencyId, clientId: invoice.clientId, type: "INVOICE_SENT", message: invoice.number, meta: { invoiceId: id, number: invoice.number, to: invoice.client.email } });
  return { sent: true, to: invoice.client.email };
}

// Marque la première consultation client (portail public). Idempotent : ne
// touche que les factures envoyées/en attente encore jamais vues.
async function markViewed(id) {
  await prisma.invoice.updateMany({
    where: { id, viewedAt: null, status: { in: ["SENT", "EN_ATTENTE"] } },
    data: { viewedAt: new Date() },
  });
}

// Export comptable : CSV compatible Excel (séparateur ;) sur une période.
async function exportCsv(agencyId, { from, to, docType }) {
  const where = {
    agencyId,
    ...(docType ? { docType } : { docType: "FACTURE" }),
    ...(from || to
      ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(`${to}T23:59:59`) } : {}) } }
      : {}),
  };
  const invoices = await prisma.invoice.findMany({
    where,
    orderBy: { number: "asc" },
    include: {
      client: { select: { name: true } },
      payments: { where: { status: "APPROVED" }, select: { amount: true } },
    },
  });

  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [
    ["Numero", "Type", "Date", "Client", "Devise", "HT", "TVA", "Remise", "TTC", "Acompte", "Paye", "Statut", "Echeance", "Paye le"].join(";"),
    ...invoices.map((i) => {
      const paid = i.payments.reduce((s, p) => s + p.amount, 0);
      return [
        esc(i.number),
        i.docType,
        i.createdAt.toISOString().slice(0, 10),
        esc(i.client?.name),
        i.currency || "DZD",
        i.subtotal.toFixed(2),
        i.taxAmount.toFixed(2),
        i.discount.toFixed(2),
        i.total.toFixed(2),
        (i.depositAmount || 0).toFixed(2),
        paid.toFixed(2),
        i.status,
        i.dueDate ? i.dueDate.toISOString().slice(0, 10) : "",
        i.paidAt ? i.paidAt.toISOString().slice(0, 10) : "",
      ].join(";");
    }),
  ];
  // BOM pour qu'Excel détecte l'UTF-8 (noms arabes/accentués).
  return "\ufeff" + rows.join("\n");
}

async function remove(agencyId, id) {
  const invoice = await prisma.invoice.findFirst({ where: { id, agencyId } });
  if (!invoice) throw Object.assign(new Error("Facture introuvable"), { status: 404 });
  return prisma.invoice.delete({ where: { id } });
}

module.exports = { list, getById, create, finalize, updateStatus, addPayment, convertToInvoice, sendToClient, markViewed, exportCsv, remove, allocateNumber, computeTotals };
