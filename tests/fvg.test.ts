import { detectFVG, fvgNear } from '../lib/indicators/fvg';
import type { Candle } from '../lib/utils';

const assert = (cond: boolean, msg: string) => {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  console.log('OK:', msg);
};

const c = (time: number, open: number, high: number, low: number, close: number): Candle => ({
  time, open, high, low, close, volume: 1000,
});

// Create a bullish FVG: candle1 high < candle3 low
// candle1: low=100, high=102
// candle2: big green candle
// candle3: low=105 (gap up from 102)
const bullishFVG: Candle[] = [
  c(1, 100, 102, 99, 101),
  c(2, 101, 108, 100, 107), // big bullish candle
  c(3, 105, 110, 104, 109), // gap up: low=105 > prev high=102 → bullish FVG
];
const fvgs = detectFVG(bullishFVG, 100, 0.01);
assert(fvgs.length >= 1, `Bullish FVG detected (got ${fvgs.length})`);
if (fvgs.length > 0) {
  assert(fvgs[0].type === 'bullish', `FVG type = bullish (got ${fvgs[0].type})`);
  assert(fvgs[0].bottom < fvgs[0].top, 'FVG bottom < top');
}

// Create a bearish FVG: candle1 low > candle3 high
const bearishFVG: Candle[] = [
  c(1, 110, 111, 108, 109),
  c(2, 109, 110, 100, 101), // big bearish candle
  c(3, 98, 99, 95, 96), // gap down: high=99 < prev low=108 → bearish FVG
];
const fvgs2 = detectFVG(bearishFVG, 100, 0.01);
assert(fvgs2.length >= 1, `Bearish FVG detected (got ${fvgs2.length})`);
if (fvgs2.length > 0) {
  assert(fvgs2[0].type === 'bearish', `FVG type = bearish (got ${fvgs2[0].type})`);
}

// fvgNear: price inside FVG
if (fvgs.length > 0) {
  const fvg = fvgs[0];
  const midPrice = (fvg.top + fvg.bottom) / 2;
  const near = fvgNear(midPrice, fvgs);
  assert(near.inside !== null, 'Price inside FVG detected by fvgNear');
}

// fvgNear: price outside FVG
const farPrice = 500;
const nearFar = fvgNear(farPrice, fvgs);
assert(nearFar.inside === null, 'Price far from FVG: inside = null');

console.log('\nAll FVG tests passed.');