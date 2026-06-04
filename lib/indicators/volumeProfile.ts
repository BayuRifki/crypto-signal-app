import type { Candle } from '../utils';

export type VolumeProfile = {
  poc: number;
  vah: number;
  val: number;
  hvn: number[];
  bins: { price: number; volume: number }[];
};

export const volumeProfile = (candles: Candle[], bins = 50, valueAreaPct = 0.7): VolumeProfile | null => {
  if (candles.length < 10) return null;
  let hi = -Infinity;
  let lo = Infinity;
  for (const c of candles) {
    if (c.high > hi) hi = c.high;
    if (c.low < lo) lo = c.low;
  }
  if (hi === lo) return null;
  const step = (hi - lo) / bins;
  const vol: number[] = new Array(bins).fill(0);
  for (const c of candles) {
    const typical = (c.high + c.low + c.close) / 3;
    const idx = Math.min(bins - 1, Math.max(0, Math.floor((typical - lo) / step)));
    vol[idx] += c.volume;
  }
  const binData = vol.map((v, i) => ({ price: lo + (i + 0.5) * step, volume: v }));
  let maxIdx = 0;
  for (let i = 1; i < vol.length; i++) if (vol[i] > vol[maxIdx]) maxIdx = i;
  const poc = binData[maxIdx].price;
  const total = vol.reduce((a, b) => a + b, 0);
  const target = total * valueAreaPct;
  const sorted = binData.map((b, i) => ({ ...b, idx: i })).sort((a, b) => b.volume - a.volume);
  let acc = 0;
  const included = new Set<number>();
  for (const b of sorted) {
    if (acc >= target) break;
    acc += b.volume;
    included.add(b.idx);
  }
  const vaBins = binData.filter((_, i) => included.has(i));
  const vah = vaBins.length ? Math.max(...vaBins.map((b) => b.price)) : poc;
  const val = vaBins.length ? Math.min(...vaBins.map((b) => b.price)) : poc;
  const threshold = vol[maxIdx] * 0.6;
  const hvn = binData.filter((b) => b.volume >= threshold).map((b) => b.price);
  return { poc, vah, val, hvn, bins: binData };
};

export const nearestPOC = (price: number, profile: VolumeProfile | null): number | null => {
  if (!profile) return null;
  return Math.abs(price - profile.poc) < (profile.vah - profile.val) * 0.25 ? profile.poc : null;
};
