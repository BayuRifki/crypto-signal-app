import type { Candle } from '../utils';

// CVD approximation using tick rule (no trade-by-trade data from public Binance klines)
export const cvd = (candles: Candle[]): { cvd: number[]; slope: number; delta: number[] } => {
  const delta: number[] = candles.map((c) => {
    const range = c.high - c.low;
    if (range === 0) return 0;
    const buyPortion = (c.close - c.low) / range;
    const buyVol = c.volume * buyPortion;
    const sellVol = c.volume - buyVol;
    return buyVol - sellVol;
  });
  let cum = 0;
  const cvdArr = delta.map((d) => (cum += d));
  const lookback = Math.min(20, cvdArr.length);
  const slice = cvdArr.slice(-lookback);
  const slope =
    slice.length >= 2 ? (slice[slice.length - 1] - slice[0]) / (slice.length - 1) : 0;
  return { cvd: cvdArr, slope, delta };
};

// Relative volume vs avg
export const relativeVolume = (candles: Candle[], period = 20): number | null => {
  if (candles.length < period + 1) return null;
  const slice = candles.slice(-period - 1, -1);
  const avg = slice.reduce((a, c) => a + c.volume, 0) / period;
  const last = candles[candles.length - 1].volume;
  return avg === 0 ? null : last / avg;
};
