"use strict";
const entryService = require("../entry/entry.service");
const { ema, calculateRsi, calculateMacd, calculateAtr } = entryService._indicators;

function fail(message, code, status = 400) {
  const e = new Error(message); e.code = code; e.statusCode = status; throw e;
}
const n = (v) => (v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const r = (v, p = 2) => Number.isFinite(v) ? Math.round((v + Number.EPSILON) * 10 ** p) / 10 ** p : null;
const day = (v) => {
  if (typeof v === "string" && /^\\d{4}-\\d{2}-\\d{2}/.test(v)) return v.slice(0, 10);
  return new Date(v).toISOString().slice(0, 10);
};

function signalAt(candles, i) {
  if (i < 34) return null;
  const part = candles.slice(0, i + 1);
  const closes = part.map(x => x.close);
  const e9 = ema(closes, 9), e21 = ema(closes, 21);
  const rsi = calculateRsi(closes, 14), macd = calculateMacd(closes);
  const atr = calculateAtr(part, 14);
  if (![e9, e21, rsi, atr].every(Number.isFinite) || !macd) return null;
  return {
    enter: e9 > e21 && macd.macd > macd.signal && rsi >= 50 && rsi <= 70,
    exit: e9 < e21 || (macd.macd < macd.signal && rsi < 45),
    atr
  };
}
function metrics(trades, initial, curve) {
  const wins = trades.filter(t => t.netPnl > 0), losses = trades.filter(t => t.netPnl < 0);
  const profit = wins.reduce((s,t) => s+t.netPnl,0);
  const loss = Math.abs(losses.reduce((s,t) => s+t.netPnl,0));
  let peak = initial, dd = 0;
  for (const p of curve) { peak = Math.max(peak,p.equity); if (peak>0) dd=Math.max(dd,(peak-p.equity)/peak*100); }
  const final = curve.length ? curve[curve.length-1].equity : initial;
  return {
    initialCapital:r(initial), finalEquity:r(final), netPnl:r(final-initial),
    returnPercent:r((final-initial)/initial*100), totalTrades:trades.length,
    winningTrades:wins.length, losingTrades:losses.length,
    winRatePercent:r(trades.length ? wins.length/trades.length*100 : 0),
    profitFactor:loss>0?r(profit/loss):(profit>0?null:0),
    averageWin:r(wins.length?profit/wins.length:0),
    averageLoss:r(losses.length?-loss/losses.length:0),
    grossProfit:r(profit), grossLoss:r(loss), maxDrawdownPercent:r(dd)
  };
}
function validateDate(value, field) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0,10)!==value) {
    fail(`${field} must be a valid YYYY-MM-DD date.`, `INVALID_${field.toUpperCase()}`);
  }
  return value;
}

async function runBacktest(input = {}) {
  const capital = n(input.initialCapital) ?? 100000;
  const lookback = n(input.lookbackDays) ?? 180;
  const allocation = n(input.allocationPercent) ?? 95;
  const atrMult = n(input.atrMultiplier) ?? 1.5;
  const targetR = n(input.targetR) ?? 2;
  const bps = n(input.costBpsPerSide) ?? 5;
  if (!(capital >= 1000 && capital <= 1e9)) fail("initialCapital must be between 1,000 and 1,000,000,000.","INVALID_INITIAL_CAPITAL");
  if (!Number.isInteger(lookback) || lookback<60 || lookback>365) fail("lookbackDays must be 60–365.","INVALID_LOOKBACK_DAYS");
  if (!(allocation>=1 && allocation<=100)) fail("allocationPercent must be 1–100.","INVALID_ALLOCATION_PERCENT");
  if (!(atrMult>=0.5 && atrMult<=5)) fail("atrMultiplier must be 0.5–5.","INVALID_ATR_MULTIPLIER");
  if (!(targetR>=0.5 && targetR<=10)) fail("targetR must be 0.5–10.","INVALID_TARGET_R");
  if (!(bps>=0 && bps<=100)) fail("costBpsPerSide must be 0–100.","INVALID_COST_BPS");

  const instrument = await entryService.resolveEquity(input);
  let candles = await entryService.fetchDailyCandles(instrument.instrumentKey);
  if (candles.length < 45) fail(`Need at least 45 completed daily candles; received ${candles.length}.`,"INSUFFICIENT_CANDLE_HISTORY",422);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  candles = candles.filter(c => day(c.timestamp) < today);
  const lastAvailable = day(candles[candles.length-1].timestamp);
  const end = input.endDate ? validateDate(input.endDate,"endDate") : lastAvailable;
  const start = input.startDate ? validateDate(input.startDate,"startDate") :
    day(new Date(Date.parse(`${end}T00:00:00Z`) - lookback*86400000).toISOString());
  if (start>=end) fail("startDate must be earlier than endDate.","INVALID_DATE_RANGE");
  if ((Date.parse(`${end}T00:00:00Z`)-Date.parse(`${start}T00:00:00Z`))/86400000 > 365) fail("Maximum backtest window is 365 calendar days.","BACKTEST_RANGE_TOO_LARGE");
  candles = candles.filter(c => day(c.timestamp) <= end);
  const warmup = day(new Date(Date.parse(`${start}T00:00:00Z`)-60*86400000).toISOString());
  candles = candles.filter(c => day(c.timestamp)>=warmup);
  const first = candles.findIndex(c=>day(c.timestamp)>=start);
  const last = candles.reduce((a,c,i)=>day(c.timestamp)<=end?i:a,-1);
  if (candles.length<45 || first<1 || last<=first) fail("Not enough candles for this range and indicator warm-up. Choose a later start date.","INSUFFICIENT_BACKTEST_CANDLES",422);
  const signals = candles.map((_,i)=>signalAt(candles,i));
  const trades=[], curve=[];
  let equity=capital, position=null, peak=capital;

  function close(i, price, reason) {
    const p=position, buyCost=p.entry*p.qty*bps/10000, sellCost=price*p.qty*bps/10000;
    const gross=(price-p.entry)*p.qty, net=gross-buyCost-sellCost;
    equity+=net;
    trades.push({tradeNumber:trades.length+1,direction:"LONG",entryDate:p.date,exitDate:day(candles[i].timestamp),
      entryPrice:r(p.entry),exitPrice:r(price),quantity:p.qty,stopLoss:r(p.stop),targetPrice:r(p.target),
      exitReason:reason,grossPnl:r(gross),estimatedCosts:r(buyCost+sellCost),netPnl:r(net),
      returnPercent:r(net/(p.entry*p.qty)*100)});
    position=null;
  }

  for (let i=first;i<=last;i++) {
    const c=candles[i], prev=signals[i-1];
    let closed=false;
    if (position) {
      const stopHit=c.low<=position.stop, targetHit=c.high>=position.target;
      if (stopHit) { close(i,c.open<=position.stop?c.open:position.stop,"STOP_LOSS"); closed=true; }
      else if (targetHit) { close(i,c.open>=position.target?c.open:position.target,"TARGET"); closed=true; }
      else if (prev && prev.exit) { close(i,c.open,"TECHNICAL_EXIT_NEXT_OPEN"); closed=true; }
    }
    if (!position && !closed && prev && prev.enter && i>first) {
      const entry=c.open, risk=prev.atr*atrMult, qty=Math.floor(equity*allocation/100/entry);
      if (entry>0 && entry-risk>0 && qty>0) position={date:day(c.timestamp),entry,qty,stop:entry-risk,target:entry+risk*targetR};
    }
    const marked=equity+(position?(c.close-position.entry)*position.qty:0);
    peak=Math.max(peak,marked);
    curve.push({date:day(c.timestamp),equity:r(marked),drawdownPercent:r(peak>0?(peak-marked)/peak*100:0)});
  }
  if (position) {
    close(last,candles[last].close,"END_OF_TEST_PERIOD");
    if(curve.length){curve[curve.length-1].equity=r(equity);curve[curve.length-1].drawdownPercent=r(peak>0?(peak-equity)/peak*100:0);}
  }
  const tested=candles.slice(first,last+1), m=metrics(trades,capital,curve);
  const buyHold=(tested[tested.length-1].close/tested[0].close-1)*100;
  return {
    instrument:{symbol:instrument.symbol,name:instrument.name,exchange:instrument.exchange,instrumentKey:instrument.instrumentKey},
    strategy:{name:"EMA 9/21 + RSI 14 + MACD + ATR stop/target",timeframe:"1D",
      entryRules:["EMA 9 above EMA 21","MACD above signal","RSI 14 between 50 and 70","Signal from completed candle; entry at next session open"],
      exitRules:["ATR stop-loss","ATR target using targetR","EMA 9 below EMA 21 OR MACD below signal with RSI below 45; exit next session open"],
      parameters:{initialCapital:r(capital),allocationPercent:allocation,atrMultiplier:atrMult,targetR,costBpsPerSide:bps}},
    period:{startDate:day(tested[0].timestamp),endDate:day(tested[tested.length-1].timestamp),requestedStartDate:start,requestedEndDate:end,candlesTested:tested.length,timeframe:"1D"},
    metrics:m,comparison:{buyAndHoldReturnPercent:r(buyHold),strategyReturnPercent:m.returnPercent,outperformancePercent:r(m.returnPercent-buyHold)},
    trades:trades.slice(-200),tradesReturned:Math.min(200,trades.length),tradesTruncated:trades.length>200,
    equityCurve:curve.slice(-200),equityCurveTruncated:curve.length>200,
    dataSource:"Upstox historical daily OHLCV candles",
    executionModel:"Signal on prior completed daily candle; fill at next open. Daily stop/target checks use OHLC; if both touch, stop is assumed first.",
    limitations:["Historical simulation only; not a forecast.","Daily OHLC cannot identify exact intraday sequence; stop-first assumption is conservative.","Costs are estimated using configurable basis points and do not precisely model Indian brokerage, STT, GST, stamp duty, taxes or slippage.","Corporate actions, dividends, delisted securities and survivorship bias are not fully modelled.","Long-only cash-equity integer units; no F&O, short selling, leverage or live order execution."],
    disclaimer:"Historical backtest results do not guarantee or predict future returns. Not investment advice.",
    generatedAt:new Date().toISOString()
  };
}
module.exports={runBacktest};
