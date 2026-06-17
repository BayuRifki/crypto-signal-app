'use client';
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useSymbols } from '../lib/hooks/useSymbols';
import { POPULAR_USDT_PAIRS, POPULAR_TRENDING } from '../lib/popularPairs';
import type { ExchangeId, SymbolInfo } from '../lib/exchanges/types';
import { Icon } from './Icon';
import { fmtPrice } from '../lib/utils';

type Props = {
  value: string;
  onChange: (s: string) => void;
  lastPrice?: number | null;
  change24h?: number | null;
  exchange: ExchangeId;
};

const dedupe = (pairs: SymbolInfo[]): SymbolInfo[] => {
  const seen = new Set<string>();
  const out: SymbolInfo[] = [];
  for (const p of pairs) {
    if (seen.has(p.symbol)) continue;
    seen.add(p.symbol);
    out.push(p);
  }
  return out;
};

const ITEM_HEIGHT = 44;
const VISIBLE_COUNT = 8;

export default function PairSelector({ value, onChange, lastPrice, change24h, exchange }: Props) {
  const { symbols, isLoading, error, refresh } = useSymbols(exchange);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 50);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  const useFallback = isLoading || !!error || (symbols && symbols.length === 0);
  const source: SymbolInfo[] = useMemo(() => {
    const apiList = (symbols ?? []).filter((s) => s.quote === 'USDT');
    if (apiList.length > 0) return dedupe(apiList);
    return dedupe(POPULAR_USDT_PAIRS);
  }, [symbols]);

  const display: SymbolInfo[] = useMemo(() => {
    if (source.some((s) => s.symbol === value)) return source;
    const base = value.endsWith('USDT') ? value.slice(0, -4) : value;
    return [{ symbol: value, base, quote: 'USDT' }, ...source];
  }, [source, value]);

  const filtered = useMemo(() => {
    const q = query.toUpperCase().trim();
    if (!q) return display;
    return display.filter((s) => s.symbol.includes(q) || s.base.includes(q));
  }, [display, query]);

  const totalHeight = filtered.length * ITEM_HEIGHT;
  const startIndex = Math.floor(scrollOffset / ITEM_HEIGHT);
  const endIndex = Math.min(filtered.length, startIndex + VISIBLE_COUNT + 4);
  const visibleItems = filtered.slice(startIndex, endIndex);
  const offsetY = startIndex * ITEM_HEIGHT;

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      setScrollOffset(scrollRef.current.scrollTop);
    }
  }, []);

  const handleSelect = useCallback((symbol: string) => {
    onChange(symbol);
    setOpen(false);
    setQuery('');
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const currentIndex = filtered.findIndex((s) => s.symbol === value);
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = Math.max(0, Math.min(filtered.length - 1, currentIndex + dir));
      if (filtered[nextIndex]) {
        onChange(filtered[nextIndex].symbol);
        const itemTop = nextIndex * ITEM_HEIGHT;
        if (scrollRef.current) {
          if (itemTop < scrollRef.current.scrollTop) {
            scrollRef.current.scrollTop = itemTop;
          } else if (itemTop + ITEM_HEIGHT > scrollRef.current.scrollTop + scrollRef.current.clientHeight) {
            scrollRef.current.scrollTop = itemTop + ITEM_HEIGHT - scrollRef.current.clientHeight;
          }
        }
      }
    }
  }, [filtered, value, onChange]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Trading pair: ${value}. Click to change.`}
        className="flex items-center gap-2 h-10 px-3 rounded-md bg-bg-elevated border border-line hover:border-line-strong hover:bg-bg-panel transition cursor-pointer"
      >
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-info/30 to-accent/30 flex items-center justify-center text-2xs font-black text-fg flex-shrink-0">
          {value.replace('USDT', '').slice(0, 3)}
        </div>
        <div className="text-left min-w-0">
          <div className="text-sm font-bold text-fg leading-tight truncate">{value}</div>
          {lastPrice !== undefined && lastPrice !== null && (
            <div className="flex items-center gap-1.5 text-2xs leading-tight">
              <span className="text-fg tabular truncate">{fmtPrice(lastPrice)}</span>
              {change24h !== undefined && change24h !== null && (
                <span className={`tabular ${change24h >= 0 ? 'text-buy' : 'text-sell'}`}>
                  {change24h >= 0 ? '+' : ''}{change24h.toFixed(2)}%
                </span>
              )}
            </div>
          )}
        </div>
        <Icon.Chevron size={14} className={`text-fg-muted flex-shrink-0 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Trading pairs"
          aria-activedescendant={value ? `pair-${value}` : undefined}
          className="absolute z-dropdown top-full left-0 mt-2 w-[min(320px,calc(100vw-1.5rem))] card shadow-elev animate-fade-in"
        >
          <div className="p-2 border-b border-line">
            <div className="relative">
              <Icon.Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-dim pointer-events-none" />
              <input
                ref={inputRef}
                placeholder="Search pair (e.g. BTC, ETH)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                aria-label="Search trading pair"
                className="w-full h-9 pl-8 pr-3 text-sm bg-bg-base border border-line rounded text-fg placeholder-fg-dim"
              />
            </div>
          </div>

          {!query && (
            <div className="p-2 border-b border-line">
              <div className="text-2xs font-semibold text-fg-dim uppercase tracking-wider px-2 py-1">Trending</div>
              <div className="flex flex-wrap gap-1 px-1">
                {POPULAR_TRENDING.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSelect(s)}
                    className="h-7 px-2 text-2xs font-mono rounded bg-bg-panel hover:bg-bg-hover text-fg-muted hover:text-fg transition cursor-pointer"
                  >
                    {s.replace('USDT', '')}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="px-3 py-1.5 text-2xs text-fg-dim flex items-center justify-between border-t border-b border-line">
            <span className="truncate">
              {isLoading && (!symbols || symbols.length === 0)
                ? `Loading ${exchange} pairs…`
                : useFallback
                  ? `${source.length} pairs (live fetch unavailable)`
                  : `${source.length} pairs from ${exchange}`}
            </span>
            <div className="flex items-center gap-2 flex-shrink-0">
              {error && !isLoading && (
                <span className="text-warn flex items-center gap-1" title={error.message}>
                  <Icon.Info size={11} />
                  fallback
                </span>
              )}
              <button
                onClick={() => refresh()}
                disabled={isLoading}
                aria-label="Refresh pairs"
                className="w-7 h-7 flex items-center justify-center text-fg-dim hover:text-fg hover:bg-bg-panel rounded transition disabled:opacity-40 cursor-pointer"
              >
                <Icon.Refresh size={12} className={isLoading ? 'animate-spin-slow' : ''} />
              </button>
            </div>
          </div>

          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="max-h-80 overflow-y-auto scrollbar-thin"
            role="presentation"
          >
            {isLoading && source.length === 0 && (
              <div className="p-4 text-xs text-fg-dim text-center flex flex-col items-center gap-2">
                <div className="w-5 h-5 border-2 border-info border-t-transparent rounded-full animate-spin-slow" />
                Fetching from {exchange}…
              </div>
            )}
            <div style={{ height: totalHeight, position: 'relative' }}>
              <div style={{ transform: `translateY(${offsetY}px)` }}>
                {visibleItems.map((s) => {
                  const selected = s.symbol === value;
                  return (
                    <button
                      key={s.symbol}
                      id={`pair-${s.symbol}`}
                      role="option"
                      aria-selected={selected}
                      onClick={() => handleSelect(s.symbol)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-bg-panel transition cursor-pointer flex items-center justify-between gap-2 ${
                        selected ? 'bg-info/10' : ''
                      }`}
                      style={{ height: ITEM_HEIGHT }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-bg-hover flex items-center justify-center text-2xs font-bold text-fg-muted flex-shrink-0">
                          {s.base.slice(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-fg truncate">{s.base}</div>
                          <div className="text-2xs text-fg-dim">/{s.quote}</div>
                        </div>
                      </div>
                      {selected && <Icon.Activity size={12} className="text-info flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
            {!isLoading && filtered.length === 0 && (
              <div className="p-4 text-xs text-fg-dim text-center">No results for &ldquo;{query}&rdquo;</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}