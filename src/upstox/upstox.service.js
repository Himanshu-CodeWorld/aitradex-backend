const axios = require('axios');

const {
  UPSTOX_API_BASE_URL,
  UPSTOX_CONFIG,
} = require('./upstox.config');

class UpstoxService {
  getAuthorizationUrl(state = '') {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: UPSTOX_CONFIG.clientId,
      redirect_uri: UPSTOX_CONFIG.redirectUri,
    });

    if (state) {
      params.append('state', state);
    }

    return (
      `${UPSTOX_API_BASE_URL}/v2/login/authorization/dialog?` +
      params.toString()
    );
  }

  async exchangeCodeForToken(code) {
    if (!code) {
      throw new Error('Authorization code is required');
    }

    const body = new URLSearchParams({
      code,
      client_id: UPSTOX_CONFIG.clientId,
      client_secret: UPSTOX_CONFIG.clientSecret,
      redirect_uri: UPSTOX_CONFIG.redirectUri,
      grant_type: 'authorization_code',
    });

    const response = await axios.post(
      `${UPSTOX_API_BASE_URL}/v2/login/authorization/token`,
      body.toString(),
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    return response.data;
  }
}

module.exports = new UpstoxService();