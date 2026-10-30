
"use strict";

const mongoose = require("mongoose");

const aiChatSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4000,
    },

    reply: {
      type: String,
      required: true,
      trim: true,
    },

    model: {
      type: String,
      default: "openai/gpt-oss-120b",
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Efficient user-specific chat history queries.
aiChatSchema.index({
  userId: 1,
  createdAt: -1,
});

// Prevent model recompilation errors during hot reload.
const AiChat =
  mongoose.models.AiChat ||
  mongoose.model("AiChat", aiChatSchema);

module.exports = AiChat;
