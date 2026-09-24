// ==========================================================
// AiTradeX - Upstox Service
// ==========================================================

const axios = require("axios");
const crypto = require("crypto");

const {
  UPSTOX_CONFIG,
} = require("./upstox.config");

// ==========================================================
// Upstox Service
// ==========================================================

class UpstoxService {
  // ========================================================
  // Validate configuration
  // ========================================================

  validateConfig() {
    if (!UPSTOX_CONFIG.clientId) {
      throw new Error(
        "UPSTOX_CLIENT_ID is not configured"
      );
    }

    if (!UPSTOX_CONFIG.clientSecret) {
      throw new Error(
        "UPSTOX_CLIENT_SECRET is not configured"
      );
    }

    if (!UPSTOX_CONFIG.redirectUri) {
      throw new Error(
        "UPSTOX_REDIRECT_URI is not configured"
      );
    }
  }

  // ========================================================
  // Generate OAuth State
  // ========================================================

  generateState() {
    return crypto.randomBytes(32).toString("hex");
  }

  // ========================================================
  // Generate Authorization URL
  // ========================================================

  getAuthorizationUrl(state) {
    this.validateConfig();

    if (!state) {
      throw new Error(
        "OAuth state is required"
      );
    }

    const params = new URLSearchParams({
      response_type: "code",
      client_id: UPSTOX_CONFIG.clientId,
      redirect_uri: UPSTOX_CONFIG.redirectUri,
      state,
    });

    return (
      `${UPSTOX_CONFIG.authorizationUrl}?` +
      params.toString()
    );
  }

  // ========================================================
  // Exchange Authorization Code
  // ========================================================

  async exchangeCodeForToken(code) {
    this.validateConfig();

    if (!code) {
      throw new Error(
        "Authorization code is required"
      );
    }

    try {
      const body = new URLSearchParams({
        code,
        client_id: UPSTOX_CONFIG.clientId,
        client_secret: UPSTOX_CONFIG.clientSecret,
        redirect_uri: UPSTOX_CONFIG.redirectUri,
        grant_type: "authorization_code",
      });

      const response = await axios.post(
        UPSTOX_CONFIG.tokenUrl,
        body.toString(),
        {
          headers: {
            Accept: "application/json",
            "Content-Type":
              "application/x-www-form-urlencoded",
          },

          timeout: 15000,
        }
      );

      return response.data;
    } catch (error) {
      console.error(
        "========================================"
      );

      console.error(
        "❌ UPSTOX TOKEN EXCHANGE ERROR"
      );

      console.error(
        "========================================"
      );

      console.error(
        "Status:",
        error.response?.status
      );

      console.error(
        "Response:",
        error.response?.data
      );

      console.error(
        "Message:",
        error.message
      );

      console.error(
        "========================================"
      );

      throw error;
    }
  }

  // ========================================================
  // Get User Profile
  // ========================================================
  //
  // This will be useful for verifying that the access token
  // actually works before we connect market data.
  //

  async getUserProfile(accessToken) {
    if (!accessToken) {
      throw new Error(
        "Access token is required"
      );
    }

    try {
      const response = await axios.get(
        `${UPSTOX_CONFIG.apiBaseUrl}/user/profile`,
        {
          headers: {
            Accept: "application/json",
            Authorization:
              `Bearer ${accessToken}`,
          },

          timeout: 15000,
        }
      );

      return response.data;
    } catch (error) {
      console.error(
        "Upstox profile request error:",
        error.response?.data ||
          error.message
      );

      throw error;
    }
  }
}

// ==========================================================
// Export Singleton
// ==========================================================

module.exports = new UpstoxService();