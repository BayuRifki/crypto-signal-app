// Web Worker for heavy signal computation.
// Plain JS (not TS) so Next.js 14's native worker support picks it up via
// `new Worker(new URL('./signal.worker.js', import.meta.url))`.
//
// Protocol: { id, type, payload } → { id, ok, result|error }
// Types: 'signal' | 'backtest' | 'optimize'

import { computeSignal } from '../signal.ts';
import { runBacktest } from '../backtest.ts';
import { optimizeWeights } from '../weightOptimizer.ts';

self.addEventListener('message', async (e) => {
  const { id, type, payload } = e.data;
  try {
    let result = null;
    if (type === 'signal') {
      result = computeSignal(payload.candles, { weights: payload.weights });
    } else if (type === 'backtest') {
      result = runBacktest(payload.candles, payload.options);
    } else if (type === 'optimize') {
      result = optimizeWeights([{ label: 'worker', candles: payload.candles }], payload.config || {});
    } else {
      self.postMessage({ id, ok: false, error: `unknown task type: ${type}` });
      return;
    }
    self.postMessage({ id, ok: true, result });
  } catch (err) {
    self.postMessage({ id, ok: false, error: err && err.message ? err.message : String(err) });
  }
});
