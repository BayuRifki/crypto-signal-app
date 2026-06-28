'use client';
import { useState, useMemo } from 'react';
import { Icon } from './Icon';
import { useBacktestWithStatus } from '../lib/hooks/useBacktest';
import type { BacktestOptions } from '../lib/backtest';
import type { SignalWeights } from '../lib/signal';

const fmtPct = (n: number, sign = false) =>
  sign && n > 0 ? `+${n.toFixed(2)}%` : `${n.toFixed(2)}%`;

type Props = {
  candles: { time: number; open: number; high: number; low: number; close: number; volume: number }[];
  symbol: string;
  interval: string;
  weights?: Partial<SignalWeights>;
};

export default function BacktestPanel({ candles, symbol, interval, weights }: Props) {
  const [minConfidence, setMinConfidence] = useState(0);
  const [maxLookahead, setMaxLookahead] = useState(50);
  const [cooldown, setCooldown] = useState(0);
  const [skipRanging, setSkipRanging] = useState(false);

  const options: BacktestOptions = useMemo(
    () => ({ minConfidence, maxLookahead, cooldown, skipRanging, weights }),
    [minConfidence, maxLookahead, cooldown, skipRanging, weights]
  );
  const { result, isRunning, workerAvailable } = useBacktestWithStatus(candles, options);

  if (candles.length < 250) {
    return (
      <div className="card p-5">
        <div className="flex items-center gap-2 text-2xs text-fg-dim uppercase tracking-wider font-bold mb-2">
          <Icon.Activity size={12} />
          <span>Backtest</span>
        </div>
        <div className="text-xs text-fg-muted">
          Need at least 250 candles to backtest. Currently have {candles.length}.
        </div>
      </div>
    );
  }

  if (isRunning && !result) {
    return (
      <div className="card p-5 space-y-3">
        <div className="flex items-center gap-2 text-2xs text-fg-dim uppercase tracking-wider font-bold">
          <Icon.Activity size={12} />
          <span>Backtest · {symbol} · {interval}</span>
        </div>
        <div className="flex items-center gap-3 py-6 justify-center">
          <div className="w-5 h-5 border-2 border-info border-t-transparent rounded-full animate-spin-slow" />
          <div className="text-xs text-fg-muted">
            Running {workerAvailable ? 'in Web Worker' : 'on main thread'}…
          </div>
        </div>
      </div>
    );
  }

  if (!result) return null;

  const m = result.metrics;
  const hasTrades = m.totalTrades > 0;

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-2xs text-fg-dim uppercase tracking-wider font-bold">
          <Icon.Activity size={12} />
          <span>Backtest · {symbol} · {interval}</span>
        </div>
        <div className="flex items-center gap-2">
          {hasTrades && (
            <button
              onClick={() => {
                const header = ['index', 'time', 'action', 'entry', 'stopLoss', 'takeProfit', 'confidence', 'score', 'exitIndex', 'exitTime', 'exitPrice', 'exitReason', 'pnlPct', 'barsHeld'].join(',');
                const rows = result.trades.map((t) => [
                  t.index,
                  new Date(t.time * 1000).toISOString(),
                  t.action,
                  t.entry.toFixed(6),
                  t.stopLoss.toFixed(6),
                  t.takeProfit.toFixed(6),
                  t.confidence,
                  t.score,
                  t.exitIndex,
                  new Date(t.exitTime * 1000).toISOString(),
                  t.exitPrice.toFixed(6),
                  t.exitReason,
                  t.pnlPct.toFixed(4),
                  t.barsHeld,
                ].join(','));
                const csv = [header, ...rows].join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `backtest-${symbol}-${interval}-${Date.now()}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="h-7 px-2 text-2xs rounded bg-bg-elevated border border-line text-fg-muted hover:border-line-strong hover:text-fg transition cursor-pointer"
              title="Export trades to CSV"
            >
              CSV
            </button>
          )}
          <div className="text-2xs text-fg-dim">
            {hasTrades ? `${m.totalTrades} trades · ${result.duration.toFixed(0)}ms` : 'No trades'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-2xs">
        <Field
          label="Min Confidence"
          value={`${minConfidence}%`}
          current={minConfidence}
          options={[
            { label: '0%', value: 0 },
            { label: '40%', value: 40 },
            { label: '60%', value: 60 },
            { label: '80%', value: 80 },
          ]}
          onChange={setMinConfidence}
        />
        <Field
          label="Lookahead"
          value={`${maxLookahead}b`}
          current={maxLookahead}
          options={[
            { label: '20b', value: 20 },
            { label: '50b', value: 50 },
            { label: '100b', value: 100 },
          ]}
          onChange={setMaxLookahead}
        />
        <Field
          label="Cooldown"
          value={`${cooldown === 0 ? 'None' : `${cooldown}b`}`}
          current={cooldown}
          options={[
            { label: 'None', value: 0 },
            { label: '5b', value: 5 },
            { label: '10b', value: 10 },
          ]}
          onChange={setCooldown}
        />
        <button
          onClick={() => setSkipRanging(!skipRanging)}
          aria-pressed={skipRanging}
          aria-label={`Skip ranging regime: ${skipRanging ? 'on' : 'off'}`}
          className={`p-2 rounded border text-left transition cursor-pointer min-h-[44px] ${
            skipRanging
              ? 'bg-info/15 border-info/40 text-info'
              : 'bg-bg-elevated border-line text-fg-muted hover:border-line-strong hover:text-fg'
          }`}
        >
          <div className="text-2xs text-fg-dim">Regime</div>
          <div className="font-bold">{skipRanging ? 'Skip Ranging' : 'All'}</div>
        </button>
      </div>

      {hasTrades ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat
              label="Win Rate"
              value={`${m.winRate.toFixed(1)}%`}
              sub={`${m.wins}W / ${m.losses}L`}
              tone={m.winRate >= 50 ? 'positive' : 'negative'}
            />
            <Stat
              label="Total Return"
              value={fmtPct(m.totalReturnPct, true)}
              sub="cumulative"
              tone={m.totalReturnPct >= 0 ? 'positive' : 'negative'}
            />
            <Stat
              label="Profit Factor"
              value={m.profitFactor === Infinity ? '∞' : m.profitFactor.toFixed(2)}
              sub="W/L ratio"
              tone={m.profitFactor >= 1.5 ? 'positive' : m.profitFactor >= 1 ? 'neutral' : 'negative'}
            />
            <Stat
              label="Sharpe"
              value={m.sharpeRatio.toFixed(2)}
              sub="annualized"
              tone={m.sharpeRatio >= 1 ? 'positive' : m.sharpeRatio >= 0 ? 'neutral' : 'negative'}
            />
            <Stat
              label="Max DD"
              value={`-${m.maxDrawdownPct.toFixed(2)}%`}
              sub="peak-to-trough"
              tone="negative"
            />
            <Stat
              label="Avg Win"
              value={fmtPct(m.avgWinPct, true)}
              tone="positive"
            />
            <Stat
              label="Avg Loss"
              value={fmtPct(-m.avgLossPct)}
              tone="negative"
            />
            <Stat
              label="EV/Trade"
              value={fmtPct(m.expectedValuePct, true)}
              sub={`${m.avgBarsHeld.toFixed(0)} bars avg`}
              tone={m.expectedValuePct >= 0 ? 'positive' : 'negative'}
            />
          </div>

          <EquityCurve points={m.equityCurve} />

          <div className="space-y-2">
            <div className="text-2xs text-fg-dim uppercase tracking-wider font-bold">By Confidence</div>
            <div className="grid grid-cols-4 gap-2">
              {m.byConfidence.map((b) => (
                <div key={b.range} className="p-2 rounded bg-bg-elevated border border-line">
                  <div className="text-2xs text-fg-dim">{b.range}%</div>
                  <div className="text-sm font-bold tabular text-fg">{b.trades}</div>
                  <div className={`text-2xs tabular ${b.winRate >= 50 ? 'text-info' : b.winRate > 0 ? 'text-fg-dim' : 'text-fg-dim'}`}>
                    {b.trades > 0 ? `${b.winRate.toFixed(0)}% win` : '—'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-2xs text-fg-dim uppercase tracking-wider font-bold">By Action</div>
            <div className="grid grid-cols-2 gap-2">
              {m.byAction.map((a) => (
                <div key={a.action} className="p-2 rounded bg-bg-elevated border border-line">
                  <div className="flex items-center justify-between">
                    <div className="text-2xs text-fg-dim">{a.action}</div>
                    <div className={`text-2xs font-bold ${a.action === 'BUY' ? 'text-info' : 'text-warn'}`}>{a.trades}</div>
                  </div>
                  <div className={`text-sm font-bold tabular ${a.avgPnl >= 0 ? 'text-info' : 'text-warn'}`}>
                    {a.trades > 0 ? fmtPct(a.avgPnl, true) : '—'}
                  </div>
                  <div className="text-2xs text-fg-dim tabular">
                    {a.trades > 0 ? `${a.winRate.toFixed(0)}% win` : 'no trades'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-2xs text-fg-dim leading-relaxed border-t border-line pt-3">
            Backtest is a sliding-window replay: at each bar, signal is computed using only past data,
            then forward 1–{maxLookahead} bars to test TP/SL hit. Past performance does not guarantee future results.
            Sample size {m.totalTrades} {m.totalTrades < 30 && '(low — interpret with caution)'}.
          </div>
        </>
      ) : (
        <div className="text-xs text-fg-muted">
          No trades matched the current filters. Try lowering min confidence or disabling regime skip.
        </div>
      )}
    </div>
  );
}

const Field = ({
  label,
  value,
  current,
  options,
  onChange,
}: {
  label: string;
  value: string;
  current: number;
  options: { label: string; value: number }[];
  onChange: (v: number) => void;
}) => (
  <div className="p-2 rounded bg-bg-elevated border border-line">
    <div className="flex items-center justify-between mb-1">
      <span className="text-2xs text-fg-dim">{label}</span>
      <span className="text-2xs font-bold tabular text-fg">{value}</span>
    </div>
    <div className="flex gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={o.value === current}
          className={`flex-1 h-7 text-2xs px-1.5 rounded font-bold tabular transition cursor-pointer ${
            o.value === current
              ? 'bg-info/20 text-info border border-info/40'
              : 'bg-bg-panel text-fg-muted border border-line hover:border-line-strong hover:text-fg'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  </div>
);

const Stat = ({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: 'positive' | 'negative' | 'neutral';
}) => {
  const color = tone === 'positive' ? 'text-info' : tone === 'negative' ? 'text-warn' : 'text-fg';
  return (
    <div className="p-2.5 rounded bg-bg-elevated border border-line">
      <div className="text-2xs text-fg-dim uppercase tracking-wider font-bold">{label}</div>
      <div className={`text-base font-black tabular ${color}`}>{value}</div>
      {sub && <div className="text-2xs text-fg-dim">{sub}</div>}
    </div>
  );
};

const EquityCurve = ({ points }: { points: { t: number; equity: number }[] }) => {
  if (points.length < 2) return null;
  const min = Math.min(...points.map((p) => p.equity));
  const max = Math.max(...points.map((p) => p.equity));
  const range = max - min || 1;
  const W = 100;
  const H = 100;
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * W;
      const y = H - ((p.equity - min) / range) * H;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
  const positive = points[points.length - 1].equity >= points[0].equity;
  const stroke = positive ? '#0ECB81' : '#F6465D';
  const fill = positive ? '#0ECB81' : '#F6465D';
  // Mid-line at 50% height (acts as a baseline reference for break-even)
  const midY = H - ((max - min) / 2 / range) * H;
  // Y-axis: 3 grid lines at min/mid/max
  const gridY = (v: number) => H - ((v - min) / range) * H;
  return (
    <div className="p-2.5 rounded bg-bg-elevated border border-line">
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-2xs text-fg-dim uppercase tracking-wider font-bold">Equity Curve</div>
        <div className="text-2xs text-fg-dim tabular">
          {points[0].equity.toFixed(0)} → {points[points.length - 1].equity.toFixed(0)}
        </div>
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-20 block">
          <defs>
            <linearGradient id="eqfill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={fill} stopOpacity="0.3" />
              <stop offset="100%" stopColor={fill} stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Grid lines: top, mid, bottom */}
          <line x1="0" x2={W} y1={gridY(max)} y2={gridY(max)} stroke="#5E6673" strokeOpacity="0.15" strokeWidth="0.2" vectorEffect="non-scaling-stroke" />
          <line x1="0" x2={W} y1={midY} y2={midY} stroke="#5E6673" strokeOpacity="0.2" strokeDasharray="2 2" strokeWidth="0.2" vectorEffect="non-scaling-stroke" />
          <line x1="0" x2={W} y1={gridY(min)} y2={gridY(min)} stroke="#5E6673" strokeOpacity="0.15" strokeWidth="0.2" vectorEffect="non-scaling-stroke" />
          <path d={`${path} L ${W} ${H} L 0 ${H} Z`} fill="url(#eqfill)" />
          <path d={path} fill="none" stroke={stroke} strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
        </svg>
        {/* Y-axis labels overlay (absolute positioned so they don't scale with viewBox) */}
        <div className="absolute top-0 bottom-0 left-0 w-7 pointer-events-none flex flex-col justify-between text-[9px] text-fg-dim/70 tabular py-px" aria-hidden="true">
          <span>{max.toFixed(0)}</span>
          <span>{((max + min) / 2).toFixed(0)}</span>
          <span>{min.toFixed(0)}</span>
        </div>
        {/* X-axis: first/last time */}
        <div className="flex justify-between text-[9px] text-fg-dim/70 tabular mt-0.5 px-7" aria-hidden="true">
          <span>{new Date(points[0].t * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          <span>{new Date(points[points.length - 1].t * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
        </div>
      </div>
    </div>
  );
};
