"use strict";

const crypto = require("crypto");
const { loadInstrumentMaster } = require("../../upstox/upstox.instruments.service");
const { UpstoxMarketService } = require("../../upstox/upstox.market.service");

const marketDataService = new UpstoxMarketService();
const MAX_SCAN_INSTRUMENTS = 100;
const CACHE_TTL_MS = 15 * 60 * 1000;
const latestScansByUser = new Map();

function apiError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function normalize(value) {
  return String(value ?? "").trim().toUpperCase();
}

function finiteNumber(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

function validateRequest({ symbols, instrumentKeys, exchange, minChangePercent, minVolume, limit }) {
  const normalizedExchange = normalize(exchange || "NSE");
  if (!["NSE", "BSE"].includes(normalizedExchange)) {
    throw apiError("exchange must be NSE or BSE.", 400, "INVALID_EXCHANGE");
  }

  const requestedSymbols = Array.isArray(symbols)
    ? [...new Set(symbols.map(normalize).filter(Boolean))]
    : [];
  const requestedKeys = Array.isArray(instrumentKeys)
    ? [...new Set(instrumentKeys.map((value) => String(value ?? "").trim()).filter(Boolean))]
    : [];

  if (requestedSymbols.length === 0 && requestedKeys.length === 0) {
    throw apiError("Provide at least one symbol or instrumentKey to scan.", 400, "SCAN_UNIVERSE_REQUIRED");
  }
  if (requestedSymbols.length > MAX_SCAN_INSTRUMENTS || requestedKeys.length > MAX_SCAN_INSTRUMENTS) {
    throw apiError(`A maximum of ${MAX_SCAN_INSTRUMENTS} instruments can be scanned per request.`, 400, "SCAN_LIMIT_EXCEEDED");
  }

  const changeThreshold = finiteNumber(minChangePercent, 1);
  const volumeThreshold = finiteNumber(minVolume, 0);
  const resultLimit = finiteNumber(limit, 30);

  if (!Number.isFinite(changeThreshold) || changeThreshold < 0 || changeThreshold > 20) {
    throw apiError("minChangePercent must be between 0 and 20.", 400, "INVALID_CHANGE_THRESHOLD");
  }
  if (!Number.isFinite(volumeThreshold) || volumeThreshold < 0) {
    throw apiError("minVolume must be zero or greater.", 400, "INVALID_VOLUME_THRESHOLD");
  }
  if (!Number.isInteger(resultLimit) || resultLimit < 1 || resultLimit > 50) {
    throw apiError("limit must be an integer between 1 and 50.", 400, "INVALID_RESULT_LIMIT");
  }

  return {
    exchange: normalizedExchange,
    symbols: requestedSymbols,
    instrumentKeys: requestedKeys,
    minChangePercent: changeThreshold,
    minVolume: volumeThreshold,
    limit: resultLimit,
  };
}

function evaluateQuotes(instruments, quoteData, filters) {
  const results = [];
  const missingQuotes = [];

  for (const instrument of instruments) {
    const key = instrument.instrumentKey || instrument.instrument_key;
    const quote = quoteData?.[key];
    if (!quote) {
      missingQuotes.push(key);
      continue;
    }

    const ltp = Number(quote.last_price);
    const changePercent = Number(quote.change_percent);
    const volume = Number(quote.volume ?? 0);

    if (!Number.isFinite(ltp) || ltp <= 0 || !Number.isFinite(changePercent)) {
      missingQuotes.push(key);
      continue;
    }
    if (!Number.isFinite(volume) || volume < filters.minVolume) continue;

    let status = "NEUTRAL";
    let reason = "Price movement is below the configured threshold.";
    if (changePercent >= filters.minChangePercent) {
      status = "WATCH_UP";
      reason = `Price is up ${changePercent.toFixed(2)}% versus the previous close.`;
    } else if (changePercent <= -filters.minChangePercent) {
      status = "WATCH_DOWN";
      reason = `Price is down ${Math.abs(changePercent).toFixed(2)}% versus the previous close.`;
    }

    results.push({
      instrumentKey: key,
      symbol: instrument.symbol || quote.symbol || null,
      name: instrument.name || quote.name || instrument.symbol || null,
      exchange: instrument.exchange || filters.exchange,
      ltp,
      previousClose: quote.close_price ?? null,
      change: quote.change ?? null,
      changePercent: Number(changePercent.toFixed(4)),
      volume,
      averagePrice: quote.average_price ?? null,
      open: quote.ohlc?.open ?? null,
      high: quote.ohlc?.high ?? null,
      low: quote.ohlc?.low ?? null,
      status,
      reason,
      timestamp: quote.timestamp || null,
    });
  }

  results.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
  return { results: results.slice(0, filters.limit), missingQuotes };
}

async function runScanner({ userId, ...rawFilters }) {
  if (!userId || typeof userId !== "string") {
    throw apiError("Authenticated user is required.", 401, "USER_CONTEXT_MISSING");
  }

  const filters = validateRequest(rawFilters);
  const allInstruments = await loadInstrumentMaster();
  const symbolSet = new Set(filters.symbols);
  const keySet = new Set(filters.instrumentKeys);

  const selectedInstruments = allInstruments.filter((instrument) => {
    if (instrument.category !== "stock") return false;
    if (normalize(instrument.exchange) !== filters.exchange) return false;
    return (
      symbolSet.has(normalize(instrument.symbol || instrument.trading_symbol)) ||
      keySet.has(String(instrument.instrumentKey || instrument.instrument_key || "").trim())
    );
  });

  if (selectedInstruments.length === 0) {
    throw apiError("No matching NSE/BSE equity instruments were found. Check the symbols, exchange and instrument keys.", 404, "INSTRUMENTS_NOT_FOUND");
  }

  const instrumentKeys = selectedInstruments.map((item) => item.instrumentKey || item.instrument_key);
  const quoteResponse = await marketDataService.getFullMarketQuotes(instrumentKeys);
  if (!quoteResponse || quoteResponse.success !== true || !quoteResponse.data) {
    throw apiError("Upstox did not return usable full-market quotes.", 502, "UPSTOX_QUOTES_UNAVAILABLE");
  }

  const evaluated = evaluateQuotes(selectedInstruments, quoteResponse.data, filters);
  const scan = {
    scanId: crypto.randomUUID(),
    mode: "QUOTE_MOMENTUM_WATCHLIST",
    exchange: filters.exchange,
    filters: {
      minChangePercent: filters.minChangePercent,
      minVolume: filters.minVolume,
      limit: filters.limit,
    },
    requestedCount: selectedInstruments.length,
    returnedCount: evaluated.results.length,
    missingQuoteCount: evaluated.missingQuotes.length,
    scannedAt: new Date().toISOString(),
    source: "Upstox full market quotes",
    disclaimer: "These are quote-based watchlist observations, not guaranteed entry signals or investment recommendations.",
    results: evaluated.results,
  };

  latestScansByUser.set(userId, { scan, savedAt: Date.now() });
  return scan;
}

function getLatestScan(userId) {
  const cached = latestScansByUser.get(userId);
  if (!cached) return null;
  if (Date.now() - cached.savedAt > CACHE_TTL_MS) {
    latestScansByUser.delete(userId);
    return null;
  }
  return cached.scan;
}

module.exports = {
  runScanner,
  getLatestScan,
  validateRequest,
  evaluateQuotes,
};
