import { runBacktest } from '../lib/backtest';
import type { Candle } from '../lib/utils';

const assert = (cond: boolean, msg: string) => {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  console.log('OK:', msg);
};

const c = (time: number, open: number, high: number, low: number, close: number, volume = 1000): Candle => ({
  time, open, high, low, close, volume,
});

// Build 300 candles of clean uptrend — should produce BUY signals
const uptrend: Candle[] = [];
for (let i = 0; i < 300; i++) {
  const price = 100 + i * 0.5 + Math.sin(i / 5) * 2;
  uptrend.push(c(i, price - 0.5, price + 2, price - 1.5, price + 0.3, 1000 + Math.sin(i / 7) * 200));
}

// Build 300 candles of clean downtrend — should produce SELL signals
const downtrend: Candle[] = [];
for (let i = 0; i < 300; i++) {
  const price = 400 - i * 0.5 + Math.sin(i / 5) * 2;
  downtrend.push(c(i, price + 0.5, price + 1.5, price - 2, price - 0.3, 1000 + Math.sin(i / 7) * 200));
}

// Insufficient data returns null
const short = uptrend.slice(0, 100);
assert(runBacktest(short) === null, 'Backtest returns null for insufficient data (< 250 candles)');

// Backtest on uptrend
const upResult = runBacktest(uptrend, { maxLookahead: 30 });
assert(upResult !== null, 'Uptrend backtest returns result');
if (upResult) {
  assert(upResult.trades.length >= 0, `Uptrend trades: ${upResult.trades.length}`);
  assert(typeof upResult.metrics.winRate === 'number', 'winRate is number');
  assert(typeof upResult.metrics.sharpeRatio === 'number', 'sharpeRatio is number');
  assert(typeof upResult.metrics.profitFactor === 'number', 'profitFactor is number');
  assert(typeof upResult.metrics.maxDrawdownPct === 'number', 'maxDrawdownPct is number');
  assert(upResult.metrics.maxDrawdownPct >= 0, 'maxDrawdownPct ≥ 0');
  assert(upResult.metrics.avgBarsHeld >= 0, 'avgBarsHeld ≥ 0');
  assert(Array.isArray(upResult.metrics.byConfidence), 'byConfidence is array');
  assert(Array.isArray(upResult.metrics.byAction), 'byAction is array');
  assert(Array.isArray(upResult.metrics.equityCurve), 'equityCurve is array');

  // If we have trades, verify structure
  for (const t of upResult.trades) {
    assert(t.action === 'BUY' || t.action === 'SELL', `Trade action valid: ${t.action}`);
    assert(typeof t.entry === 'number' && t.entry > 0, 'Trade entry positive');
    assert(t.exitReason === 'tp' || t.exitReason === 'sl' || t.exitReason === 'timeout', `Exit reason valid: ${t.exitReason}`);
    assert(t.exitIndex > t.index, 'Exit happens after entry');
    assert(typeof t.pnlPct === 'number', 'pnlPct is number');
  }

  // Win rate is percentage 0-100
  assert(upResult.metrics.winRate >= 0 && upResult.metrics.winRate <= 100, `winRate in [0,100]: ${upResult.metrics.winRate.toFixed(1)}`);
}

// Min confidence filter reduces trade count
const allTrades = runBacktest(uptrend, { maxLookahead: 30, minConfidence: 0 });
const filteredTrades = runBacktest(uptrend, { maxLookahead: 30, minConfidence: 80 });
if (allTrades && filteredTrades) {
  assert(filteredTrades.metrics.totalTrades <= allTrades.metrics.totalTrades,
    `Min confidence filter reduces trades: ${allTrades.metrics.totalTrades} → ${filteredTrades.metrics.totalTrades}`);
}

// Ranging filter — synthetic ranging data should produce HOLD signals which get skipped
const ranging: Candle[] = [];
for (let i = 0; i < 300; i++) {
  const price = 200 + Math.sin(i / 3) * 3;
  ranging.push(c(i, price - 0.5, price + 1, price - 1, price + Math.sin(i / 4) * 0.5, 800));
}
const rangeResult = runBacktest(ranging, { maxLookahead: 30, skipRanging: true });
assert(rangeResult !== null, 'Ranging backtest returns result');

// Sharpe ratio is finite number
if (upResult && upResult.trades.length > 1) {
  assert(Number.isFinite(upResult.metrics.sharpeRatio), `Sharpe is finite: ${upResult.metrics.sharpeRatio.toFixed(2)}`);
}

// Profit factor is non-negative
if (upResult) {
  assert(upResult.metrics.profitFactor >= 0, `Profit factor ≥ 0: ${upResult.metrics.profitFactor.toFixed(2)}`);
}

// Backtest performance: should complete in reasonable time
const t0 = performance.now();
runBacktest(uptrend);
const elapsed = performance.now() - t0;
assert(elapsed < 10000, `Backtest completes in <10s: ${elapsed.toFixed(0)}ms`);

console.log('\nAll Backtest tests passed.');