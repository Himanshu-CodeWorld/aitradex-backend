// src/models/AiConversation.js
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
  { _id: false }
);

const aiConversationSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    title: {
      type: String,
      default: "New chat",
      trim: true,
      maxlength: 100,
    },
    messages: {
      type: [aiMessageSchema],
      default: [],
    },
    model: {
      type: String,
      default: "",
      trim: true,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

aiConversationSchema.index({ userId: 1, lastMessageAt: -1 });

module.exports =
  mongoose.models.AiConversation ||
  mongoose.model("AiConversation", aiConversationSchema);
