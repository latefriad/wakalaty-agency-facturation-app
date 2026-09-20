const { app, request, uniqueEmail, createAgency } = require("./helpers");
const prisma = require("../src/config/database");

// Comptes fournisseurs : une facture fournisseur est un ENGAGEMENT ; payer
// crée la dépense (source unique du décaissement) et alimente l'échéancier
// de la prévision de trésorerie.

async function createBusinessAgency(name) {
  const admin = await createAgency(name);
  await prisma.agency.update({ where: { id: admin.agency.id }, data: { plan: "BUSINESS" } });
  return admin;
}

function api(token) {
  return {
    get: (url) => request(app).get(url).set("Authorization", `Bearer ${token}`),
    post: (url, body) => request(app).post(url).set("Authorization", `Bearer ${token}`).send(body),
    put: (url, body) => request(app).put(url).set("Authorization", `Bearer ${token}`).send(body),
    patch: (url, body) => request(app).patch(url).set("Authorization", `Bearer ${token}`).send(body || {}),
    delete: (url) => request(app).delete(url).set("Authorization", `Bearer ${token}`),
  };
}

describe("Fournisseurs : CRUD et RBAC", () => {
  let admin, a;

  beforeAll(async () => {
    admin = await createBusinessAgency();
    a = api(admin.token);
  });

  test("création, liste avec encours, suppression refusée si factures (409)", async () => {
    const sup = await a.post("/api/suppliers", { name: "Imprimerie El Djazair", phone: "021..." });
    expect(sup.status).toBe(201);

    await a.post(`/api/suppliers/${sup.body.data.id}/bills`, { amount: 5000, category: "MATERIEL" });

    const list = await a.get("/api/suppliers");
    const row = list.body.data.find((s) => s.id === sup.body.data.id);
    expect(row.outstanding).toBe(5000);
    expect(row.pendingBills).toBe(1);

    const del = await a.delete(`/api/suppliers/${sup.body.data.id}`);
    expect(del.status).toBe(409);
  });

  test("un employé n'accède pas aux fournisseurs (403)", async () => {
    const email = uniqueEmail("emp");
    await a.post("/api/users", { email, password: "password123", name: "Emp", role: "EMPLOYEE" });
    const emp = await request(app).post("/api/auth/login").send({ email, password: "password123" });
    const res = await request(app).get("/api/suppliers").set("Authorization", `Bearer ${emp.body.data.token}`);
    expect(res.status).toBe(403);
    const bills = await request(app).get("/api/suppliers/bills").set("Authorization", `Bearer ${emp.body.data.token}`);
    expect(bills.status).toBe(403);
  });

  test("isolation tenant", async () => {
    const other = await createBusinessAgency("Agence H");
    const res = await api(other.token).get("/api/suppliers");
    expect(res.body.data).toHaveLength(0);
  });
});

describe("Paiement d'une facture fournisseur = la dépense", () => {
  let admin, a, supplierId, billId;

  beforeAll(async () => {
    admin = await createBusinessAgency();
    a = api(admin.token);
    const sup = await a.post("/api/suppliers", { name: "Régie Ads" });
    supplierId = sup.body.data.id;
    const bill = await a.post(`/api/suppliers/${supplierId}/bills`, {
      amount: 100,
      currency: "EUR",
      exchangeRate: 150,
      category: "ADS",
      reference: "FA-2026-07",
    });
    billId = bill.body.data.id;
  });

  test("payer crée la dépense liée (catégorie, devise, taux) et passe la facture PAYEE", async () => {
    const before = (await a.get("/api/dashboard")).body.data;
    expect(before.expenses.total).toBe(0);
    expect(before.payables.total).toBe(15000); // 100 EUR × 150

    const pay = await a.post(`/api/suppliers/bills/${billId}/pay`);
    expect(pay.status).toBe(200);
    expect(pay.body.data.status).toBe("PAYEE");
    expect(pay.body.data.expenseId).toBeTruthy();

    const expense = await prisma.expense.findUnique({ where: { id: pay.body.data.expenseId } });
    expect(expense.amount).toBe(100);
    expect(expense.currency).toBe("EUR");
    expect(expense.exchangeRate).toBe(150);
    expect(expense.category).toBe("ADS");
    expect(expense.notes).toContain("Régie Ads");

    // Le dashboard voit la dépense (trésorerie/bénéfice) et l'échéancier se vide :
    // pas de double comptage, un seul décaissement.
    const after = (await a.get("/api/dashboard")).body.data;
    expect(after.expenses.total).toBe(15000);
    expect(after.payables.total).toBe(0);
  });

  test("payer deux fois → 409, une seule dépense", async () => {
    const again = await a.post(`/api/suppliers/bills/${billId}/pay`);
    expect(again.status).toBe(409);
    const count = await prisma.expense.count({ where: { agencyId: admin.agency.id } });
    expect(count).toBe(1);
  });

  test("une facture payée n'est ni modifiable ni annulable", async () => {
    const upd = await a.put(`/api/suppliers/bills/${billId}`, { amount: 999 });
    expect(upd.status).toBe(400);
    const cancel = await a.patch(`/api/suppliers/bills/${billId}/cancel`);
    expect(cancel.status).toBe(404);
  });

  test("annuler un engagement non payé le sort de l'échéancier", async () => {
    const bill = await a.post(`/api/suppliers/${supplierId}/bills`, { amount: 800, category: "AUTRE" });
    const cancel = await a.patch(`/api/suppliers/bills/${bill.body.data.id}/cancel`);
    expect(cancel.status).toBe(200);
    expect(cancel.body.data.status).toBe("ANNULEE");
    const dash = (await a.get("/api/dashboard")).body.data;
    expect(dash.payables.total).toBe(0);
  });
});

describe("Échéancier dans la prévision de trésorerie", () => {
  let admin, a;

  beforeAll(async () => {
    admin = await createBusinessAgency();
    a = api(admin.token);
    const sup = await a.post("/api/suppliers", { name: "Bailleur" });

    // Échue (2000) → mois courant ; à échoir mois prochain (5000) ;
    // hors horizon (+5 mois, 9999) → exclue.
    await a.post(`/api/suppliers/${sup.body.data.id}/bills`, { amount: 2000, dueDate: "2026-01-10", category: "LOYER" });
    const next = new Date();
    next.setMonth(next.getMonth() + 1, 15);
    await a.post(`/api/suppliers/${sup.body.data.id}/bills`, { amount: 5000, dueDate: next.toISOString().slice(0, 10), category: "LOYER" });
    const far = new Date();
    far.setMonth(far.getMonth() + 5, 15);
    await a.post(`/api/suppliers/${sup.body.data.id}/bills`, { amount: 9999, dueDate: far.toISOString().slice(0, 10), category: "LOYER" });
  });

  test("payables : total et retard corrects", async () => {
    const { payables } = (await a.get("/api/dashboard")).body.data;
    expect(payables.total).toBe(2000 + 5000 + 9999);
    expect(payables.overdue).toBe(2000);
    expect(payables.overdueCount).toBe(1);
  });

  test("l'échéancier prime sur la moyenne quand il est plus élevé (source affichée)", async () => {
    // Aucune dépense passée → moyenne = 0 : les sorties prévues viennent des factures.
    const { forecast } = (await a.get("/api/dashboard")).body.data;
    const [m0, m1, m2] = forecast.months;
    expect(m0.expectedOut).toBe(2000);
    expect(m0.payablesDue).toBe(2000);
    expect(m0.expectedOutSource).toBe("payables");
    expect(m1.expectedOut).toBe(5000);
    expect(m1.expectedOutSource).toBe("payables");
    expect(m2.payablesDue).toBe(0); // la facture à +5 mois est hors horizon
    expect(m0.projectedBalance).toBe(-2000);
    expect(m1.projectedBalance).toBe(-7000);
  });
});
