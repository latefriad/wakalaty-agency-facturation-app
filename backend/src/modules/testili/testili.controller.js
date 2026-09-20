const testiliService = require("./testili.service");
const { success } = require("../../utils/response");

exports.list = async (req, res, next) => {
  try {
    const result = await testiliService.listTests(req.user.agencyId, req.query);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.getOne = async (req, res, next) => {
  try {
    const result = await testiliService.getTestById(req.user.agencyId, req.params.id);
    if (!result) {
      return res.status(404).json({ success: false, message: "Test not found" });
    }
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const result = await testiliService.createTest(
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
    const result = await testiliService.updateTest(
      req.user.agencyId,
      req.params.id,
      req.body
    );
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.updateVerdict = async (req, res, next) => {
  try {
    const result = await testiliService.updateVerdict(
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
    const result = await testiliService.deleteTest(
      req.user.agencyId,
      req.params.id
    );
    success(res, result);
  } catch (err) {
    next(err);
  }
};
