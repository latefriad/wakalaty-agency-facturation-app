const { Router } = require("express");
const auth = require("../../middleware/auth");
const authorize = require("../../middleware/authorize");
const { success } = require("../../utils/response");
const { globalSearch } = require("./search.service");

const router = Router();
router.use(auth);
// La recherche renvoie des totaux de factures et contrats : mêmes rôles que
// la lecture des factures (le front la masque déjà pour les employés).
router.use(authorize("ADMIN", "ACCOUNTANT"));

router.get("/", async (req, res, next) => {
  try {
    success(res, await globalSearch(req.agencyId, req.query.q));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
