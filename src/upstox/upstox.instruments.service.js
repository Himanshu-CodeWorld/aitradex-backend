
"use strict";

const axios = require("axios");
const zlib = require("zlib");
const { promisify } = require("util");

const gunzip = promisify(zlib.gunzip);

const INSTRUMENT_MASTER_URL =
  process.env.UPSTOX_INSTRUMENT_MASTER_URL ||
  "https://assets.upstox.com/market-quote/instruments/exchange/complete.csv.gz";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 30000;
const MAX_SEARCH_LIMIT = 500;

let cache = {
  loadedAt: 0,
  instruments: [],
};

let pendingLoad = null;

/**
 * Normalize CSV header names, allowing variations such as:
 * instrument_key, Instrument Key, instrument-key.
 */
function normalizeHeader(value) {
  return String(value || "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function normalize(value) {
  return String(value || "").trim().toUpperCase();
}

/**
 * Parse a single CSV row while respecting quoted commas and escaped quotes.
 */
function parseCsvLine(line) {
  const result = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

/**
 * Infer segment from Upstox's instrument key first.
 *
 * Examples:
 * NSE_EQ|INE002A01018 -> NSE_EQ
 * BSE_EQ|500325       -> BSE_EQ
 * NSE_INDEX|Nifty 50  -> NSE_INDEX
 */
function inferSegment(instrumentKey, exchange, instrumentType) {
  const key = normalize(instrumentKey);
  const exchangeValue = normalize(exchange);
  const type = normalize(instrumentType);

  const keyMatch = key.match(
    /^(NSE_EQ|BSE_EQ|NSE_INDEX|BSE_INDEX)\|/
  );

  if (keyMatch) {
    return keyMatch[1];
  }

  const supportedSegments = [
    "NSE_EQ",
    "BSE_EQ",
    "NSE_INDEX",
    "BSE_INDEX",
  ];

  if (supportedSegments.includes(exchangeValue)) {
    return exchangeValue;
  }

  if (type === "EQ" && exchangeValue === "NSE") {
    return "NSE_EQ";
  }

  if (type === "EQ" && exchangeValue === "BSE") {
    return "BSE_EQ";
  }

  if (
    ["INDEX", "INDICES"].includes(type) &&
    exchangeValue === "NSE"
  ) {
    return "NSE_INDEX";
  }

  if (
    ["INDEX", "INDICES"].includes(type) &&
    exchangeValue === "BSE"
  ) {
    return "BSE_INDEX";
  }

  return "";
}

function isIndexInstrument({
  segment,
  instrumentType,
  instrumentKey,
}) {
  const s = normalize(segment);
  const t = normalize(instrumentType);
  const key = normalize(instrumentKey);

  return (
    s === "NSE_INDEX" ||
    s === "BSE_INDEX" ||
    key.startsWith("NSE_INDEX|") ||
    key.startsWith("BSE_INDEX|") ||
    (s.endsWith("_INDEX") && ["INDEX", "INDICES"].includes(t))
  );
}

/**
 * Only regular NSE/BSE equity shares are included as stocks.
 * ETFs, derivatives, bonds, currencies and commodities are excluded.
 */
function isEquityShare({
  segment,
  instrumentType,
  instrumentKey,
}) {
  const s = normalize(segment);
  const t = normalize(instrumentType);
  const key = normalize(instrumentKey);

  return (
    ["NSE_EQ", "BSE_EQ"].includes(s) &&
    (key.startsWith("NSE_EQ|") || key.startsWith("BSE_EQ|")) &&
    t === "EQ"
  );
}

function findColumn(headers, ...aliases) {
  for (const alias of aliases) {
    const index = headers.indexOf(normalizeHeader(alias));

    if (index >= 0) {
      return index;
    }
  }

  return -1;
}

function getCell(cells, index) {
  if (index < 0 || index >= cells.length) {
    return "";
  }

  return String(cells[index] ?? "").trim();
}

function getExchange(exchangeValue, segment) {
  const exchange = normalize(exchangeValue);

  if (exchange === "NSE" || exchange === "BSE") {
    return exchange;
  }

  if (exchange.startsWith("BSE") || normalize(segment).startsWith("BSE")) {
    return "BSE";
  }

  if (exchange.startsWith("NSE") || normalize(segment).startsWith("NSE")) {
    return "NSE";
  }

  return "";
}

async function downloadInstrumentCsv() {
  const response = await axios.get(INSTRUMENT_MASTER_URL, {
    responseType: "arraybuffer",
    timeout: REQUEST_TIMEOUT_MS,
    headers: {
      Accept: "application/gzip, text/csv, */*",
    },
  });

  let bytes = Buffer.from(response.data);

  if (!bytes.length) {
    throw new Error("Upstox instrument master returned an empty response.");
  }

  // Decompress gzip only when the response is actually gzip data.
  if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    bytes = await gunzip(bytes);
  }

  const csv = bytes.toString("utf8").replace(/^\uFEFF/, "");

  if (!csv.trim()) {
    throw new Error("Upstox instrument master CSV is empty.");
  }

  return csv;
}

async function loadInstrumentMaster(force = false) {
  const cacheIsFresh =
    cache.instruments.length > 0 &&
    Date.now() - cache.loadedAt < CACHE_TTL_MS;

  if (!force && cacheIsFresh) {
    return cache.instruments;
  }

  // Avoid duplicate downloads when several requests arrive together.
  if (pendingLoad) {
    return pendingLoad;
  }

  pendingLoad = (async () => {
    const csv = await downloadInstrumentCsv();
    const lines = csv
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0);

    if (lines.length < 2) {
      throw new Error(
        "Upstox instrument master must contain a header and data rows."
      );
    }

    const headers = parseCsvLine(lines[0]).map(normalizeHeader);

    const columns = {
      key: findColumn(headers, "instrument_key", "instrumentkey"),
      tradingSymbol: findColumn(
        headers,
        "trading_symbol",
        "tradingsymbol"
      ),
      name: findColumn(headers, "name", "instrument_name"),
      segment: findColumn(headers, "segment"),
      exchange: findColumn(headers, "exchange"),
      instrumentType: findColumn(
        headers,
        "instrument_type",
        "instrumenttype"
      ),
      isin: findColumn(headers, "isin"),
      lotSize: findColumn(headers, "lot_size", "lotsize"),
    };

    // Segment and instrument_type can be absent in some CSV variants.
    // The segment can be inferred from the instrument key.
    for (const required of ["key", "tradingSymbol"]) {
      if (columns[required] < 0) {
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

      const instrumentKey = getCell(cells, columns.key);
      const symbol = getCell(cells, columns.tradingSymbol);

      if (!instrumentKey || !symbol || seen.has(instrumentKey)) {
        continue;
      }

      const rawSegment = getCell(cells, columns.segment);
      const rawExchange = getCell(cells, columns.exchange);
      const instrumentType = getCell(cells, columns.instrumentType);

      const segment =
        rawSegment ||
        inferSegment(instrumentKey, rawExchange, instrumentType);

      // Never classify unknown segments as tradable equities.
      if (!segment) {
        continue;
      }

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

      if (!index && !equity) {
        continue;
      }

      // Skip rows with missing type unless the instrument key clearly
      // identifies a supported index. This avoids false stock matches.
      if (!instrumentType && !index) {
        continue;
      }

      const exchange = getExchange(rawExchange, segment);

      if (!exchange) {
        continue;
      }

      const name = getCell(cells, columns.name) || symbol;
      const isin = getCell(cells, columns.isin);
      const lotSizeValue = getCell(cells, columns.lotSize);
      const lotSize = Number(lotSizeValue);

      seen.add(instrumentKey);

      instruments.push({
        instrumentKey,
        instrument_key: instrumentKey,
        symbol,
        trading_symbol: symbol,
        name,
        exchange,
        segment,
        instrumentType: instrumentType || (index ? "INDEX" : "EQ"),
        instrument_type: instrumentType || (index ? "INDEX" : "EQ"),
        isin: isin || null,
        lotSize: Number.isFinite(lotSize) && lotSize > 0
          ? lotSize
          : null,
        category: index ? "index" : "stock",
      });
    }

    if (!instruments.length) {
      throw new Error(
        "No supported NSE/BSE equity shares or indices were found. " +
        `CSV headers: ${headers.join(", ")}`
      );
    }

    cache = {
      loadedAt: Date.now(),
      instruments,
    };

    const stockCount = instruments.filter(
      (item) => item.category === "stock"
    ).length;

    const indexCount = instruments.filter(
      (item) => item.category === "index"
    ).length;

    console.info(
      `[Upstox Instruments] Loaded ${instruments.length} instruments ` +
      `(${stockCount} stocks, ${indexCount} indices).`
    );

    return instruments;
  })();

  try {
    return await pendingLoad;
  } catch (error) {
    console.error(
      "[Upstox Instruments] Failed to load instrument master:",
      error.message
    );

    // Keep a previously loaded cache available if a forced refresh fails.
    if (cache.instruments.length > 0) {
      console.warn(
        "[Upstox Instruments] Using previously cached instrument data."
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

  const searchQuery = String(query || "").trim().toLowerCase();
  const selectedCategory = String(category || "all")
    .trim()
    .toLowerCase();
  const selectedExchange = normalize(exchange);

  const parsedLimit = Number.parseInt(limit, 10);
  const maxLimit = Math.min(
    Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 100, 1),
    MAX_SEARCH_LIMIT
  );

  if (!["all", "stock", "index"].includes(selectedCategory)) {
    throw new Error(
      "Invalid instrument category. Use all, stock, or index."
    );
  }

  let matches = all.filter((item) => {
    if (
      selectedCategory !== "all" &&
      item.category !== selectedCategory
    ) {
      return false;
    }

    if (
      selectedExchange &&
      normalize(item.exchange) !== selectedExchange
    ) {
      return false;
    }

    if (!searchQuery) {
      return true;
    }

    return (
      item.symbol.toLowerCase().includes(searchQuery) ||
      item.name.toLowerCase().includes(searchQuery) ||
      item.instrumentKey.toLowerCase().includes(searchQuery) ||
      String(item.isin || "").toLowerCase().includes(searchQuery)
    );
  });

  // List indices first for the default unfiltered search.
  if (!searchQuery && selectedCategory === "all") {
    matches = [
      ...matches.filter((item) => item.category === "index"),
      ...matches.filter((item) => item.category === "stock"),
    ];
  }

  return {
    success: true,
    source: "upstox-instrument-master",
    updatedAt: new Date(cache.loadedAt).toISOString(),
    total: matches.length,
    data: matches.slice(0, maxLimit),
  };
}

module.exports = {
  searchInstruments,
  loadInstrumentMaster,
};
