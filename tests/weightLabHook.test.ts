import { optimizeWeights, type SignalWeights, type WeightKey } from '../lib/weightOptimizer';
import { DEFAULT_WEIGHTS, computeSignal } from '../lib/signal';
import { runBacktest } from '../lib/backtest';
import type { Candle } from '../lib/utils';

const assert = (cond: boolean, msg: string) => {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  console.log('OK:', msg);
};

const c = (time: number, open: number, high: number, low: number, close: number, volume = 1000): Candle => ({
  time, open, high, low, close, volume,
});

// ── localStorage polyfill for hook roundtrip simulation ─────────────────

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(k: string) { return this.store.has(k) ? this.store.get(k)! : null; }
  setItem(k: string, v: string) { this.store.set(k, v); }
  removeItem(k: string) { this.store.delete(k); }
  clear() { this.store.clear(); }
  key(i: number) { return Array.from(this.store.keys())[i] ?? null; }
  get length() { return this.store.size; }
}

const STORAGE_KEY = 'cs:weights';
const RESULT_KEY = 'cs:weights:lastResult';

const simulateLoad = (): { weights: SignalWeights; savedAt: number | null } => {
  const ls = (globalThis as any).localStorage as MemoryStorage;
  const raw = ls.getItem(STORAGE_KEY);
  if (!raw) return { weights: { ...DEFAULT_WEIGHTS }, savedAt: null };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.weights || typeof parsed.weights.bb !== 'number') {
      return { weights: { ...DEFAULT_WEIGHTS }, savedAt: null };
    }
    return { weights: { ...DEFAULT_WEIGHTS, ...parsed.weights }, savedAt: parsed.savedAt ?? null };
  } catch {
    return { weights: { ...DEFAULT_WEIGHTS }, savedAt: null };
  }
};

const simulateSave = (weights: SignalWeights) => {
  const ls = (globalThis as any).localStorage as MemoryStorage;
  const ts = Date.now();
  ls.setItem(STORAGE_KEY, JSON.stringify({ weights, savedAt: ts }));
  return ts;
};

const buildTrend = (n = 300, slope = 0.5): Candle[] => {
  const out: Candle[] = [];
  for (let i = 0; i < n; i++) {
    const price = 100 + i * slope + Math.sin(i / 5) * 1.5;
    out.push(c(i, price - 0.3, price + 1.5, price - 1, price + 0.2, 1000 + Math.sin(i / 7) * 100));
  }
  return out;
};

// ── Tests ────────────────────────────────────────────────────────────────

(globalThis as any).localStorage = new MemoryStorage();

const testStorageRoundtrip = () => {
  const custom: SignalWeights = { ...DEFAULT_WEIGHTS, bb: 20, rsi: 25 };
  const ts = simulateSave(custom);
  const loaded = simulateLoad();
  assert(loaded.savedAt === ts, 'savedAt roundtrip');
  assert(loaded.weights.bb === 20, `bb=20 roundtrip (got ${loaded.weights.bb})`);
  assert(loaded.weights.rsi === 25, `rsi=25 roundtrip (got ${loaded.weights.rsi})`);
  assert(loaded.weights.macd === DEFAULT_WEIGHTS.macd, 'unset keys default to default');
};

const testStorageMissing = () => {
  (globalThis as any).localStorage = new MemoryStorage();
  const loaded = simulateLoad();
  assert(loaded.savedAt === null, 'missing storage returns null savedAt');
  assert(loaded.weights.bb === DEFAULT_WEIGHTS.bb, 'missing storage returns default weights');
};

const testStorageCorrupt = () => {
  const ls = new MemoryStorage();
  ls.setItem(STORAGE_KEY, '{not json');
  (globalThis as any).localStorage = ls;
  const loaded = simulateLoad();
  assert(loaded.weights.bb === DEFAULT_WEIGHTS.bb, 'corrupt storage returns default');
};

const testOptimizerBrowserFriendly = () => {
  const candles = buildTrend(300, 0.4);
  const r = optimizeWeights(
    [{ label: 'trend', candles }],
    { populationSize: 8, generations: 4, seed: 42 }
  );
  assert(r.best !== null, 'optimizer produces best');
  assert(r.history.length === 4, 'history has 4 generations');
  assert(r.best.weights.bb > 0, 'best weights are positive');

  // Verify best weights are usable in computeSignal + runBacktest
  const sig = computeSignal(candles, { weights: r.best.weights });
  assert(sig !== null, 'computeSignal works with optimized weights');
  const bt = runBacktest(candles, { weights: r.best.weights, maxLookahead: 30 });
  assert(bt !== null, 'backtest works with optimized weights');
};

const testWeightKeyCoverage = () => {
  const keys: WeightKey[] = ['bb', 'rsi', 'macd', 'sr', 'fvg', 'ema', 'volume', 'orderBlock', 'marketStructure', 'liquiditySweep', 'trend', 'divergence'];
  assert(keys.length === 12, `12 weight keys (got ${keys.length})`);
  for (const k of keys) {
    assert(typeof DEFAULT_WEIGHTS[k] === 'number', `${k} has default value`);
    assert(DEFAULT_WEIGHTS[k] > 0, `${k} default > 0`);
  }
};

const testIsolatedImprovement = () => {
  // Smoke test: optimized weights should be stored, then loaded, and produce same signal
  const candles = buildTrend(300, 0.5);
  const r = optimizeWeights(
    [{ label: 'a', candles }],
    { populationSize: 6, generations: 3, seed: 99 }
  );
  const ls = new MemoryStorage();
  ls.setItem(STORAGE_KEY, JSON.stringify({ weights: r.best.weights, savedAt: Date.now() }));
  (globalThis as any).localStorage = ls;
  const loaded = simulateLoad();
  const sig1 = computeSignal(candles, { weights: r.best.weights });
  const sig2 = computeSignal(candles, { weights: loaded.weights });
  assert(sig1 !== null && sig2 !== null, 'signals computed');
  assert(sig1!.score === sig2!.score, 'score identical after roundtrip');
};

testStorageRoundtrip();
testStorageMissing();
testStorageCorrupt();
testWeightKeyCoverage();
testOptimizerBrowserFriendly();
testIsolatedImprovement();

console.log('\nAll Weight Lab hook tests passed.');
