import { cvd, relativeVolume } from '../lib/indicators/volume';
import type { Candle } from '../lib/utils';

const assert = (cond: boolean, msg: string) => {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  console.log('OK:', msg);
};

const c = (time: number, open: number, high: number, low: number, close: number, volume: number): Candle => ({
  time, open, high, low, close, volume,
});

// CVD basic: uptrend should have positive slope
const upCandles: Candle[] = [];
for (let i = 0; i < 50; i++) {
  const price = 100 + i;
  upCandles.push(c(i, price - 1, price + 1, price - 2, price, 1000));
}
const cvdUp = cvd(upCandles);
assert(cvdUp.cvd.length === upCandles.length, 'CVD output length matches input');
assert(cvdUp.slope > 0, `CVD slope positive in uptrend (got ${cvdUp.slope.toFixed(4)})`);
assert(cvdUp.delta.length === upCandles.length, 'CVD delta length matches input');

// CVD: downtrend should have negative slope
const downCandles: Candle[] = [];
for (let i = 0; i < 50; i++) {
  const price = 200 - i;
  downCandles.push(c(i, price + 1, price + 2, price - 1, price, 1000));
}
const cvdDown = cvd(downCandles);
assert(cvdDown.slope < 0, `CVD slope negative in downtrend (got ${cvdDown.slope.toFixed(4)})`);

// Relative volume
const volCandles: Candle[] = [];
for (let i = 0; i < 30; i++) {
  const vol = i < 20 ? 1000 : 2000; // last 10 candles have double volume
  const price = 100 + Math.sin(i / 3) * 5;
  volCandles.push(c(i, price, price + 1, price - 1, price, vol));
}
const rvol = relativeVolume(volCandles, 20);
assert(rvol !== null, 'RVOL returns value');
assert(rvol! > 1, `RVOL > 1 when recent volume is higher (got ${rvol?.toFixed(2)})`);

// RVOL with insufficient data
const shortCandles = upCandles.slice(0, 10);
const rvolShort = relativeVolume(shortCandles, 20);
assert(rvolShort === null, 'RVOL returns null with insufficient data');

console.log('\nAll Volume tests passed.');