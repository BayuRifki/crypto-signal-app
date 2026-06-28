import { logSignal, getSignalHistory, clearSignalHistory } from '../lib/signalHistory';
import { computeSignal } from '../lib/signal';
import { generateDemoCandles } from '../lib/demoData';

const assert = (cond: boolean, msg: string) => {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  console.log('OK:', msg);
};

// Clear history before tests
clearSignalHistory();

// Generate test candles
const candles = generateDemoCandles('trending', 300, 'BTCUSDT');
const signal = computeSignal(candles);

if (!signal) {
  console.error('FAIL: Could not compute signal for test candles');
  process.exit(1);
}

// Mock localStorage for Node.js environment
if (typeof localStorage === 'undefined') {
  const localStorageMock: Record<string, string> = {};
  global.localStorage = {
    getItem: (key: string) => localStorageMock[key] || null,
    setItem: (key: string, value: string) => { localStorageMock[key] = value; },
    removeItem: (key: string) => { delete localStorageMock[key]; },
    clear: () => { Object.keys(localStorageMock).forEach(key => delete localStorageMock[key]); }
  } as any;
}

// Test 1: Should deduplicate same pair/interval
clearSignalHistory();
logSignal('BTCUSDT', '1h', signal);
logSignal('BTCUSDT', '1h', signal);
const history1 = getSignalHistory();
assert(history1.length === 1, `Expected 1 entry after duplicate logging, got ${history1.length}`);

// Test 2: Should NOT deduplicate different pairs
clearSignalHistory();
logSignal('BTCUSDT', '1h', signal);
logSignal('ETHUSDT', '1h', signal);
const history2 = getSignalHistory();
assert(history2.length === 2, `Expected 2 entries for different pairs, got ${history2.length}`);

// Test 3: Should NOT deduplicate different intervals
clearSignalHistory();
logSignal('BTCUSDT', '1h', signal);
logSignal('BTCUSDT', '4h', signal);
const history3 = getSignalHistory();
assert(history3.length === 2, `Expected 2 entries for different intervals, got ${history3.length}`);

// Test 4: Should deduplicate when switching back with identical signal
clearSignalHistory();
logSignal('BTCUSDT', '1h', signal);
logSignal('ETHUSDT', '1h', signal);
logSignal('BTCUSDT', '1h', signal); // Should be deduplicated
const history4 = getSignalHistory();
assert(history4.length === 2, `Expected 2 entries (BTCUSDT deduplicated, ETHUSDT unique), got ${history4.length}`);

// Test 5: Should NOT deduplicate same pair/interval with significant score changes
clearSignalHistory();
const signal3 = { ...signal, score: signal.score + 10, confidence: signal.confidence + 10 };
logSignal('BTCUSDT', '1h', signal);
logSignal('BTCUSDT', '1h', signal3);
const history5 = getSignalHistory();
assert(history5.length === 2, `Expected 2 entries for significant score changes, got ${history5.length}`);

// Test 6: Should NOT deduplicate different intervals
clearSignalHistory();
logSignal('BTCUSDT', '1h', signal);
logSignal('BTCUSDT', '4h', signal);
const history6 = getSignalHistory();
assert(history6.length === 2, `Expected 2 entries for different intervals, got ${history6.length}`);

// Test 7: Should respect MAX_ENTRIES limit
clearSignalHistory();
for (let i = 0; i < 250; i++) {
  logSignal(`PAIR${i}`, '1h', signal);
}
const history7 = getSignalHistory();
assert(history7.length <= 200, `Expected max 200 entries, got ${history7.length}`);

console.log('\nAll Signal History Deduplication tests passed.');
