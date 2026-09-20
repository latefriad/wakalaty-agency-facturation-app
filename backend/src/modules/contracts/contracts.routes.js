const { Router } = require("express");
const contractsController = require("./contracts.controller");
const auth = require("../../middleware/auth");
const authorize = require("../../middleware/authorize");
const validate = require("../../middleware/validate");
const { createContractSchema, updateContractSchema } = require("./contracts.schema");

const router = Router();
router.use(auth);

router.get("/", contractsController.list);
router.get("/:id", contractsController.getById);
router.post("/", authorize("ADMIN"), validate(createContractSchema), contractsController.create);
router.post("/generate", authorize("ADMIN"), contractsController.generate);
router.put("/:id", authorize("ADMIN"), validate(updateContractSchema), contractsController.update);
router.delete("/:id", authorize("ADMIN"), contractsController.remove);

module.exports = router;
