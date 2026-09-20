const { Router } = require("express");
const tasksController = require("./tasks.controller");
const auth = require("../../middleware/auth");
const authorize = require("../../middleware/authorize");
const validate = require("../../middleware/validate");
const { createTaskSchema, updateTaskSchema } = require("./tasks.schema");

const router = Router();
router.use(auth);

router.get("/", tasksController.list);
// Avant /:id sinon "my" serait interprété comme un id de tâche.
router.get("/my", tasksController.myWork);
router.get("/:id", tasksController.getById);
router.post("/", authorize("ADMIN"), validate(createTaskSchema), tasksController.create);
// Pas de authorize() : un employé peut déplacer SES cartes — la restriction
// (propriété + champs status/order uniquement) est appliquée dans le service.
router.patch("/:id", validate(updateTaskSchema), tasksController.update);
router.delete("/:id", authorize("ADMIN"), tasksController.remove);

module.exports = router;
