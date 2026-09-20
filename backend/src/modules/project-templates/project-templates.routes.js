const { Router } = require("express");
const projectTemplatesController = require("./project-templates.controller");
const auth = require("../../middleware/auth");
const authorize = require("../../middleware/authorize");

const router = Router();

router.use(auth);

// View and apply templates: ADMIN, ADS, DESIGNER
router.get("/", authorize("ADMIN", "ADS", "DESIGNER"), projectTemplatesController.list);
router.get("/:id", authorize("ADMIN", "ADS", "DESIGNER"), projectTemplatesController.getOne);
router.post("/:id/apply", authorize("ADMIN", "ADS", "DESIGNER"), projectTemplatesController.apply);

// Create, edit, delete, seed templates: ADMIN only
router.post("/seed", authorize("ADMIN"), projectTemplatesController.seed);
router.post("/", authorize("ADMIN"), projectTemplatesController.create);
router.put("/:id", authorize("ADMIN"), projectTemplatesController.update);
router.delete("/:id", authorize("ADMIN"), projectTemplatesController.remove);

module.exports = router;
