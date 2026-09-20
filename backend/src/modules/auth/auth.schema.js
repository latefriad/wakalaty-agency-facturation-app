const { z } = require("zod");

const registerSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(6, "Mot de passe: 6 caractères minimum"),
  name: z.string().min(1, "Nom requis"),
  agencyName: z.string().min(1, "Nom de l'agence requis").optional(),
});

const loginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

const updateProfileSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email("Email invalide").optional(),
}).strip();

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Mot de passe actuel requis"),
  newPassword: z.string().min(8, "Nouveau mot de passe: 8 caractères minimum"),
}).strip();

const acceptInvitationSchema = z.object({
  password: z.string().min(8, "Mot de passe: 8 caractères minimum"),
}).strip();

module.exports = { registerSchema, loginSchema, updateProfileSchema, changePasswordSchema, acceptInvitationSchema };
