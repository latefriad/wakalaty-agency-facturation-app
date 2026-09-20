const { app, request, createAgency, createClient } = require("./helpers");
const prisma = require("../src/config/database");

afterAll(() => prisma.$disconnect());

async function createInvoice(token, clientId, extra = {}) {
  const res = await request(app).post("/api/invoices")
    .set("Authorization", `Bearer ${token}`)
    .send({ clientId, items: [{ description: "X", quantity: 1, unitPrice: 1000 }], ...extra });
  return res.body.data;
}

describe("Recherche globale", () => {
  test("trouve clients et factures, scellée à l'agence", async () => {
    const a = await createAgency();
    const b = await createAgency();
    const clientA = await createClient(a.token, { name: "Zorglub Industries", email: "z@a.dz" });
    const inv = await createInvoice(a.token, clientA.id);
    await createClient(b.token, { name: "Zorglub Autre" });

    // Recherche par nom de client.
    const byName = await request(app).get("/api/search?q=Zorglub").set("Authorization", `Bearer ${a.token}`);
    expect(byName.body.data.clients.map((c) => c.name)).toContain("Zorglub Industries");
    // La facture du client remonte aussi (jointure client.name).
    expect(byName.body.data.invoices.map((i) => i.id)).toContain(inv.id);

    // Recherche par numéro de facture.
    const byNumber = await request(app).get(`/api/search?q=${inv.number}`).set("Authorization", `Bearer ${a.token}`);
    expect(byNumber.body.data.invoices.map((i) => i.number)).toContain(inv.number);

    // L'agence B ne voit que SON client, pas celui de A.
    const fromB = await request(app).get("/api/search?q=Zorglub").set("Authorization", `Bearer ${b.token}`);
    expect(fromB.body.data.clients.map((c) => c.name)).toEqual(["Zorglub Autre"]);
    expect(fromB.body.data.invoices).toHaveLength(0);
  });

  test("terme trop court → résultats vides", async () => {
    const { token } = await createAgency();
    const res = await request(app).get("/api/search?q=a").set("Authorization", `Bearer ${token}`);
    expect(res.body.data).toEqual({ clients: [], invoices: [], contracts: [] });
  });
});
