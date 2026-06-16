import type { Candle } from './utils';

export type DemoPreset = 'trending' | 'ranging' | 'volatile' | 'bear-trend';

const PARAMS: Record<DemoPreset, { start: number; trend: number; amplitude: number; noise: number; vol: number }> = {
  'trending':   { start: 100, trend: 0.15, amplitude: 4,  noise: 0.8, vol: 1500 },
  'ranging':    { start: 100, trend: 0,    amplitude: 6,  noise: 1.0, vol: 900  },
  'volatile':   { start: 100, trend: 0,    amplitude: 12, noise: 2.5, vol: 2200 },
  'bear-trend': { start: 100, trend: -0.12, amplitude: 4,  noise: 0.9, vol: 1500 },
};

/**
 * Deterministic seeded PRNG (mulberry32) so the same preset + length produce
 * the same candles. The signal engine needs a stable input to compute stable
 * scores; random data would make every refresh change the signal.
 */
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

/**
 * Generates synthetic OHLCV candles for offline / geo-blocked demo mode.
 * Output is deterministic per (preset, length, symbolSeed) so the chart and
 * signal engine see stable data on every refresh.
 */
export const generateDemoCandles = (preset: DemoPreset, length: number, symbolSeed: string): Candle[] => {
  const p = PARAMS[preset];
  const rng = mulberry32(hash(`${preset}|${symbolSeed}`));
  const out: Candle[] = [];
  let price = p.start;
  // 1 bar = 1 hour for the purposes of demo data
  const startTime = Math.floor(Date.now() / 1000) - length * 3600;
  for (let i = 0; i < length; i++) {
    // Cyclical component + trend + noise
    const cycle = Math.sin(i / 14) * p.amplitude + Math.sin(i / 5) * (p.amplitude / 2);
    const noise = (rng() - 0.5) * 2 * p.noise;
    const move = p.trend + cycle * 0.05 + noise * 0.2;
    const open = price;
    const close = price + move;
    const high = Math.max(open, close) + Math.abs(rng() - 0.5) * p.noise * 1.5;
    const low = Math.min(open, close) - Math.abs(rng() - 0.5) * p.noise * 1.5;
    const volume = p.vol * (0.6 + rng() * 0.8);
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

const round = (v: number, d: number) => Math.round(v * Math.pow(10, d)) / Math.pow(10, d);
