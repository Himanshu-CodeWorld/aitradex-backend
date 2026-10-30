"use strict";

const mongoose = require("mongoose");

const backtestRunSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true, trim: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  symbol: { type: String, required: true, uppercase: true, trim: true, maxlength: 30 },
  exchange: { type: String, required: true, uppercase: true, enum: ["NSE", "BSE"] },
  period: {
    startDate: { type: String, default: "" },
    endDate: { type: String, default: "" },
    candlesTested: { type: Number, default: 0 },
  },
  parameters: { type: mongoose.Schema.Types.Mixed, default: {} },
  metrics: { type: mongoose.Schema.Types.Mixed, default: {} },
  comparison: { type: mongoose.Schema.Types.Mixed, default: {} },
  result: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true, versionKey: false, minimize: false });

backtestRunSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.models.BacktestRun || mongoose.model("BacktestRun", backtestRunSchema);
