/**
 * Wraps an indicator computation so that if it throws, the caller gets a
 * fallback value and the indicator name is tracked as degraded. A null/undefined
 * return is NOT treated as degradation — that's the indicator's normal "no
 * signal" behavior (e.g. nearestPOC returning null when no POC is nearby).
 *
 * Used inside computeSignal to ensure one bad indicator never kills the whole
 * signal — the rest of the pipeline completes, the UI surfaces degraded=true,
 * and confidence is penalized.
 */
export const safeIndicator = <T,>(
  name: string,
  fn: () => T,
  fallback: T,
  degraded: string[]
): T => {
  try {
    return fn();
  } catch (e) {
    if (!degraded.includes(name)) {
      degraded.push(name);
      if (typeof console !== 'undefined') {
        console.warn(`[signal] indicator ${name} failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return fallback;
  }
};
