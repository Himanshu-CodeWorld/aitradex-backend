const mongoose = require("mongoose");

const CoinWallet = require("../models/CoinWallet");
const CoinTransaction = require("../models/CoinTransaction");
const CoinStockUnlock = require("../models/CoinStockUnlock");

const STOCK_UNLOCK_COST = 100;
const COIN_RUPEE_VALUE = 1;

/**
 * 1 AiTradeX Coin = ₹1 for the in-app coin pricing model.
 */
const getOrCreateWallet = async (firebaseUid, options = {}) => {
  const { session = null } = options;

  const normalizedUid = String(firebaseUid || "").trim();

  if (!normalizedUid) {
    throw new Error("Firebase UID is required.");
  }

  let wallet = await CoinWallet.findOne({
    firebaseUid: normalizedUid,
  }).session(session);

  if (!wallet) {
    try {
      const created = await CoinWallet.create(
        [
          {
            firebaseUid: normalizedUid,
            balance: 0,
          },
        ],
        session ? { session } : undefined
      );

      wallet = created[0];
    } catch (error) {
      // Another request may have created the wallet concurrently.
      if (error.code === 11000) {
        wallet = await CoinWallet.findOne({
          firebaseUid: normalizedUid,
        }).session(session);
      } else {
        throw error;
      }
    }
  }

  return wallet;
};

const getBalance = async (firebaseUid) => {
  const wallet = await getOrCreateWallet(firebaseUid);

  const balance = Number(wallet.balance) || 0;

  return {
    balance,
    amountInr: balance * COIN_RUPEE_VALUE,
  };
};

/**
 * Credit coins from a trusted backend operation.
 *
 * IMPORTANT:
 * Do not expose this function directly as a public user endpoint.
 * Call it from verified referral/profile/reward/payment/admin logic.
 */
const creditCoins = async ({
  firebaseUid,
  amount,
  type = "credit",
  description,
  referenceId = "",
  symbol = "",
}) => {
  const numericAmount = Number(amount);

  if (!Number.isInteger(numericAmount) || numericAmount <= 0) {
    throw new Error("Credit amount must be a positive integer.");
  }

  if (!description || !String(description).trim()) {
    throw new Error("Transaction description is required.");
  }

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const wallet = await getOrCreateWallet(firebaseUid, { session });

      wallet.balance += numericAmount;
      await wallet.save({ session });

      const transaction = await CoinTransaction.create(
        [
          {
            firebaseUid,
            type,
            amount: numericAmount,
            balanceAfter: wallet.balance,
            amountInr: numericAmount * COIN_RUPEE_VALUE,
            symbol: symbol ? String(symbol).trim().toUpperCase() : "",
            description: String(description).trim(),
            referenceId: String(referenceId || "").trim(),
          },
        ],
        { session }
      );

      result = {
        balance: wallet.balance,
        amountInr: wallet.balance * COIN_RUPEE_VALUE,
        transaction: transaction[0],
      };
    });

    return result;
  } finally {
    await session.endSession();
  }
};

/**
 * Unlock one stock intelligence report.
 *
 * Cost: exactly 100 Coins.
 * The operation is idempotent for a user + symbol:
 * once unlocked, opening the same stock again does not charge again.
 */
const unlockStock = async ({ firebaseUid, symbol }) => {
  const normalizedSymbol = String(symbol || "").trim().toUpperCase();

  if (!/^[A-Z0-9._-]{1,30}$/.test(normalizedSymbol)) {
    throw new Error("A valid stock symbol is required.");
  }

  const alreadyUnlocked = await CoinStockUnlock.findOne({
    firebaseUid,
    symbol: normalizedSymbol,
  });

  if (alreadyUnlocked) {
    const balance = await getBalance(firebaseUid);

    return {
      unlocked: true,
      alreadyUnlocked: true,
      charged: false,
      coinsCharged: 0,
      balance: balance.balance,
      amountInr: balance.amountInr,
      unlock: alreadyUnlocked,
    };
  }

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      // Re-check inside the transaction to prevent duplicate charges.
      const existing = await CoinStockUnlock.findOne({
        firebaseUid,
        symbol: normalizedSymbol,
      }).session(session);

      if (existing) {
        const wallet = await getOrCreateWallet(firebaseUid, { session });

        result = {
          unlocked: true,
          alreadyUnlocked: true,
          charged: false,
          coinsCharged: 0,
          balance: wallet.balance,
          amountInr: wallet.balance * COIN_RUPEE_VALUE,
          unlock: existing,
        };

        return;
      }

      // Atomic balance check + deduction.
      const wallet = await CoinWallet.findOneAndUpdate(
        {
          firebaseUid,
          balance: { $gte: STOCK_UNLOCK_COST },
        },
        {
          $inc: { balance: -STOCK_UNLOCK_COST },
        },
        {
          new: true,
          session,
        }
      );

      if (!wallet) {
        const currentWallet = await getOrCreateWallet(firebaseUid, {
          session,
        });

        const error = new Error(
          `Insufficient coins. You have ${currentWallet.balance} Coins, but ${STOCK_UNLOCK_COST} Coins are required.`
        );
        error.code = "INSUFFICIENT_COINS";
        error.balance = currentWallet.balance;
        throw error;
      }

      const unlock = await CoinStockUnlock.create(
        [
          {
            firebaseUid,
            symbol: normalizedSymbol,
            coinsPaid: STOCK_UNLOCK_COST,
          },
        ],
        { session }
      );

      const transaction = await CoinTransaction.create(
        [
          {
            firebaseUid,
            type: "stock_unlock",
            amount: -STOCK_UNLOCK_COST,
            balanceAfter: wallet.balance,
            amountInr: STOCK_UNLOCK_COST * COIN_RUPEE_VALUE,
            symbol: normalizedSymbol,
            description: `${normalizedSymbol} stock intelligence unlocked`,
            referenceId: unlock[0]._id.toString(),
          },
        ],
        { session }
      );

      result = {
        unlocked: true,
        alreadyUnlocked: false,
        charged: true,
        coinsCharged: STOCK_UNLOCK_COST,
        balance: wallet.balance,
        amountInr: wallet.balance * COIN_RUPEE_VALUE,
        unlock: unlock[0],
        transaction: transaction[0],
      };
    });

    return result;
  } catch (error) {
    // Unique-index race: if another request unlocked it first,
    // return the already-unlocked state instead of charging again.
    if (error.code === 11000) {
      const existing = await CoinStockUnlock.findOne({
        firebaseUid,
        symbol: normalizedSymbol,
      });

      if (existing) {
        const balance = await getBalance(firebaseUid);

        return {
          unlocked: true,
          alreadyUnlocked: true,
          charged: false,
          coinsCharged: 0,
          balance: balance.balance,
          amountInr: balance.amountInr,
          unlock: existing,
        };
      }
    }

    throw error;
  } finally {
    await session.endSession();
  }
};

const hasStockUnlock = async ({ firebaseUid, symbol }) => {
  const normalizedSymbol = String(symbol || "").trim().toUpperCase();

  const unlock = await CoinStockUnlock.findOne({
    firebaseUid,
    symbol: normalizedSymbol,
  });

  return {
    unlocked: Boolean(unlock),
    unlock,
  };
};

const getHistory = async ({
  firebaseUid,
  page = 1,
  limit = 20,
}) => {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(
    100,
    Math.max(1, Number(limit) || 20)
  );

  const skip = (safePage - 1) * safeLimit;

  const [transactions, total] = await Promise.all([
    CoinTransaction.find({ firebaseUid })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),

    CoinTransaction.countDocuments({ firebaseUid }),
  ]);

  return {
    transactions,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit),
    },
  };
};

module.exports = {
  COIN_RUPEE_VALUE,
  STOCK_UNLOCK_COST,
  getOrCreateWallet,
  getBalance,
  creditCoins,
  unlockStock,
  hasStockUnlock,
  getHistory,
};
