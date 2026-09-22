const mongoose = require("mongoose");

const phoneVerificationSchema =
  new mongoose.Schema(
    {
      phone: {
        type: String,
        required: true,
        trim: true,
        unique: true,
        index: true,
      },

      verificationId: {
        type: String,
        required: true,
        trim: true,
      },

      verified: {
        type: Boolean,
        default: false,
      },

      flowType: {
        type: String,
        default: "SMS",
        enum: ["SMS"],
      },

      expiresAt: {
        type: Date,
        required: true,
        index: {
          expires: 0,
        },
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

module.exports =
  mongoose.model(
    "PhoneVerification",
    phoneVerificationSchema,
  );