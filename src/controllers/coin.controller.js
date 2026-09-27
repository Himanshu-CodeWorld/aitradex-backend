const coinService = require("../services/coin.service");

/**
 * ==========================================================
 * GET FIREBASE UID
 * ==========================================================
 *
 * Supports all Firebase request locations populated by
 * auth.middleware.js:
 *
 *   req.user.uid
 *   req.firebaseUser.uid
 *   req.auth.uid
 *
 * Also supports firebaseUid if another middleware/service
 * attaches it.
 */
function getFirebaseUid(req) {
  return (
    req?.user?.uid ||
    req?.user?.firebaseUid ||
    req?.firebaseUser?.uid ||
    req?.firebaseUser?.firebaseUid ||
    req?.auth?.uid ||
    req?.auth?.firebaseUid ||
    null
  );
}

/**
 * ==========================================================
 * GET COIN BALANCE
 * ==========================================================
 */
const getBalance = async (req, res) => {
  try {
    const firebaseUid = getFirebaseUid(req);

    console.log("💰 GET COIN BALANCE");
    console.log("Firebase UID:", firebaseUid || "NOT FOUND");

    if (!firebaseUid) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
        code: "FIREBASE_UID_MISSING",
      });
    }

    const data = await coinService.getBalance(firebaseUid);

    const balance = Number(data?.balance) || 0;
    const amountInr = Number(data?.amountInr) || 0;

    return res.status(200).json({
      success: true,
      message: "Coin balance retrieved successfully.",
      balance,
      amountInr,
      data: {
        balance,
        amountInr,
        coinValueInr: Number(coinService.COIN_RUPEE_VALUE) || 1,
        stockUnlockCost:
          Number(coinService.STOCK_UNLOCK_COST) || 100,
      },
    });
  } catch (error) {
    console.error("GET COIN BALANCE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve coin balance.",
      code: "COIN_BALANCE_ERROR",
    });
  }
};

/**
 * ==========================================================
 * GET COIN HISTORY
 * ==========================================================
 */
const getHistory = async (req, res) => {
  try {
    const firebaseUid = getFirebaseUid(req);

    console.log("📜 GET COIN HISTORY");
    console.log("Firebase UID:", firebaseUid || "NOT FOUND");

    if (!firebaseUid) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
        code: "FIREBASE_UID_MISSING",
      });
    }

    const page = req.query?.page;
    const limit = req.query?.limit;

    const data = await coinService.getHistory({
      firebaseUid,
      page,
      limit,
    });

    const transactions = Array.isArray(data?.transactions)
      ? data.transactions
      : [];

    return res.status(200).json({
      success: true,
      message: "Coin history retrieved successfully.",
      transactions,
      pagination: data?.pagination || {
        page: Number(page) || 1,
        limit: Number(limit) || 20,
        total: transactions.length,
        totalPages: 1,
      },
      data: {
        transactions,
        pagination: data?.pagination || {
          page: Number(page) || 1,
          limit: Number(limit) || 20,
          total: transactions.length,
          totalPages: 1,
        },
      },
    });
  } catch (error) {
    console.error("GET COIN HISTORY ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve coin history.",
      code: "COIN_HISTORY_ERROR",
    });
  }
};

/**
 * ==========================================================
 * UNLOCK STOCK
 * ==========================================================
 */
const unlockStock = async (req, res) => {
  try {
    const firebaseUid = getFirebaseUid(req);

    console.log("🔓 UNLOCK STOCK");
    console.log("Firebase UID:", firebaseUid || "NOT FOUND");

    if (!firebaseUid) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
        code: "FIREBASE_UID_MISSING",
      });
    }

    const symbol = String(req.body?.symbol || "")
      .trim()
      .toUpperCase();

    if (!symbol) {
      return res.status(400).json({
        success: false,
        message: "Stock symbol is required.",
        code: "SYMBOL_REQUIRED",
      });
    }

    const data = await coinService.unlockStock({
      firebaseUid,
      symbol,
    });

    const balance = Number(data?.balance) || 0;
    const charged = Boolean(data?.charged);

    return res.status(200).json({
      success: true,
      message: charged
        ? `Stock intelligence unlocked for ${
            Number(coinService.STOCK_UNLOCK_COST) || 100
          } Coins.`
        : "Stock intelligence is already unlocked.",
      balance,
      data: {
        ...(data || {}),
        symbol,
        charged,
        balance,
        coinValueInr:
          Number(coinService.COIN_RUPEE_VALUE) || 1,
        stockUnlockCost:
          Number(coinService.STOCK_UNLOCK_COST) || 100,
      },
    });
  } catch (error) {
    console.error("UNLOCK STOCK ERROR:", error);

    /**
     * ========================================================
     * INSUFFICIENT COINS
     * ========================================================
     */
    if (error?.code === "INSUFFICIENT_COINS") {
      const requiredCoins =
        Number(coinService.STOCK_UNLOCK_COST) || 100;

      const coinValue =
        Number(coinService.COIN_RUPEE_VALUE) || 1;

      return res.status(402).json({
        success: false,
        code: "INSUFFICIENT_COINS",
        message:
          error?.message ||
          "Insufficient AiTradeX Coins.",
        data: {
          balance: Number(error?.balance) || 0,
          requiredCoins,
          requiredAmountInr:
            requiredCoins * coinValue,
        },
      });
    }

    /**
     * ========================================================
     * STOCK ALREADY UNLOCKED
     * ========================================================
     */
    if (error?.code === "STOCK_ALREADY_UNLOCKED") {
      return res.status(200).json({
        success: true,
        message: "Stock intelligence is already unlocked.",
        data: {
          unlocked: true,
          charged: false,
        },
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to unlock stock intelligence.",
      code: "STOCK_UNLOCK_ERROR",
    });
  }
};

/**
 * ==========================================================
 * CHECK STOCK UNLOCK
 * ==========================================================
 */
const checkStockUnlock = async (req, res) => {
  try {
    const firebaseUid = getFirebaseUid(req);

    console.log("🔍 CHECK STOCK UNLOCK");
    console.log("Firebase UID:", firebaseUid || "NOT FOUND");

    if (!firebaseUid) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
        code: "FIREBASE_UID_MISSING",
      });
    }

    const symbol = String(req.params?.symbol || "")
      .trim()
      .toUpperCase();

    if (!symbol) {
      return res.status(400).json({
        success: false,
        message: "Stock symbol is required.",
        code: "SYMBOL_REQUIRED",
      });
    }

    const data = await coinService.hasStockUnlock({
      firebaseUid,
      symbol,
    });

    return res.status(200).json({
      success: true,
      unlocked: Boolean(data?.unlocked),
      data: {
        ...(data || {}),
        symbol,
        unlocked: Boolean(data?.unlocked),
      },
    });
  } catch (error) {
    console.error("CHECK STOCK UNLOCK ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to check stock unlock.",
      code: "CHECK_STOCK_UNLOCK_ERROR",
    });
  }
};

/**
 * ==========================================================
 * EXPORTS
 * ==========================================================
 */
module.exports = {
  getBalance,
  getHistory,
  unlockStock,
  checkStockUnlock,
};