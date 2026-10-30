"use strict";

const scannerService = require("./scanner/scanner.service");
const entryService = require("./entry/entry.service");
const exitService = require("./exit/exit.service");
const riskService = require("./risk/risk.service");
const backtestService = require("./backtesting/backtest.service");
const backtestHistoryService = require("./backtesting/backtest-history.service");
const strategyPerformanceService = require("./backtesting/strategy-performance.service");

function sendError(res, error, fallback) {
  const statusCode = Number(error.statusCode) || 500;
  if (statusCode >= 500) console.error("[Trading Engine]", error.code || "ERROR", error.message);
  return res.status(statusCode).json({
    success: false,
    message: statusCode >= 500 ? fallback : error.message,
    code: error.code || "TRADING_ENGINE_ERROR",
  });
}

exports.getDashboard = async (req, res) => res.status(200).json({
  success: true,
  message: "AiTradeX Trading Engine API is available.",
  data: {
    engine: "AiTradeX Trading Engine",
    mode: "ANALYSIS_ONLY",
    status: "SCANNER_ENTRY_AND_EXIT_ANALYSIS",
    modules: {
      scanner: "AVAILABLE",
      entry: "AVAILABLE_DAILY_TECHNICAL_ANALYSIS",
      exit: "AVAILABLE_DAILY_POSITION_ANALYSIS",
      risk: "AVAILABLE_PORTFOLIO_AND_POSITION_SIZING",
      backtesting: "AVAILABLE_DAILY_HISTORICAL_SIMULATION",
      brokerExecution: "DISABLED",
    },
  },
});

exports.runScanner = async (req, res) => {
  try {
    const scan = await scannerService.runScanner({
      userId: req.userId || req.firebaseUser?.uid || req.user?.uid,
      ...(req.body || {}),
    });
    return res.status(200).json({ success: true, message: "Stock scan completed.", data: scan });
  } catch (error) {
    return sendError(res, error, "Unable to complete the stock scan. Check Upstox connection and try again.");
  }
};

exports.getScannerResults = async (req, res) => {
  const userId = req.userId || req.firebaseUser?.uid || req.user?.uid;
  const scan = scannerService.getLatestScan(userId);
  if (!scan) return res.status(404).json({
    success: false,
    message: "No recent scanner results are available. Run the scanner first.",
    code: "SCANNER_RESULTS_NOT_FOUND",
  });
  return res.status(200).json({ success: true, data: scan });
};

exports.analyzeEntry = async (req, res) => {
  try {
    const analysis = await entryService.analyzeEntry(req.body || {});
    return res.status(200).json({ success: true, message: "Daily technical entry analysis completed.", data: analysis });
  } catch (error) {
    return sendError(res, error, "Unable to analyse this stock. Check Upstox connection and try again.");
  }
};

exports.createExitPlan = async (req, res) => {
  try {
    const plan = await exitService.createExitPlan(req.body || {});
    return res.status(200).json({ success: true, message: "Daily position exit analysis completed.", data: plan });
  } catch (error) {
    return sendError(res, error, "Unable to analyse this position. Check Upstox connection and try again.");
  }
};

exports.checkRisk = async (req, res) => {
  try {
    const result = riskService.calculateRisk(req.body || {});
    return res.status(200).json({
      success: true,
      message: "Portfolio risk assessment completed.",
      data: result,
    });
  } catch (error) {
    return sendError(res, error, "Unable to calculate portfolio risk. Check the supplied position and account values.");
  }
};


exports.runBacktest = async (req, res) => {
  try {
    const result = await backtestService.runBacktest(req.body || {});
    return res.status(200).json({
      success: true,
      message: "Historical backtest completed.",
      data: result,
    });
  } catch (error) {
    return sendError(res, error, "Unable to run the backtest. Check Upstox connection and selected date range.");
  }
};


function authenticatedUid(req) {
  return req.userId || req.firebaseUser?.uid || req.user?.uid || req.auth?.uid;
}

exports.saveBacktest = async (req, res) => {
  try {
    const saved = await backtestHistoryService.saveRun(authenticatedUid(req), req.body || {});
    return res.status(201).json({ success: true, message: "Backtest saved to your history.", data: saved });
  } catch (error) {
    return sendError(res, error, "Unable to save this backtest.");
  }
};

exports.listBacktests = async (req, res) => {
  try {
    const items = await backtestHistoryService.listRuns(authenticatedUid(req), req.query || {});
    return res.status(200).json({ success: true, data: { items, count: items.length } });
  } catch (error) {
    return sendError(res, error, "Unable to load saved backtests.");
  }
};

exports.getBacktest = async (req, res) => {
  try {
    const item = await backtestHistoryService.getRun(authenticatedUid(req), req.params.id);
    return res.status(200).json({ success: true, data: item });
  } catch (error) {
    return sendError(res, error, "Unable to load this saved backtest.");
  }
};

exports.deleteBacktest = async (req, res) => {
  try {
    const result = await backtestHistoryService.deleteRun(authenticatedUid(req), req.params.id);
    return res.status(200).json({ success: true, message: "Saved backtest deleted.", data: result });
  } catch (error) {
    return sendError(res, error, "Unable to delete this saved backtest.");
  }
};

exports.compareBacktests = async (req, res) => {
  try {
    const items = await backtestHistoryService.compareRuns(authenticatedUid(req), req.body?.ids);
    return res.status(200).json({ success: true, data: { items, count: items.length } });
  } catch (error) {
    return sendError(res, error, "Unable to compare the selected backtests.");
  }
};


exports.getStrategyPerformance = async (req, res) => {
  try {
    const data = await strategyPerformanceService.getDashboard(authenticatedUid(req), req.query || {});
    return res.status(200).json({ success: true, message: "Saved strategy performance loaded.", data });
  } catch (error) {
    return sendError(res, error, "Unable to load strategy performance.");
  }
};
