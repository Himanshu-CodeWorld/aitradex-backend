// ==========================================================
// AiTradeX - Upstox Configuration
// ==========================================================
// Secrets must be configured in the backend environment (Render),
// never in Flutter or committed to source control.

const UPSTOX_CONFIG = Object.freeze({
  clientId: process.env.UPSTOX_CLIENT_ID || "",
  clientSecret: process.env.UPSTOX_CLIENT_SECRET || "",
  redirectUri: process.env.UPSTOX_REDIRECT_URI || "",
  apiBaseUrl: "https://api.upstox.com/v2",
  marketApiBaseUrl: "https://api.upstox.com/v3",
  authorizationUrl: "https://api.upstox.com/v2/login/authorization/dialog",
  tokenUrl: "https://api.upstox.com/v2/login/authorization/token",
  requestTimeoutMs: Math.max(1000, Number(process.env.UPSTOX_TIMEOUT_MS) || 15000),
});

function validateUpstoxConfig() {
  const missing = [];
  if (!UPSTOX_CONFIG.clientId) missing.push("UPSTOX_CLIENT_ID");
  if (!UPSTOX_CONFIG.clientSecret) missing.push("UPSTOX_CLIENT_SECRET");
  if (!UPSTOX_CONFIG.redirectUri) missing.push("UPSTOX_REDIRECT_URI");

  if (missing.length) {
    console.warn(`[Upstox] OAuth configuration missing: ${missing.join(", ")}`);
  }
  return missing;
}

module.exports = { UPSTOX_CONFIG, validateUpstoxConfig };
