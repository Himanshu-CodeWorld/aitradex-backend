const express = require("express");
const { getMarketData } = require("./upstox.market.controller");

const router = express.Router();
router.get("/market-data", getMarketData);
module.exports = router;
