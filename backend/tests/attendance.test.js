const { app, request, uniqueEmail, createAgency } = require("./helpers");
const prisma = require("../src/config/database");

// Pointage : horodatage serveur (anti-triche), une entrée ouverte max,
// self-service cloisonné, vue et corrections réservées aux admins.

async function createBusinessAgency(name) {
  const admin = await createAgency(name);
  await prisma.agency.update({ where: { id: admin.agency.id }, data: { plan: "BUSINESS" } });
  return admin;
}

async function createEmployeeWithAccount(adminToken, name) {
  const email = uniqueEmail("att");
  const empRes = await request(app)
    .post("/api/employees")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name, email });
  await request(app)
    .post("/api/users")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ email, password: "password123", name, role: "EMPLOYEE" });
  const login = await request(app).post("/api/auth/login").send({ email, password: "password123" });
  return { employeeId: empRes.body.data.id, token: login.body.data.token };
}

describe("Pointage", () => {
  let admin, emp1, emp2;

  beforeAll(async () => {
    admin = await createBusinessAgency();
    emp1 = await createEmployeeWithAccount(admin.token, "Pointeur");
    emp2 = await createEmployeeWithAccount(admin.token, "Collègue");
  });

  test("l'horodatage vient du serveur : un clockIn fourni par le client est ignoré", async () => {
    const res = await request(app)
      .post("/api/attendance/clock-in")
      .set("Authorization", `Bearer ${emp1.token}`)
      .send({ note: "Bureau", clockIn: "2020-01-01T08:00:00Z" });
    expect(res.status).toBe(201);
    expect(res.body.data.employeeId).toBe(emp1.employeeId);
    // La date antidatée envoyée par le client n'a pas été prise en compte.
    expect(new Date(res.body.data.clockIn).getFullYear()).toBeGreaterThanOrEqual(2026);
    expect(res.body.data.clockOut).toBeNull();
  });

  test("pas de double pointage d'arrivée (409)", async () => {
    const res = await request(app)
      .post("/api/attendance/clock-in")
      .set("Authorization", `Bearer ${emp1.token}`)
      .send({});
    expect(res.status).toBe(409);
  });

  test("/attendance/my : entrée ouverte visible, uniquement les siennes", async () => {
    const mine = await request(app).get("/api/attendance/my").set("Authorization", `Bearer ${emp1.token}`);
    expect(mine.status).toBe(200);
    expect(mine.body.data.open).not.toBeNull();
    expect(mine.body.data.entries).toHaveLength(1);

    const other = await request(app).get("/api/attendance/my").set("Authorization", `Bearer ${emp2.token}`);
    expect(other.body.data.open).toBeNull();
    expect(other.body.data.entries).toHaveLength(0);
  });

  test("le départ ferme l'entrée et fige les minutes", async () => {
    const res = await request(app)
      .post("/api/attendance/clock-out")
      .set("Authorization", `Bearer ${emp1.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.clockOut).toBeTruthy();
    expect(res.body.data.minutes).toBeGreaterThanOrEqual(0);

    const again = await request(app)
      .post("/api/attendance/clock-out")
      .set("Authorization", `Bearer ${emp1.token}`);
    expect(again.status).toBe(409);
  });

  test("les totaux semaine/mois s'appuient sur les entrées fermées", async () => {
    // Une entrée de 120 min hier, insérée directement en base.
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
    await prisma.timeEntry.create({
      data: {
        clockIn: yesterday,
        clockOut: new Date(yesterday.getTime() + 120 * 60000),
        minutes: 120,
        employeeId: emp1.employeeId,
        agencyId: admin.agency.id,
      },
    });
    const mine = await request(app).get("/api/attendance/my").set("Authorization", `Bearer ${emp1.token}`);
    expect(mine.body.data.totals.monthMinutes).toBeGreaterThanOrEqual(120);
  });

  test("un employé ne voit pas le pointage de l'agence (403), l'admin si", async () => {
    const denied = await request(app).get("/api/attendance").set("Authorization", `Bearer ${emp1.token}`);
    expect(denied.status).toBe(403);

    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const list = await request(app)
      .get(`/api/attendance?from=${monthStart}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBeGreaterThanOrEqual(2);
    expect(list.body.data[0].employee.name).toBeTruthy();
  });

  test("isolation tenant : l'admin d'une autre agence ne voit rien", async () => {
    const otherAdmin = await createBusinessAgency("Agence E");
    const list = await request(app).get("/api/attendance").set("Authorization", `Bearer ${otherAdmin.token}`);
    expect(list.body.data).toHaveLength(0);
  });

  test("la correction admin (suppression) est auditée", async () => {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const list = await request(app)
      .get(`/api/attendance?from=${monthStart}`)
      .set("Authorization", `Bearer ${admin.token}`);
    const entryId = list.body.data[0].id;

    const del = await request(app)
      .delete(`/api/attendance/${entryId}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(del.status).toBe(200);

    const row = await prisma.auditLog.findFirst({
      where: { agencyId: admin.agency.id, action: "TIME_ENTRY_DELETED", targetId: entryId },
    });
    expect(row).not.toBeNull();
  });
});
