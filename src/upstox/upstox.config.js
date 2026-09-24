// ==========================================================
// AiTradeX - Upstox Configuration
// ==========================================================

const UPSTOX_CONFIG = {
  // --------------------------------------------------------
  // Upstox API credentials
  // --------------------------------------------------------

  clientId: process.env.UPSTOX_CLIENT_ID,

  clientSecret: process.env.UPSTOX_CLIENT_SECRET,

  // --------------------------------------------------------
  // OAuth redirect URI
  // --------------------------------------------------------

  redirectUri: process.env.UPSTOX_REDIRECT_URI,

  // --------------------------------------------------------
  // Upstox API URLs
  // --------------------------------------------------------

  apiBaseUrl: "https://api.upstox.com/v2",

  authorizationUrl:
    "https://api.upstox.com/v2/login/authorization/dialog",

  tokenUrl:
    "https://api.upstox.com/v2/login/authorization/token",
};

// ==========================================================
// Validate configuration
// ==========================================================

const validateUpstoxConfig = () => {
  const missing = [];

  if (!UPSTOX_CONFIG.clientId) {
    missing.push("UPSTOX_CLIENT_ID");
  }

  if (!UPSTOX_CONFIG.clientSecret) {
    missing.push("UPSTOX_CLIENT_SECRET");
  }

  if (!UPSTOX_CONFIG.redirectUri) {
    missing.push("UPSTOX_REDIRECT_URI");
  }

  if (missing.length > 0) {
    console.warn("");
    console.warn("========================================");
    console.warn("⚠️ UPSTOX CONFIGURATION WARNING");
    console.warn("========================================");
    console.warn(
      `Missing environment variables: ${missing.join(", ")}`
    );
    console.warn("========================================");
    console.warn("");
  }

  return missing;
};

// ==========================================================
// Exports
// ==========================================================

module.exports = {
  UPSTOX_CONFIG,
  validateUpstoxConfig,
};