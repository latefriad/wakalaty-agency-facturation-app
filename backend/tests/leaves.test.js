const { app, request, uniqueEmail, createAgency } = require("./helpers");
const prisma = require("../src/config/database");
const { workingDaysBetween } = require("../src/modules/leaves/leaves.service");

// Congés : demande self-service → validation admin → décompte transactionnel
// du solde. RBAC vérifié côté serveur (un employé ne voit que SES demandes).

async function createBusinessAgency(name) {
  const admin = await createAgency(name);
  await prisma.agency.update({ where: { id: admin.agency.id }, data: { plan: "BUSINESS" } });
  return admin;
}

async function createEmployeeWithAccount(adminToken, name = "Employé Congés") {
  const email = uniqueEmail("leave");
  const empRes = await request(app)
    .post("/api/employees")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name, email });
  await request(app)
    .post("/api/users")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ email, password: "password123", name, role: "EMPLOYEE" });
  const login = await request(app).post("/api/auth/login").send({ email, password: "password123" });
  return { employeeId: empRes.body.data.id, token: login.body.data.token, email };
}

describe("Calcul des jours ouvrés (week-end ven/sam)", () => {
  test("une semaine calendaire = 5 jours ouvrés", () => {
    // Dimanche 2026-07-05 → samedi 2026-07-11 : ven+sam exclus.
    expect(workingDaysBetween(new Date("2026-07-05"), new Date("2026-07-11"))).toBe(5);
  });

  test("un vendredi seul = 0 jour", () => {
    expect(workingDaysBetween(new Date("2026-07-10"), new Date("2026-07-10"))).toBe(0);
  });
});

describe("Congés : workflow et cloisonnement", () => {
  let admin, emp1, emp2;

  beforeAll(async () => {
    admin = await createBusinessAgency();
    emp1 = await createEmployeeWithAccount(admin.token, "Emp Un");
    emp2 = await createEmployeeWithAccount(admin.token, "Emp Deux");
  });

  // Dimanche→jeudi de semaines différentes pour éviter les chevauchements.
  const week = (n) => {
    const base = new Date("2026-08-02"); // un dimanche
    const start = new Date(base);
    start.setDate(base.getDate() + n * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 4);
    return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
  };

  test("un employé demande un congé pour lui-même (5 jours ouvrés)", async () => {
    const res = await request(app)
      .post("/api/leaves")
      .set("Authorization", `Bearer ${emp1.token}`)
      .send({ type: "ANNUAL", ...week(0), reason: "Vacances" });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("PENDING");
    expect(res.body.data.days).toBe(5);
    expect(res.body.data.employeeId).toBe(emp1.employeeId);
  });

  test("chevauchement de période refusé (409)", async () => {
    const res = await request(app)
      .post("/api/leaves")
      .set("Authorization", `Bearer ${emp1.token}`)
      .send({ type: "ANNUAL", ...week(0) });
    expect(res.status).toBe(409);
  });

  test("/leaves/my ne montre que SES demandes, avec le solde", async () => {
    const res = await request(app).get("/api/leaves/my").set("Authorization", `Bearer ${emp2.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.requests).toHaveLength(0);
    expect(res.body.data.balance.allocatedDays).toBe(30);

    const res1 = await request(app).get("/api/leaves/my").set("Authorization", `Bearer ${emp1.token}`);
    expect(res1.body.data.requests).toHaveLength(1);
  });

  test("un employé ne peut pas lister les demandes de l'agence (403)", async () => {
    const res = await request(app).get("/api/leaves").set("Authorization", `Bearer ${emp1.token}`);
    expect(res.status).toBe(403);
  });

  test("un employé ne peut pas approuver (403), ni annuler la demande d'un autre (404)", async () => {
    const mine = await request(app).get("/api/leaves/my").set("Authorization", `Bearer ${emp1.token}`);
    const leaveId = mine.body.data.requests[0].id;

    const approve = await request(app)
      .patch(`/api/leaves/${leaveId}/approve`)
      .set("Authorization", `Bearer ${emp1.token}`);
    expect(approve.status).toBe(403);

    const cancel = await request(app)
      .patch(`/api/leaves/${leaveId}/cancel`)
      .set("Authorization", `Bearer ${emp2.token}`);
    expect(cancel.status).toBe(404);
  });

  test("l'approbation décompte le solde, dans la même transaction", async () => {
    const mine = await request(app).get("/api/leaves/my").set("Authorization", `Bearer ${emp1.token}`);
    const leaveId = mine.body.data.requests[0].id;

    const res = await request(app)
      .patch(`/api/leaves/${leaveId}/approve`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ note: "Bon repos" });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("APPROVED");

    const after = await request(app).get("/api/leaves/my").set("Authorization", `Bearer ${emp1.token}`);
    expect(after.body.data.balance.usedDays).toBe(5);
    expect(after.body.data.balance.remainingDays).toBe(25);

    // Une deuxième approbation ne décompte pas deux fois.
    const again = await request(app)
      .patch(`/api/leaves/${leaveId}/approve`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(again.status).toBe(409);
    const still = await request(app).get("/api/leaves/my").set("Authorization", `Bearer ${emp1.token}`);
    expect(still.body.data.balance.usedDays).toBe(5);
  });

  test("approbation au-delà du solde refusée, statut inchangé (rollback)", async () => {
    // Solde réduit à 6 jours : 5 déjà pris, il en reste 1 — une nouvelle
    // semaine ne passe pas.
    await request(app)
      .put(`/api/leaves/balances/${emp1.employeeId}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ year: 2026, allocatedDays: 6 });

    const create = await request(app)
      .post("/api/leaves")
      .set("Authorization", `Bearer ${emp1.token}`)
      .send({ type: "SICK", ...week(1) }); // SICK ne contrôle pas le solde à la création
    expect(create.status).toBe(201);
    // On force le type en ANNUAL pour tester le garde-fou transactionnel de
    // l'approbation elle-même.
    await prisma.leaveRequest.update({ where: { id: create.body.data.id }, data: { type: "ANNUAL" } });

    const approve = await request(app)
      .patch(`/api/leaves/${create.body.data.id}/approve`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(approve.status).toBe(409);

    const check = await prisma.leaveRequest.findUnique({ where: { id: create.body.data.id } });
    expect(check.status).toBe("PENDING"); // rollback : pas approuvé à moitié

    const balance = await request(app).get("/api/leaves/my").set("Authorization", `Bearer ${emp1.token}`);
    expect(balance.body.data.balance.usedDays).toBe(5);
  });

  test("un congé maladie approuvé ne décompte pas le solde annuel", async () => {
    const create = await request(app)
      .post("/api/leaves")
      .set("Authorization", `Bearer ${emp2.token}`)
      .send({ type: "SICK", ...week(2) });
    expect(create.status).toBe(201);

    const approve = await request(app)
      .patch(`/api/leaves/${create.body.data.id}/approve`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(approve.status).toBe(200);

    const my = await request(app).get("/api/leaves/my").set("Authorization", `Bearer ${emp2.token}`);
    expect(my.body.data.balance.usedDays).toBe(0);
  });

  test("le rejet ne décompte rien et l'employé peut annuler une demande en attente", async () => {
    const c1 = await request(app)
      .post("/api/leaves")
      .set("Authorization", `Bearer ${emp2.token}`)
      .send({ type: "ANNUAL", ...week(3) });
    const rejected = await request(app)
      .patch(`/api/leaves/${c1.body.data.id}/reject`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ note: "Période chargée" });
    expect(rejected.status).toBe(200);
    expect(rejected.body.data.status).toBe("REJECTED");

    const c2 = await request(app)
      .post("/api/leaves")
      .set("Authorization", `Bearer ${emp2.token}`)
      .send({ type: "ANNUAL", ...week(4) });
    const cancelled = await request(app)
      .patch(`/api/leaves/${c2.body.data.id}/cancel`)
      .set("Authorization", `Bearer ${emp2.token}`);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe("CANCELLED");

    const my = await request(app).get("/api/leaves/my").set("Authorization", `Bearer ${emp2.token}`);
    expect(my.body.data.balance.usedDays).toBe(0);
  });

  test("isolation tenant : l'admin d'une autre agence ne voit rien et ne décide rien", async () => {
    const otherAdmin = await createBusinessAgency("Agence C");
    const list = await request(app).get("/api/leaves").set("Authorization", `Bearer ${otherAdmin.token}`);
    expect(list.body.data).toHaveLength(0);

    const mine = await request(app).get("/api/leaves/my").set("Authorization", `Bearer ${emp1.token}`);
    const leaveId = mine.body.data.requests.find((r) => r.status === "PENDING")?.id
      || mine.body.data.requests[0].id;
    const res = await request(app)
      .patch(`/api/leaves/${leaveId}/approve`)
      .set("Authorization", `Bearer ${otherAdmin.token}`);
    expect(res.status).toBe(404);
  });

  test("l'audit trace demande et approbation", async () => {
    // L'audit est best-effort (non await-é dans la réponse) : relecture avec marge.
    let rows = [];
    for (let i = 0; i < 10 && rows.length < 2; i += 1) {
      rows = await prisma.auditLog.findMany({
        where: { agencyId: admin.agency.id, action: { in: ["LEAVE_REQUESTED", "LEAVE_APPROVED"] } },
      });
      if (rows.length < 2) await new Promise((r) => setTimeout(r, 100));
    }
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });
});
