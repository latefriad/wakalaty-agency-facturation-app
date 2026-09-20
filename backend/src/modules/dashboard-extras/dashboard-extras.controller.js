const dashboardExtrasService = require("./dashboard-extras.service");
const { success } = require("../../utils/response");

exports.getExtras = async (req, res, next) => {
  try {
    const result = await dashboardExtrasService.getExtras(
      req.user.agencyId,
      req
    );
    success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.setGoal = async (req, res, next) => {
  try {
    const result = await dashboardExtrasService.setGoal(
      req.user.agencyId,
      req.body
    );
    success(res, result);
  } catch (err) {
    next(err);
  }
};
