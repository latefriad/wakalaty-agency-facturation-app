const leadsService = require("./leads.service");
const { success } = require("../../utils/response");

exports.list = async (req, res, next) => {
  try {
    const result = await leadsService.list(req.user.agencyId, req);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const result = await leadsService.getById(req.user.agencyId, req.params.id);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const result = await leadsService.create(req.user.agencyId, req.body);
    success(res, result, 201);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const result = await leadsService.update(req.user.agencyId, req.params.id, req.body);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.changeStage = async (req, res, next) => {
  try {
    const result = await leadsService.changeStage(req.user.agencyId, req.params.id, req.body);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const result = await leadsService.remove(req.user.agencyId, req.params.id);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.addNote = async (req, res, next) => {
  try {
    const result = await leadsService.addNote(
      req.user.agencyId,
      req.params.id,
      req.user.id,
      req.body.content
    );
    success(res, result, 201);
  } catch (err) {
    next(err);
  }
};

exports.convertToClient = async (req, res, next) => {
  try {
    const result = await leadsService.convertToClient(
      req.user.agencyId,
      req.params.id,
      req.user.id
    );
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.listAssignees = async (req, res, next) => {
  try {
    const result = await leadsService.listAssignees(req.user.agencyId);
    success(res, result);
  } catch (err) {
    next(err);
  }
};
