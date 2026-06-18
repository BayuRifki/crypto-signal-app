/**
 * Regression tests for PriceChart viewport reset policy (assessment R1).
 *
 * Bug being guarded against: `fitContent()` was only ever called once on initial
 * load. After the user switched pair or timeframe, `setData()` updated the
 * candles but the old viewport (zoom/pan) leaked into the new dataset, making the
 * new chart look truncated or "broken". The fix detects a context switch via a
 * dataset signature (last candle time + bar interval) and resets the viewport
 * only on a real context change, preserving the user's viewport on same-context
 * live refreshes.
 *
 * The context-switch policy is extracted as pure helpers (`computeDatasetSig`,
 * `isContextSwitch`) so it can be tested without a chart instance.
 */

import { computeDatasetSig, isContextSwitch } from '../components/PriceChart';
import type { DatasetSig } from '../components/PriceChart';

const assert = (cond: boolean, msg: string) => {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  console.log('OK:', msg);
};

const HOUR = 3600;
const MINUTE = 60;

const testComputeSigFromCandles = () => {
  // 1h candles starting at t0, 500 bars
  const times = Array.from({ length: 500 }, (_, i) => 1000 + i * HOUR);
  const sig = computeDatasetSig(times);
  assert(sig !== null, 'sig non-null for non-empty candle set');
  assert(sig!.last === 1000 + 499 * HOUR, `sig.last equals last candle time (got ${sig!.last})`);
  assert(sig!.interval === HOUR, `sig.interval equals gap between last two candles (got ${sig!.interval})`);
};

const testComputeSigEmpty = () => {
  assert(computeDatasetSig([]) === null, 'empty candle set returns null sig');
};

const testComputeSigSingleCandle = () => {
  // Single candle: interval unknown -> 0, but last still anchored.
  const sig = computeDatasetSig([5000]);
  assert(sig !== null, 'single candle returns non-null sig');
  assert(sig!.last === 5000, `single candle sig.last set (got ${sig!.last})`);
  assert(sig!.interval === 0, `single candle sig.interval=0 (got ${sig!.interval})`);
};

const testInitialLoadIsContextSwitch = () => {
  const sig = computeDatasetSig([1000, 1000 + HOUR, 1000 + 2 * HOUR]) as DatasetSig;
  // First-ever load (no previous signature) must be treated as a context switch
  // so the viewport is fit to the initial dataset.
  assert(isContextSwitch(null, sig) === true, 'initial load (prev=null) is a context switch');
};

const testSameContextLiveRefresh = () => {
  // Live refresh: window slides forward by one bar (newest appended, oldest
  // possibly dropped). Last timestamp advances by ~1 bar, interval unchanged.
  const prevTimes = Array.from({ length: 500 }, (_, i) => 1000 + i * HOUR);
  const nextTimes = Array.from({ length: 500 }, (_, i) => 1000 + HOUR + i * HOUR);
  const prev = computeDatasetSig(prevTimes) as DatasetSig;
  const next = computeDatasetSig(nextTimes) as DatasetSig;
  assert(isContextSwitch(prev, next) === false, 'live refresh (same interval, last moves forward by ~1 bar) is NOT a context switch');
};

const testSameContextMultipleBarRefresh = () => {
  // Sometimes the window slides more than 1 bar (e.g. delayed refresh). Up to 20
  // bars should still be treated as a live refresh.
  const prev = computeDatasetSig([1000, 1000 + HOUR, 1000 + 2 * HOUR]) as DatasetSig;
  const next = computeDatasetSig([1000 + 10 * HOUR, 1000 + 11 * HOUR, 1000 + 12 * HOUR]) as DatasetSig;
  assert(isContextSwitch(prev, next) === false, 'live refresh with 10-bar gap is NOT a context switch');
};

const testTimeframeChangeIsContextSwitch = () => {
  // Same general time range, but interval changed (e.g. 1h -> 15m).
  const prev = { last: 1000, interval: HOUR } as DatasetSig;
  const next = { last: 1000, interval: 15 * MINUTE } as DatasetSig;
  assert(isContextSwitch(prev, next) === true, 'timeframe change (interval differs) is a context switch');
};

const testPairChangeBackwardJump = () => {
  // Different pair: last candle timestamp goes backwards (e.g. less recent data).
  const prev = { last: 10000, interval: HOUR } as DatasetSig;
  const next = { last: 2000, interval: HOUR } as DatasetSig;
  assert(isContextSwitch(prev, next) === true, 'pair change (last goes backwards) is a context switch');
};

const testPairChangeHugeForwardJump = () => {
  // Different pair: last candle timestamp jumps far ahead (>20 bars).
  const prev = { last: 1000, interval: HOUR } as DatasetSig;
  const next = { last: 1000 + 100 * HOUR, interval: HOUR } as DatasetSig;
  assert(isContextSwitch(prev, next) === true, 'pair change (last jumps far forward) is a context switch');
};

const testPairChangeSameIntervalSameLast = () => {
  // Edge case: different pair but last timestamp happens to be very close.
  // A small forward gap with same interval is treated as live refresh.
  const prev = { last: 1000, interval: HOUR } as DatasetSig;
  const next = { last: 1000 + HOUR, interval: HOUR } as DatasetSig;
  assert(isContextSwitch(prev, next) === false, 'same interval + 1-bar forward gap is NOT a context switch (live refresh)');
};

const testIdenticalSignatureNotSwitch = () => {
  const sig = { last: 1000, interval: HOUR } as DatasetSig;
  assert(isContextSwitch(sig, sig) === false, 'identical signature is NOT a context switch');
};

const run = () => {
  console.log('=== Chart Viewport Reset Policy Tests ===\n');
  testComputeSigFromCandles();
  testComputeSigEmpty();
  testComputeSigSingleCandle();
  testInitialLoadIsContextSwitch();
  testSameContextLiveRefresh();
  testSameContextMultipleBarRefresh();
  testTimeframeChangeIsContextSwitch();
  testPairChangeBackwardJump();
  testPairChangeHugeForwardJump();
  testPairChangeSameIntervalSameLast();
  testIdenticalSignatureNotSwitch();
  console.log('\nAll Chart Viewport Reset Policy tests passed.');
};

run();
