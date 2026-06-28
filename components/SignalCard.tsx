'use client';
import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import Tooltip from './Tooltip';
import type { Signal, SignalComponents } from '../lib/signal';
import { fmtPrice } from '../lib/utils';

type Props = { signal: Signal | null };

type Group = { key: 'trend' | 'momentum' | 'structure'; label: string; icon: React.ReactNode; keys: (keyof SignalComponents)[] };

const GROUPS: Group[] = [
  { key: 'trend', label: 'Trend', icon: <Icon.TrendUp size={12} />, keys: ['ema', 'trend', 'bb', 'sr'] },
  { key: 'momentum', label: 'Momentum', icon: <Icon.Activity size={12} />, keys: ['rsi', 'macd', 'volume', 'orderBlock'] },
  { key: 'structure', label: 'Structure', icon: <Icon.Layers size={12} />, keys: ['fvg', 'marketStructure', 'liquiditySweep'] },
];

const sumGroup = (c: SignalComponents, keys: (keyof SignalComponents)[]) =>
  keys.reduce((acc, k) => acc + (c[k] || 0), 0);

const CategoryBar = ({ value, max }: { value: number; max: number }) => {
  const pct = Math.min(100, (Math.abs(value) / max) * 100);
  return (
    <div className="h-2 bg-bg-base rounded-full relative overflow-hidden">
      <div className="absolute top-0 bottom-0 left-1/2 w-px bg-line-strong/60" />
      <div
        className={`absolute top-0 bottom-0 rounded-full transition-all duration-300 ${value >= 0 ? 'bg-buy' : 'bg-sell'}`}
        style={{
          width: `${Math.max(2, pct / 2)}%`,
          ...(value >= 0 ? { left: '50%' } : { right: '50%' }),
        }}
      />
    </div>
  );
};

export default function SignalCard({ signal }: Props) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(false);
  }, [signal]);

  if (!signal) {
    return (
      <div className="card p-5">
        <div className="flex items-center gap-2 text-sm text-fg-dim">
          <div className="w-2 h-2 rounded-full bg-info animate-pulse-soft" />
          <span className="label-caps text-xs">Computing signal</span>
        </div>
        <div className="mt-4 space-y-2">
          <div className="shimmer h-12 rounded-md" />
          <div className="shimmer h-3 rounded-md w-2/3" />
          <div className="shimmer h-3 rounded-md w-1/2" />
        </div>
      </div>
    );
  }

  const action = signal.action;
  const actionMeta = {
    BUY: { color: 'text-buy', bg: 'bg-buy-soft', border: 'border-buy/30', glow: 'glow-buy', icon: <Icon.TrendUp size={20} />, advice: 'Look for long entries. Confirm with multi-TF alignment.' },
    SELL: { color: 'text-sell', bg: 'bg-sell-soft', border: 'border-sell/30', glow: 'glow-sell', icon: <Icon.TrendDown size={20} />, advice: 'Consider short or trim positions. Wait for confirmation.' },
    HOLD: { color: 'text-hold', bg: 'bg-hold-soft', border: 'border-hold/30', glow: '', icon: <Icon.Clock size={20} />, advice: 'No clear edge. Wait for stronger confluence.' },
  }[action];

  const confidenceColor = signal.confidence >= 70
    ? 'text-buy'
    : signal.confidence >= 40
      ? 'text-warn'
      : signal.confidence >= 20
        ? 'text-fg-muted'
        : 'text-sell';
  const topReasons = expanded ? signal.reasons : signal.reasons.slice(0, 4);
  const regimeLabel = signal.adx === null ? '—' : signal.regime === 'ranging' ? 'RANGING' : signal.regime === 'trending' ? `TREND ${signal.regimeBias === 'bullish' ? '↑' : signal.regimeBias === 'bearish' ? '↓' : '·'}` : 'TRANSITION';
  const regimeColor = signal.regime === 'ranging' ? 'bg-warn-soft text-warn border-warn/30' : signal.regime === 'trending' ? 'bg-info-soft text-info border-info/30' : 'bg-bg-panel text-fg-muted border-line';
  const hasDiv = signal.rsiDivergence || signal.macdDivergence;
  const hasPoc = signal.pocNear;

  return (
    <div className={`card overflow-hidden border ${actionMeta.border} ${actionMeta.glow}`}>
      <div className={`${actionMeta.bg} px-4 py-3 border-b ${actionMeta.border}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-2xs text-fg-dim label-caps mb-1">
              <Icon.Zap size={10} />
              <span>Signal</span>
              <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${regimeColor}`}>{regimeLabel}</span>
              {hasDiv && (
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold border bg-sell-soft text-sell border-sell/30">DIV</span>
              )}
              {hasPoc && (
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold border bg-info-soft text-info border-info/30">POC</span>
              )}
              {signal.degraded && (
                <span
                  className="px-1.5 py-0.5 rounded-full text-[9px] font-bold border bg-warn-soft text-warn border-warn/30"
                  title={`Degraded: ${signal.degradedIndicators.length} indicator(s) failed — ${signal.degradedIndicators.slice(0, 5).join(', ')}`}
                >
                  DEG · {signal.degradedIndicators.length}
                </span>
              )}
            </div>
            <div className={`flex items-center gap-1.5 ${actionMeta.color}`}>
              {actionMeta.icon}
              <span className="text-2xl font-black tracking-tight">{action}</span>
            </div>
            <div className="text-2xs text-fg-muted mt-1 leading-relaxed">{actionMeta.advice}</div>
          </div>
          <div className="text-right">
            <div className="label-caps">Confidence</div>
            <div className={`text-xl font-black font-mono tabular mt-0.5 ${confidenceColor}`}>{signal.confidence}%</div>
          </div>
        </div>

        <div className="mt-3">
          <div className="flex justify-between text-2xs text-fg-dim mb-1 label-caps">
            <span>Score</span>
            <span className="font-mono text-fg">{signal.score > 0 ? '+' : ''}{signal.score} / 100</span>
          </div>
          <div className="h-2 bg-bg-base rounded-full relative overflow-hidden">
            <div className="absolute top-0 bottom-0 left-1/2 w-px bg-line-strong/60" />
            <div
              className={`absolute top-0 bottom-0 ${signal.score >= 0 ? 'bg-buy' : 'bg-sell'} rounded-full transition-all duration-300`}
              style={{
                width: `${Math.abs(signal.score) / 2}%`,
                ...(signal.score >= 0 ? { left: '50%' } : { right: '50%' }),
              }}
            />
          </div>
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="label-caps">Category Breakdown</div>
          </div>
          <div className="space-y-2.5">
            {GROUPS.map((g) => {
              const total = sumGroup(signal.components, g.keys);
              return (
                <div key={g.key}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 text-xs text-fg-muted">
                      {g.icon}
                      <span className="font-semibold">{g.label}</span>
                      <span className="text-fg-dim">· {g.keys.length}</span>
                    </div>
                    <span className={`text-xs mono tabular font-bold ${total > 0 ? 'text-buy' : total < 0 ? 'text-sell' : 'text-fg-dim'}`}>
                      {total > 0 ? '+' : ''}{total}
                    </span>
                  </div>
                  <CategoryBar value={total} max={50} />
                </div>
              );
            })}
          </div>
        </div>

        {topReasons.length > 0 && (
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="label-caps">Why</div>
              {signal.reasons.length > 4 && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="text-[9px] text-info hover:text-fg transition label-caps cursor-pointer"
                  aria-expanded={expanded}
                >
                  {expanded ? 'Less' : `All (${signal.reasons.length})`}
                </button>
              )}
            </div>
            <ul className="space-y-1">
              {topReasons.map((r, i) => (
                <li key={i} className="flex items-start gap-1.5 text-2xs text-fg-muted leading-relaxed">
                  <span className="mt-1 w-1 h-1 rounded-full flex-shrink-0 bg-fg-dim" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-line">
          <span className="label-caps">Entry ref</span>
          <span className="font-mono text-fg font-bold text-sm tabular">{fmtPrice(signal.price)}</span>
        </div>
      </div>
    </div>
  );
}
