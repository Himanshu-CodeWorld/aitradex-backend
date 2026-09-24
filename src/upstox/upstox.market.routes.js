const express = require('express');
const {
  getMarketData,
} = require('./upstox.market.controller');

const router = express.Router();

// GET /api/upstox/market-data
// Optional:
// ?instrument_key=NSE_EQ|INE002A01018,NSE_EQ|INE040A01034
router.get('/market-data', getMarketData);

module.exports = router;
