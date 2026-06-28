/**
 * Wraps an indicator computation so that if it throws, or returns
 * NaN/Infinity in a numeric context, the caller gets a fallback value
 * and the indicator name is tracked as degraded.
 *
 * A null/undefined return is NOT treated as degradation - that's the
 * indicator's normal "no signal" behavior (e.g. nearestPOC returning null
 * when no POC is nearby).
 *
 * Used inside computeSignal to ensure one bad indicator never kills the
 * whole signal - the rest of the pipeline completes, the UI surfaces
 * degraded=true, and confidence is penalized.
 */
export const safeIndicator = <T,>(
  name: string,
  fn: () => T,
  fallback: T,
  degraded: string[]
): T => {
  // Snapshot the degraded list into a Set for O(1) lookup. The same
  // indicator name can fail in two of the three branches below
  // (non-finite number OR throw), so we dedupe cheaply. Re-snapshot on
  // every call is fine: the list is small (≤ 20 indicator names) and the
  // alternative (mutable closure-cached Set) would leak across calls.
  const seen = new Set(degraded);
  const track = (reason: string) => {
    if (seen.has(name)) return;
    seen.add(name);
    degraded.push(name);
    if (typeof console !== 'undefined') console.warn(`[signal] indicator ${name} ${reason}`);
  };
  try {
    const result = fn();
    if (typeof result === 'number' && (!Number.isFinite(result) || Number.isNaN(result))) {
      track(`returned non-finite number: ${result}`);
      return fallback;
    }
    return result;
  } catch (e) {
    track(`failed: ${e instanceof Error ? e.message : String(e)}`);
    return fallback;
  }
};
