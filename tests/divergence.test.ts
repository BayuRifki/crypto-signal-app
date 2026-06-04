import { detectDivergence, findPivots } from '../lib/indicators/divergence';

const assert = (cond: boolean, msg: string) => {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  console.log('OK:', msg);
};

const buildBullishDiv = (): { prices: number[]; rsi: (number | null)[] } => {
  const n = 80;
  const prices: number[] = [];
  const rsi: (number | null)[] = [];
  for (let i = 0; i < n; i++) {
    const base = i < 40 ? 100 - i * 0.4 : 100 + (i - 40) * 0.2;
    const noise = i % 5 === 0 ? -0.1 : 0.1;
    prices.push(base + noise);
    rsi.push(50 - (i < 40 ? i * 0.3 : 0) + (i >= 40 ? (i - 40) * 0.4 : 0) + (i % 7 === 0 ? 0.05 : -0.05));
  }
  prices[15] = 92; prices[18] = 88; prices[21] = 93;
  rsi[15] = 42; rsi[18] = 32; rsi[21] = 44;
  prices[55] = 86; prices[58] = 82; prices[61] = 87;
  rsi[55] = 50; rsi[58] = 42; rsi[61] = 52;
  return { prices, rsi };
};

const data = buildBullishDiv();
const result = detectDivergence(data.prices, data.rsi, 3, 100);
assert(result !== null, 'Bullish regular divergence detected on synthetic data');

const monotonic = {
  prices: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21],
  rsi: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21] as (number | null)[],
};
const noResult = detectDivergence(monotonic.prices, monotonic.rsi, 3, 100);
assert(noResult === null, 'No divergence on monotonic series');

const values: (number | null)[] = [1, 2, 5, 3, 2, 10, 5, 4, 3, 8, 4, 2, 1];
const padded: (number | null)[] = [null, null, null, ...values];
const pivots = findPivots(padded, 2, 100);
assert(pivots.highs.length >= 1, `Pivot high detected (${pivots.highs.length})`);
assert(pivots.lows.length >= 1, `Pivot low detected (${pivots.lows.length})`);

console.log('\nAll divergence tests passed.');
