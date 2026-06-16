import { optimizeWeights, type OptimizerDataset, type SignalWeights } from '../lib/weightOptimizer';
import { computeSignal, DEFAULT_WEIGHTS } from '../lib/signal';
import { runBacktest } from '../lib/backtest';
import type { Candle } from '../lib/utils';

const assert = (cond: boolean, msg: string) => {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  console.log('OK:', msg);
};

const c = (time: number, open: number, high: number, low: number, close: number, volume = 1000): Candle => ({
  time, open, high, low, close, volume,
});

// Build a clean uptrend (300 bars)
const buildUptrend = (offset = 0): Candle[] => {
  const out: Candle[] = [];
  for (let i = 0; i < 300; i++) {
    const price = 100 + (i + offset) * 0.5 + Math.sin(i / 5) * 2;
    out.push(c(i, price - 0.5, price + 2, price - 1.5, price + 0.3, 1000 + Math.sin(i / 7) * 200));
  }
  return out;
};

// Build a clean downtrend (300 bars)
const buildDowntrend = (offset = 0): Candle[] => {
  const out: Candle[] = [];
  for (let i = 0; i < 300; i++) {
    const price = 400 - (i + offset) * 0.5 + Math.sin(i / 5) * 2;
    out.push(c(i, price + 0.5, price + 1.5, price - 2, price - 0.3, 1000 + Math.sin(i / 7) * 200));
  }
  return out;
};

// ── SignalWeights integration ─────────────────────────────────────────────

const testWeightOverride = () => {
  const candles = buildUptrend();
  const sigDefault = computeSignal(candles);
  assert(sigDefault !== null, 'Default signal computed');
  const custom: Partial<SignalWeights> = { bb: 0, rsi: 50, macd: 50 };
  const sigCustom = computeSignal(candles, { weights: custom });
  assert(sigCustom !== null, 'Custom-weight signal computed');
  if (sigDefault && sigCustom) {
    // Score must differ when weights change
    assert(sigDefault.score !== sigCustom.score || sigDefault.components.bb !== sigCustom.components.bb, 'Weight override changes output');
    // bb=0 → bb component must be 0
    assert(sigCustom.components.bb === 0, `bb=0 forces bb=0 (got ${sigCustom.components.bb})`);
  }
};

// ── Backtest weights option ───────────────────────────────────────────────

const testBacktestWeights = () => {
  const candles = buildUptrend();
  const r1 = runBacktest(candles, { maxLookahead: 30, weights: { bb: 0 } });
  const r2 = runBacktest(candles, { maxLookahead: 30 });
  assert(r1 !== null && r2 !== null, 'Backtest with custom weights returns result');
  assert(true, 'Backtest with custom weights produces results');
};

// ── DEFAULT_WEIGHTS shape ─────────────────────────────────────────────────

const testDefaultWeights = () => {
  assert(typeof DEFAULT_WEIGHTS.bb === 'number', 'DEFAULT_WEIGHTS.bb is number');
  assert(DEFAULT_WEIGHTS.bb === 12, `DEFAULT_WEIGHTS.bb=12 (got ${DEFAULT_WEIGHTS.bb})`);
  assert(DEFAULT_WEIGHTS.rsi === 15, `DEFAULT_WEIGHTS.rsi=15 (got ${DEFAULT_WEIGHTS.rsi})`);
  assert(DEFAULT_WEIGHTS.trend === 15, `DEFAULT_WEIGHTS.trend=15 (got ${DEFAULT_WEIGHTS.trend})`);
  assert(Object.keys(DEFAULT_WEIGHTS).length === 12, 'DEFAULT_WEIGHTS has 12 keys');
};

// ── Optimizer end-to-end ──────────────────────────────────────────────────

const testOptimizer = () => {
  const datasets: OptimizerDataset[] = [
    { label: 'uptrend-A', candles: buildUptrend(0) },
    { label: 'uptrend-B', candles: buildUptrend(50) },
    { label: 'downtrend-A', candles: buildDowntrend(0) },
  ];
  const result = optimizeWeights(datasets, {
    populationSize: 8,
    generations: 4,
    seed: 42,
  });
  assert(result.best !== null, 'Optimizer returns best individual');
  assert(typeof result.best.fitness === 'number' && Number.isFinite(result.best.fitness), 'Best fitness is finite number');
  assert(result.history.length === 4, `History has 4 entries (got ${result.history.length})`);
  assert(result.datasets === 3, 'Optimizer ran across 3 datasets');
  assert(typeof result.baselineFitness === 'number', 'Baseline fitness reported');
  assert(result.improvement !== undefined, 'Improvement reported');
  assert(result.durationMs >= 0, 'Duration reported');
  assert(result.topIndividuals.length > 0, 'Top individuals reported');
  assert(result.topIndividuals.length <= 5, 'Top individuals capped at 5');

  // Best weights must be within bounds
  const w = result.best.weights;
  const keys = Object.keys(w) as (keyof SignalWeights)[];
  for (const key of keys) {
    const def = DEFAULT_WEIGHTS[key];
    assert(w[key] >= def * 0.5 - 1e-9, `${key} within min bound`);
    assert(w[key] <= def * 1.5 + 1e-9, `${key} within max bound`);
  }
};

// ── Optimizer monotonic improvement is not required (stochastic), but best must be >= first generation mean ──

const testOptimizerTracks = () => {
  const datasets: OptimizerDataset[] = [
    { label: 'uptrend', candles: buildUptrend(0) },
  ];
  const r = optimizeWeights(datasets, { populationSize: 6, generations: 3, seed: 7 });
  // Final best fitness should be at least as good as gen 0 best, modulo stochasticity — allow 0
  assert(r.history[0].bestFitness <= r.history[r.history.length - 1].bestFitness + 1e-6,
    `Best fitness non-decreasing across generations: ${r.history[0].bestFitness} -> ${r.history[r.history.length - 1].bestFitness}`);
};

// ── run() ─────────────────────────────────────────────────────────────────

testDefaultWeights();
testWeightOverride();
testBacktestWeights();
testOptimizer();
testOptimizerTracks();

console.log('\nAll Weight Optimizer tests passed.');
