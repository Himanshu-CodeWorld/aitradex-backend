const coinService = require("../services/coin.service");

const getBalance = async (req, res) => {
  try {
    const firebaseUid = req.user?.uid || req.user?.firebaseUid;

    if (!firebaseUid) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    const data = await coinService.getBalance(firebaseUid);

    return res.status(200).json({
      success: true,
      message: "Coin balance retrieved successfully.",
      balance: Number(data.balance) || 0,
      amountInr: Number(data.amountInr) || 0,
      data: {
        balance: Number(data.balance) || 0,
        amountInr: Number(data.amountInr) || 0,
        coinValueInr: coinService.COIN_RUPEE_VALUE,
        stockUnlockCost: coinService.STOCK_UNLOCK_COST,
      },
    });
  } catch (error) {
    console.error("GET COIN BALANCE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve coin balance.",
    });
  }
};

const getHistory = async (req, res) => {
  try {
    const firebaseUid = req.user?.uid || req.user?.firebaseUid;

    if (!firebaseUid) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    const data = await coinService.getHistory({
      firebaseUid,
      page: req.query.page,
      limit: req.query.limit,
    });

    return res.status(200).json({
      success: true,
      message: "Coin history retrieved successfully.",
      transactions: Array.isArray(data.transactions) ? data.transactions : [],
      pagination: data.pagination,
      data: {
        transactions: Array.isArray(data.transactions)
          ? data.transactions
          : [],
        pagination: data.pagination,
      },
    });
  } catch (error) {
    console.error("GET COIN HISTORY ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve coin history.",
    });
  }
};

const unlockStock = async (req, res) => {
  try {
    const firebaseUid = req.user?.uid || req.user?.firebaseUid;

    if (!firebaseUid) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    const symbol = req.body?.symbol;

    if (!symbol || String(symbol).trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Stock symbol is required.",
      });
    }

    const data = await coinService.unlockStock({
      firebaseUid,
      symbol,
    });

    return res.status(200).json({
      success: true,
      message: data.charged
        ? "Stock intelligence unlocked for 100 Coins."
        : "Stock intelligence is already unlocked.",
      balance: Number(data.balance) || 0,
      data: {
        ...data,
        balance: Number(data.balance) || 0,
        coinValueInr: coinService.COIN_RUPEE_VALUE,
        stockUnlockCost: coinService.STOCK_UNLOCK_COST,
      },
    });
  } catch (error) {
    console.error("UNLOCK STOCK ERROR:", error);

    if (error.code === "INSUFFICIENT_COINS") {
      return res.status(402).json({
        success: false,
        code: "INSUFFICIENT_COINS",
        message: error.message,
        data: {
          balance: error.balance ?? 0,
          requiredCoins: coinService.STOCK_UNLOCK_COST,
          requiredAmountInr:
            coinService.STOCK_UNLOCK_COST *
            coinService.COIN_RUPEE_VALUE,
        },
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to unlock stock intelligence.",
    });
  }
};

const checkStockUnlock = async (req, res) => {
  try {
    const firebaseUid = req.user?.uid || req.user?.firebaseUid;

    if (!firebaseUid) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    const symbol = req.params.symbol;

    if (!symbol || String(symbol).trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Stock symbol is required.",
      });
    }

    const data = await coinService.hasStockUnlock({
      firebaseUid,
      symbol,
    });

    return res.status(200).json({
      success: true,
      unlocked: Boolean(data.unlocked),
      data,
    });
  } catch (error) {
    console.error("CHECK STOCK UNLOCK ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to check stock unlock.",
    });
  }
};

module.exports = {
  getBalance,
  getHistory,
  unlockStock,
  checkStockUnlock,
};
