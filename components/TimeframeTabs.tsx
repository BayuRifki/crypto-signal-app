'use client';
import type { Interval } from '../lib/exchanges/types';

const TFS: { value: Interval; label: string; sub: string }[] = [
  { value: '1m', label: '1m', sub: 'Scalp' },
  { value: '5m', label: '5m', sub: 'Fast' },
  { value: '15m', label: '15m', sub: 'Intraday' },
  { value: '1h', label: '1H', sub: 'Swing' },
  { value: '4h', label: '4H', sub: 'Position' },
  { value: '1d', label: '1D', sub: 'Trend' },
];

type Props = {
  value: Interval;
  onChange: (i: Interval) => void;
};

export default function TimeframeTabs({ value, onChange }: Props) {
  return (
    <div className="flex bg-bg-elevated border border-line rounded-md p-0.5 overflow-x-auto scrollbar-none">
      {TFS.map((tf) => {
        const active = tf.value === value;
        return (
          <button
            key={tf.value}
            onClick={() => onChange(tf.value)}
            title={tf.sub}
            className={`relative flex flex-col items-center justify-center min-w-[44px] px-2.5 py-1 rounded transition focus-ring ${
              active ? 'bg-bg-card text-fg shadow-soft' : 'text-fg-muted hover:text-fg'
            }`}
          >
            <span className="text-xs font-bold leading-none tabular">{tf.label}</span>
            <span className={`text-[8px] uppercase tracking-wider leading-none mt-0.5 ${active ? 'text-fg-dim' : 'opacity-0'}`}>
              {tf.sub}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export const ALL_TIMEFRAMES: Interval[] = TFS.map((t) => t.value);
export const KEY_TIMEFRAMES: Interval[] = ['15m', '1h', '4h', '1d'];
