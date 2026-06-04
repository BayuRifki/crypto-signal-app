export type DivergenceType = 'bullish' | 'bearish';
export type DivergenceKind = 'regular' | 'hidden';

export type Pivot = { index: number; value: number };

export const findPivots = (values: (number | null)[], window = 3, maxLookback = 100): { highs: Pivot[]; lows: Pivot[] } => {
  const highs: Pivot[] = [];
  const lows: Pivot[] = [];
  const len = values.length;
  const start = Math.max(window, len - maxLookback);
  for (let i = start; i < len - window; i++) {
    if (values[i] === null) continue;
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= window; j++) {
      const lv = values[i - j];
      const rv = values[i + j];
      if (lv === null || rv === null) {
        isHigh = false;
        isLow = false;
        break;
      }
      if (lv >= (values[i] as number) || rv >= (values[i] as number)) isHigh = false;
      if (lv <= (values[i] as number) || rv <= (values[i] as number)) isLow = false;
    }
    if (isHigh) highs.push({ index: i, value: values[i] as number });
    else if (isLow) lows.push({ index: i, value: values[i] as number });
  }
  return { highs, lows };
};

export type Divergence = {
  type: DivergenceType;
  kind: DivergenceKind;
  indicatorIndex: number;
  priceIndex: number;
  indicatorValue: number;
  priceValue: number;
};

const lastTwo = <T,>(arr: T[]): [T, T] | null => (arr.length >= 2 ? [arr[arr.length - 2], arr[arr.length - 1]] : null);

export const detectDivergence = (
  prices: number[],
  indicator: (number | null)[],
  window = 3,
  maxLookback = 100
): Divergence | null => {
  const { highs, lows } = findPivots(indicator, window, maxLookback);
  const priceHighs = findPivots(prices.map((p) => p), window, maxLookback).highs;
  const priceLows = findPivots(prices.map((p) => p), window, maxLookback).lows;

  const h = lastTwo(highs);
  if (h) {
    const [a, b] = h;
    const pa = priceHighs.find((p) => p.index === a.index);
    const pb = priceHighs.find((p) => p.index === b.index);
    if (pa && pb) {
      if (a.value > b.value && pa.value < pb.value) {
        return { type: 'bearish', kind: 'regular', indicatorIndex: b.index, priceIndex: b.index, indicatorValue: b.value, priceValue: pb.value };
      }
      if (a.value < b.value && pa.value > pb.value) {
        return { type: 'bullish', kind: 'hidden', indicatorIndex: b.index, priceIndex: b.index, indicatorValue: b.value, priceValue: pb.value };
      }
    }
  }

  const l = lastTwo(lows);
  if (l) {
    const [a, b] = l;
    const pa = priceLows.find((p) => p.index === a.index);
    const pb = priceLows.find((p) => p.index === b.index);
    if (pa && pb) {
      if (a.value < b.value && pa.value > pb.value) {
        return { type: 'bullish', kind: 'regular', indicatorIndex: b.index, priceIndex: b.index, indicatorValue: b.value, priceValue: pb.value };
      }
      if (a.value > b.value && pa.value < pb.value) {
        return { type: 'bearish', kind: 'hidden', indicatorIndex: b.index, priceIndex: b.index, indicatorValue: b.value, priceValue: pb.value };
      }
    }
  }

  return null;
};
