'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_WEIGHTS,
  type SignalWeights,
} from '../signal';
import {
  optimizeWeights,
  type OptimizerDataset,
  type OptimizationResult,
  type OptimizerConfig,
  type WeightKey,
} from '../weightOptimizer';
import type { Candle } from '../utils';

const STORAGE_KEY = 'cs:weights';
const RESULT_KEY = 'cs:weights:lastResult';

const WEIGHT_LABELS: Record<WeightKey, string> = {
  bb: 'Bollinger',
  rsi: 'RSI',
  macd: 'MACD',
  sr: 'Support/Resistance',
  fvg: 'FVG',
  ema: 'EMA Cross',
  volume: 'Volume',
  orderBlock: 'Order Block',
  marketStructure: 'Market Structure',
  liquiditySweep: 'Liquidity Sweep',
  trend: 'Trend',
  divergence: 'Divergence',
};

const DEFAULT_CONFIG: Partial<OptimizerConfig> = {
  populationSize: 12,
  generations: 6,
  elitism: 0.25,
  mutationRate: 0.3,
  mutationStrength: 0.15,
};

const loadSaved = (): { weights: SignalWeights; savedAt: number | null } => {
  if (typeof window === 'undefined') return { weights: { ...DEFAULT_WEIGHTS }, savedAt: null };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { weights: { ...DEFAULT_WEIGHTS }, savedAt: null };
    const parsed = JSON.parse(raw) as { weights: SignalWeights; savedAt: number };
    if (!parsed?.weights || typeof parsed.weights.bb !== 'number') {
      return { weights: { ...DEFAULT_WEIGHTS }, savedAt: null };
    }
    return { weights: { ...DEFAULT_WEIGHTS, ...parsed.weights }, savedAt: parsed.savedAt ?? null };
  } catch {
    return { weights: { ...DEFAULT_WEIGHTS }, savedAt: null };
  }
};

const loadLastResult = (): OptimizationResult | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(RESULT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OptimizationResult;
  } catch {
    return null;
  }
};

export type UseWeightLabResult = {
  weights: SignalWeights;
  baselineWeights: SignalWeights;
  savedAt: number | null;
  isCustom: boolean;
  isOptimized: boolean;
  isRunning: boolean;
  progress: { generation: number; total: number } | null;
  lastResult: OptimizationResult | null;
  error: string | null;
  setWeight: (key: WeightKey, value: number) => void;
  setAllWeights: (next: SignalWeights) => void;
  resetToDefault: () => void;
  save: () => void;
  clear: () => void;
  optimize: (candles: Candle[]) => void;
  applyResult: (result: OptimizationResult) => void;
  WEIGHT_LABELS: Record<WeightKey, string>;
};

export const useWeightLab = (): UseWeightLabResult => {
  const [weights, setWeights] = useState<SignalWeights>({ ...DEFAULT_WEIGHTS });
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<{ generation: number; total: number } | null>(null);
  const [lastResult, setLastResult] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    const loaded = loadSaved();
    setWeights(loaded.weights);
    setSavedAt(loaded.savedAt);
    setLastResult(loadLastResult());
  }, []);

  const isCustom = (Object.keys(weights) as WeightKey[]).some(
    (k) => Math.abs(weights[k] - DEFAULT_WEIGHTS[k]) > 1e-6
  );
  const isOptimized = lastResult !== null && savedAt !== null;

  const setWeight = useCallback((key: WeightKey, value: number) => {
    setWeights((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setAllWeights = useCallback((next: SignalWeights) => {
    setWeights({ ...DEFAULT_WEIGHTS, ...next });
  }, []);

  const resetToDefault = useCallback(() => {
    setWeights({ ...DEFAULT_WEIGHTS });
  }, []);

  const save = useCallback(() => {
    const ts = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ weights, savedAt: ts }));
      setSavedAt(ts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save weights');
    }
  }, [weights]);

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(RESULT_KEY);
    } catch {}
    setSavedAt(null);
    setLastResult(null);
    resetToDefault();
  }, [resetToDefault]);

  const applyResult = useCallback((result: OptimizationResult) => {
    setAllWeights(result.best.weights);
  }, [setAllWeights]);

  const optimize = useCallback((candles: Candle[]) => {
    if (candles.length < 250) {
      setError(`Need at least 250 candles to optimize (have ${candles.length})`);
      return;
    }
    setError(null);
    setIsRunning(true);
    setProgress({ generation: 0, total: (DEFAULT_CONFIG.generations ?? 6) });
    cancelledRef.current = false;

    setTimeout(() => {
      try {
        const datasets: OptimizerDataset[] = [
          { label: 'current', candles },
        ];
        const result = optimizeWeights(datasets, DEFAULT_CONFIG);
        if (cancelledRef.current) return;
        setLastResult(result);
        setProgress({ generation: result.generations, total: result.generations });
        try {
          localStorage.setItem(RESULT_KEY, JSON.stringify(result));
        } catch {}
        setAllWeights(result.best.weights);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Optimization failed');
      } finally {
        setIsRunning(false);
        setTimeout(() => setProgress(null), 1500);
      }
    }, 30);
  }, [setAllWeights]);

  useEffect(() => {
    return () => { cancelledRef.current = true; };
  }, []);

  return {
    weights,
    baselineWeights: DEFAULT_WEIGHTS,
    savedAt,
    isCustom,
    isOptimized,
    isRunning,
    progress,
    lastResult,
    error,
    setWeight,
    setAllWeights,
    resetToDefault,
    save,
    clear,
    optimize,
    applyResult,
    WEIGHT_LABELS,
  };
};
