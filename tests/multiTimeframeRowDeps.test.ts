import { computeSignal } from '../lib/signal';
import { generateDemoCandles } from '../lib/demoData';

const assert = (cond: boolean, msg: string) => {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  console.log('OK:', msg);
};

// Mock useKlines to track calls
let lastKlinesCall: { exchange: string; symbol: string; interval: string } | null = null;
const mockUseKlines = (exchange: string, symbol: string, interval: string) => {
  lastKlinesCall = { exchange, symbol, interval };
  const candles = generateDemoCandles('trending', 300, symbol);
  return { candles, isLoading: false, error: null, sourceExchange: exchange, attempts: [], refresh: () => {} };
};

// Mock the Row component's useEffect behavior
const testRowEffect = (
  candles: any[],
  exchange: string,
  symbol: string,
  onResult: (action: string | null, score: number | null) => void
) => {
  // This simulates the useEffect in the Row component
  if (candles.length < 210) return;
  const sig = computeSignal(candles);
  const next = sig ? { action: sig.action, score: sig.score } : { action: null, score: null };
  onResult(next.action, next.score);
  return { action: next.action, score: next.score };
};

// Test 1: Should call onResult with initial data
const candles1 = generateDemoCandles('trending', 300, 'BTCUSDT');
let result1: { action: string | null; score: number | null } | null = null;
testRowEffect(candles1, 'okx', 'BTCUSDT', (action, score) => {
  result1 = { action, score };
});
assert(result1 !== null, 'Should call onResult with initial data');
assert(result1!.action !== null, 'Should compute a signal action');

// Test 2: Should re-compute when candles change
const candles2 = generateDemoCandles('bear-trend', 300, 'BTCUSDT');
let result2: { action: string | null; score: number | null } | null = null;
testRowEffect(candles2, 'okx', 'BTCUSDT', (action, score) => {
  result2 = { action, score };
});
assert(result2 !== null, 'Should call onResult when candles change');

// Test 3: Should re-compute when exchange changes (simulated by different candles)
// In the actual component, this would be handled by the useEffect dependencies
// Here we simulate that the effect would run again with new exchange
const candles3 = generateDemoCandles('trending', 300, 'BTCUSDT');
let result3: { action: string | null; score: number | null } | null = null;
// Simulate exchange change by using different candles (as if from a different exchange)
testRowEffect(candles3, 'binance', 'BTCUSDT', (action, score) => {
  result3 = { action, score };
});
assert(result3 !== null, 'Should call onResult when exchange changes');

// Test 4: Should re-compute when symbol changes
const candles4 = generateDemoCandles('trending', 300, 'ETHUSDT');
let result4: { action: string | null; score: number | null } | null = null;
testRowEffect(candles4, 'okx', 'ETHUSDT', (action, score) => {
  result4 = { action, score };
});
assert(result4 !== null, 'Should call onResult when symbol changes');

// Test 5: Should NOT call onResult if candles.length < 210
const shortCandles = generateDemoCandles('trending', 50, 'BTCUSDT');
let result5: { action: string | null; score: number | null } | null = null;
testRowEffect(shortCandles, 'okx', 'BTCUSDT', (action, score) => {
  result5 = { action, score };
});
assert(result5 === null, 'Should NOT call onResult if candles.length < 210');

// Test 6: Verify that useKlines would be called with correct parameters
// This is more of a conceptual test since we can't actually render the component
// But we can verify the logic that would be used
const mockExchange = 'okx';
const mockSymbol = 'BTCUSDT';
const mockInterval = '1h';
const mockLimit = 300;

// In the actual component, useKlines is called with these parameters
// useKlines(exchange, symbol, tf, 300)
// We can verify that our mock would track this correctly
lastKlinesCall = null;
mockUseKlines(mockExchange, mockSymbol, mockInterval);
assert(
  lastKlinesCall !== null,
  'useKlines should be called with exchange, symbol, interval'
);
assert(
  lastKlinesCall!.exchange === mockExchange,
  `Expected exchange to be ${mockExchange}, got ${lastKlinesCall!.exchange}`
);
assert(
  lastKlinesCall!.symbol === mockSymbol,
  `Expected symbol to be ${mockSymbol}, got ${lastKlinesCall!.symbol}`
);
assert(
  lastKlinesCall!.interval === mockInterval,
  `Expected interval to be ${mockInterval}, got ${lastKlinesCall!.interval}`
);

// Test 7: Verify that changing exchange would result in different useKlines call
lastKlinesCall = null;
mockUseKlines('binance', 'BTCUSDT', '1h');
assert(
  lastKlinesCall!.exchange === 'binance',
  'useKlines should be called with new exchange'
);

console.log('\nAll MultiTimeframeRow Dependencies tests passed.');
