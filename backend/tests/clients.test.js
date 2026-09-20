const { app, request, createAgency, createClient } = require("./helpers");
const prisma = require("../src/config/database");

afterAll(() => prisma.$disconnect());

async function createInvoice(token, clientId, extra = {}) {
  const res = await request(app)
    .post("/api/invoices")
    .set("Authorization", `Bearer ${token}`)
    .send({ clientId, items: [{ description: "Prestation", quantity: 1, unitPrice: 1000 }], ...extra });
  return res.body.data;
}

describe("Module clients — fiche 360° et encours", () => {
  test("encours : facturé / payé / dû / en retard calculés correctement", async () => {
    const { token } = await createAgency();
    const client = await createClient(token, { email: "c@test.wakalati" });

    // Facture payée partiellement (1000, payé 400).
    const paidPart = await createInvoice(token, client.id);
    await request(app).post(`/api/invoices/${paidPart.id}/payments`)
      .set("Authorization", `Bearer ${token}`).send({ amount: 400 });

    // Facture échue impayée (1000) → compte dans « en retard ».
    await createInvoice(token, client.id, { dueDate: "2020-01-01" });

    // Un DEVIS ne compte PAS dans le facturé.
    await createInvoice(token, client.id, { docType: "DEVIS" });

    const ov = await request(app)
      .get(`/api/clients/${client.id}/overview`)
      .set("Authorization", `Bearer ${token}`);
    expect(ov.status).toBe(200);
    const e = ov.body.data.encours;
    expect(e.invoiced).toBe(2000);          // 2 factures × 1000 (devis exclu)
    expect(e.paid).toBe(400);
    expect(e.due).toBe(1600);               // 2000 - 400
    expect(e.overdue).toBe(1000);           // la facture échue impayée
    expect(ov.body.data.counts.invoices).toBe(3); // devis inclus dans la liste
  });

  test("encours identique entre la liste et la fiche 360°", async () => {
    const { token } = await createAgency();
    const client = await createClient(token);
    await createInvoice(token, client.id, { items: [{ description: "X", quantity: 2, unitPrice: 2500 }] });

    const list = await request(app).get("/api/clients").set("Authorization", `Bearer ${token}`);
    const row = list.body.data.find((c) => c.id === client.id);
    const ov = await request(app).get(`/api/clients/${client.id}/overview`).set("Authorization", `Bearer ${token}`);
    expect(row.encours.invoiced).toBe(5000);
    expect(row.encours.invoiced).toBe(ov.body.data.encours.invoiced);
  });

  test("une tâche peut être rattachée à un client et remonte dans la fiche", async () => {
    const { token } = await createAgency();
    const client = await createClient(token);

    const task = await request(app).post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Rappeler le client", clientId: client.id });
    expect(task.status).toBe(201);
    expect(task.body.data.clientId).toBe(client.id);

    const ov = await request(app).get(`/api/clients/${client.id}/overview`).set("Authorization", `Bearer ${token}`);
    expect(ov.body.data.counts.tasks).toBe(1);
    expect(ov.body.data.tasks[0].title).toBe("Rappeler le client");
  });

  test("recherche client élargie à l'e-mail et à la société", async () => {
    const { token } = await createAgency();
    await createClient(token, { name: "Alpha", email: "unique-mail@zeta.dz", company: "ZetaCorp" });

    const byEmail = await request(app).get("/api/clients?search=zeta.dz").set("Authorization", `Bearer ${token}`);
    expect(byEmail.body.data.some((c) => c.name === "Alpha")).toBe(true);

    const byCompany = await request(app).get("/api/clients?search=ZetaCorp").set("Authorization", `Bearer ${token}`);
    expect(byCompany.body.data.some((c) => c.name === "Alpha")).toBe(true);
  });

  test("tâche liée à un client d'une autre agence refusée (404)", async () => {
    const a = await createAgency();
    const b = await createAgency();
    const clientB = await createClient(b.token);

    const res = await request(app).post("/api/tasks")
      .set("Authorization", `Bearer ${a.token}`)
      .send({ title: "Cross-tenant", clientId: clientB.id });
    expect(res.status).toBe(404);
  });
});

describe("Module clients — timeline et notes", () => {
  const types = (tl) => tl.map((e) => e.type);

  test("la timeline est alimentée automatiquement par les événements", async () => {
    const { token } = await createAgency();
    const client = await createClient(token, { email: "c@test.wakalati" });

    // Création client → CLIENT_CREATED.
    let ov = await request(app).get(`/api/clients/${client.id}/overview`).set("Authorization", `Bearer ${token}`);
    expect(types(ov.body.data.timeline)).toContain("CLIENT_CREATED");

    // Facture émise → INVOICE_ISSUED.
    const inv = await createInvoice(token, client.id);
    // Paiement complet → INVOICE_PAID.
    await request(app).post(`/api/invoices/${inv.id}/payments`).set("Authorization", `Bearer ${token}`).send({ amount: 1000 });

    ov = await request(app).get(`/api/clients/${client.id}/overview`).set("Authorization", `Bearer ${token}`);
    const tl = types(ov.body.data.timeline);
    expect(tl).toContain("INVOICE_ISSUED");
    expect(tl).toContain("INVOICE_PAID");
  });

  test("un brouillon n'émet un événement qu'à la finalisation", async () => {
    const { token } = await createAgency();
    const client = await createClient(token);
    const draft = await createInvoice(token, client.id, { status: "DRAFT" });

    let ov = await request(app).get(`/api/clients/${client.id}/overview`).set("Authorization", `Bearer ${token}`);
    expect(types(ov.body.data.timeline)).not.toContain("INVOICE_ISSUED");

    await request(app).post(`/api/invoices/${draft.id}/finalize`).set("Authorization", `Bearer ${token}`);
    ov = await request(app).get(`/api/clients/${client.id}/overview`).set("Authorization", `Bearer ${token}`);
    expect(types(ov.body.data.timeline)).toContain("INVOICE_ISSUED");
  });

  test("note : ajout horodaté, présence dans la timeline, suppression", async () => {
    const { token } = await createAgency();
    const client = await createClient(token);

    const add = await request(app).post(`/api/clients/${client.id}/notes`)
      .set("Authorization", `Bearer ${token}`).send({ content: "Appeler le client" });
    expect(add.status).toBe(201);
    const noteId = add.body.data.id;
    expect(add.body.data.createdAt).toBeTruthy();

    let ov = await request(app).get(`/api/clients/${client.id}/overview`).set("Authorization", `Bearer ${token}`);
    expect(ov.body.data.counts.notes).toBe(1);
    const noteEntry = ov.body.data.timeline.find((e) => e.kind === "note");
    expect(noteEntry.message).toBe("Appeler le client");

    // Pas de doublon : la note n'apparaît qu'une fois dans la timeline.
    expect(ov.body.data.timeline.filter((e) => e.type === "NOTE_ADDED").length).toBe(1);

    const del = await request(app).delete(`/api/clients/${client.id}/notes/${noteId}`).set("Authorization", `Bearer ${token}`);
    expect(del.status).toBe(200);
    ov = await request(app).get(`/api/clients/${client.id}/overview`).set("Authorization", `Bearer ${token}`);
    expect(ov.body.data.counts.notes).toBe(0);
  });

  test("note vide refusée", async () => {
    const { token } = await createAgency();
    const client = await createClient(token);
    const res = await request(app).post(`/api/clients/${client.id}/notes`)
      .set("Authorization", `Bearer ${token}`).send({ content: "   " });
    expect(res.status).toBe(400);
  });
});

describe("Module clients — tags/segments et champs personnalisés", () => {
  test("tags normalisés (trim + dédoublonnage insensible à la casse)", async () => {
    const { token } = await createAgency();
    const res = await request(app).post("/api/clients")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Tagué", tags: ["Immobilier", "immobilier", "  Prioritaire  ", ""] });
    expect(res.status).toBe(201);
    expect(res.body.data.tags).toEqual(["Immobilier", "Prioritaire"]);
  });

  test("filtre par tag et liste des tags de l'agence", async () => {
    const { token } = await createAgency();
    await request(app).post("/api/clients").set("Authorization", `Bearer ${token}`).send({ name: "A", tags: ["VIP"] });
    await request(app).post("/api/clients").set("Authorization", `Bearer ${token}`).send({ name: "B", tags: ["Standard"] });

    const filtered = await request(app).get("/api/clients?tag=VIP").set("Authorization", `Bearer ${token}`);
    const names = filtered.body.data.map((c) => c.name);
    expect(names).toContain("A");
    expect(names).not.toContain("B");

    const tags = await request(app).get("/api/clients/meta/tags").set("Authorization", `Bearer ${token}`);
    expect(tags.body.data.sort()).toEqual(["Standard", "VIP"]);
  });

  test("champs personnalisés persistés et modifiables", async () => {
    const { token } = await createAgency();
    const created = await request(app).post("/api/clients")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "CF", customFields: { Secteur: "BTP", Ville: "Alger" } });
    expect(created.body.data.customFields).toEqual({ Secteur: "BTP", Ville: "Alger" });

    const updated = await request(app).put(`/api/clients/${created.body.data.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ customFields: { Secteur: "Retail" } });
    expect(updated.body.data.customFields).toEqual({ Secteur: "Retail" });
  });

  test("les tags d'une agence ne fuient pas vers une autre", async () => {
    const a = await createAgency();
    const b = await createAgency();
    await request(app).post("/api/clients").set("Authorization", `Bearer ${a.token}`).send({ name: "A", tags: ["SecretA"] });

    const tagsB = await request(app).get("/api/clients/meta/tags").set("Authorization", `Bearer ${b.token}`);
    expect(tagsB.body.data).not.toContain("SecretA");
  });
});

describe("Module clients — détection de doublons (non bloquante)", () => {
  test("doublon détecté sur e-mail et nom normalisés (accents/casse/espaces)", async () => {
    const { token } = await createAgency();
    await createClient(token, { name: "Société Générale", email: "Contact@Sg.dz", company: "SG SPA" });

    // Nom avec accents/casse/espaces différents → même client.
    const byName = await request(app).get("/api/clients/meta/check-duplicate")
      .query({ name: "societe   GENERALE" }).set("Authorization", `Bearer ${token}`);
    expect(byName.body.data).toHaveLength(1);
    expect(byName.body.data[0].reasons).toContain("name");

    // E-mail en casse différente → détecté.
    const byEmail = await request(app).get("/api/clients/meta/check-duplicate")
      .query({ email: "contact@sg.dz" }).set("Authorization", `Bearer ${token}`);
    expect(byEmail.body.data[0].reasons).toContain("email");

    // Aucun match.
    const none = await request(app).get("/api/clients/meta/check-duplicate")
      .query({ name: "Client Totalement Différent" }).set("Authorization", `Bearer ${token}`);
    expect(none.body.data).toHaveLength(0);
  });

  test("la création n'est jamais bloquée par un doublon (avertissement seulement)", async () => {
    const { token } = await createAgency();
    await createClient(token, { name: "Doublon", email: "dup@test.dz" });
    // Créer un second client identique reste autorisé (choix laissé à l'agence).
    const second = await request(app).post("/api/clients")
      .set("Authorization", `Bearer ${token}`).send({ name: "Doublon", email: "dup@test.dz" });
    expect(second.status).toBe(201);
  });

  test("check-duplicate exclut le client en cours d'édition", async () => {
    const { token } = await createAgency();
    const c = await createClient(token, { name: "Unique SARL", email: "u@test.dz" });
    const res = await request(app).get("/api/clients/meta/check-duplicate")
      .query({ name: "Unique SARL", excludeId: c.id }).set("Authorization", `Bearer ${token}`);
    expect(res.body.data).toHaveLength(0);
  });
});
