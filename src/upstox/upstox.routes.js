
 // ==========================================================
// AiTradeX - Upstox Routes
// ==========================================================

const express = require("express");
const upstoxController = require("./upstox.controller");
const upstoxMarketController = require("./upstox.market.controller");
const upstoxReportController = require("./upstox.report.controller");

const router = express.Router();

// ==========================================================
// OAuth Login
// ==========================================================

// GET /api/upstox/login
router.get("/login", (req, res) => {
  return upstoxController.login(req, res);
});

// GET /api/upstox/callback
router.get("/callback", (req, res) => {
  return upstoxController.callback(req, res);
});

// ==========================================================
// Market Data
// ==========================================================

// GET /api/upstox/market-data
router.get("/market-data", (req, res) => {
  return upstoxMarketController.getMarketData(req, res);
});

// ==========================================================
// Stock Report
// ==========================================================

// GET /api/upstox/report?symbol=RELIANCE
// Optional query parameters:
// instrument_key=NSE_EQ|INE002A01018
// isin=INE002A01018

router.get("/report", (req, res) => {
  return upstoxReportController.getReport(req, res);
});

// ==========================================================
// Export Router
// ==========================================================

module.exports = router;
