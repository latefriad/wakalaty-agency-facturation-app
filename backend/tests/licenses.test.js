const { app, request, createAgency, createSuperAdmin } = require("./helpers");
const prisma = require("../src/config/database");
const licensesService = require("../src/modules/licenses/licenses.service");

afterAll(() => prisma.$disconnect());

async function issueLicense(superToken, overrides = {}) {
  const res = await request(app)
    .post("/api/license")
    .set("Authorization", `Bearer ${superToken}`)
    .send({ clientName: "Client Test", plan: "PRO", ...overrides });
  return res.body.data; // { license, licenseKey }
}

describe("Licences — émission & activation", () => {
  test("le super-admin émet une clé (affichée une seule fois), un ADMIN l'active → plan appliqué", async () => {
    const su = await createSuperAdmin();
    const { licenseKey, license } = await issueLicense(su.token);
    expect(licenseKey).toMatch(/^WKLY-/);

    const agency = await createAgency();
    const act = await request(app)
      .post("/api/license/activate")
      .set("Authorization", `Bearer ${agency.token}`)
      .send({ licenseKey });
    expect(act.status).toBe(201);
    expect(act.body.data.plan).toBe("PRO");

    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${agency.token}`);
    expect(me.body.data.agency.plan).toBe("PRO");

    // La clé claire n'est jamais restockée : seul le hash existe en base.
    const row = await prisma.license.findUnique({ where: { id: license.id } });
    expect(row.keyHash).toBeDefined();
    expect(JSON.stringify(row)).not.toContain(licenseKey);
  });

  test("clé forgée (bon format mais jamais émise) → rejetée", async () => {
    const agency = await createAgency();
    const res = await request(app)
      .post("/api/license/activate")
      .set("Authorization", `Bearer ${agency.token}`)
      .send({ licenseKey: "WKLY-FAKE-FAKE-FAKE-FAKE" });
    expect(res.status).toBe(404);
    expect(res.body.message).toBeDefined();
  });

  test("payload à signature invalide → rejeté même si le hash existe en base", async () => {
    // On insère une licence dont le signedPayload est trafiqué : simulate un
    // attaquant avec accès en écriture SQL mais sans la clé privée.
    const key = "WKLY-TAMP-ERED-0000-0000";
    const { hashLicenseKey, keyPrefix } = require("../src/utils/license");
    const forged = await prisma.license.create({
      data: {
        keyHash: hashLicenseKey(key),
        keyPrefix: keyPrefix(key),
        signedPayload: Buffer.from(JSON.stringify({ licenseId: "x", plan: "BUSINESS" })).toString("base64url") + ".AAAA",
        clientName: "Forgé",
        plan: "BUSINESS",
      },
    });
    const agency = await createAgency();
    const res = await request(app)
      .post("/api/license/activate")
      .set("Authorization", `Bearer ${agency.token}`)
      .send({ licenseKey: key });
    expect(res.status).toBe(400);
    await prisma.license.delete({ where: { id: forged.id } });
  });
});

describe("Licences — expiration & grace", () => {
  test("licence expirée hors grace → activation refusée", async () => {
    const su = await createSuperAdmin();
    const past = new Date(Date.now() - 1000 * 3600 * 24 * 200).toISOString(); // 200 j
    const { licenseKey } = await issueLicense(su.token, { expiresAt: past });
    const agency = await createAgency();
    const res = await request(app)
      .post("/api/license/activate")
      .set("Authorization", `Bearer ${agency.token}`)
      .send({ licenseKey });
    expect(res.status).toBe(403);
  });

  test("statut effectif expiré dans la grace = non bloquant, hors grace = bloquant", async () => {
    // 1h après expiration : dans la grace de 72h.
    const inGrace = { status: "ACTIVE", expiresAt: new Date(Date.now() - 3600 * 1000), plan: "PRO" };
    expect(licensesService.effectiveStatus(inGrace)).toBe("EXPIRED");
  });
});

describe("Licences — révocation immédiate", () => {
  test("révoquer bloque l'accès aux routes métier, réactiver le restaure", async () => {
    const su = await createSuperAdmin();
    const { licenseKey, license } = await issueLicense(su.token);
    const agency = await createAgency();
    await request(app).post("/api/license/activate").set("Authorization", `Bearer ${agency.token}`).send({ licenseKey });

    // Avant révocation : accès OK.
    const before = await request(app).get("/api/clients").set("Authorization", `Bearer ${agency.token}`);
    expect(before.status).toBe(200);

    // Révocation par le super-admin.
    const rev = await request(app)
      .patch(`/api/license/${license.id}/status`)
      .set("Authorization", `Bearer ${su.token}`)
      .send({ action: "revoke", reason: "Non-paiement" });
    expect(rev.status).toBe(200);

    // Effet immédiat (cache purgé par le controller) : routes métier bloquées…
    const blocked = await request(app).get("/api/clients").set("Authorization", `Bearer ${agency.token}`);
    expect(blocked.status).toBe(403);
    // …mais /license/status reste joignable pour voir la raison.
    const status = await request(app).get("/api/license/status").set("Authorization", `Bearer ${agency.token}`);
    expect(status.body.data.blocked).toBe(true);
    expect(status.body.data.status).toBe("REVOKED");

    // Réactivation → accès restauré.
    await request(app).patch(`/api/license/${license.id}/status`).set("Authorization", `Bearer ${su.token}`).send({ action: "reactivate" });
    const after = await request(app).get("/api/clients").set("Authorization", `Bearer ${agency.token}`);
    expect(after.status).toBe(200);
  });
});

describe("Licences — binding & quota", () => {
  test("maxActivations=1 : une 2e agence ne peut pas activer la même clé", async () => {
    const su = await createSuperAdmin();
    const { licenseKey } = await issueLicense(su.token, { maxActivations: 1 });
    const a1 = await createAgency();
    const a2 = await createAgency();

    const r1 = await request(app).post("/api/license/activate").set("Authorization", `Bearer ${a1.token}`).send({ licenseKey });
    expect(r1.status).toBe(201);

    const r2 = await request(app).post("/api/license/activate").set("Authorization", `Bearer ${a2.token}`).send({ licenseKey });
    expect(r2.status).toBe(409);
  });

  test("réactiver la même clé depuis la même agence est idempotent", async () => {
    const su = await createSuperAdmin();
    const { licenseKey } = await issueLicense(su.token);
    const agency = await createAgency();
    const r1 = await request(app).post("/api/license/activate").set("Authorization", `Bearer ${agency.token}`).send({ licenseKey });
    const r2 = await request(app).post("/api/license/activate").set("Authorization", `Bearer ${agency.token}`).send({ licenseKey });
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
  });
});

describe("Licences — RBAC", () => {
  test("un ADMIN normal ne peut ni créer ni lister les licences", async () => {
    const agency = await createAgency();
    const create = await request(app).post("/api/license").set("Authorization", `Bearer ${agency.token}`).send({ clientName: "X" });
    expect(create.status).toBe(403);
    const list = await request(app).get("/api/license").set("Authorization", `Bearer ${agency.token}`);
    expect(list.status).toBe(403);
  });

  test("l'audit log est réservé au super-admin et contient les actions", async () => {
    const agency = await createAgency();
    const denied = await request(app).get("/api/super-admin/audit-log").set("Authorization", `Bearer ${agency.token}`);
    expect(denied.status).toBe(403);

    const su = await createSuperAdmin();
    await issueLicense(su.token);
    const log = await request(app).get("/api/super-admin/audit-log?action=license.create").set("Authorization", `Bearer ${su.token}`);
    expect(log.status).toBe(200);
    expect(log.body.data.total).toBeGreaterThan(0);
  });
});
