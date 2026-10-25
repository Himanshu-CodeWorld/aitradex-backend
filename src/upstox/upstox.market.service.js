// ==========================================================
// AiTradeX - Upstox Market Data Service (V3)
// ==========================================================

const axios = require("axios");
const { UPSTOX_CONFIG } = require("./upstox.config");
const { getRuntimeAccessToken } = require("./upstox.token.store");
const { loadInstrumentMaster } = require("./upstox.instruments.service");

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
    // Dashboard watchlist. Keep the keys on the backend; Flutter can request
    // quotes without downloading the complete instrument master.
    return [
      "NSE_INDEX|Nifty 50",
      "NSE_INDEX|Nifty Bank",
      "NSE_EQ|INE002A01018", // RELIANCE
      "NSE_EQ|INE040A01034", // HDFCBANK
      "NSE_EQ|INE467B01029", // TCS
      "NSE_EQ|INE009A01021", // INFY
      "NSE_EQ|INE090A01021", // ICICIBANK
      "NSE_EQ|INE397D01024", // DMART
      "NSE_EQ|INE155A01022", // TATAMOTORS
    ];
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

    // Upstox v3 LTP often returns keys like "NSE_EQ:RELIANCE", not
    // the requested instrument key "NSE_EQ|INE002A01018". Resolve each
    // response alias through the instrument master and return data keyed by
    // the exact key requested by Flutter.
    const instruments = await loadInstrumentMaster();
    const byInstrumentKey = new Map();
    const byResponseAlias = new Map();

    const normalizeAlias = (value) =>
      String(value || "")
        .trim()
        .replace(/\+/g, " ")
        .replace(/\|/g, ":")
        .replace(/\s+/g, " ")
        .toLowerCase();

    for (const instrument of instruments) {
      byInstrumentKey.set(String(instrument.instrumentKey), instrument);

      const segment = String(instrument.segment || "");
      const symbol = String(instrument.symbol || "");
      if (segment && symbol) {
        byResponseAlias.set(normalizeAlias(`${segment}:${symbol}`), instrument);
      }
      // Some response variants use exchange:symbol instead of segment:symbol.
      const exchange = String(instrument.exchange || "");
      if (exchange && symbol) {
        byResponseAlias.set(normalizeAlias(`${exchange}:${symbol}`), instrument);
      }
    }

    const rawByAlias = new Map();
    for (const [responseKey, quote] of Object.entries(rawData)) {
      rawByAlias.set(normalizeAlias(responseKey), { responseKey, quote });
    }

    const data = {};
    for (const requestedKey of keys) {
      const instrument = byInstrumentKey.get(requestedKey);
      const aliases = [];
      if (instrument) {
        if (instrument.segment && instrument.symbol) {
          aliases.push(`${instrument.segment}:${instrument.symbol}`);
        }
        if (instrument.exchange && instrument.symbol) {
          aliases.push(`${instrument.exchange}:${instrument.symbol}`);
        }
      }
      // Preserve support for providers/response versions that return the
      // original instrument key directly.
      aliases.push(requestedKey);

      let matched = null;
      for (const alias of aliases) {
        matched = rawByAlias.get(normalizeAlias(alias));
        if (matched) break;
      }

      // A direct key can still be resolved even if the catalogue did not
      // include that particular instrument.
      if (!matched) {
        matched = rawByAlias.get(normalizeAlias(requestedKey));
      }
      if (!matched) continue;

      const quote = matched.quote;
      if (!quote || typeof quote !== "object") continue;

      const lastPrice = Number(quote.last_price ?? quote.lastPrice ?? quote.ltp);
      if (!Number.isFinite(lastPrice) || lastPrice < 0) continue;

      const closeRaw = quote.cp ?? quote.close_price ?? quote.previous_close;
      const closePrice = closeRaw === null || closeRaw === undefined ? NaN : Number(closeRaw);
      const hasClose = Number.isFinite(closePrice) && closePrice > 0;
      const change = hasClose ? lastPrice - closePrice : null;
      const changePercent = hasClose ? (change / closePrice) * 100 : null;

      data[requestedKey] = {
        instrument_key: requestedKey,
        symbol: instrument?.symbol || null,
        name: instrument?.name || null,
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

module.exports = { UpstoxMarketService };
