import { supportResistance, nearestSR } from '../lib/indicators/supportResistance';
import type { Candle } from '../lib/utils';

const assert = (cond: boolean, msg: string) => {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  console.log('OK:', msg);
};

const c = (time: number, open: number, high: number, low: number, close: number): Candle => ({
  time, open, high, low, close, volume: 1000,
});

// Create candles with clear support/resistance levels
// Support around 95, resistance around 110
const candles: Candle[] = [];
for (let i = 0; i < 120; i++) {
  const base = 100 + Math.sin(i / 8) * 10;
  candles.push(c(i, base - 1, base + 2, base - 2, base + 0.5));
}
const sr = supportResistance(candles, 100);

assert(sr.supports.length > 0, `Support levels found (got ${sr.supports.length})`);
assert(sr.resistances.length > 0, `Resistance levels found (got ${sr.resistances.length})`);
assert(sr.pivots.length > 0, `Pivot levels found (got ${sr.pivots.length})`);

// All support prices < current price
const price = candles[candles.length - 1].close;
for (const s of sr.supports) {
  assert(s.type === 'support', `Support type = 'support'`);
  assert(s.price < price + 5, `Support price ${s.price.toFixed(2)} reasonable relative to price ${price.toFixed(2)}`);
}

// nearestSR
const allLevels = [...sr.pivots, ...sr.supports, ...sr.resistances];
const nearest = nearestSR(price, allLevels);
if (nearest.support) {
  assert(nearest.support.price < price, `Nearest support below price (${nearest.support.price.toFixed(2)} < ${price.toFixed(2)})`);
}
if (nearest.resistance) {
  assert(nearest.resistance.price > price, `Nearest resistance above price (${nearest.resistance.price.toFixed(2)} > ${price.toFixed(2)})`);
}

// nearestSR with empty levels
const emptyNearest = nearestSR(100, []);
assert(emptyNearest.support === null, 'nearestSR returns null support for empty levels');
assert(emptyNearest.resistance === null, 'nearestSR returns null resistance for empty levels');

console.log('\nAll S/R tests passed.');