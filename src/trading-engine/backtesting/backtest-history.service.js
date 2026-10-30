"use strict";

const mongoose = require("mongoose");
const BacktestRun = require("./BacktestRun");

function fail(message, code, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  throw error;
}

function user(uid) {
  if (!uid || typeof uid !== "string") fail("Authenticated user was not found.", "USER_NOT_AUTHENTICATED", 401);
  return uid;
}

function safeSummary(doc) {
  return {
    id: String(doc._id),
    name: doc.name,
    symbol: doc.symbol,
    exchange: doc.exchange,
    period: doc.period,
    parameters: doc.parameters,
    metrics: doc.metrics,
    comparison: doc.comparison,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function saveRun(uid, input = {}) {
  uid = user(uid);
  const name = String(input.name || "").trim();
  const result = input.result;
  if (!name || name.length > 80) fail("Give this backtest a name (1–80 characters).", "INVALID_BACKTEST_NAME");
  if (!result || typeof result !== "object" || Array.isArray(result)) fail("A completed backtest result is required.", "BACKTEST_RESULT_REQUIRED");
  const serialized = JSON.stringify(result);
  if (serialized.length > 1500000) fail("This backtest result is too large to save.", "BACKTEST_RESULT_TOO_LARGE", 413);
  const instrument = result.instrument || {};
  const metrics = result.metrics || {};
  const period = result.period || {};
  const strategy = result.strategy || {};
  const symbol = String(instrument.symbol || input.symbol || "").trim().toUpperCase();
  const exchange = String(instrument.exchange || input.exchange || "").trim().toUpperCase();
  if (!/^[A-Z0-9&.-]{1,30}$/.test(symbol)) fail("Backtest result has an invalid stock symbol.", "INVALID_SYMBOL");
  if (!["NSE", "BSE"].includes(exchange)) fail("Backtest result has an invalid exchange.", "INVALID_EXCHANGE");
  const parameters = input.parameters && typeof input.parameters === "object" ? input.parameters : (strategy.parameters || {});
  const doc = await BacktestRun.create({
    userId: uid,
    name,
    symbol,
    exchange,
    period: {
      startDate: String(period.startDate || period.requestedStartDate || ""),
      endDate: String(period.endDate || period.requestedEndDate || ""),
      candlesTested: Number(period.candlesTested) || 0,
    },
    parameters,
    metrics,
    comparison: result.comparison || {},
    result,
  });
  return safeSummary(doc);
}

async function listRuns(uid, query = {}) {
  uid = user(uid);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 30));
  const filter = { userId: uid };
  if (query.symbol) filter.symbol = String(query.symbol).trim().toUpperCase().slice(0, 30);
  const docs = await BacktestRun.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("name symbol exchange period parameters metrics comparison createdAt updatedAt")
    .lean();
  return docs.map(safeSummary);
}

async function getRun(uid, id) {
  uid = user(uid);
  if (!mongoose.isValidObjectId(id)) fail("Invalid saved backtest ID.", "INVALID_BACKTEST_ID");
  const doc = await BacktestRun.findOne({ _id: id, userId: uid }).lean();
  if (!doc) fail("Saved backtest was not found.", "BACKTEST_NOT_FOUND", 404);
  return { ...safeSummary(doc), result: doc.result };
}

async function deleteRun(uid, id) {
  uid = user(uid);
  if (!mongoose.isValidObjectId(id)) fail("Invalid saved backtest ID.", "INVALID_BACKTEST_ID");
  const deleted = await BacktestRun.findOneAndDelete({ _id: id, userId: uid }).lean();
  if (!deleted) fail("Saved backtest was not found.", "BACKTEST_NOT_FOUND", 404);
  return { id: String(deleted._id), deleted: true };
}

async function compareRuns(uid, ids) {
  uid = user(uid);
  if (!Array.isArray(ids) || ids.length < 2 || ids.length > 4 || ids.some(id => !mongoose.isValidObjectId(id))) {
    fail("Select between 2 and 4 valid saved backtests to compare.", "INVALID_COMPARE_SELECTION");
  }
  const uniqueIds = [...new Set(ids.map(String))];
  if (uniqueIds.length !== ids.length) fail("Choose different saved backtests for comparison.", "DUPLICATE_COMPARE_SELECTION");
  const docs = await BacktestRun.find({ _id: { $in: uniqueIds }, userId: uid })
    .select("name symbol exchange period metrics comparison createdAt")
    .lean();
  if (docs.length !== uniqueIds.length) fail("One or more saved backtests were not found.", "BACKTEST_NOT_FOUND", 404);
  const ordered = uniqueIds.map(id => docs.find(doc => String(doc._id) === id));
  return ordered.map(safeSummary);
}

module.exports = { saveRun, listRuns, getRun, deleteRun, compareRuns };
