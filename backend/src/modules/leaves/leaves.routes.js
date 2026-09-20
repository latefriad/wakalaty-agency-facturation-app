const { Router } = require("express");
const leavesController = require("./leaves.controller");
const auth = require("../../middleware/auth");
const authorize = require("../../middleware/authorize");
const validate = require("../../middleware/validate");
const { createLeaveSchema, decisionSchema, setBalanceSchema } = require("./leaves.schema");

const router = Router();
router.use(auth);

// Self-service : l'employé agit uniquement sur SES congés — l'identité vient
// du token, le serveur refuse toute action sur la demande d'un autre.
router.get("/my", leavesController.myLeaves);
router.post("/", validate(createLeaveSchema), leavesController.create);
router.patch("/:id/cancel", leavesController.cancel);

// Gestion : ADMIN/SUPER_ADMIN voient toute l'agence ; un manager voit et
// décide pour SES subordonnés directs uniquement. Le périmètre est vérifié
// dans le service (relation managerId en base), pas par un simple rôle.
router.get("/", leavesController.list);
router.patch("/:id/approve", validate(decisionSchema), leavesController.approve);
router.patch("/:id/reject", validate(decisionSchema), leavesController.reject);
// L'ajustement du droit annuel reste réservé aux admins.
router.put("/balances/:employeeId", authorize("ADMIN"), validate(setBalanceSchema), leavesController.setBalance);

module.exports = router;
