const path = require("path");
const fs = require("fs");
const os = require("os");
const { app, request, uniqueEmail, createAgency } = require("./helpers");
const prisma = require("../src/config/database");

// Lot 4 : documents RH (stockés hors statique public, téléchargement audité,
// réservé admin + intéressé) et hiérarchie manager (organigramme + validation
// des congés par le manager direct).

async function createBusinessAgency(name) {
  const admin = await createAgency(name);
  await prisma.agency.update({ where: { id: admin.agency.id }, data: { plan: "BUSINESS" } });
  return admin;
}

async function createEmployeeWithAccount(adminToken, name) {
  const email = uniqueEmail("l4");
  const empRes = await request(app)
    .post("/api/employees")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name, email, salary: 40000 });
  await request(app)
    .post("/api/users")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ email, password: "password123", name, role: "EMPLOYEE" });
  const login = await request(app).post("/api/auth/login").send({ email, password: "password123" });
  return { employeeId: empRes.body.data.id, token: login.body.data.token, email };
}

describe("Documents RH", () => {
  let admin, emp1, emp2, tmpFile, docId;

  beforeAll(async () => {
    admin = await createBusinessAgency();
    emp1 = await createEmployeeWithAccount(admin.token, "Doc Un");
    emp2 = await createEmployeeWithAccount(admin.token, "Doc Deux");
    tmpFile = path.join(os.tmpdir(), `contrat-test-${Date.now()}.pdf`);
    fs.writeFileSync(tmpFile, "%PDF-1.4 test wakalati");
  });

  afterAll(() => {
    fs.rmSync(tmpFile, { force: true });
  });

  test("l'admin joint un document à une fiche", async () => {
    const res = await request(app)
      .post(`/api/employees/${emp1.employeeId}/documents`)
      .set("Authorization", `Bearer ${admin.token}`)
      .field("name", "Contrat CDI")
      .attach("file", tmpFile);
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe("Contrat CDI");
    // Le nom de fichier physique ne sort jamais de l'API.
    expect(res.body.data.filename).toBeUndefined();
    docId = res.body.data.id;
  });

  test("un format non autorisé est refusé (400)", async () => {
    const bad = path.join(os.tmpdir(), `script-${Date.now()}.sh`);
    fs.writeFileSync(bad, "echo pwned");
    const res = await request(app)
      .post(`/api/employees/${emp1.employeeId}/documents`)
      .set("Authorization", `Bearer ${admin.token}`)
      .attach("file", bad);
    expect(res.status).toBe(400);
    fs.rmSync(bad, { force: true });
  });

  test("l'employé voit et télécharge SES documents via /me", async () => {
    const listRes = await request(app)
      .get("/api/employees/me/documents")
      .set("Authorization", `Bearer ${emp1.token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);

    const dl = await request(app)
      .get(`/api/employees/me/documents/${docId}/download`)
      .set("Authorization", `Bearer ${emp1.token}`);
    expect(dl.status).toBe(200);
    expect(dl.text || dl.body.toString()).toContain("PDF");
  });

  test("un employé ne peut pas atteindre le document d'un collègue", async () => {
    // Ni par la route self (le doc n'est pas à lui)…
    const viaSelf = await request(app)
      .get(`/api/employees/me/documents/${docId}/download`)
      .set("Authorization", `Bearer ${emp2.token}`);
    expect(viaSelf.status).toBe(404);
    // …ni par la route admin (verrou de rôle).
    const viaAdmin = await request(app)
      .get(`/api/employees/${emp1.employeeId}/documents/${docId}/download`)
      .set("Authorization", `Bearer ${emp2.token}`);
    expect(viaAdmin.status).toBe(403);
  });

  test("les documents ne sont pas servis par le dossier statique public", async () => {
    const doc = await prisma.employeeDocument.findUnique({ where: { id: docId } });
    const res = await request(app).get(`/uploads/employee-docs/${doc.filename}`);
    expect(res.status).toBe(404);
  });

  test("le téléchargement est audité", async () => {
    // L'audit est best-effort (non await-é dans la réponse) : relecture avec marge.
    let rows = [];
    for (let i = 0; i < 10 && rows.length === 0; i += 1) {
      rows = await prisma.auditLog.findMany({
        where: { agencyId: admin.agency.id, action: "EMPLOYEE_DOC_DOWNLOADED", targetId: docId },
      });
      if (rows.length === 0) await new Promise((r) => setTimeout(r, 100));
    }
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  test("suppression par l'admin", async () => {
    const res = await request(app)
      .delete(`/api/employees/${emp1.employeeId}/documents/${docId}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    const list = await request(app)
      .get(`/api/employees/${emp1.employeeId}/documents`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(list.body.data).toHaveLength(0);
  });
});

describe("Hiérarchie manager", () => {
  let admin, manager, report, outsider;

  beforeAll(async () => {
    admin = await createBusinessAgency();
    manager = await createEmployeeWithAccount(admin.token, "Manager");
    report = await createEmployeeWithAccount(admin.token, "Subordonné");
    outsider = await createEmployeeWithAccount(admin.token, "Sans équipe");
    const res = await request(app)
      .put(`/api/employees/${report.employeeId}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ managerId: manager.employeeId });
    expect(res.status).toBe(200);
    expect(res.body.data.manager.name).toBe("Manager");
  });

  test("auto-management et cycles refusés (400)", async () => {
    const self = await request(app)
      .put(`/api/employees/${manager.employeeId}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ managerId: manager.employeeId });
    expect(self.status).toBe(400);

    const cycle = await request(app)
      .put(`/api/employees/${manager.employeeId}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ managerId: report.employeeId });
    expect(cycle.status).toBe(400);
  });

  test("un manager d'une autre agence est refusé (404)", async () => {
    const otherAdmin = await createBusinessAgency("Agence D");
    const foreign = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${otherAdmin.token}`)
      .send({ name: "Étranger", email: uniqueEmail("f") });
    const res = await request(app)
      .put(`/api/employees/${report.employeeId}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ managerId: foreign.body.data.id });
    expect(res.status).toBe(404);
  });

  test("le manager voit et approuve les congés de SES subordonnés (décompte inclus)", async () => {
    const leave = await request(app)
      .post("/api/leaves")
      .set("Authorization", `Bearer ${report.token}`)
      .send({ type: "ANNUAL", startDate: "2026-09-06", endDate: "2026-09-10" }); // dim→jeu = 5 j
    expect(leave.status).toBe(201);

    // Le manager voit la demande…
    const list = await request(app)
      .get("/api/leaves?status=PENDING")
      .set("Authorization", `Bearer ${manager.token}`);
    expect(list.status).toBe(200);
    expect(list.body.data.map((r) => r.id)).toContain(leave.body.data.id);

    // …un employé sans équipe, non (403).
    const denied = await request(app)
      .get("/api/leaves")
      .set("Authorization", `Bearer ${outsider.token}`);
    expect(denied.status).toBe(403);

    // Le manager approuve : le solde du subordonné est décompté.
    const approve = await request(app)
      .patch(`/api/leaves/${leave.body.data.id}/approve`)
      .set("Authorization", `Bearer ${manager.token}`);
    expect(approve.status).toBe(200);

    const my = await request(app).get("/api/leaves/my").set("Authorization", `Bearer ${report.token}`);
    expect(my.body.data.balance.usedDays).toBe(5);
  });

  test("un manager ne décide pas pour un employé hors de son équipe", async () => {
    const leave = await request(app)
      .post("/api/leaves")
      .set("Authorization", `Bearer ${outsider.token}`)
      .send({ type: "ANNUAL", startDate: "2026-09-06", endDate: "2026-09-10" });
    const res = await request(app)
      .patch(`/api/leaves/${leave.body.data.id}/approve`)
      .set("Authorization", `Bearer ${manager.token}`);
    expect(res.status).toBe(403);
  });
});
