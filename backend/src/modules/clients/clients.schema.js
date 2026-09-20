const { z } = require("zod");

const createClientSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  email: z.string().email("Email invalide").optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  defaultTaxRate: z.number().min(0).max(100).optional().nullable(),
  // Tags (max 30 par tag, max 20 tags) ; trim/dédoublonnage/retrait des vides
  // sont faits côté service (normalizeTags), on tolère donc les entrées vides.
  tags: z.array(z.string().max(40)).max(20).optional(),
  // Champs personnalisés { libellé: valeur } — valeurs texte/nombre/bool.
  customFields: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional().nullable(),
});

const updateClientSchema = createClientSchema.partial();

const createNoteSchema = z.object({
  content: z.string().trim().min(1, "Note vide").max(5000),
});

module.exports = { createClientSchema, updateClientSchema, createNoteSchema };
