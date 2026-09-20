const { Router } = require("express");
const testiliController = require("./testili.controller");
const auth = require("../../middleware/auth");
const authorize = require("../../middleware/authorize");

const router = Router();

router.use(auth);
// Testili tracker is restricted to ADMIN and ADS roles
router.use(authorize("ADMIN", "ADS"));

router.get("/", testiliController.list);
router.get("/:id", testiliController.getOne);
router.post("/", testiliController.create);
router.put("/:id", testiliController.update);
router.patch("/:id/verdict", testiliController.updateVerdict);
router.delete("/:id", testiliController.remove);

module.exports = router;
