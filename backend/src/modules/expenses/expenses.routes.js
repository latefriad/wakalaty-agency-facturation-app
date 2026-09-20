const { Router } = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const expensesController = require("./expenses.controller");
const expensesService = require("./expenses.service");
const auth = require("../../middleware/auth");
const authorize = require("../../middleware/authorize");
const validate = require("../../middleware/validate");
const { createExpenseSchema, updateExpenseSchema } = require("./expenses.schema");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(expensesService.ATTACHMENTS_DIR, { recursive: true });
    cb(null, expensesService.ATTACHMENTS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${req.params.id}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(pdf|jpe?g|png|webp)$/i;
    if (allowed.test(file.originalname)) return cb(null, true);
    cb(Object.assign(new Error("Format non supporté (pdf/jpg/png/webp)"), { status: 400 }));
  },
});

const router = Router();
router.use(auth);
// Données financières : mêmes rôles que les factures et le dashboard.
router.use(authorize("ADMIN", "ACCOUNTANT"));

router.get("/", expensesController.list);
router.post("/", validate(createExpenseSchema), expensesController.create);
router.put("/:id", validate(updateExpenseSchema), expensesController.update);
router.delete("/:id", expensesController.remove);

// Justificatif : stocké hors statique public, téléchargement authentifié.
router.post("/:id/attachment", upload.single("file"), expensesController.uploadAttachment);
router.get("/:id/attachment", expensesController.downloadAttachment);

module.exports = router;
