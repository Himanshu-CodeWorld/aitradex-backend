"use strict";

const axios = require("axios");
const zlib = require("zlib");
const { promisify } = require("util");

const gunzip = promisify(zlib.gunzip);

const INSTRUMENT_MASTER_URL =
  process.env.UPSTOX_INSTRUMENT_MASTER_URL ||
  "https://assets.upstox.com/market-quote/instruments/exchange/complete.csv.gz";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_SEARCH_LIMIT = 500;

let cache = { loadedAt: 0, instruments: [] };
let pendingLoad = null;

/**
 * Parse one CSV record, respecting quoted commas and escaped quotes.
 * The Upstox instrument master is line-oriented; embedded newlines in fields
 * are not expected.
 */
function parseCsvLine(line) {
  const values = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];

    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (ch === "," && !quoted) {
      values.push(value);
      value = "";
    } else {
      value += ch;
    }
  }

  values.push(value);
  return values;
}

function normalize(value) {
  return String(value ?? "").trim().toUpperCase();
}

function normalizeHeader(value) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function getColumnIndex(headers, ...aliases) {
  for (const alias of aliases) {
    const index = headers.indexOf(normalizeHeader(alias));
    if (index >= 0) return index;
  }
  return -1;
}

/**
 * The complete Upstox CSV may not include a "segment" column.
 * In that format, the segment is encoded in instrument_key, for example:
 * NSE_EQ|INE... and NSE_INDEX|Nifty 50.
 */
function inferSegment(instrumentKey, exchange, instrumentType, rawSegment = "") {
  const segment = normalize(rawSegment);
  if (["NSE_EQ", "BSE_EQ", "NSE_INDEX", "BSE_INDEX"].includes(segment)) {
    return segment;
  }

  const key = normalize(instrumentKey);
  const keyMatch = key.match(/^(NSE_EQ|BSE_EQ|NSE_INDEX|BSE_INDEX)\|/);
  if (keyMatch) return keyMatch[1];

  const ex = normalize(exchange);
  const type = normalize(instrumentType);

  if (["NSE_EQ", "BSE_EQ", "NSE_INDEX", "BSE_INDEX"].includes(ex)) {
    return ex;
  }

  if (type === "EQ" && ex === "NSE") return "NSE_EQ";
  if (type === "EQ" && ex === "BSE") return "BSE_EQ";
  if (type === "INDEX" && ex === "NSE") return "NSE_INDEX";
  if (type === "INDEX" && ex === "BSE") return "BSE_INDEX";

  return "";
}

function isIndexInstrument({ segment, instrumentType, instrumentKey }) {
  const s = normalize(segment);
  const t = normalize(instrumentType);
  const key = normalize(instrumentKey);

  return (
    s === "NSE_INDEX" ||
    s === "BSE_INDEX" ||
    key.startsWith("NSE_INDEX|") ||
    key.startsWith("BSE_INDEX|") ||
    (s.endsWith("_INDEX") && t === "INDEX")
  );
}

// Only ordinary exchange-listed equity shares are classified as stocks.
// ETFs, bonds, derivatives, currencies, and commodities are intentionally excluded.
function isEquityShare({ segment, instrumentType, instrumentKey }) {
  const s = normalize(segment);
  const t = normalize(instrumentType);
  const key = normalize(instrumentKey);

  const validSegment = s === "NSE_EQ" || s === "BSE_EQ";
  const validKey = key.startsWith("NSE_EQ|") || key.startsWith("BSE_EQ|");

  // NSE cash equities normally use EQ. BSE cash-equity rows can use
  // exchange series codes such as A, B, T, X, XT and Z. Those are still
  // ordinary BSE equity shares; rejecting every value other than EQ would
  // silently remove BSE stocks from the scanner.
  const acceptedTypes = new Set([
    "", "EQ", "EQUITY", "STOCK", "SHARE", "SHARES",
    "A", "B", "T", "X", "XT", "Z", "P", "M", "F", "G", "E", "W",
  ]);
  const knownNonEquityType = !acceptedTypes.has(t);

  return validSegment && validKey && !knownNonEquityType;
}

function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function decodeResponseBody(data) {
  let bytes = Buffer.isBuffer(data) ? data : Buffer.from(data);

  // Some proxies/CDNs may transparently decompress gzip; only gunzip when
  // the response still has the gzip magic bytes.
  if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    return gunzip(bytes);
  }

  return Promise.resolve(bytes);
}

async function loadInstrumentMaster(force = false) {
  if (
    !force &&
    cache.instruments.length > 0 &&
    Date.now() - cache.loadedAt < CACHE_TTL_MS
  ) {
    return cache.instruments;
  }

  if (pendingLoad) return pendingLoad;

  pendingLoad = (async () => {
    const response = await axios.get(INSTRUMENT_MASTER_URL, {
      responseType: "arraybuffer",
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        Accept: "application/gzip, text/csv, */*",
        "User-Agent": "AiTradeX/1.0",
      },
      maxContentLength: 100 * 1024 * 1024,
      maxBodyLength: 100 * 1024 * 1024,
    });

    const bytes = await decodeResponseBody(response.data);
    const csv = bytes.toString("utf8").replace(/^\uFEFF/, "");
    const lines = csv.split(/\r?\n/).filter((line) => line.trim().length > 0);

    if (lines.length < 2) {
      throw new Error("Upstox instrument master is empty or has no data rows.");
    }

    const headers = parseCsvLine(lines[0]).map(normalizeHeader);
    const col = {
      key: getColumnIndex(headers, "instrument_key", "instrumentkey"),
      tradingSymbol: getColumnIndex(
        headers,
        "trading_symbol",
        "tradingsymbol",
        "trading_symbol_name"
      ),
      name: getColumnIndex(headers, "name", "instrument_name", "company_name"),
      segment: getColumnIndex(headers, "segment", "instrument_segment"),
      exchange: getColumnIndex(headers, "exchange", "exchange_name"),
      instrumentType: getColumnIndex(
        headers,
        "instrument_type",
        "instrumenttype",
        "instrument_type_name",
        "type"
      ),
      isin: getColumnIndex(headers, "isin"),
      lotSize: getColumnIndex(headers, "lot_size", "lotsize"),
      tickSize: getColumnIndex(headers, "tick_size", "ticksize"),
      exchangeToken: getColumnIndex(headers, "exchange_token", "exchangetoken"),
      lastPrice: getColumnIndex(headers, "last_price", "ltp"),
    };

    // Segment is intentionally optional because the current complete master
    // often encodes NSE_EQ/BSE_EQ/NSE_INDEX/BSE_INDEX in instrument_key.
    for (const required of ["key", "tradingSymbol"]) {
      if (col[required] < 0) {
        throw new Error(
          `Upstox instrument master is missing the ${required} column. ` +
            `Received headers: ${headers.join(", ")}`
        );
      }
    }

    const instruments = [];
    const seen = new Set();

    for (let rowIndex = 1; rowIndex < lines.length; rowIndex += 1) {
      const cells = parseCsvLine(lines[rowIndex]);
      const get = (key) =>
        col[key] < 0 ? "" : String(cells[col[key]] ?? "").trim();

      const instrumentKey = get("key");
      const symbol = get("tradingSymbol");

      if (!instrumentKey || !symbol || seen.has(instrumentKey)) continue;

      const exchange = get("exchange");
      const instrumentType = get("instrumentType");
      const segment = inferSegment(
        instrumentKey,
        exchange,
        instrumentType,
        get("segment")
      );

      if (!segment) continue;

      const index = isIndexInstrument({
        segment,
        instrumentType,
        instrumentKey,
      });
      const equity = isEquityShare({
        segment,
        instrumentType,
        instrumentKey,
      });

      if (!index && !equity) continue;

      seen.add(instrumentKey);

      const resolvedExchange =
        segment.startsWith("BSE") || normalize(exchange) === "BSE"
          ? "BSE"
          : "NSE";

      const name = get("name") || symbol;
      const isin = get("isin");

      instruments.push({
        instrumentKey,
        instrument_key: instrumentKey,
        symbol,
        trading_symbol: symbol,
        name,
        exchange: resolvedExchange,
        segment,
        instrumentType: normalize(instrumentType) || (index ? "INDEX" : "EQ"),
        instrument_type: normalize(instrumentType) || (index ? "INDEX" : "EQ"),
        isin: isin || null,
        lotSize: safeNumber(get("lotSize")),
        tickSize: safeNumber(get("tickSize")),
        exchangeToken: get("exchangeToken") || null,
        lastPrice: safeNumber(get("lastPrice")),
        category: index ? "index" : "stock",
      });
    }

    if (instruments.length === 0) {
      throw new Error(
        "No NSE/BSE equity shares or supported indices were found in the " +
          "Upstox instrument master. Check the CSV header and instrument_key values."
      );
    }

    const loadedAt = Date.now();
    cache = { loadedAt, instruments };

    const stockCount = instruments.filter(
      (item) => item.category === "stock"
    ).length;
    const indexCount = instruments.length - stockCount;

    console.info(
      `[Upstox Instruments] Loaded ${instruments.length} instruments ` +
        `(${stockCount} stocks, ${indexCount} indices) from master.`
    );

    return instruments;
  })();

  try {
    return await pendingLoad;
  } catch (error) {
    // Preserve the last good cache if a forced refresh fails.
    if (cache.instruments.length > 0) {
      console.error(
        "[Upstox Instruments] Refresh failed; retaining previous cache:",
        error.message
      );
      return cache.instruments;
    }
    throw error;
  } finally {
    pendingLoad = null;
  }
}

async function searchInstruments({
  query = "",
  category = "all",
  exchange = "",
  limit = 100,
  forceRefresh = false,
} = {}) {
  const all = await loadInstrumentMaster(forceRefresh);
  const q = String(query ?? "").trim().toLowerCase();
  const cat = String(category || "all").trim().toLowerCase();
  const ex = normalize(exchange);
  const parsedLimit = Number.parseInt(limit, 10);
  const max = Math.min(
    Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 100, 1),
    MAX_SEARCH_LIMIT
  );

  let matches = all.filter((item) => {
    if (cat !== "all" && item.category !== cat) return false;
    if (ex && normalize(item.exchange) !== ex) return false;
    if (!q) return true;

    return (
      item.symbol.toLowerCase().includes(q) ||
      item.name.toLowerCase().includes(q) ||
      item.instrumentKey.toLowerCase().includes(q) ||
      String(item.isin || "").toLowerCase().includes(q)
    );
  });

  if (!q && cat === "all") {
    matches = [
      ...matches.filter((item) => item.category === "index"),
      ...matches.filter((item) => item.category === "stock"),
    ];
  }

  return {
    success: true,
    source: "upstox-instrument-master",
    updatedAt: cache.loadedAt
      ? new Date(cache.loadedAt).toISOString()
      : null,
    total: matches.length,
    data: matches.slice(0, max),
  };
}

function clearInstrumentMasterCache() {
  cache = { loadedAt: 0, instruments: [] };
}

module.exports = {
  searchInstruments,
  loadInstrumentMaster,
  clearInstrumentMasterCache,
  inferSegment,
};
