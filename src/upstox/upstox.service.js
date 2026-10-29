
const axios = require("axios");
const crypto = require("crypto");
const { UPSTOX_CONFIG } = require("./upstox.config");

class UpstoxService {
  validateConfig() {
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

    if (!UPSTOX_CONFIG.authorizationUrl) {
      missing.push("Upstox authorization URL");
    }

    if (!UPSTOX_CONFIG.tokenUrl) {
      missing.push("Upstox token URL");
    }

    if (!UPSTOX_CONFIG.apiBaseUrl) {
      missing.push("Upstox API base URL");
    }

    if (missing.length > 0) {
      throw new Error(
        `Missing Upstox configuration: ${missing.join(", ")}`
      );
    }
  }

  generateState() {
    return crypto.randomBytes(32).toString("hex");
  }

  getAuthorizationUrl(state) {
    this.validateConfig();

    if (!state) {
      throw new Error("OAuth state is required");
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

  async exchangeCodeForToken(code) {
    this.validateConfig();

    if (!code) {
      throw new Error("Authorization code is required");
    }

    const body = new URLSearchParams({
      code,
      client_id: UPSTOX_CONFIG.clientId,
      client_secret: UPSTOX_CONFIG.clientSecret,
      redirect_uri: UPSTOX_CONFIG.redirectUri,
      grant_type: "authorization_code",
    });

    try {
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
      console.error("[Upstox] Token exchange failed:", {
        status: error.response?.status,
        response: error.response?.data,
        message: error.message,
      });

      throw error;
    }
  }

  async getUserProfile(accessToken) {
    if (!accessToken) {
      throw new Error("Access token is required");
    }

    try {
      const response = await axios.get(
        `${UPSTOX_CONFIG.apiBaseUrl}/user/profile`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          timeout: 15000,
        }
      );

      return response.data;
    } catch (error) {
      console.error("[Upstox] Profile request failed:", {
        status: error.response?.status,
        response: error.response?.data,
        message: error.message,
      });

      throw error;
    }
  }
}

module.exports = new UpstoxService();
