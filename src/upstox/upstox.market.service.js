// ==========================================================
// AiTradeX - Upstox Market Data Service (V3)
// ==========================================================

const axios = require("axios");
const { UPSTOX_CONFIG } = require("./upstox.config");
const { getRuntimeAccessToken } = require("./upstox.token.store");

const LIVE_MARKET_ASSETS = Object.freeze({
  NIFTY: { name: "NIFTY 50", instrumentKey: "NSE_INDEX|Nifty 50" },
  RELIANCE: { name: "Reliance Industries", instrumentKey: "NSE_EQ|INE002A01018" },
  HDFCBANK: { name: "HDFC Bank", instrumentKey: "NSE_EQ|INE040A01034" },
  NIFTYBEES: { name: "NIFTYBEES", instrumentKey: "NSE_EQ|INF204KB14I2" },
  TCS: { name: "TCS", instrumentKey: "NSE_EQ|INE467B01029" },
  INFY: { name: "Infosys", instrumentKey: "NSE_EQ|INE009A01021" },
  ICICIBANK: { name: "ICICI Bank", instrumentKey: "NSE_EQ|INE090A01021" },
  BHARTIARTL: { name: "Bharti Airtel", instrumentKey: "NSE_EQ|INE397D01024" },
});

class UpstoxMarketService {
  getAccessToken() {
    const envToken = process.env.UPSTOX_ACCESS_TOKEN || process.env.UPSTOX_ANALYTICS_TOKEN;
    if (typeof envToken === "string" && envToken.trim()) return envToken.trim();

    const runtimeToken = getRuntimeAccessToken();
    if (runtimeToken) return runtimeToken;

    const error = new Error(
      "No Upstox access token is available. Complete Upstox login or configure UPSTOX_ACCESS_TOKEN on the backend."
    );
    error.statusCode = 503;
    error.code = "UPSTOX_TOKEN_NOT_CONFIGURED";
    throw error;
  }

  getDefaultInstrumentKeys() {
    return Object.values(LIVE_MARKET_ASSETS).map((asset) => asset.instrumentKey);
  }

  validateInstrumentKeys(instrumentKeys) {
    if (!Array.isArray(instrumentKeys)) {
      const error = new Error("instrument_key must be supplied as a list.");
      error.statusCode = 400;
      error.code = "INVALID_INSTRUMENT_KEYS";
      throw error;
    }

    const keys = [...new Set(instrumentKeys.map((value) => String(value || "").trim()).filter(Boolean))];
    if (!keys.length) {
      const error = new Error("At least one instrument_key is required.");
      error.statusCode = 400;
      error.code = "INSTRUMENT_KEY_REQUIRED";
      throw error;
    }
    if (keys.length > 500) {
      const error = new Error("A maximum of 500 instrument keys is allowed per request.");
      error.statusCode = 400;
      error.code = "INSTRUMENT_KEY_LIMIT";
      throw error;
    }
    if (keys.some((key) => key.length > 200)) {
      const error = new Error("An instrument_key is too long.");
      error.statusCode = 400;
      error.code = "INVALID_INSTRUMENT_KEY";
      throw error;
    }
    return keys;
  }

  async getMarketQuotes(instrumentKeys) {
    const keys = this.validateInstrumentKeys(instrumentKeys);
    const token = this.getAccessToken();

    let response;
    try {
      response = await axios.get(`${UPSTOX_CONFIG.marketApiBaseUrl}/market-quote/ltp`, {
        params: { instrument_key: keys.join(",") },
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        timeout: UPSTOX_CONFIG.requestTimeoutMs,
        validateStatus: (status) => status >= 200 && status < 300,
      });
    } catch (error) {
      const status = Number(error.response?.status) || 0;
      const upstream = error.response?.data;
      // Do not log tokens or request headers.
      console.error("[Upstox Market Data] Request failed", {
        status: status || null,
        code: error.code || null,
        message: upstream?.errors?.[0]?.message || upstream?.message || error.message,
      });

      let apiError;
      if (status === 401 || status === 403) {
        apiError = new Error("Upstox rejected the access token or its permissions. Reconnect Upstox and verify API access.");
        apiError.statusCode = status === 403 ? 403 : 401;
        apiError.code = status === 403 ? "UPSTOX_ACCESS_FORBIDDEN" : "UPSTOX_TOKEN_INVALID";
      } else if (status === 429) {
        apiError = new Error("Upstox rate limit reached. Wait briefly before retrying.");
        apiError.statusCode = 429;
        apiError.code = "UPSTOX_RATE_LIMIT";
      } else if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
        apiError = new Error("The Upstox market-data request timed out. Please retry.");
        apiError.statusCode = 504;
        apiError.code = "UPSTOX_TIMEOUT";
      } else {
        apiError = new Error(upstream?.errors?.[0]?.message || upstream?.message || "Unable to fetch market data from Upstox.");
        apiError.statusCode = status >= 400 && status < 600 ? 502 : 502;
        apiError.code = "UPSTOX_MARKET_DATA_ERROR";
      }
      throw apiError;
    }

    const rawData = response?.data?.data;
    if (!rawData || typeof rawData !== "object" || Array.isArray(rawData)) {
      const error = new Error("Upstox returned an unexpected market-data response.");
      error.statusCode = 502;
      error.code = "UPSTOX_INVALID_RESPONSE";
      throw error;
    }

    const data = {};
    for (const [responseKey, quote] of Object.entries(rawData)) {
      if (!quote || typeof quote !== "object") continue;

      const lastPrice = Number(quote.last_price);
      if (!Number.isFinite(lastPrice) || lastPrice < 0) continue;

      const closeRaw = quote.cp ?? quote.close_price ?? quote.previous_close;
      const closePrice = closeRaw === null || closeRaw === undefined ? NaN : Number(closeRaw);
      const hasClose = Number.isFinite(closePrice) && closePrice > 0;
      const change = hasClose ? lastPrice - closePrice : null;
      const changePercent = hasClose ? (change / closePrice) * 100 : null;
      // Upstox response keys normally preserve the requested instrument key.
      // Keep that stable key instead of relying on optional response fields.
      const instrumentKey = String(responseKey);
      const asset = Object.values(LIVE_MARKET_ASSETS).find((item) => item.instrumentKey === instrumentKey);

      data[instrumentKey] = {
        instrument_key: instrumentKey,
        symbol: asset ? Object.keys(LIVE_MARKET_ASSETS).find((symbol) => LIVE_MARKET_ASSETS[symbol] === asset) : null,
        name: asset?.name || null,
        last_price: lastPrice,
        close_price: hasClose ? closePrice : null,
        ltq: quote.ltq == null || !Number.isFinite(Number(quote.ltq)) ? null : Number(quote.ltq),
        volume: quote.volume == null || !Number.isFinite(Number(quote.volume)) ? null : Number(quote.volume),
        change,
        change_percent: Number.isFinite(changePercent) ? Number(changePercent.toFixed(4)) : null,
      };
    }

    return {
      success: true,
      source: "upstox",
      api_version: "v3",
      timestamp: new Date().toISOString(),
      requested_count: keys.length,
      returned_count: Object.keys(data).length,
      missing_instruments: keys.filter((key) => !Object.prototype.hasOwnProperty.call(data, key)),
      data,
    };
  }
}

module.exports = { UpstoxMarketService, LIVE_MARKET_ASSETS };
