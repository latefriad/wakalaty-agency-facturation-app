const { Router } = require("express");
const { z } = require("zod");
const suppliersController = require("./suppliers.controller");
const auth = require("../../middleware/auth");
const authorize = require("../../middleware/authorize");
const validate = require("../../middleware/validate");
const { CATEGORIES } = require("../expenses/expenses.schema");

const supplierSchema = z.object({
  name: z.string().min(1, "Nom requis").max(200),
  email: z.string().email("Email invalide").optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
}).strip();

const dateString = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), "Date invalide");

// Même moule que les dépenses : devise + taux figé, catégorie fermée (celle
// de la dépense créée au paiement).
const billSchema = z.object({
  reference: z.string().max(100).optional().nullable(),
  amount: z.number().positive("Montant invalide").max(1e12),
  currency: z.enum(["DZD", "EUR", "USD"]).optional().default("DZD"),
  exchangeRate: z.number().positive().max(1e6).optional().default(1),
  category: z.enum(CATEGORIES).optional().default("AUTRE"),
  dueDate: dateString.optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
}).strip();

const router = Router();
router.use(auth);
// Dettes et décaissements : mêmes rôles que dépenses et dashboard.
router.use(authorize("ADMIN", "ACCOUNTANT"));

// L'échéancier AVANT les routes /:id (sinon « bills » serait pris pour un id).
router.get("/bills", suppliersController.listBills);
router.put("/bills/:billId", validate(billSchema.partial()), suppliersController.updateBill);
router.post("/bills/:billId/pay", suppliersController.payBill);
router.patch("/bills/:billId/cancel", suppliersController.cancelBill);

router.get("/", suppliersController.listSuppliers);
router.post("/", validate(supplierSchema), suppliersController.createSupplier);
router.put("/:id", validate(supplierSchema.partial()), suppliersController.updateSupplier);
router.delete("/:id", suppliersController.removeSupplier);
router.post("/:id/bills", validate(billSchema), suppliersController.createBill);

module.exports = router;
