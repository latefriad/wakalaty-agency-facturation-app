const { z } = require("zod");

// Valide le format AVANT Prisma : une date invalide doit produire une 400,
// pas une 500 (même approche que tasks.schema).
const dateString = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), "Date invalide");

const createEmployeeSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  email: z.string().email("Email invalide").optional().nullable(),
  phone: z.string().optional().nullable(),
  position: z.string().optional().nullable(),
  salary: z.number().min(0).optional().nullable(),
  hireDate: dateString.optional().nullable(),
  contractType: z.enum(["CDI", "CDD", "STAGE", "FREELANCE", "AUTRE"]).optional().nullable(),
  managerId: z.string().uuid("Manager invalide").optional().nullable(),
  jobType: z.enum(["salarie", "freelancer"]).optional().default("salarie"),
  commissionRate: z.number().min(0).max(100).optional().default(0),
  commissionBalance: z.number().min(0).optional().default(0),
  commissionPaid: z.number().min(0).optional().default(0),
  isPaid: z.boolean().optional().default(false),
  paymentDate: z.string().optional().nullable(),
});

const updateEmployeeSchema = createEmployeeSchema.partial();

module.exports = { createEmployeeSchema, updateEmployeeSchema };
