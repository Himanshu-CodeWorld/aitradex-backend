"use strict";
const express = require("express");
const router = express.Router();
const tradingController = require("./trading.controller");
router.get("/dashboard", tradingController.getDashboard);
router.post("/scanner/run", tradingController.runScanner);
router.get("/scanner/results", tradingController.getScannerResults);
router.post("/entry/analyze", tradingController.analyzeEntry);
router.post("/exit/plan", tradingController.createExitPlan);
router.post("/risk/check", tradingController.checkRisk);
router.post("/backtest/run", tradingController.runBacktest);
// Saved backtest history (all routes inherit the existing /api/trading auth middleware).
router.post("/backtest/history", tradingController.saveBacktest);
router.get("/backtest/history", tradingController.listBacktests);
router.post("/backtest/history/compare", tradingController.compareBacktests);
router.get("/backtest/performance", tradingController.getStrategyPerformance);
router.get("/backtest/history/:id", tradingController.getBacktest);
router.delete("/backtest/history/:id", tradingController.deleteBacktest);
module.exports = router;
