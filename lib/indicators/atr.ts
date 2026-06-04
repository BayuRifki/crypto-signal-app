// Wilder's ATR
export const atr = (candles: { high: number; low: number; close: number }[], period = 14): (number | null)[] => {
  const trs: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      trs.push(candles[i].high - candles[i].low);
      continue;
    }
    const prevClose = candles[i - 1].close;
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - prevClose),
      Math.abs(candles[i].low - prevClose)
    );
    trs.push(tr);
  }
  const out: (number | null)[] = [];
  let prev: number | null = null;
  for (let i = 0; i < trs.length; i++) {
    if (i < period) {
      out.push(null);
      continue;
    }
    if (prev === null) {
      const slice = trs.slice(0, period);
      prev = slice.reduce((a, b) => a + b, 0) / period;
      out.push(prev);
      continue;
    }
    prev = (prev * (period - 1) + trs[i]) / period;
    out.push(prev);
  }
  return out;
};
