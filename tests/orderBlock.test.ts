import { detectOrderBlocks, obNear } from '../lib/indicators/orderBlock';
import type { Candle } from '../lib/utils';

const assert = (cond: boolean, msg: string) => {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  console.log('OK:', msg);
};

const c = (time: number, open: number, high: number, low: number, close: number, vol = 1000): Candle => ({
  time, open, high, low, close, volume: vol,
});

// Bullish OB: bearish candle followed by strong bullish impulse (>0.4% body)
// Use larger price moves to exceed minImpulsePct threshold
const bullishOB: Candle[] = [];
for (let i = 0; i < 10; i++) {
  bullishOB.push(c(i, 100, 101, 99, 100)); // baseline
}
// Bearish candle
bullishOB.push(c(10, 105, 106, 99, 100)); // bearish: close(100) < open(105)
// Strong bullish impulse: close > open with >0.4% move
bullishOB.push(c(11, 100, 110, 99, 108)); // bullish: close(108) > open(100), impulse = (108-100)/100 = 8%
bullishOB.push(c(12, 108, 112, 107, 111));
bullishOB.push(c(13, 111, 113, 110, 112));

const obs = detectOrderBlocks(bullishOB, 100, 0.4);
assert(obs.length >= 1, `Bullish OB detected (got ${obs.length})`);
if (obs.length > 0) {
  assert(obs[0].type === 'bullish', `OB type = bullish (got ${obs[0].type})`);
  assert(obs[0].top > obs[0].bottom, 'OB top > bottom');
}

// Bearish OB: bullish candle followed by strong bearish impulse
const bearishOB: Candle[] = [];
for (let i = 0; i < 10; i++) {
  bearishOB.push(c(i, 100, 101, 99, 100));
}
bearishOB.push(c(10, 100, 106, 99, 105)); // bullish: close(105) > open(100)
bearishOB.push(c(11, 105, 106, 90, 91));   // bearish impulse: close(91) < open(105), impulse = (105-91)/105 ≈ 13%
bearishOB.push(c(12, 91, 92, 88, 89));
bearishOB.push(c(13, 89, 90, 87, 88));

const obs2 = detectOrderBlocks(bearishOB, 100, 0.4);
assert(obs2.length >= 1, `Bearish OB detected (got ${obs2.length})`);
if (obs2.length > 0) {
  assert(obs2[0].type === 'bearish', `OB type = bearish (got ${obs2[0].type})`);
}

// obNear: price inside OB
if (obs.length > 0) {
  const ob = obs[0];
  const midPrice = (ob.top + ob.bottom) / 2;
  const near = obNear(midPrice, obs);
  assert(near.inside !== null, 'Price inside OB detected by obNear');
}

// obNear: price outside all OBs
const farNear = obNear(500, obs);
assert(farNear.inside === null, 'Price far from OBs: inside = null');

console.log('\nAll Order Block tests passed.');