const { Router } = require("express");
const aiController = require("./ai.controller");
const auth = require("../../middleware/auth");
const { createLimiter } = require("../../middleware/rateLimiter");

const router = Router();
router.use(auth);

const aiLimiter = createLimiter({ windowMs: 60 * 1000, max: 5 });
router.post("/generate-services", aiLimiter, aiController.generateServices);

module.exports = router;
