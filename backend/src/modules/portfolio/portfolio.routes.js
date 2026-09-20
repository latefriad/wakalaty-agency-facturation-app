const { Router } = require("express");
const portfolioController = require("./portfolio.controller");
const auth = require("../../middleware/auth");
const authorize = require("../../middleware/authorize");
const validate = require("../../middleware/validate");
const { createPortfolioSchema, updatePortfolioSchema } = require("./portfolio.schema");

const router = Router();
router.use(auth);

router.get("/", portfolioController.list);
router.get("/:id", portfolioController.getById);
router.post("/", authorize("ADMIN"), validate(createPortfolioSchema), portfolioController.create);
router.put("/:id", authorize("ADMIN"), validate(updatePortfolioSchema), portfolioController.update);
router.delete("/:id", authorize("ADMIN"), portfolioController.remove);

module.exports = router;
