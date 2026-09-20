const attendanceService = require("./attendance.service");
const { success } = require("../../utils/response");

exports.clockIn = async (req, res, next) => {
  try {
    success(res, await attendanceService.clockIn(req.agencyId, req.user.id, req.body), 201);
  } catch (err) {
    next(err);
  }
};

exports.clockOut = async (req, res, next) => {
  try {
    success(res, await attendanceService.clockOut(req.agencyId, req.user.id));
  } catch (err) {
    next(err);
  }
};

exports.myAttendance = async (req, res, next) => {
  try {
    success(res, await attendanceService.myAttendance(req.agencyId, req.user.id));
  } catch (err) {
    next(err);
  }
};

exports.list = async (req, res, next) => {
  try {
    success(res, await attendanceService.list(req.agencyId, req.query));
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    await attendanceService.remove(req.agencyId, req.params.id, req);
    success(res, { message: "Pointage supprimé" });
  } catch (err) {
    next(err);
  }
};
