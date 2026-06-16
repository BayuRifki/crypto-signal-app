import type { Candle } from '../lib/utils';

const mulberry32 = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const hash = (s: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

const round = (v: number, d: number) => Math.round(v * Math.pow(10, d)) / Math.pow(10, d);

/**
 * Build a "true sideways" series: slow oscillation with very low noise, no trend.
 * Designed to produce ADX < 20, tight EMA spread, narrow BB, flat EMA slope.
 * Amplitude 1.5 with slow cycle (period ~36 bars), tiny noise, so ADX stays low.
 */
export const generateTrueSideways = (length: number, symbolSeed: string, center = 100): Candle[] => {
  const rng = mulberry32(hash(`sideways|${symbolSeed}`));
  const out: Candle[] = [];
  let price = center;
  const startTime = Math.floor(Date.now() / 1000) - length * 3600;
  for (let i = 0; i < length; i++) {
    const cycle = Math.sin(i / 36) * 1.5;
    const noise = (rng() - 0.5) * 0.1;
    const move = cycle * 0.005 + noise * 0.05;
    const open = price;
    const close = price + move;
    const high = Math.max(open, close) + Math.abs(rng() - 0.5) * 0.1;
    const low = Math.min(open, close) - Math.abs(rng() - 0.5) * 0.1;
    const volume = 1000 * (0.7 + rng() * 0.6);
    out.push({
      time: startTime + i * 3600,
      open: round(open, 4),
      high: round(high, 4),
      low: round(low, 4),
      close: round(close, 4),
      volume: round(volume, 2),
    });
    price = close;
  }
  return out;
};
