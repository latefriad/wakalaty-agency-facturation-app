const aiService = require("./ai.service");
const { success } = require("../../utils/response");

exports.generateServices = async (req, res, next) => {
  try {
    const result = await aiService.generateServices(req.body.category);
    success(res, result);
  } catch (err) {
    next(err);
  }
};
