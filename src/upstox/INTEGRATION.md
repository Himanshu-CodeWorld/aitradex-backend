# AiTradeX + Upstox live market data

## What this package fixes

- Uses the current Upstox Market Quote V3 LTP endpoint.
- Uses a real Upstox OAuth access token instead of the old
  `UPSTOX_ANALYTICS_TOKEN` requirement.
- The OAuth callback verifies the token and caches it server-side
  for immediate market-data requests.
- The access token is never returned to Flutter.
- Supports the existing `UPSTOX_ANALYTICS_TOKEN` environment
  variable as a backward-compatible fallback.
- Returns useful HTTP status codes instead of converting every
  Upstox failure into HTTP 500.
- Calculates `change` and `change_percent` from Upstox `cp`.
- Supports up to 500 instrument keys per request.

## 1. Install dependency

```bash
npm install axios
```

## 2. Render environment variables

Required for OAuth:

```env
UPSTOX_CLIENT_ID=YOUR_UPSTOX_CLIENT_ID
UPSTOX_CLIENT_SECRET=YOUR_UPSTOX_CLIENT_SECRET
UPSTOX_REDIRECT_URI=https://aitradex-api.onrender.com/api/upstox/callback
```

### Optional server-side access token

For a single-account/development setup, you can also set:

```env
UPSTOX_ACCESS_TOKEN=YOUR_CURRENT_UPSTOX_ACCESS_TOKEN
```

The market service checks `UPSTOX_ACCESS_TOKEN` first.

`UPSTOX_ANALYTICS_TOKEN` is still accepted as a compatibility
fallback, but `UPSTOX_ACCESS_TOKEN` is the preferred name.

Never put either token or the client secret in Flutter or GitHub.

## 3. OAuth flow

```text
Flutter
   |
   | Open /api/upstox/login
   v
AiTradeX Backend
   |
   | OAuth redirect
   v
Upstox
   |
   | callback ?code=...
   v
AiTradeX Backend
   |
   | exchange code -> access token
   | verify token with /v2/user/profile
   | cache verified token server-side
   v
Market Data API
```

The current runtime token cache is intentionally simple for
single-user/development use. For a production multi-user app,
store each user's Upstox token encrypted and associate it with
the authenticated AiTradeX user.

## 4. Market-data API

```text
GET /api/upstox/market-data
```

Without a query parameter, the backend requests:

```text
NSE_INDEX|Nifty 50
NSE_EQ|INE002A01018
NSE_EQ|INE040A01034
NSE_EQ|INF204KB14I2
NSE_EQ|INE467B01029
NSE_EQ|INE009A01021
NSE_EQ|INE090A01021
NSE_EQ|INE397D01024
```

Optional custom keys:

```text
GET /api/upstox/market-data?instrument_key=NSE_EQ|INE002A01018,NSE_EQ|INE040A01034
```

## 5. Response

Successful response:

```json
{
  "success": true,
  "source": "upstox",
  "api_version": "v3",
  "timestamp": "2026-09-24T00:00:00.000Z",
  "data": {
    "NSE_EQ|INE002A01018": {
      "instrument_key": "NSE_EQ|INE002A01018",
      "last_price": 1234.5,
      "close_price": 1220.0,
      "ltq": 10,
      "volume": 123456,
      "change": 14.5,
      "change_percent": 1.1885
    }
  }
}
```

## 6. Error responses

### Missing token

```json
{
  "success": false,
  "code": "UPSTOX_TOKEN_NOT_CONFIGURED",
  "message": "Upstox access token is not configured. Connect Upstox or set UPSTOX_ACCESS_TOKEN on the backend."
}
```

HTTP status: `503`

### Expired/invalid token

```json
{
  "success": false,
  "code": "UPSTOX_TOKEN_INVALID",
  "message": "Upstox access token is invalid or expired. Please reconnect Upstox."
}
```

HTTP status: `401`

### Rate limit

HTTP status: `429`

## 7. Important

Gold, Crude Oil and Parag Parikh Flexi Cap are not included in the
default equity/index quote list. They should be connected to their
appropriate Upstox commodity/fund data source before displaying live
prices.

## 8. Deploy

After replacing the files:

```bash
npm install
git add src/upstox
git commit -m "Fix Upstox live market data"
git push
```

Then redeploy the Render service.

Check:

```text
GET /api/upstox/market-data
```

before testing the Flutter dashboard/market screen.
