require("./config/env");
const prisma = require("./config/database");
const app = require("./app");
const logger = require("./utils/logger");
const { startScheduler } = require("./jobs/scheduler");

const PORT = process.env.PORT || 4000;

async function main() {
  try {
    await prisma.$connect();
    logger.info("Database connected");

    const server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });

    startScheduler();

    const shutdown = async (signal) => {
      logger.info(`${signal} received, shutting down...`);
      server.close(async () => {
        await prisma.$disconnect();
        logger.info("Database disconnected");
        process.exit(0);
      });
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (err) {
    logger.error("Failed to start:", err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
