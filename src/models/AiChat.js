// src/models/AiChat.js
"use strict";

const mongoose = require("mongoose");

const aiMessageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 12000,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
  }
);

const aiChatSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    title: {
      type: String,
      default: "New chat",
      trim: true,
      maxlength: 100,
    },

    // Complete conversation stored in one document.
    messages: {
      type: [aiMessageSchema],
      default: [],
    },

    model: {
      type: String,
      default: "openai/gpt-oss-120b",
      trim: true,
    },

    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    // Legacy fields: retained so existing saved chats remain readable.
    message: {
      type: String,
      default: undefined,
    },

    reply: {
      type: String,
      default: undefined,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

aiChatSchema.index({
  userId: 1,
  lastMessageAt: -1,
});

const AiChat =
  mongoose.models.AiChat ||
  mongoose.model("AiChat", aiChatSchema);

module.exports = AiChat;