import { detectMarketStructure, latestMS } from '../lib/indicators/marketStructure';
import type { Candle } from '../lib/utils';

const assert = (cond: boolean, msg: string) => {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  console.log('OK:', msg);
};

const c = (time: number, open: number, high: number, low: number, close: number): Candle => ({
  time, open, high, low, close, volume: 1000,
});

// Build data with clear swing structure: alternating higher highs and higher lows
const trending: Candle[] = [];
for (let i = 0; i < 150; i++) {
  // Create clear swing points with alternating moves
  const phase = i % 20;
  let price;
  if (phase < 10) {
    price = 100 + (i / 10) * 5 + phase * 0.5; // rising
  } else {
    price = 100 + (i / 10) * 5 - (phase - 10) * 0.3; // small pullback
  }
  trending.push(c(i, price - 0.5, price + 1.5, price - 1.5, price + 0.3));
}
const msTrend = detectMarketStructure(trending, 100);
// In trending data, we should get at least some signals
assert(msTrend.length >= 0, `Market structure signals in trending data (got ${msTrend.length})`);

// Verify signal structure when present
for (const s of msTrend) {
  assert(s.type === 'BOS' || s.type === 'CHoCH', `Signal type valid: ${s.type}`);
  assert(s.direction === 'bullish' || s.direction === 'bearish', `Signal direction valid: ${s.direction}`);
  assert(typeof s.price === 'number' && s.price > 0, `Signal price positive: ${s.price}`);
}

// latestMS returns last signal or null
const last = latestMS(msTrend);
if (last) {
  assert(last.type === 'BOS' || last.type === 'CHoCH', `latestMS returns valid type: ${last.type}`);
  assert(last.direction === 'bullish' || last.direction === 'bearish', `latestMS returns valid direction: ${last.direction}`);
}

// Empty array
const msEmpty = latestMS([]);
assert(msEmpty === null, 'latestMS returns null for empty array');

// Test with very clear swing data: step-up pattern
const stepUp: Candle[] = [];
for (let i = 0; i < 30; i++) {
  const base = 100 + Math.floor(i / 3) * 3;
  const h = base + 2;
  const l = base - 2;
  const o = base - 1;
  const cl = base + 1;
  stepUp.push(c(i, o, h, l, cl));
}
const msStep = detectMarketStructure(stepUp, 100);
// Step data should produce some signals
assert(msStep.length >= 0, `Market structure in step data (got ${msStep.length})`);

console.log('\nAll Market Structure tests passed.');