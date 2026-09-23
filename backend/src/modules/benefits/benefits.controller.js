const { getBenefits } = require("./benefits.service");
const { success } = require("../../utils/response");

async function getBenefitsHandler(req, res, next) {
  try {
    const { agencyId } = req;
    const { month, year } = req.query;
    const data = await getBenefits(agencyId, { month, year });
    success(res, data);
  } catch (err) {
    next(err);
  }
}

module.exports = { getBenefitsHandler };
