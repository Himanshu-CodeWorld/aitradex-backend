const express = require("express");

const coinController = require("../controllers/coin.controller");
const firebaseAuth = require("../middleware/firebaseAuth.middleware");

const router = express.Router();

// ==========================================================
// AiTradeX Coins
// ==========================================================
//
// 1 Coin = ₹1
// 1 Stock Intelligence unlock = 100 Coins
//
// All routes require a valid Firebase ID token.
//
// Header:
// Authorization: Bearer <Firebase ID Token>
// ==========================================================

router.get(
  "/balance",
  firebaseAuth,
  coinController.getBalance
);

router.get(
  "/history",
  firebaseAuth,
  coinController.getHistory
);

router.post(
  "/unlock-stock",
  firebaseAuth,
  coinController.unlockStock
);

router.get(
  "/stock/:symbol",
  firebaseAuth,
  coinController.checkStockUnlock
);

module.exports = router;
