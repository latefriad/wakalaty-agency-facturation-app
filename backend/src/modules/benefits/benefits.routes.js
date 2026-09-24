const router = require("express").Router();
const auth = require("../../middleware/auth");
const authorize = require("../../middleware/authorize");
const { getBenefitsHandler, applyToBalanceHandler, addTransactionHandler, updateTransactionHandler, deleteTransactionHandler } = require("./benefits.controller");

router.get("/", auth, authorize("ADMIN"), getBenefitsHandler);
router.post("/transactions", auth, authorize("ADMIN"), addTransactionHandler);
router.put("/transactions/:id", auth, authorize("ADMIN"), updateTransactionHandler);
router.delete("/transactions/:id", auth, authorize("ADMIN"), deleteTransactionHandler);

// Keep the old route so frontend doesn't crash on old versions
router.post("/apply-to-balance", auth, authorize("ADMIN"), applyToBalanceHandler);

module.exports = router;
