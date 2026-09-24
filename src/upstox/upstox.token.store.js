// ==========================================================
// AiTradeX - Upstox Access Token Store
// ==========================================================
//
// Development/single-user runtime token cache.
//
// IMPORTANT:
// For a production multi-user application, persist each user's
// Upstox token securely in MongoDB/secret storage and associate
// it with the authenticated AiTradeX user. This in-memory store
// is intentionally simple so the OAuth callback can immediately
// power market-data requests without exposing the token to Flutter.
// ==========================================================

let runtimeAccessToken = null;
let runtimeExpiresAt = 0;

const setAccessToken = (accessToken, expiresInSeconds) => {
  if (!accessToken || typeof accessToken !== "string") {
    throw new Error("A valid Upstox access token is required.");
  }

  runtimeAccessToken = accessToken.trim();

  const seconds = Number(expiresInSeconds);

  // Upstox normally provides an expiry. If it is not present,
  // keep a conservative runtime expiry rather than retaining
  // the token indefinitely.
  const ttlSeconds =
    Number.isFinite(seconds) && seconds > 0
      ? seconds
      : 20 * 60 * 60;

  runtimeExpiresAt = Date.now() + ttlSeconds * 1000;
};

const getRuntimeAccessToken = () => {
  if (!runtimeAccessToken) {
    return null;
  }

  if (
    runtimeExpiresAt > 0 &&
    Date.now() >= runtimeExpiresAt
  ) {
    runtimeAccessToken = null;
    runtimeExpiresAt = 0;
    return null;
  }

  return runtimeAccessToken;
};

const clearAccessToken = () => {
  runtimeAccessToken = null;
  runtimeExpiresAt = 0;
};

module.exports = {
  setAccessToken,
  getRuntimeAccessToken,
  clearAccessToken,
};
