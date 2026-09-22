const express = require("express");

const router = express.Router();

const {
  sendPhoneOtp,
  verifyPhoneOtp,
  resendPhoneOtp,
} = require("../controllers/auth.controller");

/*
|--------------------------------------------------------------------------
| Auth Routes
|--------------------------------------------------------------------------
*/

console.log("");
console.log("====================================");
console.log("Auth Routes Loaded");
console.log("====================================");

/**
 * Send phone OTP
 *
 * POST /api/auth/send-phone-otp
 */
router.post(
  "/send-phone-otp",
  sendPhoneOtp
);

/**
 * Verify phone OTP
 *
 * POST /api/auth/verify-phone-otp
 */
router.post(
  "/verify-phone-otp",
  verifyPhoneOtp
);

/**
 * Resend phone OTP
 *
 * POST /api/auth/resend-phone-otp
 */
router.post(
  "/resend-phone-otp",
  resendPhoneOtp
);

module.exports = router;