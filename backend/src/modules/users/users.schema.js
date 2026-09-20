const { z } = require("zod");

// SUPER_ADMIN n'est jamais assignable via l'API : ce rôle traverse les
// agences et ne se crée qu'en base.
const ASSIGNABLE_ROLES = ["ADMIN", "ACCOUNTANT", "EDITOR", "DESIGNER", "ADS", "VIDEO", "SEO", "EMPLOYEE"];

const createUserSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "Mot de passe: 8 caractères minimum"),
  name: z.string().min(1, "Nom requis"),
  role: z.enum(ASSIGNABLE_ROLES),
}).strip();

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(ASSIGNABLE_ROLES).optional(),
  isActive: z.boolean().optional(),
}).strip();

// Pas de mot de passe ici : l'invité le définit lui-même à l'acceptation.
const inviteUserSchema = z.object({
  email: z.string().email("Email invalide"),
  name: z.string().min(1, "Nom requis"),
  role: z.enum(ASSIGNABLE_ROLES).default("EMPLOYEE"),
}).strip();

module.exports = { createUserSchema, updateUserSchema, inviteUserSchema, ASSIGNABLE_ROLES };
