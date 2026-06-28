'use client';
import { Icon } from './Icon';
import Tooltip from './Tooltip';
import type { Signal } from '../lib/signal';
import { fmtPrice } from '../lib/utils';

type Props = { signal: Signal | null };

const fmtSigned = (n: number, d = 2) => `${n >= 0 ? '+' : ''}${n.toFixed(d)}`;

const Metric = ({
  label, value, color, hint, children,
}: {
  label: string;
  value: string;
  color?: string;
  hint?: string;
  children: React.ReactNode;
}) => (
  <div>
    <div className="flex justify-between items-baseline mb-1">
      <span className="text-2xs text-fg-dim uppercase tracking-wider font-semibold">{label}</span>
      <span className="text-sm font-mono font-bold tabular" style={{ color: color || '#e2e8f0' }}>{value}</span>
    </div>
    {children}
    {hint && <div className="text-2xs text-fg-dim mt-1">{hint}</div>}
  </div>
);

const Bar = ({ pct, color, zones }: { pct: number; color: string; zones?: { from: number; to: number; color: string }[] }) => (
  <div className="h-1.5 bg-bg-base rounded-full relative overflow-hidden">
    {zones?.map((z, i) => (
      <div
        key={i}
        className="absolute top-0 bottom-0"
        style={{
          left: `${z.from}%`,
          width: `${z.to - z.from}%`,
          background: z.color,
          opacity: 0.15,
        }}
      />
    ))}
    <div className="absolute top-0 bottom-0 left-0 rounded-full" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
  </div>
);

const CenteredBar = ({ value, max, color }: { value: number; max: number; color: string }) => {
  const pct = Math.min(50, (Math.abs(value) / max) * 50);
  return (
    <div className="h-1.5 bg-bg-base rounded-full relative">
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-line-strong" />
      <div
        className="absolute top-0 bottom-0 rounded-full"
        style={{
          width: `${pct}%`,
          background: color,
          ...(value >= 0 ? { left: '50%' } : { right: '50%' }),
        }}
      />
    </div>
  );
};

export default function IndicatorPanel({ signal }: Props) {
  if (!signal) {
    return (
      <div className="card p-5">
        <div className="flex items-center gap-2 text-sm text-fg-dim mb-3">
          <Icon.Activity size={14} />
          <span>Loading indicators…</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i}>
              <div className="shimmer h-2.5 w-12 rounded mb-1.5" />
              <div className="shimmer h-1.5 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const rsi = signal.rsiValue;
  const rsiColor = rsi === null ? 'var(--color-fg-muted)' : rsi > 70 ? 'var(--color-warn)' : rsi < 30 ? 'var(--color-accent)' : 'var(--color-info)';
  const rsiZones = [{ from: 0, to: 30, color: 'var(--color-accent)' }, { from: 70, to: 100, color: 'var(--color-warn)' }];

  const bb = signal.bbPos;
  const bbColor = bb === null ? 'var(--color-fg-muted)' : bb < 20 ? 'var(--color-accent)' : bb > 80 ? 'var(--color-warn)' : 'var(--color-info)';
  const macdHist = signal.macdHist;
  const macdColor = (macdHist ?? 0) > 0 ? 'var(--color-info)' : 'var(--color-warn)';
  const cvdColor = signal.cvdSlope >= 0 ? 'var(--color-info)' : 'var(--color-warn)';
  const rvol = signal.rvol;
  const rvolColor = (rvol ?? 0) >= 1.5 ? 'var(--color-buy)' : (rvol ?? 0) < 0.7 ? 'var(--color-warn)' : 'var(--color-hold)';

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 text-2xs text-fg-dim uppercase tracking-wider font-bold mb-4">
        <Icon.Activity size={12} />
        <span>Live Indicators</span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-4">
        <Metric
          label="RSI"
          value={rsi === null ? '-' : rsi.toFixed(0)}
          color={rsiColor}
          hint={rsi === null ? 'Waiting' : rsi > 70 ? 'Overbought' : rsi < 30 ? 'Oversold' : 'Neutral'}
        >
          <Bar pct={rsi ?? 0} color={rsiColor} zones={rsiZones} />
          <div className="flex justify-between text-[9px] text-fg-dim/70 tabular mt-0.5 px-px" aria-hidden="true">
            <span>0</span>
            <span>30</span>
            <span>50</span>
            <span>70</span>
            <span>100</span>
          </div>
        </Metric>

        <Metric
          label="BB Pos"
          value={bb === null ? '-' : `${bb.toFixed(0)}%`}
          color={bbColor}
          hint={bb === null ? 'No data' : bb < 20 ? 'Lower band' : bb > 80 ? 'Upper band' : 'Mid range'}
        >
          <Bar pct={bb ?? 0} color={bbColor} />
        </Metric>

        <Metric
          label="MACD"
          value={macdHist === null ? '-' : fmtSigned(macdHist, Math.abs(macdHist) > 10 ? 1 : 2)}
          color={macdColor}
          hint={macdHist === null ? 'No data' : macdHist > 0 ? 'Bullish' : 'Bearish'}
        >
          <CenteredBar value={macdHist ?? 0} max={Math.max(0.1, Math.abs(macdHist ?? 0) * 2)} color={macdColor} />
        </Metric>

        <Metric
          label="CVD"
          value={fmtSigned(signal.cvdSlope, Math.abs(signal.cvdSlope) < 0.01 ? 4 : 2)}
          color={cvdColor}
          hint={signal.cvdSlope >= 0 ? 'Net buying' : 'Net selling'}
        >
          <CenteredBar value={signal.cvdSlope} max={Math.max(0.1, Math.abs(signal.cvdSlope) * 2)} color={cvdColor} />
        </Metric>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-4 mt-4 border-t border-line">
        <Tooltip label="EMA 50 (medium-term trend)">
          <div className="cursor-help hover:bg-bg-panel rounded -m-1 p-1 transition">
            <div className="text-2xs text-fg-dim uppercase tracking-wider font-semibold">EMA 50</div>
            <div className="text-base font-mono font-bold text-warn tabular mt-0.5">{fmtPrice(signal.ema50)}</div>
          </div>
        </Tooltip>
        <Tooltip label="EMA 200 (long-term trend)">
          <div className="cursor-help hover:bg-bg-panel rounded -m-1 p-1 transition">
            <div className="text-2xs text-fg-dim uppercase tracking-wider font-semibold">EMA 200</div>
            <div className="text-base font-mono font-bold text-accent tabular mt-0.5">{fmtPrice(signal.ema200)}</div>
          </div>
        </Tooltip>
      </div>

      <div className="flex items-center justify-between pt-3 mt-3 border-t border-line text-xs">
        <Tooltip label="ADX: Average Directional Index · ≥25 trending, <20 ranging">
          <span className="text-fg-dim cursor-help">ADX (14)</span>
        </Tooltip>
        <span className="font-mono font-bold tabular">
              <span style={{ color: signal.adx === null ? 'var(--color-fg-muted)' : signal.adx >= 25 ? 'var(--color-accent)' : signal.adx < 20 ? 'var(--color-warn)' : 'var(--color-hold)' }}>
            {signal.adx === null ? '-' : signal.adx.toFixed(0)}
          </span>
          {signal.adx !== null && (
            <span className="text-2xs text-fg-dim ml-1.5">
              · {signal.regime === 'trending' ? (signal.regimeBias === 'bullish' ? '↑' : '↓') : signal.regime === 'ranging' ? '⊥' : '→'}
            </span>
          )}
        </span>
      </div>

      <div className="flex items-center justify-between pt-2 text-xs">
        <Tooltip label="Relative Volume: current vs 20-period average">
          <span className="text-fg-dim cursor-help">RVOL (20)</span>
        </Tooltip>
        <span className="font-mono font-bold tabular" style={{ color: rvolColor }}>
          {rvol === null ? '-' : `${rvol.toFixed(2)}x`}
        </span>
      </div>
    </div>
  );
}
