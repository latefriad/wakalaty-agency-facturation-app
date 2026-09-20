const { z } = require("zod");

const createContractSchema = z.object({
  title: z.string().min(1, "Titre requis"),
  type: z.enum(["MARKETING", "ADS", "WEBSITE", "CAHIER"]),
  clientId: z.string().uuid("Client ID invalide"),
  startDate: z.string().optional(),
  endDate: z.string().optional().nullable(),
  value: z.number().min(0).optional(),
  notes: z.string().optional().nullable(),
  serviceIds: z.array(z.string().uuid()).optional(),
});

const updateContractSchema = createContractSchema.partial();

module.exports = { createContractSchema, updateContractSchema };
