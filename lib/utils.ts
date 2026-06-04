export type Candle = {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export const sma = (values: number[], period: number): (number | null)[] => {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    out.push(i >= period - 1 ? sum / period : null);
  }
  return out;
};

export const ema = (values: number[], period: number): (number | null)[] => {
  const out: (number | null)[] = [];
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      out.push(null);
      continue;
    }
    if (prev === null) {
      const slice = values.slice(0, period);
      prev = slice.reduce((a, b) => a + b, 0) / period;
      out.push(prev);
      continue;
    }
    prev = values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
};

export const stdev = (values: number[], period: number): (number | null)[] => {
  const out: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      out.push(null);
      continue;
    }
    const slice = values.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    out.push(Math.sqrt(variance));
  }
  return out;
};

export const last = <T,>(arr: (T | null)[]): T | null => {
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] !== null) return arr[i] as T;
  return null;
};

export const fmt = (n: number | null | undefined, d = 2): string => {
  if (n === null || n === undefined || Number.isNaN(n)) return '-';
  if (Math.abs(n) >= 1000) return n.toFixed(0);
  if (Math.abs(n) >= 1) return n.toFixed(d);
  return n.toFixed(Math.min(8, d + 2));
};

export const fmtPct = (n: number, d = 2): string => {
  if (Number.isNaN(n)) return '-';
  return `${n >= 0 ? '+' : ''}${n.toFixed(d)}%`;
};

export const pctChange = (a: number, b: number): number => ((a - b) / b) * 100;
