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
    <div className="flex justify-between items-baseline mb-0.5">
      <span className="text-[10px] text-fg-dim uppercase tracking-wider font-semibold">{label}</span>
      <span className="text-xs font-mono font-bold tabular" style={{ color: color || '#EAECEF' }}>{value}</span>
    </div>
    {children}
    {hint && <div className="text-[9px] text-fg-dim mt-0.5">{hint}</div>}
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
          opacity: 0.12,
        }}
      />
    ))}
    <div className="absolute top-0 bottom-0 left-0 rounded-full transition-all duration-300" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
  </div>
);

const CenteredBar = ({ value, max, color }: { value: number; max: number; color: string }) => {
  const pct = Math.min(50, (Math.abs(value) / max) * 50);
  return (
    <div className="h-1.5 bg-bg-base rounded-full relative">
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-line-strong/40" />
      <div
        className="absolute top-0 bottom-0 rounded-full transition-all duration-300"
        style={{
          width: `${Math.max(1, pct)}%`,
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
      <div className="card p-3">
        <div className="flex items-center gap-1.5 text-2xs text-fg-dim mb-2">
          <Icon.Activity size={11} />
          <span>Loading indicators…</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i}>
              <div className="shimmer h-2 w-10 rounded mb-1" />
              <div className="shimmer h-1.5 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const rsi = signal.rsiValue;
  const rsiColor = rsi === null ? '#848E9C' : rsi > 70 ? '#F0B90B' : rsi < 30 ? '#6366F1' : '#3B82F6';
  const rsiZones = [{ from: 0, to: 30, color: '#6366F1' }, { from: 70, to: 100, color: '#F0B90B' }];

  const bb = signal.bbPos;
  const bbColor = bb === null ? '#848E9C' : bb < 20 ? '#6366F1' : bb > 80 ? '#F0B90B' : '#3B82F6';
  const macdHist = signal.macdHist;
  const macdColor = (macdHist ?? 0) > 0 ? '#3B82F6' : '#F0B90B';
  const cvdColor = signal.cvdSlope >= 0 ? '#3B82F6' : '#F0B90B';
  const rvol = signal.rvol;
  const rvolColor = (rvol ?? 0) >= 1.5 ? '#0ECB81' : (rvol ?? 0) < 0.7 ? '#F0B90B' : '#848E9C';

  return (
    <div className="card px-4 py-3">
      <div className="flex items-center gap-1.5 label-caps mb-3">
        <Icon.Activity size={10} />
        <span>Live Indicators</span>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-3">
        <Metric
          label="RSI"
          value={rsi === null ? '-' : rsi.toFixed(0)}
          color={rsiColor}
          hint={rsi === null ? 'Waiting' : rsi > 70 ? 'Overbought' : rsi < 30 ? 'Oversold' : 'Neutral'}
        >
          <Bar pct={rsi ?? 0} color={rsiColor} zones={rsiZones} />
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

      <div className="grid grid-cols-2 gap-x-3 gap-y-2 pt-3 mt-3 border-t border-line">
        <Tooltip label="EMA 50 (medium-term trend)">
          <div className="cursor-help">
            <div className="text-[10px] text-fg-dim uppercase tracking-wider font-semibold">EMA 50</div>
            <div className="text-sm font-mono font-bold text-warn tabular">{fmtPrice(signal.ema50)}</div>
          </div>
        </Tooltip>
        <Tooltip label="EMA 200 (long-term trend)">
          <div className="cursor-help">
            <div className="text-[10px] text-fg-dim uppercase tracking-wider font-semibold">EMA 200</div>
            <div className="text-sm font-mono font-bold text-accent tabular">{fmtPrice(signal.ema200)}</div>
          </div>
        </Tooltip>
      </div>

      <div className="flex items-center justify-between pt-2 mt-2 border-t border-line text-2xs">
        <Tooltip label="ADX: Average Directional Index">
          <span className="text-fg-dim cursor-help">ADX (14)</span>
        </Tooltip>
        <span className="font-mono font-bold tabular">
          <span style={{ color: signal.adx === null ? '#848E9C' : signal.adx >= 25 ? '#6366F1' : signal.adx < 20 ? '#F0B90B' : '#848E9C' }}>
            {signal.adx === null ? '-' : signal.adx.toFixed(0)}
          </span>
          {signal.adx !== null && (
            <span className="text-[9px] text-fg-dim ml-1">
              {signal.regime === 'trending' ? (signal.regimeBias === 'bullish' ? '↑' : '↓') : signal.regime === 'ranging' ? '⊥' : '→'}
            </span>
          )}
        </span>
      </div>

      <div className="flex items-center justify-between pt-1.5 text-2xs">
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
