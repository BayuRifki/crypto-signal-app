import { emaSeries, emaCrossSignal } from '../lib/indicators/ema';

const assert = (cond: boolean, msg: string) => {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  console.log('OK:', msg);
};

// EMA series basic
const closes = new Array(300).fill(0).map((_, i) => 100 + i * 0.5);
const ema50 = emaSeries(closes, 50);
const ema200 = emaSeries(closes, 200);

assert(ema50.length === closes.length, 'EMA50 length matches');
assert(ema200.length === closes.length, 'EMA200 length matches');
assert(ema50[49] !== null, 'EMA50 returns value after period');
assert(ema200[199] !== null, 'EMA200 returns value after period');

// EMA follows price in uptrend
const lastEma50 = ema50[ema50.length - 1];
const lastEma200 = ema200[ema200.length - 1];
assert(lastEma50 !== null && lastEma50 > 100, `EMA50 follows uptrend (got ${lastEma50?.toFixed(2)})`);
assert(lastEma200 !== null && lastEma200 > 100, `EMA200 follows uptrend (got ${lastEma200?.toFixed(2)})`);

// EMA cross signal
const bullish = emaCrossSignal(closes, 50, 200);
assert(bullish.trend === 'bullish', `EMA cross in uptrend = bullish (got ${bullish.trend})`);
assert(bullish.diff !== null && bullish.diff > 0, `EMA cross diff > 0 in uptrend`);

// Bearish cross
const bearish = new Array(300).fill(0).map((_, i) => 200 - i * 0.5);
const bearishSignal = emaCrossSignal(bearish, 50, 200);
assert(bearishSignal.trend === 'bearish', `EMA cross in downtrend = bearish (got ${bearishSignal.trend})`);

console.log('\nAll EMA tests passed.');