const mongoose = require("mongoose");

const CoinTransactionSchema = new mongoose.Schema(
  {
    firebaseUid: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    type: {
      type: String,
      required: true,
      enum: [
        "credit",
        "stock_unlock",
        "refund",
        "purchase",
        "adjustment",
        "referral_bonus",
      ],
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isInteger,
        message: "Coin amount must be an integer.",
      },
    },

    balanceAfter: {
      type: Number,
      required: true,
      min: 0,
    },

    amountInr: {
      type: Number,
      required: true,
      min: 0,
    },

    symbol: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    referenceId: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

CoinTransactionSchema.index({
  firebaseUid: 1,
  createdAt: -1,
});

module.exports =
  mongoose.models.CoinTransaction ||
  mongoose.model("CoinTransaction", CoinTransactionSchema);
