const { app, request, createAgency, createClient } = require("./helpers");
const prisma = require("../src/config/database");

afterAll(() => prisma.$disconnect());

async function createInvoice(token, clientId, extra = {}) {
  const res = await request(app)
    .post("/api/invoices")
    .set("Authorization", `Bearer ${token}`)
    .send({
      clientId,
      items: [{ description: "Prestation", quantity: 1, unitPrice: 1000 }],
      ...extra,
    });
  return res;
}

describe("Facturation", () => {
  test("numérotation séquentielle par agence, indépendante entre agences", async () => {
    const a = await createAgency();
    const b = await createAgency();
    const ca = await createClient(a.token);
    const cb = await createClient(b.token);

    const year = new Date().getFullYear();
    const i1 = await createInvoice(a.token, ca.id);
    const i2 = await createInvoice(a.token, ca.id);
    const i3 = await createInvoice(b.token, cb.id);

    expect(i1.body.data.number).toBe(`FAC-${year}-00001`);
    expect(i2.body.data.number).toBe(`FAC-${year}-00002`);
    // Chaque agence a sa propre séquence.
    expect(i3.body.data.number).toBe(`FAC-${year}-00001`);
  });

  test("totaux serveur : TVA par ligne prime sur le taux global", async () => {
    const { token } = await createAgency();
    const client = await createClient(token, { defaultTaxRate: 19 });

    const res = await createInvoice(token, client.id, {
      items: [
        { description: "A", quantity: 1, unitPrice: 1000 }, // hérite 19%
        { description: "B", quantity: 2, unitPrice: 500, taxRate: 9 }, // 9%
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.data.subtotal).toBe(2000);
    expect(res.body.data.taxAmount).toBeCloseTo(280);
    expect(res.body.data.total).toBeCloseTo(2280);
  });

  test("paiements partiels : cumul, refus du trop-payé, passage PAYEE", async () => {
    const { token } = await createAgency();
    const client = await createClient(token);
    const inv = (await createInvoice(token, client.id)).body.data;

    const p1 = await request(app)
      .post(`/api/invoices/${inv.id}/payments`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 400 });
    expect(p1.status).toBe(201);
    expect(p1.body.data.fullyPaid).toBe(false);

    const over = await request(app)
      .post(`/api/invoices/${inv.id}/payments`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 999999 });
    expect(over.status).toBe(400);

    const p2 = await request(app)
      .post(`/api/invoices/${inv.id}/payments`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 600 });
    expect(p2.body.data.fullyPaid).toBe(true);

    const check = await request(app)
      .get(`/api/invoices/${inv.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(check.body.data.status).toBe("PAYEE");
    expect(check.body.data.balance).toBe(0);
  });

  test("devis → facture : conversion unique avec numéro FAC", async () => {
    const { token } = await createAgency();
    const client = await createClient(token);
    const quote = (await createInvoice(token, client.id, { docType: "DEVIS" })).body.data;
    expect(quote.number).toMatch(/^DEV-/);

    const conv = await request(app)
      .post(`/api/invoices/${quote.id}/convert`)
      .set("Authorization", `Bearer ${token}`);
    expect(conv.status).toBe(201);
    expect(conv.body.data.number).toMatch(/^FAC-/);
    expect(conv.body.data.convertedFromId).toBe(quote.id);

    const again = await request(app)
      .post(`/api/invoices/${quote.id}/convert`)
      .set("Authorization", `Bearer ${token}`);
    expect(again.status).toBe(409);
  });

  test("facture échue → displayStatus EN_RETARD", async () => {
    const { token } = await createAgency();
    const client = await createClient(token);
    const res = await createInvoice(token, client.id, { dueDate: "2020-01-01" });
    expect(res.body.data.displayStatus).toBe("EN_RETARD");
    expect(res.body.data.isOverdue).toBe(true);
  });

  test("brouillon : sans numéro, ne consomme pas la séquence légale", async () => {
    const { token } = await createAgency();
    const client = await createClient(token);
    const year = new Date().getFullYear();

    // Un brouillon n'obtient aucun numéro.
    const draft = (await createInvoice(token, client.id, { status: "DRAFT" })).body.data;
    expect(draft.status).toBe("DRAFT");
    expect(draft.number).toBeNull();

    // La facture finalisée suivante prend le 1er numéro : le brouillon n'a
    // pas troué la séquence.
    const finalInv = (await createInvoice(token, client.id)).body.data;
    expect(finalInv.number).toBe(`FAC-${year}-00001`);

    // Finaliser le brouillon lui attribue le numéro suivant.
    const finalized = await request(app)
      .post(`/api/invoices/${draft.id}/finalize`)
      .set("Authorization", `Bearer ${token}`);
    expect(finalized.status).toBe(200);
    expect(finalized.body.data.number).toBe(`FAC-${year}-00002`);
    expect(finalized.body.data.status).toBe("EN_ATTENTE");

    // Re-finaliser est refusé.
    const again = await request(app)
      .post(`/api/invoices/${draft.id}/finalize`)
      .set("Authorization", `Bearer ${token}`);
    expect(again.status).toBe(400);
  });

  test("brouillon : changement de statut refusé avant finalisation", async () => {
    const { token } = await createAgency();
    const client = await createClient(token);
    const draft = (await createInvoice(token, client.id, { status: "DRAFT" })).body.data;

    const res = await request(app)
      .patch(`/api/invoices/${draft.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "PAYEE" });
    expect(res.status).toBe(400);
  });

  test("acompte : pourcentage et montant fixe, bornés au total", async () => {
    const { token } = await createAgency();
    const client = await createClient(token);

    // Acompte 30% de 1000 = 300.
    const pct = await createInvoice(token, client.id, { depositType: "PERCENT", depositValue: 30 });
    expect(pct.body.data.depositAmount).toBe(300);

    // Acompte fixe 250.
    const fixed = await createInvoice(token, client.id, { depositType: "FIXED", depositValue: 250 });
    expect(fixed.body.data.depositAmount).toBe(250);

    // Acompte fixe supérieur au total → borné au total.
    const capped = await createInvoice(token, client.id, { depositType: "FIXED", depositValue: 99999 });
    expect(capped.body.data.depositAmount).toBe(1000);
  });

  test("pénalité de retard : calculée seulement si la facture est échue", async () => {
    const { token } = await createAgency();
    const client = await createClient(token);

    // Non échue → pas de pénalité.
    const future = await createInvoice(token, client.id, { penaltyRate: 5, dueDate: "2099-01-01" });
    expect(future.body.data.penaltyAmount).toBe(0);

    // Échue → 5% du solde (1000) = 50, total à régler 1050.
    const overdue = await createInvoice(token, client.id, { penaltyRate: 5, dueDate: "2020-01-01" });
    expect(overdue.body.data.penaltyAmount).toBe(50);
    expect(overdue.body.data.totalWithPenalty).toBe(1050);
  });

  test("multidevises : devise et taux stockés, reportés à la conversion devis→facture", async () => {
    const { token } = await createAgency();
    const client = await createClient(token);

    const quote = (await createInvoice(token, client.id, { docType: "DEVIS", currency: "EUR", exchangeRate: 145, penaltyRate: 3 })).body.data;
    expect(quote.currency).toBe("EUR");
    expect(quote.exchangeRate).toBe(145);

    const conv = await request(app).post(`/api/invoices/${quote.id}/convert`).set("Authorization", `Bearer ${token}`);
    expect(conv.body.data.currency).toBe("EUR");
    expect(conv.body.data.exchangeRate).toBe(145);
    expect(conv.body.data.penaltyRate).toBe(3);
  });

  test("consultation publique → viewedAt et displayStatus VUE", async () => {
    const { token } = await createAgency();
    const client = await createClient(token);
    // Sans échéance : pas de risque d'être classée EN_RETARD.
    const inv = (await createInvoice(token, client.id)).body.data;
    expect(inv.viewedAt).toBeNull();

    const pub = await request(app).get(`/api/public/invoices/${inv.publicToken}`);
    expect(pub.status).toBe(200);

    const after = (await request(app)
      .get(`/api/invoices/${inv.id}`)
      .set("Authorization", `Bearer ${token}`)).body.data;
    expect(after.viewedAt).not.toBeNull();
    expect(after.displayStatus).toBe("VUE");
  });
});
