const budgetsService = require("./budgets.service");
const { success } = require("../../utils/response");

function parseYearMonth(params) {
  const year = parseInt(params.year, 10);
  const month = parseInt(params.month, 10);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw Object.assign(new Error("Année invalide"), { status: 400 });
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw Object.assign(new Error("Mois invalide"), { status: 400 });
  }
  return { year, month };
}

exports.listYear = async (req, res, next) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    success(res, await budgetsService.listYear(req.agencyId, year));
  } catch (err) {
    next(err);
  }
};

exports.upsert = async (req, res, next) => {
  try {
    const { year, month } = parseYearMonth(req.params);
    success(res, await budgetsService.upsert(req.agencyId, year, month, req.body, req));
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const { year, month } = parseYearMonth(req.params);
    await budgetsService.remove(req.agencyId, year, month, req);
    success(res, { message: "Supprimé" });
  } catch (err) {
    next(err);
  }
};
