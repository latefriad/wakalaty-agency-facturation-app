const { z } = require("zod");

const createPortfolioSchema = z.object({
  title: z.string().min(1, "Titre requis"),
  description: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  link: z.string().optional().nullable(),
});

const updatePortfolioSchema = createPortfolioSchema.partial();

module.exports = { createPortfolioSchema, updatePortfolioSchema };
