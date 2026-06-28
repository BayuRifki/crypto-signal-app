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

// Singleton worker + pending registry live at module scope so the same
// worker instance is reused across React components. The down-side is that
// HMR (Vite/Next dev mode) re-evaluates this module and re-creates the
// worker, while the *old* worker may still be processing tasks that will
// arrive on the *new* listener. The `disposeWorker()` function below, wired
// into import.meta.hot.dispose when available, terminates the worker and
// rejects all in-flight tasks so HMR transitions don't leave orphan state.
let _sharedWorker: Worker | null = null;
let _idCounter = 0;
const _pending = new Map<number, Pending>();

const rejectAllPending = (reason: string): void => {
  for (const [, p] of _pending) p.reject(new Error(reason));
  _pending.clear();
};

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
      // Worker-level error (script crash, init failure). Reject all pending
      // tasks; the next ensureWorker() call will re-create the worker.
      rejectAllPending(e.message || 'worker error');
      if (_sharedWorker) {
        _sharedWorker.terminate();
        _sharedWorker = null;
      }
    });
    return _sharedWorker;
  } catch (e) {
    if (typeof console !== 'undefined') console.warn('[worker] failed to create worker, falling back to main thread:', e);
    return null;
  }
};

let _workerAvailable: boolean | null = null;

const checkWorkerAvailable = (): boolean => {
  if (_workerAvailable !== null) return _workerAvailable;
  if (typeof window === 'undefined') { _workerAvailable = false; return false; }
  try {
    const testUrl = URL.createObjectURL(new Blob(['self.postMessage("ok")'], { type: 'application/javascript' }));
    const w = new Worker(testUrl);
    w.terminate();
    URL.revokeObjectURL(testUrl);
    _workerAvailable = true;
  } catch {
    _workerAvailable = false;
  }
  return _workerAvailable;
};

// HMR cleanup: terminate the worker and reject pending tasks when the
// module is replaced during hot reload, so the next page refresh starts
// from a clean slate.
const disposeWorker = (): void => {
  rejectAllPending('worker disposed (HMR)');
  if (_sharedWorker) {
    _sharedWorker.terminate();
    _sharedWorker = null;
  }
};

if (typeof import.meta !== 'undefined' && (import.meta as any).hot) {
  (import.meta as any).hot.dispose(disposeWorker);
}

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
  const [workerAvailable] = useState<boolean>(checkWorkerAvailable());
  // cancelledRef is bumped on every effect run + on unmount. Late worker
  // results (or in-flight main-thread fallbacks) that arrive after a cancel
  // are dropped by checking the counter at the start of .then/.catch.
  const cancelledRef = useRef(0);
  // optionsRef + optionsKeyRef track the current options object across
  // renders. We serialize once per render (not on every effect run) and
  // use the serialized string as the dep, so the effect only re-fires when
  // the options actually change — not on every parent render that produces
  // a fresh options object reference.
  const optionsRef = useRef<BacktestOptions>(options);
  const optionsKeyRef = useRef<string>(JSON.stringify(options));
  const optionsKey = JSON.stringify(options);
  if (optionsKey !== optionsKeyRef.current) {
    optionsKeyRef.current = optionsKey;
    optionsRef.current = options;
  }

  useEffect(() => {
    const version = ++cancelledRef.current;
    setError(null);

    if (candles.length < 250) {
      setResult(null);
      setIsRunning(false);
      return;
    }

    const currentOptions = optionsRef.current;
    setIsRunning(true);
    runOnWorker<BacktestResult>('backtest', { candles, options: currentOptions })
      .then((r) => {
        if (version !== cancelledRef.current) return;
        setResult(r);
        setIsRunning(false);
      })
      .catch((e) => {
        if (version !== cancelledRef.current) return;
        if (typeof console !== 'undefined') console.warn('[useWorkerBacktest] worker failed, running on main thread:', e);
        try {
          const r = runBacktest(candles, currentOptions);
          if (version === cancelledRef.current) {
            setResult(r);
            setError(null);
          }
        } catch (fallbackErr) {
          if (version === cancelledRef.current) {
            setError(fallbackErr instanceof Error ? fallbackErr.message : 'backtest failed');
          }
        } finally {
          if (version === cancelledRef.current) setIsRunning(false);
        }
      });

    return () => { cancelledRef.current++; }; // eslint-disable-line react-hooks/exhaustive-deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, optionsKey]);


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
  const cancelledRef = useRef(0);

  const run = useCallback(async (candles: Candle[], config?: Partial<OptimizerConfig>): Promise<OptimizationResult | null> => {
    const version = ++cancelledRef.current;
    setIsRunning(true);
    setError(null);
    setProgress({ generation: 0, total: config?.generations ?? 8 });
    try {
      const r = await runOnWorker<OptimizationResult>('optimize', { candles, config });
      // Drop stale results if a new optimization was started (or the
      // component unmounted) while this one was in flight.
      if (version !== cancelledRef.current) return null;
      setResult(r);
      setProgress({ generation: r.generations, total: r.generations });
      setTimeout(() => setProgress(null), 1500);
      return r;
    } catch (e) {
      if (version !== cancelledRef.current) return null;
      setError(e instanceof Error ? e.message : 'optimize failed');
      return null;
    } finally {
      if (version === cancelledRef.current) setIsRunning(false);
    }
  }, []);

  return { result, isRunning, error, progress, run };
};

export const isWorkerAvailable = checkWorkerAvailable;
export const _resetWorker = (): void => disposeWorker();

