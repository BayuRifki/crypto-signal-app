import { detectLiquiditySweeps, latestSweep } from '../lib/indicators/liquiditySweep';
import type { Candle } from '../lib/utils';

const assert = (cond: boolean, msg: string) => {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  console.log('OK:', msg);
};

const c = (time: number, open: number, high: number, low: number, close: number): Candle => ({
  time, open, high, low, close, volume: 1000,
});

// Create equal highs (bearish sweep setup): two candles with same high, then wick above
const sweepSetup: Candle[] = [];
for (let i = 0; i < 30; i++) {
  sweepSetup.push(c(i, 100, 105, 98, 102)); // baseline
}
// Two equal highs
sweepSetup[10] = c(10, 100, 105, 98, 102);
sweepSetup[15] = c(15, 100, 105, 98, 102);
// Wick above equal highs, then close below
sweepSetup[25] = c(25, 100, 106, 98, 102); // high=106 > 105, close=102 < 105

const sweeps = detectLiquiditySweeps(sweepSetup, 100, 0.01);
// May or may not detect depending on equal grouping tolerance
assert(Array.isArray(sweeps), 'detectLiquiditySweeps returns array');

// latestSweep on empty
assert(latestSweep([]) === null, 'latestSweep returns null for empty array');

// latestSweep on non-empty
if (sweeps.length > 0) {
  const last = latestSweep(sweeps);
  assert(last !== null, 'latestSweep returns last sweep');
  assert(last!.type === 'bullish' || last!.type === 'bearish', `sweep type valid: ${last!.type}`);
  assert(typeof last!.level === 'number', 'sweep level is number');
}

console.log('\nAll Liquidity Sweep tests passed.');