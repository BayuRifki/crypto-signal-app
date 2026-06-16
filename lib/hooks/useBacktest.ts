'use client';
import { useWorkerBacktest, type WorkerBacktestState } from './useWorkerTask';
import type { BacktestOptions, BacktestResult } from '../backtest';
import type { Candle } from '../utils';

export type { WorkerBacktestState } from './useWorkerTask';

/**
 * Backtest hook with Web Worker offload.
 * - When worker is available, runs `runBacktest` off main thread (UI stays responsive)
 * - When worker is unavailable or fails, falls back to synchronous main-thread run
 * - Exposes `isRunning` so UI can show a spinner during heavy computations
 */
export const useBacktest = (candles: Candle[], options: BacktestOptions = {}): BacktestResult | null => {
  const { result } = useWorkerBacktest(candles, options);
  return result;
};

/** Extended hook that also returns worker status + running state */
export const useBacktestWithStatus = (candles: Candle[], options: BacktestOptions = {}): WorkerBacktestState => {
  return useWorkerBacktest(candles, options);
};


