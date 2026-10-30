"use strict";

const entryService = require("../entry/entry.service");
const { ema, calculateRsi, calculateMacd, calculateAtr } = entryService._indicators;

const DEFAULT_ATR_MULTIPLIER = 1.5;
const DEFAULT_PARTIAL_EXIT_PERCENT = 50;
const MIN_CANDLES = 35;

function apiError(message, statusCode = 400, code = "EXIT_ANALYSIS_ERROR") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}
function num(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function round(value, places = 2) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

async function createExitPlan(input = {}) {
  const averageBuyPrice = num(input.averageBuyPrice);
  const quantity = num(input.quantity);
  if (!(averageBuyPrice > 0)) {
    throw apiError("averageBuyPrice is required and must be greater than zero.", 400, "INVALID_AVERAGE_BUY_PRICE");
  }
  if (!(quantity > 0) || !Number.isInteger(quantity)) {
    throw apiError("quantity is required and must be a positive whole number.", 400, "INVALID_QUANTITY");
  }

  const atrMultiplier = num(input.atrMultiplier) ?? DEFAULT_ATR_MULTIPLIER;
  if (atrMultiplier < 1 || atrMultiplier > 3) {
    throw apiError("atrMultiplier must be between 1 and 3.", 400, "INVALID_ATR_MULTIPLIER");
  }
  const partialExitPercent = num(input.partialExitPercent) ?? DEFAULT_PARTIAL_EXIT_PERCENT;
  if (partialExitPercent < 1 || partialExitPercent > 99) {
    throw apiError("partialExitPercent must be between 1 and 99.", 400, "INVALID_PARTIAL_EXIT_PERCENT");
  }

  const instrument = await entryService.resolveEquity(input);
  const candles = await entryService.fetchDailyCandles(instrument.instrumentKey);
  if (candles.length < MIN_CANDLES) {
    throw apiError(`Not enough completed daily candles. Need at least ${MIN_CANDLES}; received ${candles.length}.`, 422, "INSUFFICIENT_CANDLE_HISTORY");
  }

  const closes = candles.map((c) => c.close);
  const latestCandle = candles[candles.length - 1];
  const ema9 = ema(closes, 9);
  const ema21 = ema(closes, 21);
  const rsi14 = calculateRsi(closes, 14);
  const macd = calculateMacd(closes);
  const atr14 = calculateAtr(candles, 14);
  if ([ema9, ema21, rsi14, atr14].some((v) => !Number.isFinite(v)) || !macd) {
    throw apiError("Unable to calculate the required exit indicators.", 422, "INDICATOR_CALCULATION_FAILED");
  }

  const live = await entryService.fetchLivePrice(instrument.instrumentKey, latestCandle.close);
  const currentPrice = num(live.price);
  if (!(currentPrice > 0)) {
    throw apiError("Upstox did not return a valid current price or completed-candle fallback.", 502, "CURRENT_PRICE_UNAVAILABLE");
  }

  const explicitStop = num(input.stopLoss);
  const target1Input = num(input.target1);
  const target2Input = num(input.target2);
  if (explicitStop !== null && !(explicitStop > 0 && explicitStop < averageBuyPrice)) {
    throw apiError("For a long position, stopLoss must be positive and below averageBuyPrice.", 400, "INVALID_STOP_LOSS");
  }
  if (target1Input !== null && !(target1Input > averageBuyPrice)) {
    throw apiError("target1 must be greater than averageBuyPrice for a long position.", 400, "INVALID_TARGET_1");
  }
  if (target2Input !== null && !(target2Input > (target1Input ?? averageBuyPrice))) {
    throw apiError("target2 must be greater than target1 (or averageBuyPrice if target1 is omitted).", 400, "INVALID_TARGET_2");
  }

  const riskPerShare = atr14 * atrMultiplier;
  const calculatedInitialStop = averageBuyPrice - riskPerShare;
  const initialStop = explicitStop ?? calculatedInitialStop;
  if (!(initialStop > 0)) {
    throw apiError("Calculated stop reference is not positive. Check the position price and ATR multiplier.", 422, "INVALID_CALCULATED_STOP");
  }
  const trailingCandidate = currentPrice - riskPerShare;
  // A long-position trailing stop may rise, but must never be loosened below
  // the original/user-supplied stop reference.
  const trailingStop = Math.max(initialStop, trailingCandidate);
  const stopReference = trailingStop;
  const target1 = target1Input ?? (averageBuyPrice + riskPerShare * 1.5);
  const target2 = target2Input ?? Math.max(
    averageBuyPrice + riskPerShare * 2,
    target1 + riskPerShare * 0.5
  );

  const pnl = (currentPrice - averageBuyPrice) * quantity;
  const pnlPercent = ((currentPrice - averageBuyPrice) / averageBuyPrice) * 100;
  const target1Reached = currentPrice >= target1;
  const target2Reached = currentPrice >= target2;
  const stopBreached = currentPrice <= stopReference;
  const bearishMomentum = ema9 < ema21 && macd.macd < macd.signal && rsi14 < 45;

  let action = "HOLD";
  let actionLabel = "Hold and monitor";
  const reasons = [];
  if (stopBreached) {
    action = "EXIT_REVIEW";
    actionLabel = "Stop reference reached — review exit";
    reasons.push("Current price is at or below the calculated trailing stop reference.");
  } else if (target2Reached) {
    action = "EXIT_REVIEW";
    actionLabel = "Target 2 reached — review profit booking";
    reasons.push("Current price has reached or exceeded Target 2.");
  } else if (target1Reached) {
    action = "BOOK_PARTIAL_PROFIT";
    actionLabel = `Target 1 reached — review ${partialExitPercent}% partial profit booking`;
    reasons.push("Current price has reached or exceeded Target 1.");
  } else if (bearishMomentum) {
    action = "EXIT_REVIEW";
    actionLabel = "Bearish momentum — review exit";
    reasons.push("EMA 9 is below EMA 21, MACD is below its signal line and RSI is below 45.");
  } else {
    reasons.push("No configured stop, target or bearish-momentum exit condition has triggered.");
  }

  reasons.push(ema9 >= ema21 ? "EMA 9 is at or above EMA 21." : "EMA 9 is below EMA 21.");
  reasons.push(macd.macd >= macd.signal ? "MACD is at or above its signal line." : "MACD is below its signal line.");
  reasons.push(`RSI 14 is ${round(rsi14, 2)}.`);
  if (!target1Reached) reasons.push(`Target 1 is ${round(target1 - currentPrice)} price units away.`);
  if (!target2Reached) reasons.push(`Target 2 is ${round(target2 - currentPrice)} price units away.`);

  const estimatedPartialQuantity = Math.max(1, Math.min(quantity, Math.floor(quantity * partialExitPercent / 100)));
  return {
    symbol: instrument.symbol,
    name: instrument.name,
    exchange: instrument.exchange,
    instrumentKey: instrument.instrumentKey,
    timeframe: "1D",
    position: {
      direction: "LONG",
      averageBuyPrice: round(averageBuyPrice),
      quantity,
      currentPrice: round(currentPrice),
      priceSource: live.source,
      marketValue: round(currentPrice * quantity),
      investedValue: round(averageBuyPrice * quantity),
      unrealizedPnl: round(pnl),
      unrealizedPnlPercent: round(pnlPercent, 2),
    },
    assessment: { action, actionLabel, reasons },
    levels: {
      initialStopReference: round(initialStop),
      trailingStopReference: round(trailingStop),
      target1: round(target1),
      target2: round(target2),
      target1Reached,
      target2Reached,
      stopReferenceBreached: stopBreached,
      partialExitPercent,
      estimatedPartialQuantity,
      riskPerShare: round(riskPerShare),
      atr14: round(atr14),
    },
    indicators: {
      ema9: round(ema9),
      ema21: round(ema21),
      rsi14: round(rsi14, 2),
      macd: round(macd.macd, 4),
      macdSignal: round(macd.signal, 4),
      macdHistogram: round(macd.histogram, 4),
    },
    candleInfo: {
      latestCompletedCandle: latestCandle.timestamp,
      candlesUsed: candles.length,
      dataSource: "Upstox historical daily candles + Upstox LTP when available",
    },
    disclaimer: "Educational position analysis only; not investment advice or a guaranteed exit signal. Stop and target levels are reference calculations, not broker orders. Actual execution price may differ due to gaps, liquidity, slippage and charges. No order is placed or changed.",
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { createExitPlan };
