'use client';
import React from 'react';
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
  const handleKeyDown = (e: React.KeyboardEvent, id: ExchangeId) => {
    const idx = EXCHANGES.findIndex((ex) => ex.id === id);
    let nextIdx = idx;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextIdx = (idx + 1) % EXCHANGES.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') nextIdx = (idx - 1 + EXCHANGES.length) % EXCHANGES.length;
    else return;
    e.preventDefault();
    onChange(EXCHANGES[nextIdx].id);
    (e.currentTarget.parentElement?.children[nextIdx] as HTMLElement)?.focus();
  };

  return (
    <div role="radiogroup" aria-label="Exchange" className="flex bg-bg-elevated border border-line rounded-md p-0.5">
      {EXCHANGES.map((e) => {
        const active = e.id === value;
        return (
          <button
            key={e.id}
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(e.id)}
            onKeyDown={(ev) => handleKeyDown(ev, e.id)}
            title={e.sub}
            className={`flex flex-col items-center justify-center min-w-[60px] h-10 px-3 rounded transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info ${
              active ? 'bg-bg-card text-fg shadow-soft' : 'text-fg-muted hover:text-fg hover:bg-bg-panel'
            }`}
          >
            <span className="text-xs font-bold leading-none">{e.label}</span>
            <span className={`text-[10px] uppercase tracking-wider leading-none mt-0.5 ${active ? 'text-fg-dim' : 'opacity-0'}`}>
              {e.sub}
            </span>
          </button>
        );
      })}
    </div>
  );
}
