const tasksService = require("./tasks.service");
const { success, paginated } = require("../../utils/response");

exports.list = async (req, res, next) => {
  try {
    const result = await tasksService.list(req.user, req);
    paginated(res, result);
  } catch (err) {
    next(err);
  }
};

exports.myWork = async (req, res, next) => {
  try {
    const result = await tasksService.myWork(req.user);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const result = await tasksService.getById(req.user, req.params.id);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const result = await tasksService.create(req.user, req.body);
    success(res, result, 201);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const result = await tasksService.update(req.user, req.params.id, req.body);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    await tasksService.remove(req.agencyId, req.params.id);
    success(res, { message: "Supprimé" });
  } catch (err) {
    next(err);
  }
};
