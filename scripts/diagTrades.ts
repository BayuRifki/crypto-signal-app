import { generateDemoCandles } from '../lib/demoData';
import { runBacktest } from '../lib/backtest';
import { computeSignal } from '../lib/signal';

const c = generateDemoCandles('ranging', 400, 'RANGE1');
const bt = runBacktest(c, { minConfidence: 50, maxLookahead: 30, cooldown: 3 });
if (!bt) { console.log('NO RESULT'); process.exit(1); }
console.log('Trades:', bt.trades.length);
for (const t of bt.trades) {
  const slice = c.slice(0, t.index + 1);
  const sig = computeSignal(slice);
  console.log(`i=${t.index} action=${t.action} entry=${t.entry.toFixed(2)} SL=${t.stopLoss.toFixed(2)} TP=${t.takeProfit.toFixed(2)} pnl=${t.pnlPct.toFixed(2)}% exit=${t.exitReason} conf=${t.confidence} regime=${sig?.regime} bias=${sig?.regimeBias} rsi=${sig?.rsiValue?.toFixed(1)} bbPos=${sig?.bbPos?.toFixed(0)} rvol=${sig?.rvol?.toFixed(2)} adx=${sig?.adx?.toFixed(1)}`);
}
