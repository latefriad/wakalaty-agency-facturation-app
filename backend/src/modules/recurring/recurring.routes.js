const { Router } = require("express");
const recurringController = require("./recurring.controller");
const auth = require("../../middleware/auth");
const authorize = require("../../middleware/authorize");
const validate = require("../../middleware/validate");
const { createRecurringSchema, updateRecurringSchema } = require("./recurring.schema");

const router = Router();
router.use(auth);
router.use(authorize("ADMIN", "ACCOUNTANT"));

router.get("/", recurringController.list);
router.post("/", validate(createRecurringSchema), recurringController.create);
router.patch("/:id", validate(updateRecurringSchema), recurringController.update);
router.delete("/:id", recurringController.remove);

module.exports = router;
