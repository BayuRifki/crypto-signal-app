/**
 * Tests for graceful degradation in computeSignal.
 * Verifies the safeIndicator wrapper and the degraded fields on Signal.
 *
 * The ESM module system exposes indicator functions as getters, so they can't
 * be monkey-patched at runtime. We test the safeIndicator wrapper directly
 * (it owns the degradation logic) and verify the public Signal fields exist.
 */

const assert = (cond: boolean, msg: string) => {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  console.log('OK:', msg);
};

import { safeIndicator } from '../lib/safeIndicator';
import { computeSignal, type Signal } from '../lib/signal';
import { generateDemoCandles } from '../lib/demoData';

const TRENDING = generateDemoCandles('trending', 300, 'BTCUSDT');

// ── Test 1: safeIndicator returns result when fn succeeds ───────────────

const testSafePasses = () => {
  const degraded: string[] = [];
  const r = safeIndicator('test', () => 42, 0, degraded);
  assert(r === 42, 'safe-passes: returns fn result');
  assert(degraded.length === 0, 'safe-passes: no degradation');
};

// ── Test 2: safeIndicator returns fallback when fn throws ───────────────

const testSafeThrows = () => {
  const degraded: string[] = [];
  const r = safeIndicator('boom', () => { throw new Error('explode'); }, 'FALLBACK', degraded);
  assert(r === 'FALLBACK', 'safe-throws: returns fallback');
  assert(degraded.includes('boom'), 'safe-throws: name tracked');
  assert(degraded.length === 1, 'safe-throws: only one entry');
};

// ── Test 3: safeIndicator does NOT mark degraded on null/undefined ───────

const testSafeNullIsExpected = () => {
  const degraded: string[] = [];
  const r1 = safeIndicator('n1', () => null, 'F', degraded);
  const r2 = safeIndicator('n2', () => undefined, 'F', degraded);
  assert(r1 === null && r2 === undefined, 'safe-null: returns null/undefined (not fallback)');
  assert(degraded.length === 0, 'safe-null: null return is NOT degradation (expected behavior)');
};

// ── Test 4: safeIndicator only logs once per name on repeated throws ─────

const testSafeNoDuplicateLog = () => {
  const degraded: string[] = [];
  safeIndicator('repeat', () => { throw new Error('a'); }, 0, degraded);
  safeIndicator('repeat', () => { throw new Error('b'); }, 0, degraded);
  safeIndicator('repeat', () => { throw new Error('c'); }, 0, degraded);
  assert(degraded.filter((n) => n === 'repeat').length === 1, 'safe-no-dup: only 1 entry per name');
};

// ── Test 5: safeIndicator propagates throw through to caller as fallback ─

const testSafeFallbackTypes = () => {
  const degraded: string[] = [];
  const arr = safeIndicator<number[]>('arr', () => { throw new Error('x'); }, [], degraded);
  assert(Array.isArray(arr) && arr.length === 0, 'safe-types: array fallback');
  const obj = safeIndicator<{ x: number }>('obj', () => { throw new Error('x'); }, { x: 0 }, degraded);
  assert(obj.x === 0, 'safe-types: object fallback');
  const num = safeIndicator<number>('num', () => { throw new Error('x'); }, -1, degraded);
  assert(num === -1, 'safe-types: number fallback');
};

// ── Test 6: computeSignal returns Signal with degraded fields ────────────

const testNormalNotDegraded = () => {
  const sig: Signal | null = computeSignal(TRENDING);
  assert(sig !== null, 'normal: signal returned');
  assert(sig!.degraded === false, `normal: degraded=false (got ${sig!.degraded})`);
  assert(sig!.degradedIndicators.length === 0, `normal: no degraded indicators (got ${sig!.degradedIndicators.length})`);
  assert(Array.isArray(sig!.degradedIndicators), 'normal: degradedIndicators is array');
  assert(sig!.degradedIndicators.every((n) => typeof n === 'string'), 'normal: indicators are strings');
};

// ── Test 7: computeSignal with bad data (candles containing NaN) still completes

const testBadDataDoesntCrash = () => {
  const bad = TRENDING.map((c) => ({ ...c }));
  // Inject a single NaN close in the middle
  bad[150] = { ...bad[150], close: Number.NaN };
  const sig: Signal | null = computeSignal(bad);
  // Signal may or may not be null, but should not throw
  assert(true, 'bad-data: no throw');
  // Even if some indicators return NaN, signal may be null but call completed
  if (sig !== null) {
    assert(typeof sig.action === 'string', 'bad-data: if signal returned, action is string');
  }
};

// ── Test 8: computeSignal with all-NaN closes does not throw ───────────

const testAllNaNDoesntThrow = () => {
  const bad = TRENDING.map((c) => ({ ...c, close: Number.NaN, high: Number.NaN, low: Number.NaN, open: Number.NaN }));
  let sig: Signal | null = null;
  let threw = false;
  try { sig = computeSignal(bad); } catch { threw = true; }
  assert(!threw, 'all-nan: no throw');
  // With all-NaN data, score becomes NaN → action defaults to HOLD.
  // Indicators don't throw on NaN (they propagate it), so degraded stays false
  // but the resulting signal is essentially meaningless. We just verify no crash.
  if (sig !== null) {
    assert(sig.action === 'HOLD' || sig.action === 'BUY' || sig.action === 'SELL', `all-nan: action is one of known values (got ${sig.action})`);
  }
};

const run = () => {
  testSafePasses();
  testSafeThrows();
  testSafeNullIsExpected();
  testSafeNoDuplicateLog();
  testSafeFallbackTypes();
  testNormalNotDegraded();
  testBadDataDoesntCrash();
  testAllNaNDoesntThrow();
  console.log('\nAll Graceful Degradation tests passed.');
};

run();
