import { sma, stdev } from '../utils';
import type { Candle } from '../utils';

export type Bollinger = { middle: number | null; upper: number | null; lower: number | null; width: number | null };

export const bollinger = (candles: Candle[], period = 20, mult = 2): Bollinger[] => {
  const closes = candles.map((c) => c.close);
  const mid = sma(closes, period);
  const sd = stdev(closes, period);
  return candles.map((_, i) => {
    const m = mid[i];
    const s = sd[i];
    if (m === null || s === null) return { middle: null, upper: null, lower: null, width: null };
    return {
      middle: m,
      upper: m + mult * s,
      lower: m - mult * s,
      width: ((mult * 2 * s) / m) * 100,
    };
  });
};
