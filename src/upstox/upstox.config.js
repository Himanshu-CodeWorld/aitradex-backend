const UPSTOX_API_BASE_URL = 'https://api.upstox.com';

const UPSTOX_CONFIG = {
  clientId: process.env.UPSTOX_CLIENT_ID,
  clientSecret: process.env.UPSTOX_CLIENT_SECRET,
  redirectUri: process.env.UPSTOX_REDIRECT_URI,
};

module.exports = {
  UPSTOX_API_BASE_URL,
  UPSTOX_CONFIG,
};