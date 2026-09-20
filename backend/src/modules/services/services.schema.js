const { z } = require("zod");

const createServiceSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  description: z.string().optional().nullable(),
  basePrice: z.number().min(0).optional().default(0),
  type: z.string().optional().nullable(),
  salePrice: z.number().min(0).optional().default(0),
  totalCharges: z.number().min(0).optional().default(0),
  netProfit: z.number().optional().default(0),
  notes: z.string().optional().nullable(),
  charges: z.array(z.object({
    label: z.string().optional(),
    amount: z.union([z.number(), z.string()]).optional(),
  })).optional().nullable(),
  freelancerId: z.string().optional().nullable(),
  freelancerName: z.string().optional().nullable(),
  commissionType: z.enum(["percent", "fixed"]).optional().default("percent"),
  commissionValue: z.number().min(0).optional().default(0),
  commissionAmount: z.number().min(0).optional().default(0),
});

const updateServiceSchema = createServiceSchema.partial();

module.exports = { createServiceSchema, updateServiceSchema };
