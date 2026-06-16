import type { Candle } from './utils';
import { computeSignal, type Signal, type SignalAction, type SignalWeights } from './signal';

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
  sortinoRatio: number;
  avgBarsHeld: number;
  buyCount: number;
  sellCount: number;
  holdCount: number;
  buyAndHoldReturnPct: number;
  buyAndHoldSharpe: number;
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
  /** Bars per year for Sharpe annualization. If omitted, derived from interval. */
  barsPerYear?: number;
  /** Chart interval string (e.g. '1h', '4h', '1d') for deriving barsPerYear. */
  interval?: string;
  /** Optional weight overrides passed to computeSignal. */
  weights?: Partial<SignalWeights>;
};

const BARS_PER_YEAR: Record<string, number> = {
  '1m': 525600, '5m': 105120, '15m': 35040,
  '1h': 8760, '4h': 2190, '1d': 365, '1w': 52,
};

const RISK_FREE_RATE_ANNUAL = 0.045;

const DEFAULT_OPTS: Required<BacktestOptions> = {
  minConfidence: 0,
  maxLookahead: 50,
  cooldown: 7,
  initialCapital: 10000,
  skipRanging: false,
  barsPerYear: 365,
  interval: '1d',
  weights: {},
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
    const open = c.open;

    // Intrabar SL/TP detection with open-gap logic:
    // If open gaps past SL or TP, that level was hit at the open.
    // Otherwise check low/high as usual.
    let hitSL = false;
    let hitTP = false;

    if (action === 'BUY') {
      // BUY: SL is below entry, TP is above entry
      if (open <= sl) hitSL = true;
      else if (open >= tp) hitTP = true;
      else {
        hitSL = c.low <= sl;
        hitTP = c.high >= tp;
      }
    } else {
      // SELL: SL is above entry, TP is below entry
      if (open >= sl) hitSL = true;
      else if (open <= tp) hitTP = true;
      else {
        hitSL = c.high >= sl;
        hitTP = c.low <= tp;
      }
    }

    if (hitSL && hitTP) {
      // Both hit on same bar — determine which was hit first
      // If open gapped past both (rare), open distance decides
      const openDistSL = action === 'BUY' ? Math.abs(open - sl) : Math.abs(sl - open);
      const openDistTP = action === 'BUY' ? Math.abs(tp - open) : Math.abs(open - tp);
      if (openDistTP < openDistSL) {
        // TP was nearer to open → TP hit first
        return { exitIndex: j, exitPrice: tp, exitReason: 'tp', pnlPct: action === 'BUY' ? ((tp - entry) / entry) * 100 : ((entry - tp) / entry) * 100, barsHeld: j - entryIndex };
      }
      // SL nearer (or equidistant) → SL first (conservative)
      return { exitIndex: j, exitPrice: sl, exitReason: 'sl', pnlPct: action === 'BUY' ? ((sl - entry) / entry) * 100 : ((entry - sl) / entry) * 100, barsHeld: j - entryIndex };
    }
    if (hitSL) {
      return { exitIndex: j, exitPrice: sl, exitReason: 'sl', pnlPct: action === 'BUY' ? ((sl - entry) / entry) * 100 : ((entry - sl) / entry) * 100, barsHeld: j - entryIndex };
    }
    if (hitTP) {
      return { exitIndex: j, exitPrice: tp, exitReason: 'tp', pnlPct: action === 'BUY' ? ((tp - entry) / entry) * 100 : ((entry - tp) / entry) * 100, barsHeld: j - entryIndex };
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

const computeSharpe = (returns: number[], barsPerYear: number): number => {
  if (returns.length < 2) return 0;
  const rfPerBar = RISK_FREE_RATE_ANNUAL / barsPerYear;
  const excessReturns = returns.map(r => r - rfPerBar);
  const mean = excessReturns.reduce((a, b) => a + b, 0) / excessReturns.length;
  const variance = excessReturns.reduce((acc, r) => acc + (r - mean) ** 2, 0) / excessReturns.length;
  const std = Math.sqrt(variance);
  if (std === 0) return 0;
  return (mean / std) * Math.sqrt(barsPerYear);
};

const computeSortino = (returns: number[], barsPerYear: number): number => {
  if (returns.length < 2) return 0;
  const rfPerBar = RISK_FREE_RATE_ANNUAL / barsPerYear;
  const excessReturns = returns.map(r => r - rfPerBar);
  const mean = excessReturns.reduce((a, b) => a + b, 0) / excessReturns.length;
  const downsideReturns = excessReturns.filter(r => r < 0);
  if (downsideReturns.length === 0) return mean > 0 ? Infinity : 0;
  const downsideVariance = downsideReturns.reduce((acc, r) => acc + r ** 2, 0) / excessReturns.length;
  const downsideDev = Math.sqrt(downsideVariance);
  if (downsideDev === 0) return 0;
  return (mean / downsideDev) * Math.sqrt(barsPerYear);
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
  // Derive barsPerYear from interval if not explicitly set
  const barsPerYear = opts.barsPerYear !== DEFAULT_OPTS.barsPerYear
    ? opts.barsPerYear
    : BARS_PER_YEAR[opts.interval] ?? 365;
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
    const sig: Signal | null = computeSignal(slice, { weights: opts.weights });
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

  const buyAndHoldReturnPct = candles.length > 1
    ? ((candles[candles.length - 1].close - candles[210].close) / candles[210].close) * 100
    : 0;

  const signalStart = 210;
  const signalEnd = candles.length - 1;
  const bhBars = signalEnd - signalStart;
  const bhBarReturns: number[] = [];
  for (let i = signalStart + 1; i <= signalEnd; i++) {
    bhBarReturns.push((candles[i].close - candles[i - 1].close) / candles[i - 1].close);
  }
  const buyAndHoldSharpe = computeSharpe(bhBarReturns, barsPerYear);

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
    sharpeRatio: computeSharpe(returns, barsPerYear),
    sortinoRatio: computeSortino(returns, barsPerYear),
    buyAndHoldReturnPct,
    buyAndHoldSharpe,
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
  sortinoRatio: 0,
  avgBarsHeld: 0,
  buyCount: buy,
  sellCount: sell,
  holdCount: hold,
  buyAndHoldReturnPct: 0,
  buyAndHoldSharpe: 0,
  byConfidence: ['0-40', '40-60', '60-80', '80-100'].map((range) => ({ range, trades: 0, winRate: 0 })),
  byAction: ['BUY', 'SELL'].map((action) => ({ action: action as SignalAction, trades: 0, winRate: 0, avgPnl: 0 })),
  equityCurve: [],
});

export type MonteCarloResult = {
  randomAvgWR: number;
  randomAvgReturn: number;
  randomAvgSharpe: number;
  signalWR: number;
  signalReturn: number;
  signalSharpe: number;
  pValue: number;
  significant: boolean;
};

export const runMonteCarlo = (
  candles: Candle[],
  options: BacktestOptions & { simulations?: number } = {}
): MonteCarloResult | null => {
  const sims = options.simulations ?? 1000;
  const opts = { ...DEFAULT_OPTS, ...options };
  const barsPerYear = opts.barsPerYear !== DEFAULT_OPTS.barsPerYear
    ? opts.barsPerYear
    : BARS_PER_YEAR[opts.interval] ?? 365;

  const signalResult = runBacktest(candles, options);
  if (!signalResult || signalResult.trades.length < 3) return null;

  const signalWR = signalResult.metrics.winRate;
  const signalReturn = signalResult.metrics.totalReturnPct;
  const signalSharpe = signalResult.metrics.sharpeRatio;

  const startIdx = 210;
  const endIdx = candles.length - opts.maxLookahead;
  if (endIdx - startIdx < 50) return null;

  let randomWRs: number[] = [];
  let randomReturns: number[] = [];
  let randomSharpes: number[] = [];

  for (let s = 0; s < sims; s++) {
    let equity = opts.initialCapital;
    let wins = 0;
    let totalTrades = 0;
    const tradeReturns: number[] = [];
    let idx = startIdx;

    while (idx < endIdx) {
      const action: 'BUY' | 'SELL' = Math.random() < 0.5 ? 'BUY' : 'SELL';
      const holdBars = Math.floor(Math.random() * opts.maxLookahead) + 1;
      const entryPrice = candles[idx].close;
      const exitIdx = Math.min(idx + holdBars, candles.length - 1);
      const exitPrice = candles[exitIdx].close;
      const atrVal = Math.abs(candles[idx].close - candles[idx].open) * 2 || candles[idx].close * 0.01;

      const slDist = atrVal * 2;
      const tpDist = atrVal * 3;
      let pnl: number;

      if (action === 'BUY') {
        const sl = entryPrice - slDist;
        const tp = entryPrice + tpDist;
        let hitSL = false;
        let hitTP = false;
        for (let j = idx + 1; j <= exitIdx; j++) {
          if (candles[j].low <= sl) { hitSL = true; pnl = ((sl - entryPrice) / entryPrice) * 100; idx = j; break; }
          if (candles[j].high >= tp) { hitTP = true; pnl = ((tp - entryPrice) / entryPrice) * 100; idx = j; break; }
        }
        if (!hitSL && !hitTP) { pnl = ((exitPrice - entryPrice) / entryPrice) * 100; idx = exitIdx; }
      } else {
        const sl = entryPrice + slDist;
        const tp = entryPrice - tpDist;
        let hitSL = false;
        let hitTP = false;
        for (let j = idx + 1; j <= exitIdx; j++) {
          if (candles[j].high >= sl) { hitSL = true; pnl = ((entryPrice - sl) / entryPrice) * 100; idx = j; break; }
          if (candles[j].low <= tp) { hitTP = true; pnl = ((entryPrice - tp) / entryPrice) * 100; idx = j; break; }
        }
        if (!hitSL && !hitTP) { pnl = ((entryPrice - exitPrice) / entryPrice) * 100; idx = exitIdx; }
      }

      if (pnl! > 0) wins++;
      totalTrades++;
      tradeReturns.push(pnl! / 100);
      equity *= 1 + pnl! / 100;
      idx += opts.cooldown + 1;
    }

    if (totalTrades === 0) continue;
    randomWRs.push((wins / totalTrades) * 100);
    randomReturns.push(((equity - opts.initialCapital) / opts.initialCapital) * 100);
    const mean = tradeReturns.reduce((a, b) => a + b, 0) / tradeReturns.length;
    const variance = tradeReturns.reduce((acc, r) => acc + (r - mean) ** 2, 0) / tradeReturns.length;
    const std = Math.sqrt(variance);
    randomSharpes.push(std > 0 ? (mean / std) * Math.sqrt(barsPerYear) : 0);
  }

  if (randomSharpes.length === 0) return null;

  const avgRandomWR = randomWRs.reduce((a, b) => a + b, 0) / randomWRs.length;
  const avgRandomReturn = randomReturns.reduce((a, b) => a + b, 0) / randomReturns.length;
  const avgRandomSharpe = randomSharpes.reduce((a, b) => a + b, 0) / randomSharpes.length;

  const randomSharpesArr = randomSharpes;
  const meanRS = avgRandomSharpe;
  const stdRS = Math.sqrt(randomSharpesArr.reduce((acc, s) => acc + (s - meanRS) ** 2, 0) / randomSharpesArr.length);
  const tStat = stdRS > 0 ? (signalSharpe - meanRS) / (stdRS / Math.sqrt(randomSharpesArr.length)) : 0;
  const pValue = tStat > 0 ? Math.max(0, 1 - 0.5 * (1 + erf(tStat / Math.sqrt(2)))) : 1;

  return {
    randomAvgWR: avgRandomWR,
    randomAvgReturn: avgRandomReturn,
    randomAvgSharpe: avgRandomSharpe,
    signalWR,
    signalReturn,
    signalSharpe,
    pValue,
    significant: pValue < 0.05,
  };
};

function erf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}