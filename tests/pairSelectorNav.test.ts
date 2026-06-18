/**
 * Regression tests for PairSelector keyboard navigation semantics (assessment R2).
 *
 * Bug being guarded against: ArrowUp/ArrowDown on the search input used to call
 * `onChange(filtered[nextIndex].symbol)` directly — i.e. every arrow press
 * committed the highlighted pair as the active pair, triggering a refetch +
 * signal recompute and churning network/runtime. The fix separates *navigation*
 * (arrow keys move the highlight only) from *selection* (Enter or click commits).
 *
 * The decision is extracted as a pure reducer (`reducePairNav`) so the
 * browse-vs-commit semantics can be tested without DOM interaction.
 */

import { reducePairNav } from '../components/PairSelector';

const assert = (cond: boolean, msg: string) => {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  console.log('OK:', msg);
};

const testArrowDownMovesHighlight = () => {
  const action = reducePairNav('ArrowDown', 0, 10);
  assert(action.type === 'move', 'ArrowDown produces a move action (not commit)');
  assert((action as { nextIndex: number }).nextIndex === 1, `ArrowDown from 0 moves to 1 (got ${(action as { nextIndex: number }).nextIndex})`);
};

const testArrowUpMovesHighlight = () => {
  const action = reducePairNav('ArrowUp', 3, 10);
  assert(action.type === 'move', 'ArrowUp produces a move action (not commit)');
  assert((action as { nextIndex: number }).nextIndex === 2, `ArrowUp from 3 moves to 2 (got ${(action as { nextIndex: number }).nextIndex})`);
};

const testArrowDoesNotCommit = () => {
  // The core regression: arrow keys must NEVER return a commit action.
  const down = reducePairNav('ArrowDown', 0, 10);
  const up = reducePairNav('ArrowUp', 5, 10);
  assert(down.type !== 'commit', 'ArrowDown must NOT commit a selection');
  assert(up.type !== 'commit', 'ArrowUp must NOT commit a selection');
};

const testEnterCommitsActiveIndex = () => {
  const action = reducePairNav('Enter', 2, 10);
  assert(action.type === 'commit', 'Enter produces a commit action');
  assert((action as { index: number }).index === 2, `Enter commits the active index 2 (got ${(action as { index: number }).index})`);
};

const testEnterClampsOutOfRangeIndex = () => {
  // Defensive: an out-of-range active index falls back to 0 on Enter.
  const action = reducePairNav('Enter', 99, 3);
  assert(action.type === 'commit', 'Enter with out-of-range index still commits');
  assert((action as { index: number }).index === 0, `Enter clamps out-of-range index to 0 (got ${(action as { index: number }).index})`);
};

const testArrowClampsAtBounds = () => {
  const atTop = reducePairNav('ArrowUp', 0, 10);
  assert((atTop as { nextIndex: number }).nextIndex === 0, `ArrowUp at top stays at 0 (got ${(atTop as { nextIndex: number }).nextIndex})`);
  const atBottom = reducePairNav('ArrowDown', 9, 10);
  assert((atBottom as { nextIndex: number }).nextIndex === 9, `ArrowDown at bottom stays at 9 (got ${(atBottom as { nextIndex: number }).nextIndex})`);
};

const testEmptyListNoOp = () => {
  assert(reducePairNav('ArrowDown', 0, 0).type === 'none', 'ArrowDown on empty list is a no-op');
  assert(reducePairNav('ArrowUp', 0, 0).type === 'none', 'ArrowUp on empty list is a no-op');
  assert(reducePairNav('Enter', 0, 0).type === 'none', 'Enter on empty list is a no-op');
};

const testOtherKeysNoOp = () => {
  assert(reducePairNav('a', 2, 10).type === 'none', 'arbitrary key is a no-op');
  assert(reducePairNav('Escape', 2, 10).type === 'none', 'Escape is a no-op in the reducer');
};

const run = () => {
  console.log('=== PairSelector Keyboard Navigation Tests ===\n');
  testArrowDownMovesHighlight();
  testArrowUpMovesHighlight();
  testArrowDoesNotCommit();
  testEnterCommitsActiveIndex();
  testEnterClampsOutOfRangeIndex();
  testArrowClampsAtBounds();
  testEmptyListNoOp();
  testOtherKeysNoOp();
  console.log('\nAll PairSelector Keyboard Navigation tests passed.');
};

run();
