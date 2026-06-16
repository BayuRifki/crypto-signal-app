import { generateDemoCandles, type DemoPreset } from '../lib/demoData';
import type { Candle } from '../lib/utils';

const assert = (cond: boolean, msg: string) => {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  console.log('OK:', msg);
};

// 1. Basic shape
const candles: Candle[] = generateDemoCandles('trending', 300, 'BTCUSDT');
assert(candles.length === 300, `Demo candles length=300 (got ${candles.length})`);
assert(candles.every((c) => c.open > 0 && c.high > 0 && c.low > 0 && c.close > 0), 'All prices > 0');
assert(candles.every((c) => c.high >= c.low), 'high >= low');
assert(candles.every((c) => c.high >= c.open && c.high >= c.close), 'high >= open/close');
assert(candles.every((c) => c.low <= c.open && c.low <= c.close), 'low <= open/close');
assert(candles.every((c) => c.volume > 0), 'All volumes > 0');
assert(candles.every((c, i) => i === 0 || c.time > candles[i - 1].time), 'Time strictly increasing');

// 2. Determinism (same inputs → same output)
const a = generateDemoCandles('trending', 100, 'BTCUSDT');
const b = generateDemoCandles('trending', 100, 'BTCUSDT');
assert(a.every((c, i) => c.open === b[i].open && c.close === b[i].close && c.volume === b[i].volume),
  'Same preset+symbol+length → identical candles');

// 3. Different symbols → different series
const xrp = generateDemoCandles('trending', 100, 'XRPUSDT');
assert(a.some((c, i) => c.close !== xrp[i].close), 'Different symbolSeed → different series');

// 4. Different presets → different price behavior
const trending = generateDemoCandles('trending', 300, 'BTCUSDT');
const bear = generateDemoCandles('bear-trend', 300, 'BTCUSDT');
const trendFirst = trending[trending.length - 1].close - trending[0].close;
const bearFirst = bear[bear.length - 1].close - bear[0].close;
assert(trendFirst > bearFirst, `Trending net change > bear-trend (${trendFirst.toFixed(2)} > ${bearFirst.toFixed(2)})`);

// 5. All 4 presets generate
const presets: DemoPreset[] = ['trending', 'ranging', 'volatile', 'bear-trend'];
for (const p of presets) {
  const c = generateDemoCandles(p, 250, 'BTCUSDT');
  assert(c.length === 250, `Preset ${p} generates 250 candles`);
}

// 6. Warmup compatible (>= 210 for signal engine)
const long = generateDemoCandles('trending', 500, 'BTCUSDT');
assert(long.length >= 210, 'Demo candles compatible with signal engine (>= 210)');

console.log('\nAll Demo Data tests passed.');
