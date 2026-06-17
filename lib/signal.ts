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
import { adx, classifyRegime, classifyRegimeRich, type Regime, type RegimeResult } from './indicators/adx';
import { detectDivergence, type Divergence } from './indicators/divergence';
import { detectCVDDivergence, type CVDDivergence } from './indicators/cvdDivergence';
import { volumeProfile, nearestPOC, type VolumeProfile } from './indicators/volumeProfile';
import { safeIndicator } from './safeIndicator';

export type SignalAction = 'BUY' | 'SELL' | 'HOLD';

/** Per-component weights (max absolute contribution of each scoring component). */
export type SignalWeights = {
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
  divergence: number;
};

export const DEFAULT_WEIGHTS: SignalWeights = {
  bb: 12,
  rsi: 15,
  macd: 15,
  sr: 15,
  fvg: 12,
  ema: 13,
  volume: 10,
  orderBlock: 12,
  marketStructure: 12,
  liquiditySweep: 8,
  trend: 15,
  divergence: 3,
};

export const resolveWeights = (override?: Partial<SignalWeights>): SignalWeights => ({
  ...DEFAULT_WEIGHTS,
  ...(override ?? {}),
});

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
  divergence: number;
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
  /** True if any indicator threw or returned malformed data; signal is best-effort. */
  degraded: boolean;
  /** Names of indicators that failed during computation. */
  degradedIndicators: string[];
};

/** Clamps a value between min and max */
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/**
 * Bollinger Bands position score.
 * Returns +w at lower band, -w at upper band, 0 at middle. w = weights.bb.
 */
const bbScore = (price: number, last: { upper: number | null; lower: number | null; middle: number | null }, w: number): number => {
  if (last.upper === null || last.lower === null || last.middle === null) return 0;
  const range = last.upper - last.lower;
  if (range === 0) return 0;
  if (price <= last.lower) return w;
  if (price >= last.upper) return -w;
  const pos = (price - last.lower) / range; // 0..1
  return (0.5 - pos) * 2 * w; // mid=0, lower=+w, upper=-w
};

/**
 * RSI score. w = weights.rsi. Deep oversold/overbought hit ±w; scaled between.
 */
const rsiScore = (v: number | null, w: number): number => {
  if (v === null) return 0;
  if (v < 25) return w;
  if (v < 35) return w * (10 / 15);
  if (v > 75) return -w;
  if (v > 65) return -w * (10 / 15);
  if (v >= 45 && v <= 55) return 0;
  return v < 50 ? w * (3 / 15) : -w * (3 / 15);
};

/**
 * MACD score. w = weights.macd. Crossover ±(9/15)w + histogram ±(6/15)w or ±(2/15)w.
 */
const macdScore = (
  cur: { macd: number; signal: number; hist: number } | null,
  prev: { macd: number; signal: number; hist: number } | null,
  w: number
): number => {
  if (!cur || !prev) return 0;
  let score = 0;
  if (prev.macd <= prev.signal && cur.macd > cur.signal) score += w * (9 / 15);
  else if (prev.macd >= prev.signal && cur.macd < cur.signal) score -= w * (9 / 15);
  if (cur.hist > 0 && cur.hist > prev.hist) score += w * (6 / 15);
  else if (cur.hist < 0 && cur.hist < prev.hist) score -= w * (6 / 15);
  else if (cur.hist > 0) score += w * (2 / 15);
  else if (cur.hist < 0) score -= w * (2 / 15);
  return score;
};

/**
 * S/R proximity score. w = weights.sr. +w near support, -w near resistance, +3 if near POC.
 * POC bonus fixed at 3 (not weighted; acts as a tie-breaker).
 */
const srScore = (price: number, support: number | null, resistance: number | null, pocNear: boolean, w: number): number => {
  let s = 0;
  if (support !== null) {
    const distPct = ((price - support) / support) * 100;
    if (price <= support * 1.005) s += w;
    else if (distPct < 1.5) s += w * (7 / 15);
  }
  if (resistance !== null) {
    const distPct = ((resistance - price) / price) * 100;
    if (price >= resistance * 0.995) s -= w;
    else if (distPct < 1.5) s -= w * (7 / 15);
  }
  if (pocNear) s += 3;
  return s;
};

const fvgScore = (price: number, inside: FVG | null, nearestBull: FVG | null, nearestBear: FVG | null, w: number): number => {
  let s = 0;
  if (inside) {
    s += inside.type === 'bullish' ? w : -w;
  }
  if (nearestBull && !inside) {
    const distPct = ((price - nearestBull.top) / price) * 100;
    if (distPct <= 0.5) s += w * (6 / 12);
    else if (distPct <= 1.5) s += w * (3 / 12);
  }
  if (nearestBear && !inside) {
    const distPct = ((nearestBear.bottom - price) / price) * 100;
    if (distPct <= 0.5) s -= w * (6 / 12);
    else if (distPct <= 1.5) s -= w * (3 / 12);
  }
  return s;
};

const emaScore = (trend: 'bullish' | 'bearish' | 'neutral', price: number, ema50: number | null, ema200: number | null, w: number): number => {
  let s = 0;
  if (ema200 !== null) s += price > ema200 ? w * (5 / 13) : -w * (5 / 13);
  if (ema50 !== null) s += price > ema50 ? w * (5 / 13) : -w * (5 / 13);
  if (trend === 'bullish') s += w * (3 / 13);
  else if (trend === 'bearish') s -= w * (3 / 13);
  return clamp(s, -w, w);
};

/**
 * Volume score. w = weights.volume. Clamped to [-w, +w].
 */
const volumeScore = (cvdSlope: number, rvol: number | null, cvdDiv: CVDDivergence | null, w: number): number => {
  let s = 0;
  if (rvol !== null) {
    if (rvol >= 1.5) s += w * (5 / 10);
    else if (rvol < 0.7) s -= w * (3 / 10);
  }
  if (Math.abs(cvdSlope) > 0) s += Math.sign(cvdSlope) * w * (5 / 10);
  if (cvdDiv) {
    s += cvdDiv.type === 'bullish' ? w * (5 / 10) : -w * (5 / 10);
  }
  return clamp(s, -w, w);
};

const obScore = (price: number, inside: OrderBlock | null, nearestBull: OrderBlock | null, nearestBear: OrderBlock | null, w: number): number => {
  let s = 0;
  if (inside) s += inside.type === 'bullish' ? w : -w;
  if (!inside) {
    if (nearestBull) {
      const d = ((price - nearestBull.top) / price) * 100;
      if (d <= 0.5) s += w * (6 / 12);
    }
    if (nearestBear) {
      const d = ((nearestBear.bottom - price) / price) * 100;
      if (d <= 0.5) s -= w * (6 / 12);
    }
  }
  return s;
};

const msScore = (ms: MSSignal | null, w: number): number => {
  if (!ms) return 0;
  if (ms.type === 'CHoCH') return ms.direction === 'bullish' ? w : -w;
  return ms.direction === 'bullish' ? w * (6 / 12) : -w * (6 / 12);
};

const sweepScore = (sweep: Sweep | null, price: number, w: number): number => {
  if (!sweep) return 0;
  const distPct = (Math.abs(price - sweep.level) / price) * 100;
  if (distPct > 1.5) return 0;
  return sweep.type === 'bullish' ? w : -w;
};

/**
 * Volatility / regime helpers for adaptive scoring.
 */
const regimeThreshold = (regime: Regime): number => (regime === 'trending' ? 20 : regime === 'ranging' ? 30 : 25);
const regimeTrendMultiplier = (regime: Regime, bias: 'bullish' | 'bearish' | 'neutral'): number =>
  regime === 'trending' && bias !== 'neutral' ? 1.25 : regime === 'ranging' ? 0.9 : 1;
const regimeVolumeMultiplier = (regime: Regime): number => (regime === 'trending' ? 1.2 : regime === 'ranging' ? 0.95 : 1);
const trendFollowingBoost = (regime: Regime, adxVal: number | null, emaDiffPct: number | null, price: number, ema50: number | null, ema200: number | null, w: number): number => {
  if (ema50 === null || ema200 === null) return 0;
  const bullish = price > ema50 && ema50 > ema200;
  const bearish = price < ema50 && ema50 < ema200;
  const strongTrend = (adxVal ?? 0) >= 28 && (emaDiffPct ?? 0) >= 0.35;
  if (regime === 'trending' && strongTrend) {
    if (bullish) return w * 1.5;
    if (bearish) return -w * 1.5;
  }
  if (regime === 'ranging') {
    if (price <= ema50 && price < ema200) return w * 0.25;
    if (price >= ema50 && price > ema200) return -w * 0.25;
  }
  return 0;
};
/**
 * Compute auxiliary inputs for classifyRegimeRich from raw series data.
 */
const computeRegimeInputs = (
  closes: number[],
  ema50Series: (number | null)[],
  ema200Series: (number | null)[],
  bbWidth: number | null,
  adxVal: number | null
): { emaSpreadPct: number | null; crossCount: number; ema50Slope: number | null } => {
  const lastClose = closes[closes.length - 1];
  const ema50 = ema50Series[ema50Series.length - 1];
  const ema200 = ema200Series[ema200Series.length - 1];

  // EMA spread as % of price
  const emaSpreadPct = ema50 !== null && ema200 !== null && Number.isFinite(lastClose)
    ? Math.abs((ema50 - ema200) / lastClose) * 100
    : null;

  // Count EMA50 crossings in last 20 bars
  const start = Math.max(1, closes.length - 20);
  let crossCount = 0;
  for (let i = start; i < closes.length; i++) {
    const prevEma = ema50Series[i - 1];
    const curEma = ema50Series[i];
    if (prevEma === null || curEma === null) continue;
    const prevSide = closes[i - 1] >= prevEma ? 1 : -1;
    const curSide = closes[i] >= curEma ? 1 : -1;
    if (prevSide !== curSide) crossCount++;
  }

  // EMA50 slope: % change over last 5 bars
  let ema50Slope: number | null = null;
  const slopeLen = 5;
  if (closes.length > slopeLen) {
    const curEma = ema50Series[ema50Series.length - 1];
    const prevEma = ema50Series[ema50Series.length - 1 - slopeLen];
    if (curEma !== null && prevEma !== null && prevEma !== 0) {
      ema50Slope = ((curEma - prevEma) / prevEma) * 100;
    }
  }

  return { emaSpreadPct, crossCount, ema50Slope };
};

const adaptiveConfidence = (score: number, regime: Regime, volumeBoost: number): number => {
  const absScore = Math.abs(score);
  const regimeFloor = regime === 'trending' ? 18 : regime === 'ranging' ? 12 : 15;
  const regimeBoost = regime === 'trending' ? 6 : 0;
  const base = regime === 'trending' ? 44 : 50;
  const confidence = regimeFloor + 82 / (1 + Math.exp(-(absScore - base) / 8)) + regimeBoost + volumeBoost;
  return Math.round(clamp(confidence, 10, 100));
};

const rangeMeanReversionBoost = (regime: Regime, price: number, ema50: number | null, ema200: number | null, rsiVal: number | null, bbPos: number | null, w: number): number => {
  if (regime !== 'ranging') return 0;
  let s = 0;
  const rsiOversold = rsiVal !== null && rsiVal < 32;
  const rsiOverbought = rsiVal !== null && rsiVal > 68;
  const bbOversold = bbPos !== null && bbPos <= 15;
  const bbOverbought = bbPos !== null && bbPos >= 85;
  const oversold = (rsiOversold && bbOversold) || (rsiOversold && bbPos !== null && bbPos <= 25) || (bbOversold && rsiVal !== null && rsiVal < 40);
  const overbought = (rsiOverbought && bbOverbought) || (rsiOverbought && bbPos !== null && bbPos >= 75) || (bbOverbought && rsiVal !== null && rsiVal > 60);
  if (oversold) s += w * 1.5;
  if (overbought) s -= w * 1.5;
  if (ema50 !== null && ema200 !== null) {
    const mid = (ema50 + ema200) / 2;
    if (price <= mid && oversold) s += w * 0.6;
    if (price >= mid && overbought) s -= w * 0.6;
  }
  return s;
};


export const computeSignal = (candles: Candle[], options?: { weights?: Partial<SignalWeights> }): Signal | null => {
  if (candles.length < 210) return null;
  const W = resolveWeights(options?.weights);
  const closes = candles.map((c) => c.close);
  const price = closes[closes.length - 1];
  const degradedIndicators: string[] = [];

  const bb = safeIndicator('bb', () => bollinger(candles, 20, 2), [], degradedIndicators);
  const rsiSeries = safeIndicator('rsi', () => rsi(closes, 14), [], degradedIndicators);
  const macdSeries = safeIndicator('macd', () => macd(closes, 12, 26, 9), [], degradedIndicators);
  const ema50Series = safeIndicator('ema50', () => emaSeries(closes, 50), [], degradedIndicators);
  const ema200Series = safeIndicator('ema200', () => emaSeries(closes, 200), [], degradedIndicators);
  const emaCross = safeIndicator('emaCross', () => emaCrossSignal(closes, 50, 200), { trend: 'neutral' as const, diff: null }, degradedIndicators);
  const atrSeries = safeIndicator('atr', () => atr(candles, 14), [], degradedIndicators);
  const cv = safeIndicator('cvd', () => cvd(candles), { cvd: [], slope: 0, delta: [] }, degradedIndicators);
  const rvol = safeIndicator('rvol', () => relativeVolume(candles, 20), null, degradedIndicators);
  const sr = safeIndicator('sr', () => supportResistance(candles, 100), { pivots: [], supports: [], resistances: [] }, degradedIndicators);
  const fvgs = safeIndicator('fvg', () => detectFVG(candles, 100, 0.05), [], degradedIndicators);
  const obs = safeIndicator('ob', () => detectOrderBlocks(candles, 100, 0.4), [], degradedIndicators);
  const ms = safeIndicator('ms', () => detectMarketStructure(candles, 100), [], degradedIndicators);
  const sweeps = safeIndicator('sweep', () => detectLiquiditySweeps(candles, 100, 0.002), [], degradedIndicators);
  const adxSeries = safeIndicator('adx', () => adx(candles, 14), [{ adx: null, pdi: null, ndi: null }], degradedIndicators);
  const rsiDiv = safeIndicator('rsiDiv', () => detectDivergence(closes, rsiSeries, 3, 100), null, degradedIndicators);
  const macdLineSeries = safeIndicator('macdLine', () => macdSeries.map((m) => m.macd), [], degradedIndicators);
  const macdDiv = safeIndicator('macdDiv', () => detectDivergence(closes, macdLineSeries, 3, 100), null, degradedIndicators);
  const cvdDiv = safeIndicator('cvdDiv', () => detectCVDDivergence(closes, cv.cvd, 3, 100), null, degradedIndicators);
  const vp = safeIndicator('vp', () => volumeProfile(candles, 50, 0.7), null, degradedIndicators);
  const pocNearPrice = safeIndicator('pocNear', () => nearestPOC(price, vp), null, degradedIndicators);

  const lastBB = bb[bb.length - 1];
  const bbPos = lastBB && lastBB.lower !== null && lastBB.upper !== null ? ((price - lastBB.lower) / (lastBB.upper - lastBB.lower)) * 100 : null;
  const lastRSI = rsiSeries[rsiSeries.length - 1];

  const lastMACD = macdSeries[macdSeries.length - 1];
  const prevMACD = macdSeries[macdSeries.length - 2];
  const lastATR = atrSeries[atrSeries.length - 1];
  const lastEma50 = ema50Series[ema50Series.length - 1];
  const lastEma200 = ema200Series[ema200Series.length - 1];
  const lastADX = adxSeries[adxSeries.length - 1];
  const bbWidth = bb[bb.length - 1]?.width ?? null;
  const regimeInputs = computeRegimeInputs(closes, ema50Series, ema200Series, bbWidth, lastADX.adx);
  const richRegime = classifyRegimeRich(
    lastADX.adx, lastADX.pdi, lastADX.ndi,
    regimeInputs.emaSpreadPct, bbWidth,
    regimeInputs.crossCount, regimeInputs.ema50Slope
  );
  const regime: Regime = richRegime.regime;
  const regimeBias = richRegime.bias;

  const allLevels = [...sr.pivots, ...sr.supports, ...sr.resistances];
  const nearest = nearestSR(price, allLevels);
  const fvgCtx = fvgNear(price, fvgs);
  const obCtx = obNear(price, obs);
  const msLast = latestMS(ms);
  const sweepLast = latestSweep(sweeps);

  const components: SignalComponents = {
    bb: bbScore(price, lastBB, W.bb),
    rsi: rsiScore(lastRSI, W.rsi),
    macd: macdScore(lastMACD && prevMACD ? { macd: lastMACD.macd!, signal: lastMACD.signal!, hist: lastMACD.hist! } : null, prevMACD ? { macd: prevMACD.macd!, signal: prevMACD.signal!, hist: prevMACD.hist! } : null, W.macd),
    sr: srScore(price, nearest.support?.price ?? null, nearest.resistance?.price ?? null, pocNearPrice !== null, W.sr),
    fvg: fvgScore(price, fvgCtx.inside, fvgCtx.nearestBull, fvgCtx.nearestBear, W.fvg),
    ema: emaScore(emaCross.trend, price, lastEma50, lastEma200, W.ema),
    volume: volumeScore(cv.slope, rvol, cvdDiv, W.volume),
    orderBlock: obScore(price, obCtx.inside, obCtx.nearestBull, obCtx.nearestBear, W.orderBlock),
    marketStructure: msScore(msLast, W.marketStructure),
    liquiditySweep: sweepScore(sweepLast, price, W.liquiditySweep),
    trend: 0,
    divergence: 0,
  };

  // Regime-aware scoring:
  // - trending: stronger trend-following bias
  // - ranging: oscillators/SR slightly more important, trend contribution dampened
  let trend = 0;
  if (lastEma50 !== null && lastEma200 !== null) {
    if (price > lastEma50 && lastEma50 > lastEma200) trend = W.trend;
    else if (price < lastEma50 && lastEma50 < lastEma200) trend = -W.trend;
    else if (price > lastEma200) trend = W.trend * (6 / 15);
    else trend = -W.trend * (6 / 15);
  }
  trend *= regimeTrendMultiplier(regime, regimeBias);
  components.trend = trend;

  const volumeBoost = Math.abs(volumeScore(cv.slope, rvol, cvdDiv, W.volume)) >= W.volume * 0.75 ? 4 : 0;
  const regimeVolumeBoost = (cvdDiv ? 2 : 0) + (rvol !== null && rvol >= 1.5 ? 2 : 0);
  components.volume *= regimeVolumeMultiplier(regime);

  // Divergence score: 50% of weight per bullish/bearish (RSI & MACD combined ≤ w)
  let divScore = 0;
  if (rsiDiv) divScore += rsiDiv.type === 'bullish' ? W.divergence * 0.5 : -W.divergence * 0.5;
  if (macdDiv) divScore += macdDiv.type === 'bullish' ? W.divergence * 0.5 : -W.divergence * 0.5;
  components.divergence = divScore;

  // Regime-specific component blending: in trend, let trend + volume dominate.
  const regimeScaledScore = clamp(
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
        components.trend +
        components.divergence
    ),
    -100,
    100
  );

  const score = clamp(
    Math.round(
      regimeScaledScore +
        rangeMeanReversionBoost(regime, price, lastEma50, lastEma200, lastRSI, bbPos, W.rsi) +
        trendFollowingBoost(regime, lastADX.adx, emaCross.diff, price, lastEma50, lastEma200, W.trend) +
        (regimeBias === 'bullish' ? 4 : regimeBias === 'bearish' ? -4 : 0) +
        (Math.sign(components.volume) === Math.sign(regimeScaledScore || trend || (regimeBias === 'bullish' ? 1 : regimeBias === 'bearish' ? -1 : 0)) ? regimeVolumeBoost : 0)
    ),
    -100,
    100
  );

  const threshold = regimeThreshold(regime);
  const action: SignalAction = score >= threshold ? 'BUY' : score <= -threshold ? 'SELL' : 'HOLD';
  const confidence = adaptiveConfidence(score, regime, volumeBoost + regimeVolumeBoost);


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
  if (lastADX.adx !== null) reasons.push(`ADX ${lastADX.adx.toFixed(0)} · ${regime}${regimeBias !== 'neutral' ? ' ' + regimeBias : ''} (str:${richRegime.strength})`);
  if (richRegime.sideways) reasons.push('Sideways detected: tight EMA spread + flat slope + EMA50 crossings');
  if (rsiDiv) reasons.push(`${rsiDiv.kind === 'regular' ? 'Regular' : 'Hidden'} ${rsiDiv.type} RSI divergence`);
  if (macdDiv) reasons.push(`${macdDiv.kind === 'regular' ? 'Regular' : 'Hidden'} ${macdDiv.type} MACD divergence`);
  if (cvdDiv) reasons.push(`${cvdDiv.kind === 'regular' ? 'Regular' : 'Hidden'} ${cvdDiv.type} CVD divergence`);
  if (pocNearPrice !== null) reasons.push('Price near Volume POC (high interest)');

  // Volume gate: require rvol >= 1.0 for any entry, rvol >= 1.2 for full confidence
  const rvolGate = rvol !== null && rvol >= 1.0;

  // SELL trend filter: no SELL if price > EMA200 (strong uptrend)
  const sellBlockedByTrend = action === 'SELL' && lastEma200 !== null && price > lastEma200 * 1.02;
  // BUY trend filter: no BUY if price < EMA200 * 0.98 (strong downtrend)
  const buyBlockedByTrend = action === 'BUY' && lastEma200 !== null && price < lastEma200 * 0.98;

  // SELL requires bearish bias + ADX > 20 (confirmed downtrend)
  const sellWeakTrend = action === 'SELL' && (regimeBias !== 'bearish' || (lastADX.adx ?? 0) < 20);

  // ADX regime gate:
  // - ranging: only suppress weak signals, not all signals
  // - trending + counter-bias: keep trade, penalize confidence harder
  let gatedAction = action;
  let gatedConfidence = confidence;
  if (regime === 'ranging' && lastADX.adx !== null && lastADX.adx < 18) {
    if (Math.abs(score) < threshold + 6) gatedAction = 'HOLD';
    gatedConfidence = Math.min(gatedConfidence, 45);
  } else if (regime === 'trending' && regimeBias !== 'neutral' && action !== 'HOLD') {
    if ((action === 'BUY' && regimeBias === 'bearish') || (action === 'SELL' && regimeBias === 'bullish')) {
      gatedConfidence = Math.max(10, gatedConfidence - 30);
    } else {
      gatedConfidence = Math.min(100, gatedConfidence + 6);
    }
  }
  const divBonus = (rsiDiv ? 2 : 0) + (macdDiv ? 2 : 0);
  gatedConfidence = Math.min(100, gatedConfidence + divBonus);

  // Apply volume gate: demote to HOLD if insufficient volume
  if (gatedAction !== 'HOLD' && !rvolGate) {
    gatedAction = 'HOLD';
    reasons.push('Volume gate: rvol < 1.0, insufficient volume for entry → HOLD');
  } else if (gatedAction !== 'HOLD' && rvol !== null && rvol < 1.2) {
    gatedConfidence = Math.min(gatedConfidence, 50);
    reasons.push(`Volume suboptimal: rvol ${rvol.toFixed(2)} < 1.2, confidence capped at 50`);
  }

  // Apply trend filters
  if (gatedAction === 'SELL' && sellBlockedByTrend) {
    gatedAction = 'HOLD';
    reasons.push('SELL blocked: price > EMA200×1.02 (strong uptrend)');
  }
  if (gatedAction === 'BUY' && buyBlockedByTrend) {
    gatedAction = 'HOLD';
    reasons.push('BUY blocked: price < EMA200×0.98 (strong downtrend)');
  }
  if (gatedAction === 'SELL' && sellWeakTrend) {
    gatedAction = 'HOLD';
    reasons.push('SELL blocked: no bearish regime bias or ADX < 20');
  }

  // Ranging entry quality gate:
  // In ranging regime, BUY/SELL must have BB extreme AND RSI extreme.
  // Volume confirmation is a bonus, not a substitute.
  if (regime === 'ranging' && gatedAction !== 'HOLD' && bbPos !== null && lastRSI !== null) {
    const isBuy = gatedAction === 'BUY';
    const bbExtreme = isBuy ? bbPos <= 20 : bbPos >= 80;
    const rsiExtreme = isBuy ? lastRSI < 35 : lastRSI > 65;
    const volumeConfirm = rvol !== null && rvol >= 1.0;
    if (!bbExtreme || !rsiExtreme) {
      gatedAction = 'HOLD';
      reasons.push('Ranging entry demoted: need both BB extreme (≤20/≥80) and RSI extreme (<35/>65)');
    } else if (!volumeConfirm) {
      gatedConfidence = Math.min(gatedConfidence, 45);
      reasons.push('Ranging entry: BB+RSI extreme confirmed, volume weak');
    }
  }

  // Volatile-regime gate:
  // High ATR% (noise) + counter-bias or weak setup → demote to HOLD.
  // Synthetic vol data has ATR% 1.7-2.3% but no real trend continuation,
  // so SL 0.8% is too tight. Real markets follow the same logic: chop
  // kills mean-reversion entries and tight stops on noisy swings.
  if (gatedAction !== 'HOLD' && lastATR !== null) {
    const atrPct = (lastATR / price) * 100;
    if (atrPct > 1.8) {
      const biasMatches = (gatedAction === 'BUY' && regimeBias === 'bullish') || (gatedAction === 'SELL' && regimeBias === 'bearish');
      const isDivergenceBacked = rsiDiv !== null || macdDiv !== null;
      const strongTrend = (lastADX.adx ?? 0) >= 50;
      if (!biasMatches && !isDivergenceBacked) {
        gatedAction = 'HOLD';
        reasons.push(`Volatile regime (ATR ${atrPct.toFixed(2)}%) + no bias/divergence confirmation → HOLD`);
      } else if (!strongTrend) {
        gatedAction = 'HOLD';
        reasons.push(`Volatile regime (ATR ${atrPct.toFixed(2)}%) but ADX ${(lastADX.adx ?? 0).toFixed(0)} < 50 — chop risk too high → HOLD`);
      } else {
        gatedConfidence = Math.min(gatedConfidence, 60);
        reasons.push(`Volatile regime (ATR ${atrPct.toFixed(2)}%, ADX ${(lastADX.adx ?? 0).toFixed(0)}): confidence capped at 60`);
      }
    }
  }

  // Graceful degradation penalty: each failed indicator reduces confidence by 6%
  // (floor at 10%) so the UI can still surface a best-effort signal.
  const degradedPenalty = degradedIndicators.length * 6;
  if (degradedPenalty > 0) {
    gatedConfidence = Math.max(10, gatedConfidence - degradedPenalty);
    if (degradedIndicators.length > 0) {
      reasons.push(`Degraded: ${degradedIndicators.length} indicator(s) unavailable (${degradedIndicators.slice(0, 3).join(', ')}${degradedIndicators.length > 3 ? '…' : ''})`);
    }
  }

  // Adaptive SL/TP:
  // trending → wider stops/targets to let trades breathe
  // ranging → tighter exits around local mean-reversion zones, with % floor
  // low confidence → extend TP to compensate for lower win rate
  const atrVal = lastATR ?? price * 0.01;
  const srBuffer = 0.0015;
  const maxSLDistPct = regime === 'trending' ? 0.08 : 0.05;
  const slAtrMult = regime === 'trending' ? 2.5 : regime === 'ranging' ? 2.0 : 2.0;
  const tpAtrMult = regime === 'trending' ? 4.0 : regime === 'ranging' ? 2.6 : 3.0;
  const minTPDistPct = regime === 'ranging' ? 0.012 : regime === 'trending' ? 0.012 : 0.006;
  const baseMinSLPct = regime === 'ranging' ? 0.010 : regime === 'trending' ? 0.008 : 0.005;
  const minSRSLDistPct = regime === 'ranging' ? 0.005 : 0.005;
  const minSRTPDistPct = regime === 'ranging' ? 0.012 : 0.012;

  // Volatility-adaptive SL floor: when ATR% > 1.5%, raise SL floor to ~0.4×ATR
  // so noise doesn't immediately trigger stops on tight entries.
  const atrPctForFloor = atrVal / price;
  const volAdjustedSLPct = atrPctForFloor > 0.015 ? Math.max(baseMinSLPct, atrPctForFloor * 0.35) : baseMinSLPct;
  const minSLPct = volAdjustedSLPct;

  // Dynamic TP multiplier: low confidence → extend TP to improve risk/reward
  const confTPMult = gatedConfidence < 40 ? 1.8 : gatedConfidence < 55 ? 1.4 : 1.0;


  let stopLoss = price;
  let takeProfit = price;
  let slSource: 'sr' | 'atr' | 'ref' = 'ref';
  let tpSource: 'sr' | 'atr' | 'ref' = 'ref';

  if (gatedAction === 'BUY') {
    const slATR = Math.max(price - atrVal * slAtrMult, price * (1 - minSLPct));
    const slSR = nearest.support && nearest.support.price < price ? nearest.support.price * (1 - srBuffer) : null;
    const slSRDistPct = slSR !== null ? (price - slSR) / price : Infinity;
    const useSR_SL = slSR !== null && slSRDistPct <= maxSLDistPct && slSRDistPct >= minSRSLDistPct;
    stopLoss = useSR_SL ? Math.max(slSR, slATR) : slATR;
    slSource = useSR_SL ? 'sr' : 'atr';

    const tpATR = Math.max(price + atrVal * tpAtrMult * confTPMult, price * (1 + minTPDistPct * confTPMult));
    const tpSR = nearest.resistance && nearest.resistance.price > price ? nearest.resistance.price * (1 - srBuffer) : null;
    const tpSRDistPct = tpSR !== null ? (tpSR - price) / price : 0;
    const tpSROnSide = tpSR !== null && tpSR > price;
    const tpSRMeetsR = tpSR !== null && tpSR >= tpATR;
    const tpSRNotTooTight = tpSRDistPct >= minSRTPDistPct;
    const useSR_TP = tpSR !== null && tpSROnSide && tpSRMeetsR && tpSRNotTooTight && (regime === 'ranging' ? tpSR <= tpATR * 1.2 : true);
    takeProfit = useSR_TP ? tpSR : tpATR;
    tpSource = useSR_TP ? 'sr' : 'atr';
  } else if (gatedAction === 'SELL') {
    const slATR = Math.min(price + atrVal * slAtrMult, price * (1 + minSLPct));
    const slSR = nearest.resistance && nearest.resistance.price > price ? nearest.resistance.price * (1 + srBuffer) : null;
    const slSRDistPct = slSR !== null ? (slSR - price) / price : Infinity;
    const useSR_SL = slSR !== null && slSRDistPct <= maxSLDistPct && slSRDistPct >= minSRSLDistPct;
    stopLoss = useSR_SL ? Math.min(slSR, slATR) : slATR;
    slSource = useSR_SL ? 'sr' : 'atr';

    const tpATR = Math.min(price - atrVal * tpAtrMult * confTPMult, price * (1 - minTPDistPct * confTPMult));
    const tpSR = nearest.support && nearest.support.price < price ? nearest.support.price * (1 + srBuffer) : null;
    const tpSRDistPct = tpSR !== null ? (price - tpSR) / price : 0;
    const tpSROnSide = tpSR !== null && tpSR < price;
    const tpSRMeetsR = tpSR !== null && tpSR <= tpATR;
    const tpSRNotTooTight = tpSRDistPct >= minSRTPDistPct;
    const useSR_TP = tpSR !== null && tpSROnSide && tpSRMeetsR && tpSRNotTooTight && (regime === 'ranging' ? tpSR >= tpATR * 0.8 : true);
    takeProfit = useSR_TP ? tpSR : tpATR;
    tpSource = useSR_TP ? 'sr' : 'atr';
  } else {
    stopLoss = price - atrVal * slAtrMult;
    takeProfit = price + atrVal * tpAtrMult;
  }
  const rr = Math.abs((takeProfit - price) / (price - stopLoss)) || 1;

  // Surface source in reasons for transparency
  if (gatedAction !== 'HOLD') {
    if (slSource === 'sr') reasons.push(`SL placed at S/R ${nearest.support?.price.toFixed(2) ?? ''}${gatedAction === 'SELL' ? ` / ${nearest.resistance?.price.toFixed(2) ?? ''}` : ''}`);
    if (tpSource === 'sr') reasons.push(`TP targets S/R ${nearest.resistance?.price.toFixed(2) ?? ''}${gatedAction === 'SELL' ? ` / ${nearest.support?.price.toFixed(2) ?? ''}` : ''}`);
    if (volAdjustedSLPct > baseMinSLPct) reasons.push(`Vol-adaptive SL floor raised to ${(volAdjustedSLPct * 100).toFixed(2)}% (ATR ${(atrPctForFloor * 100).toFixed(2)}%)`);
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
    degraded: degradedIndicators.length > 0,
    degradedIndicators,
  };
};
