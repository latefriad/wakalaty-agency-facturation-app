const { z } = require("zod");

// Valide le format AVANT Prisma : une date invalide doit produire une 400,
// pas une 500 du driver.
const dateString = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), "Date invalide");

const createTaskSchema = z.object({
  title: z.string().min(1, "Titre requis"),
  description: z.string().optional().nullable(),
  type: z.enum(["DAILY", "WEEKLY", "PROJECT"]).optional(),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
  startDate: dateString.optional().nullable(),
  dueDate: dateString.optional().nullable(),
  employeeId: z.string().uuid().optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
  order: z.number().int().optional(),
});

const updateTaskSchema = createTaskSchema.partial().extend({
  status: z.enum(["TODO", "INPROGRESS", "DONE"]).optional(),
});

module.exports = { createTaskSchema, updateTaskSchema };
