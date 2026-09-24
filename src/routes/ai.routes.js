// src/routes/ai.routes.js

const express = require("express");

const {
  chatWithAi,
} = require("../controllers/ai.controller");

const firebaseAuthMiddleware = require(
  "../middleware/firebaseAuth.middleware"
);

// ==========================================================
// AI ROUTER
// ==========================================================

const router = express.Router();

// ==========================================================
// POST /api/ai/chat
//
// Authentication:
// Firebase ID Token required
//
// Header:
// Authorization: Bearer <firebase-id-token>
//
// Body:
// {
//   "message": "What is an ETF?",
//   "history": []
// }
// ==========================================================

router.post(
  "/chat",
  firebaseAuthMiddleware,
  chatWithAi
);

// ==========================================================
// EXPORT ROUTER
// ==========================================================

module.exports = router;