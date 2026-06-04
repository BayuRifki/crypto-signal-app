'use client';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useSymbols } from '../lib/hooks/useSymbols';
import { Icon } from './Icon';

type Props = {
  value: string;
  onChange: (s: string) => void;
  lastPrice?: number | null;
  change24h?: number | null;
};

export default function PairSelector({ value, onChange, lastPrice, change24h }: Props) {
  const { symbols, isLoading } = useSymbols();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.toUpperCase().trim();
    if (!q) return symbols.slice(0, 80);
    return symbols.filter((s) => s.symbol.includes(q) || s.base.includes(q)).slice(0, 80);
  }, [symbols, query]);

  const trending = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 h-10 rounded-md bg-bg-elevated border border-line hover:border-line-strong transition focus-ring"
      >
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-info/30 to-accent/30 flex items-center justify-center text-2xs font-black text-fg">
          {value.replace('USDT', '').slice(0, 3)}
        </div>
        <div className="text-left">
          <div className="text-sm font-bold text-fg leading-tight">{value}</div>
          {lastPrice !== undefined && lastPrice !== null && (
            <div className="flex items-center gap-1.5 text-2xs leading-tight">
              <span className="text-fg tabular">{formatPrice(lastPrice)}</span>
              {change24h !== undefined && change24h !== null && (
                <span className={change24h >= 0 ? 'text-buy' : 'text-sell'}>
                  {change24h >= 0 ? '+' : ''}{change24h.toFixed(2)}%
                </span>
              )}
            </div>
          )}
        </div>
        <Icon.Chevron size={14} className={`text-fg-muted transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-40 top-full left-0 mt-2 w-80 card shadow-elev animate-fade-in">
          <div className="p-2 border-b border-line">
            <div className="relative">
              <Icon.Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-dim" />
              <input
                autoFocus
                placeholder="Search pair (e.g. BTC, ETH)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full h-9 pl-8 pr-3 text-sm bg-bg-base border border-line rounded text-fg placeholder-fg-dim focus:outline-none focus:border-info"
              />
            </div>
          </div>
          {!query && (
            <div className="p-2 border-b border-line">
              <div className="text-2xs font-semibold text-fg-dim uppercase tracking-wider px-2 py-1">Trending</div>
              <div className="flex flex-wrap gap-1 px-1">
                {trending.map((s) => (
                  <button
                    key={s}
                    onClick={() => { onChange(s); setOpen(false); setQuery(''); }}
                    className="px-2 py-1 text-2xs font-mono rounded bg-bg-panel hover:bg-bg-hover text-fg-muted hover:text-fg transition"
                  >
                    {s.replace('USDT', '')}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="max-h-72 overflow-y-auto scrollbar-thin">
            {isLoading && (
              <div className="p-4 text-xs text-fg-dim text-center">Loading pairs…</div>
            )}
            {filtered.map((s) => (
              <button
                key={s.symbol}
                onClick={() => { onChange(s.symbol); setOpen(false); setQuery(''); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-bg-panel transition flex items-center justify-between gap-2 ${
                  s.symbol === value ? 'bg-info/10' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-bg-hover flex items-center justify-center text-2xs font-bold text-fg-muted">
                    {s.base.slice(0, 2)}
                  </div>
                  <div>
                    <div className="font-semibold text-fg">{s.base}</div>
                    <div className="text-2xs text-fg-dim">/{s.quote}</div>
                  </div>
                </div>
                {s.symbol === value && <span className="text-info">●</span>}
              </button>
            ))}
            {!isLoading && filtered.length === 0 && (
              <div className="p-4 text-xs text-fg-dim text-center">No results for &ldquo;{query}&rdquo;</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const formatPrice = (n: number) => {
  if (n >= 1000) return n.toFixed(2);
  if (n >= 1) return n.toFixed(3);
  return n.toFixed(6);
};
