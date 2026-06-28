import { computeDatasetSig, isContextSwitch, type DatasetSig, type ChartContextSig } from '../components/PriceChart';

const assert = (cond: boolean, msg: string) => {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  console.log('OK:', msg);
};

// Test 1: computeDatasetSig with valid data
const times1 = [1700000000, 1700000060, 1700000120, 1700000180];
const sig1 = computeDatasetSig(times1);
assert(sig1 !== null, 'computeDatasetSig should return non-null for valid data');
assert(sig1!.last === 1700000180, `Expected last timestamp to be ${1700000180}, got ${sig1!.last}`);
assert(sig1!.interval === 60, `Expected interval to be 60, got ${sig1!.interval}`);

// Test 2: computeDatasetSig with empty array
const sig2 = computeDatasetSig([]);
assert(sig2 === null, 'computeDatasetSig should return null for empty array');

// Test 3: computeDatasetSig with single element
const sig3 = computeDatasetSig([1700000000]);
assert(sig3 !== null, 'computeDatasetSig should handle single element');
assert(sig3!.last === 1700000000, `Expected last timestamp to be ${1700000000}`);

// Test 4: isContextSwitch on symbol change
const prev1: ChartContextSig = {
  last: 1700000000,
  interval: 3600,
  symbol: 'BTCUSDT',
  intervalLabel: '1h',
};
const next1: ChartContextSig = {
  last: 1700000000,
  interval: 3600,
  symbol: 'ETHUSDT',
  intervalLabel: '1h',
};
assert(isContextSwitch(prev1, next1) === true, 'Should detect symbol change');

// Test 5: isContextSwitch on interval change
const prev2: ChartContextSig = {
  last: 1700000000,
  interval: 3600,
  symbol: 'BTCUSDT',
  intervalLabel: '1h',
};
const next2: ChartContextSig = {
  last: 1700000000,
  interval: 14400,
  symbol: 'BTCUSDT',
  intervalLabel: '4h',
};
assert(isContextSwitch(prev2, next2) === true, 'Should detect interval change');

// Test 6: isContextSwitch on intervalLabel change (same interval value)
const prev3: ChartContextSig = {
  last: 1700000000,
  interval: 3600,
  symbol: 'BTCUSDT',
  intervalLabel: '1h',
};
const next3: ChartContextSig = {
  last: 1700000000,
  interval: 3600,
  symbol: 'BTCUSDT',
  intervalLabel: '60m',
};
assert(isContextSwitch(prev3, next3) === true, 'Should detect intervalLabel change');

// Test 7: isContextSwitch on live refresh (small gap, same context)
const prev4: ChartContextSig = {
  last: 1700000000,
  interval: 3600,
  symbol: 'BTCUSDT',
  intervalLabel: '1h',
};
const next4: ChartContextSig = {
  last: 1700000030, // 30 seconds later
  interval: 3600,
  symbol: 'BTCUSDT',
  intervalLabel: '1h',
};
assert(isContextSwitch(prev4, next4) === false, 'Should NOT detect context switch on live refresh');

// Test 8: isContextSwitch on large gap (context switch)
const prev5: ChartContextSig = {
  last: 1700000000,
  interval: 3600,
  symbol: 'BTCUSDT',
  intervalLabel: '1h',
};
const next5: ChartContextSig = {
  last: 1700100000, // ~27.8 hours later (gap > 20 * interval)
  interval: 3600,
  symbol: 'BTCUSDT',
  intervalLabel: '1h',
};
assert(isContextSwitch(prev5, next5) === true, 'Should detect context switch on large gap');

// Test 9: isContextSwitch with null prev (initial load)
const next6: ChartContextSig = {
  last: 1700000000,
  interval: 3600,
  symbol: 'BTCUSDT',
  intervalLabel: '1h',
};
assert(isContextSwitch(null, next6) === true, 'Should detect context switch on initial load');

// Test 10: isContextSwitch on backward timestamp (context switch)
const prev7: ChartContextSig = {
  last: 1700000000,
  interval: 3600,
  symbol: 'BTCUSDT',
  intervalLabel: '1h',
};
const next7: ChartContextSig = {
  last: 1699999900, // 100 seconds before (backward)
  interval: 3600,
  symbol: 'BTCUSDT',
  intervalLabel: '1h',
};
assert(isContextSwitch(prev7, next7) === true, 'Should detect context switch on backward timestamp');

// Test 11: computeDatasetSig with irregular intervals (should use first interval)
const irregularTimes = [1700000000, 1700000060, 1700000180, 1700000300];
const sig4 = computeDatasetSig(irregularTimes);
assert(sig4 !== null, 'computeDatasetSig should handle irregular intervals');
assert(sig4!.last === 1700000300, `Expected last timestamp to be ${1700000300}`);
// Uses the interval between the last two elements when available
assert(sig4!.interval === 120, `Expected interval to be 120, got ${sig4!.interval}`);

console.log('\nAll PriceChart Viewport tests passed.');
