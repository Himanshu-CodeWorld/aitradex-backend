const { UpstoxMarketService } = require("./upstox.market.service");
const marketService = new UpstoxMarketService();

function parseInstrumentKeys(value) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return marketService.getDefaultInstrumentKeys();
  }
  const values = Array.isArray(value) ? value : [value];
  return [...new Set(values.flatMap((item) => String(item).split(",")).map((key) => key.trim()).filter(Boolean))];
}

async function getMarketData(req, res) {
  try {
    const instrumentKeys = await parseInstrumentKeys(req.query.instrument_key);
    if (!instrumentKeys.length) {
      return res.status(400).json({ success: false, code: "INSTRUMENT_KEY_REQUIRED", message: "No instruments were found." });
    }
    const result = await marketService.getMarketQuotes(instrumentKeys);
    res.set("Cache-Control", "no-store");
    return res.status(200).json(result);
  } catch (error) {
    const statusCode = Number.isInteger(error.statusCode) && error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500;
    console.error("[Upstox Market Controller]", {
      code: error.code || "UPSTOX_MARKET_DATA_ERROR",
      statusCode,
      message: error.message || "Unknown error",
    });
    return res.status(statusCode).json({
      success: false,
      code: error.code || "UPSTOX_MARKET_DATA_ERROR",
      message: error.message || "Unable to load market data.",
      timestamp: new Date().toISOString(),
    });
  }
}

module.exports = { getMarketData, parseInstrumentKeys };
