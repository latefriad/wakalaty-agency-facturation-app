const request = require("supertest");
const app = require("../src/app");

// Chaque test crée sa propre agence (email aléatoire) : l'isolation
// multi-tenant garantit qu'ils ne se marchent pas dessus, même sur une
// base partagée.
let counter = 0;
function uniqueEmail(prefix = "test") {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}@test.wakalati`;
}

async function createAgency(name = "Agence Test") {
  const email = uniqueEmail("admin");
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email, password: "password123", name: "Admin Test", agencyName: name });
  if (res.status !== 201) throw new Error(`register failed: ${JSON.stringify(res.body)}`);
  return { token: res.body.data.token, agency: res.body.data.agency, email };
}

async function createClient(token, data = {}) {
  const res = await request(app)
    .post("/api/clients")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Client Test", ...data });
  return res.body.data;
}

// Crée un SUPER_ADMIN directement en base (non assignable via l'API) et
// renvoie un token. Utile pour tester les routes réservées au super-admin.
async function createSuperAdmin() {
  const prisma = require("../src/config/database");
  const { hashPassword } = require("../src/utils/bcrypt");
  const email = uniqueEmail("super");
  const agency = await prisma.agency.create({ data: { name: "SA Agency" } });
  await prisma.user.create({
    data: { email, password: await hashPassword("password123"), name: "Super", role: , agencyId: agency.id },
  });
  const res = await request(app).post("/api/auth/login").send({ email, password: "password123" });
  return { token: res.body.data.token, email };
}

module.exports = { app, request, uniqueEmail, createAgency, createClient, createSuperAdmin };
