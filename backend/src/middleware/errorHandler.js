const { error } = require("../utils/response");

function errorHandler(err, req, res, _next) {
  if (err.name === "ZodError") {
    const message = err.errors
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join(", ");
    return error(res, message, 400);
  }

  if (err.code === "P2002") {
    const field = err.meta?.target?.join(", ") || "champ";
    return error(res, `Violation d'unicité sur: ${field}`, 409);
  }

  if (err.code === "P2025") {
    return error(res, "Enregistrement introuvable", 404);
  }

  if (err.name === "MulterError") {
    const msg = err.code === "LIMIT_FILE_SIZE" ? "Fichier trop volumineux (5 Mo max)" : err.message;
    return error(res, msg, 400);
  }

  if (Number.isInteger(err.status) && err.status >= 400 && err.status < 500) {
    return error(res, err.message, err.status);
  }

  if (process.env.NODE_ENV !== "production") {
    console.error("[Error]", err);
  }

  return error(res, "Erreur interne du serveur", 500);
}

module.exports = errorHandler;
