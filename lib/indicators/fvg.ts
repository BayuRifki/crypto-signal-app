import type { Candle } from '../utils';

export type FVG = {
  type: 'bullish' | 'bearish';
  top: number;
  bottom: number;
  midpoint: number;
  startTime: number;
  endTime: number;
  mitigated: boolean;
  sizePct: number;
};

export const detectFVG = (candles: Candle[], lookback = 100, minGapPct = 0.05): FVG[] => {
  const out: FVG[] = [];
  const start = Math.max(2, candles.length - lookback);
  for (let i = start; i < candles.length; i++) {
    const c1 = candles[i - 2];
    const c3 = candles[i];
    const refLow = c1.high;
    const refHigh = c1.low;
    const gapUp = c3.low - refLow;
    const gapDown = refHigh - c3.high;
    if (gapUp > 0) {
      const top = c3.low;
      const bottom = refLow;
      const sizePct = (gapUp / bottom) * 100;
      if (sizePct >= minGapPct) {
        // mitigation: any future candle closes below bottom
        let mitigated = false;
        for (let j = i + 1; j < candles.length; j++) {
          if (candles[j].close < bottom) {
            mitigated = true;
            break;
          }
        }
        out.push({
          type: 'bullish',
          top,
          bottom,
          midpoint: (top + bottom) / 2,
          startTime: c1.time,
          endTime: c3.time,
          mitigated,
          sizePct,
        });
      }
    } else if (gapDown > 0) {
      const top = refHigh;
      const bottom = c3.high;
      const sizePct = (gapDown / bottom) * 100;
      if (sizePct >= minGapPct) {
        let mitigated = false;
        for (let j = i + 1; j < candles.length; j++) {
          if (candles[j].close > top) {
            mitigated = true;
            break;
          }
        }
        out.push({
          type: 'bearish',
          top,
          bottom,
          midpoint: (top + bottom) / 2,
          startTime: c1.time,
          endTime: c3.time,
          mitigated,
          sizePct,
        });
      }
    }
  }
  return out;
};

export const fvgNear = (price: number, fvgs: FVG[]): { inside: FVG | null; nearestBull: FVG | null; nearestBear: FVG | null } => {
  const active = fvgs.filter((f) => !f.mitigated);
  const inside = active.find((f) => price >= f.bottom && price <= f.top) ?? null;
  const bull = active.filter((f) => f.type === 'bullish' && f.bottom < price).sort((a, b) => b.top - a.top);
  const bear = active.filter((f) => f.type === 'bearish' && f.top > price).sort((a, b) => a.bottom - b.bottom);
  return { inside, nearestBull: bull[0] ?? null, nearestBear: bear[0] ?? null };
};
