const { z } = require("zod");

const invoiceItemSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().int().min(1).max(100000),
  unitPrice: z.number().min(0).max(1e12),
  taxRate: z.number().min(0).max(100).optional().nullable(),
});

const createInvoiceSchema = z.object({
  clientId: z.string().uuid("Client ID invalide"),
  items: z.array(invoiceItemSchema).min(1, "Au moins un article requis").max(100),
  tax: z.number().min(0).max(100).optional().nullable(),
  discount: z.number().min(0).max(1e12).optional(),
  notes: z.string().max(5000).optional().nullable(),
  dueDate: z.string().optional().nullable(),
  docType: z.enum(["FACTURE", "DEVIS"]).optional(),
  // DRAFT = enregistrer en brouillon (sans numéro) ; sinon document finalisé.
  status: z.enum(["DRAFT", "EN_ATTENTE"]).optional(),
  // Multidevises + acompte + pénalité de retard.
  currency: z.enum(["DZD", "EUR", "USD"]).optional(),
  exchangeRate: z.number().positive().max(1e6).optional(),
  depositType: z.enum(["FIXED", "PERCENT"]).optional().nullable(),
  depositValue: z.number().min(0).max(1e12).optional().nullable(),
  penaltyRate: z.number().min(0).max(100).optional().nullable(),
}).strip();

const updateStatusSchema = z.object({
  status: z.enum(["EN_ATTENTE", "SENT", "PAYEE", "ANNULEE"]),
});

const addPaymentSchema = z.object({
  amount: z.number().positive("Montant invalide").max(1e12),
  method: z.string().max(50).optional().nullable(),
  reference: z.string().max(200).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
}).strip();

module.exports = { createInvoiceSchema, updateStatusSchema, addPaymentSchema };
