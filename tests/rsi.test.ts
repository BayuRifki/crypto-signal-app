import { rsi } from '../lib/indicators/rsi';

const assert = (cond: boolean, msg: string) => {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  console.log('OK:', msg);
};

// RSI basic
const flat = new Array(50).fill(100);
const rsiFlat = rsi(flat, 14);
assert(rsiFlat[13] === null, 'RSI returns null before period');
assert(rsiFlat[14] !== null, 'RSI returns value at period index');
// Flat series: no change → avgGain=0, avgLoss=0 → RSI=100 (no losses)
assert(rsiFlat[49] !== null, 'RSI returns value at end');

// RSI uptrend
const up = new Array(100).fill(0).map((_, i) => 100 + i * 2);
const rsiUp = rsi(up, 14);
const lastUp = rsiUp[rsiUp.length - 1];
assert(lastUp !== null && lastUp > 70, `RSI uptrend > 70 (got ${lastUp?.toFixed(1)})`);

// RSI downtrend
const down = new Array(100).fill(0).map((_, i) => 200 - i * 2);
const rsiDown = rsi(down, 14);
const lastDown = rsiDown[rsiDown.length - 1];
assert(lastDown !== null && lastDown < 30, `RSI downtrend < 30 (got ${lastDown?.toFixed(1)})`);

// RSI bounded [0, 100]
const noisy = new Array(200).fill(0).map((_, i) => 100 + Math.sin(i / 3) * 50 + Math.random() * 10);
const rsiNoisy = rsi(noisy, 14);
for (let i = 14; i < rsiNoisy.length; i++) {
  if (rsiNoisy[i] !== null) {
    assert(rsiNoisy[i]! >= 0 && rsiNoisy[i]! <= 100, `RSI bounded at i=${i}: ${rsiNoisy[i]}`);
  }
}

console.log('\nAll RSI tests passed.');