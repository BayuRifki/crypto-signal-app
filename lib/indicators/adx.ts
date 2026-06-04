import type { Candle } from '../utils';

export type ADXPoint = { adx: number | null; pdi: number | null; ndi: number | null };

const wilderSmooth = (vals: number[], period: number, prev: number | null): (number | null)[] => {
  const out: (number | null)[] = [];
  let acc: number | null = prev;
  for (let i = 0; i < vals.length; i++) {
    if (acc === null) {
      acc = vals.slice(0, period).reduce((a, b) => a + b, 0);
      out.push(i === period - 1 ? acc : null);
    } else {
      acc = acc - acc / period + vals[i];
      out.push(acc);
    }
  }
  return out;
};

export const adx = (candles: Candle[], period = 14): ADXPoint[] => {
  const len = candles.length;
  const out: ADXPoint[] = Array.from({ length: len }, () => ({ adx: null, pdi: null, ndi: null }));
  if (len < period * 2 + 1) return out;

  const tr: number[] = new Array(len).fill(0);
  const pDM: number[] = new Array(len).fill(0);
  const nDM: number[] = new Array(len).fill(0);

  for (let i = 1; i < len; i++) {
    const cur = candles[i];
    const prev = candles[i - 1];
    const up = cur.high - prev.high;
    const down = prev.low - cur.low;
    tr[i] = Math.max(cur.high - cur.low, Math.abs(cur.high - prev.close), Math.abs(cur.low - prev.close));
    pDM[i] = up > down && up > 0 ? up : 0;
    nDM[i] = down > up && down > 0 ? down : 0;
  }

  const trS = wilderSmooth(tr, period, null);
  const pDMS = wilderSmooth(pDM, period, null);
  const nDMS = wilderSmooth(nDM, period, null);

  const dx: number[] = new Array(len).fill(0);
  for (let i = period; i < len; i++) {
    const t = trS[i] ?? 0;
    const p = pDMS[i] ?? 0;
    const n = nDMS[i] ?? 0;
    if (t === 0) {
      out[i] = { adx: out[i - 1].adx, pdi: 0, ndi: 0 };
      continue;
    }
    const pdi = (p / t) * 100;
    const ndi = (n / t) * 100;
    const sum = pdi + ndi;
    const dxVal = sum === 0 ? 0 : (Math.abs(pdi - ndi) / sum) * 100;
    dx[i] = dxVal;
    out[i] = { adx: null, pdi, ndi };
  }

  let prevAdx: number | null = null;
  for (let i = period; i < len; i++) {
    if (i < period * 2 - 1) continue;
    if (prevAdx === null) {
      const slice = dx.slice(period, i + 1);
      if (slice.length === 0) continue;
      prevAdx = slice.reduce((a, b) => a + b, 0) / slice.length;
      out[i] = { ...out[i], adx: prevAdx };
    } else {
      prevAdx = (prevAdx * (period - 1) + dx[i]) / period;
      out[i] = { ...out[i], adx: prevAdx };
    }
  }

  return out;
};

export type Regime = 'trending' | 'ranging' | 'transitional';

export const classifyRegime = (adxVal: number | null, pdi: number | null, ndi: number | null): { regime: Regime; bias: 'bullish' | 'bearish' | 'neutral' } => {
  if (adxVal === null) return { regime: 'transitional', bias: 'neutral' };
  if (adxVal >= 25) {
    if (pdi === null || ndi === null) return { regime: 'trending', bias: 'neutral' };
    return { regime: 'trending', bias: pdi > ndi ? 'bullish' : pdi < ndi ? 'bearish' : 'neutral' };
  }
  if (adxVal < 20) return { regime: 'ranging', bias: 'neutral' };
  return { regime: 'transitional', bias: pdi !== null && ndi !== null ? (pdi > ndi ? 'bullish' : pdi < ndi ? 'bearish' : 'neutral') : 'neutral' };
};
