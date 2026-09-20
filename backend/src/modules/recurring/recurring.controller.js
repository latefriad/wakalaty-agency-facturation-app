const recurringService = require("./recurring.service");
const { success } = require("../../utils/response");

exports.list = async (req, res, next) => {
  try {
    success(res, await recurringService.list(req.agencyId));
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    success(res, await recurringService.create(req.agencyId, req.body), 201);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    success(res, await recurringService.update(req.agencyId, req.params.id, req.body));
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    await recurringService.remove(req.agencyId, req.params.id);
    success(res, { deleted: true });
  } catch (err) {
    next(err);
  }
};
