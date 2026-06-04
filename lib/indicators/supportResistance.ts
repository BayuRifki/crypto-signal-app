import type { Candle } from '../utils';

export type SRLevel = { price: number; type: 'support' | 'resistance'; strength: number; source: 'pivot' | 'swing' | 'cluster' };

const findSwings = (candles: Candle[], lookback: number, tolerance = 0.003): SRLevel[] => {
  const window = 5;
  const supports: SRLevel[] = [];
  const resistances: SRLevel[] = [];
  const start = Math.max(window, candles.length - lookback);
  for (let i = start; i < candles.length - window; i++) {
    const c = candles[i];
    const left = candles.slice(i - window, i);
    const right = candles.slice(i + 1, i + 1 + window);
    const isLow = left.every((k) => k.low >= c.low) && right.every((k) => k.low >= c.low);
    const isHigh = left.every((k) => k.high <= c.high) && right.every((k) => k.high <= c.high);
    if (isLow) supports.push({ price: c.low, type: 'support', strength: 1, source: 'swing' });
    if (isHigh) resistances.push({ price: c.high, type: 'resistance', strength: 1, source: 'swing' });
  }
  // Cluster nearby levels
  const cluster = (arr: SRLevel[]): SRLevel[] => {
    const sorted = [...arr].sort((a, b) => a.price - b.price);
    const out: SRLevel[] = [];
    for (const lvl of sorted) {
      const last = out[out.length - 1];
      if (last && Math.abs(lvl.price - last.price) / last.price <= tolerance) {
        last.price = (last.price * last.strength + lvl.price) / (last.strength + 1);
        last.strength += 1;
        last.source = 'cluster';
      } else {
        out.push({ ...lvl });
      }
    }
    return out;
  };
  return [...cluster(supports), ...cluster(resistances)].sort((a, b) => b.strength - a.strength);
};

const pivots = (candles: Candle[]): SRLevel[] => {
  if (candles.length < 2) return [];
  const prev = candles[candles.length - 2];
  const p = (prev.high + prev.low + prev.close) / 3;
  const r1 = 2 * p - prev.low;
  const s1 = 2 * p - prev.high;
  const r2 = p + (prev.high - prev.low);
  const s2 = p - (prev.high - prev.low);
  const r3 = p + 2 * (prev.high - prev.low);
  const s3 = p - 2 * (prev.high - prev.low);
  return [
    { price: r3, type: 'resistance', strength: 1, source: 'pivot' },
    { price: r2, type: 'resistance', strength: 2, source: 'pivot' },
    { price: r1, type: 'resistance', strength: 3, source: 'pivot' },
    { price: p, type: 'resistance', strength: 0, source: 'pivot' },
    { price: s1, type: 'support', strength: 3, source: 'pivot' },
    { price: s2, type: 'support', strength: 2, source: 'pivot' },
    { price: s3, type: 'support', strength: 1, source: 'pivot' },
  ];
};

export const supportResistance = (
  candles: Candle[],
  lookback = 100
): { supports: SRLevel[]; resistances: SRLevel[]; pivots: SRLevel[] } => {
  const swings = findSwings(candles, lookback);
  const pv = pivots(candles);
  return {
    supports: swings.filter((s) => s.type === 'support'),
    resistances: swings.filter((s) => s.type === 'resistance'),
    pivots: pv,
  };
};

export const nearestSR = (
  price: number,
  levels: SRLevel[]
): { support: SRLevel | null; resistance: SRLevel | null } => {
  const supports = levels.filter((l) => l.type === 'support' && l.price < price).sort((a, b) => b.price - a.price);
  const resistances = levels.filter((l) => l.type === 'resistance' && l.price > price).sort((a, b) => a.price - b.price);
  return { support: supports[0] ?? null, resistance: resistances[0] ?? null };
};
