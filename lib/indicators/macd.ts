import { ema } from '../utils';

export type MACDPoint = { macd: number | null; signal: number | null; hist: number | null };

export const macd = (
  closes: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9
): MACDPoint[] => {
  const fastEma = ema(closes, fast);
  const slowEma = ema(closes, slow);
  const macdLine: (number | null)[] = closes.map((_, i) =>
    fastEma[i] !== null && slowEma[i] !== null ? (fastEma[i] as number) - (slowEma[i] as number) : null
  );
  // Compute signal-line EMA only from non-null MACD values to avoid distorting the seed.
  // Collect valid (value, index) pairs, compute EMA on values only, then align back.
  const validEntries: { value: number; index: number }[] = [];
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] !== null) validEntries.push({ value: macdLine[i]!, index: i });
  }
  const validValues = validEntries.map((e) => e.value);
  const signalEma = ema(validValues, signalPeriod);
  // Map EMA results back to their original indices
  const signalRaw: (number | null)[] = new Array(macdLine.length).fill(null);
  for (let j = 0; j < validEntries.length; j++) {
    if (signalEma[j] !== null) {
      signalRaw[validEntries[j].index] = signalEma[j];
    }
  }
  return macdLine.map((m, i) => {
    const s = signalRaw[i];
    if (m === null || s === null) return { macd: null, signal: null, hist: null };
    return { macd: m, signal: s, hist: m - s };
  });
};
