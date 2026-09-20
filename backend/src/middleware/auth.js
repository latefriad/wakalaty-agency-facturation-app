const prisma = require("../config/database");
const { verifyToken } = require("../utils/jwt");
const { error } = require("../utils/response");

async function auth(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return error(res, "Token requis", 401);
    }

    const token = header.split(" ")[1];
    const decoded = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { agency: true },
    });

    if (!user || user.isActive === false) {
      return error(res, "Compte invalide ou désactivé", 401);
    }

    req.user = user;
    req.agencyId = user.agencyId;

    next();
  } catch (err) {
    if (err.name === "JsonWebTokenError") {
      return error(res, "Token invalide", 401);
    }
    if (err.name === "TokenExpiredError") {
      return error(res, "Token expiré", 401);
    }
    return error(res, "Échec de l'authentification", 401);
  }
}

module.exports = auth;
