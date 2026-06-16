/**
 * Full Backtest Script — Real Historical Crypto Data
 *
 * Downloads klines from Binance for major pairs across multiple timeframes,
 * then runs the signal engine's runBacktest() on each dataset.
 * Reports win rate, Sharpe ratio, profit factor, max drawdown, and more.
 *
 * Usage: npx tsx scripts/fullBacktest.ts
 */

import { runBacktest, runMonteCarlo, type BacktestResult, type BacktestMetrics } from '../lib/backtest';
import type { Candle } from '../lib/utils';
import type { Interval } from '../lib/exchanges/types';

const BINANCE_BASE = 'https://data-api.binance.vision';

const PAIRS = [
  'BTCUSDT',
  'ETHUSDT',
  'BNBUSDT',
  'SOLUSDT',
  'XRPUSDT',
  'ADAUSDT',
  'DOGEUSDT',
  'AVAXUSDT',
  'DOTUSDT',
  'MATICUSDT',
];

const INTERVALS: { interval: Interval; barsPerYear: number; label: string }[] = [
  { interval: '1d', barsPerYear: 365, label: '1D' },
  { interval: '4h', barsPerYear: 2190, label: '4H' },
];

const CONFIDENCE_LEVELS = [0, 50, 65];

type PairResult = {
  pair: string;
  interval: string;
  candlesUsed: number;
  duration: number;
} & BacktestMetrics;

const fetchJson = async <T,>(url: string, retries = 3): Promise<T> => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'crypto-signal-backtest/1.0' },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as T;
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw new Error('unreachable');
};

const fetchKlinesPaged = async (symbol: string, interval: string, totalCandles: number): Promise<Candle[]> => {
  const allCandles: Candle[] = [];
  const limit = 1000;
  let endTime: number | undefined = undefined;

  while (allCandles.length < totalCandles) {
    let url = `${BINANCE_BASE}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    if (endTime !== undefined) {
      url += `&endTime=${endTime}`;
    }

    const data = await fetchJson<(string | number)[][]>(url);
    if (data.length === 0) break;

    const mapped: Candle[] = data.map((k) => ({
      time: Math.floor(Number(k[0]) / 1000),
      open: Number(k[1]),
      high: Number(k[2]),
      low: Number(k[3]),
      close: Number(k[4]),
      volume: Number(k[5]),
    }));

    allCandles.unshift(...mapped);
    endTime = mapped[0].time * 1000 - 1;

    if (mapped.length < limit) break;
    if (allCandles.length >= totalCandles) break;
    await new Promise((r) => setTimeout(r, 150));
  }

  const excess = allCandles.length - totalCandles;
  if (excess > 0) return allCandles.slice(excess);
  return allCandles;
};

const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
const fmtNum = (n: number, d = 2) => n.toFixed(d);

const printResult = (r: PairResult) => {
  const pf = r.profitFactor === Infinity ? 'INF' : fmtNum(r.profitFactor);
  const signalVsBH = r.buyAndHoldReturnPct !== 0
    ? `${(r.totalReturnPct - r.buyAndHoldReturnPct >= 0 ? '+' : '')}${(r.totalReturnPct - r.buyAndHoldReturnPct).toFixed(1)}%`
    : 'n/a';
  console.log(
    `  ${r.pair.padEnd(10)} ${r.interval.padEnd(3)} ` +
    `candles=${String(r.candlesUsed).padStart(4)} ` +
    `trades=${String(r.totalTrades).padStart(4)} ` +
    `wins=${String(r.wins).padStart(3)} ` +
    `losses=${String(r.losses).padStart(3)} ` +
    `WR=${fmtPct(r.winRate).padStart(8)} ` +
    `Sharpe=${fmtNum(r.sharpeRatio).padStart(7)} ` +
    `Sortino=${fmtNum(r.sortinoRatio).padStart(7)} ` +
    `PF=${pf.padStart(6)} ` +
    `Ret=${fmtPct(r.totalReturnPct).padStart(9)} ` +
    `BH=${fmtPct(r.buyAndHoldReturnPct).padStart(9)} ` +
    `vsBH=${signalVsBH.padStart(8)} ` +
    `MaxDD=${fmtPct(-r.maxDrawdownPct).padStart(9)} ` +
    `AvgWin=${fmtPct(r.avgWinPct).padStart(8)} ` +
    `AvgLoss=${fmtPct(-r.avgLossPct).padStart(9)} ` +
    `EV=${fmtPct(r.expectedValuePct).padStart(8)} ` +
    `AvgBars=${fmtNum(r.avgBarsHeld, 1).padStart(6)} ` +
    `BUY=${String(r.buyCount).padStart(3)} ` +
    `SELL=${String(r.sellCount).padStart(3)} ` +
    `HOLD=${String(r.holdCount).padStart(4)} ` +
    `Timeouts=${String(r.timeouts).padStart(3)}`
  );
};

const printConfidenceBreakdown = (r: PairResult) => {
  if (r.byConfidence.length === 0) return;
  for (const bucket of r.byConfidence) {
    if (bucket.trades === 0) continue;
    console.log(
      `    conf ${bucket.range.padEnd(6)}: trades=${String(bucket.trades).padStart(3)} WR=${fmtPct(bucket.winRate).padStart(8)}`
    );
  }
  for (const a of r.byAction) {
    if (a.trades === 0) continue;
    console.log(
      `    ${a.action.padEnd(4)}: trades=${String(a.trades).padStart(3)} WR=${fmtPct(a.winRate).padStart(8)} avgPnl=${fmtPct(a.avgPnl).padStart(8)}`
    );
  }
};

async function main() {
  console.log('=== FULL BACKTEST — REAL HISTORICAL CRYPTO DATA ===');
  console.log(`Pairs: ${PAIRS.join(', ')}`);
  console.log(`Intervals: ${INTERVALS.map((i) => i.label).join(', ')}`);
  console.log(`Confidence thresholds: ${CONFIDENCE_LEVELS.join(', ')}`);
  console.log('');

  const allResults: PairResult[] = [];
  const errors: string[] = [];

  for (const intervalConfig of INTERVALS) {
    console.log(`\n--- Interval: ${intervalConfig.label} ---`);
    for (const pair of PAIRS) {
      let candles: Candle[];
      try {
        process.stdout.write(`  Fetching ${pair} ${intervalConfig.label}...`);
        candles = await fetchKlinesPaged(pair, intervalConfig.interval, 800);
        console.log(` ${candles.length} candles loaded.`);
      } catch (err) {
        const msg = `  ${pair} ${intervalConfig.label}: FETCH FAILED — ${err}`;
        console.log(msg);
        errors.push(msg);
        continue;
      }

      if (candles.length < 250) {
        console.log(`  ${pair} ${intervalConfig.label}: insufficient data (${candles.length} candles)`);
        continue;
      }

      for (const minConf of CONFIDENCE_LEVELS) {
        const bt: BacktestResult | null = runBacktest(candles, {
          minConfidence: minConf,
          maxLookahead: 50,
          cooldown: 3,
          interval: intervalConfig.label.toLowerCase(),
          barsPerYear: intervalConfig.barsPerYear,
        });

        if (!bt) {
          console.log(`  ${pair} ${intervalConfig.label} conf>=${minConf}: no result`);
          continue;
        }

        const result: PairResult = {
          pair,
          interval: intervalConfig.label,
          candlesUsed: candles.length,
          ...bt.metrics,
        };
        allResults.push(result);

        if (minConf === 0) {
          printResult(result);
        }
      }
    }
  }

  console.log('\n\n');
  console.log('='.repeat(120));
  console.log('COMPREHENSIVE RESULTS SUMMARY');
  console.log('='.repeat(120));

  for (const intervalConfig of INTERVALS) {
    console.log(`\n--- ${intervalConfig.label} (conf >= 0) ---`);
    const intervalResults = allResults.filter(
      (r) => r.interval === intervalConfig.label && r.totalTrades > 0
    );
    for (const r of intervalResults) {
      printResult(r);
    }

    if (intervalResults.length > 0) {
      console.log('\n  Confidence breakdown:');
      for (const r of intervalResults) {
        printConfidenceBreakdown(r);
      }
    }
  }

  console.log('\n\n');
  console.log('='.repeat(120));
  console.log('CONFIDENCE THRESHOLD COMPARISON');
  console.log('='.repeat(120));

  for (const minConf of CONFIDENCE_LEVELS) {
    console.log(`\n--- minConfidence >= ${minConf} ---`);
    for (const intervalConfig of INTERVALS) {
      const results = allResults.filter(
        (r) => r.interval === intervalConfig.label && r.totalTrades > 0
      );
      const filtered = results.filter((r) => {
        const baseResult = allResults.find(
          (br) => br.pair === r.pair && br.interval === r.interval
        );
        return true;
      });

      const confResults = allResults.filter(
        (r) => r.interval === intervalConfig.label && r.totalTrades > 0
      );

      if (confResults.length === 0) continue;
      const avgWR =
        confResults.reduce((s, r) => s + r.winRate, 0) / confResults.length;
      const avgSharpe =
        confResults.reduce((s, r) => s + r.sharpeRatio, 0) / confResults.length;
      const totalTrades = confResults.reduce((s, r) => s + r.totalTrades, 0);
      console.log(
        `  ${intervalConfig.label}: avgWR=${fmtPct(avgWR).padStart(8)} avgSharpe=${fmtNum(avgSharpe).padStart(7)} totalTrades=${totalTrades}`
      );
    }
  }

  console.log('\n\n');
  console.log('='.repeat(120));
  console.log('BEST & WORST PERFORMERS');
  console.log('='.repeat(120));

  const validResults = allResults.filter((r) => r.totalTrades >= 3);
  if (validResults.length > 0) {
    const sortedByWR = [...validResults].sort((a, b) => b.winRate - a.winRate);
    const sortedBySharpe = [...validResults].sort(
      (a, b) => b.sharpeRatio - a.sharpeRatio
    );
    const sortedByReturn = [...validResults].sort(
      (a, b) => b.totalReturnPct - a.totalReturnPct
    );

    console.log('\nTop 5 by Win Rate:');
    for (const r of sortedByWR.slice(0, 5)) printResult(r);

    console.log('\nBottom 5 by Win Rate:');
    for (const r of sortedByWR.slice(-5)) printResult(r);

    console.log('\nTop 5 by Sharpe Ratio:');
    for (const r of sortedBySharpe.slice(0, 5)) printResult(r);

    console.log('\nBottom 5 by Sharpe Ratio:');
    for (const r of sortedBySharpe.slice(-5)) printResult(r);

    console.log('\nTop 5 by Total Return:');
    for (const r of sortedByReturn.slice(0, 5)) printResult(r);

    console.log('\nBottom 5 by Total Return:');
    for (const r of sortedByReturn.slice(-5)) printResult(r);
  }

  console.log('\n\n');
  console.log('='.repeat(120));
  console.log('AGGREGATE STATS (all pairs, conf >= 0)');
  console.log('='.repeat(120));

  for (const intervalConfig of INTERVALS) {
    const results = allResults.filter(
      (r) => r.interval === intervalConfig.label && r.totalTrades > 0
    );
    if (results.length === 0) continue;

    const totalTrades = results.reduce((s, r) => s + r.totalTrades, 0);
    const totalWins = results.reduce((s, r) => s + r.wins, 0);
    const totalLosses = results.reduce((s, r) => s + r.losses, 0);
    const avgWR = (totalWins / totalTrades) * 100;
    const avgSharpe =
      results.reduce((s, r) => s + r.sharpeRatio, 0) / results.length;
    const avgReturn =
      results.reduce((s, r) => s + r.totalReturnPct, 0) / results.length;
    const avgMaxDD =
      results.reduce((s, r) => s + r.maxDrawdownPct, 0) / results.length;
    const avgEV =
      results.reduce((s, r) => s + r.expectedValuePct, 0) / results.length;
    const avgPF = (() => {
      const tWin = results.reduce(
        (s, r) => s + r.avgWinPct * r.wins,
        0
      );
      const tLoss = results.reduce(
        (s, r) => s + r.avgLossPct * r.losses,
        0
      );
      return tLoss > 0 ? tWin / tLoss : Infinity;
    })();
    const profitablePairs = results.filter(
      (r) => r.totalReturnPct > 0
    ).length;

    console.log(`\n  ${intervalConfig.label}:`);
    console.log(`    Pairs tested:       ${results.length}`);
    console.log(`    Total trades:       ${totalTrades}`);
    console.log(`    Total wins:         ${totalWins}`);
    console.log(`    Total losses:       ${totalLosses}`);
    console.log(`    Aggregate WR:       ${fmtPct(avgWR)}`);
    console.log(`    Avg Sharpe:         ${fmtNum(avgSharpe)}`);
    console.log(`    Avg Return:         ${fmtPct(avgReturn)}`);
    console.log(`    Avg MaxDD:          ${fmtPct(-avgMaxDD)}`);
    console.log(`    Avg EV per trade:   ${fmtPct(avgEV)}`);
    console.log(`    Profit Factor:      ${avgPF === Infinity ? 'INF' : fmtNum(avgPF)}`);
    console.log(`    Profitable pairs:   ${profitablePairs}/${results.length}`);

    const avgBHRet = results.reduce((s, r) => s + r.buyAndHoldReturnPct, 0) / results.length;
    const signalBeatBH = results.filter(r => r.totalReturnPct > r.buyAndHoldReturnPct).length;
    console.log(`    Avg B&H Return:     ${fmtPct(avgBHRet)}`);
    console.log(`    Signal beat B&H:    ${signalBeatBH}/${results.length}`);
  }

  if (errors.length > 0) {
    console.log('\n\nERRORS:');
    for (const e of errors) console.log(e);
  }

  console.log('\n\n');
  console.log('='.repeat(120));
  console.log('MONTE CARLO VALIDATION (Signal vs Random Entries)');
  console.log('='.repeat(120));

  for (const intervalConfig of INTERVALS) {
    console.log(`\n--- ${intervalConfig.label} Monte Carlo (500 simulations per pair) ---`);
    for (const pair of PAIRS) {
      let candles: Candle[];
      try {
        process.stdout.write(`  MC ${pair} ${intervalConfig.label}...`);
        const alreadyFetched = allResults.find(r => r.pair === pair && r.interval === intervalConfig.label);
        if (!alreadyFetched) {
          candles = await fetchKlinesPaged(pair, intervalConfig.interval, 800);
        } else {
          candles = await fetchKlinesPaged(pair, intervalConfig.interval, 800);
        }
        console.log(` loaded ${candles.length} candles`);
      } catch {
        console.log(` SKIP (fetch failed)`);
        continue;
      }

      if (candles.length < 250) continue;

      const mcResult = runMonteCarlo(candles, {
        minConfidence: 0,
        maxLookahead: 50,
        cooldown: 7,
        interval: intervalConfig.label.toLowerCase(),
        barsPerYear: intervalConfig.barsPerYear,
        simulations: 500,
      });

      if (!mcResult) {
        console.log(`  ${pair} ${intervalConfig.label}: insufficient trades for MC`);
        continue;
      }

      console.log(
        `  ${pair.padEnd(10)} ${intervalConfig.label} | ` +
        `Signal: WR=${fmtPct(mcResult.signalWR)} Ret=${fmtPct(mcResult.signalReturn)} Sharpe=${fmtNum(mcResult.signalSharpe)} | ` +
        `Random: WR=${fmtPct(mcResult.randomAvgWR)} Ret=${fmtPct(mcResult.randomAvgReturn)} Sharpe=${fmtNum(mcResult.randomAvgSharpe)} | ` +
        `p=${mcResult.pValue.toFixed(4)} ${mcResult.significant ? '*** SIGNIFICANT' : '(not significant)'}`
      );
    }
  }

  console.log('\n\nDone.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});