const { Router } = require("express");
const servicesController = require("./services.controller");
const auth = require("../../middleware/auth");
const authorize = require("../../middleware/authorize");
const validate = require("../../middleware/validate");
const { createServiceSchema, updateServiceSchema } = require("./services.schema");

const router = Router();
router.use(auth);

// Les services portent les commissions des freelances (freelancerId,
// commissionAmount) : lecture réservée aux rôles financiers. Le dashboard
// employé passe désormais par GET /employees/me/commissions (ses propres
// commissions uniquement).
router.get("/", authorize("ADMIN", "ACCOUNTANT"), servicesController.list);
router.get("/:id", authorize("ADMIN", "ACCOUNTANT"), servicesController.getById);
router.post("/", authorize("ADMIN"), validate(createServiceSchema), servicesController.create);
router.put("/:id", authorize("ADMIN"), validate(updateServiceSchema), servicesController.update);
router.delete("/:id", authorize("ADMIN"), servicesController.remove);

module.exports = router;
