const mongoose = require("mongoose");

const brokerConnectionSchema = new mongoose.Schema({
  firebaseUid: {
    type: String,
    required: true,
    index: true,
  },

  broker: {
    type: String,
    required: true,
    enum: ["UPSTOX"],
  },

  brokerUserId: {
    type: String,
    default: null,
  },

  encryptedAccessToken: {
    type: String,
    required: true,
    select: false,
  },

  expiresAt: {
    type: Date,
    default: null,
  },

  status: {
    type: String,
    enum: ["ACTIVE", "INACTIVE", "EXPIRED"],
    default: "ACTIVE",
  },
}, {
  timestamps: true,
});

brokerConnectionSchema.index(
  { firebaseUid: 1, broker: 1 },
  { unique: true }
);

module.exports =
  mongoose.models.BrokerConnection ||
  mongoose.model("BrokerConnection", brokerConnectionSchema);