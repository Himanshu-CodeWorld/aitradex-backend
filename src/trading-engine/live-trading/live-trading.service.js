'use strict';

const axios = require('axios');
const crypto = require('crypto');
const LiveOrder = require('./live-order.model');
const { getAccessTokenForFirebaseUid } = require('./upstox-token.adapter');

const API = (process.env.UPSTOX_API_BASE_URL || 'https://api.upstox.com/v2').replace(/\/$/, '');
const ORDER_API = (process.env.UPSTOX_ORDER_API_BASE_URL || 'https://api-hft.upstox.com/v2').replace(/\/$/, '');
const TTL = Math.min(Math.max(Number(process.env.LIVE_ORDER_PREVIEW_TTL_SECONDS || 120), 30), 300);

function uid(req) { return req.user?.uid || req.user?.id || req.userId || req.auth?.uid || null; }
function enabled() { return process.env.LIVE_TRADING_ENABLED === 'true'; }
function validateInput(x) {
  const instrumentKey = String(x.instrumentKey || '').trim();
  const symbol = String(x.symbol || '').trim().toUpperCase();
  const exchange = String(x.exchange || 'NSE').toUpperCase();
  const side = String(x.side || '').toUpperCase();
  const orderType = String(x.orderType || 'MARKET').toUpperCase();
  const quantity = Number(x.quantity);
  const limitPrice = Number(x.limitPrice || 0);
  if (!instrumentKey || instrumentKey.length > 180) throw new Error('Valid Upstox instrument key is required.');
  if (!symbol || symbol.length > 40) throw new Error('Valid stock symbol is required.');
  if (!['NSE', 'BSE'].includes(exchange)) throw new Error('Only NSE and BSE equity are supported in this release.');
  if (!['BUY', 'SELL'].includes(side)) throw new Error('Side must be BUY or SELL.');
  if (!['MARKET', 'LIMIT'].includes(orderType)) throw new Error('Only MARKET and LIMIT orders are supported.');
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100000) throw new Error('Quantity must be a whole number between 1 and 100,000.');
  if (orderType === 'LIMIT' && (!Number.isFinite(limitPrice) || limitPrice <= 0)) throw new Error('A valid limit price is required.');
  if (orderType === 'MARKET' && limitPrice !== 0) throw new Error('Do not provide a limit price for a MARKET order.');
  return { instrumentKey, symbol, exchange, side, orderType, quantity, limitPrice };
}
async function tokenFor(userId) {
  try { return await getAccessTokenForFirebaseUid(userId); }
  catch (e) { throw new Error(e.message || 'Active Upstox connection is required.'); }
}
async function apiRequest(token, method, url, data, params) {
  const response = await axios({ method, url, data, params, timeout: 15000, headers: {
    Authorization: `Bearer ${token}`, Accept: 'application/json',
    'Content-Type': 'application/json', 'Api-Version': '2.0'
  }});
  return response.data;
}
async function quote(token, instrumentKey) {
  const response = await apiRequest(token, 'GET', `${API}/market-quote/ltp`, null, { instrument_key: instrumentKey });
  const qdata = response?.data || {};
  const q = qdata[instrumentKey] || Object.values(qdata)[0];
  const price = Number(q?.last_price);
  if (!Number.isFinite(price) || price <= 0) throw new Error('Latest Upstox price is unavailable for this instrument.');
  return price;
}
async function createPreview(userId, raw) {
  if (!enabled()) throw new Error('Live trading is disabled by the server.');
  const input = validateInput(raw);
  const token = await tokenFor(userId);
  const ltp = await quote(token, input.instrumentKey);
  const pendingToken = crypto.randomBytes(24).toString('hex');
  const idempotencyKey = crypto.randomUUID();
  const expires = new Date(Date.now() + TTL * 1000);
  const doc = await LiveOrder.create({
    userId, ...input, product: 'D', previewLtp: ltp,
    pendingToken, pendingExpiresAt: expires, idempotencyKey, status: 'PREVIEWED'
  });
  return {
    previewId: String(doc._id), symbol: doc.symbol, exchange: doc.exchange,
    instrumentKey: doc.instrumentKey, side: doc.side, orderType: doc.orderType,
    product: 'D', quantity: doc.quantity, ltp,
    estimatedValue: (doc.orderType === 'LIMIT' ? doc.limitPrice : ltp) * doc.quantity,
    limitPrice: doc.limitPrice, expiresAt: expires,
    confirmationPhrase: 'PLACE LIVE ORDER'
  };
}
async function confirmOrder(userId, previewId, phrase) {
  if (!enabled()) throw new Error('Live trading is disabled by the server.');
  if (phrase !== 'PLACE LIVE ORDER') throw new Error('Explicit live-order confirmation phrase is required.');
  if (!/^[a-f0-9]{24}$/i.test(String(previewId || ''))) throw new Error('Invalid preview ID.');
  const doc = await LiveOrder.findOne({ _id: previewId, userId });
  if (!doc) throw new Error('Order preview not found.');
  if (doc.status !== 'PREVIEWED') throw new Error(`This preview cannot be submitted (status: ${doc.status}).`);
  if (!doc.pendingExpiresAt || doc.pendingExpiresAt.getTime() < Date.now()) throw new Error('Order preview expired. Create a new preview.');
  const token = await tokenFor(userId);
  // Recheck quote immediately before sending. Never trust client quote or amount.
  const latest = await quote(token, doc.instrumentKey);
  if (doc.orderType === 'LIMIT' && Math.abs(latest - doc.previewLtp) / doc.previewLtp > 0.10) {
    throw new Error('Market price moved more than 10% since preview. Review a new preview before submitting.');
  }
  // Atomically claim preview to stop concurrent/double submissions.
  const claimed = await LiveOrder.findOneAndUpdate(
    { _id: doc._id, userId, status: 'PREVIEWED', pendingExpiresAt: { $gt: new Date() } },
    { $set: { status: 'SUBMITTING', confirmationPhraseAccepted: true, pendingToken: null } },
    { new: true }
  );
  if (!claimed) throw new Error('This order was already submitted or the preview expired.');
  const tag = `ATX${String(claimed._id).slice(-12)}`;
  const payload = {
    quantity: claimed.quantity,
    product: 'D',
    validity: 'DAY',
    price: claimed.orderType === 'LIMIT' ? claimed.limitPrice : 0,
    tag,
    instrument_token: claimed.instrumentKey,
    order_type: claimed.orderType,
    transaction_type: claimed.side,
    disclosed_quantity: 0,
    trigger_price: 0,
    is_amo: false,
    ...(claimed.orderType === 'MARKET' ? { market_protection: -1 } : {})
  };
  try {
    const response = await apiRequest(token, 'POST', `${ORDER_API}/order/place`, payload);
    const orderId = response?.data?.order_id;
    if (!orderId) {
      await LiveOrder.updateOne({ _id: claimed._id }, { $set: {
        status: 'SUBMISSION_UNKNOWN', upstoxResponse: response,
        errorMessage: 'Broker response did not include an order ID. Check Upstox order book before retrying.'
      }});
      throw new Error('Broker submission result is uncertain. Check your Upstox order book; do not retry blindly.');
    }
    const saved = await LiveOrder.findOneAndUpdate({ _id: claimed._id, userId }, {
      $set: { status: 'SUBMITTED', upstoxOrderId: String(orderId), upstoxResponse: response, submittedAt: new Date() }
    }, { new: true });
    return { orderId: String(orderId), status: saved.status, broker: 'UPSTOX', symbol: saved.symbol, side: saved.side };
  } catch (e) {
    if (e.response) {
      await LiveOrder.updateOne({ _id: claimed._id }, { $set: {
        status: 'REJECTED',
        errorMessage: e.response.data?.errors?.[0]?.message || e.response.data?.message || 'Upstox rejected the order.',
        upstoxResponse: e.response.data
      }});
      throw new Error(e.response.data?.errors?.[0]?.message || e.response.data?.message || 'Upstox rejected the order.');
    }
    // Network failures after request may be ambiguous. Never auto-retry a live order.
    await LiveOrder.updateOne({ _id: claimed._id }, { $set: {
      status: 'SUBMISSION_UNKNOWN',
      errorMessage: 'Network outcome is uncertain. Check Upstox order book before any retry.'
    }});
    throw new Error('Order submission outcome is uncertain. Check Upstox order book before taking further action.');
  }
}
async function orderBook(userId) {
  const token = await tokenFor(userId);
  const response = await apiRequest(token, 'GET', `${API}/order/retrieve-all`);
  return Array.isArray(response?.data) ? response.data : [];
}
async function orderDetails(userId, orderId) {
  const local = await LiveOrder.findOne({ userId, upstoxOrderId: String(orderId) });
  if (!local) throw new Error('Order not found for this account.');
  const token = await tokenFor(userId);
  return apiRequest(token, 'GET', `${API}/order/details`, null, { order_id: String(orderId) });
}
async function cancelOrder(userId, orderId) {
  const local = await LiveOrder.findOne({ userId, upstoxOrderId: String(orderId) });
  if (!local) throw new Error('Order not found for this account.');
  const token = await tokenFor(userId);
  const response = await apiRequest(token, 'DELETE', `${API}/order/cancel`, null, { order_id: String(orderId) });
  await LiveOrder.updateOne({ _id: local._id }, { $set: { status: 'CANCEL_REQUESTED', upstoxResponse: response } });
  return response;
}
async function localHistory(userId, limit=100) {
  return LiveOrder.find({ userId }).sort({ createdAt: -1 }).limit(Math.min(Math.max(Number(limit)||100,1),200))
    .select('-pendingToken -upstoxResponse').lean();
}
module.exports = { uid, createPreview, confirmOrder, orderBook, orderDetails, cancelOrder, localHistory };
