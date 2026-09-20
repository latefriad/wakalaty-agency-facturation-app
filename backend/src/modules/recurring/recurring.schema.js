const { z } = require("zod");

const itemSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().int().min(1).max(100000),
  unitPrice: z.number().min(0).max(1e12),
  taxRate: z.number().min(0).max(100).optional().nullable(),
});

const createRecurringSchema = z.object({
  clientId: z.string().uuid(),
  items: z.array(itemSchema).min(1).max(100),
  frequency: z.enum(["MONTHLY", "QUARTERLY", "YEARLY"]).optional(),
  tax: z.number().min(0).max(100).optional().nullable(),
  discount: z.number().min(0).optional(),
  notes: z.string().max(5000).optional().nullable(),
  dueDays: z.number().int().min(0).max(365).optional(),
  startDate: z.string().optional().nullable(),
}).strip();

const updateRecurringSchema = z.object({
  active: z.boolean().optional(),
  frequency: z.enum(["MONTHLY", "QUARTERLY", "YEARLY"]).optional(),
  dueDays: z.number().int().min(0).max(365).optional(),
}).strip();

module.exports = { createRecurringSchema, updateRecurringSchema };
