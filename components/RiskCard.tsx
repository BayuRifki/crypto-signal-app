'use client';
import { Icon } from './Icon';
import { fmt, fmtPrice } from '../lib/utils';
import type { Signal } from '../lib/signal';

type Props = { signal: Signal | null };

export default function RiskCard({ signal }: Props) {
  if (!signal) {
    return (
      <div className="card p-5">
        <div className="shimmer h-3 w-32 rounded mb-3" />
        <div className="shimmer h-12 rounded" />
      </div>
    );
  }

  const isLong = signal.action === 'BUY';
  const isShort = signal.action === 'SELL';
  const distToSL = isShort ? ((signal.risk.stopLoss - signal.price) / signal.price) * 100 : ((signal.price - signal.risk.stopLoss) / signal.price) * 100;
  const distToTP = isShort ? ((signal.price - signal.risk.takeProfit) / signal.price) * 100 : ((signal.risk.takeProfit - signal.price) / signal.price) * 100;
  const slSourceLabel = signal.risk.slSource === 'sr' ? 'S/R' : signal.risk.slSource === 'atr' ? 'ATR' : '—';
  const tpSourceLabel = signal.risk.tpSource === 'sr' ? 'S/R' : signal.risk.tpSource === 'atr' ? 'ATR' : '—';
  const rrWarn = signal.risk.rr < 1.2;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-2xs text-fg-dim uppercase tracking-wider font-bold">
          <Icon.Shield size={12} />
          <span>Risk Plan</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xs text-fg-dim">R:R</span>
          <span className={`text-sm font-bold tabular ${rrWarn ? 'text-warn' : 'text-fg'}`}>1:{signal.risk.rr.toFixed(2)}</span>
        </div>
      </div>

      <div className="space-y-2">
        <Row label="Entry" value={fmtPrice(signal.price)} accent="text-fg" />
        <Row
          label={isLong || isShort ? 'Stop Loss' : 'Ref SL'}
          value={fmtPrice(signal.risk.stopLoss)}
          sub={`${distToSL >= 0 ? '+' : ''}${distToSL.toFixed(2)}% · ${slSourceLabel}`}
          accent="text-sell"
        />
        <Row
          label={isLong || isShort ? 'Take Profit' : 'Ref TP'}
          value={fmtPrice(signal.risk.takeProfit)}
          sub={`${distToTP >= 0 ? '+' : ''}${distToTP.toFixed(2)}% · ${tpSourceLabel}`}
          accent="text-buy"
        />
        <Row
          label="Risk per unit"
          value={fmtPrice(Math.abs(signal.price - signal.risk.stopLoss))}
          sub={`ATR ${fmt(signal.risk.atr)}`}
          accent="text-fg-muted"
        />
      </div>

      <div className="divider my-3" />

      <div className="flex justify-between text-2xs">
        <span className="text-fg-dim">ATR (vol)</span>
        <span className="font-mono tabular text-fg-muted">{fmt(signal.risk.atr)}</span>
      </div>

      {(isLong || isShort) && (signal.risk.slSource === 'sr' || signal.risk.tpSource === 'sr') && (
        <div className="mt-2 text-2xs text-fg-dim leading-relaxed">
          {signal.risk.slSource === 'sr' && signal.risk.tpSource === 'sr'
            ? 'SL & TP anchored to nearest S/R levels.'
            : signal.risk.slSource === 'sr'
            ? 'SL anchored to nearest support/resistance.'
            : 'TP anchored to nearest support/resistance.'}
        </div>
      )}
    </div>
  );
}

const Row = ({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: string }) => (
  <div className="flex items-center justify-between">
    <span className="text-2xs text-fg-dim">{label}</span>
    <div className="flex items-baseline gap-2">
      <span className={`text-sm font-bold tabular ${accent}`}>{value}</span>
      {sub && <span className="text-2xs text-fg-dim tabular">{sub}</span>}
    </div>
  </div>
);
