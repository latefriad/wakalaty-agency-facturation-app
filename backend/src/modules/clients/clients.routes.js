const { Router } = require("express");
const clientsController = require("./clients.controller");
const auth = require("../../middleware/auth");
const authorize = require("../../middleware/authorize");
const validate = require("../../middleware/validate");
const { createClientSchema, updateClientSchema, createNoteSchema } = require("./clients.schema");

const router = Router();
router.use(auth);

router.get("/", clientsController.list);
router.get("/meta/tags", clientsController.listTags);
router.get("/meta/check-duplicate", clientsController.checkDuplicate);
router.get("/:id/overview", clientsController.overview);
router.get("/:id/notes", clientsController.listNotes);
router.post("/:id/notes", authorize("ADMIN", "ACCOUNTANT"), validate(createNoteSchema), clientsController.addNote);
router.delete("/:id/notes/:noteId", authorize("ADMIN", "ACCOUNTANT"), clientsController.removeNote);
router.get("/:id", clientsController.getById);
router.post("/", authorize("ADMIN", "ACCOUNTANT"), validate(createClientSchema), clientsController.create);
router.put("/:id", authorize("ADMIN", "ACCOUNTANT"), validate(updateClientSchema), clientsController.update);
router.delete("/:id", authorize("ADMIN"), clientsController.remove);

module.exports = router;
