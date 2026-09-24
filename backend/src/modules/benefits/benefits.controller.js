const { getBenefits, addPersonalTransaction, updatePersonalTransaction, deletePersonalTransaction } = require("./benefits.service");
const { success } = require("../../utils/response");
const prisma = require("../../config/database");

async function getBenefitsHandler(req, res, next) {
  try {
    const { agencyId } = req;
    const data = await getBenefits(agencyId, req.query);
    success(res, data);
  } catch (err) {
    next(err);
  }
}

async function addTransactionHandler(req, res, next) {
  try {
    const { agencyId } = req;
    const tx = await addPersonalTransaction(agencyId, req.body);
    success(res, tx, 201);
  } catch (err) {
    next(err);
  }
}

async function updateTransactionHandler(req, res, next) {
  try {
    const { agencyId } = req;
    const { id } = req.params;
    await updatePersonalTransaction(agencyId, id, req.body);
    success(res, { success: true });
  } catch (err) {
    next(err);
  }
}

async function deleteTransactionHandler(req, res, next) {
  try {
    const { agencyId } = req;
    const { id } = req.params;
    await deletePersonalTransaction(agencyId, id);
    success(res, { success: true });
  } catch (err) {
    next(err);
  }
}

async function applyToBalanceHandler(req, res, next) {
  try {
    const { agencyId } = req;
    const { netProfit } = req.body;
    
    // We keep this endpoint just in case, but it's no longer the main way to update balance.
    // Actually, availableBalance is computed dynamically now.
    // If they want to manually adjust openingBalance:
    const agency = await prisma.agency.findUnique({ where: { id: agencyId } });
    if (!agency) throw new Error("Agence introuvable");

    const updated = await prisma.agency.update({
      where: { id: agencyId },
      data: { openingBalance: (agency.openingBalance || 0) + Number(netProfit) },
    });

    success(res, { newBalance: updated.openingBalance });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getBenefitsHandler,
  addTransactionHandler,
  updateTransactionHandler,
  deleteTransactionHandler,
  applyToBalanceHandler
};
