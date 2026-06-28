'use client';
import React from 'react';
import { POPULAR_TRENDING } from '../lib/popularPairs';
import type { Ticker24h } from '../lib/exchanges/types';

export interface WatchlistSidebarProps {
  symbol: string;
  recents: string[];
  onSelectSymbol: (symbol: string) => void;
  tickers?: Record<string, Ticker24h>;
  className?: string;
}

const popularPairs: string[] = POPULAR_TRENDING;

export default function WatchlistSidebar({
  symbol,
  recents,
  onSelectSymbol,
  tickers = {},
  className = '',
}: WatchlistSidebarProps) {
  return (
    <nav
      role="navigation"
      aria-label="Watchlist"
      className={`w-52 flex-shrink-0 flex flex-col bg-bg-panel border-r border-line h-full overflow-hidden ${className}`}
    >
      {/* ── Popular pairs ── */}
      <div className="px-2 pt-3 pb-1">
        <p className="text-[9px] font-semibold text-fg-dim uppercase tracking-wider mb-1.5 px-1">
          Popular
        </p>
        <div className="flex flex-col">
          {popularPairs.map((pair) => (
            <PairButton
              key={pair}
              pair={pair}
              isActive={pair === symbol}
              onSelect={onSelectSymbol}
              ticker={tickers[pair]}
            />
          ))}
        </div>
      </div>

      {/* ── Recent pairs ── */}
      {recents.length > 0 && (
        <div className="px-2 pt-2 pb-3 border-t border-line mt-1">
          <p className="text-[9px] font-semibold text-fg-dim uppercase tracking-wider mb-1.5 px-1">
            Recent
          </p>
          <div className="flex flex-col overflow-y-auto scrollbar-thin max-h-[calc(100vh-320px)]">
            {recents.map((pair) => (
              <PairButton
                key={pair}
                pair={pair}
                isActive={pair === symbol}
                onSelect={onSelectSymbol}
                ticker={tickers[pair]}
              />
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}

type PairButtonProps = {
  pair: string;
  isActive: boolean;
  onSelect: (symbol: string) => void;
  ticker?: Ticker24h;
};

function PairButton({ pair, isActive, onSelect, ticker }: PairButtonProps) {
  const change = ticker?.priceChangePercent;
  const up = (change ?? 0) >= 0;

  return (
    <button
      onClick={() => onSelect(pair)}
      aria-pressed={isActive}
      className={[
        'w-full flex items-center justify-between px-2 py-1 rounded text-xs font-mono transition cursor-pointer',
        'hover:bg-bg-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-info/60',
        isActive
          ? 'bg-bg-elevated border-l-2 border-accent text-fg font-semibold'
          : 'bg-transparent border-l-2 border-transparent text-fg-muted hover:text-fg',
      ].join(' ')}
    >
      <span className="truncate">
        {pair.replace('USDT', '')}
        <span className="text-fg-dim text-[9px] ml-0.5">/U</span>
      </span>
      {change !== undefined && (
        <span className={`text-[10px] tabular font-semibold flex-shrink-0 ml-1 ${up ? 'text-buy' : 'text-sell'}`}>
          {up ? '+' : ''}{change.toFixed(1)}%
        </span>
      )}
    </button>
  );
}
