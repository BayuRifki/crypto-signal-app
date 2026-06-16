import { generateDemoCandles } from '../lib/demoData';
import { generateTrueSideways } from './trueSideways';
import { runBacktest } from '../lib/backtest';

console.log('=== True sideways (3 seeds) ===');
for (const s of ['SIDE1', 'SIDE2', 'SIDE3']) {
  const c = generateTrueSideways(400, s);
  const bt = runBacktest(c, { minConfidence: 50, maxLookahead: 30, cooldown: 3 });
  if (!bt) { console.log(s, 'NO RESULT'); continue; }
  const m = bt.metrics;
  const pfStr = m.profitFactor === Infinity ? 'Inf' : m.profitFactor.toFixed(2);
  console.log(s, 'trades:', m.totalTrades, 'wr:', m.winRate.toFixed(1) + '%', 'pf:', pfStr, 'ret:', m.totalReturnPct.toFixed(1) + '%', 'sharpe:', m.sharpeRatio.toFixed(2), 'buy:', m.buyCount, 'sell:', m.sellCount, 'hold:', m.holdCount);
}
console.log('=== Original preset sweep ===');
for (const p of [
  { name: 'trending' as const, sym: 'TREND1' },
  { name: 'bear-trend' as const, sym: 'BEAR1' },
  { name: 'volatile' as const, sym: 'VOL1' },
]) {
  const c = generateDemoCandles(p.name, 400, p.sym);
  const bt = runBacktest(c, { minConfidence: 50, maxLookahead: 30, cooldown: 3 });
  if (!bt) continue;
  const m = bt.metrics;
  const pfStr = m.profitFactor === Infinity ? 'Inf' : m.profitFactor.toFixed(2);
  console.log(p.name, 'trades:', m.totalTrades, 'wr:', m.winRate.toFixed(1) + '%', 'pf:', pfStr, 'ret:', m.totalReturnPct.toFixed(1) + '%', 'sharpe:', m.sharpeRatio.toFixed(2));
}
