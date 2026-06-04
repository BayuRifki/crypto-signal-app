import type { Candle } from '../utils';

export type OrderBlock = {
  type: 'bullish' | 'bearish';
  top: number;
  bottom: number;
  midpoint: number;
  time: number;
  mitigated: boolean;
  impulsePct: number;
};

const avgBody = (c: Candle) => Math.abs(c.close - c.open);
const range = (c: Candle) => c.high - c.low;

export const detectOrderBlocks = (candles: Candle[], lookback = 100, minImpulsePct = 0.5): OrderBlock[] => {
  const out: OrderBlock[] = [];
  const start = Math.max(2, candles.length - lookback);
  for (let i = start; i < candles.length - 1; i++) {
    const c = candles[i];
    // bullish OB: last bearish candle before strong bullish impulse (next candle)
    const next = candles[i + 1];
    if (c.close < c.open && next.close > next.open) {
      const impulsePct = ((next.close - next.open) / next.open) * 100;
      if (impulsePct >= minImpulsePct && avgBody(next) > range(next) * 0.5) {
        const top = c.open;
        const bottom = c.low;
        let mitigated = false;
        for (let j = i + 2; j < candles.length; j++) {
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
          time: c.time,
          mitigated,
          impulsePct,
        });
      }
    }
    // bearish OB: last bullish candle before strong bearish impulse
    if (c.close > c.open && next.close < next.open) {
      const impulsePct = ((next.open - next.close) / next.open) * 100;
      if (impulsePct >= minImpulsePct && avgBody(next) > range(next) * 0.5) {
        const top = c.high;
        const bottom = c.open;
        let mitigated = false;
        for (let j = i + 2; j < candles.length; j++) {
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
          time: c.time,
          mitigated,
          impulsePct,
        });
      }
    }
  }
  return out.filter((o) => !o.mitigated);
};

export const obNear = (price: number, obs: OrderBlock[]): { inside: OrderBlock | null; nearestBull: OrderBlock | null; nearestBear: OrderBlock | null } => {
  const inside = obs.find((o) => price >= o.bottom && price <= o.top) ?? null;
  const bull = obs.filter((o) => o.type === 'bullish' && o.bottom < price).sort((a, b) => b.top - a.top);
  const bear = obs.filter((o) => o.type === 'bearish' && o.top > price).sort((a, b) => a.bottom - b.bottom);
  return { inside, nearestBull: bull[0] ?? null, nearestBear: bear[0] ?? null };
};
