const portfolioService = require("./portfolio.service");
const { success, paginated } = require("../../utils/response");

exports.list = async (req, res, next) => {
  try {
    const result = await portfolioService.list(req.agencyId, req);
    paginated(res, result);
  } catch (err) {
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const result = await portfolioService.getById(req.agencyId, req.params.id);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const result = await portfolioService.create(req.agencyId, req.body);
    success(res, result, 201);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const result = await portfolioService.update(req.agencyId, req.params.id, req.body);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    await portfolioService.remove(req.agencyId, req.params.id);
    success(res, { message: "Supprimé" });
  } catch (err) {
    next(err);
  }
};
