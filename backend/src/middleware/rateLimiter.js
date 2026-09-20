const rateLimit = require("express-rate-limit");

function createLimiter(options = {}) {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000,
    max: options.max || 100,
    standardHeaders: true,
    legacyHeaders: false,
    // Les tests enchaînent des dizaines de register/login depuis la même IP.
    skip: () => process.env.NODE_ENV === "test",
    message: { success: false, message: "Trop de requêtes, réessayez plus tard." },
  });
}

// 600/15min ≈ 40 req/min : large pour une SPA (3-4 fetchs par page),
// bloquant pour un scraping brutal. L'auth reste volontairement stricte.
const apiLimiter = createLimiter({ windowMs: 15 * 60 * 1000, max: 600 });
const authLimiter = createLimiter({ windowMs: 15 * 60 * 1000, max: 20 });

module.exports = { createLimiter, apiLimiter, authLimiter };
