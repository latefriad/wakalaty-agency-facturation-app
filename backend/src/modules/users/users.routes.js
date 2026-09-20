const { Router } = require("express");
const usersController = require("./users.controller");
const auth = require("../../middleware/auth");
const authorize = require("../../middleware/authorize");
const validate = require("../../middleware/validate");
const { createUserSchema, updateUserSchema, inviteUserSchema } = require("./users.schema");

const router = Router();
router.use(auth);
router.use(authorize("ADMIN"));

router.get("/", usersController.list);
router.post("/", validate(createUserSchema), usersController.create);
router.patch("/:id", validate(updateUserSchema), usersController.update);

// Invitations : création de compte différée, mot de passe choisi par l'invité.
router.post("/invite", validate(inviteUserSchema), usersController.invite);
router.get("/invitations", usersController.listInvitations);
router.delete("/invitations/:id", usersController.revokeInvitation);

module.exports = router;
