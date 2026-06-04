import type { Candle } from '../utils';

export type Sweep = {
  type: 'bullish' | 'bearish'; // bullish sweep: swept lows then reversed up
  level: number; // equal high/low
  sweepTime: number; // time of wick that swept
  sweepPrice: number;
  reversed: boolean; // has price reversed back?
};

const groupEqual = (prices: { idx: number; price: number }[], tolerancePct = 0.002): { idx: number; price: number }[][] => {
  prices.sort((a, b) => a.price - b.price);
  const groups: { idx: number; price: number }[][] = [];
  for (const p of prices) {
    const last = groups[groups.length - 1];
    if (last && Math.abs(p.price - last[0].price) / last[0].price <= tolerancePct) {
      last.push(p);
    } else {
      groups.push([p]);
    }
  }
  return groups.filter((g) => g.length >= 2);
};

const findEqual = (candles: Candle[], window = 3): { highs: { idx: number; price: number }[]; lows: { idx: number; price: number }[] } => {
  const highs: { idx: number; price: number }[] = [];
  const lows: { idx: number; price: number }[] = [];
  for (let i = window; i < candles.length - window; i++) {
    const c = candles[i];
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= window; j++) {
      if (candles[i - j].high >= c.high || candles[i + j].high >= c.high) isHigh = false;
      if (candles[i - j].low <= c.low || candles[i + j].low <= c.low) isLow = false;
    }
    if (isHigh) highs.push({ idx: i, price: c.high });
    if (isLow) lows.push({ idx: i, price: c.low });
  }
  return { highs, lows };
};

export const detectLiquiditySweeps = (candles: Candle[], lookback = 100, tolerancePct = 0.002): Sweep[] => {
  const out: Sweep[] = [];
  const start = Math.max(0, candles.length - lookback);
  const local = candles.slice(start);
  const { highs, lows } = findEqual(local);
  const eqHighs = groupEqual(highs, tolerancePct);
  const eqLows = groupEqual(lows, tolerancePct);

  // Bearish sweep: wick above equal highs, then close back below
  for (const grp of eqHighs) {
    const level = grp.reduce((a, p) => a + p.price, 0) / grp.length;
    const maxIdx = Math.max(...grp.map((p) => p.idx));
    for (let j = maxIdx + 1; j < local.length; j++) {
      if (local[j].high > level && local[j].close < level) {
        out.push({
          type: 'bearish',
          level,
          sweepTime: local[j].time,
          sweepPrice: local[j].high,
          reversed: true,
        });
        break;
      }
    }
  }
  // Bullish sweep: wick below equal lows, then close back above
  for (const grp of eqLows) {
    const level = grp.reduce((a, p) => a + p.price, 0) / grp.length;
    const maxIdx = Math.max(...grp.map((p) => p.idx));
    for (let j = maxIdx + 1; j < local.length; j++) {
      if (local[j].low < level && local[j].close > level) {
        out.push({
          type: 'bullish',
          level,
          sweepTime: local[j].time,
          sweepPrice: local[j].low,
          reversed: true,
        });
        break;
      }
    }
  }
  return out;
};

export const latestSweep = (sweeps: Sweep[]): Sweep | null => (sweeps.length ? sweeps[sweeps.length - 1] : null);
