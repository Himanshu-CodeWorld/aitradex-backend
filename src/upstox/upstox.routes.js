
const express = require("express");
const upstoxController = require("./upstox.controller");
const upstoxMarketController = require("./upstox.market.controller");
const upstoxReportController = require("./upstox.report.controller");

const router = express.Router();

router.get("/login", (req, res) =>
  upstoxController.login(req, res)
);

router.get("/callback", (req, res) =>
  upstoxController.callback(req, res)
);

router.get("/market-data", (req, res) =>
  upstoxMarketController.getMarketData(req, res)
);

router.get("/report", (req, res) =>
  upstoxReportController.getReport(req, res)
);

module.exports = router;
