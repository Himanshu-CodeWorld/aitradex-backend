"use strict";

const scannerService = require("./scanner/scanner.service");
const entryService = require("./entry/entry.service");
const exitService = require("./exit/exit.service");

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
      risk: "NOT_IMPLEMENTED",
      backtesting: "NOT_IMPLEMENTED",
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

exports.checkRisk = async (req, res) => res.status(501).json({
  success: false,
  message: "Portfolio risk validation is not implemented yet.",
  code: "RISK_CHECK_NOT_IMPLEMENTED",
});
