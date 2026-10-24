const { searchInstruments } = require("./upstox.instruments.service");

async function getInstruments(req, res) {
  try {
    const rawCategory = String(req.query.category || "all").trim().toLowerCase();
    const allowedCategories = new Set(["all", "stock", "index"]);
    const category = allowedCategories.has(rawCategory) ? rawCategory : "all";

    const rawLimit = Number.parseInt(String(req.query.limit || "100"), 10);
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 100, 1), 500);

    const result = await searchInstruments({
      query: req.query.query || req.query.q || "",
      category,
      exchange: req.query.exchange || "",
      limit,
      forceRefresh: String(req.query.refresh || "").toLowerCase() === "true",
    });

    // Do not cache forced refreshes; ordinary catalogue results may be cached briefly.
    res.set("Cache-Control", req.query.refresh === "true"
      ? "no-store"
      : "public, max-age=300");

    return res.status(200).json(result);
  } catch (error) {
    console.error("[Upstox Instruments]", error.stack || error.message);
    return res.status(502).json({
      success: false,
      code: "UPSTOX_INSTRUMENT_MASTER_UNAVAILABLE",
      message: "Unable to load the Upstox instrument catalogue. Retry shortly.",
    });
  }
}

module.exports = { getInstruments };
