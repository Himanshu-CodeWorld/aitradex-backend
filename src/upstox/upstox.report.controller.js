// ==========================================================
// AiTradeX - Upstox Report Controller
// ==========================================================

const upstoxReportService = require("./upstox.report.service");

const getReport = async (req, res) => {
  try {
    const result = await upstoxReportService.getReport({
      symbol: req.query.symbol,
      instrumentKey: req.query.instrument_key,
      isin: req.query.isin,
    });

    return res.status(200).json(result);
  } catch (error) {
    const statusCode =
      Number.isInteger(error.statusCode) &&
      error.statusCode >= 400 &&
      error.statusCode < 600
        ? error.statusCode
        : 500;

    console.error(
      "[Upstox Report Controller]",
      error.code || "UPSTOX_REPORT_DATA_ERROR",
      error.message
    );

    return res.status(statusCode).json({
      success: false,
      code:
        error.code ||
        "UPSTOX_REPORT_DATA_ERROR",
      message:
        error.message ||
        "Unable to load stock report.",
    });
  }
};

module.exports = {
  getReport,
};
