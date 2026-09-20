const { Router } = require("express");
const leadsController = require("./leads.controller");
const auth = require("../../middleware/auth");
const authorize = require("../../middleware/authorize");
const validate = require("../../middleware/validate");
const {
  createLeadSchema,
  updateLeadSchema,
  changeStageSchema,
  addLeadNoteSchema,
} = require("./leads.schema");

const router = Router();

// Authentication required for all routes
router.use(auth);

// Permis uniquement pour ADMIN, ACCOUNTANT, ADS
router.use(authorize("ADMIN", "ACCOUNTANT", "ADS"));

router.get("/", leadsController.list);
router.get("/assignees", leadsController.listAssignees);
router.get("/:id", leadsController.getById);
router.post("/", validate(createLeadSchema), leadsController.create);
router.patch("/:id", validate(updateLeadSchema), leadsController.update);
router.patch("/:id/stage", validate(changeStageSchema), leadsController.changeStage);
router.delete("/:id", leadsController.remove);
router.post("/:id/notes", validate(addLeadNoteSchema), leadsController.addNote);
router.post("/:id/convert", leadsController.convertToClient);

module.exports = router;
