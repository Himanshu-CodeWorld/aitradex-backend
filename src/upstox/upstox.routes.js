// ==========================================================
// AiTradeX - Upstox Routes
// ==========================================================

const express = require("express");

const upstoxController = require("./upstox.controller");
const upstoxMarketController = require(
  "./upstox.market.controller"
);

// ==========================================================
// Router
// ==========================================================

const router = express.Router();

// ==========================================================
// OAuth Login
// ==========================================================
//
// GET /api/upstox/login
//
// Opens the Upstox OAuth authorization page.
//
// ==========================================================

router.get(
  "/login",
  (req, res) => {
    return upstoxController.login(req, res);
  }
);

// ==========================================================
// OAuth Callback
// ==========================================================
//
// GET /api/upstox/callback
//
// Upstox redirects here after authorization.
//
// ==========================================================

router.get(
  "/callback",
  (req, res) => {
    return upstoxController.callback(req, res);
  }
);

// ==========================================================
// MARKET DATA
// ==========================================================
//
// GET /api/upstox/market-data
//
// Example:
//
// /api/upstox/market-data
//
// Optional:
//
// /api/upstox/market-data?instrument_key=NSE_EQ|INE002A01018
//
// Multiple:
//
// /api/upstox/market-data?instrument_key=NSE_EQ|INE002A01018,NSE_EQ|INE040A01034
//
// The Flutter Invest screen uses this endpoint.
//
// ==========================================================

router.get(
  "/market-data",
  (req, res) => {
    return upstoxMarketController.getMarketData(
      req,
      res
    );
  }
);

// ==========================================================
// Export
// ==========================================================

module.exports = router;