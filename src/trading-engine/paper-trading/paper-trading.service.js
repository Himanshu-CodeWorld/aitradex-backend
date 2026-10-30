'use strict';

const axios = require('axios');
const mongoose = require('mongoose');
const PaperPortfolio = require('./paper-portfolio.model');
const PaperTrade = require('./paper-trade.model');

const STARTING_CASH = Number(process.env.PAPER_TRADING_STARTING_CASH || 1000000);
const FEE_BPS = Number(process.env.PAPER_TRADING_FEE_BPS || 5);

function getUserId(req) {
  return req.user?.uid || req.user?.id || req.userId || req.auth?.uid || null;
}

async function getLtp(instrumentKey) {
  const token = process.env.UPSTOX_ACCESS_TOKEN;
  if (!token) throw new Error('Paper trading market data is not configured on the server.');
  const base = (process.env.UPSTOX_MARKET_API_BASE_URL || 'https://api.upstox.com/v2').replace(/\/$/, '');
  const response = await axios.get(`${base}/market-quote/ltp`, {
    params: { instrument_key: instrumentKey },
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    timeout: 10000,
  });
  const data = response.data?.data || {};
  const quote = data[instrumentKey] || Object.values(data)[0];
  const ltp = Number(quote?.last_price);
  if (!Number.isFinite(ltp) || ltp <= 0) throw new Error('A valid live market price is not available.');
  return ltp;
}

async function getOrCreatePortfolio(userId, session = null) {
  let query = PaperPortfolio.findOne({ userId });
  if (session) query = query.session(session);
  let portfolio = await query;
  if (!portfolio) {
    portfolio = new PaperPortfolio({
      userId,
      startingCash: STARTING_CASH,
      cashBalance: STARTING_CASH,
      positions: [],
    });
    await portfolio.save(session ? { session } : undefined);
  }
  return portfolio;
}

async function getAccount(userId) {
  const portfolio = await getOrCreatePortfolio(userId);
  const positions = portfolio.positions.filter(p => p.quantity > 0);
  return {
    startingCash: portfolio.startingCash,
    cashBalance: portfolio.cashBalance,
    totalFees: portfolio.totalFees,
    positionCount: positions.length,
    positions,
    resetAt: portfolio.resetAt,
  };
}

async function placeOrder(userId, input) {
  const instrumentKey = String(input.instrumentKey || '').trim();
  const symbol = String(input.symbol || '').trim().toUpperCase();
  const side = String(input.side || '').toUpperCase();
  const quantity = Number(input.quantity);
  const exchange = String(input.exchange || 'NSE').toUpperCase();

  if (!instrumentKey || instrumentKey.length > 180) throw new Error('Valid instrumentKey is required.');
  if (!symbol || symbol.length > 40) throw new Error('Valid symbol is required.');
  if (!['BUY', 'SELL'].includes(side)) throw new Error('Side must be BUY or SELL.');
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000000) {
    throw new Error('Quantity must be a whole number between 1 and 1,000,000.');
  }

  // Price is always fetched on the server; client-supplied prices are ignored.
  const fillPrice = await getLtp(instrumentKey);
  const gross = fillPrice * quantity;
  const fee = gross * (FEE_BPS / 10000);
  const session = await mongoose.startSession();
  let result;

  try {
    await session.withTransaction(async () => {
      const portfolio = await getOrCreatePortfolio(userId, session);
      let position = portfolio.positions.find(p => p.instrumentKey === instrumentKey);

      if (side === 'BUY') {
        const totalDebit = gross + fee;
        if (portfolio.cashBalance + 1e-8 < totalDebit) {
          throw new Error('Insufficient virtual cash for this order.');
        }
        portfolio.cashBalance -= totalDebit;
        if (!position) {
          portfolio.positions.push({
            instrumentKey, symbol, exchange, quantity,
            averagePrice: fillPrice, investedValue: gross,
            realizedPnl: 0,
          });
        } else {
          const oldCost = position.averagePrice * position.quantity;
          const newQty = position.quantity + quantity;
          position.averagePrice = (oldCost + gross) / newQty;
          position.quantity = newQty;
          position.investedValue = position.averagePrice * newQty;
          position.symbol = symbol;
          position.exchange = exchange;
        }
      } else {
        if (!position || position.quantity < quantity) {
          throw new Error('Not enough virtual holdings to sell this quantity.');
        }
        const costBasis = position.averagePrice * quantity;
        const realizedBeforeFees = gross - costBasis;
        position.quantity -= quantity;
        position.investedValue = position.averagePrice * position.quantity;
        position.realizedPnl += realizedBeforeFees - fee;
        portfolio.cashBalance += gross - fee;
        if (position.quantity === 0) {
          portfolio.positions = portfolio.positions.filter(p => p.instrumentKey !== instrumentKey);
        }
      }

      portfolio.totalFees += fee;
      await portfolio.save({ session });

      const trade = new PaperTrade({
        userId, instrumentKey, symbol, exchange, side, quantity,
        fillPrice, grossAmount: gross, fee,
        netAmount: side === 'BUY' ? gross + fee : gross - fee,
        realizedPnl: side === 'SELL' ? gross - (fillPrice * 0 + (position?.averagePrice || fillPrice)) * quantity - fee : 0,
      });
      await trade.save({ session });
      result = { trade, cashBalance: portfolio.cashBalance };
    });
  } finally {
    await session.endSession();
  }
  return result;
}

async function getPositions(userId) {
  const portfolio = await getOrCreatePortfolio(userId);
  const positions = portfolio.positions.filter(p => p.quantity > 0);
  const enriched = await Promise.all(positions.map(async p => {
    let ltp = null;
    let quoteError = null;
    try { ltp = await getLtp(p.instrumentKey); }
    catch (e) { quoteError = e.message; }
    const marketValue = ltp == null ? null : ltp * p.quantity;
    const unrealizedPnl = marketValue == null ? null : marketValue - (p.averagePrice * p.quantity);
    return {
      instrumentKey: p.instrumentKey, symbol: p.symbol, exchange: p.exchange,
      quantity: p.quantity, averagePrice: p.averagePrice, ltp,
      investedValue: p.averagePrice * p.quantity, marketValue,
      unrealizedPnl, unrealizedPnlPercent: (unrealizedPnl == null || !p.averagePrice) ? null :
        (unrealizedPnl / (p.averagePrice * p.quantity)) * 100,
      realizedPnl: p.realizedPnl, quoteError,
    };
  }));
  return enriched;
}

async function getOrders(userId, limit = 100) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 300);
  return PaperTrade.find({ userId }).sort({ executedAt: -1 }).limit(safeLimit).lean();
}

async function resetAccount(userId) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await PaperTrade.deleteMany({ userId }).session(session);
      await PaperPortfolio.findOneAndUpdate(
        { userId },
        {
          $set: {
            startingCash: STARTING_CASH,
            cashBalance: STARTING_CASH,
            positions: [],
            totalFees: 0,
            resetAt: new Date(),
          },
          $setOnInsert: { userId },
        },
        { upsert: true, new: true, session },
      );
    });
  } finally {
    await session.endSession();
  }
  return getAccount(userId);
}

module.exports = { getUserId, getAccount, placeOrder, getPositions, getOrders, resetAccount };
