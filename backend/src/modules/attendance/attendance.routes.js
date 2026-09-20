const { Router } = require("express");
const { z } = require("zod");
const attendanceController = require("./attendance.controller");
const auth = require("../../middleware/auth");
const authorize = require("../../middleware/authorize");
const validate = require("../../middleware/validate");

// Le client n'envoie QU'une note : l'horodatage est celui du serveur
// (pas d'anti-datage possible).
const clockInSchema = z.object({
  note: z.string().max(300).optional().nullable(),
}).strip();

const router = Router();
router.use(auth);

// Self-service : chacun pointe pour soi (identité issue du token).
router.post("/clock-in", validate(clockInSchema), attendanceController.clockIn);
router.post("/clock-out", attendanceController.clockOut);
router.get("/my", attendanceController.myAttendance);

// Vue et corrections : rôles RH uniquement.
router.use(authorize("ADMIN"));
router.get("/", attendanceController.list);
router.delete("/:id", attendanceController.remove);

module.exports = router;
