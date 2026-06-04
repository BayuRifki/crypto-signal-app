import { macd } from '../lib/indicators/macd';

const assert = (cond: boolean, msg: string) => {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  console.log('OK:', msg);
};

// MACD basic structure
const closes = new Array(100).fill(0).map((_, i) => 100 + Math.sin(i / 5) * 10);
const result = macd(closes, 12, 26, 9);

assert(result.length === closes.length, 'MACD output length matches input');
assert(result[0].macd === null, 'MACD returns null before warmup');
assert(result[result.length - 1].macd !== null, 'MACD returns value after warmup');

// MACD histogram = macd - signal
for (let i = 0; i < result.length; i++) {
  if (result[i].macd !== null && result[i].signal !== null && result[i].hist !== null) {
    const diff = Math.abs(result[i].hist! - (result[i].macd! - result[i].signal!));
    assert(diff < 0.001, `MACD histogram consistency at i=${i}`);
  }
}

// MACD sign follows trend: uptrend should have positive MACD on average
const upCloses = new Array(100).fill(0).map((_, i) => 100 + i * 0.5);
const macdUp = macd(upCloses, 12, 26, 9);
const lastUp = macdUp[macdUp.length - 1];
assert(lastUp.macd !== null && lastUp.macd! > 0, `MACD positive in uptrend (got ${lastUp.macd?.toFixed(2)})`);

// MACD negative in downtrend
const downCloses = new Array(100).fill(0).map((_, i) => 200 - i * 0.5);
const macdDown = macd(downCloses, 12, 26, 9);
const lastDown = macdDown[macdDown.length - 1];
assert(lastDown.macd !== null && lastDown.macd! < 0, `MACD negative in downtrend (got ${lastDown.macd?.toFixed(2)})`);

console.log('\nAll MACD tests passed.');