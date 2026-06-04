import type { Candle } from './utils';
import { bollinger } from './indicators/bollinger';
import { rsi } from './indicators/rsi';
import { macd } from './indicators/macd';
import { emaCrossSignal, emaSeries } from './indicators/ema';
import { atr } from './indicators/atr';
import { cvd, relativeVolume } from './indicators/volume';
import { nearestSR, supportResistance } from './indicators/supportResistance';
import { detectFVG, fvgNear, type FVG } from './indicators/fvg';
import { detectOrderBlocks, obNear, type OrderBlock } from './indicators/orderBlock';
import { detectMarketStructure, latestMS, type MSSignal } from './indicators/marketStructure';
import { detectLiquiditySweeps, latestSweep, type Sweep } from './indicators/liquiditySweep';
import { adx, classifyRegime, type Regime } from './indicators/adx';
import { detectDivergence, type Divergence } from './indicators/divergence';
import { detectCVDDivergence, type CVDDivergence } from './indicators/cvdDivergence';
import { volumeProfile, nearestPOC, type VolumeProfile } from './indicators/volumeProfile';

export type SignalAction = 'BUY' | 'SELL' | 'HOLD';

export type SignalComponents = {
  bb: number;
  rsi: number;
  macd: number;
  sr: number;
  fvg: number;
  ema: number;
  volume: number;
  orderBlock: number;
  marketStructure: number;
  liquiditySweep: number;
  trend: number;
};

export type SignalRisk = {
  stopLoss: number;
  takeProfit: number;
  atr: number;
  rr: number;
  slSource: 'sr' | 'atr' | 'ref';
  tpSource: 'sr' | 'atr' | 'ref';
};

export type Signal = {
  action: SignalAction;
  score: number;
  confidence: number;
  reasons: string[];
  components: SignalComponents;
  risk: SignalRisk;
  price: number;
  fvgs: FVG[];
  orderBlocks: OrderBlock[];
  marketStructure: MSSignal[];
  sweeps: Sweep[];
  rsiValue: number | null;
  ema50: number | null;
  ema200: number | null;
  macdHist: number | null;
  bbPos: number | null;
  cvdSlope: number;
  rvol: number | null;
  adx: number | null;
  pdi: number | null;
  ndi: number | null;
  regime: Regime;
  regimeBias: 'bullish' | 'bearish' | 'neutral';
  rsiDivergence: Divergence | null;
  macdDivergence: Divergence | null;
  cvdDivergence: CVDDivergence | null;
  volumeProfile: VolumeProfile | null;
  pocNear: boolean;
};

/** Clamps a value between min and max */
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/**
 * Bollinger Bands position score.
 * Returns +15 at lower band, -15 at upper band, 0 at middle.
 * Linear interpolation between bands.
 */
const bbScore = (price: number, last: { upper: number | null; lower: number | null; middle: number | null }): number => {
  if (last.upper === null || last.lower === null || last.middle === null) return 0;
  const range = last.upper - last.lower;
  if (range === 0) return 0;
  if (price <= last.lower) return 15;
  if (price >= last.upper) return -15;
  const pos = (price - last.lower) / range; // 0..1
  return (0.5 - pos) * 30; // mid=0, lower=+15, upper=-15
};

/**
 * RSI score. Returns +20 for deep oversold (<25), -20 for deep overbought (>75),
 * scaled values in between, and 0 in the neutral zone (45-55).
 */
const rsiScore = (v: number | null): number => {
  if (v === null) return 0;
  if (v < 25) return 20;
  if (v < 35) return 12;
  if (v > 75) return -20;
  if (v > 65) return -12;
  if (v >= 45 && v <= 55) return 0;
  return v < 50 ? 4 : -4;
};

/**
 * MACD score. Evaluates crossover (+/-12) and histogram direction (+/-8 or +/-3).
 * Maximum score: ±20.
 */
const macdScore = (cur: { macd: number; signal: number; hist: number } | null, prev: { macd: number; signal: number; hist: number } | null): number => {
  if (!cur || !prev) return 0;
  let score = 0;
  // Crossover
  if (prev.macd <= prev.signal && cur.macd > cur.signal) score += 12;
  else if (prev.macd >= prev.signal && cur.macd < cur.signal) score -= 12;
  // Histogram direction
  if (cur.hist > 0 && cur.hist > prev.hist) score += 8;
  else if (cur.hist < 0 && cur.hist < prev.hist) score -= 8;
  else if (cur.hist > 0) score += 3;
  else if (cur.hist < 0) score -= 3;
  return score;
};

/**
 * Support/Resistance proximity score. Returns +15 near support, -15 near resistance,
 * +7/-7 at moderate distance (<1.5%). Adds +3 if price is near Volume POC.
 */
const srScore = (price: number, support: number | null, resistance: number | null, pocNear: boolean): number => {
  let s = 0;
  if (support !== null) {
    const distPct = ((price - support) / support) * 100;
    if (price <= support * 1.005) s += 15;
    else if (distPct < 1.5) s += 7;
  }
  if (resistance !== null) {
    const distPct = ((resistance - price) / price) * 100;
    if (price >= resistance * 0.995) s -= 15;
    else if (distPct < 1.5) s -= 7;
  }
  if (pocNear) s += 3;
  return s;
};

const fvgScore = (price: number, inside: FVG | null, nearestBull: FVG | null, nearestBear: FVG | null): number => {
  let s = 0;
  if (inside) {
    s += inside.type === 'bullish' ? 15 : -15;
  }
  if (nearestBull && !inside) {
    const distPct = ((price - nearestBull.top) / price) * 100;
    if (distPct <= 0.5) s += 8;
    else if (distPct <= 1.5) s += 4;
  }
  if (nearestBear && !inside) {
    const distPct = ((nearestBear.bottom - price) / price) * 100;
    if (distPct <= 0.5) s -= 8;
    else if (distPct <= 1.5) s -= 4;
  }
  return s;
};

const emaScore = (trend: 'bullish' | 'bearish' | 'neutral', price: number, ema50: number | null, ema200: number | null): number => {
  let s = 0;
  if (ema200 !== null) s += price > ema200 ? 5 : -5;
  if (ema50 !== null) s += price > ema50 ? 5 : -5;
  if (trend === 'bullish') s += 3;
  else if (trend === 'bearish') s -= 3;
  return clamp(s, -13, 13);
};

/**
 * Volume score combining RVOL, CVD slope, and CVD divergence.
 * RVOL: +5 if ≥1.5x, -3 if <0.7x. CVD slope: ±5. CVD divergence: ±5.
 * Clamped to [-10, +10].
 */
const volumeScore = (cvdSlope: number, rvol: number | null, cvdDiv: CVDDivergence | null): number => {
  let s = 0;
  if (rvol !== null) {
    if (rvol >= 1.5) s += 5;
    else if (rvol < 0.7) s -= 3;
  }
  if (Math.abs(cvdSlope) > 0) s += Math.sign(cvdSlope) * 5;
  if (cvdDiv) {
    s += cvdDiv.type === 'bullish' ? 5 : -5;
  }
  return clamp(s, -10, 10);
};

const obScore = (price: number, inside: OrderBlock | null, nearestBull: OrderBlock | null, nearestBear: OrderBlock | null): number => {
  let s = 0;
  if (inside) s += inside.type === 'bullish' ? 10 : -10;
  if (!inside) {
    if (nearestBull) {
      const d = ((price - nearestBull.top) / price) * 100;
      if (d <= 0.5) s += 5;
    }
    if (nearestBear) {
      const d = ((nearestBear.bottom - price) / price) * 100;
      if (d <= 0.5) s -= 5;
    }
  }
  return s;
};

const msScore = (ms: MSSignal | null): number => {
  if (!ms) return 0;
  if (ms.type === 'CHoCH') return ms.direction === 'bullish' ? 8 : -8;
  return ms.direction === 'bullish' ? 4 : -4;
};

const sweepScore = (sweep: Sweep | null, price: number): number => {
  if (!sweep) return 0;
  const distPct = (Math.abs(price - sweep.level) / price) * 100;
  if (distPct > 1.5) return 0;
  return sweep.type === 'bullish' ? 5 : -5;
};

/**
 * Computes a composite trading signal from OHLCV candle data.
 *
 * Evaluates 11 indicator components across 3 dimensions (trend, momentum, structure)
 * and produces a score in [-100, +100], action (BUY/SELL/HOLD), confidence (sigmoid-based),
 * risk levels (adaptive SL/TP using S/R + ATR), and structured reasons.
 *
 * Requires at least 210 candles for warmup. Returns null if insufficient data.
 *
 * @param candles - Array of OHLCV candles (newest last)
 * @returns Signal object or null if insufficient data
 */
export const computeSignal = (candles: Candle[]): Signal | null => {
  if (candles.length < 210) return null;
  const closes = candles.map((c) => c.close);
  const price = closes[closes.length - 1];

  const bb = bollinger(candles, 20, 2);
  const rsiSeries = rsi(closes, 14);
  const macdSeries = macd(closes, 12, 26, 9);
  const ema50Series = emaSeries(closes, 50);
  const ema200Series = emaSeries(closes, 200);
  const emaCross = emaCrossSignal(closes, 50, 200);
  const atrSeries = atr(candles, 14);
  const cv = cvd(candles);
  const rvol = relativeVolume(candles, 20);
  const sr = supportResistance(candles, 100);
  const fvgs = detectFVG(candles, 100, 0.05);
  const obs = detectOrderBlocks(candles, 100, 0.4);
  const ms = detectMarketStructure(candles, 100);
  const sweeps = detectLiquiditySweeps(candles, 100, 0.002);
  const adxSeries = adx(candles, 14);
  const rsiDiv = detectDivergence(closes, rsiSeries, 3, 100);
  const macdLineSeries = macdSeries.map((m) => m.macd);
  const macdDiv = detectDivergence(closes, macdLineSeries, 3, 100);
  const cvdDiv = detectCVDDivergence(closes, cv.cvd, 3, 100);
  const vp = volumeProfile(candles, 50, 0.7);
  const pocNearPrice = nearestPOC(price, vp);

  const lastBB = bb[bb.length - 1];
  const lastRSI = rsiSeries[rsiSeries.length - 1];
  const lastMACD = macdSeries[macdSeries.length - 1];
  const prevMACD = macdSeries[macdSeries.length - 2];
  const lastATR = atrSeries[atrSeries.length - 1];
  const lastEma50 = ema50Series[ema50Series.length - 1];
  const lastEma200 = ema200Series[ema200Series.length - 1];
  const lastADX = adxSeries[adxSeries.length - 1];
  const { regime, bias: regimeBias } = classifyRegime(lastADX.adx, lastADX.pdi, lastADX.ndi);

  const allLevels = [...sr.pivots, ...sr.supports, ...sr.resistances];
  const nearest = nearestSR(price, allLevels);
  const fvgCtx = fvgNear(price, fvgs);
  const obCtx = obNear(price, obs);
  const msLast = latestMS(ms);
  const sweepLast = latestSweep(sweeps);

  const components: SignalComponents = {
    bb: bbScore(price, lastBB),
    rsi: rsiScore(lastRSI),
    macd: macdScore(lastMACD && prevMACD ? { macd: lastMACD.macd!, signal: lastMACD.signal!, hist: lastMACD.hist! } : null, prevMACD ? { macd: prevMACD.macd!, signal: prevMACD.signal!, hist: prevMACD.hist! } : null),
    sr: srScore(price, nearest.support?.price ?? null, nearest.resistance?.price ?? null, pocNearPrice !== null),
    fvg: fvgScore(price, fvgCtx.inside, fvgCtx.nearestBull, fvgCtx.nearestBear),
    ema: emaScore(emaCross.trend, price, lastEma50, lastEma200),
    volume: volumeScore(cv.slope, rvol, cvdDiv),
    orderBlock: obScore(price, obCtx.inside, obCtx.nearestBull, obCtx.nearestBear),
    marketStructure: msScore(msLast),
    liquiditySweep: sweepScore(sweepLast, price),
    trend: 0,
  };

  // Trend alignment: if EMA50 > EMA200 and price > both → bullish bias
  let trend = 0;
  if (lastEma50 !== null && lastEma200 !== null) {
    if (price > lastEma50 && lastEma50 > lastEma200) trend = 7;
    else if (price < lastEma50 && lastEma50 < lastEma200) trend = -7;
    else if (price > lastEma200) trend = 3;
    else trend = -3;
  }
  components.trend = trend;

  const score = clamp(
    Math.round(
      components.bb +
        components.rsi +
        components.macd +
        components.sr +
        components.fvg +
        components.ema +
        components.volume +
        components.orderBlock +
        components.marketStructure +
        components.liquiditySweep +
        components.trend
    ),
    -100,
    100
  );

  const action: SignalAction = score >= 40 ? 'BUY' : score <= -40 ? 'SELL' : 'HOLD';
  // Sigmoid confidence: maps |score| -> probability-like score in [10, 95]
  // Midpoint at |score|=50 (between threshold 40 and max 100), steepness k=10
  // This means: score 40 -> ~50%, score 50 -> ~50%, score 70 -> ~88%, score 30 -> ~27%
  // Avoids the old linear `|score|+10` that gave 40 -> 50% right at the trigger
  const confidence = Math.round(10 + 85 / (1 + Math.exp(-(Math.abs(score) - 50) / 10)));

  const reasons: string[] = [];
  if (lastRSI !== null) reasons.push(`RSI ${lastRSI.toFixed(1)} → ${lastRSI < 30 ? 'oversold' : lastRSI > 70 ? 'overbought' : 'neutral'}`);
  if (lastMACD) reasons.push(`MACD ${lastMACD.macd! > lastMACD.signal! ? 'bullish' : 'bearish'} cross`);
  if (lastBB) reasons.push(`BB position ${((lastBB.lower && lastBB.upper) ? ((price - lastBB.lower) / (lastBB.upper - lastBB.lower)) * 100 : 0).toFixed(0)}%`);
  if (emaCross.trend !== 'neutral') reasons.push(`EMA50/200 ${emaCross.trend}`);
  if (fvgCtx.inside) reasons.push(`Price inside ${fvgCtx.inside.type} FVG`);
  if (obCtx.inside) reasons.push(`Price inside ${obCtx.inside.type} order block`);
  if (msLast) reasons.push(`Market: ${msLast.type} ${msLast.direction}`);
  if (sweepLast) reasons.push(`Recent ${sweepLast.type} liquidity sweep`);
  if (rvol !== null) reasons.push(`RVOL ${rvol.toFixed(2)}x`);
  if (lastADX.adx !== null) reasons.push(`ADX ${lastADX.adx.toFixed(0)} · ${regime}${regimeBias !== 'neutral' ? ' ' + regimeBias : ''}`);
  if (rsiDiv) reasons.push(`${rsiDiv.kind === 'regular' ? 'Regular' : 'Hidden'} ${rsiDiv.type} RSI divergence`);
  if (macdDiv) reasons.push(`${macdDiv.kind === 'regular' ? 'Regular' : 'Hidden'} ${macdDiv.type} MACD divergence`);
  if (cvdDiv) reasons.push(`${cvdDiv.kind === 'regular' ? 'Regular' : 'Hidden'} ${cvdDiv.type} CVD divergence`);
  if (pocNearPrice !== null) reasons.push('Price near Volume POC (high interest)');

  // ADX regime gate: in ranging markets, suppress signal direction (force HOLD or dampen score).
  // Trending + aligned bias = keep full score. Trending + counter-bias = dampen. Ranging = HOLD.
  let gatedAction = action;
  let gatedConfidence = confidence;
  if (regime === 'ranging' && lastADX.adx !== null && lastADX.adx < 20) {
    gatedAction = 'HOLD';
    gatedConfidence = Math.min(gatedConfidence, 35);
  } else if (regime === 'trending' && regimeBias !== 'neutral' && action !== 'HOLD') {
    if ((action === 'BUY' && regimeBias === 'bearish') || (action === 'SELL' && regimeBias === 'bullish')) {
      gatedConfidence = Math.max(10, gatedConfidence - 25);
    }
  }
  const divBonus = (rsiDiv ? 6 : 0) + (macdDiv ? 6 : 0);
  gatedConfidence = Math.min(100, gatedConfidence + divBonus);

  // Adaptive SL/TP: blend nearest S/R with ATR floor
  // - SL: pick the MORE conservative (farther from entry) between S/R level + buffer and ATR*1.5
  // - TP: pick the MORE realistic (closer to entry) between S/R level - buffer and ATR*2.5
  // This yields R:R that adapts to market structure instead of always ~1.67:1
  const atrVal = lastATR ?? price * 0.01;
  const srBuffer = 0.0015; // 0.15% buffer beyond S/R level
  const maxSLDistPct = 0.05; // never set SL more than 5% away (sanity)

  let stopLoss = price;
  let takeProfit = price;
  let slSource: 'sr' | 'atr' | 'ref' = 'ref';
  let tpSource: 'sr' | 'atr' | 'ref' = 'ref';

  if (gatedAction === 'BUY') {
    const slATR = price - atrVal * 1.5;
    const slSR = nearest.support ? nearest.support.price * (1 - srBuffer) : null;
    const slSRDistPct = slSR !== null ? (price - slSR) / price : Infinity;
    const useSR_SL = slSR !== null && slSRDistPct <= maxSLDistPct;
    stopLoss = useSR_SL ? Math.max(slSR, slATR) : slATR;
    slSource = useSR_SL ? 'sr' : 'atr';

    const tpATR = price + atrVal * 2.5;
    const tpSR = nearest.resistance ? nearest.resistance.price * (1 - srBuffer) : null;
    const useSR_TP = tpSR !== null && tpSR < tpATR;
    takeProfit = useSR_TP ? tpSR : tpATR;
    tpSource = useSR_TP ? 'sr' : 'atr';
  } else if (gatedAction === 'SELL') {
    const slATR = price + atrVal * 1.5;
    const slSR = nearest.resistance ? nearest.resistance.price * (1 + srBuffer) : null;
    const slSRDistPct = slSR !== null ? (slSR - price) / price : Infinity;
    const useSR_SL = slSR !== null && slSRDistPct <= maxSLDistPct;
    stopLoss = useSR_SL ? Math.min(slSR, slATR) : slATR;
    slSource = useSR_SL ? 'sr' : 'atr';

    const tpATR = price - atrVal * 2.5;
    const tpSR = nearest.support ? nearest.support.price * (1 + srBuffer) : null;
    const useSR_TP = tpSR !== null && tpSR > tpATR;
    takeProfit = useSR_TP ? tpSR : tpATR;
    tpSource = useSR_TP ? 'sr' : 'atr';
  } else {
    // HOLD: show reference levels
    stopLoss = price - atrVal * 1.5;
    takeProfit = price + atrVal * 2.5;
  }
  const rr = Math.abs((takeProfit - price) / (price - stopLoss)) || 1;

  // Surface source in reasons for transparency
  if (gatedAction !== 'HOLD') {
    if (slSource === 'sr') reasons.push(`SL placed at S/R ${nearest.support?.price.toFixed(2) ?? ''}${gatedAction === 'SELL' ? ` / ${nearest.resistance?.price.toFixed(2) ?? ''}` : ''}`);
    if (tpSource === 'sr') reasons.push(`TP targets S/R ${nearest.resistance?.price.toFixed(2) ?? ''}${gatedAction === 'SELL' ? ` / ${nearest.support?.price.toFixed(2) ?? ''}` : ''}`);
    if (rr < 1.2) reasons.push(`⚠ Tight R:R 1:${rr.toFixed(2)}`);
  }

  return {
    action: gatedAction,
    score,
    confidence: gatedConfidence,
    reasons,
    components,
    risk: { stopLoss, takeProfit, atr: atrVal, rr, slSource, tpSource },
    price,
    fvgs,
    orderBlocks: obs,
    marketStructure: ms,
    sweeps,
    rsiValue: lastRSI,
    ema50: lastEma50,
    ema200: lastEma200,
    macdHist: lastMACD?.hist ?? null,
    bbPos: lastBB && lastBB.lower !== null && lastBB.upper !== null ? ((price - lastBB.lower) / (lastBB.upper - lastBB.lower)) * 100 : null,
    cvdSlope: cv.slope,
    rvol,
    adx: lastADX.adx,
    pdi: lastADX.pdi,
    ndi: lastADX.ndi,
    regime,
    regimeBias,
    rsiDivergence: rsiDiv,
    macdDivergence: macdDiv,
    cvdDivergence: cvdDiv,
    volumeProfile: vp,
    pocNear: pocNearPrice !== null,
  };
};
