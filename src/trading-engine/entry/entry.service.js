"use strict";

const axios = require("axios");
const { UPSTOX_CONFIG } = require("../../upstox/upstox.config");
const { loadInstrumentMaster } = require("../../upstox/upstox.instruments.service");
const { UpstoxMarketService } = require("../../upstox/upstox.market.service");

const marketService = new UpstoxMarketService();
const MIN_CANDLES = 35;
const HISTORY_DAYS = 180;
const DEFAULT_ATR_MULTIPLIER = 1.5;
const DEFAULT_TARGET_R_MULTIPLES = [1.5, 2];

function apiError(message, statusCode = 400, code = "ENTRY_ANALYSIS_ERROR") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function cleanString(value) {
  return String(value ?? "").trim();
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const valueAsNumber = Number(value);
  return Number.isFinite(valueAsNumber) ? valueAsNumber : null;
}

function round(value, places = 2) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function indiaDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dateDaysAgo(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return indiaDate(date);
}

function parseCandles(response) {
  const rawCandles = Array.isArray(response?.data?.candles)
    ? response.data.candles
    : [];

  return rawCandles
    .filter((row) => Array.isArray(row) && row.length >= 6)
    .map((row) => ({
      timestamp: row[0],
      open: numberOrNull(row[1]),
      high: numberOrNull(row[2]),
      low: numberOrNull(row[3]),
      close: numberOrNull(row[4]),
      volume: numberOrNull(row[5]) ?? 0,
    }))
    .filter((candle) =>
      candle.timestamp &&
      candle.open > 0 &&
      candle.high > 0 &&
      candle.low > 0 &&
      candle.close > 0 &&
      candle.high >= candle.low
    )
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

function ema(values, period) {
  if (!Array.isArray(values) || values.length < period) return null;
  const multiplier = 2 / (period + 1);
  let current = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  for (let index = period; index < values.length; index += 1) {
    current = (values[index] - current) * multiplier + current;
  }
  return current;
}

function emaSeries(values, period) {
  if (values.length < period) return [];
  const multiplier = 2 / (period + 1);
  const result = new Array(values.length).fill(null);
  let current = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  result[period - 1] = current;
  for (let index = period; index < values.length; index += 1) {
    current = (values[index] - current) * multiplier + current;
    result[index] = current;
  }
  return result;
}

function calculateRsi(closes, period = 14) {
  if (closes.length <= period) return null;
  let gains = 0;
  let losses = 0;
  for (let index = 1; index <= period; index += 1) {
    const difference = closes[index] - closes[index - 1];
    if (difference > 0) gains += difference;
    else losses += Math.abs(difference);
  }
  let averageGain = gains / period;
  let averageLoss = losses / period;
  for (let index = period + 1; index < closes.length; index += 1) {
    const difference = closes[index] - closes[index - 1];
    averageGain = ((averageGain * (period - 1)) + Math.max(difference, 0)) / period;
    averageLoss = ((averageLoss * (period - 1)) + Math.max(-difference, 0)) / period;
  }
  if (averageLoss === 0) return averageGain === 0 ? 50 : 100;
  const relativeStrength = averageGain / averageLoss;
  return 100 - (100 / (1 + relativeStrength));
}

function calculateMacd(closes) {
  if (closes.length < 35) return null;
  const fast = emaSeries(closes, 12);
  const slow = emaSeries(closes, 26);
  const macdValues = [];
  for (let index = 0; index < closes.length; index += 1) {
    if (fast[index] !== null && slow[index] !== null) {
      macdValues.push({ index, value: fast[index] - slow[index] });
    }
  }
  const signalValues = emaSeries(macdValues.map((item) => item.value), 9);
  const lastMacd = macdValues[macdValues.length - 1];
  const lastSignal = signalValues[signalValues.length - 1];
  if (!lastMacd || lastSignal === null || lastSignal === undefined) return null;
  return {
    macd: lastMacd.value,
    signal: lastSignal,
    histogram: lastMacd.value - lastSignal,
  };
}

function calculateAtr(candles, period = 14) {
  if (candles.length <= period) return null;
  const trueRanges = [];
  for (let index = 1; index < candles.length; index += 1) {
    const current = candles[index];
    const previousClose = candles[index - 1].close;
    trueRanges.push(Math.max(
      current.high - current.low,
      Math.abs(current.high - previousClose),
      Math.abs(current.low - previousClose)
    ));
  }
  let value = trueRanges.slice(0, period).reduce((sum, item) => sum + item, 0) / period;
  for (let index = period; index < trueRanges.length; index += 1) {
    value = ((value * (period - 1)) + trueRanges[index]) / period;
  }
  return value;
}

function average(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function resolveEquity({ symbol, instrumentKey, exchange }) {
  const cleanSymbol = cleanString(symbol).toUpperCase();
  const cleanKey = cleanString(instrumentKey);
  const cleanExchange = cleanString(exchange || "NSE").toUpperCase();

  if (!["NSE", "BSE"].includes(cleanExchange)) {
    throw apiError("exchange must be NSE or BSE.", 400, "INVALID_EXCHANGE");
  }
  if (!cleanSymbol && !cleanKey) {
    throw apiError("Provide a stock symbol or instrumentKey.", 400, "ENTRY_INSTRUMENT_REQUIRED");
  }

  let instruments;
  try {
    instruments = await loadInstrumentMaster();
  } catch (error) {
    throw apiError(`Unable to load the Upstox instrument master: ${error.message}`, 503, "INSTRUMENT_MASTER_UNAVAILABLE");
  }

  const rows = Array.isArray(instruments) ? instruments : [];
  const match = rows.find((item) => {
    const key = cleanString(item.instrumentKey || item.instrument_key);
    const itemSymbol = cleanString(item.symbol || item.trading_symbol).toUpperCase();
    const itemExchange = cleanString(item.exchange).toUpperCase();
    const isEquity = cleanString(item.category).toLowerCase() === "stock" ||
      cleanString(item.instrumentType || item.instrument_type).toUpperCase() === "EQ";
    return isEquity && itemExchange === cleanExchange &&
      (cleanKey ? key === cleanKey : itemSymbol === cleanSymbol);
  });

  if (!match?.instrumentKey && !match?.instrument_key) {
    throw apiError(
      `${cleanSymbol || cleanKey} was not found as an ${cleanExchange} equity in the Upstox instrument master.`,
      404,
      "UPSTOX_EQUITY_NOT_FOUND"
    );
  }

  return {
    instrumentKey: cleanString(match.instrumentKey || match.instrument_key),
    symbol: cleanString(match.symbol || match.trading_symbol),
    name: cleanString(match.name || match.symbol || match.trading_symbol),
    exchange: cleanExchange,
  };
}

async function fetchDailyCandles(instrumentKey) {
  const token = marketService.getAccessToken();
  const toDate = indiaDate();
  const fromDate = dateDaysAgo(HISTORY_DAYS);
  const path = `/historical-candle/${encodeURIComponent(instrumentKey)}/days/1/${toDate}/${fromDate}`;

  try {
    const response = await axios.get(`${UPSTOX_CONFIG.marketApiBaseUrl}${path}`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      timeout: UPSTOX_CONFIG.requestTimeoutMs,
    });
    let candles = parseCandles(response.data);

    // Do not calculate indicators from today's still-forming daily candle.
    const today = indiaDate();
    candles = candles.filter((candle) => indiaDate(new Date(candle.timestamp)) !== today);
    return candles;
  } catch (error) {
    const status = Number(error.response?.status) || 0;
    const body = error.response?.data;
    if (status === 401 || status === 403) {
      throw apiError("Upstox rejected the access token. Reconnect Upstox and retry.", 401, "UPSTOX_TOKEN_INVALID");
    }
    if (status === 429) {
      throw apiError("Upstox rate limit reached. Please wait and retry.", 429, "UPSTOX_RATE_LIMIT");
    }
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      throw apiError("Upstox historical-candle request timed out.", 504, "UPSTOX_CANDLE_TIMEOUT");
    }
    if (error.statusCode) throw error;
    throw apiError(
      body?.errors?.[0]?.message || body?.message || "Unable to fetch historical candles from Upstox.",
      status >= 400 && status < 500 ? status : 502,
      "UPSTOX_CANDLE_REQUEST_FAILED"
    );
  }
}

async function fetchLivePrice(instrumentKey, fallbackPrice) {
  try {
    const response = await marketService.getMarketQuotes([instrumentKey]);
    const quote = response?.data?.[instrumentKey];
    const livePrice = numberOrNull(quote?.last_price);
    return livePrice > 0 ? { price: livePrice, source: "UPSTOX_LTP" } : {
      price: fallbackPrice,
      source: "LAST_COMPLETED_DAILY_CLOSE",
    };
  } catch (error) {
    // Candle-based analysis can still be returned when the optional LTP call
    // is unavailable; the response explicitly identifies the fallback.
    return { price: fallbackPrice, source: "LAST_COMPLETED_DAILY_CLOSE", ltpWarning: error.message };
  }
}

async function analyzeEntry(input = {}) {
  const instrument = await resolveEquity(input);
  const atrMultiplier = numberOrNull(input.atrMultiplier) ?? DEFAULT_ATR_MULTIPLIER;
  if (atrMultiplier < 1 || atrMultiplier > 3) {
    throw apiError("atrMultiplier must be between 1 and 3.", 400, "INVALID_ATR_MULTIPLIER");
  }

  const candles = await fetchDailyCandles(instrument.instrumentKey);
  if (candles.length < MIN_CANDLES) {
    throw apiError(
      `Not enough completed daily candles to calculate the indicators. Need at least ${MIN_CANDLES}; received ${candles.length}.`,
      422,
      "INSUFFICIENT_CANDLE_HISTORY"
    );
  }

  const closes = candles.map((candle) => candle.close);
  const volumes = candles.map((candle) => candle.volume);
  const latestCandle = candles[candles.length - 1];
  const ema9 = ema(closes, 9);
  const ema21 = ema(closes, 21);
  const rsi14 = calculateRsi(closes, 14);
  const macd = calculateMacd(closes);
  const atr14 = calculateAtr(candles, 14);
  const averageVolume20 = average(volumes.slice(-21, -1));
  const currentVolume = latestCandle.volume;
  const volumeRatio = averageVolume20 > 0 ? currentVolume / averageVolume20 : null;

  if ([ema9, ema21, rsi14, atr14].some((value) => !Number.isFinite(value)) || !macd) {
    throw apiError("Indicator calculation did not produce enough valid data.", 422, "INDICATOR_CALCULATION_FAILED");
  }

  const bullishTrend = ema9 > ema21;
  const macdBullish = macd.macd > macd.signal;
  const rsiHealthy = rsi14 >= 50 && rsi14 <= 70;
  const volumeConfirmed = volumeRatio !== null && volumeRatio >= 1.2;
  const bearishTrend = ema9 < ema21 && macd.macd < macd.signal && rsi14 < 50;
  const live = await fetchLivePrice(instrument.instrumentKey, latestCandle.close);
  const entryPrice = live.price;

  let signal = "WAIT";
  const reasons = [];
  if (bullishTrend) reasons.push("EMA 9 is above EMA 21, indicating a positive trend.");
  else reasons.push("EMA 9 is not above EMA 21; bullish trend confirmation is missing.");
  if (macdBullish) reasons.push("MACD is above its signal line.");
  else reasons.push("MACD is not above its signal line.");
  if (rsiHealthy) reasons.push(`RSI is ${round(rsi14, 1)}, within the configured bullish momentum band (50–70).`);
  else reasons.push(`RSI is ${round(rsi14, 1)}; it is outside the configured bullish momentum band (50–70).`);
  if (volumeConfirmed) reasons.push(`Completed-candle volume is ${round(volumeRatio, 2)}x its 20-candle average.`);
  else reasons.push("Volume confirmation is below 1.2x its 20-candle average or unavailable.");

  if (bullishTrend && macdBullish && rsiHealthy && volumeConfirmed) {
    signal = "BULLISH_SETUP";
  } else if (bearishTrend) {
    signal = "BEARISH_BIAS";
  }

  let tradePlan = null;
  if (signal === "BULLISH_SETUP") {
    const riskPerShare = atr14 * atrMultiplier;
    const stopLoss = entryPrice - riskPerShare;
    if (stopLoss > 0 && entryPrice > stopLoss) {
      tradePlan = {
        direction: "LONG_ONLY_ANALYSIS",
        referenceEntry: round(entryPrice),
        stopLoss: round(stopLoss),
        riskPerShare: round(riskPerShare),
        riskPercent: round((riskPerShare / entryPrice) * 100, 2),
        targets: DEFAULT_TARGET_R_MULTIPLES.map((multiple) => ({
          riskReward: `1:${multiple}`,
          price: round(entryPrice + riskPerShare * multiple),
        })),
        method: `ATR(14) x ${atrMultiplier} stop; targets use fixed risk multiples.`,
      };
    } else {
      signal = "WAIT";
      reasons.push("A valid positive stop-loss could not be calculated at the current reference price.");
    }
  }

  return {
    symbol: instrument.symbol,
    name: instrument.name,
    exchange: instrument.exchange,
    instrumentKey: instrument.instrumentKey,
    timeframe: "1D",
    signal,
    signalLabel: signal === "BULLISH_SETUP"
      ? "Bullish setup — confirmation conditions met"
      : signal === "BEARISH_BIAS"
        ? "Bearish bias — no long entry suggested"
        : "Wait — bullish conditions are not fully confirmed",
    price: {
      value: round(entryPrice),
      source: live.source,
      lastCompletedDailyClose: round(latestCandle.close),
    },
    indicators: {
      ema9: round(ema9),
      ema21: round(ema21),
      rsi14: round(rsi14, 2),
      macd: round(macd.macd, 4),
      macdSignal: round(macd.signal, 4),
      macdHistogram: round(macd.histogram, 4),
      atr14: round(atr14),
      latestCompletedVolume: Math.round(currentVolume),
      averageVolume20: Math.round(averageVolume20 || 0),
      volumeRatio: round(volumeRatio, 2),
    },
    tradePlan,
    reasons,
    candleInfo: {
      latestCompletedCandle: latestCandle.timestamp,
      candlesUsed: candles.length,
      dataSource: "Upstox historical candles + Upstox LTP when available",
    },
    disclaimer: "Educational technical analysis only. This is not investment advice or a guaranteed signal. Prices and indicators can change. No order is placed by this endpoint. Verify liquidity, costs, position size and your own risk limits before acting.",
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  analyzeEntry,
  // Shared, read-only market-data helpers for the exit analysis module.
  resolveEquity,
  fetchDailyCandles,
  fetchLivePrice,
  // Exported for unit testing without making any trading API calls.
  _indicators: { ema, calculateRsi, calculateMacd, calculateAtr, parseCandles },
};
