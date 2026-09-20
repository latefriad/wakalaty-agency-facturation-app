const { Router } = require("express");
const agenciesController = require("./agencies.controller");
const validate = require("../../middleware/validate");
const { z } = require("zod");

const updateAgencySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  logo: z.string().max(500000).optional().nullable(),
  tagline: z.string().max(300).optional().nullable(),
  website: z.string().max(300).optional().nullable(),
  primaryColor: z.string().max(20).optional().nullable(),
  secondaryColor: z.string().max(20).optional().nullable(),
  taxId: z.string().max(100).optional().nullable(),
  bankAccount: z.string().max(100).optional().nullable(),
  currency: z.string().min(3).max(5).optional(),
  // Calage de trésorerie : solde bancaire au démarrage dans Wakalati.
  openingBalance: z.number().min(-1e12).max(1e12).optional(),
  remindersEnabled: z.boolean().optional(),
  onboarded: z.boolean().optional(),
  agencyType: z.string().max(100).optional().nullable(),
  teamSize: z.string().max(20).optional().nullable(),
  goals: z.array(z.string().max(100)).max(20).optional().nullable(),
}).strip();
const auth = require("../../middleware/auth");
const authorize = require("../../middleware/authorize");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "../../uploads/logos");
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `logo-${req.agencyId}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|svg|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) return cb(null, true);
    cb(Object.assign(new Error("Format d'image non supporté (jpeg/png/gif/svg/webp)"), { status: 400 }));
  },
});

const router = Router();
router.use(auth);

router.get("/me", agenciesController.getMe);
router.put("/me", authorize("ADMIN"), validate(updateAgencySchema), agenciesController.updateMe);
router.post("/me/logo", authorize("ADMIN"), upload.single("logo"), agenciesController.uploadLogo);

module.exports = router;
