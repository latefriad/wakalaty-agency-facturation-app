const { app, request, uniqueEmail, createAgency, createClient } = require("./helpers");
const prisma = require("../src/config/database");

// Rentabilité par client (encaissé − coûts directs) et export Excel du
// rapport — mêmes définitions que le dashboard, jamais un recalcul parallèle.

async function createBusinessAgency(name) {
  const admin = await createAgency(name);
  await prisma.agency.update({ where: { id: admin.agency.id }, data: { plan: "BUSINESS" } });
  return admin;
}

async function createPaidInvoice(token, clientId, amount) {
  const inv = await request(app)
    .post("/api/invoices")
    .set("Authorization", `Bearer ${token}`)
    .send({ clientId, items: [{ description: "P", quantity: 1, unitPrice: amount }], tax: 0 });
  await request(app)
    .post(`/api/invoices/${inv.body.data.id}/payments`)
    .set("Authorization", `Bearer ${token}`)
    .send({ amount });
  return inv.body.data;
}

describe("Rentabilité par client", () => {
  let admin, clientA, clientB;

  beforeAll(async () => {
    admin = await createBusinessAgency();
    clientA = await createClient(admin.token, { name: "Client Rentable" });
    clientB = await createClient(admin.token, { name: "Client À Perte" });

    // A : 2000 encaissés, 300 de coûts directs → profit 1700.
    await createPaidInvoice(admin.token, clientA.id, 2000);
    // B : rien d'encaissé, 200 de coûts directs → profit −200.
    const service = await prisma.service.create({ data: { name: "Svc Test", agencyId: admin.agency.id } });
    await prisma.serviceCharge.create({ data: { amount: 300, clientId: clientA.id, serviceId: service.id } });
    await prisma.serviceCharge.create({ data: { amount: 200, clientId: clientB.id, serviceId: service.id } });
  });

  test("profit = encaissé − coûts directs, clients à perte identifiés, tri décroissant", async () => {
    const { clientProfit } = (await request(app).get("/api/dashboard").set("Authorization", `Bearer ${admin.token}`)).body.data;

    const a = clientProfit.find((c) => c.clientId === clientA.id);
    const b = clientProfit.find((c) => c.clientId === clientB.id);
    expect(a.received).toBe(2000);
    expect(a.directCosts).toBe(300);
    expect(a.profit).toBe(1700);
    expect(b.received).toBe(0);
    expect(b.profit).toBe(-200);
    // Tri : le rentable avant celui à perte.
    expect(clientProfit.indexOf(a)).toBeLessThan(clientProfit.indexOf(b));
  });

  test("le filtre de période s'applique à l'encaissé, pas aux coûts (non datés)", async () => {
    const res = await request(app)
      .get("/api/dashboard?from=2020-01-01&to=2020-12-31")
      .set("Authorization", `Bearer ${admin.token}`);
    const a = res.body.data.clientProfit.find((c) => c.clientId === clientA.id);
    expect(a.received).toBe(0);
    expect(a.directCosts).toBe(300);
  });
});

describe("Export Excel", () => {
  let admin;

  beforeAll(async () => {
    admin = await createBusinessAgency();
    const client = await createClient(admin.token);
    await createPaidInvoice(admin.token, client.id, 1500);
  });

  test("renvoie un vrai fichier xlsx", async () => {
    const res = await request(app)
      .get("/api/dashboard/export.xlsx")
      .set("Authorization", `Bearer ${admin.token}`)
      .buffer(true)
      .parse((r, cb) => {
        const chunks = [];
        r.on("data", (c) => chunks.push(c));
        r.on("end", () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("spreadsheetml");
    expect(res.headers["content-disposition"]).toContain(".xlsx");
    // Un xlsx est un zip : signature PK.
    expect(res.body.slice(0, 2).toString()).toBe("PK");
    expect(res.body.length).toBeGreaterThan(2000);
  });

  test("réservé aux rôles financiers (employé → 403)", async () => {
    const email = uniqueEmail("emp");
    await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ email, password: "password123", name: "Emp", role: "EMPLOYEE" });
    const emp = await request(app).post("/api/auth/login").send({ email, password: "password123" });
    const res = await request(app)
      .get("/api/dashboard/export.xlsx")
      .set("Authorization", `Bearer ${emp.body.data.token}`);
    expect(res.status).toBe(403);
  });
});
