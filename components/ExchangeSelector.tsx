'use client';
import type { ExchangeId } from '../lib/exchanges/types';

const EXCHANGES: { id: ExchangeId; label: string; sub: string }[] = [
  { id: 'binance', label: 'Binance', sub: 'BNB' },
  { id: 'okx', label: 'OKX', sub: 'OKB' },
  { id: 'bybit', label: 'Bybit', sub: 'BIT' },
];

type Props = {
  value: ExchangeId;
  onChange: (id: ExchangeId) => void;
};

export default function ExchangeSelector({ value, onChange }: Props) {
  return (
    <div className="flex bg-bg-elevated border border-line rounded-md p-0.5">
      {EXCHANGES.map((e) => {
        const active = e.id === value;
        return (
          <button
            key={e.id}
            onClick={() => onChange(e.id)}
            className={`flex flex-col items-center justify-center min-w-[60px] px-2.5 py-1 rounded transition focus-ring ${
              active ? 'bg-bg-card text-fg shadow-soft' : 'text-fg-muted hover:text-fg'
            }`}
            title={e.sub}
          >
            <span className="text-xs font-bold leading-none">{e.label}</span>
            <span className={`text-[8px] uppercase tracking-wider leading-none mt-0.5 ${active ? 'text-fg-dim' : 'opacity-0'}`}>
              {e.sub}
            </span>
          </button>
        );
      })}
    </div>
  );
}
