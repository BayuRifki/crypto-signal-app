import type { Candle } from '../utils';

export type MSSignal = {
  type: 'BOS' | 'CHoCH';
  direction: 'bullish' | 'bearish';
  price: number;
  time: number;
  index: number;
};

const findSwingsStrict = (candles: Candle[], window = 3): { idx: number; price: number; type: 'high' | 'low' }[] => {
  const swings: { idx: number; price: number; type: 'high' | 'low' }[] = [];
  for (let i = window; i < candles.length - window; i++) {
    const c = candles[i];
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= window; j++) {
      if (candles[i - j].high >= c.high || candles[i + j].high >= c.high) isHigh = false;
      if (candles[i - j].low <= c.low || candles[i + j].low <= c.low) isLow = false;
    }
    if (isHigh) swings.push({ idx: i, price: c.high, type: 'high' });
    else if (isLow) swings.push({ idx: i, price: c.low, type: 'low' });
  }
  return swings;
};

export const detectMarketStructure = (candles: Candle[], lookback = 100): MSSignal[] => {
  const out: MSSignal[] = [];
  const start = Math.max(0, candles.length - lookback);
  const local = candles.slice(start);
  const swings = findSwingsStrict(local);
  if (swings.length < 3) return out;

  let lastHigh: { idx: number; price: number } | null = null;
  let lastLow: { idx: number; price: number } | null = null;
  let trend: 'bullish' | 'bearish' | null = null;

  for (let i = 0; i < swings.length; i++) {
    const s = swings[i];
    if (s.type === 'high') {
      if (lastHigh && s.price > lastHigh.price && trend === 'bearish') {
        out.push({ type: 'BOS', direction: 'bullish', price: s.price, time: local[s.idx].time, index: start + s.idx });
        trend = 'bullish';
      } else if (lastHigh && s.price < lastHigh.price && trend === 'bullish') {
        out.push({ type: 'CHoCH', direction: 'bearish', price: s.price, time: local[s.idx].time, index: start + s.idx });
        trend = 'bearish';
      }
      if (!lastHigh || s.price > lastHigh.price) lastHigh = { idx: s.idx, price: s.price };
    } else {
      if (lastLow && s.price < lastLow.price && trend === 'bullish') {
        out.push({ type: 'BOS', direction: 'bearish', price: s.price, time: local[s.idx].time, index: start + s.idx });
        trend = 'bearish';
      } else if (lastLow && s.price > lastLow.price && trend === 'bearish') {
        out.push({ type: 'CHoCH', direction: 'bullish', price: s.price, time: local[s.idx].time, index: start + s.idx });
        trend = 'bullish';
      }
      if (!lastLow || s.price < lastLow.price) lastLow = { idx: s.idx, price: s.price };
    }
    if (trend === null) {
      // Establish initial trend via first two swings
      if (lastHigh && lastLow) {
        trend = lastHigh.price > local[Math.max(lastHigh.idx, lastLow.idx)].close ? 'bullish' : 'bearish';
      }
    }
  }
  return out;
};

export const latestMS = (signals: MSSignal[]): MSSignal | null =>
  signals.length ? signals[signals.length - 1] : null;
