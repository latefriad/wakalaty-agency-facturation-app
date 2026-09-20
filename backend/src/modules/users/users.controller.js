const usersService = require("./users.service");
const { success } = require("../../utils/response");

exports.list = async (req, res, next) => {
  try {
    success(res, await usersService.list(req.agencyId));
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    success(res, await usersService.create(req.agencyId, req.body), 201);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    success(res, await usersService.update(req.agencyId, req.user.id, req.params.id, req.body));
  } catch (err) {
    next(err);
  }
};

exports.invite = async (req, res, next) => {
  try {
    success(res, await usersService.invite(req.agencyId, req.user, req.body, req), 201);
  } catch (err) {
    next(err);
  }
};

exports.listInvitations = async (req, res, next) => {
  try {
    success(res, await usersService.listInvitations(req.agencyId));
  } catch (err) {
    next(err);
  }
};

exports.revokeInvitation = async (req, res, next) => {
  try {
    await usersService.revokeInvitation(req.agencyId, req.params.id, req);
    success(res, { message: "Invitation révoquée" });
  } catch (err) {
    next(err);
  }
};
