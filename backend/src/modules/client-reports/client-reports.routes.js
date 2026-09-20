const { Router } = require("express");
const clientReportsController = require("./client-reports.controller");
const auth = require("../../middleware/auth");
const authorize = require("../../middleware/authorize");

const router = Router();

router.use(auth);
router.use(authorize("ADMIN", "ACCOUNTANT", "ADS"));

router.get("/:clientId", clientReportsController.getReport);

module.exports = router;
