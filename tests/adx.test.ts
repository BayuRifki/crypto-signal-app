import { adx, classifyRegime } from '../lib/indicators/adx';
import type { Candle } from '../lib/utils';

const candle = (h: number, l: number, c: number): Candle => ({ time: 0, open: l, high: h, low: l, close: c, volume: 0 });

const buildTrend = (n: number, dir: 'up' | 'down'): Candle[] => {
  const out: Candle[] = [];
  let p = 100;
  for (let i = 0; i < n; i++) {
    if (dir === 'up') p += 1 + Math.sin(i / 5) * 0.2;
    else p -= 1 + Math.sin(i / 5) * 0.2;
    const h = p + 0.5;
    const l = p - 0.5;
    out.push(candle(h, l, p));
  }
  return out;
};

const buildRange = (n: number): Candle[] => {
  const out: Candle[] = [];
  for (let i = 0; i < n; i++) {
    const mid = 100 + Math.sin(i / 3) * 1.5;
    out.push(candle(mid + 0.5, mid - 0.5, mid));
  }
  return out;
};

const assert = (cond: boolean, msg: string) => {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  console.log('OK:', msg);
};

const trendUp = buildTrend(120, 'up');
const adxUp = adx(trendUp, 14);
const last = adxUp[adxUp.length - 1];
assert(last.adx !== null && last.adx > 25, `ADX > 25 in uptrend (got ${last.adx?.toFixed(1)})`);
const regimeUp = classifyRegime(last.adx, last.pdi, last.ndi);
assert(regimeUp.regime === 'trending' && regimeUp.bias === 'bullish', `Trending bullish in uptrend (got ${regimeUp.regime}/${regimeUp.bias})`);

const trendDown = buildTrend(120, 'down');
const adxDn = adx(trendDown, 14);
const lastDn = adxDn[adxDn.length - 1];
assert(lastDn.adx !== null && lastDn.adx > 25, `ADX > 25 in downtrend (got ${lastDn.adx?.toFixed(1)})`);
const regimeDn = classifyRegime(lastDn.adx, lastDn.pdi, lastDn.ndi);
assert(regimeDn.regime === 'trending' && regimeDn.bias === 'bearish', `Trending bearish in downtrend (got ${regimeDn.regime}/${regimeDn.bias})`);

const ranged = buildRange(120);
const adxR = adx(ranged, 14);
const lastR = adxR[adxR.length - 1];
assert(lastR.adx !== null && lastR.adx < 25, `ADX < 25 in range (got ${lastR.adx?.toFixed(1)})`);
const regimeR = classifyRegime(lastR.adx, lastR.pdi, lastR.ndi);
assert(regimeR.regime !== 'trending', `Range classified correctly (got ${regimeR.regime})`);

const short = adx(trendUp.slice(0, 5), 14);
assert(short[short.length - 1].adx === null, `Insufficient data returns null ADX`);

console.log('\nAll ADX tests passed.');
