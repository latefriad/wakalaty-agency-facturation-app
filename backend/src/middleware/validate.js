const { error } = require("../utils/response");

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join(", ");
      return error(res, message, 400);
    }
    req.body = result.data;
    next();
  };
}

module.exports = validate;
