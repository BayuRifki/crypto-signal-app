import type { Candle } from './utils';
import { computeSignal, type Signal, type SignalAction } from './signal';

export type BacktestTrade = {
  index: number;
  time: number;
  action: SignalAction;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  score: number;
  exitIndex: number;
  exitTime: number;
  exitPrice: number;
  exitReason: 'tp' | 'sl' | 'timeout' | 'reversal';
  pnlPct: number;
  barsHeld: number;
};

export type BacktestMetrics = {
  totalTrades: number;
  wins: number;
  losses: number;
  timeouts: number;
  winRate: number;
  avgWinPct: number;
  avgLossPct: number;
  expectedValuePct: number;
  profitFactor: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  avgBarsHeld: number;
  buyCount: number;
  sellCount: number;
  holdCount: number;
  byConfidence: { range: string; trades: number; winRate: number }[];
  byAction: { action: SignalAction; trades: number; winRate: number; avgPnl: number }[];
  equityCurve: { t: number; equity: number }[];
};

export type BacktestResult = {
  trades: BacktestTrade[];
  metrics: BacktestMetrics;
  duration: number;
};

export type BacktestOptions = {
  /** Minimum confidence (0-100) to enter a trade. Trades below this threshold are skipped. */
  minConfidence?: number;
  /** Maximum number of candles ahead to wait for TP/SL hit before timing out. */
  maxLookahead?: number;
  /** Cooldown after a trade closes (bars) before opening next. */
  cooldown?: number;
  /** Initial capital (for equity curve calc). */
  initialCapital?: number;
  /** Skip trading in ranging regime. */
  skipRanging?: boolean;
};

const DEFAULT_OPTS: Required<BacktestOptions> = {
  minConfidence: 0,
  maxLookahead: 50,
  cooldown: 0,
  initialCapital: 10000,
  skipRanging: false,
};

const exitTrade = (
  candles: Candle[],
  entryIndex: number,
  entry: number,
  sl: number,
  tp: number,
  action: 'BUY' | 'SELL',
  maxLookahead: number
): { exitIndex: number; exitPrice: number; exitReason: BacktestTrade['exitReason']; pnlPct: number; barsHeld: number } => {
  for (let j = entryIndex + 1; j <= Math.min(entryIndex + maxLookahead, candles.length - 1); j++) {
    const c = candles[j];
    if (action === 'BUY') {
      if (c.low <= sl) {
        return { exitIndex: j, exitPrice: sl, exitReason: 'sl', pnlPct: ((sl - entry) / entry) * 100, barsHeld: j - entryIndex };
      }
      if (c.high >= tp) {
        return { exitIndex: j, exitPrice: tp, exitReason: 'tp', pnlPct: ((tp - entry) / entry) * 100, barsHeld: j - entryIndex };
      }
    } else {
      if (c.high >= sl) {
        return { exitIndex: j, exitPrice: sl, exitReason: 'sl', pnlPct: ((entry - sl) / entry) * 100, barsHeld: j - entryIndex };
      }
      if (c.low <= tp) {
        return { exitIndex: j, exitPrice: tp, exitReason: 'tp', pnlPct: ((entry - tp) / entry) * 100, barsHeld: j - entryIndex };
      }
    }
  }
  const lastIdx = Math.min(entryIndex + maxLookahead, candles.length - 1);
  const exitPrice = candles[lastIdx].close;
  const pnlPct = action === 'BUY' ? ((exitPrice - entry) / entry) * 100 : ((entry - exitPrice) / entry) * 100;
  return { exitIndex: lastIdx, exitPrice, exitReason: 'timeout', pnlPct, barsHeld: lastIdx - entryIndex };
};

const computeDrawdown = (equity: { t: number; equity: number }[]): number => {
  let peak = equity[0]?.equity ?? 0;
  let maxDD = 0;
  for (const e of equity) {
    if (e.equity > peak) peak = e.equity;
    const dd = peak > 0 ? ((peak - e.equity) / peak) * 100 : 0;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
};

const computeSharpe = (returns: number[]): number => {
  if (returns.length < 2) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((acc, r) => acc + (r - mean) ** 2, 0) / returns.length;
  const std = Math.sqrt(variance);
  if (std === 0) return 0;
  // Annualization factor: assume 252 daily bars; for other TFs scale accordingly
  return (mean / std) * Math.sqrt(252);
};

const confidenceBucket = (c: number): string => {
  if (c >= 80) return '80-100';
  if (c >= 60) return '60-80';
  if (c >= 40) return '40-60';
  return '0-40';
};

/**
 * Replay historical candles through the signal engine to evaluate
 * forward-looking trade performance.
 *
 * For each candle, computes a signal using only data available up to that point,
 * then walks forward up to `maxLookahead` bars to see if TP or SL is hit first.
 *
 * Returns per-trade records plus aggregate metrics (Sharpe, win rate, max DD,
 * profit factor, equity curve, breakdown by confidence bucket and action).
 *
 * @param candles - OHLCV candles (newest last), at least 250 required
 * @param options - Backtest configuration
 * @returns Backtest result with trades and metrics, or null if insufficient data
 */
export const runBacktest = (
  candles: Candle[],
  options: BacktestOptions = {}
): BacktestResult | null => {
  const opts = { ...DEFAULT_OPTS, ...options };
  if (candles.length < 250) return null;

  const start = performance.now();
  const trades: BacktestTrade[] = [];
  let lastExitIndex = -1;
  const equity: { t: number; equity: number }[] = [{ t: candles[0].time, equity: opts.initialCapital }];
  let runningEquity = opts.initialCapital;
  let buyCount = 0;
  let sellCount = 0;
  let holdCount = 0;

  for (let i = 210; i < candles.length - opts.maxLookahead; i++) {
    if (i - lastExitIndex <= opts.cooldown) continue;
    const slice = candles.slice(0, i + 1);
    const sig: Signal | null = computeSignal(slice);
    if (!sig) continue;

    holdCount++;
    if (sig.action === 'HOLD') continue;
    if (sig.confidence < opts.minConfidence) continue;
    if (opts.skipRanging && sig.regime === 'ranging') continue;

    const result = exitTrade(
      candles,
      i,
      sig.price,
      sig.risk.stopLoss,
      sig.risk.takeProfit,
      sig.action as 'BUY' | 'SELL',
      opts.maxLookahead
    );

    if (sig.action === 'BUY') buyCount++;
    else sellCount++;

    trades.push({
      index: i,
      time: candles[i].time,
      action: sig.action,
      entry: sig.price,
      stopLoss: sig.risk.stopLoss,
      takeProfit: sig.risk.takeProfit,
      confidence: sig.confidence,
      score: sig.score,
      exitIndex: result.exitIndex,
      exitTime: candles[result.exitIndex].time,
      exitPrice: result.exitPrice,
      exitReason: result.exitReason,
      pnlPct: result.pnlPct,
      barsHeld: result.barsHeld,
    });

    lastExitIndex = result.exitIndex;
    runningEquity *= 1 + result.pnlPct / 100;
    equity.push({ t: candles[result.exitIndex].time, equity: runningEquity });
  }

  if (trades.length === 0) {
    return {
      trades: [],
      metrics: emptyMetrics(buyCount, sellCount, holdCount),
      duration: performance.now() - start,
    };
  }

  const wins = trades.filter((t) => t.pnlPct > 0);
  const losses = trades.filter((t) => t.pnlPct < 0);
  const timeouts = trades.filter((t) => t.exitReason === 'timeout');
  const totalWinPct = wins.reduce((a, t) => a + t.pnlPct, 0);
  const totalLossPct = Math.abs(losses.reduce((a, t) => a + t.pnlPct, 0));
  const returns = trades.map((t) => t.pnlPct / 100);

  const byConfidenceMap = new Map<string, { trades: number; wins: number }>();
  for (const t of trades) {
    const range = confidenceBucket(t.confidence);
    const cur = byConfidenceMap.get(range) ?? { trades: 0, wins: 0 };
    cur.trades++;
    if (t.pnlPct > 0) cur.wins++;
    byConfidenceMap.set(range, cur);
  }
  const byConfidence = ['0-40', '40-60', '60-80', '80-100'].map((range) => {
    const e = byConfidenceMap.get(range) ?? { trades: 0, wins: 0 };
    return { range, trades: e.trades, winRate: e.trades > 0 ? (e.wins / e.trades) * 100 : 0 };
  });

  const byActionMap = new Map<SignalAction, { trades: number; wins: number; pnl: number }>();
  for (const t of trades) {
    const cur = byActionMap.get(t.action) ?? { trades: 0, wins: 0, pnl: 0 };
    cur.trades++;
    if (t.pnlPct > 0) cur.wins++;
    cur.pnl += t.pnlPct;
    byActionMap.set(t.action, cur);
  }
  const byAction: BacktestMetrics['byAction'] = ['BUY', 'SELL'].map((act) => {
    const e = byActionMap.get(act as SignalAction) ?? { trades: 0, wins: 0, pnl: 0 };
    return {
      action: act as SignalAction,
      trades: e.trades,
      winRate: e.trades > 0 ? (e.wins / e.trades) * 100 : 0,
      avgPnl: e.trades > 0 ? e.pnl / e.trades : 0,
    };
  });

  const metrics: BacktestMetrics = {
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    timeouts: timeouts.length,
    winRate: (wins.length / trades.length) * 100,
    avgWinPct: wins.length > 0 ? totalWinPct / wins.length : 0,
    avgLossPct: losses.length > 0 ? totalLossPct / losses.length : 0,
    expectedValuePct: trades.reduce((a, t) => a + t.pnlPct, 0) / trades.length,
    profitFactor: totalLossPct > 0 ? totalWinPct / totalLossPct : totalWinPct > 0 ? Infinity : 0,
    totalReturnPct: ((runningEquity - opts.initialCapital) / opts.initialCapital) * 100,
    maxDrawdownPct: computeDrawdown(equity),
    sharpeRatio: computeSharpe(returns),
    avgBarsHeld: trades.reduce((a, t) => a + t.barsHeld, 0) / trades.length,
    buyCount,
    sellCount,
    holdCount,
    byConfidence,
    byAction,
    equityCurve: equity,
  };

  return {
    trades,
    metrics,
    duration: performance.now() - start,
  };
};

const emptyMetrics = (buy: number, sell: number, hold: number): BacktestMetrics => ({
  totalTrades: 0,
  wins: 0,
  losses: 0,
  timeouts: 0,
  winRate: 0,
  avgWinPct: 0,
  avgLossPct: 0,
  expectedValuePct: 0,
  profitFactor: 0,
  totalReturnPct: 0,
  maxDrawdownPct: 0,
  sharpeRatio: 0,
  avgBarsHeld: 0,
  buyCount: buy,
  sellCount: sell,
  holdCount: hold,
  byConfidence: ['0-40', '40-60', '60-80', '80-100'].map((range) => ({ range, trades: 0, winRate: 0 })),
  byAction: ['BUY', 'SELL'].map((action) => ({ action: action as SignalAction, trades: 0, winRate: 0, avgPnl: 0 })),
  equityCurve: [],
});