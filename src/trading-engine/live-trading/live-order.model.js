'use strict';
const mongoose = require('mongoose');

const liveOrderSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  broker: { type: String, enum: ['UPSTOX'], default: 'UPSTOX' },
  instrumentKey: { type: String, required: true },
  symbol: { type: String, required: true },
  exchange: { type: String, required: true },
  side: { type: String, enum: ['BUY', 'SELL'], required: true },
  orderType: { type: String, enum: ['MARKET', 'LIMIT'], required: true },
  product: { type: String, enum: ['D'], default: 'D' },
  quantity: { type: Number, required: true },
  limitPrice: { type: Number, default: 0 },
  previewLtp: { type: Number, default: null },
  pendingToken: { type: String, index: true, sparse: true },
  pendingExpiresAt: { type: Date, default: null },
  confirmationPhraseAccepted: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ['PREVIEWED', 'SUBMITTING', 'SUBMISSION_UNKNOWN', 'SUBMITTED', 'REJECTED', 'CANCEL_REQUESTED', 'CANCELLED'],
    default: 'PREVIEWED',
    index: true
  },
  upstoxOrderId: { type: String, default: null, index: true },
  upstoxResponse: { type: mongoose.Schema.Types.Mixed, default: null },
  errorMessage: { type: String, default: null },
  idempotencyKey: { type: String, required: true },
  submittedAt: { type: Date, default: null },
}, { timestamps: true });

liveOrderSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });
liveOrderSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.models.LiveOrder || mongoose.model('LiveOrder', liveOrderSchema);
