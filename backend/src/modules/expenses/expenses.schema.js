const { z } = require("zod");

// Catégories fermées : un select stable côté UI, des agrégats par catégorie
// fiables côté dashboard (pas de texte libre qui éclate les regroupements).
const CATEGORIES = [
  "SALAIRES",
  "LOYER",
  "ADS",
  "ABONNEMENTS",
  "MATERIEL",
  "IMPOTS",
  "TRANSPORT",
  "AUTRE",
];

const dateString = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), "Date invalide");

const createExpenseSchema = z.object({
  amount: z.number().positive("Montant invalide").max(1e12),
  currency: z.enum(["DZD", "EUR", "USD"]).optional().default("DZD"),
  exchangeRate: z.number().positive().max(1e6).optional().default(1),
  category: z.enum(CATEGORIES),
  date: dateString.optional(),
  notes: z.string().max(1000).optional().nullable(),
}).strip();

const updateExpenseSchema = createExpenseSchema.partial();

module.exports = { createExpenseSchema, updateExpenseSchema, CATEGORIES };
