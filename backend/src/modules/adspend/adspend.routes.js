const { Router } = require("express");
const adspendController = require("./adspend.controller");
const auth = require("../../middleware/auth");
const authorize = require("../../middleware/authorize");
const validate = require("../../middleware/validate");
const {
  createAdSpendSchema,
  updateAdSpendSchema,
} = require("./adspend.schema");

const router = Router();

// Authentication required
router.use(auth);

// Permis pour ADMIN, ACCOUNTANT, ADS
router.use(authorize("ADMIN", "ACCOUNTANT", "ADS"));

router.get("/", adspendController.list);
router.get("/summary", adspendController.summary);
router.get("/export", adspendController.exportExcel);
router.post("/", validate(createAdSpendSchema), adspendController.create);
router.patch("/:id", validate(updateAdSpendSchema), adspendController.update);
router.delete("/:id", adspendController.remove);

module.exports = router;
