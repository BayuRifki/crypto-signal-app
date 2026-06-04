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
  const macdValues = macdLine.map((v) => v ?? 0);
  const signalRaw = ema(macdValues, signalPeriod);
  const signalLine: (number | null)[] = macdLine.map((_, i) =>
    macdLine[i] !== null && signalRaw[i] !== null ? signalRaw[i] : null
  );
  return macdLine.map((m, i) => {
    const s = signalLine[i];
    if (m === null || s === null) return { macd: null, signal: null, hist: null };
    return { macd: m, signal: s, hist: m - s };
  });
};
