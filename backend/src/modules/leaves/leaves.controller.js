const leavesService = require("./leaves.service");
const { success } = require("../../utils/response");

exports.create = async (req, res, next) => {
  try {
    success(res, await leavesService.create(req.agencyId, req.user.id, req.body, req), 201);
  } catch (err) {
    next(err);
  }
};

exports.myLeaves = async (req, res, next) => {
  try {
    success(res, await leavesService.myLeaves(req.agencyId, req.user.id));
  } catch (err) {
    next(err);
  }
};

exports.cancel = async (req, res, next) => {
  try {
    success(res, await leavesService.cancel(req.agencyId, req.user.id, req.params.id, req));
  } catch (err) {
    next(err);
  }
};

exports.list = async (req, res, next) => {
  try {
    success(res, await leavesService.list(req.agencyId, req.user, { status: req.query.status }));
  } catch (err) {
    next(err);
  }
};

exports.approve = async (req, res, next) => {
  try {
    success(res, await leavesService.approve(req.agencyId, req.user, req.params.id, req.body, req));
  } catch (err) {
    next(err);
  }
};

exports.reject = async (req, res, next) => {
  try {
    success(res, await leavesService.reject(req.agencyId, req.user, req.params.id, req.body, req));
  } catch (err) {
    next(err);
  }
};

exports.setBalance = async (req, res, next) => {
  try {
    success(res, await leavesService.setBalance(req.agencyId, req.params.employeeId, req.body, req));
  } catch (err) {
    next(err);
  }
};
