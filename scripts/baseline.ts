import { generateDemoCandles } from '../lib/demoData';
import { runBacktest } from '../lib/backtest';

const presets: Array<{ name: 'ranging' | 'trending' | 'bear-trend' | 'volatile'; sym: string }> = [
  { name: 'ranging', sym: 'RANGE1' },
  { name: 'ranging', sym: 'RANGE2' },
  { name: 'ranging', sym: 'RANGE3' },
  { name: 'trending', sym: 'TREND1' },
  { name: 'bear-trend', sym: 'BEAR1' },
  { name: 'volatile', sym: 'VOL1' },
];

console.log('=== BASELINE (current behavior) ===');
for (const p of presets) {
  const c = generateDemoCandles(p.name, 400, p.sym);
  const bt = runBacktest(c, { minConfidence: 50, maxLookahead: 30, cooldown: 3 });
  if (!bt) { console.log(p.name, p.sym, 'NO RESULT'); continue; }
  const m = bt.metrics;
  const pfStr = m.profitFactor === Infinity ? 'Inf' : m.profitFactor.toFixed(2);
  console.log(p.name.padEnd(10), p.sym.padEnd(7), 'trades:', String(m.totalTrades).padStart(3), 'wr:', m.winRate.toFixed(1).padStart(5) + '%', 'pf:', pfStr.padStart(6), 'ret:', m.totalReturnPct.toFixed(1).padStart(7) + '%', 'sharpe:', m.sharpeRatio.toFixed(2).padStart(6), 'buy:', String(m.buyCount).padStart(3), 'sell:', String(m.sellCount).padStart(3), 'hold:', String(m.holdCount).padStart(3));
}
