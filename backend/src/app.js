const express = require("express");
const path = require("path");
const helmet = require("helmet");
const cors = require("cors");

const { apiLimiter } = require("./middleware/rateLimiter");
const errorHandler = require("./middleware/errorHandler");

const authRoutes = require("./modules/auth/auth.routes");
const clientsRoutes = require("./modules/clients/clients.routes");
const invoicesRoutes = require("./modules/invoices/invoices.routes");
const employeesRoutes = require("./modules/employees/employees.routes");
const leavesRoutes = require("./modules/leaves/leaves.routes");
const attendanceRoutes = require("./modules/attendance/attendance.routes");
const expensesRoutes = require("./modules/expenses/expenses.routes");
const budgetsRoutes = require("./modules/budgets/budgets.routes");
const suppliersRoutes = require("./modules/suppliers/suppliers.routes");
const tasksRoutes = require("./modules/tasks/tasks.routes");
const servicesRoutes = require("./modules/services/services.routes");
const contractsRoutes = require("./modules/contracts/contracts.routes");
const agenciesRoutes = require("./modules/agencies/agencies.routes");
const dashboardRoutes = require("./modules/dashboard/dashboard.routes");
const usersRoutes = require("./modules/users/users.routes");
const publicRoutes = require("./modules/public/public.routes");
const recurringRoutes = require("./modules/recurring/recurring.routes");
const aiRoutes = require("./modules/ai/ai.routes");
const portfolioRoutes = require("./modules/portfolio/portfolio.routes");
const searchRoutes = require("./modules/search/search.routes");
const leadsRoutes = require("./modules/leads/leads.routes");

const app = express();

// Derrière un reverse proxy (Plesk/nginx) : sans trust proxy, express-rate-limit
// ne voit que l'IP du proxy et tous les utilisateurs partagent la même limite.
app.set("trust proxy", 1);

// Origines CORS autorisées : FRONTEND_URL peut être une liste séparée par des
// virgules (ex. "https://wakalati.app,https://www.wakalati.app"). En même
// origine (build servi par le même domaine que l'API), le navigateur n'envoie
// pas de header Origin → on laisse aussi passer les requêtes sans origine.
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// Security
app.use(helmet());
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error("Origine non autorisée par CORS"));
    },
    credentials: true,
  })
);
app.use("/api", apiLimiter);

// Body parsing
app.use(express.json({ limit: "10mb" }));

// Logos uploadés (multer écrit dans src/uploads). Attention : disque
// éphémère sur Render free — les fichiers disparaissent au redéploiement.
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/clients", clientsRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/invoices", invoicesRoutes);
app.use("/api/employees", employeesRoutes);
app.use("/api/leaves", leavesRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/expenses", expensesRoutes);
app.use("/api/budgets", budgetsRoutes);
app.use("/api/suppliers", suppliersRoutes);
app.use("/api/tasks", tasksRoutes);
app.use("/api/services", servicesRoutes);
app.use("/api/contracts", contractsRoutes);
app.use("/api/agencies", agenciesRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/recurring-invoices", recurringRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/portfolio", portfolioRoutes);
app.use("/api/leads", leadsRoutes);

// 404
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route introuvable" });
});

// Error handler
app.use(errorHandler);

module.exports = app;
