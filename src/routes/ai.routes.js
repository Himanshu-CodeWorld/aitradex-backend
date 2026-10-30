// src/routes/ai.routes.js
"use strict";

const express = require("express");
const {
  chatWithAi,
  listChats,
  getChat,
  deleteChat,
} = require("../controllers/ai.controller");
const firebaseAuthMiddleware = require("../middleware/firebaseAuth.middleware");

const router = express.Router();

router.use(firebaseAuthMiddleware);

router.get("/chats", listChats);
router.get("/chats/:chatId", getChat);
router.delete("/chats/:chatId", deleteChat);
router.post("/chat", chatWithAi);

module.exports = router;
