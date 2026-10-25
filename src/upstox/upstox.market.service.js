// ==========================================================
// AiTradeX - Upstox Market Data Service (V3)
// ==========================================================
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

    if (typeof envToken === "string" && envToken.trim()) {
      return envToken.trim();
    }

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
      throw makeApiError(
        "instrument_key must be supplied as a list.",
        400,
        "INVALID_INSTRUMENT_KEYS"
      );
    }

    const keys = [
      ...new Set(
        instrumentKeys
          .map((value) => String(value ?? "").trim())
          .filter(Boolean)
      ),
    ];

    if (!keys.length) {
      throw makeApiError(
        "At least one instrument_key is required.",
        400,
        "INSTRUMENT_KEY_REQUIRED"
      );
    }

    if (keys.length > 500) {
      throw makeApiError(
        "A maximum of 500 instrument keys is allowed per request.",
        400,
        "INSTRUMENT_KEY_LIMIT"
      );
    }

    if (keys.some((key) => key.length > 200)) {
      throw makeApiError(
        "An instrument_key is too long.",
        400,
        "INVALID_INSTRUMENT_KEY"
      );
    }

    return keys;
  }

  async getMarketQuotes(instrumentKeys) {
    const keys = this.validateInstrumentKeys(instrumentKeys);
    const token = this.getAccessToken();

    let response;
    try {
      response = await axios.get(
        `${UPSTOX_CONFIG.marketApiBaseUrl}/market-quote/ltp`,
        {
          params: { instrument_key: keys.join(",") },
          headers: {
            Accept: "application/json",
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

      // Never log access tokens or request headers.
      console.error("[Upstox Market Data] Request failed", {
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

      if (status === 429) {
        throw makeApiError(
          "Upstox rate limit reached. Wait briefly before retrying.",
          429,
          "UPSTOX_RATE_LIMIT"
        );
      }

      if (
        error.code === "ECONNABORTED" ||
        error.code === "ETIMEDOUT"
      ) {
        throw makeApiError(
          "The Upstox market-data request timed out. Please retry.",
          504,
          "UPSTOX_TIMEOUT"
        );
      }

      throw makeApiError(
        upstreamMessage || "Unable to fetch market data from Upstox.",
        502,
        "UPSTOX_MARKET_DATA_ERROR"
      );
    }

    const rawData = response?.data?.data;
    if (!rawData || typeof rawData !== "object" || Array.isArray(rawData)) {
      throw makeApiError(
        "Upstox returned an unexpected market-data response.",
        502,
        "UPSTOX_INVALID_RESPONSE"
      );
    }

    // Instrument master is useful for resolving response aliases, but it must
    // not prevent direct instrument-key quotes from being returned.
    let instruments = [];
    try {
      instruments = await loadInstrumentMaster();
    } catch (error) {
      console.warn(
        "[Upstox Market Data] Instrument master unavailable; matching direct quote keys:",
        error.message
      );
    }

    const instrumentByKey = new Map();
    const aliasToInstrument = new Map();

    for (const instrument of instruments) {
      const key = String(instrument.instrumentKey || instrument.instrument_key || "").trim();
      const symbol = String(instrument.symbol || instrument.trading_symbol || "").trim();
      const segment = String(instrument.segment || "").trim();
      const exchange = String(instrument.exchange || "").trim();

      if (key) instrumentByKey.set(normalizeAlias(key), instrument);

      if (symbol && segment) {
        aliasToInstrument.set(normalizeAlias(`${segment}:${symbol}`), instrument);
      }
      if (symbol && exchange) {
        aliasToInstrument.set(normalizeAlias(`${exchange}:${symbol}`), instrument);
      }
    }

    // Static aliases cover the app's fixed dashboard watchlist even if the
    // downloaded catalogue has a schema variation and currently has no stocks.
    for (const [key, instrument] of Object.entries(KNOWN_INSTRUMENTS)) {
      aliasToInstrument.set(
        normalizeAlias(`${instrument.segment}:${instrument.symbol}`),
        { ...instrument, instrumentKey: key }
      );
      aliasToInstrument.set(
        normalizeAlias(`${instrument.exchange}:${instrument.symbol}`),
        { ...instrument, instrumentKey: key }
      );
      instrumentByKey.set(normalizeAlias(key), {
        ...instrument,
        instrumentKey: key,
      });
    }

    const requestedKeyByAlias = new Map();
    const instrumentByRequestedKey = new Map();

    for (const requestedKey of keys) {
      const normalizedKey = normalizeAlias(requestedKey);
      const instrument =
        instrumentByKey.get(normalizedKey) ||
        aliasToInstrument.get(normalizedKey) ||
        null;

      instrumentByRequestedKey.set(requestedKey, instrument);

      requestedKeyByAlias.set(normalizedKey, requestedKey);

      if (instrument) {
        const symbol = String(instrument.symbol || instrument.trading_symbol || "");
        const segment = String(instrument.segment || "");
        const exchange = String(instrument.exchange || "");

        if (symbol && segment) {
          requestedKeyByAlias.set(
            normalizeAlias(`${segment}:${symbol}`),
            requestedKey
          );
        }
        if (symbol && exchange) {
          requestedKeyByAlias.set(
            normalizeAlias(`${exchange}:${symbol}`),
            requestedKey
          );
        }
      }
    }

    const quotesByRequestedKey = new Map();

    for (const [responseKey, quote] of Object.entries(rawData)) {
      if (!quote || typeof quote !== "object" || Array.isArray(quote)) {
        continue;
      }

      // Upstox versions may return the requested key as the object key, an
      // exchange:symbol alias, or the instrument key inside instrument_token.
      const quoteInstrumentKey =
        quote.instrument_key ||
        quote.instrumentKey ||
        quote.instrument_token ||
        quote.instrumentToken ||
        "";

      const candidateAliases = [
        responseKey,
        quoteInstrumentKey,
      ].filter(Boolean);

      let requestedKey = null;

      for (const alias of candidateAliases) {
        requestedKey = requestedKeyByAlias.get(normalizeAlias(alias)) || null;
        if (requestedKey) break;

        const aliasInstrument = aliasToInstrument.get(normalizeAlias(alias));
        if (aliasInstrument) {
          const aliasKey = String(
            aliasInstrument.instrumentKey || aliasInstrument.instrument_key || ""
          );
          requestedKey = keys.find(
            (key) => normalizeAlias(key) === normalizeAlias(aliasKey)
          ) || null;
          if (requestedKey) break;
        }
      }

      // If the response object key is a known alias, resolve it to its
      // canonical Upstox instrument key.
      if (!requestedKey) {
        const aliasInstrument = aliasToInstrument.get(normalizeAlias(responseKey));
        if (aliasInstrument) {
          const aliasKey = String(
            aliasInstrument.instrumentKey || aliasInstrument.instrument_key || ""
          );
          requestedKey = keys.find(
            (key) => normalizeAlias(key) === normalizeAlias(aliasKey)
          ) || null;
        }
      }

      // Direct quote keys should always work, even if no catalogue row exists.
      if (!requestedKey) {
        requestedKey = keys.find(
          (key) =>
            normalizeAlias(key) === normalizeAlias(responseKey) ||
            (quoteInstrumentKey &&
              normalizeAlias(key) === normalizeAlias(quoteInstrumentKey))
        ) || null;
      }

      if (requestedKey) {
        quotesByRequestedKey.set(requestedKey, quote);
      }
    }

    const data = {};

    for (const requestedKey of keys) {
      const quote = quotesByRequestedKey.get(requestedKey);
      if (!quote) continue;

      const instrument =
        instrumentByRequestedKey.get(requestedKey) ||
        KNOWN_INSTRUMENTS[requestedKey] ||
        null;

      const lastPrice = positiveNumber(
        quote.last_price ?? quote.lastPrice ?? quote.ltp
      );

      if (lastPrice === null) continue;

      const closePrice = positiveNumber(
        quote.cp ?? quote.close_price ?? quote.previous_close ?? quote.previousClose
      );
      const hasClose = closePrice !== null;
      const change = hasClose ? lastPrice - closePrice : null;
      const changePercent = hasClose ? (change / closePrice) * 100 : null;

      data[requestedKey] = {
        instrument_key: requestedKey,
        symbol: instrument?.symbol || instrument?.trading_symbol || null,
        name: instrument?.name || instrument?.symbol || null,
        last_price: lastPrice,
        close_price: closePrice,
        change,
        change_percent: Number.isFinite(changePercent)
          ? Number(changePercent.toFixed(4))
          : null,
        ltq: positiveNumber(quote.ltq),
        volume: positiveNumber(quote.volume),
      };
    }

    const missing = keys.filter(
      (key) => !Object.prototype.hasOwnProperty.call(data, key)
    );

    console.info("[Upstox Market Data] Quote mapping result", {
      requested: keys.length,
      returned: Object.keys(data).length,
      missing: missing.length,
      sampleMissing: missing.slice(0, 5),
    });

    return {
      success: true,
      source: "upstox",
      api_version: "v3",
      timestamp: new Date().toISOString(),
      requested_count: keys.length,
      returned_count: Object.keys(data).length,
      missing_instruments: missing,
      data,
    };
  }
}

module.exports = { UpstoxMarketService };
