'use strict';

const mongoose = require('mongoose');

const paperTradeSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  instrumentKey: { type: String, required: true },
  symbol: { type: String, required: true },
  exchange: { type: String, default: 'NSE' },
  side: { type: String, enum: ['BUY', 'SELL'], required: true },
  orderType: { type: String, enum: ['MARKET'], default: 'MARKET' },
  quantity: { type: Number, required: true, min: 1 },
  fillPrice: { type: Number, required: true, min: 0 },
  grossAmount: { type: Number, required: true, min: 0 },
  fee: { type: Number, required: true, min: 0 },
  netAmount: { type: Number, required: true, min: 0 },
  realizedPnl: { type: Number, default: 0 },
  status: { type: String, enum: ['FILLED'], default: 'FILLED' },
  executedAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

paperTradeSchema.index({ userId: 1, executedAt: -1 });

module.exports = mongoose.models.PaperTrade ||
  mongoose.model('PaperTrade', paperTradeSchema);
