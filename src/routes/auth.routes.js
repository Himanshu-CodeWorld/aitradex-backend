const express = require("express");
const router = express.Router();

const authController = require("../controllers/auth.controller");
const authMiddleware = require("../middleware/auth.middleware");
const firebaseAuthMiddleware = require("../middleware/firebaseAuth.middleware");
const {
  googleAuth,
} = require("../controllers/googleAuth.controller");

console.log("====================================");
console.log("Auth Routes Loaded");
console.log("====================================");

router.post(
  "/google-sync",
  firebaseAuthMiddleware,
  googleAuth
);

// ==========================================================
// PHONE OTP ROUTES
// ==========================================================

// Send Phone OTP
router.post(
  "/send-phone-otp",
  authController.sendPhoneOtp
);

// Verify Phone OTP
router.post(
  "/verify-phone-otp",
  authController.verifyPhoneOtp
);

// Resend Phone OTP
router.post(
  "/resend-phone-otp",
  authController.resendPhoneOtp
);

// ==========================================================
// CAPTCHA
// ==========================================================

router.post("/check-email", authController.checkEmail);

router.post(
  "/verify-turnstile",
  authController.verifyTurnstile
);

// ==========================================================
// AUTH
// ==========================================================

// Signup
router.post(
  "/signup",
  authController.signup
);

// Login
router.post(
  "/login",
  authController.login
);

// Profile
router.get(
  "/profile",
  authMiddleware,
  authController.getProfile
);

module.exports = router;