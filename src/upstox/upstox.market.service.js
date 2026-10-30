// src/upstox/upstox.market.service.js
// Upstox V3 LTP and Full Market Quotes service.
"use strict";

const axios = require("axios");
const { UPSTOX_CONFIG } = require("./upstox.config");
const { getRuntimeAccessToken } = require("./upstox.token.store");
const { loadInstrumentMaster } = require("./upstox.instruments.service");

const KNOWN_INSTRUMENTS = {
  "NSE_INDEX|Nifty 50": { symbol: "Nifty 50", segment: "NSE_INDEX", exchange: "NSE" },
  "NSE_INDEX|Nifty Bank": { symbol: "Nifty Bank", segment: "NSE_INDEX", exchange: "NSE" },
  "NSE_EQ|INE002A01018": { symbol: "RELIANCE", segment: "NSE_EQ", exchange: "NSE" },
  "NSE_EQ|INE040A01034": { symbol: "HDFCBANK", segment: "NSE_EQ", exchange: "NSE" },
  "NSE_EQ|INE467B01029": { symbol: "TCS", segment: "NSE_EQ", exchange: "NSE" },
  "NSE_EQ|INE009A01021": { symbol: "INFY", segment: "NSE_EQ", exchange: "NSE" },
  "NSE_EQ|INE090A01021": { symbol: "ICICIBANK", segment: "NSE_EQ", exchange: "NSE" },
  "NSE_EQ|INE397D01024": { symbol: "DMART", segment: "NSE_EQ", exchange: "NSE" },
  "NSE_EQ|INE155A01022": { symbol: "TATAMOTORS", segment: "NSE_EQ", exchange: "NSE" },
};

function normalizeAlias(value) {
  return String(value ?? "")
    .trim()
    .replace(/\+/g, " ")
    .replace(/\|/g, ":")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function positiveNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function makeApiError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

class UpstoxMarketService {
  getAccessToken() {
    const envToken =
      process.env.UPSTOX_ACCESS_TOKEN ||
      process.env.UPSTOX_ANALYTICS_TOKEN;

    if (typeof envToken === "string" && envToken.trim()) return envToken.trim();

    const runtimeToken = getRuntimeAccessToken();
    if (runtimeToken) return runtimeToken;

    throw makeApiError(
      "No Upstox access token is available. Complete Upstox login or configure UPSTOX_ACCESS_TOKEN on the backend.",
      503,
      "UPSTOX_TOKEN_NOT_CONFIGURED"
    );
  }

  getDefaultInstrumentKeys() {
    return Object.keys(KNOWN_INSTRUMENTS);
  }

  validateInstrumentKeys(instrumentKeys) {
    if (!Array.isArray(instrumentKeys)) {
      throw makeApiError("instrument_key must be supplied as a list.", 400, "INVALID_INSTRUMENT_KEYS");
    }

    const keys = [...new Set(
      instrumentKeys.map((value) => String(value ?? "").trim()).filter(Boolean)
    )];

    if (!keys.length) throw makeApiError("At least one instrument_key is required.", 400, "INSTRUMENT_KEY_REQUIRED");
    if (keys.length > 500) throw makeApiError("A maximum of 500 instrument keys is allowed per request.", 400, "INSTRUMENT_KEY_LIMIT");
    if (keys.some((key) => key.length > 200)) throw makeApiError("An instrument_key is too long.", 400, "INVALID_INSTRUMENT_KEY");

    return keys;
  }

  async requestQuotes(instrumentKeys, endpoint) {
    const keys = this.validateInstrumentKeys(instrumentKeys);
    const token = this.getAccessToken();

    let response;
    try {
      response = await axios.get(
        `${UPSTOX_CONFIG.marketApiBaseUrl}${endpoint}`,
        {
          params: { instrument_key: keys.join(",") },
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          timeout: UPSTOX_CONFIG.requestTimeoutMs,
        }
      );
    } catch (error) {
      const status = Number(error.response?.status) || 0;
      const upstream = error.response?.data;
      const upstreamMessage =
        upstream?.errors?.[0]?.message ||
        upstream?.message ||
        error.message;

      console.error("[Upstox Market Data] Request failed", {
        endpoint,
        status: status || null,
        code: error.code || null,
        message: upstreamMessage,
      });

      if (status === 401 || status === 403) {
        throw makeApiError(
          "Upstox rejected the access token or its permissions. Reconnect Upstox and verify API access.",
          status,
          status === 403 ? "UPSTOX_ACCESS_FORBIDDEN" : "UPSTOX_TOKEN_INVALID"
        );
      }
      if (status === 429) throw makeApiError("Upstox rate limit reached. Wait briefly before retrying.", 429, "UPSTOX_RATE_LIMIT");
      if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
        throw makeApiError("The Upstox market-data request timed out. Please retry.", 504, "UPSTOX_TIMEOUT");
      }
      throw makeApiError(upstreamMessage || "Unable to fetch market data from Upstox.", 502, "UPSTOX_MARKET_DATA_ERROR");
    }

    const rawData = response?.data?.data;
    if (!rawData || typeof rawData !== "object" || Array.isArray(rawData)) {
      throw makeApiError("Upstox returned an unexpected market-data response.", 502, "UPSTOX_INVALID_RESPONSE");
    }

    let instruments = [];
    try {
      instruments = await loadInstrumentMaster();
      if (!Array.isArray(instruments)) instruments = [];
    } catch (error) {
      console.warn("[Upstox Market Data] Instrument master unavailable:", error.message);
    }

    const instrumentByKey = new Map();
    const aliasToKey = new Map();

    for (const item of instruments) {
      const key = String(item.instrumentKey || item.instrument_key || item.instrument_token || "").trim();
      const symbol = String(item.symbol || item.trading_symbol || "").trim();
      const segment = String(item.segment || item.exchange_segment || "").trim();
      const exchange = String(item.exchange || "").trim();

      if (key) instrumentByKey.set(normalizeAlias(key), item);
      if (key && symbol && segment) aliasToKey.set(normalizeAlias(`${segment}:${symbol}`), key);
      if (key && symbol && exchange) aliasToKey.set(normalizeAlias(`${exchange}:${symbol}`), key);
    }

    for (const [key, item] of Object.entries(KNOWN_INSTRUMENTS)) {
      instrumentByKey.set(normalizeAlias(key), { ...item, instrumentKey: key });
      aliasToKey.set(normalizeAlias(`${item.segment}:${item.symbol}`), key);
      aliasToKey.set(normalizeAlias(`${item.exchange}:${item.symbol}`), key);
    }

    const requested = new Set(keys.map(normalizeAlias));
    const output = {};

    for (const [responseKey, quote] of Object.entries(rawData)) {
      if (!quote || typeof quote !== "object") continue;

      const tokenKey = String(
        quote.instrument_token ||
        quote.instrument_key ||
        quote.instrumentKey ||
        ""
      ).trim();

      const resolved =
        keys.find((key) => normalizeAlias(key) === normalizeAlias(tokenKey)) ||
        keys.find((key) => normalizeAlias(key) === normalizeAlias(responseKey)) ||
        keys.find((key) => normalizeAlias(key) === normalizeAlias(aliasToKey.get(normalizeAlias(responseKey)))) ||
        aliasToKey.get(normalizeAlias(responseKey));

      if (!resolved || !requested.has(normalizeAlias(resolved))) continue;

      const instrument =
        instrumentByKey.get(normalizeAlias(resolved)) ||
        instrumentByKey.get(normalizeAlias(tokenKey)) ||
        {};

      const ohlc = quote.ohlc || {};
      const lastPrice = positiveNumber(quote.last_price ?? quote.lastPrice ?? quote.ltp);
      if (lastPrice === null) continue;

      const closePrice = positiveNumber(
        quote.prev_close_price ??
        quote.close_price ??
        quote.previous_close ??
        ohlc.close ??
        quote.cp
      );

      const change = closePrice !== null ? lastPrice - closePrice : null;
      const changePercent =
        closePrice !== null && closePrice > 0
          ? Number(((change / closePrice) * 100).toFixed(4))
          : null;

      output[resolved] = {
        instrument_key: resolved,
        symbol: quote.symbol || instrument.symbol || instrument.trading_symbol || null,
        name: instrument.name || instrument.symbol || quote.symbol || null,
        last_price: lastPrice,
        close_price: closePrice,
        change,
        change_percent: changePercent,
        volume: positiveNumber(quote.volume ?? ohlc.volume),
        average_price: positiveNumber(quote.average_price),
        total_buy_quantity: positiveNumber(quote.total_buy_quantity),
        total_sell_quantity: positiveNumber(quote.total_sell_quantity),
        ohlc: {
          open: positiveNumber(ohlc.open),
          high: positiveNumber(ohlc.high),
          low: positiveNumber(ohlc.low),
          close: positiveNumber(ohlc.close),
          volume: positiveNumber(ohlc.volume),
        },
        timestamp: quote.timestamp || null,
      };
    }

    const missing = keys.filter((key) => !output[key]);

    console.info("[Upstox Market Data] Quote mapping result", {
      endpoint,
      requested: keys.length,
      returned: Object.keys(output).length,
      missing: missing.length,
      sampleMissing: missing.slice(0, 5),
    });

    return {
      success: true,
      source: "upstox",
      api_version: "v3",
      endpoint,
      timestamp: new Date().toISOString(),
      requested_count: keys.length,
      returned_count: Object.keys(output).length,
      missing_instruments: missing,
      data: output,
    };
  }

  // LTP-only/snapshot method retained for existing app callers.
  async getMarketQuotes(instrumentKeys) {
    return this.requestQuotes(instrumentKeys, "/market-quote/ltp");
  }

  // Full quote method includes volume and previous close for rankings.
  async getFullMarketQuotes(instrumentKeys) {
    return this.requestQuotes(instrumentKeys, "/market-quote/quotes");
  }
}

module.exports = { UpstoxMarketService };
