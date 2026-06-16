'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import type { BacktestOptions, BacktestResult } from '../backtest';
import { runBacktest } from '../backtest';
import type { OptimizationResult, OptimizerConfig } from '../weightOptimizer';
import type { Signal, SignalWeights } from '../signal';
import type { Candle } from '../utils';

type WorkerTask =
  | { id: number; type: 'signal'; payload: { candles: Candle[]; weights?: Partial<SignalWeights> } }
  | { id: number; type: 'backtest'; payload: { candles: Candle[]; options: BacktestOptions } }
  | { id: number; type: 'optimize'; payload: { candles: Candle[]; config?: Partial<OptimizerConfig> } };

type WorkerResponse =
  | { id: number; ok: true; type: 'result'; result: unknown }
  | { id: number; ok: false; type: 'error'; error: string };

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void; type: string };

let _sharedWorker: Worker | null = null;
let _idCounter = 0;
const _pending = new Map<number, Pending>();

const ensureWorker = (): Worker | null => {
  if (typeof window === 'undefined') return null;
  if (_sharedWorker) return _sharedWorker;
  try {
    _sharedWorker = new Worker(new URL('../workers/signal.worker.js', import.meta.url), { type: 'module' });
    _sharedWorker.addEventListener('message', (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      const p = _pending.get(msg.id);
      if (!p) return;
      _pending.delete(msg.id);
      if (msg.ok) p.resolve(msg.result);
      else p.reject(new Error(msg.error));
    });
    _sharedWorker.addEventListener('error', (e) => {
      // Reject all pending tasks on worker error
      for (const [, p] of _pending) p.reject(new Error(e.message || 'worker error'));
      _pending.clear();
    });
    return _sharedWorker;
  } catch (e) {
    if (typeof console !== 'undefined') console.warn('[worker] failed to create worker, falling back to main thread:', e);
    return null;
  }
};

const isWorkerSupported = (): boolean => {
  if (typeof window === 'undefined') return false;
  return typeof Worker !== 'undefined';
};

const runOnWorker = <T,>(type: WorkerTask['type'], payload: unknown): Promise<T> => {
  const worker = ensureWorker();
  if (!worker) return Promise.reject(new Error('worker unavailable'));
  const id = ++_idCounter;
  return new Promise<T>((resolve, reject) => {
    _pending.set(id, { resolve: resolve as (v: unknown) => void, reject, type });
    worker.postMessage({ id, type, payload } as WorkerTask);
  });
};

export type WorkerBacktestState = {
  result: BacktestResult | null;
  isRunning: boolean;
  error: string | null;
  workerAvailable: boolean;
};

export const useWorkerBacktest = (candles: Candle[], options: BacktestOptions = {}): WorkerBacktestState => {
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workerAvailable] = useState<boolean>(isWorkerSupported());
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    setError(null);

    if (candles.length < 250) {
      setResult(null);
      setIsRunning(false);
      return;
    }

    // Try worker first; fall back to main thread on failure
    setIsRunning(true);
    runOnWorker<BacktestResult>('backtest', { candles, options })
      .then((r) => {
        if (cancelledRef.current) return;
        setResult(r);
        setIsRunning(false);
      })
      .catch((e) => {
        if (cancelledRef.current) return;
        if (typeof console !== 'undefined') console.warn('[useWorkerBacktest] worker failed, running on main thread:', e);
        // Fallback: run on main thread
        try {
          const r = runBacktest(candles, options);
          if (!cancelledRef.current) {
            setResult(r);
            setError(null);
          }
        } catch (fallbackErr) {
          if (!cancelledRef.current) {
            setError(fallbackErr instanceof Error ? fallbackErr.message : 'backtest failed');
          }
        } finally {
          if (!cancelledRef.current) setIsRunning(false);
        }
      });

    return () => { cancelledRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, JSON.stringify(options)]);

  return { result, isRunning, error, workerAvailable };
};

export type WorkerOptimizeState = {
  result: OptimizationResult | null;
  isRunning: boolean;
  error: string | null;
  progress: { generation: number; total: number } | null;
};

export const useWorkerOptimize = (): WorkerOptimizeState & { run: (candles: Candle[], config?: Partial<OptimizerConfig>) => Promise<OptimizationResult | null> } => {
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ generation: number; total: number } | null>(null);

  const run = useCallback(async (candles: Candle[], config?: Partial<OptimizerConfig>): Promise<OptimizationResult | null> => {
    setIsRunning(true);
    setError(null);
    setProgress({ generation: 0, total: config?.generations ?? 8 });
    try {
      const r = await runOnWorker<OptimizationResult>('optimize', { candles, config });
      setResult(r);
      setProgress({ generation: r.generations, total: r.generations });
      setTimeout(() => setProgress(null), 1500);
      return r;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'optimize failed');
      return null;
    } finally {
      setIsRunning(false);
    }
  }, []);

  return { result, isRunning, error, progress, run };
};

export const isWorkerAvailable = isWorkerSupported;
export const _resetWorker = (): void => {
  if (_sharedWorker) {
    _sharedWorker.terminate();
    _sharedWorker = null;
  }
  for (const [, p] of _pending) p.reject(new Error('worker reset'));
  _pending.clear();
};
