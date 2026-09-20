const { z } = require("zod");

const dateString = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), "Date invalide");

const createLeadSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  phone: z.string().optional().nullable(),
  email: z.string().email("Email invalide").optional().nullable().or(z.literal("")),
  company: z.string().optional().nullable(),
  source: z
    .enum(["WHATSAPP", "FORM", "CHATBOT", "ADS", "REFERRAL", "OTHER"])
    .optional(),
  stage: z
    .enum(["NEW", "CONTACTED", "QUOTE_SENT", "NEGOTIATION", "WON", "LOST"])
    .optional(),
  estimatedValue: z.coerce.number().min(0).optional().nullable(),
  followUpDate: dateString.optional().nullable().or(z.literal("")),
  lostReason: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  assignedToId: z.string().uuid().optional().nullable().or(z.literal("")),
});

const updateLeadSchema = createLeadSchema.partial().extend({
  convertedClientId: z.string().optional().nullable(),
});

const changeStageSchema = z.object({
  stage: z.enum(["NEW", "CONTACTED", "QUOTE_SENT", "NEGOTIATION", "WON", "LOST"]),
  lostReason: z.string().optional().nullable(),
});

const addLeadNoteSchema = z.object({
  content: z.string().min(1, "Contenu de la note requis"),
});

module.exports = {
  createLeadSchema,
  updateLeadSchema,
  changeStageSchema,
  addLeadNoteSchema,
};
