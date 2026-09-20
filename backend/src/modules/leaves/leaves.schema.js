const { z } = require("zod");

// Valide le format AVANT Prisma : une date invalide doit produire une 400,
// pas une 500 (même approche que tasks.schema).
const dateString = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), "Date invalide");

const createLeaveSchema = z.object({
  type: z.enum(["ANNUAL", "SICK", "UNPAID", "EXCEPTIONAL"]).default("ANNUAL"),
  startDate: dateString,
  endDate: dateString,
  reason: z.string().max(500).optional().nullable(),
}).strip();

const decisionSchema = z.object({
  note: z.string().max(500).optional().nullable(),
}).strip();

const setBalanceSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  allocatedDays: z.number().min(0).max(365),
}).strip();

module.exports = { createLeaveSchema, decisionSchema, setBalanceSchema };
