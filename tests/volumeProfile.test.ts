import { volumeProfile, nearestPOC } from '../lib/indicators/volumeProfile';
import type { Candle } from '../lib/utils';

const assert = (cond: boolean, msg: string) => {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  console.log('OK:', msg);
};

const c = (time: number, open: number, high: number, low: number, close: number, volume: number): Candle => ({
  time, open, high, low, close, volume,
});

// Volume profile basic
const candles: Candle[] = [];
for (let i = 0; i < 100; i++) {
  const price = 100 + Math.sin(i / 5) * 5;
  candles.push(c(i, price - 0.5, price + 0.5, price - 1, price, 1000));
}
const vp = volumeProfile(candles, 50, 0.7);

assert(vp !== null, 'Volume profile returns result');
if (vp) {
  assert(typeof vp.poc === 'number', `POC is number (got ${typeof vp.poc})`);
  assert(vp.vah > vp.val, `VAH > VAL (${vp.vah.toFixed(2)} > ${vp.val.toFixed(2)})`);
  assert(vp.poc >= vp.val && vp.poc <= vp.vah, `POC within value area (${vp.val.toFixed(2)} ≤ ${vp.poc.toFixed(2)} ≤ ${vp.vah.toFixed(2)})`);
  assert(vp.bins.length > 0, 'Bins not empty');
  assert(vp.hvn.length >= 1, `HVN has at least 1 node (got ${vp.hvn.length})`);
}

// nearestPOC: price near POC
if (vp) {
  const nearPOC = nearestPOC(vp.poc, vp);
  assert(nearPOC !== null, 'Price at POC is near POC');

  const farPOC = nearestPOC(vp.poc + 1000, vp);
  assert(farPOC === null, 'Price far from POC returns null');
}

// Volume profile with insufficient data (< 10) returns null
const shortCandles = candles.slice(0, 5);
const vpShort = volumeProfile(shortCandles, 50, 0.7);
assert(vpShort === null, 'Volume profile returns null for insufficient data (< 10 candles)');

// Volume profile with empty data
const vpEmpty = volumeProfile([], 50, 0.7);
assert(vpEmpty === null, 'Volume profile returns null for empty data');

console.log('\nAll Volume Profile tests passed.');