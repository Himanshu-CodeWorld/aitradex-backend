const { searchInstruments } = require("./upstox.instruments.service");

async function getInstruments(req, res) {
  try {
    const result = await searchInstruments({
      query: req.query.query || req.query.q || "",
      category: req.query.category || "all",
      exchange: req.query.exchange || "",
      limit: req.query.limit || 100,
      forceRefresh: req.query.refresh === "true",
    });
    res.set("Cache-Control", "public, max-age=300");
    return res.status(200).json(result);
  } catch (error) {
    console.error("[Upstox Instruments]", error.message);
    return res.status(502).json({
      success: false,
      code: "UPSTOX_INSTRUMENT_MASTER_UNAVAILABLE",
      message: "Unable to load the Upstox instrument catalogue. Retry shortly.",
    });
  }
}

module.exports = { getInstruments };
