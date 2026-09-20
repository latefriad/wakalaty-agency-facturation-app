const { Router } = require("express");
const invoicesController = require("./invoices.controller");
const auth = require("../../middleware/auth");
const authorize = require("../../middleware/authorize");
const validate = require("../../middleware/validate");
const { createInvoiceSchema, updateStatusSchema, addPaymentSchema } = require("./invoices.schema");

const router = Router();
router.use(auth);

// Lecture aussi restreinte que l'écriture : les factures sont des données
// financières — sans ce verrou, n'importe quel rôle connecté (EMPLOYEE…)
// pouvait lister toutes les factures de l'agence.
router.get("/", authorize("ADMIN", "ACCOUNTANT"), invoicesController.list);
router.get("/export/csv", authorize("ADMIN", "ACCOUNTANT"), invoicesController.exportCsv);
router.get("/:id", authorize("ADMIN", "ACCOUNTANT"), invoicesController.getById);
router.post("/", authorize("ADMIN", "ACCOUNTANT"), validate(createInvoiceSchema), invoicesController.create);
router.post("/:id/finalize", authorize("ADMIN", "ACCOUNTANT"), invoicesController.finalize);
router.patch("/:id/status", authorize("ADMIN", "ACCOUNTANT"), validate(updateStatusSchema), invoicesController.updateStatus);
router.post("/:id/payments", authorize("ADMIN", "ACCOUNTANT"), validate(addPaymentSchema), invoicesController.addPayment);
router.post("/:id/convert", authorize("ADMIN", "ACCOUNTANT"), invoicesController.convertToInvoice);
router.post("/:id/send", authorize("ADMIN", "ACCOUNTANT"), invoicesController.sendToClient);
router.delete("/:id", authorize("ADMIN"), invoicesController.remove);

module.exports = router;
