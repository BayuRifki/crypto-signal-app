import type { Candle } from '../utils';

export type Pivot = { index: number; value: number };
export type CVDDivergence = {
  type: 'bullish' | 'bearish';
  kind: 'regular' | 'hidden';
  priceIndex: number;
  cvdIndex: number;
  priceValue: number;
  cvdValue: number;
};

const findPivots = (values: number[], window = 3, maxLookback = 100): { highs: Pivot[]; lows: Pivot[] } => {
  const highs: Pivot[] = [];
  const lows: Pivot[] = [];
  const len = values.length;
  const start = Math.max(window, len - maxLookback);
  for (let i = start; i < len - window; i++) {
    const v = values[i];
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= window; j++) {
      const lv = values[i - j];
      const rv = values[i + j];
      if (lv >= v || rv >= v) isHigh = false;
      if (lv <= v || rv <= v) isLow = false;
    }
    if (isHigh) highs.push({ index: i, value: v });
    else if (isLow) lows.push({ index: i, value: v });
  }
  return { highs, lows };
};

const lastTwo = <T,>(arr: T[]): [T, T] | null => (arr.length >= 2 ? [arr[arr.length - 2], arr[arr.length - 1]] : null);

export const detectCVDDivergence = (prices: number[], cvd: number[], window = 3, maxLookback = 100): CVDDivergence | null => {
  const pHighs = findPivots(prices, window, maxLookback);
  const pLows = findPivots(prices, window, maxLookback);
  const cHighs = findPivots(cvd, window, maxLookback);
  const cLows = findPivots(cvd, window, maxLookback);

  const h = lastTwo(pHighs.highs);
  if (h) {
    const [a, b] = h;
    const ca = cHighs.highs.find((c) => c.index === a.index);
    const cb = cHighs.highs.find((c) => c.index === b.index);
    if (ca && cb) {
      if (a.value < b.value && ca.value > cb.value) {
        return { type: 'bearish', kind: 'regular', priceIndex: b.index, cvdIndex: b.index, priceValue: b.value, cvdValue: cb.value };
      }
      if (a.value > b.value && ca.value < cb.value) {
        return { type: 'bullish', kind: 'hidden', priceIndex: b.index, cvdIndex: b.index, priceValue: b.value, cvdValue: cb.value };
      }
    }
  }

  const l = lastTwo(pLows.lows);
  if (l) {
    const [a, b] = l;
    const ca = cLows.lows.find((c) => c.index === a.index);
    const cb = cLows.lows.find((c) => c.index === b.index);
    if (ca && cb) {
      if (a.value > b.value && ca.value < cb.value) {
        return { type: 'bullish', kind: 'regular', priceIndex: b.index, cvdIndex: b.index, priceValue: b.value, cvdValue: cb.value };
      }
      if (a.value < b.value && ca.value > cb.value) {
        return { type: 'bearish', kind: 'hidden', priceIndex: b.index, cvdIndex: b.index, priceValue: b.value, cvdValue: cb.value };
      }
    }
  }

  return null;
};
