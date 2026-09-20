const path = require("path");
const fs = require("fs");
const os = require("os");
const { app, request, uniqueEmail, createAgency, createClient } = require("./helpers");
const prisma = require("../src/config/database");

// Charges + bénéfice réel + trésorerie : bénéfice = encaissé − dépenses de
// la période (caisse), trésorerie = calage initial + cumul historique.

async function createBusinessAgency(name) {
  const admin = await createAgency(name);
  await prisma.agency.update({ where: { id: admin.agency.id }, data: { plan: "BUSINESS" } });
  return admin;
}

function addExpense(token, data) {
  return request(app)
    .post("/api/expenses")
    .set("Authorization", `Bearer ${token}`)
    .send({ amount: 1000, category: "LOYER", ...data });
}

function getDash(token, params = "") {
  return request(app).get(`/api/dashboard${params}`).set("Authorization", `Bearer ${token}`);
}

describe("Charges : CRUD et RBAC", () => {
  let admin;

  beforeAll(async () => {
    admin = await createBusinessAgency();
  });

  test("création avec catégorie fermée ; catégorie inconnue refusée (400)", async () => {
    const ok = await addExpense(admin.token, { amount: 5000, category: "ADS", notes: "Meta Ads" });
    expect(ok.status).toBe(201);
    expect(ok.body.data.category).toBe("ADS");

    const bad = await addExpense(admin.token, { category: "CAFE" });
    expect(bad.status).toBe(400);
  });

  test("un employé n'accède pas aux charges (403)", async () => {
    const email = uniqueEmail("emp");
    await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ email, password: "password123", name: "Emp", role: "EMPLOYEE" });
    const emp = await request(app).post("/api/auth/login").send({ email, password: "password123" });

    const list = await request(app).get("/api/expenses").set("Authorization", `Bearer ${emp.body.data.token}`);
    expect(list.status).toBe(403);
    const create = await addExpense(emp.body.data.token, {});
    expect(create.status).toBe(403);
  });

  test("filtres par période et catégorie", async () => {
    await addExpense(admin.token, { amount: 200, category: "TRANSPORT", date: "2026-01-15" });
    const res = await request(app)
      .get("/api/expenses?from=2026-01-01&to=2026-01-31&category=TRANSPORT")
      .set("Authorization", `Bearer ${admin.token}`);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].amount).toBe(200);
  });

  test("isolation tenant", async () => {
    const other = await createBusinessAgency("Agence F");
    const res = await request(app).get("/api/expenses").set("Authorization", `Bearer ${other.token}`);
    expect(res.body.data).toHaveLength(0);
  });
});

describe("Bénéfice et trésorerie", () => {
  let admin, client;

  beforeAll(async () => {
    admin = await createBusinessAgency();
    client = await createClient(admin.token);
  });

  test("bénéfice = encaissé − dépenses sur la période, marge = bénéfice ÷ encaissé", async () => {
    // Encaissé : facture 1000 payée intégralement.
    const inv = await request(app)
      .post("/api/invoices")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ clientId: client.id, items: [{ description: "P", quantity: 1, unitPrice: 1000 }], tax: 0 });
    await request(app)
      .post(`/api/invoices/${inv.body.data.id}/payments`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ amount: 1000 });
    // Dépense : 400.
    await addExpense(admin.token, { amount: 400, category: "LOYER" });

    const dash = (await getDash(admin.token)).body.data;
    expect(dash.cash.received).toBe(1000);
    expect(dash.expenses.total).toBe(400);
    expect(dash.profit.net).toBe(600);
    expect(dash.profit.margin).toBeCloseTo(0.6);
    expect(dash.expenses.byCategory).toEqual([{ category: "LOYER", total: 400 }]);
  });

  test("une dépense en EUR est convertie via son taux figé", async () => {
    await addExpense(admin.token, { amount: 100, currency: "EUR", exchangeRate: 150, category: "ABONNEMENTS" });
    const dash = (await getDash(admin.token)).body.data;
    expect(dash.expenses.total).toBe(400 + 15000);
  });

  test("la trésorerie = solde initial + cumul historique, indépendante de la période", async () => {
    await request(app)
      .put("/api/agencies/me")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ openingBalance: 50000 });

    // Période vide : encaissé/dépenses période = 0, mais la trésorerie reste.
    const dash = (await getDash(admin.token, "?from=2020-01-01&to=2020-12-31")).body.data;
    expect(dash.cash.received).toBe(0);
    expect(dash.treasury.openingBalance).toBe(50000);
    expect(dash.treasury.balance).toBe(50000 + 1000 - 15400);
  });

  test("marge null (pas 0) quand rien n'est encaissé", async () => {
    const dash = (await getDash(admin.token, "?from=2020-01-01&to=2020-12-31")).body.data;
    expect(dash.profit.margin).toBeNull();
  });
});

describe("Justificatifs", () => {
  let admin, expenseId, tmpFile;

  beforeAll(async () => {
    admin = await createBusinessAgency();
    const res = await addExpense(admin.token, { amount: 300, category: "MATERIEL" });
    expenseId = res.body.data.id;
    tmpFile = path.join(os.tmpdir(), `recu-${Date.now()}.pdf`);
    fs.writeFileSync(tmpFile, "%PDF-1.4 recu");
  });

  afterAll(() => fs.rmSync(tmpFile, { force: true }));

  test("upload + téléchargement authentifié ; jamais servi en statique", async () => {
    const up = await request(app)
      .post(`/api/expenses/${expenseId}/attachment`)
      .set("Authorization", `Bearer ${admin.token}`)
      .attach("file", tmpFile);
    expect(up.status).toBe(201);
    expect(up.body.data.attachment).toBeUndefined(); // nom physique jamais exposé

    const dl = await request(app)
      .get(`/api/expenses/${expenseId}/attachment`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(dl.status).toBe(200);

    const row = await prisma.expense.findUnique({ where: { id: expenseId }, select: { attachment: true } });
    const pub = await request(app).get(`/uploads/expenses/${row.attachment}`);
    expect(pub.status).toBe(404);
  });

  test("l'admin d'une autre agence n'y accède pas (404)", async () => {
    const other = await createBusinessAgency("Agence G");
    const res = await request(app)
      .get(`/api/expenses/${expenseId}/attachment`)
      .set("Authorization", `Bearer ${other.token}`);
    expect(res.status).toBe(404);
  });
});
