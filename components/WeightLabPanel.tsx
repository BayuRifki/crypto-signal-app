'use client';
import { useMemo, useState } from 'react';
import { useWeightLab } from '../lib/hooks/useWeightLab';
import { Icon } from './Icon';
import type { WeightKey } from '../lib/weightOptimizer';
import type { Candle } from '../lib/utils';

const fmtPct = (n: number, sign = false) =>
  (sign && n > 0 ? '+' : '') + n.toFixed(2) + '%';

const fmtNum = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : '—');

const WEIGHT_ORDER: WeightKey[] = [
  'bb', 'rsi', 'macd', 'sr', 'fvg', 'ema',
  'volume', 'orderBlock', 'marketStructure', 'liquiditySweep',
  'trend', 'divergence',
];

type Props = {
  candles: Candle[];
};

export default function WeightLabPanel({ candles }: Props) {
  const lab = useWeightLab();
  const [expanded, setExpanded] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const hasResult = lab.lastResult !== null;
  const canOptimize = candles.length >= 250 && !lab.isRunning;

  const baselineMetrics = useMemo(() => {
    if (!lab.lastResult?.best?.metrics) return null;
    const m = lab.lastResult.best.metrics;
    const base = lab.lastResult.baselineFitness;
    return { metrics: m, baselineFitness: base };
  }, [lab.lastResult]);

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-2xs text-fg-dim uppercase tracking-wider font-bold">
          <Icon.Box size={12} />
          <span>Weight Lab</span>
        </div>
        <div className="flex items-center gap-2">
          <ModeBadge isCustom={lab.isCustom} isOptimized={lab.isOptimized} savedAt={lab.savedAt} />
        </div>
      </div>

      {lab.error && (
        <div className="text-2xs text-sell bg-sell/10 border border-sell/30 rounded p-2">{lab.error}</div>
      )}

      {/* Run optimize */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => lab.optimize(candles)}
          disabled={!canOptimize}
          className={`text-xs px-3 py-1.5 rounded font-bold border transition ${
            canOptimize
              ? 'bg-info/15 border-info/40 text-info hover:bg-info/25'
              : 'bg-bg-elevated border-line text-fg-dim cursor-not-allowed'
          }`}
        >
          {lab.isRunning ? (
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 border-2 border-info border-t-transparent rounded-full animate-spin-slow" />
              Optimizing…
            </span>
          ) : (
            'Run Genetic Optimize'
          )}
        </button>
        {lab.progress && (
          <div className="text-2xs text-fg-dim">
            gen {lab.progress.generation}/{lab.progress.total}
          </div>
        )}
        {hasResult && lab.lastResult && (
          <div className="text-2xs text-fg-dim">
            best <span className="text-fg font-bold tabular">{fmtNum(lab.lastResult.best.fitness)}</span>
            {' · '}baseline <span className="tabular">{fmtNum(lab.lastResult.baselineFitness)}</span>
            {' · '}
            <span className={lab.lastResult.improvement >= 0 ? 'text-buy' : 'text-sell'}>
              {fmtPct(lab.lastResult.improvement * 100, true)}
            </span>
            {' · '}{(lab.lastResult.durationMs / 1000).toFixed(1)}s
          </div>
        )}
        <div className="flex-1" />
        <button
          onClick={() => setShowAdvanced((v) => !v)}
          className="text-2xs px-2 py-1 rounded text-fg-muted hover:text-fg"
        >
          {showAdvanced ? 'Hide' : 'Show'} Advanced
        </button>
      </div>

      {/* History chart */}
      {hasResult && lab.lastResult && lab.lastResult.history.length > 1 && (
        <div className="p-2.5 rounded bg-bg-elevated border border-line">
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-2xs text-fg-dim uppercase tracking-wider font-bold">Fitness History</div>
            <div className="text-2xs text-fg-dim flex items-center gap-2">
              <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-info" />best</span>
              <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-fg-dim opacity-50" />mean</span>
            </div>
          </div>
          <HistoryChart
            history={lab.lastResult.history}
            baseline={lab.lastResult.baselineFitness}
          />
        </div>
      )}

      {showAdvanced && hasResult && lab.lastResult && lab.lastResult.topIndividuals.length > 0 && (
        <div className="p-2.5 rounded bg-bg-elevated border border-line space-y-2">
          <div className="text-2xs text-fg-dim uppercase tracking-wider font-bold">Top Candidates</div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-none">
            {lab.lastResult.topIndividuals.map((ind, i) => {
              const total = Object.values(ind.weights).reduce((a, b) => a + b, 0).toFixed(0);
              return (
                <button
                  key={i}
                  onClick={() => lab.applyResult(ind as any)}
                  className="w-full text-left p-1.5 rounded bg-bg-panel hover:bg-bg-hover border border-line text-2xs flex items-center gap-2 transition"
                >
                  <span className={`w-5 h-5 inline-flex items-center justify-center rounded font-bold ${i === 0 ? 'bg-buy/20 text-buy' : 'bg-bg-elevated text-fg-dim'}`}>#{i + 1}</span>
                  <span className="font-bold tabular text-fg">{fmtNum(ind.fitness)}</span>
                  <span className="text-fg-dim">· {ind.weights.bb.toFixed(1)}/{ind.weights.rsi.toFixed(1)}/{ind.weights.macd.toFixed(1)}/{ind.weights.sr.toFixed(1)}</span>
                  <span className="text-fg-dim">· {ind.weights.trend.toFixed(1)}/{ind.weights.divergence.toFixed(1)}</span>
                  <span className="flex-1" />
                  <span className="text-fg-dim tabular">Σ={total}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Sliders */}
      <div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1.5 text-2xs text-fg-dim uppercase tracking-wider font-bold hover:text-fg transition"
        >
          <Icon.Chevron size={10} className={`transition ${expanded ? 'rotate-0' : '-rotate-90'}`} />
          <span>Component Weights ({WEIGHT_ORDER.length})</span>
        </button>
        {expanded && (
          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
            {WEIGHT_ORDER.map((k) => (
              <WeightSlider
                key={k}
                weightKey={k}
                label={lab.WEIGHT_LABELS[k]}
                value={lab.weights[k]}
                defaultValue={lab.baselineWeights[k]}
                onChange={(v) => lab.setWeight(k, v)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-line">
        <button
          onClick={lab.save}
          className="text-2xs px-2.5 py-1 rounded bg-buy/15 border border-buy/30 text-buy hover:bg-buy/25 font-bold"
        >
          Save
        </button>
        <button
          onClick={lab.resetToDefault}
          className="text-2xs px-2.5 py-1 rounded bg-bg-elevated border border-line text-fg-muted hover:border-line-strong"
        >
          Reset to Default
        </button>
        <button
          onClick={lab.clear}
          className="text-2xs px-2.5 py-1 rounded bg-bg-elevated border border-line text-fg-muted hover:border-sell/40 hover:text-sell"
        >
          Clear Saved
        </button>
        <div className="flex-1" />
        {baselineMetrics && (
          <div className="text-2xs text-fg-dim">
            Last run trades: <span className="text-fg font-bold">{baselineMetrics.metrics.totalTrades}</span>
            {' · '}WR <span className="text-fg font-bold">{baselineMetrics.metrics.winRate.toFixed(0)}%</span>
            {' · '}PF <span className="text-fg font-bold">{fmtNum(baselineMetrics.metrics.profitFactor)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

const ModeBadge = ({
  isCustom,
  isOptimized,
  savedAt,
}: {
  isCustom: boolean;
  isOptimized: boolean;
  savedAt: number | null;
}) => {
  if (isCustom && isOptimized) {
    return (
      <span className="text-2xs px-1.5 py-0.5 rounded bg-accent/15 border border-accent/30 text-accent font-bold">
        OPTIMIZED · SAVED
      </span>
    );
  }
  if (isCustom) {
    return <span className="text-2xs px-1.5 py-0.5 rounded bg-info/15 border border-info/30 text-info font-bold">CUSTOM</span>;
  }
  if (savedAt) {
    return <span className="text-2xs px-1.5 py-0.5 rounded bg-bg-elevated border border-line text-fg-dim">DEFAULT · saved {new Date(savedAt).toLocaleTimeString()}</span>;
  }
  return <span className="text-2xs px-1.5 py-0.5 rounded bg-bg-elevated border border-line text-fg-dim">DEFAULT</span>;
};

const WeightSlider = ({
  weightKey,
  label,
  value,
  defaultValue,
  onChange,
}: {
  weightKey: WeightKey;
  label: string;
  value: number;
  defaultValue: number;
  onChange: (v: number) => void;
}) => {
  const min = defaultValue * 0.5;
  const max = defaultValue * 1.5;
  const delta = value - defaultValue;
  const deltaPct = defaultValue > 0 ? (delta / defaultValue) * 100 : 0;
  const tone = Math.abs(delta) < 1e-6 ? 'text-fg-dim' : delta > 0 ? 'text-buy' : 'text-sell';
  const fillPct = ((value - min) / (max - min)) * 100;

  return (
    <div className="p-2 rounded bg-bg-elevated border border-line">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className="text-2xs text-fg font-bold">{label}</span>
          <span className="text-2xs text-fg-dim">({weightKey})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-2xs text-fg-dim tabular">{defaultValue.toFixed(0)}</span>
          <span className="text-2xs text-fg-dim">→</span>
          <span className="text-xs font-bold tabular text-fg">{value.toFixed(1)}</span>
          <span className={`text-2xs tabular ${tone}`}>
            {delta > 0 ? '+' : ''}{delta.toFixed(1)} ({deltaPct > 0 ? '+' : ''}{deltaPct.toFixed(0)}%)
          </span>
        </div>
      </div>
      <div className="relative">
        <div className="absolute inset-0 h-1.5 top-1/2 -translate-y-1/2 rounded bg-bg-panel" />
        <div
          className="absolute h-1.5 top-1/2 -translate-y-1/2 rounded bg-info/40"
          style={{ width: `${fillPct}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={0.5}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="relative w-full h-3 bg-transparent appearance-none cursor-pointer"
        />
      </div>
    </div>
  );
};

const HistoryChart = ({
  history,
  baseline,
}: {
  history: { generation: number; bestFitness: number; meanFitness: number }[];
  baseline: number;
}) => {
  const all = history.flatMap((h) => [h.bestFitness, h.meanFitness, baseline]).filter((v) => Number.isFinite(v));
  if (all.length === 0) return null;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const range = max - min || 1;
  const W = 100;
  const H = 40;
  const yOf = (v: number) => H - ((v - min) / range) * H;
  const xOf = (i: number) => (i / Math.max(1, history.length - 1)) * W;

  const bestPath = history.map((h, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i).toFixed(2)} ${yOf(h.bestFitness).toFixed(2)}`).join(' ');
  const meanPath = history.map((h, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i).toFixed(2)} ${yOf(h.meanFitness).toFixed(2)}`).join(' ');
  const baselineY = yOf(baseline);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-16">
      <line x1={0} x2={W} y1={baselineY} y2={baselineY} stroke="var(--color-warn)" strokeWidth="0.4" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
      <path d={meanPath} fill="none" stroke="var(--color-fg-muted)" strokeOpacity="0.4" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
      <path d={bestPath} fill="none" stroke="var(--color-info)" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
    </svg>
  );
};
