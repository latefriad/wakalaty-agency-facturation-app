const { app, request, uniqueEmail, createAgency, createClient } = require("./helpers");
const prisma = require("../src/config/database");

// Dashboard financier : définitions strictes (encaissé = Payments APPROVED,
// facturé = factures finalisées, encours = reste à payer réel), conversion
// dans la devise de l'agence, filtres de période, RBAC serveur.

async function createBusinessAgency(name) {
  const admin = await createAgency(name);
  await prisma.agency.update({ where: { id: admin.agency.id }, data: { plan: "BUSINESS" } });
  return admin;
}

async function createInvoice(token, clientId, extra = {}) {
  const res = await request(app)
    .post("/api/invoices")
    .set("Authorization", `Bearer ${token}`)
    .send({
      clientId,
      items: [{ description: "Prestation", quantity: 1, unitPrice: 1000 }],
      tax: 0,
      ...extra,
    });
  return res.body.data;
}

function pay(token, invoiceId, amount) {
  return request(app)
    .post(`/api/invoices/${invoiceId}/payments`)
    .set("Authorization", `Bearer ${token}`)
    .send({ amount });
}

function getDash(token, params = "") {
  return request(app).get(`/api/dashboard${params}`).set("Authorization", `Bearer ${token}`);
}

describe("RBAC dashboard", () => {
  test("un employé ne reçoit jamais les chiffres globaux (403), le comptable si (200)", async () => {
    const admin = await createBusinessAgency();
    const email = uniqueEmail("emp");
    await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ email, password: "password123", name: "Emp", role: "EMPLOYEE" });
    const emp = await request(app).post("/api/auth/login").send({ email, password: "password123" });

    const denied = await getDash(emp.body.data.token);
    expect(denied.status).toBe(403);

    const accEmail = uniqueEmail("acc");
    await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ email: accEmail, password: "password123", name: "Compta", role: "ACCOUNTANT" });
    const acc = await request(app).post("/api/auth/login").send({ email: accEmail, password: "password123" });
    const ok = await getDash(acc.body.data.token);
    expect(ok.status).toBe(200);
    expect(ok.body.data.cash).toBeDefined();
  });
});

describe("Définitions : encaissé / facturé / encours", () => {
  let admin, client;

  beforeAll(async () => {
    admin = await createBusinessAgency();
    client = await createClient(admin.token);
  });

  test("un paiement partiel compte dans l'encaissé dès sa saisie, l'encours baisse d'autant", async () => {
    const inv = await createInvoice(admin.token, client.id); // total 1000
    await pay(admin.token, inv.id, 400);

    const dash = (await getDash(admin.token)).body.data;
    expect(dash.cash.received).toBe(400);
    // Encours = 1000 − 400 (la facture n'est pas PAYEE, mais le reste dû est réel).
    expect(dash.outstanding.total).toBe(600);
    expect(dash.outstanding.count).toBe(1);
    // Facturé = total émis, indépendamment des paiements. Jamais mélangés.
    expect(dash.billed.total).toBe(1000);
  });

  test("marquer PAYEE via updateStatus crée le paiement de solde (source unique)", async () => {
    const inv = await createInvoice(admin.token, client.id); // total 1000
    await request(app)
      .patch(`/api/invoices/${inv.id}/status`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ status: "PAYEE" });

    const payments = await prisma.payment.findMany({ where: { invoiceId: inv.id, status: "APPROVED" } });
    expect(payments).toHaveLength(1);
    expect(payments[0].amount).toBe(1000);

    const dash = (await getDash(admin.token)).body.data;
    expect(dash.cash.received).toBe(1400); // 400 partiel + 1000 solde
  });

  test("les devis et les brouillons ne comptent nulle part", async () => {
    const before = (await getDash(admin.token)).body.data;
    await createInvoice(admin.token, client.id, { docType: "DEVIS" });
    await createInvoice(admin.token, client.id, { status: "DRAFT" });

    const after = (await getDash(admin.token)).body.data;
    expect(after.billed.total).toBe(before.billed.total);
    expect(after.outstanding.total).toBe(before.outstanding.total);
    expect(after.cash.received).toBe(before.cash.received);
  });

  test("une facture annulée sort de l'encours", async () => {
    const inv = await createInvoice(admin.token, client.id);
    const before = (await getDash(admin.token)).body.data;
    await request(app)
      .patch(`/api/invoices/${inv.id}/status`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ status: "ANNULEE" });
    const after = (await getDash(admin.token)).body.data;
    expect(after.outstanding.total).toBe(before.outstanding.total - 1000);
  });
});

describe("Devises et périodes", () => {
  let admin, client;

  beforeAll(async () => {
    admin = await createBusinessAgency();
    client = await createClient(admin.token);
  });

  test("une facture EUR est convertie via son taux figé (agence en DZD)", async () => {
    const inv = await createInvoice(admin.token, client.id, {
      items: [{ description: "Prestation export", quantity: 1, unitPrice: 100 }],
      currency: "EUR",
      exchangeRate: 150,
    });
    await pay(admin.token, inv.id, 100); // 100 EUR

    const dash = (await getDash(admin.token)).body.data;
    expect(dash.currency).toBe("DZD");
    expect(dash.cash.received).toBe(15000); // 100 × 150
    expect(dash.billed.total).toBe(15000);
  });

  test("le filtre de période exclut les paiements hors plage", async () => {
    // Période passée sans aucun paiement.
    const dash = (await getDash(admin.token, "?from=2020-01-01&to=2020-12-31")).body.data;
    expect(dash.cash.received).toBe(0);
    expect(dash.billed.total).toBe(0);
    // L'encours, lui, est une photo actuelle : il ne dépend pas de la période.
    expect(dash.outstanding.total).toBe(0); // facture EUR soldée
  });

  test("période invalide → 400", async () => {
    const res = await getDash(admin.token, "?from=2026-01-01&to=2025-01-01");
    expect(res.status).toBe(400);
  });
});

describe("Retards (photo actuelle)", () => {
  test("une facture SENT échue et non soldée compte dans le retard, pour son reste dû", async () => {
    const admin = await createBusinessAgency();
    const client = await createClient(admin.token);
    const inv = await createInvoice(admin.token, client.id, { dueDate: "2026-01-01" }); // échue
    await request(app)
      .patch(`/api/invoices/${inv.id}/status`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ status: "SENT" });
    await pay(admin.token, inv.id, 250);

    const dash = (await getDash(admin.token)).body.data;
    expect(dash.outstanding.overdue).toBe(750);
    expect(dash.outstanding.overdueCount).toBe(1);
  });
});
