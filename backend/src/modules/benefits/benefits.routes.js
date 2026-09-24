const router = require("express").Router();
const auth = require("../../middleware/auth");
const authorize = require("../../middleware/authorize");
const { getBenefitsHandler, applyToBalanceHandler } = require("./benefits.controller");

router.get("/", auth, authorize("ADMIN"), getBenefitsHandler);
router.post("/apply-to-balance", auth, authorize("ADMIN"), applyToBalanceHandler);


module.exports = router;
