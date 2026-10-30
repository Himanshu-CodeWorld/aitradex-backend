"use strict";

const { ema, calculateRsi, calculateMacd, calculateAtr } = require("../entry/entry.service")._indicators;

const TYPES = new Set(["EMA_CROSS", "RSI", "MACD", "PRICE_SMA", "VOLUME_RATIO"]);
const OPERATORS = {
  EMA_CROSS: new Set(["FAST_ABOVE", "FAST_BELOW"]),
  RSI: new Set(["ABOVE", "BELOW", "BETWEEN"]),
  MACD: new Set(["ABOVE_SIGNAL", "BELOW_SIGNAL"]),
  PRICE_SMA: new Set(["ABOVE", "BELOW"]),
  VOLUME_RATIO: new Set(["ABOVE"]),
};

function fail(message, code = "INVALID_STRATEGY") {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 400;
  throw error;
}

function number(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validateCondition(raw, label, index) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) fail(`${label} condition ${index + 1} must be an object.`);
  const type = String(raw.type || "").toUpperCase();
  const operator = String(raw.operator || "").toUpperCase();
  if (!TYPES.has(type)) fail(`${label} condition ${index + 1} has an unsupported indicator.`);
  if (!OPERATORS[type].has(operator)) fail(`${label} condition ${index + 1} has an unsupported operator for ${type}.`);
  const condition = { type, operator };
  if (["EMA_CROSS", "PRICE_SMA", "RSI", "VOLUME_RATIO"].includes(type)) {
    condition.period = number(raw.period, type === "RSI" ? 14 : 20);
    if (!Number.isInteger(condition.period) || condition.period < 2 || condition.period > 100) fail(`${label} condition ${index + 1} period must be an integer from 2 to 100.`);
  }
  if (type === "EMA_CROSS") {
    condition.fastPeriod = number(raw.fastPeriod, 9);
    condition.slowPeriod = number(raw.slowPeriod, 21);
    if (!Number.isInteger(condition.fastPeriod) || !Number.isInteger(condition.slowPeriod) || condition.fastPeriod < 2 || condition.slowPeriod < 3 || condition.fastPeriod >= condition.slowPeriod || condition.slowPeriod > 100) fail(`${label} EMA fast/slow periods are invalid; fast must be smaller than slow.`);
  }
  if (type === "RSI" || type === "VOLUME_RATIO") {
    condition.value = number(raw.value, type === "RSI" ? 50 : 1.2);
    if (condition.value === null || condition.value < 0 || condition.value > (type === "RSI" ? 100 : 20)) fail(`${label} condition ${index + 1} threshold is out of range.`);
    if (type === "RSI" && operator === "BETWEEN") {
      condition.min = number(raw.min, 50);
      condition.max = number(raw.max, 70);
      if (condition.min === null || condition.max === null || condition.min < 0 || condition.max > 100 || condition.min >= condition.max) fail(`${label} RSI range is invalid.`);
    }
  }
  return condition;
}

function validateStrategy(input) {
  const raw = input && typeof input === "object" ? input : {};
  const name = String(raw.name || "Custom Strategy").trim().slice(0, 60) || "Custom Strategy";
  if (!Array.isArray(raw.entryConditions) || raw.entryConditions.length < 1 || raw.entryConditions.length > 5) fail("Add between 1 and 5 entry conditions.");
  if (!Array.isArray(raw.exitConditions) || raw.exitConditions.length < 1 || raw.exitConditions.length > 5) fail("Add between 1 and 5 exit conditions.");
  return {
    name,
    entryLogic: "ALL",
    exitLogic: "ANY",
    entryConditions: raw.entryConditions.map((item, i) => validateCondition(item, "Entry", i)),
    exitConditions: raw.exitConditions.map((item, i) => validateCondition(item, "Exit", i)),
  };
}

function simpleMovingAverage(values, period) {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((sum, value) => sum + value, 0) / period;
}

function conditionMatches(condition, candles) {
  const closes = candles.map((c) => c.close);
  const latest = candles[candles.length - 1];
  switch (condition.type) {
    case "EMA_CROSS": {
      const fast = ema(closes, condition.fastPeriod);
      const slow = ema(closes, condition.slowPeriod);
      if (!Number.isFinite(fast) || !Number.isFinite(slow)) return false;
      return condition.operator === "FAST_ABOVE" ? fast > slow : fast < slow;
    }
    case "RSI": {
      const value = calculateRsi(closes, condition.period);
      if (!Number.isFinite(value)) return false;
      if (condition.operator === "ABOVE") return value > condition.value;
      if (condition.operator === "BELOW") return value < condition.value;
      return value >= condition.min && value <= condition.max;
    }
    case "MACD": {
      const macd = calculateMacd(closes);
      if (!macd) return false;
      return condition.operator === "ABOVE_SIGNAL" ? macd.macd > macd.signal : macd.macd < macd.signal;
    }
    case "PRICE_SMA": {
      const average = simpleMovingAverage(closes, condition.period);
      if (!Number.isFinite(average)) return false;
      return condition.operator === "ABOVE" ? latest.close > average : latest.close < average;
    }
    case "VOLUME_RATIO": {
      const volumes = candles.map((c) => Number(c.volume) || 0);
      if (volumes.length < condition.period + 1) return false;
      const average = simpleMovingAverage(volumes.slice(0, -1), condition.period);
      if (!Number.isFinite(average) || average <= 0) return false;
      return latest.volume / average > condition.value;
    }
    default: return false;
  }
}

function buildSignals(candles, rawStrategy) {
  const strategy = validateStrategy(rawStrategy);
  const signals = candles.map((_, index) => {
    if (index < 35) return null;
    const history = candles.slice(0, index + 1);
    const atr = calculateAtr(history, 14);
    if (!Number.isFinite(atr)) return null;
    const entry = strategy.entryConditions.every((condition) => conditionMatches(condition, history));
    const exit = strategy.exitConditions.some((condition) => conditionMatches(condition, history));
    return { enter: entry, exit, atr };
  });
  return { strategy, signals };
}

function describeCondition(condition) {
  switch (condition.type) {
    case "EMA_CROSS": return `EMA ${condition.fastPeriod} ${condition.operator === "FAST_ABOVE" ? "above" : "below"} EMA ${condition.slowPeriod}`;
    case "RSI": return condition.operator === "BETWEEN" ? `RSI ${condition.period} between ${condition.min} and ${condition.max}` : `RSI ${condition.period} ${condition.operator.toLowerCase()} ${condition.value}`;
    case "MACD": return `MACD ${condition.operator === "ABOVE_SIGNAL" ? "above" : "below"} signal`;
    case "PRICE_SMA": return `Close ${condition.operator.toLowerCase()} SMA ${condition.period}`;
    case "VOLUME_RATIO": return `Volume ratio ${condition.operator.toLowerCase()} ${condition.value}x`;
    default: return condition.type;
  }
}

module.exports = { validateStrategy, buildSignals, describeCondition };
