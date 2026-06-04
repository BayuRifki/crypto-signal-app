import { atr } from '../lib/indicators/atr';
import type { Candle } from '../lib/utils';

const assert = (cond: boolean, msg: string) => {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  console.log('OK:', msg);
};

const c = (time: number, open: number, high: number, low: number, close: number): Candle => ({
  time, open, high, low, close, volume: 1000,
});

// ATR basic
const flatCandles: Candle[] = new Array(50).fill(0).map((_, i) => c(i, 100, 101, 99, 100));
const atrFlat = atr(flatCandles, 14);
assert(atrFlat.length === flatCandles.length, 'ATR output length matches input');
assert(atrFlat[13] === null, 'ATR returns null before period');
assert(atrFlat[14] !== null, 'ATR returns value at period');

// ATR of flat series should be ~2 (high-low = 2)
const lastFlat = atrFlat[atrFlat.length - 1];
assert(lastFlat !== null && Math.abs(lastFlat - 2) < 0.5, `ATR of flat series ≈ 2 (got ${lastFlat?.toFixed(2)})`);

// ATR of volatile series should be larger
const volatileCandles: Candle[] = new Array(100).fill(0).map((_, i) => {
  const range = 5 + Math.sin(i / 3) * 3;
  return c(i, 100, 100 + range, 100 - range, 100 + Math.sin(i) * 2);
});
const atrVol = atr(volatileCandles, 14);
const lastVol = atrVol[atrVol.length - 1];
assert(lastVol !== null && lastVol > lastFlat!, `ATR volatile > ATR flat (${lastVol?.toFixed(2)} > ${lastFlat?.toFixed(2)})`);

// ATR always positive
for (let i = 14; i < atrVol.length; i++) {
  if (atrVol[i] !== null) {
    assert(atrVol[i]! > 0, `ATR positive at i=${i}: ${atrVol[i]!.toFixed(4)}`);
  }
}

console.log('\nAll ATR tests passed.');