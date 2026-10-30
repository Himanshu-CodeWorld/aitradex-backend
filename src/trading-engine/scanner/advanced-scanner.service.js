"use strict";

const axios = require("axios");
const { loadInstrumentMaster } = require("../../upstox/upstox.instruments.service");
const { UpstoxMarketService } = require("../../upstox/upstox.market.service");
const { UPSTOX_CONFIG } = require("../../upstox/upstox.config");

const marketService = new UpstoxMarketService();
const IST_OFFSET_MINUTES = 330;
const MAX_INSTRUMENTS = 30;
const CONCURRENCY = 3;
const CACHE_TTL_MS = 5 * 60 * 1000;
const latestByUser = new Map();

function apiError(message, statusCode = 500, code = "ADVANCED_SCANNER_ERROR") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function istParts(date = new Date()) {
  const shifted = new Date(date.getTime() + IST_OFFSET_MINUTES * 60000);
  return {
    date: `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`,
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

function parseCandle(row) {
  if (!Array.isArray(row) || row.length < 6) return null;
  const candle = {
    timestamp: new Date(row[0]),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
  };
  if (!Number.isFinite(candle.timestamp.getTime()) ||
      ![candle.open, candle.high, candle.low, candle.close, candle.volume].every(Number.isFinite) ||
      candle.close <= 0 || candle.volume < 0) return null;
  return candle;
}

function localMinute(timestamp) {
  return Math.floor((timestamp.getTime() + IST_OFFSET_MINUTES * 60000) / 60000) % 1440;
}

function aggregateCandles(candles, intervalMinutes) {
  const sorted = [...candles].sort((a, b) => a.timestamp - b.timestamp);
  const groups = new Map();
  for (const candle of sorted) {
    const minute = localMinute(candle.timestamp);
    const bucket = Math.floor(minute / intervalMinutes);
    const day = istParts(candle.timestamp).date;
    const key = `${day}:${bucket}`;
    const current = groups.get(key);
    if (!current) {
      groups.set(key, { ...candle, bucket, day });
    } else {
      current.high = Math.max(current.high, candle.high);
      current.low = Math.min(current.low, candle.low);
      current.close = candle.close;
      current.volume += candle.volume;
      current.timestamp = candle.timestamp;
    }
  }
  return [...groups.values()].sort((a, b) => a.timestamp - b.timestamp);
}

function ema(values, period) {
  if (values.length < period) return null;
  const multiplier = 2 / (period + 1);
  let result = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  for (let i = period; i < values.length; i += 1) result = values[i] * multiplier + result * (1 - multiplier);
  return result;
}

function trend(candles) {
  const closes = candles.map((c) => c.close);
  if (closes.length < 21) return "INSUFFICIENT_DATA";
  const fast = ema(closes, 9);
  const slow = ema(closes, 21);
  if (fast > slow && closes[closes.length - 1] > fast) return "BULLISH";
  if (fast < slow && closes[closes.length - 1] < fast) return "BEARISH";
  return "SIDEWAYS";
}

function openingRange(candles) {
  const first = candles.filter((c) => {
    const minute = localMinute(c.timestamp);
    return minute >= 555 && minute < 570; // 09:15–09:30 IST
  });
  if (first.length < 2) return null;
  return {
    high: Math.max(...first.map((c) => c.high)),
    low: Math.min(...first.map((c) => c.low)),
    candleCount: first.length,
  };
}

function relativeVolume(currentSessionCandles, historicalCandles) {
  // Compare today's cumulative volume with the mean cumulative volume at the
  // same elapsed 15-minute bucket over the previous sessions.
  const current = aggregateCandles(currentSessionCandles, 15);
  if (!current.length || !historicalCandles.length) return null;

  const today = istParts(new Date()).date;
  const todayCandles = current.filter((c) => c.day === today);
  if (!todayCandles.length) return null;
  const lastBucket = Math.max(...todayCandles.map((c) => c.bucket));
  const currentCum = todayCandles
    .filter((c) => c.bucket <= lastBucket)
    .reduce((sum, c) => sum + c.volume, 0);

  const byDay = new Map();
  for (const c of historicalCandles) {
    const day = istParts(c.timestamp).date;
    if (day === today) continue;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(c);
  }
  const cumulative = [];
  for (const dayCandles of byDay.values()) {
    const sameTime = dayCandles.filter((c) => {
      const minute = localMinute(c.timestamp);
      return Math.floor(minute / 15) <= lastBucket;
    });
    if (sameTime.length) cumulative.push(sameTime.reduce((sum, c) => sum + c.volume, 0));
  }
  if (cumulative.length < 3) return null;
  const average = cumulative.reduce((sum, value) => sum + value, 0) / cumulative.length;
  if (average <= 0) return null;
  return {
    ratio: Number((currentCum / average).toFixed(2)),
    sampleSessions: cumulative.length,
    currentSessionVolume: currentCum,
    averageVolumeAtSameTime: Math.round(average),
  };
}

function evaluate({ instrument, intraday, historical15m, daily }) {
  const five = aggregateCandles(intraday, 5);
  const fifteen = aggregateCandles(intraday, 15);
  const range = openingRange(five);
  const sortedIntraday = intraday.slice().sort((a, b) => a.timestamp - b.timestamp);
  const last = sortedIntraday.length ? sortedIntraday[sortedIntraday.length - 1] : null;
  const fiveTrend = trend(five);
  const fifteenTrend = trend(fifteen);
  const dailyTrend = trend(daily);
  const rvol = relativeVolume(intraday, historical15m);

  let orb = "WAIT";
  let orbReason = "Opening range is not ready; wait for the first 15 minutes to complete.";
  if (range && last) {
    if (last.close > range.high) {
      orb = "ORB_BREAKOUT_UP";
      orbReason = "Latest price is above the 09:15–09:30 IST opening-range high.";
    } else if (last.close < range.low) {
      orb = "ORB_BREAKOUT_DOWN";
      orbReason = "Latest price is below the 09:15–09:30 IST opening-range low.";
    } else {
      orbReason = "Price remains inside the opening range.";
    }
  }

  const trends = [fiveTrend, fifteenTrend, dailyTrend];
  const bullishCount = trends.filter((v) => v === "BULLISH").length;
  const bearishCount = trends.filter((v) => v === "BEARISH").length;
  const alignment = bullishCount === 3 ? "BULLISH_ALIGNED"
    : bearishCount === 3 ? "BEARISH_ALIGNED"
    : "MIXED";

  const rvolRatio = rvol?.ratio ?? null;
  let score = 0;
  if (orb === "ORB_BREAKOUT_UP") score += 35;
  if (orb === "ORB_BREAKOUT_DOWN") score += 35;
  if (alignment === "BULLISH_ALIGNED" || alignment === "BEARISH_ALIGNED") score += 35;
  if (rvolRatio !== null && rvolRatio >= 1.5) score += 20;
  else if (rvolRatio !== null && rvolRatio >= 1.2) score += 10;
  if (fiveTrend === fifteenTrend && fiveTrend !== "SIDEWAYS" && fiveTrend !== "INSUFFICIENT_DATA") score += 10;
  score = Math.min(100, score);

  let signal = "WAIT";
  if (orb === "ORB_BREAKOUT_UP" && alignment === "BULLISH_ALIGNED" && rvolRatio !== null && rvolRatio >= 1.2) signal = "BULLISH_ORB_SETUP";
  else if (orb === "ORB_BREAKOUT_DOWN" && alignment === "BEARISH_ALIGNED" && rvolRatio !== null && rvolRatio >= 1.2) signal = "BEARISH_ORB_SETUP";

  return {
    instrumentKey: instrument.instrumentKey || instrument.instrument_key,
    symbol: instrument.symbol || instrument.trading_symbol || "UNKNOWN",
    name: instrument.name || instrument.symbol || instrument.trading_symbol || "Unknown instrument",
    exchange: instrument.exchange || "NSE",
    ltp: last?.close ?? null,
    orb,
    orbRange: range ? { high: range.high, low: range.low } : null,
    multiTimeframe: { "5m": fiveTrend, "15m": fifteenTrend, daily: dailyTrend, alignment },
    relativeVolume: rvol,
    score,
    signal,
    reasons: [orbReason, `5m: ${fiveTrend}; 15m: ${fifteenTrend}; Daily: ${dailyTrend}.`,
      rvol ? `Relative volume: ${rvol.ratio}x versus ${rvol.sampleSessions} prior sessions at the same time.` : "Relative volume unavailable: insufficient same-time historical samples."],
    candleCounts: { intraday1m: intraday.length, historical15m: historical15m.length, daily: daily.length },
  };
}

async function getCandles(path) {
  const token = marketService.getAccessToken();
  const response = await axios.get(`${UPSTOX_CONFIG.marketApiBaseUrl}${path}`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    timeout: UPSTOX_CONFIG.requestTimeoutMs || 15000,
  });
  const rows = response?.data?.data?.candles;
  return Array.isArray(rows) ? rows.map(parseCandle).filter(Boolean).sort((a, b) => a.timestamp - b.timestamp) : [];
}

async function fetchInstrumentCandles(key, instrument) {
  const encoded = encodeURIComponent(key);
  const today = istParts().date;
  const shifted = new Date(Date.now() + IST_OFFSET_MINUTES * 60000);
  const intradayFrom = new Date(shifted.getTime() - 15 * 86400000);
  const dailyFrom = new Date(shifted.getTime() - 60 * 86400000);
  const toDate = today;
  const formatDate = (value) => `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
  const intradayFromDate = formatDate(intradayFrom);
  const dailyFromDate = formatDate(dailyFrom);
  const [intraday, historical15m, daily] = await Promise.all([
    getCandles(`/historical-candle/intraday/${encoded}/minutes/1`),
    getCandles(`/historical-candle/${encoded}/minutes/15/${toDate}/${intradayFromDate}`),
    getCandles(`/historical-candle/${encoded}/days/1/${toDate}/${dailyFromDate}`),
  ]);
  return evaluate({ instrument, intraday, historical15m, daily });
}

function validate(body = {}) {
  const exchange = String(body.exchange || "NSE").toUpperCase();
  if (!["NSE", "BSE"].includes(exchange)) throw apiError("exchange must be NSE or BSE.", 400, "INVALID_EXCHANGE");
  const symbols = Array.isArray(body.symbols) ? [...new Set(body.symbols.map((v) => String(v).trim().toUpperCase()).filter(Boolean))] : [];
  const keys = Array.isArray(body.instrumentKeys) ? [...new Set(body.instrumentKeys.map((v) => String(v).trim()).filter(Boolean))] : [];
  if (!symbols.length && !keys.length) throw apiError("Provide symbols or instrumentKeys for the advanced scan.", 400, "SCAN_UNIVERSE_REQUIRED");
  if (symbols.length + keys.length > MAX_INSTRUMENTS) throw apiError(`Scan up to ${MAX_INSTRUMENTS} instruments at a time.`, 400, "SCAN_LIMIT_EXCEEDED");
  return { exchange, symbols, keys, limit: Math.max(1, Math.min(30, Number(body.limit) || 20)) };
}

async function mapLimit(items, limit, mapper) {
  const output = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      try { output[index] = await mapper(items[index]); }
      catch (error) {
        output[index] = {
          instrumentKey: items[index].instrumentKey || items[index].instrument_key,
          symbol: items[index].symbol || items[index].trading_symbol,
          signal: "DATA_UNAVAILABLE",
          score: 0,
          error: error.response?.data?.errors?.[0]?.message || error.message,
        };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return output;
}

async function runAdvancedScan({ userId, ...body }) {
  if (!userId || typeof userId !== "string") throw apiError("Authenticated user is required.", 401, "USER_CONTEXT_MISSING");
  const filters = validate(body);
  const master = await loadInstrumentMaster();
  const symbolSet = new Set(filters.symbols);
  const keySet = new Set(filters.keys);
  const selected = master.filter((item) => {
    if (item.category !== "stock" || String(item.exchange || "").toUpperCase() !== filters.exchange) return false;
    return symbolSet.has(String(item.symbol || item.trading_symbol || "").toUpperCase()) ||
      keySet.has(String(item.instrumentKey || item.instrument_key || ""));
  }).slice(0, MAX_INSTRUMENTS);
  if (!selected.length) throw apiError("No matching equity instruments found in the Upstox instrument master.", 404, "INSTRUMENTS_NOT_FOUND");

  const results = await mapLimit(selected, CONCURRENCY, (instrument) =>
    fetchInstrumentCandles(instrument.instrumentKey || instrument.instrument_key, instrument));
  results.sort((a, b) => (b.score || 0) - (a.score || 0));
  const scan = {
    scanId: require("crypto").randomUUID(),
    mode: "ADVANCED_ORB_MULTI_TIMEFRAME",
    exchange: filters.exchange,
    scannedAt: new Date().toISOString(),
    requestedCount: selected.length,
    successfulCount: results.filter((r) => r.signal !== "DATA_UNAVAILABLE").length,
    results: results.slice(0, filters.limit),
    methodology: {
      openingRange: "09:15–09:30 Asia/Kolkata using 1-minute candles aggregated to 5-minute candles",
      multiTimeframe: "EMA 9/21 trend alignment on 5-minute, 15-minute and daily candles",
      relativeVolume: "Current session cumulative volume versus average cumulative volume at the same 15-minute bucket across returned historical sessions; requires at least 3 sessions",
      score: "Rule-based ranking score, not a probability or predicted return",
    },
    disclaimer: "Analysis-only market observations, not investment advice or guaranteed signals. Verify data and liquidity independently. No orders are placed.",
  };
  latestByUser.set(userId, { scan, savedAt: Date.now() });
  return scan;
}

function getLatestAdvancedScan(userId) {
  const item = latestByUser.get(userId);
  if (!item) return null;
  if (Date.now() - item.savedAt > CACHE_TTL_MS) {
    latestByUser.delete(userId);
    return null;
  }
  return item.scan;
}

module.exports = { runAdvancedScan, getLatestAdvancedScan, evaluate, aggregateCandles, relativeVolume };
