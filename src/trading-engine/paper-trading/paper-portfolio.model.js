'use strict';

const mongoose = require('mongoose');

const paperPositionSchema = new mongoose.Schema({
  instrumentKey: { type: String, required: true },
  symbol: { type: String, required: true },
  exchange: { type: String, default: 'NSE' },
  quantity: { type: Number, required: true, min: 0 },
  averagePrice: { type: Number, required: true, min: 0 },
  investedValue: { type: Number, required: true, min: 0 },
  realizedPnl: { type: Number, default: 0 },
}, { _id: false });

const paperPortfolioSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  startingCash: { type: Number, required: true },
  cashBalance: { type: Number, required: true },
  positions: { type: [paperPositionSchema], default: [] },
  totalFees: { type: Number, default: 0 },
  resetAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.models.PaperPortfolio ||
  mongoose.model('PaperPortfolio', paperPortfolioSchema);
