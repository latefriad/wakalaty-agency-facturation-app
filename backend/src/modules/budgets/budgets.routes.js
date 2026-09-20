const { Router } = require("express");
const { z } = require("zod");
const budgetsController = require("./budgets.controller");
const auth = require("../../middleware/auth");
const authorize = require("../../middleware/authorize");
const validate = require("../../middleware/validate");
const { CATEGORIES } = require("../expenses/expenses.schema");

// Plafonds par catégorie : uniquement les catégories fermées des expenses —
// un budget sur une catégorie inconnue ne serait jamais comparé à rien.
const upsertBudgetSchema = z.object({
  revenueTarget: z.number().min(0).max(1e12).default(0),
  expenseBudgets: z.record(z.enum(CATEGORIES), z.number().min(0).max(1e12)).optional().nullable(),
}).strip();

const router = Router();
router.use(auth);
// Données financières : mêmes rôles que dépenses et dashboard.
router.use(authorize("ADMIN", "ACCOUNTANT"));

router.get("/", budgetsController.listYear);
router.put("/:year/:month", validate(upsertBudgetSchema), budgetsController.upsert);
router.delete("/:year/:month", budgetsController.remove);

module.exports = router;
