const mongoose = require("mongoose");

const referralSchema = new mongoose.Schema(
  {
    referrerUid: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    referredUid: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },

    referralCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    rewardCoins: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
      enum: ["completed"],
      default: "completed",
      index: true,
    },

    rewardedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

referralSchema.index({
  referrerUid: 1,
  createdAt: -1,
});

referralSchema.index({
  referralCode: 1,
  createdAt: -1,
});

module.exports =
  mongoose.models.Referral ||
  mongoose.model("Referral", referralSchema);
