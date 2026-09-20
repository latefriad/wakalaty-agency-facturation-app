const { app, request, uniqueEmail, createAgency, createClient } = require("./helpers");
const prisma = require("../src/config/database");

// Budget vs réel (objectifs mensuels vs chiffres aux mêmes définitions) et
// prévision de trésorerie à 3 mois (hypothèses documentées).

async function createBusinessAgency(name) {
  const admin = await createAgency(name);
  await prisma.agency.update({ where: { id: admin.agency.id }, data: { plan: "BUSINESS" } });
  return admin;
}

function ym(offset = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return { year: d.getFullYear(), month: d.getMonth() + 1, key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` };
}

function getDash(token, params = "") {
  return request(app).get(`/api/dashboard${params}`).set("Authorization", `Bearer ${token}`);
}

describe("Budgets : CRUD et RBAC", () => {
  let admin;

  beforeAll(async () => {
    admin = await createBusinessAgency();
  });

  test("upsert idempotent par (année, mois), catégorie inconnue refusée", async () => {
    const { year, month } = ym();
    const r1 = await request(app)
      .put(`/api/budgets/${year}/${month}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ revenueTarget: 100000, expenseBudgets: { LOYER: 20000, ADS: 10000 } });
    expect(r1.status).toBe(200);

    // Re-saisie : écrase, ne duplique pas.
    const r2 = await request(app)
      .put(`/api/budgets/${year}/${month}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ revenueTarget: 120000, expenseBudgets: { LOYER: 25000 } });
    expect(r2.status).toBe(200);
    const list = await request(app)
      .get(`/api/budgets?year=${year}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(list.body.data.filter((b) => b.month === month)).toHaveLength(1);
    expect(list.body.data.find((b) => b.month === month).revenueTarget).toBe(120000);

    const bad = await request(app)
      .put(`/api/budgets/${year}/${month}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ revenueTarget: 0, expenseBudgets: { CAFE: 100 } });
    expect(bad.status).toBe(400);

    const badMonth = await request(app)
      .put(`/api/budgets/${year}/13`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ revenueTarget: 0 });
    expect(badMonth.status).toBe(400);
  });

  test("un employé n'accède pas aux budgets (403)", async () => {
    const email = uniqueEmail("emp");
    await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ email, password: "password123", name: "Emp", role: "EMPLOYEE" });
    const emp = await request(app).post("/api/auth/login").send({ email, password: "password123" });
    const res = await request(app).get("/api/budgets").set("Authorization", `Bearer ${emp.body.data.token}`);
    expect(res.status).toBe(403);
  });
});

describe("Budget vs réel dans le dashboard", () => {
  let admin, client;

  beforeAll(async () => {
    admin = await createBusinessAgency();
    client = await createClient(admin.token);
    const { year, month } = ym();
    await request(app)
      .put(`/api/budgets/${year}/${month}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ revenueTarget: 5000, expenseBudgets: { LOYER: 1000, ADS: 500 } });

    // Réalisé : 2000 encaissés, 1200 de loyer (dépassement), 0 pub.
    const inv = await request(app)
      .post("/api/invoices")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ clientId: client.id, items: [{ description: "P", quantity: 1, unitPrice: 2000 }], tax: 0 });
    await request(app)
      .post(`/api/invoices/${inv.body.data.id}/payments`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ amount: 2000 });
    await request(app)
      .post("/api/expenses")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ amount: 1200, category: "LOYER" });
  });

  test("objectifs vs réalisé, dépassement par catégorie visible", async () => {
    const first = new Date();
    const from = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, "0")}-01`;
    const { budget } = (await getDash(admin.token, `?from=${from}`)).body.data;

    expect(budget.defined).toBe(true);
    expect(budget.revenueTarget).toBe(5000);
    expect(budget.revenueActual).toBe(2000);
    expect(budget.expenseBudgetTotal).toBe(1500);
    expect(budget.expenseActualTotal).toBe(1200);

    const loyer = budget.byCategory.find((c) => c.category === "LOYER");
    expect(loyer.budget).toBe(1000);
    expect(loyer.actual).toBe(1200); // dépassement identifiable (actual > budget)
    const ads = budget.byCategory.find((c) => c.category === "ADS");
    expect(ads.actual).toBe(0);
  });

  test("période sans budget → defined:false", async () => {
    const { budget } = (await getDash(admin.token, "?from=2020-01-01&to=2020-12-31")).body.data;
    expect(budget.defined).toBe(false);
    expect(budget.revenueTarget).toBe(0);
  });
});

describe("Prévision de trésorerie (3 mois)", () => {
  let admin, client;

  beforeAll(async () => {
    admin = await createBusinessAgency();
    client = await createClient(admin.token);
    await prisma.agency.update({ where: { id: admin.agency.id }, data: { openingBalance: 10000 } });

    // Facture échue (reste 1000) → attendue le mois courant.
    await request(app)
      .post("/api/invoices")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ clientId: client.id, items: [{ description: "P", quantity: 1, unitPrice: 1000 }], tax: 0, dueDate: "2026-01-01" });
    // Facture à échoir le mois prochain (2000).
    const next = new Date();
    next.setMonth(next.getMonth() + 1, 15);
    await request(app)
      .post("/api/invoices")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ clientId: client.id, items: [{ description: "P", quantity: 1, unitPrice: 2000 }], tax: 0, dueDate: next.toISOString().slice(0, 10) });
    // Facture au-delà de l'horizon (exclue).
    const far = new Date();
    far.setMonth(far.getMonth() + 5, 15);
    await request(app)
      .post("/api/invoices")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ clientId: client.id, items: [{ description: "P", quantity: 1, unitPrice: 9999 }], tax: 0, dueDate: far.toISOString().slice(0, 10) });

    // Dépenses des 3 derniers mois : 3000 → moyenne 1000/mois.
    await request(app)
      .post("/api/expenses")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ amount: 3000, category: "AUTRE" });
    // Budget de dépenses saisi pour le mois prochain : prime sur la moyenne.
    const m1 = ym(1);
    await request(app)
      .put(`/api/budgets/${m1.year}/${m1.month}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ revenueTarget: 0, expenseBudgets: { SALAIRES: 700 } });
  });

  test("entrées par mois d'échéance, sorties budget/moyenne, solde projeté cumulé", async () => {
    const { forecast, treasury } = (await getDash(admin.token)).body.data;
    expect(forecast.months).toHaveLength(3);
    expect(forecast.startingBalance).toBe(treasury.balance); // 10000 − 3000 = 7000

    const [m0, m1, m2] = forecast.months;
    // Mois courant : la facture échue (1000) rentre, sorties = moyenne 3 mois (1000).
    expect(m0.expectedIn).toBe(1000);
    expect(m0.expectedOut).toBe(1000);
    expect(m0.expectedOutSource).toBe("average");
    expect(m0.projectedBalance).toBe(7000 + 1000 - 1000);
    // Mois +1 : la facture à échoir (2000) rentre, le budget saisi (700) prime.
    expect(m1.expectedIn).toBe(2000);
    expect(m1.expectedOut).toBe(700);
    expect(m1.expectedOutSource).toBe("budget");
    expect(m1.projectedBalance).toBe(8300); // 7000 + (1000−1000) + (2000−700)
    // Mois +2 : rien d'attendu (la facture à +5 mois est hors horizon).
    expect(m2.expectedIn).toBe(0);
    expect(m2.expectedOutSource).toBe("average");
  });
});
