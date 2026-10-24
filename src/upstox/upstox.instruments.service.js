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

async function loadInstrumentMaster(force = false) {
  if (!force && cache.instruments.length && Date.now() - cache.loadedAt < CACHE_TTL_MS) {
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
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
      bytes = await gunzip(bytes);
    }
    const csv = bytes.toString("utf8").replace(/^\uFEFF/, "");
    const lines = csv.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) throw new Error("Upstox instrument master was empty.");

    const headers = parseCsvLine(lines[0]).map((v) => v.trim().toLowerCase());
    const idx = (...names) => names.map((n) => headers.indexOf(n)).find((i) => i >= 0) ?? -1;
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
    if (col.key < 0) throw new Error("Upstox instrument master has no instrument_key column.");

    const result = [];
    const seen = new Set();
    for (let i = 1; i < lines.length; i++) {
      const cells = parseCsvLine(lines[i]);
      const get = (key) => col[key] < 0 ? "" : String(cells[col[key]] || "").trim();
      const instrumentKey = get("key");
      const symbol = get("tradingSymbol");
      const name = get("name") || symbol;
      if (!instrumentKey || !symbol || seen.has(instrumentKey)) continue;
      seen.add(instrumentKey);
      const segment = get("segment");
      const exchange = get("exchange");
      const instrumentType = get("instrumentType");
      const isIndex = /INDEX/i.test(segment) || /INDEX/i.test(instrumentType) ||
        instrumentKey.startsWith("NSE_INDEX|") || instrumentKey.startsWith("BSE_INDEX|");
      // Dashboard supports tradable equities and indices. Other asset types can be added separately.
      const isEquity = /EQ/i.test(instrumentType) || /EQUITY/i.test(segment);
      if (!isIndex && !isEquity) continue;
      result.push({
        instrumentKey,
        symbol,
        name,
        exchange,
        segment,
        instrumentType,
        isin: get("isin") || null,
        lotSize: Number(get("lotSize")) || null,
        category: isIndex ? "index" : "stock",
      });
    }
    if (!result.length) throw new Error("No equity or index instruments were found in the Upstox master.");
    cache = { loadedAt: Date.now(), instruments: result };
    return result;
  })();

  try {
    return await pendingLoad;
  } finally {
    pendingLoad = null;
  }
}

async function searchInstruments({ query = "", category = "all", exchange = "", limit = 100, forceRefresh = false } = {}) {
  const all = await loadInstrumentMaster(forceRefresh);
  const q = String(query).trim().toLowerCase();
  const cat = String(category || "all").toLowerCase();
  const ex = String(exchange || "").trim().toUpperCase();
  const max = Math.min(Math.max(Number.parseInt(limit, 10) || 100, 1), 500);

  let matches = all.filter((item) => {
    if (cat !== "all" && item.category !== cat) return false;
    if (ex && item.exchange.toUpperCase() !== ex) return false;
    if (!q) return true;
    return item.symbol.toLowerCase().includes(q) ||
      item.name.toLowerCase().includes(q) ||
      item.instrumentKey.toLowerCase().includes(q) ||
      String(item.isin || "").toLowerCase().includes(q);
  });

  // Put common index entries first for an unfiltered dashboard feed, but never hardcode instruments.
  if (!q && cat === "all") {
    matches = [...matches.filter((x) => x.category === "index"), ...matches.filter((x) => x.category === "stock")];
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
