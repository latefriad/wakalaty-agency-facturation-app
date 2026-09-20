const { Router } = require("express");
const prisma = require("../../config/database");
const { success, error } = require("../../utils/response");
const { createLimiter } = require("../../middleware/rateLimiter");

const router = Router();

// Consultation d'une facture par son jeton (UUID non devinable) — aucune
// authentification, donc champs limités et rate limit serré.
router.get("/invoices/:token", createLimiter({ windowMs: 15 * 60 * 1000, max: 60 }), async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { publicToken: req.params.token },
      include: {
        items: { select: { description: true, quantity: true, unitPrice: true, taxRate: true, total: true } },
        client: { select: { name: true } },
        payments: { where: { status: "APPROVED" }, select: { amount: true } },
        agency: {
          select: {
            name: true, logo: true, email: true, phone: true, address: true,
            currency: true, taxId: true, primaryColor: true, secondaryColor: true,
          },
        },
      },
    });
    if (!invoice) return error(res, "Document introuvable", 404);

    // Marque la première consultation par le client (statut « vue ») sans
    // bloquer la réponse : best-effort, idempotent.
    if (!invoice.viewedAt && (invoice.status === "SENT" || invoice.status === "EN_ATTENTE")) {
      prisma.invoice
        .updateMany({ where: { id: invoice.id, viewedAt: null }, data: { viewedAt: new Date() } })
        .catch(() => {});
    }

    const paid = invoice.payments.reduce((s, p) => s + p.amount, 0);
    const { agency, payments, publicToken, agencyId, clientId, ...doc } = invoice;

    success(res, {
      ...doc,
      paidAmount: paid,
      balance: Math.max(0, invoice.total - paid),
      agency,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
