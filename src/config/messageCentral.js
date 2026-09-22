// src/config/messageCentral.js

const axios = require("axios");

// ==========================================================
// MESSAGE CENTRAL CONFIGURATION
// ==========================================================

const MESSAGE_CENTRAL_BASE_URL =
  "https://cpaas.messagecentral.com";

// ==========================================================
// AXIOS CLIENT
// ==========================================================

const messageCentral = axios.create({
  baseURL: MESSAGE_CENTRAL_BASE_URL,
  timeout: 30000,
  headers: {
    Accept: "application/json",
  },
});

// ==========================================================
// EXPORT
// ==========================================================

module.exports = messageCentral;