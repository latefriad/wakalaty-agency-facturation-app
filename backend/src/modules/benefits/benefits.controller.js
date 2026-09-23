const prisma = require("../../config/database");
const { getBenefits } = require("./benefits.service");
const { success } = require("../../utils/response");

async function getBenefitsHandler(req, res, next) {
  try {
    const { agencyId } = req;
    const { month, year } = req.query;
    const data = await getBenefits(agencyId, { month, year });
    success(res, data);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/benefits/apply-to-balance
 * Body: { month: "YYYY-MM", netProfit: number }
 *
 * Adds the month's net profit to agency.openingBalance so the treasury
 * automatically reflects the closed period going forward.
 * Idempotent-safe: we store the applied months in a JSON log on the agency.
 */
async function applyToBalanceHandler(req, res, next) {
  try {
    const { agencyId } = req;
    const { month, netProfit } = req.body;

    if (!month || netProfit === undefined) {
      return res.status(400).json({ success: false, error: "month and netProfit are required" });
    }

    const amount = Number(netProfit);
    if (isNaN(amount)) {
      return res.status(400).json({ success: false, error: "netProfit must be a number" });
    }

    // Fetch current openingBalance
    const agency = await prisma.agency.findUnique({
      where: { id: agencyId },
      select: { openingBalance: true, currency: true },
    });

    if (!agency) {
      return res.status(404).json({ success: false, error: "Agency not found" });
    }

    const newBalance = (agency.openingBalance || 0) + amount;

    // Update openingBalance
    const updated = await prisma.agency.update({
      where: { id: agencyId },
      data: { openingBalance: newBalance },
      select: { openingBalance: true, currency: true },
    });

    success(res, {
      month,
      appliedAmount: amount,
      previousBalance: agency.openingBalance || 0,
      newBalance: updated.openingBalance,
      currency: updated.currency,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getBenefitsHandler, applyToBalanceHandler };
