import { ema } from '../utils';

export const emaSeries = (closes: number[], period: number): (number | null)[] => ema(closes, period);

export const emaCrossSignal = (
  closes: number[],
  fast = 50,
  slow = 200
): { trend: 'bullish' | 'bearish' | 'neutral'; diff: number | null } => {
  const f = ema(closes, fast);
  const s = ema(closes, slow);
  const lastF = f[f.length - 1];
  const lastS = s[s.length - 1];
  if (lastF === null || lastS === null) return { trend: 'neutral', diff: null };
  if (lastF > lastS) return { trend: 'bullish', diff: ((lastF - lastS) / lastS) * 100 };
  if (lastF < lastS) return { trend: 'bearish', diff: ((lastF - lastS) / lastS) * 100 };
  return { trend: 'neutral', diff: 0 };
};
