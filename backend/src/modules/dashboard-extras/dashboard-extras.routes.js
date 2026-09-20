const { Router } = require("express");
const dashboardExtrasController = require("./dashboard-extras.controller");
const auth = require("../../middleware/auth");
const authorize = require("../../middleware/authorize");

const router = Router();

router.use(auth);

// GET dashboard extras available to ADMIN and ACCOUNTANT
router.get("/", authorize("ADMIN", "ACCOUNTANT"), dashboardExtrasController.getExtras);

// Setting monthly goal target is restricted to ADMIN only
router.post("/goal", authorize("ADMIN"), dashboardExtrasController.setGoal);

module.exports = router;
