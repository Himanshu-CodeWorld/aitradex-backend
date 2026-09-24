const axios = require('axios');

const UPSTOX_API_BASE_URL = 'https://api.upstox.com/v3';

const LIVE_MARKET_ASSETS = {
  NIFTY: {
    name: 'NIFTY 50',
    instrumentKey: 'NSE_INDEX|Nifty 50',
  },
  RELIANCE: {
    name: 'Reliance Industries',
    instrumentKey: 'NSE_EQ|INE002A01018',
  },
  HDFCBANK: {
    name: 'HDFC Bank',
    instrumentKey: 'NSE_EQ|INE040A01034',
  },
  NIFTYBEES: {
    name: 'NIFTYBEES',
    instrumentKey: 'NSE_EQ|INF204KB14I2',
  },
  TCS: {
    name: 'TCS',
    instrumentKey: 'NSE_EQ|INE467B01029',
  },
};

class UpstoxMarketService {
  getAnalyticsToken() {
    const token = process.env.UPSTOX_ANALYTICS_TOKEN;

    if (!token) {
      const error = new Error(
        'UPSTOX_ANALYTICS_TOKEN is not configured on the backend'
      );
      error.statusCode = 500;
      throw error;
    }

    return token;
  }

  getDefaultInstrumentKeys() {
    return Object.values(LIVE_MARKET_ASSETS).map(
      (asset) => asset.instrumentKey
    );
  }

  validateInstrumentKeys(instrumentKeys) {
    if (!Array.isArray(instrumentKeys) || instrumentKeys.length === 0) {
      const error = new Error('At least one instrument_key is required');
      error.statusCode = 400;
      throw error;
    }

    if (instrumentKeys.length > 500) {
      const error = new Error('Maximum 500 instrument keys are allowed');
      error.statusCode = 400;
      throw error;
    }

    return instrumentKeys
      .map((key) => String(key).trim())
      .filter(Boolean);
  }

  async getMarketQuotes(instrumentKeys) {
    const keys = this.validateInstrumentKeys(instrumentKeys);
    const token = this.getAnalyticsToken();

    try {
      const response = await axios.get(
        `${UPSTOX_API_BASE_URL}/market-quote/ltp`,
        {
          params: {
            instrument_key: keys.join(','),
          },
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
          timeout: 15000,
        }
      );

      const rawData = response.data?.data || {};
      const data = {};

      for (const [responseKey, quote] of Object.entries(rawData)) {
        if (!quote) continue;

        const instrumentKey =
          quote.instrument_token || responseKey;

        const lastPrice = Number(quote.last_price);
        const closePrice = Number(quote.cp);

        if (!Number.isFinite(lastPrice)) continue;

        data[instrumentKey] = {
          instrument_key: instrumentKey,
          last_price: lastPrice,
          close_price: Number.isFinite(closePrice)
            ? closePrice
            : null,
          ltq: Number.isFinite(Number(quote.ltq))
            ? Number(quote.ltq)
            : null,
          volume: Number.isFinite(Number(quote.volume))
            ? Number(quote.volume)
            : null,
          change: Number.isFinite(closePrice)
            ? lastPrice - closePrice
            : null,
          change_percent:
            Number.isFinite(closePrice) && closePrice !== 0
              ? ((lastPrice - closePrice) / closePrice) * 100
              : null,
        };
      }

      return {
        success: true,
        source: 'upstox',
        timestamp: new Date().toISOString(),
        data,
      };
    } catch (error) {
      console.error('========================================');
      console.error('UPSTOX MARKET DATA ERROR');
      console.error('========================================');
      console.error('Status:', error.response?.status);
      console.error('Response:', error.response?.data);
      console.error('Message:', error.message);
      console.error('========================================');

      const apiError = new Error(
        error.response?.data?.errors?.[0]?.message ||
          error.response?.data?.message ||
          'Unable to fetch market data from Upstox'
      );

      apiError.statusCode = error.response?.status >= 400
        ? error.response.status
        : 502;

      throw apiError;
    }
  }
}

module.exports = {
  UpstoxMarketService,
  LIVE_MARKET_ASSETS,
};
