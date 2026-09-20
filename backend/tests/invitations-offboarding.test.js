const { app, request, uniqueEmail, createAgency } = require("./helpers");
const prisma = require("../src/config/database");

// Invitation par e-mail (token à usage unique, expirant) et offboarding.
// Sans SMTP configuré (cas des tests), l'API renvoie le lien à l'admin :
// on en extrait le token pour dérouler le parcours complet.

async function createBusinessAgency(name) {
  const admin = await createAgency(name);
  await prisma.agency.update({ where: { id: admin.agency.id }, data: { plan: "BUSINESS" } });
  return admin;
}

function inviteTokenFromUrl(inviteUrl) {
  return inviteUrl.split("/invitation/")[1];
}

describe("Invitation d'un nouvel employé", () => {
  let admin;

  beforeAll(async () => {
    admin = await createBusinessAgency();
  });

  async function invite(email, overrides = {}) {
    const res = await request(app)
      .post("/api/users/invite")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ email, name: "Invité Test", role: "EMPLOYEE", ...overrides });
    return res;
  }

  test("un non-admin ne peut pas inviter (403)", async () => {
    const email = uniqueEmail("emp");
    await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ email, password: "password123", name: "Emp", role: "EMPLOYEE" });
    const login = await request(app).post("/api/auth/login").send({ email, password: "password123" });

    const res = await request(app)
      .post("/api/users/invite")
      .set("Authorization", `Bearer ${login.body.data.token}`)
      .send({ email: uniqueEmail("x"), name: "X" });
    expect(res.status).toBe(403);
  });

  test("parcours complet : invitation → consultation → acceptation → connexion + lien fiche employé", async () => {
    const email = uniqueEmail("invite");
    // Fiche employé pré-existante avec le même e-mail : doit être liée au
    // compte créé à l'acceptation.
    const empRes = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "Invité Test", email, salary: 45000 });
    const employeeId = empRes.body.data.id;

    const res = await invite(email);
    expect(res.status).toBe(201);
    expect(res.body.data.emailSent).toBe(false);
    expect(res.body.data.inviteUrl).toContain("/invitation/");
    const token = inviteTokenFromUrl(res.body.data.inviteUrl);

    // Le token en clair ne doit pas être stocké en base (seulement le hash).
    const stored = await prisma.invitation.findUnique({ where: { id: res.body.data.id } });
    expect(stored.tokenHash).not.toBe(token);

    const info = await request(app).get(`/api/auth/invitation/${token}`);
    expect(info.status).toBe(200);
    expect(info.body.data.email).toBe(email);
    expect(info.body.data.agencyName).toBeTruthy();

    const accept = await request(app)
      .post(`/api/auth/invitation/${token}/accept`)
      .send({ password: "motdepasse123" });
    expect(accept.status).toBe(201);
    expect(accept.body.data.token).toBeTruthy();
    expect(accept.body.data.user.role).toBe("EMPLOYEE");

    // Connexion effective + fiche employé liée au nouveau compte.
    const me = await request(app)
      .get("/api/employees/me")
      .set("Authorization", `Bearer ${accept.body.data.token}`);
    expect(me.status).toBe(200);
    expect(me.body.data.id).toBe(employeeId);
    expect(me.body.data.salary).toBe(45000);
  });

  test("le token est à usage unique (2e acceptation → 410)", async () => {
    const res = await invite(uniqueEmail("once"));
    const token = inviteTokenFromUrl(res.body.data.inviteUrl);

    const first = await request(app).post(`/api/auth/invitation/${token}/accept`).send({ password: "motdepasse123" });
    expect(first.status).toBe(201);

    const second = await request(app).post(`/api/auth/invitation/${token}/accept`).send({ password: "autrepasse123" });
    expect(second.status).toBe(410);
  });

  test("une invitation expirée est refusée (410)", async () => {
    const res = await invite(uniqueEmail("expired"));
    const token = inviteTokenFromUrl(res.body.data.inviteUrl);
    await prisma.invitation.update({
      where: { id: res.body.data.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const info = await request(app).get(`/api/auth/invitation/${token}`);
    expect(info.status).toBe(410);

    const accept = await request(app).post(`/api/auth/invitation/${token}/accept`).send({ password: "motdepasse123" });
    expect(accept.status).toBe(410);
  });

  test("un token inconnu → 404, une invitation révoquée → 404", async () => {
    const unknown = await request(app).get("/api/auth/invitation/deadbeef");
    expect(unknown.status).toBe(404);

    const res = await invite(uniqueEmail("revoked"));
    const token = inviteTokenFromUrl(res.body.data.inviteUrl);
    const del = await request(app)
      .delete(`/api/users/invitations/${res.body.data.id}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(del.status).toBe(200);

    const info = await request(app).get(`/api/auth/invitation/${token}`);
    expect(info.status).toBe(404);
  });

  test("e-mail déjà utilisé par un compte → 409", async () => {
    const res = await invite(admin.email);
    expect(res.status).toBe(409);
  });
});

describe("Offboarding / réactivation", () => {
  let admin, emp;

  beforeAll(async () => {
    admin = await createBusinessAgency();
    const email = uniqueEmail("off");
    const empRes = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "Partant", email, salary: 30000 });
    await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ email, password: "password123", name: "Partant", role: "EMPLOYEE" });
    const login = await request(app).post("/api/auth/login").send({ email, password: "password123" });
    emp = { employeeId: empRes.body.data.id, token: login.body.data.token, email };
  });

  test("offboarding : statut OFFBOARDED, accès révoqué immédiatement, historique conservé", async () => {
    // Avant : l'employé accède à sa fiche.
    const before = await request(app).get("/api/employees/me").set("Authorization", `Bearer ${emp.token}`);
    expect(before.status).toBe(200);

    const off = await request(app)
      .post(`/api/employees/${emp.employeeId}/offboard`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(off.status).toBe(200);
    expect(off.body.data.status).toBe("OFFBOARDED");
    expect(off.body.data.offboardedAt).toBeTruthy();

    // Après : son token (toujours valide côté JWT) est refusé par le serveur.
    const after = await request(app).get("/api/employees/me").set("Authorization", `Bearer ${emp.token}`);
    expect(after.status).toBe(401);

    // La fiche existe toujours (pas de suppression).
    const fiche = await request(app)
      .get(`/api/employees/${emp.employeeId}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(fiche.status).toBe(200);

    // Et il ne figure plus dans les assignables.
    const assignable = await request(app)
      .get("/api/employees/assignable")
      .set("Authorization", `Bearer ${admin.token}`);
    expect(assignable.body.data.find((e) => e.id === emp.employeeId)).toBeUndefined();
  });

  test("réactivation : accès restauré", async () => {
    const re = await request(app)
      .post(`/api/employees/${emp.employeeId}/reactivate`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(re.status).toBe(200);
    expect(re.body.data.status).toBe("ACTIVE");

    const me = await request(app).get("/api/employees/me").set("Authorization", `Bearer ${emp.token}`);
    expect(me.status).toBe(200);
  });

  test("la suppression physique est réservée au super-admin (admin → 403)", async () => {
    const res = await request(app)
      .delete(`/api/employees/${emp.employeeId}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(403);
  });

  test("un admin ne peut pas s'offboarder lui-même (400)", async () => {
    // Fiche employé au même e-mail que l'admin → auto-liée à son compte.
    const selfRes = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "Moi-même", email: admin.email });
    const res = await request(app)
      .post(`/api/employees/${selfRes.body.data.id}/offboard`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(400);
  });
});
