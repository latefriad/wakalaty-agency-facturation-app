const { z } = require("zod");

const createAdSpendSchema = z.object({
  clientId: z.string().min(1, "Client requis"),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Format de mois invalide (ex: 2026-09)"),
  platform: z.enum(["META", "TIKTOK", "GOOGLE", "OTHER"]).default("META"),
  campaignName: z.string().optional().default(""),
  clientAdBudget: z.coerce.number().min(0).default(0),
  actualSpend: z.coerce.number().min(0).default(0),
  amountBilled: z.coerce.number().min(0).default(0),
  orders: z.coerce.number().int().min(0).default(0),
  revenueGenerated: z.coerce.number().min(0).default(0),
  notes: z.string().optional().nullable(),
});

const updateAdSpendSchema = createAdSpendSchema.partial();

module.exports = {
  createAdSpendSchema,
  updateAdSpendSchema,
};
