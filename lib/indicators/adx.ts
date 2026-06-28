import type { Candle } from '../utils';

export type ADXPoint = { adx: number | null; pdi: number | null; ndi: number | null };

const wilderSmooth = (vals: number[], period: number, prev: number | null): (number | null)[] => {
  const out: (number | null)[] = [];
  let acc: number | null = prev;
  for (let i = 0; i < vals.length; i++) {
    if (acc === null) {
      acc = vals.slice(0, period).reduce((a, b) => a + b, 0);
      out.push(i === period - 1 ? acc : null);
    } else {
      acc = acc - acc / period + vals[i];
      out.push(acc);
    }
  }
  return out;
};

export const adx = (candles: Candle[], period = 14): ADXPoint[] => {
  const len = candles.length;
  const out: ADXPoint[] = Array.from({ length: len }, () => ({ adx: null, pdi: null, ndi: null }));
  if (len < period * 2 + 1) return out;

  const tr: number[] = new Array(len).fill(0);
  const pDM: number[] = new Array(len).fill(0);
  const nDM: number[] = new Array(len).fill(0);

  for (let i = 1; i < len; i++) {
    const cur = candles[i];
    const prev = candles[i - 1];
    const up = cur.high - prev.high;
    const down = prev.low - cur.low;
    tr[i] = Math.max(cur.high - cur.low, Math.abs(cur.high - prev.close), Math.abs(cur.low - prev.close));
    pDM[i] = up > down && up > 0 ? up : 0;
    nDM[i] = down > up && down > 0 ? down : 0;
  }

  const trS = wilderSmooth(tr, period, null);
  const pDMS = wilderSmooth(pDM, period, null);
  const nDMS = wilderSmooth(nDM, period, null);

  const dx: number[] = new Array(len).fill(0);
  for (let i = period; i < len; i++) {
    const t = trS[i] ?? 0;
    const p = pDMS[i] ?? 0;
    const n = nDMS[i] ?? 0;
    if (t === 0) {
      out[i] = { adx: out[i - 1].adx, pdi: 0, ndi: 0 };
      continue;
    }
    const pdi = (p / t) * 100;
    const ndi = (n / t) * 100;
    const sum = pdi + ndi;
    const dxVal = sum === 0 ? 0 : (Math.abs(pdi - ndi) / sum) * 100;
    dx[i] = dxVal;
    out[i] = { adx: null, pdi, ndi };
  }

  // Seed prevAdx with the simple average of the first `period` DX values
  // (i.e. the SMA at index `period*2 - 1`, the first valid ADX bar). Doing
  // this once outside the hot loop avoids an O(period) slice + reduce on
  // every iteration, which previously made the first ADX bar O(n) instead
  // of O(1) inside the loop.
  const seedEnd = period * 2 - 1;
  let prevAdx: number = seedEnd < len
    ? dx.slice(period, seedEnd + 1).reduce((a, b) => a + b, 0) / period
    : 0;
  if (seedEnd < len) {
    out[seedEnd] = { ...out[seedEnd], adx: prevAdx };
  }
  for (let i = seedEnd + 1; i < len; i++) {
    prevAdx = (prevAdx * (period - 1) + dx[i]) / period;
    out[i] = { ...out[i], adx: prevAdx };
  }

  return out;
};

export type Regime = 'trending' | 'ranging' | 'transitional';

export type RegimeResult = {
  regime: Regime;
  bias: 'bullish' | 'bearish' | 'neutral';
  strength: number;   // 0-100, how confident we are in the regime classification
  sideways: boolean;   // explicit sideways flag (subset of ranging)
};

/** Legacy simple classifier — kept for backward compat / tests */
export const classifyRegime = (adxVal: number | null, pdi: number | null, ndi: number | null): { regime: Regime; bias: 'bullish' | 'bearish' | 'neutral' } => {
  if (adxVal === null) return { regime: 'transitional', bias: 'neutral' };
  if (adxVal >= 25) {
    if (pdi === null || ndi === null) return { regime: 'trending', bias: 'neutral' };
    return { regime: 'trending', bias: pdi > ndi ? 'bullish' : pdi < ndi ? 'bearish' : 'neutral' };
  }
  if (adxVal < 20) return { regime: 'ranging', bias: 'neutral' };
  return { regime: 'transitional', bias: pdi !== null && ndi !== null ? (pdi > ndi ? 'bullish' : pdi < ndi ? 'bearish' : 'neutral') : 'neutral' };
};

/**
 * Multi-factor regime classifier.
 * Combines ADX + EMA spread + BB width + EMA50 cross frequency + EMA50 slope
 * to produce a richer regime classification that correctly identifies sideways/ranging
 * markets even when ADX lags.
 *
 * Scoring system (rangingScore 0-100):
 *   ADX component:      0-30 pts  (low ADX → high ranging score)
 *   EMA spread:         0-25 pts  (tight spread → high ranging score)
 *   BB width:           0-20 pts  (narrow bands → high ranging score)
 *   Cross frequency:    0-15 pts  (many crosses → high ranging score)
 *   EMA50 slope:        0-10 pts  (flat slope → high ranging score)
 *
 * Thresholds: rangingScore >= 55 → ranging, <= 30 → trending, else transitional
 */
export const classifyRegimeRich = (
  adxVal: number | null,
  pdi: number | null,
  ndi: number | null,
  emaSpreadPct: number | null,
  bbWidth: number | null,
  crossCount: number,
  ema50Slope: number | null,
): RegimeResult => {
  if (adxVal === null) return { regime: 'transitional', bias: 'neutral', strength: 0, sideways: false };

  let rangingScore = 0;

  // --- ADX component (0-30) ---
  // ADX < 15 → 30pts, ADX 15-20 → 20pts, ADX 20-25 → 10pts, ADX 25-30 → 5pts, ADX > 30 → 0
  if (adxVal < 15) rangingScore += 30;
  else if (adxVal < 20) rangingScore += 20 + 10 * ((20 - adxVal) / 5);
  else if (adxVal < 25) rangingScore += 10 * ((25 - adxVal) / 5);
  else if (adxVal < 30) rangingScore += 5 * ((30 - adxVal) / 5);

  // --- EMA spread component (0-25) ---
  // emaSpreadPct <= 0.3% → 25pts, <= 0.8% → 15pts, <= 1.5% → 8pts, > 1.5% → 0
  if (emaSpreadPct !== null) {
    if (emaSpreadPct <= 0.3) rangingScore += 25;
    else if (emaSpreadPct <= 0.8) rangingScore += 15 + 10 * ((0.8 - emaSpreadPct) / 0.5);
    else if (emaSpreadPct <= 1.5) rangingScore += 8 * ((1.5 - emaSpreadPct) / 0.7);
  }

  // --- BB width component (0-20) ---
  // bbWidth <= 3% → 20pts, <= 6% → 14pts, <= 10% → 6pts, > 10% → 0
  if (bbWidth !== null) {
    if (bbWidth <= 3) rangingScore += 20;
    else if (bbWidth <= 6) rangingScore += 14 + 6 * ((6 - bbWidth) / 3);
    else if (bbWidth <= 10) rangingScore += 6 * ((10 - bbWidth) / 4);
  }

  // --- Cross frequency component (0-15) ---
  // crosses in last 20 bars: >= 5 → 15pts, >= 3 → 10pts, >= 2 → 5pts, < 2 → 0
  if (crossCount >= 5) rangingScore += 15;
  else if (crossCount >= 3) rangingScore += 10 + 5 * ((crossCount - 3) / 2);
  else if (crossCount >= 2) rangingScore += 5;

  // --- EMA50 slope component (0-10) ---
  // flat slope (|slope| < 0.05%) → 10pts, < 0.15% → 5pts, else 0
  if (ema50Slope !== null) {
    const absSlope = Math.abs(ema50Slope);
    if (absSlope < 0.05) rangingScore += 10;
    else if (absSlope < 0.15) rangingScore += 5 + 5 * ((0.15 - absSlope) / 0.1);
  }

  // --- Classify ---
  rangingScore = Math.round(Math.min(100, Math.max(0, rangingScore)));
  const sideways = rangingScore >= 60;

  let regime: Regime;
  if (rangingScore >= 55) regime = 'ranging';
  else if (rangingScore <= 30) regime = 'trending';
  else regime = 'transitional';

  // Bias from DI
  let bias: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  if (pdi !== null && ndi !== null) {
    if (regime === 'ranging' || sideways) {
      // In ranging, suppress bias unless DI difference is very large
      const diDiff = Math.abs(pdi - ndi);
      if (diDiff > 15) bias = pdi > ndi ? 'bullish' : 'bearish';
    } else {
      bias = pdi > ndi ? 'bullish' : pdi < ndi ? 'bearish' : 'neutral';
    }
  }

  // Strength: how confident we are
  // For trending: higher ADX + wider spread → stronger
  // For ranging: higher rangingScore → stronger
  let strength: number;
  if (regime === 'trending') {
    strength = Math.min(100, Math.round(adxVal * 2 + (emaSpreadPct ?? 0) * 10));
  } else if (regime === 'ranging') {
    strength = rangingScore;
  } else {
    strength = Math.round(50 - Math.abs(rangingScore - 42.5));
  }

  return { regime, bias, strength: Math.min(100, Math.max(0, strength)), sideways };
};
