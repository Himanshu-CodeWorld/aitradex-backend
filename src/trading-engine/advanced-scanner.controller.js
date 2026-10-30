 "use strict";

const service = require("./scanner/advanced-scanner.service");

function sendError(res, error) {
  const status = Number(error.statusCode) || (error.response ? 502 : 500);
  if (status >= 500) console.error("[Advanced Scanner]", error.code || "ERROR", error.message);
  return res.status(status).json({
    success: false,
    message: status >= 500 ? "Unable to complete the advanced scan. Check Upstox access and try again." : error.message,
    code: error.code || "ADVANCED_SCANNER_ERROR",
  });
}

exports.run = async (req, res) => {
  try {
    const userId = req.userId || req.firebaseUser?.uid || req.user?.uid;
    const data = await service.runAdvancedScan({ userId, ...(req.body || {}) });
    return res.status(200).json({ success: true, message: "Advanced stock scan completed.", data });
  } catch (error) {
    return sendError(res, error);
  }
};

exports.latest = (req, res) => {
  const userId = req.userId || req.firebaseUser?.uid || req.user?.uid;
  const data = service.getLatestAdvancedScan(userId);
  if (!data) return res.status(404).json({ success: false, message: "No advanced scan is available. Run a scan first.", code: "ADVANCED_SCAN_NOT_FOUND" });
  return res.status(200).json({ success: true, data });
};
