// ==========================================================
// AiTradeX - Upstox Market Data Controller
// ==========================================================

const {
  UpstoxMarketService,
} = require("./upstox.market.service");

const marketService =
  new UpstoxMarketService();

// ==========================================================
// Parse instrument keys
// ==========================================================

const parseInstrumentKeys = (value) => {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return marketService.getDefaultInstrumentKeys();
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

// ==========================================================
// GET MARKET DATA
// ==========================================================
//
// GET /api/upstox/market-data
//
// Optional:
// ?instrument_key=NSE_EQ|INE002A01018,NSE_EQ|INE040A01034
//
// If instrument_key is omitted, default AiTradeX instruments
// are requested.
// ==========================================================

const getMarketData = async (req, res) => {
  try {
    const instrumentKeys =
      parseInstrumentKeys(
        req.query.instrument_key
      );

    const result =
      await marketService.getMarketQuotes(
        instrumentKeys
      );

    return res.status(200).json(result);
  } catch (error) {
    const statusCode =
      Number.isInteger(error.statusCode) &&
      error.statusCode >= 400 &&
      error.statusCode < 600
        ? error.statusCode
        : 500;

    console.error(
      "[Upstox Market Controller]",
      error.message
    );

    return res.status(statusCode).json({
      success: false,
      code:
        error.code ||
        "UPSTOX_MARKET_DATA_ERROR",
      message:
        error.message ||
        "Unable to load market data.",
    });
  }
};

module.exports = {
  getMarketData,
};
