// ==========================================================
// AiTradeX - Upstox Routes
// ==========================================================
const express = require("express");
const upstoxController = require("./upstox.controller");
const { getMarketData } = require("./upstox.market.controller");
const { getReport } = require("./upstox.report.controller");

const router = express.Router();
router.get("/login", (req, res) => upstoxController.login(req, res));
router.get("/callback", (req, res) => upstoxController.callback(req, res));
router.get("/market-data", getMarketData);
router.get("/report", getReport);
module.exports = router;
