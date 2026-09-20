const authService = require("./auth.service");
const { success } = require("../../utils/response");

exports.register = async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    success(res, result, 201);
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    const result = await authService.getMe(req.user.id);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const result = await authService.updateProfile(req.user.id, req.body);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    await authService.changePassword(req.user.id, req.body);
    success(res, { message: "Mot de passe modifié" });
  } catch (err) {
    next(err);
  }
};

exports.invitationInfo = async (req, res, next) => {
  try {
    success(res, await authService.invitationInfo(req.params.token));
  } catch (err) {
    next(err);
  }
};

exports.acceptInvitation = async (req, res, next) => {
  try {
    success(res, await authService.acceptInvitation(req.params.token, req.body), 201);
  } catch (err) {
    next(err);
  }
};
