const { Router } = require("express");
const dashboardController = require("./dashboard.controller");
const auth = require("../../middleware/auth");
const authorize = require("../../middleware/authorize");

const router = Router();
router.use(auth);
// Chiffres financiers de toute l'agence : mêmes rôles que la lecture des
// factures — sans ce verrou, n'importe quel employé récupérait CA, encours
// et top clients via l'API (le front ne fait que cacher la page).
router.use(authorize("ADMIN", "ACCOUNTANT"));

router.get("/", dashboardController.getDashboard);
router.get("/export.xlsx", dashboardController.exportXlsx);

module.exports = router;
