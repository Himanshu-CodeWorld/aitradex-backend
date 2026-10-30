
"use strict";

const express = require("express");

const upstoxController = require("./upstox.controller");
const upstoxMarketController = require("./upstox.market.controller");
const upstoxReportController = require("./upstox.report.controller");
const upstoxInstrumentsController = require("./upstox.instruments.controller");

const router = express.Router();

// ============================================
// UPSTOX OAUTH LOGIN
// ============================================

// GET /api/upstox/login
router.get("/login", (req, res) => {
  return upstoxController.login(req, res);
});

// GET /api/upstox/callback
router.get("/callback", (req, res) => {
  return upstoxController.callback(req, res);
});

// ============================================
// MARKET DATA
// ============================================

// GET /api/upstox/market-data
//
// Example:
// /api/upstox/market-data?instrument_key=NSE_EQ%7CINE002A01018
//
// Multiple instruments:
// /api/upstox/market-data?instrument_key=NSE_EQ%7CINE002A01018,NSE_EQ%7CINE009A01021

router.get("/market-data", (req, res) => {
  return upstoxMarketController.getMarketData(req, res);
});

// ============================================
// INSTRUMENT MASTER / STOCK SEARCH
// ============================================

// GET /api/upstox/instruments?category=stock&limit=100
// GET /api/upstox/instruments?query=RELIANCE
// GET /api/upstox/instruments?category=index&exchange=NSE
// GET /api/upstox/instruments?category=all&limit=500

router.get("/instruments", (req, res) => {
  return upstoxInstrumentsController.getInstruments(req, res);
});

// ============================================
// AI STOCK REPORT
// ============================================

// GET /api/upstox/report
router.get("/report", (req, res) => {
  return upstoxReportController.getReport(req, res);
});

// ============================================
// EXPORT ROUTER
// ============================================

module.exports = router;
