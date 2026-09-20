const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  const hashedPassword = await bcrypt.hash("admin123", 12);

  const agency = await prisma.agency.upsert({
    where: { email: "demo@wakalati.com" },
    update: {},
    create: {
      name: "Agence Demo",
      email: "demo@wakalati.com",
      plan: "FREE",
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@wakalati.com" },
    update: {},
    create: {
      email: "admin@wakalati.com",
      password: hashedPassword,
      name: "Admin Demo",
      role: "ADMIN",
      agencyId: agency.id,
    },
  });

  console.log("Seed complete:");
  console.log(`  Agency: ${agency.id} (${agency.name})`);
  console.log(`  Admin:  ${admin.email} / admin123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
