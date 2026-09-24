const {
  UpstoxMarketService,
} = require('./upstox.market.service');

const marketService = new UpstoxMarketService();

const parseInstrumentKeys = (value) => {
  if (!value) return marketService.getDefaultInstrumentKeys();

  if (Array.isArray(value)) {
    return value;
  }

  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const getMarketData = async (req, res, next) => {
  try {
    const instrumentKeys = parseInstrumentKeys(
      req.query.instrument_key
    );

    const result = await marketService.getMarketQuotes(
      instrumentKeys
    );

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getMarketData,
};
