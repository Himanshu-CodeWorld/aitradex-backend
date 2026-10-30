"use strict";

const BacktestRun = require("./BacktestRun");

function fail(message, code, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  throw error;
}

function requireUser(uid) {
  if (!uid || typeof uid !== "string") {
    fail("Authenticated user was not found.", "USER_NOT_AUTHENTICATED", 401);
  }
  return uid;
}

function numberOrNull(value) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function cleanArray(value) {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function getRunData(doc) {
  const result = doc.result && typeof doc.result === "object" ? doc.result : {};
  const strategy = result.strategy && typeof result.strategy === "object" ? result.strategy : {};
  const metrics = doc.metrics && Object.keys(doc.metrics).length ? doc.metrics : (result.metrics || {});
  const name = String(strategy.name || doc.name || "Unnamed strategy").trim();
  const entryRules = cleanArray(strategy.entryRules);
  const exitRules = cleanArray(strategy.exitRules);
  // Group by actual strategy rules, not just the editable display name.
  const signature = JSON.stringify({
    name: name.toLowerCase(),
    entryRules,
    exitRules,
  });
  return { result, strategy, metrics, name, entryRules, exitRules, signature };
}

function metric(metrics, key, alternateKeys = []) {
  for (const candidate of [key, ...alternateKeys]) {
    const value = numberOrNull(metrics?.[candidate]);
    if (value !== null) return value;
  }
  return null;
}

function round(value, digits = 2) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function summarizeRun(doc) {
  const data = getRunData(doc);
  return {
    id: String(doc._id),
    name: doc.name,
    strategyName: data.name,
    symbol: doc.symbol,
    exchange: doc.exchange,
    createdAt: doc.createdAt,
    period: doc.period || {},
    returnPercent: metric(data.metrics, "returnPercent", ["netReturnPercent"]),
    netPnl: metric(data.metrics, "netPnl", ["netProfit", "totalPnl"]),
    winRatePercent: metric(data.metrics, "winRatePercent", ["winRate"]),
    profitFactor: metric(data.metrics, "profitFactor"),
    maxDrawdownPercent: metric(data.metrics, "maxDrawdownPercent", ["maxDrawdown"]),
    totalTrades: metric(data.metrics, "totalTrades", ["tradeCount"]),
    entryRules: data.entryRules,
    exitRules: data.exitRules,
  };
}

function average(values) {
  const valid = values.filter((value) => value !== null && Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

async function getDashboard(uid, query = {}) {
  uid = requireUser(uid);
  const limit = Math.min(500, Math.max(1, Number.parseInt(query.limit, 10) || 300));
  const filter = { userId: uid };
  if (query.symbol) filter.symbol = String(query.symbol).trim().toUpperCase().slice(0, 30);

  const docs = await BacktestRun.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("name symbol exchange period parameters metrics comparison result createdAt updatedAt")
    .lean();

  // Fetch the most recent saved runs, then restore chronological order for charts.
  docs.reverse();
  const groups = new Map();
  const runs = docs.map((doc) => {
    const summary = summarizeRun(doc);
    const data = getRunData(doc);
    let group = groups.get(data.signature);
    if (!group) {
      group = {
        strategyKey: data.signature,
        name: data.name,
        entryRules: data.entryRules,
        exitRules: data.exitRules,
        runs: [],
      };
      groups.set(data.signature, group);
    }
    group.runs.push(summary);
    return summary;
  });

  const strategies = [...groups.values()].map((group) => {
    const strategyRuns = group.runs;
    const returns = strategyRuns.map((run) => run.returnPercent);
    const drawdowns = strategyRuns.map((run) => run.maxDrawdownPercent);
    const winRates = strategyRuns.map((run) => run.winRatePercent);
    const profitFactors = strategyRuns.map((run) => run.profitFactor);
    const pnlValues = strategyRuns.map((run) => run.netPnl).filter((value) => value !== null);
    const symbols = [...new Set(strategyRuns.map((run) => run.symbol))].sort();
    const avgReturn = average(returns);
    const avgDrawdown = average(drawdowns);
    const avgProfitFactor = average(profitFactors);

    return {
      strategyKey: group.strategyKey,
      name: group.name,
      entryRules: group.entryRules,
      exitRules: group.exitRules,
      runCount: strategyRuns.length,
      averageReturnPercent: round(avgReturn),
      totalNetPnl: round(pnlValues.reduce((sum, value) => sum + value, 0)),
      averageWinRatePercent: round(average(winRates)),
      averageProfitFactor: round(avgProfitFactor, 3),
      averageMaxDrawdownPercent: round(avgDrawdown),
      symbols,
      lastRunAt: strategyRuns[strategyRuns.length - 1]?.createdAt || null,
      timeline: strategyRuns.map((run) => ({
        runId: run.id,
        date: run.createdAt,
        symbol: run.symbol,
        returnPercent: run.returnPercent,
        netPnl: run.netPnl,
      })),
    };
  });

  // Transparent ranking: mean saved-run return, then lower drawdown, then higher profit factor.
  strategies.sort((a, b) => {
    if (a.averageReturnPercent === null && b.averageReturnPercent !== null) return 1;
    if (b.averageReturnPercent === null && a.averageReturnPercent !== null) return -1;
    if (a.averageReturnPercent !== null && b.averageReturnPercent !== null && a.averageReturnPercent !== b.averageReturnPercent) {
      return b.averageReturnPercent - a.averageReturnPercent;
    }
    if (a.averageMaxDrawdownPercent === null && b.averageMaxDrawdownPercent !== null) return 1;
    if (b.averageMaxDrawdownPercent === null && a.averageMaxDrawdownPercent !== null) return -1;
    if (a.averageMaxDrawdownPercent !== null && b.averageMaxDrawdownPercent !== null && a.averageMaxDrawdownPercent !== b.averageMaxDrawdownPercent) {
      return a.averageMaxDrawdownPercent - b.averageMaxDrawdownPercent;
    }
    return (b.averageProfitFactor ?? -Infinity) - (a.averageProfitFactor ?? -Infinity);
  });

  return {
    generatedAt: new Date().toISOString(),
    filters: { symbol: filter.symbol || null, limit },
    summary: {
      totalRuns: runs.length,
      strategyCount: strategies.length,
      symbolsCovered: [...new Set(runs.map((run) => run.symbol))].sort(),
      bestStrategyKey: strategies[0]?.strategyKey || null,
      bestStrategyName: strategies[0]?.name || null,
      rankingMethod: "Average saved backtest net return; ties use lower average max drawdown, then higher average profit factor.",
    },
    strategies,
    runs: runs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
  };
}

module.exports = { getDashboard };
