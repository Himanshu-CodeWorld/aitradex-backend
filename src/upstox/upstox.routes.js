// ==========================================================
// AiTradeX - Upstox Routes
// ==========================================================
const express = require("express");
const upstoxController = require("./upstox.controller");
<<<<<<< HEAD
const { getMarketData } = require("./upstox.market.controller");
const { getReport } = require("./upstox.report.controller");

const router = express.Router();
router.get("/login", (req, res) => upstoxController.login(req, res));
router.get("/callback", (req, res) => upstoxController.callback(req, res));
router.get("/market-data", getMarketData);
router.get("/report", getReport);
=======
const upstoxMarketController = require(
  "./upstox.market.controller"
);
const upstoxReportController = require(
  "./upstox.report.controller"
);

const router = express.Router();

// ==========================================================
// OAuth
// ==========================================================

router.get("/login", (req, res) => {
  return upstoxController.login(req, res);
});

router.get("/callback", (req, res) => {
  return upstoxController.callback(req, res);
});

// ==========================================================
// Market Data
// ==========================================================

router.get("/market-data", (req, res) => {
  return upstoxMarketController.getMarketData(req, res);
});

// ==========================================================
// Stock Report
// ==========================================================
// GET /api/upstox/report?symbol=RELIANCE
// Optional:
//   instrument_key=NSE_EQ|INE002A01018
//   isin=INE002A01018
// ==========================================================

router.get("/report", (req, res) => {
  return upstoxReportController.getReport(req, res);
});

>>>>>>> 0026497 (FIX Google AUth)
module.exports = router;
