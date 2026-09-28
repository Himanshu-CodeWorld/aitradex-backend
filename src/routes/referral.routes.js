const express = require("express");

const authMiddleware = require("../middleware/firebaseAuth.middleware");

const {
  getMyReferral,
  validateReferral,
  applyReferral,
} = require("../controllers/referral.controller");

const router = express.Router();

// ==========================================================
// AiTradeX Referral / Invite System
// ==========================================================
//
// All routes require:
// Authorization: Bearer <Firebase ID Token>
//
// GET  /api/referrals/me
// GET  /api/referrals/validate/:code
// POST /api/referrals/apply
// ==========================================================

router.get(
  "/me",
  authMiddleware,
  getMyReferral,
);

router.get(
  "/validate/:code",
  authMiddleware,
  validateReferral,
);

router.post(
  "/apply",
  authMiddleware,
  applyReferral,
);

module.exports = router;
