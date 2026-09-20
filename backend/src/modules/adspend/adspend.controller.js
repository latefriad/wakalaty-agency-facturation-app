const adspendService = require("./adspend.service");
const { success } = require("../../utils/response");

exports.list = async (req, res, next) => {
  try {
    const result = await adspendService.list(req.user.agencyId, req);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.summary = async (req, res, next) => {
  try {
    const result = await adspendService.summary(req.user.agencyId, req);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const result = await adspendService.create(
      req.user.agencyId,
      req.body,
      req.user.id
    );
    success(res, result, 201);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const result = await adspendService.update(
      req.user.agencyId,
      req.params.id,
      req.body
    );
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const result = await adspendService.remove(req.user.agencyId, req.params.id);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.exportExcel = async (req, res, next) => {
  try {
    await adspendService.exportExcel(req.user.agencyId, req, res);
  } catch (err) {
    next(err);
  }
};
