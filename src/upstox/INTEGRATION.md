# AiTradeX + Upstox live market data

## 1. Install dependency

```bash
npm install axios
```

## 2. Add Render environment variable

```env
UPSTOX_ANALYTICS_TOKEN=YOUR_UPSTOX_ANALYTICS_TOKEN
```

Keep this token only on Node/Render. Never put it in Flutter.

## 3. Mount the market-data route

In `src/upstox/upstox.routes.js`, add:

```js
const marketRoutes = require('./upstox.market.routes');

router.use(marketRoutes);
```

Or merge the `/market-data` route into your existing `upstox.routes.js`.

## 4. API

```text
GET /api/upstox/market-data
```

Optional custom keys:

```text
GET /api/upstox/market-data?instrument_key=NSE_EQ|INE002A01018,NSE_EQ|INE040A01034
```

Without a query parameter, the backend requests the five configured live instruments.

## 5. Important

The current Invest screen's Gold, Crude Oil and Parag Parikh Flexi Cap entries are displayed in the UI but do not have fixed market-quote instrument keys in this integration. They intentionally show `—` until they are wired to their appropriate Upstox commodity/fund data source. This avoids showing stale or invented prices.
