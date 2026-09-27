const mongoose = require("mongoose");

const coinPurchaseSchema = new mongoose.Schema(
  {
    firebaseUid: {
      type: String,
      required: true,
      index: true,
    },
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    paymentId: {
      type: String,
      default: null,
      index: true,
    },
    amountInr: {
      type: Number,
      required: true,
      min: 1,
    },
    coins: {
      type: Number,
      required: true,
      min: 1,
    },
    currency: {
      type: String,
      default: "INR",
    },
    status: {
      type: String,
      enum: ["created", "paid", "failed"],
      default: "created",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("CoinPurchase", coinPurchaseSchema);
