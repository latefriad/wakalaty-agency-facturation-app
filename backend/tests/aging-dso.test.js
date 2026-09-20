const { app, request, createAgency, createClient } = require("./helpers");
const prisma = require("../src/config/database");

// Aging des créances (buckets sur le reste dû réel) et DSO pondéré.

async function createBusinessAgency(name) {
  const admin = await createAgency(name);
  await prisma.agency.update({ where: { id: admin.agency.id }, data: { plan: "BUSINESS" } });
  return admin;
}

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 3600 * 1000);
}

async function createInvoice(token, clientId, extra = {}) {
  const res = await request(app)
    .post("/api/invoices")
    .set("Authorization", `Bearer ${token}`)
    .send({
      clientId,
      items: [{ description: "P", quantity: 1, unitPrice: 1000 }],
      tax: 0,
      ...extra,
    });
  return res.body.data;
}

function getDash(token, params = "") {
  return request(app).get(`/api/dashboard${params}`).set("Authorization", `Bearer ${token}`);
}

describe("Aging des créances", () => {
  let admin, client;

  beforeAll(async () => {
    admin = await createBusinessAgency();
    client = await createClient(admin.token);

    // A : à échoir (échéance dans 10 j), 1000.
    await createInvoice(admin.token, client.id, { dueDate: daysAgo(-10).toISOString() });
    // B : 10 j de retard, partiellement payée (reste 600).
    const b = await createInvoice(admin.token, client.id, { dueDate: daysAgo(10).toISOString() });
    await request(app)
      .post(`/api/invoices/${b.id}/payments`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ amount: 400 });
    // C : 45 j de retard, 1000.
    await createInvoice(admin.token, client.id, { dueDate: daysAgo(45).toISOString() });
    // D : 90 j de retard, 1000.
    await createInvoice(admin.token, client.id, { dueDate: daysAgo(90).toISOString() });
    // E : en retard mais soldée → ne compte nulle part.
    const e = await createInvoice(admin.token, client.id, { dueDate: daysAgo(90).toISOString() });
    await request(app)
      .post(`/api/invoices/${e.id}/payments`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ amount: 1000 });
  });

  test("chaque facture tombe dans le bon bucket, sur son reste dû réel", async () => {
    const { aging } = (await getDash(admin.token)).body.data;
    expect(aging.notDue).toBe(1000); // A
    expect(aging.days1to30).toBe(600); // B (1000 − 400)
    expect(aging.days31to60).toBe(1000); // C
    expect(aging.days60plus).toBe(1000); // D — E soldée absente
  });

  test("la somme des buckets = l'encours total", async () => {
    const dash = (await getDash(admin.token)).body.data;
    const { aging, outstanding } = dash;
    expect(aging.notDue + aging.days1to30 + aging.days31to60 + aging.days60plus).toBeCloseTo(outstanding.total);
  });

  test("les pires retards sortent triés par reste dû décroissant, avec jours de retard", async () => {
    const { worstOverdue } = (await getDash(admin.token)).body.data;
    expect(worstOverdue).toHaveLength(3); // B, C, D (E soldée, A à échoir)
    expect(worstOverdue[0].remaining).toBe(1000);
    expect(worstOverdue[2].remaining).toBe(600);
    const late = worstOverdue.find((w) => w.remaining === 600);
    expect(late.daysLate).toBeGreaterThanOrEqual(9);
    expect(late.daysLate).toBeLessThanOrEqual(11);
    expect(late.clientName).toBeTruthy();
  });
});

describe("DSO (délai moyen d'encaissement)", () => {
  let admin, client;

  beforeAll(async () => {
    admin = await createBusinessAgency();
    client = await createClient(admin.token);
  });

  test("pondéré par montant : (20j×1000 + 10j×1000) / 2000 = 15 j", async () => {
    // Facture émise il y a 20 j, payée aujourd'hui.
    const a = await createInvoice(admin.token, client.id);
    await prisma.invoice.update({ where: { id: a.id }, data: { createdAt: daysAgo(20) } });
    await request(app)
      .post(`/api/invoices/${a.id}/payments`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ amount: 1000 });

    // Facture émise il y a 10 j, payée aujourd'hui.
    const b = await createInvoice(admin.token, client.id);
    await prisma.invoice.update({ where: { id: b.id }, data: { createdAt: daysAgo(10) } });
    await request(app)
      .post(`/api/invoices/${b.id}/payments`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ amount: 1000 });

    const { dso } = (await getDash(admin.token)).body.data;
    expect(dso.days).toBeGreaterThanOrEqual(14.5);
    expect(dso.days).toBeLessThanOrEqual(15.5);
  });

  test("null (pas 0) quand rien n'est encaissé sur la période", async () => {
    const { dso } = (await getDash(admin.token, "?from=2020-01-01&to=2020-12-31")).body.data;
    expect(dso.days).toBeNull();
  });
});
