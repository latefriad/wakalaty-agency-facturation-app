const router = require("express").Router();
const { authenticate, requireRole } = require("../../middleware/auth");
const { getBenefitsHandler, applyToBalanceHandler } = require("./benefits.controller");

router.get("/", authenticate, requireRole(["ADMIN"]), getBenefitsHandler);
router.post("/apply-to-balance", authenticate, requireRole(["ADMIN"]), applyToBalanceHandler);

module.exports = router;
