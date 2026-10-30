"use strict";
const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  instrumentKey: { type: String, required: true, trim: true },
  symbol: { type: String, required: true, trim: true, uppercase: true },
  exchange: { type: String, enum: ["NSE", "BSE"], default: "NSE" },
  type: {
    type: String,
    enum: ["PRICE_ABOVE", "PRICE_BELOW", "STOP_LOSS", "TARGET", "ORB_BULLISH", "ORB_BEARISH"],
    required: true,
  },
  targetPrice: { type: Number, min: 0 },
  isEnabled: { type: Boolean, default: true, index: true },
  isTriggered: { type: Boolean, default: false, index: true },
  triggeredAt: { type: Date, default: null },
  lastCheckedAt: { type: Date, default: null },
  cooldownMinutes: { type: Number, min: 1, max: 1440, default: 30 },
  fcmToken: { type: String, default: null, select: false },
  lastKnownPrice: { type: Number, default: null },
  lastError: { type: String, default: null },
}, { timestamps: true });

alertSchema.index({ userId: 1, isEnabled: 1, isTriggered: 1 });
module.exports = mongoose.models.TradingAlert || mongoose.model("TradingAlert", alertSchema);
