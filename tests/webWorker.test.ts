/**
 * Tests for Web Worker module shape.
 * The worker itself requires a browser environment, so we just verify the
 * file is well-formed, has the right exports, and the hook has the right shape.
 */

const assert = (cond: boolean, msg: string) => {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  console.log('OK:', msg);
};

import * as fs from 'fs';
import * as path from 'path';
import { useBacktest, useBacktestWithStatus } from '../lib/hooks/useBacktest';
import { isWorkerAvailable, _resetWorker } from '../lib/hooks/useWorkerTask';

// ── Test 1: worker file exists and is non-empty ─────────────────────────

const testWorkerFileExists = () => {
  // The worker is plain JS (not TS) so Next.js 14's native `new URL(import.meta.url)`
  // bundling picks it up. See lib/workers/signal.worker.js.
  const workerPath = path.join(__dirname, '..', 'lib', 'workers', 'signal.worker.js');
  assert(fs.existsSync(workerPath), 'worker-file: signal.worker.js exists');
  const stat = fs.statSync(workerPath);
  assert(stat.size > 200, `worker-file: file is non-trivial (${stat.size} bytes)`);
  const content = fs.readFileSync(workerPath, 'utf-8');
  assert(content.includes('computeSignal'), 'worker-file: imports computeSignal');
  assert(content.includes('runBacktest'), 'worker-file: imports runBacktest');
  assert(content.includes('optimizeWeights'), 'worker-file: imports optimizeWeights');
  assert(content.includes("addEventListener('message'"), 'worker-file: handles message event');
};

// ── Test 2: hook exports are correctly shaped ───────────────────────────

const testHookExports = () => {
  assert(typeof useBacktest === 'function', 'hook-exports: useBacktest is function');
  assert(typeof useBacktestWithStatus === 'function', 'hook-exports: useBacktestWithStatus is function');
  assert(typeof isWorkerAvailable === 'function', 'hook-exports: isWorkerAvailable is function');
  assert(typeof _resetWorker === 'function', 'hook-exports: _resetWorker is function');
  assert(isWorkerAvailable() === false, 'hook-exports: isWorkerAvailable()=false in Node');
};

// ── Test 3: hook re-exports WorkerBacktestState type ────────────────────

const testHookTypes = () => {
  // Type-level only — just verify the module loads
  const mod = require('../lib/hooks/useBacktest');
  assert(typeof mod.useBacktest === 'function', 'hook-types: useBacktest is exported');
  assert(typeof mod.useBacktestWithStatus === 'function', 'hook-types: useBacktestWithStatus is exported');
};

const run = () => {
  testWorkerFileExists();
  testHookExports();
  testHookTypes();
  console.log('\nAll Web Worker tests passed.');
};

run();
