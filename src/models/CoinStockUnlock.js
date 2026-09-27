const mongoose = require("mongoose");

const CoinStockUnlockSchema = new mongoose.Schema(
  {
    firebaseUid: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    symbol: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    coinsPaid: {
      type: Number,
      required: true,
      default: 100,
      min: 0,
    },

    unlockedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// One user can unlock a stock only once.
CoinStockUnlockSchema.index(
  {
    firebaseUid: 1,
    symbol: 1,
  },
  {
    unique: true,
  }
);

module.exports =
  mongoose.models.CoinStockUnlock ||
  mongoose.model("CoinStockUnlock", CoinStockUnlockSchema);
