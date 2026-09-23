const router = require("express").Router();
const { authenticate, requireRole } = require("../../middleware/auth");
const { getBenefitsHandler } = require("./benefits.controller");

router.get("/", authenticate, requireRole(["ADMIN"]), getBenefitsHandler);

module.exports = router;
