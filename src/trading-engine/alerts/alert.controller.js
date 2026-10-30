"use strict";
const service = require("./alert.service");

function userId(req) {
  return req.userId || req.firebaseUser?.uid || req.user?.uid;
}
function handle(res, error) {
  const status = Number(error.statusCode) || (error.response ? 502 : 500);
  if (status >= 500) console.error("[Trading Alerts]", error.code || "ERROR", error.message);
  return res.status(status).json({
    success: false,
    code: error.code || "ALERT_ERROR",
    message: status >= 500 ? "Unable to process alerts right now. Please try again." : error.message,
  });
}
exports.create = async (req, res) => {
  try {
    const alert = await service.createAlert(userId(req), req.body || {});
    return res.status(201).json({ success: true, data: alert });
  } catch (error) { return handle(res, error); }
};
exports.list = async (req, res) => {
  try { return res.json({ success: true, data: await service.listAlerts(userId(req)) }); }
  catch (error) { return handle(res, error); }
};
exports.update = async (req, res) => {
  try { return res.json({ success: true, data: await service.updateAlert(userId(req), req.params.id, req.body || {}) }); }
  catch (error) { return handle(res, error); }
};
exports.remove = async (req, res) => {
  try { return res.json({ success: true, data: await service.deleteAlert(userId(req), req.params.id) }); }
  catch (error) { return handle(res, error); }
};
