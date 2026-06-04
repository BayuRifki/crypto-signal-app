import { bollinger } from '../lib/indicators/bollinger';
import type { Candle } from '../lib/utils';

const assert = (cond: boolean, msg: string) => {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  console.log('OK:', msg);
};

const makeCandle = (c: number, h?: number, l?: number): Candle => ({
  time: 0, open: c, high: h ?? c + 1, low: l ?? c - 1, close: c, volume: 1000,
});

// Bollinger basic
const flatCandles: Candle[] = new Array(50).fill(0).map((_, i) => makeCandle(100));
const bbFlat = bollinger(flatCandles, 20, 2);
assert(bbFlat.length === flatCandles.length, 'BB output length matches input');
assert(bbFlat[19].middle !== null, 'BB returns value after period');
assert(bbFlat[19].upper !== null, 'BB upper band exists');
assert(bbFlat[19].lower !== null, 'BB lower band exists');

// Flat series: upper ≈ lower (stdev ≈ 0)
const lastFlat = bbFlat[bbFlat.length - 1];
assert(lastFlat.upper !== null && lastFlat.lower !== null, 'BB bands not null');
assert(Math.abs(lastFlat.upper! - lastFlat.lower!) < 0.01, `BB flat series: bands converge (width=${(lastFlat.upper! - lastFlat.lower!).toFixed(4)})`);

// Volatile series: upper > lower
const volatileCandles: Candle[] = new Array(100).fill(0).map((_, i) => {
  const c = 100 + Math.sin(i / 3) * 20;
  return makeCandle(c, c + 5, c - 5);
});
const bbVol = bollinger(volatileCandles, 20, 2);
const lastVol = bbVol[bbVol.length - 1];
assert(lastVol.upper! > lastVol.lower!, 'BB volatile: upper > lower');
assert(lastVol.middle! > lastVol.lower! && lastVol.middle! < lastVol.upper!, 'BB middle between bands');

// Width > 0 for volatile
assert(lastVol.width !== null && lastVol.width! > 0, `BB volatile width > 0 (got ${lastVol.width})`);

console.log('\nAll Bollinger tests passed.');