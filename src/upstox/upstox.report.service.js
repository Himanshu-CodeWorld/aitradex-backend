// ==========================================================
// AiTradeX - Upstox Report Service
// ==========================================================
//
// Uses the same backend token flow as market data.
// No Upstox token/secret is exposed to Flutter.
// ==========================================================

const axios = require("axios");
const { loadInstrumentMaster } = require("./upstox.instruments.service");

const { UPSTOX_CONFIG } = require("./upstox.config");
const {
  UpstoxMarketService,
} = require("./upstox.market.service");

const marketService = new UpstoxMarketService();
const REQUEST_TIMEOUT = 15000;

const asNumber = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const parsed = Number(
    String(value ?? "")
      .replace(/,/g, "")
      .replace(/%/g, "")
      .trim()
  );

  return Number.isFinite(parsed) ? parsed : 0;
};

const stringValue = (value) =>
  value == null ? "" : String(value).trim();

const toIsoDate = (date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

const daysAgo = (days) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return toIsoDate(date);
};

const today = () => toIsoDate(new Date());

class UpstoxReportService {
  getAccessToken() {
    return marketService.getAccessToken();
  }

  async get(path, params = {}) {
    return this._getFromBase(UPSTOX_CONFIG.apiBaseUrl, path, params);
  }

  async getMarketApi(path, params = {}) {
    return this._getFromBase(UPSTOX_CONFIG.marketApiBaseUrl, path, params);
  }

  async _getFromBase(baseUrl, path, params = {}) {
    const token = this.getAccessToken();

    try {
      const response = await axios.get(
        `${baseUrl}${path}`,
        {
          params,
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          timeout: REQUEST_TIMEOUT,
        }
      );

      return response.data;
    } catch (error) {
      const status = error.response?.status;
      const body = error.response?.data;

      const apiError = new Error(
        body?.errors?.[0]?.message ||
          body?.message ||
          error.message ||
          "Unable to fetch report data from Upstox."
      );

      apiError.statusCode =
        Number.isInteger(status) && status >= 400 && status < 600
          ? status
          : 502;

      apiError.code =
        status === 401 || status === 403
          ? "UPSTOX_TOKEN_INVALID"
          : status === 429
            ? "UPSTOX_RATE_LIMIT"
            : "UPSTOX_REPORT_DATA_ERROR";

      throw apiError;
    }
  }

  async resolveInstrument({ symbol, instrumentKey, isin }) {
    const cleanSymbol = stringValue(symbol).toUpperCase();
    const cleanKey = stringValue(instrumentKey);
    const cleanIsin = stringValue(isin).toUpperCase();

    if (cleanKey) {
      // Resolve metadata from the same instrument master used by market data.
      // Flutter may send only instrument_key, while Upstox quote maps use symbols.
      const instruments = await loadInstrumentMaster();
      const match = instruments.find((item) => item.instrumentKey === cleanKey);
      return {
        instrumentKey: cleanKey,
        isin: cleanIsin || stringValue(match?.isin),
        symbol: cleanSymbol || stringValue(match?.symbol),
        name: stringValue(match?.name || match?.symbol || cleanSymbol),
      };
    }

    if (!cleanSymbol && !cleanIsin) {
      const error = new Error("Stock symbol is required.");
      error.statusCode = 400;
      error.code = "REPORT_SYMBOL_REQUIRED";
      throw error;
    }

    const query = cleanIsin || cleanSymbol;

    const response = await this.get("/instruments/search", {
      query,
      exchanges: "NSE",
      segments: "EQ",
      records: 30,
    });

    const rows = Array.isArray(response?.data) ? response.data : [];

    const exact = rows.find(
      (row) =>
        row?.segment === "NSE_EQ" &&
        row?.instrument_type === "EQ" &&
        (cleanIsin
          ? String(row.isin || "").toUpperCase() === cleanIsin
          : String(row.trading_symbol || "").toUpperCase() === cleanSymbol)
    );

    const equity =
      exact ||
      rows.find(
        (row) =>
          row?.segment === "NSE_EQ" &&
          row?.instrument_type === "EQ"
      );

    if (!equity?.instrument_key) {
      const error = new Error(
        `NSE equity instrument not found for ${cleanSymbol || cleanIsin}.`
      );
      error.statusCode = 404;
      error.code = "UPSTOX_INSTRUMENT_NOT_FOUND";
      throw error;
    }

    return {
      instrumentKey: equity.instrument_key,
      isin: stringValue(equity.isin || cleanIsin),
      symbol: stringValue(equity.trading_symbol || cleanSymbol),
      name: stringValue(equity.name || equity.trading_symbol || cleanSymbol),
    };
  }

  parseLtp(response, instrumentKey, symbol) {
    const data = response?.data || {};
    const direct =
      data[instrumentKey] ||
      data[encodeURIComponent(instrumentKey)];
    const wantedSymbol = stringValue(symbol).toUpperCase();
    const matchingEntry = Object.entries(data).find(([responseKey, quote]) => {
      const keySymbol = String(responseKey).split(":").slice(1).join(":").trim().toUpperCase();
      const quoteSymbol = stringValue(
        quote?.trading_symbol || quote?.tradingSymbol || quote?.symbol
      ).toUpperCase();
      return (wantedSymbol && keySymbol === wantedSymbol) ||
        (wantedSymbol && quoteSymbol === wantedSymbol);
    });
    const raw = direct || matchingEntry?.[1] || {};

    const lastPrice = asNumber(
      raw.last_price ?? raw.lastPrice ?? raw.ltp
    );

    const previousClose = asNumber(
      raw.cp ?? raw.previous_close ?? raw.previousClose
    );

    let changePercent = asNumber(
      raw.change_percent ??
        raw.changePercent ??
        raw.percentage_change
    );

    if (
      changePercent === 0 &&
      previousClose > 0 &&
      lastPrice > 0
    ) {
      changePercent =
        ((lastPrice - previousClose) / previousClose) * 100;
    }

    return {
      symbol:
        stringValue(raw.trading_symbol) ||
        stringValue(raw.symbol) ||
        symbol,
      last_price: lastPrice,
      previous_close: previousClose || null,
      change: previousClose
        ? lastPrice - previousClose
        : null,
      change_percent: previousClose
        ? ((lastPrice - previousClose) / previousClose) * 100
        : changePercent,
      volume: Math.round(
        asNumber(
          raw.volume ?? raw.total_volume ?? raw.volume_traded
        )
      ),
      ltq: Math.round(asNumber(raw.ltq)),
    };
  }

  parseHistory(response) {
    const candles = Array.isArray(response?.data?.candles)
      ? response.data.candles
      : [];

    return candles
      .filter(Array.isArray)
      .map((candle) => ({
        timestamp: candle[0],
        open: asNumber(candle[1]),
        high: asNumber(candle[2]),
        low: asNumber(candle[3]),
        close: asNumber(candle[4]),
        volume: Math.round(asNumber(candle[5])),
        oi: Math.round(asNumber(candle[6])),
      }))
      .filter((candle) => candle.close > 0)
      .sort(
        (a, b) =>
          new Date(a.timestamp).getTime() -
          new Date(b.timestamp).getTime()
      );
  }

  historyReturn(candles, days) {
    if (candles.length < 2) return null;

    const latest = candles[candles.length - 1];
    const target =
      new Date(latest.timestamp).getTime() -
      days * 24 * 60 * 60 * 1000;

    let base = candles[0];

    for (const candle of candles) {
      if (new Date(candle.timestamp).getTime() <= target) {
        base = candle;
      } else {
        break;
      }
    }

    if (!base.close) return null;

    return ((latest.close - base.close) / base.close) * 100;
  }

  averageVolume(candles, days) {
    if (!candles.length) return null;

    const latestTime = new Date(
      candles[candles.length - 1].timestamp
    ).getTime();

    const cutoff = latestTime - days * 24 * 60 * 60 * 1000;

    const selected = candles.filter(
      (candle) =>
        new Date(candle.timestamp).getTime() >= cutoff
    );

    if (!selected.length) return null;

    return Math.round(
      selected.reduce(
        (sum, candle) => sum + asNumber(candle.volume),
        0
      ) / selected.length
    );
  }

  parseIncome(response) {
    const statements =
      response?.data?.income_statement ||
      response?.data?.incomeStatement ||
      [];

    const output = {
      revenue: [],
      netProfit: [],
    };

    for (const statement of statements) {
      const category = String(statement?.category || "")
        .toLowerCase()
        .replace(/_/g, " ");

      const history = Array.isArray(statement?.history)
        ? statement.history
        : [];

      let target = null;

      if (category === "revenue") {
        target = output.revenue;
      } else if (
        category === "net profit" ||
        category === "netprofit"
      ) {
        target = output.netProfit;
      }

      if (!target) continue;

      for (const row of history) {
        target.push({
          period: stringValue(row?.period),
          value: asNumber(row?.value),
          change: stringValue(row?.change),
        });
      }
    }

    return output;
  }

  parseRatios(response) {
    const rows = Array.isArray(response?.data)
      ? response.data
      : [];

    const output = {};

    for (const row of rows) {
      const name = String(
        row?.ratio ?? row?.name ?? row?.key ?? ""
      ).toLowerCase();

      const value = asNumber(
        row?.company_value ??
          row?.current_value ??
          row?.currentValue ??
          row?.value
      );

      const sector = asNumber(
        row?.sector_value ?? row?.sectorValue
      );

      if (name.includes("p/e") || name === "pe") {
        output.pe = value;
        output.sectorPe = sector || null;
      } else if (name.includes("p/b") || name === "pb") {
        output.pb = value;
      } else if (name === "roe" || name.includes("return on equity")) {
        output.roe = value;
      } else if (name === "roce") {
        output.roce = value;
      } else if (
        name.includes("ev/ebitda") ||
        name.includes("ev / ebitda")
      ) {
        output.evEbitda = value;
      }
    }

    return output;
  }

  parseShareholding(response) {
    const rows = Array.isArray(response?.data)
      ? response.data
      : [];

    const items = [];
    let latestPeriod = "";
    let latestTime = -Infinity;

    for (const row of rows) {
      const category = stringValue(row?.category);
      const history = Array.isArray(row?.history)
        ? row.history
        : [];

      if (!history.length) continue;

      const latest = history[history.length - 1];
      const period = stringValue(latest?.period);
      const time = Date.parse(`01 ${period}`);

      if (Number.isFinite(time) && time > latestTime) {
        latestTime = time;
        latestPeriod = period;
      } else if (!latestPeriod) {
        latestPeriod = period;
      }

      items.push({
        category,
        value: asNumber(latest?.value),
        period,
      });
    }

    return {
      latest: {
        period: latestPeriod,
        items,
      },
    };
  }

  async getReport({ symbol, instrumentKey, isin }) {
    const instrument = await this.resolveInstrument({
      symbol,
      instrumentKey,
      isin,
    });

    let resolvedIsin = instrument.isin;

    // An instrument key supplied by Flutter may not contain an ISIN.
    // Resolve it once so fundamentals can still be loaded.
    if (!resolvedIsin) {
      const search = await this.get("/instruments/search", {
        query: instrument.instrumentKey,
        exchanges: "NSE",
        segments: "EQ",
        records: 30,
      });

      const row = (search?.data || []).find(
        (item) =>
          item?.instrument_key === instrument.instrumentKey
      );

      resolvedIsin = stringValue(row?.isin);
      instrument.isin = resolvedIsin;
    }

    const key = instrument.instrumentKey;
    const encodedIsin = encodeURIComponent(resolvedIsin);

    const ltpPromise = this.getMarketApi("/market-quote/ltp", {
      instrument_key: key,
    });

    const historyPromise = this.getMarketApi(
      `/historical-candle/${encodeURIComponent(key)}/days/1/${today()}/${daysAgo(370)}`
    );

    const fundamentalsPromises = resolvedIsin
      ? [
          this.get(
            `/fundamentals/${encodedIsin}/income-statement`,
            {
              type: "consolidated",
              time_period: "yearly",
              fs: false,
            }
          ),
          this.get(
            `/fundamentals/${encodedIsin}/income-statement`,
            {
              type: "consolidated",
              time_period: "quarterly",
              fs: false,
            }
          ),
          this.get(`/fundamentals/${encodedIsin}/key-ratios`),
          this.get(`/fundamentals/${encodedIsin}/share-holdings`),
          this.get(`/fundamentals/${encodedIsin}/profile`),
        ]
      : [
          Promise.resolve({ data: {} }),
          Promise.resolve({ data: {} }),
          Promise.resolve({ data: [] }),
          Promise.resolve({ data: [] }),
          Promise.resolve({ data: {} }),
        ];

    const [
      ltpResponse,
      yearlyIncomeResponse,
      quarterlyIncomeResponse,
      ratiosResponse,
      shareholdingResponse,
      profileResponse,
      historyResponse,
    ] = await Promise.all([
      ltpPromise,
      ...fundamentalsPromises,
      historyPromise,
    ]);

    const candles = this.parseHistory(historyResponse);
    const ltp = this.parseLtp(ltpResponse, key, instrument.symbol);
    const yearly = this.parseIncome(yearlyIncomeResponse);
    const quarterly = this.parseIncome(quarterlyIncomeResponse);
    const profile = profileResponse?.data || {};

    const returns = [
      { period: "1M", value: this.historyReturn(candles, 30) },
      { period: "3M", value: this.historyReturn(candles, 90) },
      { period: "6M", value: this.historyReturn(candles, 180) },
      { period: "1Y", value: this.historyReturn(candles, 365) },
    ];

    const volumes = [
      { period: "1M", value: this.averageVolume(candles, 30) },
      { period: "3M", value: this.averageVolume(candles, 90) },
      { period: "6M", value: this.averageVolume(candles, 180) },
      { period: "1Y", value: this.averageVolume(candles, 365) },
    ];

    return {
      success: true,
      source: "upstox",
      api_version: "v2/v3",
      data: {
        symbol: instrument.symbol,
        instrumentKey: key,
        isin: resolvedIsin,
        name: instrument.name,
        sector: stringValue(profile.sector),
        companyProfile: stringValue(profile.company_profile),
        quote: ltp,
        financials: {
          yearlyRevenue: yearly.revenue,
          yearlyNetProfit: yearly.netProfit,
          quarterlyRevenue: quarterly.revenue,
          quarterlyNetProfit: quarterly.netProfit,
          revenue: yearly.revenue,
          netProfit: yearly.netProfit,
        },
        ratios: this.parseRatios(ratiosResponse),
        shareholding: this.parseShareholding(shareholdingResponse),
        returns,
        volumes,
        updatedAt: new Date().toISOString(),
      },
    };
  }
}

module.exports = new UpstoxReportService();
