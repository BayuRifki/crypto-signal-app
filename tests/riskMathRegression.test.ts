import { computeSignal } from '../lib/signal';
import type { Candle } from '../lib/utils';

const assert = (cond: boolean, msg: string) => {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  console.log('OK:', msg);
};

const c = (time: number, open: number, high: number, low: number, close: number, volume = 1200): Candle => ({
  time, open, high, low, close, volume,
});

const buildVolTrend = (dir: 1 | -1, n = 320): Candle[] => {
  const out: Candle[] = [];
  let price = dir === 1 ? 100 : 260;
  for (let i = 0; i < n; i++) {
    const drift = dir * (0.55 + (i % 7) * 0.02);
    const swing = Math.sin(i / 2.3) * 2.8 + Math.cos(i / 5.1) * 1.7;
    const body = drift + swing * 0.35;
    const open = price;
    const close = price + body;
    const wick = 4.8 + Math.abs(Math.sin(i / 3.1)) * 2.2;
    const high = Math.max(open, close) + wick;
    const low = Math.min(open, close) - wick;
    out.push(c(i, open, high, low, close, 1300 + (i % 9) * 90));
    price = close;
  }
  return out;
};

const findActionableHighAtr = () => {
  const datasets = [buildVolTrend(1), buildVolTrend(-1)];
  for (const candles of datasets) {
    const sig = computeSignal(candles);
    if (!sig || sig.action === 'HOLD') continue;
    const atrPct = (sig.risk.atr / sig.price) * 100;
    if (atrPct > 1.5) return { candles, sig, atrPct };
  }
  return null;
};

const found = findActionableHighAtr();
assert(found !== null, 'found actionable high-ATR signal fixture');

if (found) {
  const { sig, atrPct } = found;
  const slDistPct = Math.abs(sig.price - sig.risk.stopLoss) / sig.price * 100;
  const baseMinSLPct = sig.regime === 'ranging' ? 1.0 : sig.regime === 'trending' ? 0.8 : 0.5;
  const expectedFloorPct = Math.max(baseMinSLPct, atrPct * 0.35);

  assert(atrPct > 1.5, `fixture ATR% > 1.5 (got ${atrPct.toFixed(2)}%)`);
  assert(slDistPct >= expectedFloorPct - 0.02, `SL distance respects vol-adjusted floor (${slDistPct.toFixed(2)}% >= ${expectedFloorPct.toFixed(2)}%)`);
  assert(slDistPct < 25, `SL distance not exploded by unit bug (${slDistPct.toFixed(2)}%)`);
  assert(sig.reasons.some((r) => r.includes('Vol-adaptive SL floor raised')), 'signal explains raised SL floor in reasons');

  if (sig.action === 'BUY') {
    assert(sig.risk.stopLoss < sig.price, 'BUY: SL below price');
  } else {
    assert(sig.risk.stopLoss > sig.price, 'SELL: SL above price');
  }
}

console.log('\nAll risk math regression tests passed.');
