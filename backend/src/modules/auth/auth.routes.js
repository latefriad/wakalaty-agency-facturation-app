const { Router } = require("express");
const authController = require("./auth.controller");
const auth = require("../../middleware/auth");
const validate = require("../../middleware/validate");
const { authLimiter } = require("../../middleware/rateLimiter");
const { registerSchema, loginSchema, updateProfileSchema, changePasswordSchema, acceptInvitationSchema } = require("./auth.schema");

const router = Router();

router.post("/register", authLimiter, validate(registerSchema), authController.register);
router.post("/login", authLimiter, validate(loginSchema), authController.login);
// Invitation : routes publiques (l'invité n'a pas encore de compte), token à
// usage unique/expirant dans l'URL, même rate-limit que login/register.
router.get("/invitation/:token", authLimiter, authController.invitationInfo);
router.post("/invitation/:token/accept", authLimiter, validate(acceptInvitationSchema), authController.acceptInvitation);
router.get("/me", auth, authController.getMe);
router.put("/me", auth, validate(updateProfileSchema), authController.updateProfile);
router.post("/change-password", auth, validate(changePasswordSchema), authController.changePassword);

module.exports = router;
