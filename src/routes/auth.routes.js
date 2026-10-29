const express = require("express");

const router = express.Router();

// Phone OTP handlers remain in the existing auth controller.
const {
  sendPhoneOtp,
  verifyPhoneOtp,
  resendPhoneOtp,
} = require("../controllers/auth.controller");

// Google profile synchronization has its own controller.
const { googleAuth } = require("../controllers/googleAuth.controller");
const firebaseAuthMiddleware = require("../middleware/firebaseAuth.middleware");

console.log("[AuthRoutes] Auth routes loaded");

// Flutter sends a Firebase ID token in Authorization: Bearer <token>.
router.post("/google", firebaseAuthMiddleware, googleAuth);

router.post("/send-phone-otp", sendPhoneOtp);
router.post("/verify-phone-otp", verifyPhoneOtp);
router.post("/resend-phone-otp", resendPhoneOtp);

module.exports = router;
