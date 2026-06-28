import { safeIndicator } from '../lib/safeIndicator';

const assert = (cond: boolean, msg: string) => {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  console.log('OK:', msg);
};

/**
 * These tests document the documented contract of safeIndicator:
 * - null/undefined returns are NOT degradation (caller's "no signal" sentinel)
 * - non-finite numbers ARE degradation (corrupt math output)
 * - thrown errors ARE degradation
 * - same indicator name only recorded once in the degraded list
 */

// Test 1: null passes through unchanged and is NOT degradation
const degraded1: string[] = [];
const result1 = safeIndicator('test1', () => null, 'fallback', degraded1);
assert(result1 === null, 'null: passes through (not fallback)');
assert(degraded1.length === 0, 'null: NOT marked as degraded');

// Test 2: undefined passes through unchanged and is NOT degradation
const degraded2: string[] = [];
const result2 = safeIndicator('test2', () => undefined, 'fallback', degraded2);
assert(result2 === undefined, 'undefined: passes through (not fallback)');
assert(degraded2.length === 0, 'undefined: NOT marked as degraded');

// Test 3: NaN is replaced by fallback and IS degradation
const degraded3: string[] = [];
const result3 = safeIndicator('test3', () => NaN, 0, degraded3);
assert(result3 === 0, 'NaN: returns fallback');
assert(degraded3.includes('test3'), 'NaN: marked as degraded');

// Test 4: Infinity is replaced by fallback and IS degradation
const degraded4: string[] = [];
const result4 = safeIndicator('test4', () => Infinity, 0, degraded4);
assert(result4 === 0, 'Infinity: returns fallback');
assert(degraded4.includes('test4'), 'Infinity: marked as degraded');

// Test 5: -Infinity is replaced by fallback and IS degradation
const degraded5: string[] = [];
const result5 = safeIndicator('test5', () => -Infinity, 0, degraded5);
assert(result5 === 0, '-Infinity: returns fallback');
assert(degraded5.includes('test5'), '-Infinity: marked as degraded');

// Test 6: valid number passes through and is NOT degradation
const degraded6: string[] = [];
const result6 = safeIndicator('test6', () => 42, 0, degraded6);
assert(result6 === 42, 'valid number: returns fn result');
assert(!degraded6.includes('test6'), 'valid number: NOT marked as degraded');

// Test 7: valid string passes through
const degraded7: string[] = [];
const result7 = safeIndicator('test7', () => 'hello', 'fallback', degraded7);
assert(result7 === 'hello', 'valid string: returns fn result');
assert(!degraded7.includes('test7'), 'valid string: NOT marked as degraded');

// Test 8: valid object reference passes through
const degraded8: string[] = [];
const obj = { a: 1 };
const result8 = safeIndicator('test8', () => obj, { a: 0 }, degraded8);
assert(result8 === obj, 'valid object: returns fn result');
assert(!degraded8.includes('test8'), 'valid object: NOT marked as degraded');

// Test 9: thrown error returns fallback and IS degradation
const degraded9: string[] = [];
const result9 = safeIndicator('test9', () => {
  throw new Error('Test error');
}, 'fallback', degraded9);
assert(result9 === 'fallback', 'throw: returns fallback');
assert(degraded9.includes('test9'), 'throw: marked as degraded');

// Test 10: same indicator name only recorded once on repeated degradation
const degraded10: string[] = [];
safeIndicator('test10', () => NaN, 0, degraded10);
safeIndicator('test10', () => NaN, 0, degraded10);
assert(degraded10.length === 1, 'repeated degradation: single entry only');

// Test 11: different indicators tracked independently
const degraded11: string[] = [];
safeIndicator('indicatorA', () => NaN, 0, degraded11);
safeIndicator('indicatorB', () => NaN, 0, degraded11);
assert(degraded11.includes('indicatorA'), 'indicatorA marked as degraded');
assert(degraded11.includes('indicatorB'), 'indicatorB marked as degraded');
assert(degraded11.length === 2, 'both indicators marked as degraded');

// Test 12: Number.POSITIVE_INFINITY detected as non-finite
const degraded12: string[] = [];
const result12 = safeIndicator('test12', () => Number.POSITIVE_INFINITY, 0, degraded12);
assert(result12 === 0, 'Number.POSITIVE_INFINITY: returns fallback');
assert(degraded12.includes('test12'), 'Number.POSITIVE_INFINITY: marked as degraded');

// Test 13: array fallback works for valid array result
const degraded13: string[] = [];
const arr: number[] = [1, 2, 3];
const result13 = safeIndicator<number[]>('test13', () => arr, [], degraded13);
assert(Array.isArray(result13) && result13.length === 3, 'valid array: returns fn result');
assert(!degraded13.includes('test13'), 'valid array: NOT marked as degraded');

// Test 14: array fallback used when fn throws
const degraded14: string[] = [];
const result14 = safeIndicator<number[]>('test14', () => { throw new Error('x'); }, [], degraded14);
assert(Array.isArray(result14) && result14.length === 0, 'array fallback: returns empty array on throw');
assert(degraded14.includes('test14'), 'array fallback: marked as degraded on throw');

console.log('\nAll safeIndicator contract tests passed.');
