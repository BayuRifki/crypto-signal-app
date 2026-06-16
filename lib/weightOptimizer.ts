import type { Candle } from './utils';
import { runBacktest, type BacktestOptions, type BacktestMetrics, type BacktestResult } from './backtest';
import { DEFAULT_WEIGHTS, type SignalWeights } from './signal';

export type { SignalWeights } from './signal';
export { DEFAULT_WEIGHTS, resolveWeights } from './signal';
export type { BacktestMetrics } from './backtest';

export type WeightKey = keyof SignalWeights;

export type WeightBounds = {
  /** Lower bound (fraction of default). e.g. 0.5 means weight can shrink to 50% of default. */
  minFactor: number;
  /** Upper bound (fraction of default). */
  maxFactor: number;
};

export type OptimizerDataset = {
  label: string;
  candles: Candle[];
  backtestOptions?: BacktestOptions;
};

export type Individual = {
  weights: SignalWeights;
  fitness: number;
  metrics: BacktestMetrics | null;
};

export type OptimizerConfig = {
  /** Population size per generation. */
  populationSize: number;
  /** Number of generations to evolve. */
  generations: number;
  /** Fraction of top individuals kept as-is (elitism). 0-1. */
  elitism: number;
  /** Probability of mutating each gene of an offspring. 0-1. */
  mutationRate: number;
  /** Strength of mutation as fraction of default. */
  mutationStrength: number;
  /** Bounds for each weight (default: 0.5x-1.5x of default). */
  bounds?: WeightBounds;
  /** Optional seed for reproducible randomness. */
  seed?: number;
};

export const DEFAULT_OPTIMIZER_CONFIG: OptimizerConfig = {
  populationSize: 16,
  generations: 8,
  elitism: 0.25,
  mutationRate: 0.3,
  mutationStrength: 0.15,
};

const WEIGHT_KEYS: WeightKey[] = [
  'bb', 'rsi', 'macd', 'sr', 'fvg', 'ema',
  'volume', 'orderBlock', 'marketStructure', 'liquiditySweep',
  'trend', 'divergence',
];

/** Mulberry32 PRNG for reproducible runs. */
const makeRng = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const clampWeight = (value: number, def: number, bounds: WeightBounds) => {
  const lo = def * bounds.minFactor;
  const hi = def * bounds.maxFactor;
  return Math.max(lo, Math.min(hi, value));
};

const randomWeights = (rng: () => number, bounds: WeightBounds): SignalWeights => {
  const out = {} as SignalWeights;
  for (const k of WEIGHT_KEYS) {
    const def = DEFAULT_WEIGHTS[k];
    const lo = def * bounds.minFactor;
    const hi = def * bounds.maxFactor;
    out[k] = lo + rng() * (hi - lo);
  }
  return out;
};

const mutate = (
  parent: SignalWeights,
  rng: () => number,
  rate: number,
  strength: number,
  bounds: WeightBounds
): SignalWeights => {
  const out = { ...parent };
  for (const k of WEIGHT_KEYS) {
    if (rng() < rate) {
      const def = DEFAULT_WEIGHTS[k];
      const jitter = (rng() - 0.5) * 2 * def * strength;
      out[k] = clampWeight(parent[k] + jitter, def, bounds);
    }
  }
  return out;
};

const crossover = (a: SignalWeights, b: SignalWeights, rng: () => number): SignalWeights => {
  const out = {} as SignalWeights;
  for (const k of WEIGHT_KEYS) {
    const alpha = rng();
    out[k] = alpha * a[k] + (1 - alpha) * b[k];
  }
  return out;
};

export type FitnessFn = (metrics: BacktestMetrics) => number;

/**
 * Default fitness: combines Sharpe (annualized), profit factor, and EV/trade.
 * Heavily weights EV/trade; penalizes low trade counts to avoid overfitting trivial strategies.
 */
export const defaultFitness: FitnessFn = (m) => {
  if (m.totalTrades < 5) return -1e6; // not enough trades
  const sharpe = Number.isFinite(m.sharpeRatio) ? m.sharpeRatio : 0;
  const pf = Number.isFinite(m.profitFactor) ? Math.min(m.profitFactor, 5) : 0;
  const ev = m.expectedValuePct;
  const wr = m.winRate / 100;
  // composite: 50% EV (in %), 30% Sharpe, 15% capped PF, 5% win rate
  return 0.5 * ev + 0.3 * sharpe * 2 + 0.15 * (pf - 1) * 2 + 0.05 * (wr - 0.5) * 10;
};

const averageWeights = (population: Individual[]): SignalWeights => {
  const out = {} as SignalWeights;
  for (const k of WEIGHT_KEYS) {
    let sum = 0;
    for (const ind of population) sum += ind.weights[k];
    out[k] = sum / population.length;
  }
  return out;
};

/**
 * Runs the backtest across all datasets, returning a single fitness score.
 * Fitness is the *mean* of per-dataset fitness, penalized by variance to prefer
 * weights that generalize across markets.
 */
const evaluate = (
  datasets: OptimizerDataset[],
  weights: SignalWeights,
  fitnessFn: FitnessFn
): { score: number; aggregateMetrics: BacktestMetrics | null } => {
  const scores: number[] = [];
  const allMetrics: BacktestMetrics[] = [];
  for (const ds of datasets) {
    const opts: BacktestOptions = { ...(ds.backtestOptions ?? {}), weights };
    const r = runBacktest(ds.candles, opts);
    if (!r) return { score: -1e6, aggregateMetrics: null };
    scores.push(fitnessFn(r.metrics));
    allMetrics.push(r.metrics);
  }
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((a, s) => a + (s - mean) ** 2, 0) / scores.length;
  const std = Math.sqrt(variance);
  // Penalize high variance (unstable weights)
  const penalized = mean - 0.2 * std;

  // Aggregate metrics (summed) for reporting
  const sum = allMetrics.reduce(
    (acc, m) => ({
      totalTrades: acc.totalTrades + m.totalTrades,
      wins: acc.wins + m.wins,
      losses: acc.losses + m.losses,
      winRate: acc.winRate + m.winRate,
      sharpeRatio: acc.sharpeRatio + m.sharpeRatio,
      profitFactor: acc.profitFactor + m.profitFactor,
      expectedValuePct: acc.expectedValuePct + m.expectedValuePct,
      totalReturnPct: acc.totalReturnPct + m.totalReturnPct,
      maxDrawdownPct: Math.max(acc.maxDrawdownPct, m.maxDrawdownPct),
    }),
    { totalTrades: 0, wins: 0, losses: 0, winRate: 0, sharpeRatio: 0, profitFactor: 0, expectedValuePct: 0, totalReturnPct: 0, maxDrawdownPct: 0 }
  );
  const n = allMetrics.length;
  const agg: BacktestMetrics = {
    totalTrades: sum.totalTrades,
    wins: sum.wins,
    losses: sum.losses,
    timeouts: 0,
    winRate: sum.winRate / n,
    avgWinPct: 0,
    avgLossPct: 0,
    expectedValuePct: sum.expectedValuePct / n,
    profitFactor: sum.profitFactor / n,
    totalReturnPct: sum.totalReturnPct / n,
    maxDrawdownPct: sum.maxDrawdownPct,
    sharpeRatio: sum.sharpeRatio / n,
    avgBarsHeld: 0,
    buyCount: 0,
    sellCount: 0,
    holdCount: 0,
    byConfidence: [],
    byAction: [],
    equityCurve: [],
  };
  return { score: penalized, aggregateMetrics: agg };
};

export type OptimizationResult = {
  best: Individual;
  history: { generation: number; bestFitness: number; meanFitness: number }[];
  generations: number;
  datasets: number;
  durationMs: number;
  /** Average weights across the final population (smoothed). */
  finalAverageWeights: SignalWeights;
  /** Baseline (default weights) fitness for comparison. */
  baselineFitness: number;
  /** Improvement vs baseline. */
  improvement: number;
  /** Top N individuals in the final population. */
  topIndividuals: Individual[];
};

/**
 * Genetic algorithm to find weights that maximize a fitness function evaluated
 * via the backtest engine across one or more datasets.
 *
 * Each candidate is a `SignalWeights` set; fitness combines Sharpe, profit
 * factor, EV/trade, and win rate (see `defaultFitness`). The optimizer prefers
 * weights that perform *consistently* across multiple datasets by penalizing
 * fitness variance.
 */
export const optimizeWeights = (
  datasets: OptimizerDataset[],
  config: Partial<OptimizerConfig> = {},
  fitnessFn: FitnessFn = defaultFitness
): OptimizationResult => {
  const cfg: OptimizerConfig = { ...DEFAULT_OPTIMIZER_CONFIG, ...config };
  const bounds: WeightBounds = cfg.bounds ?? { minFactor: 0.5, maxFactor: 1.5 };
  const rng = makeRng(cfg.seed ?? Date.now());
  const t0 = performance.now();

  // Initialize: one individual = DEFAULT_WEIGHTS, rest randomized
  const population: Individual[] = [];
  for (let i = 0; i < cfg.populationSize; i++) {
    const w = i === 0 ? { ...DEFAULT_WEIGHTS } : randomWeights(rng, bounds);
    const { score, aggregateMetrics } = evaluate(datasets, w, fitnessFn);
    population.push({ weights: w, fitness: score, metrics: aggregateMetrics });
  }

  // Baseline reference (re-evaluate with defaults to be safe)
  const baseline = evaluate(datasets, DEFAULT_WEIGHTS, fitnessFn);
  const baselineFitness = baseline.score;

  const history: { generation: number; bestFitness: number; meanFitness: number }[] = [];
  const elitismCount = Math.max(1, Math.floor(cfg.populationSize * cfg.elitism));

  for (let gen = 0; gen < cfg.generations; gen++) {
    population.sort((a, b) => b.fitness - a.fitness);
    const best = population[0].fitness;
    const mean = population.reduce((a, b) => a + b.fitness, 0) / population.length;
    history.push({ generation: gen, bestFitness: best, meanFitness: mean });

    if (gen === cfg.generations - 1) break;

    const next: Individual[] = [];
    // Elitism: keep top individuals unchanged
    for (let i = 0; i < elitismCount; i++) next.push(population[i]);

    // Fill the rest via tournament selection + crossover + mutation
    while (next.length < cfg.populationSize) {
      const tSize = 3;
      const selA = () => {
        const candidates = Array.from({ length: tSize }, () => population[Math.floor(rng() * population.length)]);
        return candidates.reduce((a, b) => (a.fitness > b.fitness ? a : b));
      };
      const parentA = selA();
      const parentB = selA();
      const child = crossover(parentA.weights, parentB.weights, rng);
      const mutated = mutate(child, rng, cfg.mutationRate, cfg.mutationStrength, bounds);
      const { score, aggregateMetrics } = evaluate(datasets, mutated, fitnessFn);
      next.push({ weights: mutated, fitness: score, metrics: aggregateMetrics });
    }
    population.length = 0;
    population.push(...next);
  }

  population.sort((a, b) => b.fitness - a.fitness);
  const best = population[0];
  const finalAverageWeights = averageWeights(population.slice(0, Math.max(elitismCount, Math.floor(population.length / 2))));

  return {
    best,
    history,
    generations: cfg.generations,
    datasets: datasets.length,
    durationMs: performance.now() - t0,
    finalAverageWeights,
    baselineFitness,
    improvement: baselineFitness !== 0 ? (best.fitness - baselineFitness) / Math.max(1, Math.abs(baselineFitness)) : 0,
    topIndividuals: population.slice(0, 5),
  };
};
