'use strict';

const service = require('./paper-trading.service');

function sendError(res, error) {
  const message = error?.message || 'Paper trading request failed.';
  const status = /not configured|market price|market data/i.test(message) ? 503 :
    /Insufficient|Not enough|must be|Valid |required|BUY or SELL/i.test(message) ? 400 : 500;
  return res.status(status).json({ success: false, message });
}

function requireUser(req, res) {
  const userId = service.getUserId(req);
  if (!userId) {
    res.status(401).json({ success: false, message: 'Authentication required.' });
    return null;
  }
  return userId;
}

exports.account = async (req, res) => {
  try {
    const userId = requireUser(req, res); if (!userId) return;
    res.json({ success: true, data: await service.getAccount(userId) });
  } catch (e) { sendError(res, e); }
};

exports.placeOrder = async (req, res) => {
  try {
    const userId = requireUser(req, res); if (!userId) return;
    const data = await service.placeOrder(userId, req.body || {});
    res.status(201).json({ success: true, message: 'Paper order filled (simulated).', data });
  } catch (e) { sendError(res, e); }
};

exports.positions = async (req, res) => {
  try {
    const userId = requireUser(req, res); if (!userId) return;
    res.json({ success: true, data: await service.getPositions(userId) });
  } catch (e) { sendError(res, e); }
};

exports.orders = async (req, res) => {
  try {
    const userId = requireUser(req, res); if (!userId) return;
    res.json({ success: true, data: await service.getOrders(userId, req.query.limit) });
  } catch (e) { sendError(res, e); }
};

exports.reset = async (req, res) => {
  try {
    const userId = requireUser(req, res); if (!userId) return;
    res.json({ success: true, message: 'Paper account reset.', data: await service.resetAccount(userId) });
  } catch (e) { sendError(res, e); }
};
