const { error } = require("../utils/response");

function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return error(res, "Non autorisé", 401);
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
      return error(res, "Accès interdit", 403);
    }

    next();
  };
}

module.exports = authorize;
