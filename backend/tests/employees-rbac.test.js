const { app, request, uniqueEmail, createAgency } = require("./helpers");
const prisma = require("../src/config/database");

// Cloisonnement des données RH : le salaire ne doit JAMAIS sortir de l'API
// pour un rôle non autorisé, et chaque accès doit être journalisé.

// Crée une fiche employé + un compte au même e-mail (auto-lien User↔Employee)
// et renvoie { employeeId, token } du compte employé.
async function createEmployeeWithAccount(adminToken, { role = "EMPLOYEE", salary = 50000 } = {}) {
  const email = uniqueEmail("emp");
  const empRes = await request(app)
    .post("/api/employees")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name: "Employé Test", email, salary, position: "Designer" });
  const employeeId = empRes.body.data.id;

  await request(app)
    .post("/api/users")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ email, password: "password123", name: "Employé Test", role });

  const login = await request(app).post("/api/auth/login").send({ email, password: "password123" });
  return { employeeId, token: login.body.data.token, email };
}

// Le plan FREE limite à 1 employé : on passe l'agence de test en BUSINESS
// (auth relit l'agence à chaque requête, donc effet immédiat).
async function createBusinessAgency(name) {
  const admin = await createAgency(name);
  await prisma.agency.update({ where: { id: admin.agency.id }, data: { plan: "BUSINESS" } });
  return admin;
}

describe("RBAC employés / salaires", () => {
  let admin, emp1, emp2;

  beforeAll(async () => {
    admin = await createBusinessAgency();
    emp1 = await createEmployeeWithAccount(admin.token);
    emp2 = await createEmployeeWithAccount(admin.token, { salary: 90000 });
  });

  test("un employé ne peut pas lister les employés (403)", async () => {
    const res = await request(app).get("/api/employees").set("Authorization", `Bearer ${emp1.token}`);
    expect(res.status).toBe(403);
  });

  test("un employé ne peut pas lire la fiche (et le salaire) d'un autre (403)", async () => {
    const res = await request(app)
      .get(`/api/employees/${emp2.employeeId}`)
      .set("Authorization", `Bearer ${emp1.token}`);
    expect(res.status).toBe(403);
  });

  test("un employé voit SA fiche via /employees/me, avec son salaire", async () => {
    const res = await request(app).get("/api/employees/me").set("Authorization", `Bearer ${emp1.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(emp1.employeeId);
    expect(res.body.data.salary).toBe(50000);
  });

  test("/employees/assignable ne contient aucune donnée RH", async () => {
    const res = await request(app).get("/api/employees/assignable").set("Authorization", `Bearer ${emp1.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const e of res.body.data) {
      expect(e).not.toHaveProperty("salary");
      expect(e).not.toHaveProperty("commissionBalance");
      expect(e).not.toHaveProperty("email");
    }
  });

  test("un comptable n'accède pas au module employés (403)", async () => {
    const acc = await createEmployeeWithAccount(admin.token, { role: "ACCOUNTANT" });
    const res = await request(app).get("/api/employees").set("Authorization", `Bearer ${acc.token}`);
    expect(res.status).toBe(403);
  });

  test("un employé ne peut pas lire les factures ni les services (403)", async () => {
    const inv = await request(app).get("/api/invoices").set("Authorization", `Bearer ${emp1.token}`);
    expect(inv.status).toBe(403);
    const svc = await request(app).get("/api/services").set("Authorization", `Bearer ${emp1.token}`);
    expect(svc.status).toBe(403);
    const search = await request(app).get("/api/search?q=test").set("Authorization", `Bearer ${emp1.token}`);
    expect(search.status).toBe(403);
  });

  test("l'admin d'une autre agence ne voit pas la fiche (404, isolation tenant)", async () => {
    const otherAdmin = await createAgency("Agence B");
    const res = await request(app)
      .get(`/api/employees/${emp1.employeeId}`)
      .set("Authorization", `Bearer ${otherAdmin.token}`);
    expect(res.status).toBe(404);
  });

  test("fiche complète : hireDate et contractType acceptés et renvoyés", async () => {
    const res = await request(app)
      .put(`/api/employees/${emp1.employeeId}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ hireDate: "2025-03-01", contractType: "CDI" });
    expect(res.status).toBe(200);
    expect(res.body.data.contractType).toBe("CDI");
    expect(res.body.data.hireDate).toContain("2025-03-01");
  });

  test("contractType invalide refusé (400)", async () => {
    const res = await request(app)
      .put(`/api/employees/${emp1.employeeId}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ contractType: "PIGISTE" });
    expect(res.status).toBe(400);
  });
});

describe("Journal d'audit des salaires", () => {
  let admin, emp;

  beforeAll(async () => {
    admin = await createBusinessAgency();
    emp = await createEmployeeWithAccount(admin.token, { salary: 60000 });
  });

  // L'audit est best-effort et asynchrone (non await-é dans la réponse) :
  // on relit avec une petite marge.
  async function findAudit(action, targetId) {
    for (let i = 0; i < 10; i += 1) {
      const row = await prisma.auditLog.findFirst({
        where: { action, targetId, agencyId: admin.agency.id },
        orderBy: { createdAt: "desc" },
      });
      if (row) return row;
      await new Promise((r) => setTimeout(r, 100));
    }
    return null;
  }

  test("la consultation d'une fiche (salaire) est journalisée", async () => {
    await request(app).get(`/api/employees/${emp.employeeId}`).set("Authorization", `Bearer ${admin.token}`);
    const row = await findAudit("EMPLOYEE_VIEWED", emp.employeeId);
    expect(row).not.toBeNull();
    expect(row.actorEmail).toBe(admin.email);
  });

  test("la modification d'un salaire est journalisée avec avant/après", async () => {
    await request(app)
      .put(`/api/employees/${emp.employeeId}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ salary: 75000 });
    const row = await findAudit("EMPLOYEE_SALARY_UPDATED", emp.employeeId);
    expect(row).not.toBeNull();
    expect(row.details).toMatchObject({ from: 60000, to: 75000 });
  });

  test("la consultation de sa propre fiche est journalisée (self)", async () => {
    await request(app).get("/api/employees/me").set("Authorization", `Bearer ${emp.token}`);
    const row = await findAudit("EMPLOYEE_VIEWED", emp.employeeId);
    expect(row).not.toBeNull();
  });
});
