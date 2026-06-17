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
  const handleKeyDown = (e: React.KeyboardEvent, tf: Interval) => {
    const idx = TFS.findIndex((t) => t.value === tf);
    let nextIdx = idx;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextIdx = (idx + 1) % TFS.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') nextIdx = (idx - 1 + TFS.length) % TFS.length;
    else return;
    e.preventDefault();
    onChange(TFS[nextIdx].value);
    (e.currentTarget.parentElement?.children[nextIdx] as HTMLElement)?.focus();
  };

  return (
    <div role="radiogroup" aria-label="Timeframe" className="flex bg-bg-elevated border border-line rounded-md p-0.5 overflow-x-auto scrollbar-none">
      {TFS.map((tf) => {
        const active = tf.value === value;
        return (
          <button
            key={tf.value}
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tf.value)}
            onKeyDown={(e) => handleKeyDown(e, tf.value)}
            title={tf.sub}
            className={`relative flex flex-col items-center justify-center min-w-[48px] h-10 px-3 rounded transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info ${
              active ? 'bg-bg-card text-fg shadow-soft' : 'text-fg-muted hover:text-fg hover:bg-bg-panel'
            }`}
          >
            <span className="text-xs font-bold leading-none tabular">{tf.label}</span>
            <span className={`text-[10px] uppercase tracking-wider leading-none mt-0.5 ${active ? 'text-fg-dim' : 'opacity-0'}`}>
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
