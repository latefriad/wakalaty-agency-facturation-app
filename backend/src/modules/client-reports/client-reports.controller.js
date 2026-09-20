const clientReportsService = require("./client-reports.service");
const { success } = require("../../utils/response");

exports.getReport = async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const { month } = req.query;

    const report = await clientReportsService.getClientMonthlyReport(
      req.user.agencyId,
      clientId,
      month
    );

    success(res, report);
  } catch (err) {
    next(err);
  }
};
