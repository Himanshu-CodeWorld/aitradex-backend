"use strict";

const Alert = require("./alert.model");
const axios = require("axios");
const { UpstoxMarketService } = require("../../upstox/upstox.market.service");
const { UPSTOX_CONFIG } = require("../../upstox/upstox.config");

const marketService = new UpstoxMarketService();
const POLL_INTERVAL_MS = Math.max(30000, Number(process.env.TRADING_ALERT_POLL_MS) || 60000);
const MAX_ALERTS_PER_CYCLE = 1000;
let monitorTimer = null;
let monitorBusy = false;

function fail(message, statusCode = 400, code = "ALERT_ERROR") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function validateAlert(input = {}) {
  const instrumentKey = String(input.instrumentKey || "").trim();
  const symbol = String(input.symbol || "").trim().toUpperCase();
  const type = String(input.type || "").trim().toUpperCase();
  const exchange = String(input.exchange || "NSE").toUpperCase();
  const targetPrice = input.targetPrice == null ? null : Number(input.targetPrice);
  const validTypes = ["PRICE_ABOVE", "PRICE_BELOW", "STOP_LOSS", "TARGET", "ORB_BULLISH", "ORB_BEARISH"];
  if (!instrumentKey || !symbol) throw fail("Instrument key and stock symbol are required.");
  if (!["NSE", "BSE"].includes(exchange)) throw fail("Exchange must be NSE or BSE.");
  if (!validTypes.includes(type)) throw fail("Unsupported alert type.");
  if (["PRICE_ABOVE", "PRICE_BELOW", "STOP_LOSS", "TARGET"].includes(type) &&
      (!Number.isFinite(targetPrice) || targetPrice <= 0)) {
    throw fail("A positive target price is required for this alert type.");
  }
  return {
    instrumentKey, symbol, exchange, type, targetPrice,
    cooldownMinutes: Math.max(1, Math.min(1440, Number(input.cooldownMinutes) || 30)),
    fcmToken: typeof input.fcmToken === "string" && input.fcmToken.length < 4096 ? input.fcmToken : null,
  };
}

async function createAlert(userId, input) {
  if (!userId) throw fail("Authenticated user is required.", 401, "AUTH_REQUIRED");
  const data = validateAlert(input);
  const count = await Alert.countDocuments({ userId, isEnabled: true });
  if (count >= 50) throw fail("You can have at most 50 active alerts.", 429, "ALERT_LIMIT_REACHED");
  return Alert.create({ ...data, userId });
}

async function listAlerts(userId) {
  return Alert.find({ userId }).sort({ createdAt: -1 }).select("-fcmToken").lean();
}

async function updateAlert(userId, id, patch = {}) {
  const allowed = {};
  if (patch.isEnabled !== undefined) allowed.isEnabled = Boolean(patch.isEnabled);
  if (patch.targetPrice !== undefined) {
    const price = Number(patch.targetPrice);
    if (!Number.isFinite(price) || price <= 0) throw fail("Target price must be greater than zero.");
    allowed.targetPrice = price;
  }
  if (patch.cooldownMinutes !== undefined) {
    allowed.cooldownMinutes = Math.max(1, Math.min(1440, Number(patch.cooldownMinutes) || 30));
  }
  if (patch.fcmToken !== undefined) {
    if (typeof patch.fcmToken !== "string" || patch.fcmToken.length > 4096) throw fail("Invalid device notification token.");
    allowed.fcmToken = patch.fcmToken;
  }
  const updated = await Alert.findOneAndUpdate({ _id: id, userId }, { $set: allowed }, { new: true }).select("-fcmToken");
  if (!updated) throw fail("Alert not found.", 404, "ALERT_NOT_FOUND");
  return updated;
}

async function deleteAlert(userId, id) {
  const deleted = await Alert.findOneAndDelete({ _id: id, userId });
  if (!deleted) throw fail("Alert not found.", 404, "ALERT_NOT_FOUND");
  return { deleted: true, id };
}

async function fetchLtp(instrumentKeys) {
  const token = marketService.getAccessToken();
  if (!token) throw fail("Upstox market-data token is unavailable.", 503, "UPSTOX_TOKEN_UNAVAILABLE");
  const url = `${UPSTOX_CONFIG.marketApiBaseUrl}/market-quote/ltp`;
  const response = await axios.get(url, {
    params: { instrument_key: instrumentKeys.join(",") },
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    timeout: UPSTOX_CONFIG.requestTimeoutMs || 15000,
  });
  const data = response?.data?.data || {};
  const map = new Map();
  for (const [key, quote] of Object.entries(data)) {
    const ltp = Number(quote?.last_price ?? quote?.ltp);
    if (Number.isFinite(ltp) && ltp > 0) map.set(key, ltp);
  }
  return map;
}

function isPriceTriggered(alert, ltp) {
  if (alert.type === "PRICE_ABOVE" || alert.type === "TARGET") return ltp >= alert.targetPrice;
  if (alert.type === "PRICE_BELOW" || alert.type === "STOP_LOSS") return ltp <= alert.targetPrice;
  return false;
}

async function sendPush(alert, ltp) {
  if (!alert.fcmToken) return { sent: false, reason: "NO_DEVICE_TOKEN" };
  const admin = require("firebase-admin");
  const app = admin.apps && admin.apps.length ? admin.app() : null;
  if (!app) return { sent: false, reason: "FIREBASE_ADMIN_NOT_INITIALIZED" };
  try {
    await admin.messaging(app).send({
      token: alert.fcmToken,
      notification: {
        title: `${alert.symbol} price alert`,
        body: `${alert.symbol} reached ₹${ltp.toFixed(2)}. Your ${alert.type.replaceAll("_", " ").toLowerCase()} condition was met.`,
      },
      data: {
        alertId: String(alert._id),
        instrumentKey: alert.instrumentKey,
        symbol: alert.symbol,
        type: alert.type,
        ltp: String(ltp),
      },
      android: { priority: "high", notification: { channelId: "aitradex_price_alerts" } },
    });
    return { sent: true };
  } catch (error) {
    if (error.code === "messaging/registration-token-not-registered" ||
        error.code === "messaging/invalid-registration-token") {
      await Alert.updateOne({ _id: alert._id }, { $unset: { fcmToken: 1 } });
    }
    return { sent: false, reason: error.code || "FCM_SEND_FAILED" };
  }
}

async function evaluatePriceAlerts() {
  if (monitorBusy) return { skipped: true, reason: "MONITOR_BUSY" };
  monitorBusy = true;
  try {
    const alerts = await Alert.find({
      isEnabled: true,
      isTriggered: false,
      type: { $in: ["PRICE_ABOVE", "PRICE_BELOW", "STOP_LOSS", "TARGET"] },
    }).limit(MAX_ALERTS_PER_CYCLE).select("+fcmToken").lean();

    if (!alerts.length) return { checked: 0, triggered: 0 };
    const keys = [...new Set(alerts.map((a) => a.instrumentKey))];
    const quotes = await fetchLtp(keys);
    let triggered = 0;
    for (const alert of alerts) {
      const ltp = quotes.get(alert.instrumentKey);
      if (!Number.isFinite(ltp)) continue;
      const now = new Date();
      await Alert.updateOne({ _id: alert._id }, { $set: { lastKnownPrice: ltp, lastCheckedAt: now, lastError: null } });
      if (!isPriceTriggered(alert, ltp)) continue;

      // Atomic claim prevents duplicate push sends when two server workers overlap.
      const claimed = await Alert.findOneAndUpdate(
        { _id: alert._id, isTriggered: false, isEnabled: true },
        { $set: { isTriggered: true, triggeredAt: now, lastKnownPrice: ltp, lastCheckedAt: now } },
        { new: true },
      ).select("+fcmToken");
      if (!claimed) continue;
      const delivery = await sendPush(claimed, ltp);
      if (!delivery.sent) {
        await Alert.updateOne({ _id: claimed._id }, { $set: { lastError: delivery.reason } });
      }
      triggered += 1;
    }
    return { checked: alerts.length, triggered };
  } finally {
    monitorBusy = false;
  }
}

function startAlertMonitor() {
  if (monitorTimer) return false;
  if (process.env.TRADING_ALERTS_ENABLED !== "true") {
    console.log("[Trading Alerts] Monitor disabled. Set TRADING_ALERTS_ENABLED=true to enable.");
    return false;
  }
  monitorTimer = setInterval(() => {
    evaluatePriceAlerts().catch((error) => console.error("[Trading Alerts] cycle failed:", error.message));
  }, POLL_INTERVAL_MS);
  if (typeof monitorTimer.unref === "function") monitorTimer.unref();
  console.log(`[Trading Alerts] Monitor started; interval=${POLL_INTERVAL_MS}ms`);
  return true;
}

module.exports = {
  createAlert, listAlerts, updateAlert, deleteAlert,
  evaluatePriceAlerts, startAlertMonitor,
};
