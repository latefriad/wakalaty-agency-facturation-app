const { app, request, createAgency, createClient, uniqueEmail } = require("./helpers");
const prisma = require("../src/config/database");

afterAll(() => prisma.$disconnect());

async function createEmployee(token, data = {}) {
  const res = await request(app)
    .post("/api/employees")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Employé Test", ...data });
  expect(res.status).toBe(201);
  return res.body.data;
}

async function createEmployeeUser(adminToken, email) {
  const res = await request(app)
    .post("/api/users")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ email, password: "password123", name: "Employé Connecté", role: "EMPLOYEE" });
  expect(res.status).toBe(201);
  const login = await request(app).post("/api/auth/login").send({ email, password: "password123" });
  return login.body.data.token;
}

async function createTask(token, data = {}) {
  const res = await request(app)
    .post("/api/tasks")
    .set("Authorization", `Bearer ${token}`)
    .send({ title: "Tâche test", ...data });
  return res;
}

function iso(daysFromToday) {
  return new Date(Date.now() + daysFromToday * 86400000).toISOString();
}

// FREE plafonne à 1 employé / 5 tâches : les scénarios multi-employés
// passent l'agence en PRO (directement en base, l'upgrade API est manuel).
async function upgradeToPro(agencyId) {
  await prisma.agency.update({ where: { id: agencyId }, data: { plan: "PRO" } });
}

describe("Tâches — assignation et isolation tenant", () => {
  test("assignation à un employé et un client de l'agence", async () => {
    const { token } = await createAgency();
    const employee = await createEmployee(token);
    const client = await createClient(token);

    const res = await createTask(token, {
      employeeId: employee.id,
      clientId: client.id,
      priority: "HIGH",
      startDate: iso(0),
      dueDate: iso(3),
    });
    expect(res.status).toBe(201);
    expect(res.body.data.employee.id).toBe(employee.id);
    expect(res.body.data.client.id).toBe(client.id);
    expect(res.body.data.isOverdue).toBe(false);
  });

  test("employé ou client d'une AUTRE agence → 404 (pas de référence croisée)", async () => {
    const { token: tokenA } = await createAgency();
    const { token: tokenB } = await createAgency("Agence B");
    const employeeB = await createEmployee(tokenB);
    const clientB = await createClient(tokenB);

    const withEmployee = await createTask(tokenA, { employeeId: employeeB.id });
    expect(withEmployee.status).toBe(404);

    const withClient = await createTask(tokenA, { clientId: clientB.id });
    expect(withClient.status).toBe(404);
  });

  test("dates invalides ou incohérentes → 400", async () => {
    const { token } = await createAgency();

    const badFormat = await createTask(token, { dueDate: "pas-une-date" });
    expect(badFormat.status).toBe(400);

    const inverted = await createTask(token, { startDate: iso(5), dueDate: iso(1) });
    expect(inverted.status).toBe(400);
  });

  test("créer une tâche liée à un client journalise un événement TASK_CREATED", async () => {
    const { token, agency } = await createAgency();
    const client = await createClient(token);
    await createTask(token, { title: "Suivi client", clientId: client.id });

    const events = await prisma.clientEvent.findMany({
      where: { clientId: client.id, agencyId: agency.id, type: "TASK_CREATED" },
    });
    expect(events.length).toBe(1);
    expect(events[0].message).toBe("Suivi client");
  });
});

describe("Tâches — lien User↔Employee et visibilité", () => {
  test("auto-lien par e-mail (compte créé APRÈS la fiche employé)", async () => {
    const { token: admin } = await createAgency();
    const email = uniqueEmail("emp");
    const employee = await createEmployee(admin, { email });
    expect(employee.userId).toBeNull();

    await createEmployeeUser(admin, email);
    const linked = await prisma.employee.findUnique({ where: { id: employee.id } });
    expect(linked.userId).not.toBeNull();
  });

  test("auto-lien par e-mail (fiche employé créée APRÈS le compte)", async () => {
    const { token: admin } = await createAgency();
    const email = uniqueEmail("emp");
    await createEmployeeUser(admin, email);

    const employee = await createEmployee(admin, { email });
    expect(employee.userId).not.toBeNull();
  });

  test("un employé ne voit que SES tâches ; /tasks/my les sectionne", async () => {
    const { token: admin, agency } = await createAgency();
    await upgradeToPro(agency.id);
    const email = uniqueEmail("emp");
    const empToken = await createEmployeeUser(admin, email);
    const employee = await createEmployee(admin, { email });
    const other = await createEmployee(admin, { name: "Autre" });

    await createTask(admin, { title: "La mienne (retard)", employeeId: employee.id, dueDate: iso(-2) });
    await createTask(admin, { title: "La mienne (à venir)", employeeId: employee.id, dueDate: iso(5) });
    await createTask(admin, { title: "Pas à moi", employeeId: other.id });

    const list = await request(app).get("/api/tasks").set("Authorization", `Bearer ${empToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(2);
    expect(list.body.data.every((t) => t.employeeId === employee.id)).toBe(true);

    const my = await request(app).get("/api/tasks/my").set("Authorization", `Bearer ${empToken}`);
    expect(my.status).toBe(200);
    expect(my.body.data.linked).toBe(true);
    expect(my.body.data.overdue).toHaveLength(1);
    expect(my.body.data.overdue[0].isOverdue).toBe(true);
    expect(my.body.data.upcoming).toHaveLength(1);

    // L'admin, lui, voit tout.
    const all = await request(app).get("/api/tasks").set("Authorization", `Bearer ${admin}`);
    expect(all.body.data).toHaveLength(3);
  });

  test("compte non relié à une fiche employé → aucune tâche (côté restrictif)", async () => {
    const { token: admin } = await createAgency();
    const empToken = await createEmployeeUser(admin, uniqueEmail("orphan"));
    await createTask(admin, { title: "Tâche de l'agence" });

    const list = await request(app).get("/api/tasks").set("Authorization", `Bearer ${empToken}`);
    expect(list.body.data).toHaveLength(0);

    const my = await request(app).get("/api/tasks/my").set("Authorization", `Bearer ${empToken}`);
    expect(my.body.data.linked).toBe(false);
  });
});

describe("Tâches — changement de statut via Kanban (RBAC PATCH)", () => {
  test("un employé déplace SES cartes (status/order) mais rien d'autre", async () => {
    const { token: admin, agency } = await createAgency();
    await upgradeToPro(agency.id);
    const email = uniqueEmail("emp");
    const empToken = await createEmployeeUser(admin, email);
    const employee = await createEmployee(admin, { email });
    const other = await createEmployee(admin, { name: "Autre" });

    const mine = (await createTask(admin, { employeeId: employee.id })).body.data;
    const notMine = (await createTask(admin, { employeeId: other.id })).body.data;

    // Déplacement Kanban de sa propre carte : OK.
    const move = await request(app)
      .patch(`/api/tasks/${mine.id}`)
      .set("Authorization", `Bearer ${empToken}`)
      .send({ status: "INPROGRESS", order: 3 });
    expect(move.status).toBe(200);
    expect(move.body.data.status).toBe("INPROGRESS");

    // Modifier le contenu (titre, échéance…) : interdit.
    const editContent = await request(app)
      .patch(`/api/tasks/${mine.id}`)
      .set("Authorization", `Bearer ${empToken}`)
      .send({ title: "détourné" });
    expect(editContent.status).toBe(403);

    // La carte d'un collègue : interdit.
    const moveOther = await request(app)
      .patch(`/api/tasks/${notMine.id}`)
      .set("Authorization", `Bearer ${empToken}`)
      .send({ status: "DONE" });
    expect(moveOther.status).toBe(403);

    // L'admin modifie tout, y compris la réassignation.
    const adminEdit = await request(app)
      .patch(`/api/tasks/${notMine.id}`)
      .set("Authorization", `Bearer ${admin}`)
      .send({ title: "Nouveau titre", employeeId: employee.id, status: "DONE" });
    expect(adminEdit.status).toBe(200);
    expect(adminEdit.body.data.employee.id).toBe(employee.id);
  });

  test("création et suppression restent réservées à l'admin", async () => {
    const { token: admin } = await createAgency();
    const empToken = await createEmployeeUser(admin, uniqueEmail("emp"));
    const task = (await createTask(admin, {})).body.data;

    const create = await createTask(empToken, { title: "interdit" });
    expect(create.status).toBe(403);

    const del = await request(app)
      .delete(`/api/tasks/${task.id}`)
      .set("Authorization", `Bearer ${empToken}`);
    expect(del.status).toBe(403);
  });
});

describe("Tâches — filtre en retard", () => {
  test("?overdue=1 : échéance passée et non terminée uniquement", async () => {
    const { token } = await createAgency();

    await createTask(token, { title: "En retard", dueDate: iso(-3) });
    await createTask(token, { title: "À venir", dueDate: iso(3) });
    const done = (await createTask(token, { title: "Finie en retard", dueDate: iso(-3) })).body.data;
    await request(app)
      .patch(`/api/tasks/${done.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "DONE" });

    const res = await request(app)
      .get("/api/tasks?overdue=1")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe("En retard");
    expect(res.body.data[0].isOverdue).toBe(true);
  });
});

describe("Tâches — vue par client", () => {
  test("?clientId= renvoie les tâches du client, isolées par agence", async () => {
    const { token } = await createAgency();
    const clientA = await createClient(token, { name: "Client A" });
    const clientB = await createClient(token, { name: "Client B" });

    await createTask(token, { title: "Pour A n°1", clientId: clientA.id });
    await createTask(token, { title: "Pour A n°2", clientId: clientA.id });
    await createTask(token, { title: "Pour B", clientId: clientB.id });

    const res = await request(app)
      .get(`/api/tasks?clientId=${clientA.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.every((t) => t.client.id === clientA.id)).toBe(true);
  });
});

describe("Employés — liste assignable", () => {
  test("accessible aux employés, sans données RH ; /employees reste admin-only", async () => {
    const { token: admin } = await createAgency();
    await createEmployee(admin, { salary: 90000 });
    const empToken = await createEmployeeUser(admin, uniqueEmail("emp"));

    const assignable = await request(app)
      .get("/api/employees/assignable")
      .set("Authorization", `Bearer ${empToken}`);
    expect(assignable.status).toBe(200);
    expect(assignable.body.data).toHaveLength(1);
    expect(assignable.body.data[0].salary).toBeUndefined();

    const full = await request(app)
      .get("/api/employees")
      .set("Authorization", `Bearer ${empToken}`);
    expect(full.status).toBe(403);
  });
});
