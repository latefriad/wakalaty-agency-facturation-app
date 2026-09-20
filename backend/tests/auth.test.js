const { app, request, createAgency } = require("./helpers");
const prisma = require("../src/config/database");

afterAll(() => prisma.$disconnect());

describe("Auth", () => {
  test("register crée agence + admin et renvoie un token utilisable", async () => {
    const { token } = await createAgency();
    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.data.user.role).toBe("ADMIN");
    expect(me.body.data.agency.plan).toBe("FREE");
    expect(me.body.data.agency.isActive).toBe(true);
  });

  test("mauvais mot de passe → 401 (pas 500)", async () => {
    const { email } = await createAgency();
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "mauvais-mdp" });
    expect(res.status).toBe(401);
  });

  test("sans token → 401", async () => {
    const res = await request(app).get("/api/clients");
    expect(res.status).toBe(401);
  });

  test("ressource inexistante → 404 (pas 500)", async () => {
    const { token } = await createAgency();
    const res = await request(app)
      .get("/api/clients/11111111-1111-1111-1111-111111111111")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe("Onboarding", () => {
  test("nouvelle agence → onboarded false, complétion → true avec réponses", async () => {
    const { token } = await createAgency();

    const before = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(before.body.data.agency.onboarded).toBe(false);

    const upd = await request(app)
      .put("/api/agencies/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ onboarded: true, agencyType: "ob.type1", teamSize: "2-5", goals: ["ob.goal1"] });
    expect(upd.status).toBe(200);
    expect(upd.body.data.onboarded).toBe(true);
    expect(upd.body.data.agencyType).toBe("ob.type1");

    const after = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(after.body.data.agency.onboarded).toBe(true);
  });
});
