const { Router } = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const employeesController = require("./employees.controller");
const employeesService = require("./employees.service");
const auth = require("../../middleware/auth");
const authorize = require("../../middleware/authorize");
const validate = require("../../middleware/validate");
const { createEmployeeSchema, updateEmployeeSchema } = require("./employees.schema");

// Documents RH : stockés HORS de src/uploads (servi statiquement, donc
// public). L'accès se fait uniquement via les routes authentifiées ci-dessous.
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(employeesService.DOCS_DIR, { recursive: true });
    cb(null, employeesService.DOCS_DIR);
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
    const allowed = /\.(pdf|jpe?g|png|webp|docx?)$/i;
    if (allowed.test(file.originalname)) return cb(null, true);
    cb(Object.assign(new Error("Format non supporté (pdf/jpg/png/webp/doc/docx)"), { status: 400 }));
  },
});

const router = Router();
router.use(auth);

// Liste id+nom pour l'assignation de tâches : accessible à tous les rôles
// connectés, déclarée AVANT le verrou admin et avant /:id.
router.get("/assignable", employeesController.listAssignable);

// Self-service : l'employé connecté consulte SA fiche (salaire compris —
// c'est le sien), ses commissions et ses documents. L'identité vient du
// token, pas d'un paramètre : pas de moyen de viser la fiche d'un autre.
router.get("/me", employeesController.getMyProfile);
router.get("/me/commissions", employeesController.getMyCommissions);
router.get("/me/documents", employeesController.listMyDocuments);
router.get("/me/documents/:docId/download", employeesController.downloadMyDocument);

// Données sensibles (salaires, commissions) : module réservé aux admins.
router.use(authorize("ADMIN"));

router.get("/", employeesController.list);
router.get("/:id", employeesController.getById);
router.post("/", validate(createEmployeeSchema), employeesController.create);
router.put("/:id", validate(updateEmployeeSchema), employeesController.update);
// Offboarding = flux normal de départ : accès révoqué, historique conservé.
router.post("/:id/offboard", employeesController.offboard);
router.post("/:id/reactivate", employeesController.reactivate);
// La suppression physique perd l'historique (tâches détachées) : réservée au
// super-admin, l'admin d'agence passe par l'offboarding.
router.delete("/:id", authorize("SUPER_ADMIN"), employeesController.remove);

// Documents RH d'une fiche (téléchargements audités).
router.get("/:id/documents", employeesController.listDocuments);
router.post("/:id/documents", upload.single("file"), employeesController.uploadDocument);
router.get("/:id/documents/:docId/download", employeesController.downloadDocument);
router.delete("/:id/documents/:docId", employeesController.removeDocument);

module.exports = router;
