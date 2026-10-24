const axios = require("axios");
const zlib = require("zlib");
const { promisify } = require("util");

const gunzip = promisify(zlib.gunzip);
const INSTRUMENT_MASTER_URL =
  process.env.UPSTOX_INSTRUMENT_MASTER_URL ||
  "https://assets.upstox.com/market-quote/instruments/exchange/complete.csv.gz";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

let cache = { loadedAt: 0, instruments: [] };
let pendingLoad = null;

function parseCsvLine(line) {
  const out = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (ch === "," && !quoted) {
      out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }

  out.push(current);
  return out;
}

function normalize(value) {
  return String(value || "").trim().toUpperCase();
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

// Only ordinary exchange-listed equity shares are classified as stock.
// This deliberately excludes SDLs, government/corporate bonds, ETFs,
// futures/options, currencies, commodities, and other non-equity products.
function isEquityShare({ segment, instrumentType, instrumentKey }) {
  const s = normalize(segment);
  const t = normalize(instrumentType);
  const key = normalize(instrumentKey);

  const validSegment = s === "NSE_EQ" || s === "BSE_EQ";
  const validKey = key.startsWith("NSE_EQ|") || key.startsWith("BSE_EQ|");
  return validSegment && validKey && t === "EQ";
}

async function loadInstrumentMaster(force = false) {
  if (
    !force &&
    cache.instruments.length &&
    Date.now() - cache.loadedAt < CACHE_TTL_MS
  ) {
    return cache.instruments;
  }

  if (pendingLoad) return pendingLoad;

  pendingLoad = (async () => {
    const response = await axios.get(INSTRUMENT_MASTER_URL, {
      responseType: "arraybuffer",
      timeout: 30000,
      headers: { Accept: "application/gzip, text/csv, */*" },
    });

    let bytes = Buffer.from(response.data);
    if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
      bytes = await gunzip(bytes);
    }

    const csv = bytes.toString("utf8").replace(/^\uFEFF/, "");
    const lines = csv.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length < 2) {
      throw new Error("Upstox instrument master was empty.");
    }

    const headers = parseCsvLine(lines[0]).map((value) =>
      value.trim().toLowerCase()
    );
    const idx = (...names) =>
      names.map((name) => headers.indexOf(name)).find((index) => index >= 0) ?? -1;

    const col = {
      key: idx("instrument_key", "instrumentkey"),
      tradingSymbol: idx("trading_symbol", "tradingsymbol"),
      name: idx("name", "instrument_name"),
      segment: idx("segment"),
      exchange: idx("exchange"),
      instrumentType: idx("instrument_type", "instrumenttype"),
      isin: idx("isin"),
      lotSize: idx("lot_size", "lotsize"),
    };

    for (const required of ["key", "tradingSymbol", "segment", "instrumentType"]) {
      if (col[required] < 0) {
        throw new Error(`Upstox instrument master is missing the ${required} column.`);
      }
    }

    const result = [];
    const seen = new Set();

    for (let i = 1; i < lines.length; i++) {
      const cells = parseCsvLine(lines[i]);
      const get = (key) =>
        col[key] < 0 ? "" : String(cells[col[key]] || "").trim();

      const instrumentKey = get("key");
      const symbol = get("tradingSymbol");
      if (!instrumentKey || !symbol || seen.has(instrumentKey)) continue;

      const segment = get("segment");
      const exchange = get("exchange");
      const instrumentType = get("instrumentType");
      const index = isIndexInstrument({ segment, instrumentType, instrumentKey });
      const equity = isEquityShare({ segment, instrumentType, instrumentKey });

      if (!index && !equity) continue;
      seen.add(instrumentKey);

      result.push({
        instrumentKey,
        instrument_key: instrumentKey,
        symbol,
        trading_symbol: symbol,
        name: get("name") || symbol,
        exchange: exchange || (segment.startsWith("BSE") ? "BSE" : "NSE"),
        segment,
        instrumentType,
        instrument_type: instrumentType,
        isin: get("isin") || null,
        lotSize: Number(get("lotSize")) || null,
        category: index ? "index" : "stock",
      });
    }

    if (!result.length) {
      throw new Error(
        "No NSE/BSE equity shares or supported indices were found in the Upstox master."
      );
    }

    cache = { loadedAt: Date.now(), instruments: result };
    console.info(
      `[Upstox Instruments] Loaded ${result.length} equity/index instruments ` +
      `(${result.filter((item) => item.category === "stock").length} stocks, ` +
      `${result.filter((item) => item.category === "index").length} indices).`
    );

    return result;
  })();

  try {
    return await pendingLoad;
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
  const q = String(query || "").trim().toLowerCase();
  const cat = String(category || "all").trim().toLowerCase();
  const ex = normalize(exchange);
  const parsedLimit = Number.parseInt(limit, 10);
  const max = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 100, 1), 500);

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

  // For the unfiltered "all" response, return indices first, then actual equities.
  if (!q && cat === "all") {
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
    data: matches.slice(0, max),
  };
}

module.exports = { searchInstruments, loadInstrumentMaster };
