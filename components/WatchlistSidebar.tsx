'use client';
import React from 'react';
import { POPULAR_TRENDING } from '../lib/popularPairs';

export interface WatchlistSidebarProps {
  symbol: string;
  recents: string[];
  onSelectSymbol: (symbol: string) => void;
  className?: string;
}

const popularPairs: string[] = POPULAR_TRENDING;

/**
 * Compact left sidebar watchlist for a Binance-style terminal layout.
 * Two sections: Popular pairs (static) and Recent pairs (prop-driven).
 * No data fetching — pure presentational.
 */
export default function WatchlistSidebar({
  symbol,
  recents,
  onSelectSymbol,
  className = '',
}: WatchlistSidebarProps) {
  return (
    <nav
      role="navigation"
      aria-label="Watchlist"
      className={`w-56 flex-shrink-0 flex flex-col bg-bg-panel border-r border-line h-full overflow-hidden ${className}`}
    >
      {/* ── Popular pairs ── */}
      <div className="px-3 pt-4 pb-2">
        <p className="text-2xs font-semibold text-fg-dim uppercase tracking-wider mb-2">
          Popular
        </p>
        <div className="flex flex-col gap-0.5">
          {popularPairs.map((pair) => (
            <PairButton
              key={pair}
              pair={pair}
              isActive={pair === symbol}
              onSelect={onSelectSymbol}
            />
          ))}
        </div>
      </div>

      {/* ── Recent pairs ── */}
      {recents.length > 0 && (
        <div className="px-3 pt-3 pb-4 border-t border-line mt-2">
          <p className="text-2xs font-semibold text-fg-dim uppercase tracking-wider mb-2">
            Recent
          </p>
          <div className="flex flex-col gap-0.5 overflow-y-auto scrollbar-thin max-h-[calc(100vh-320px)]">
            {recents.map((pair) => (
              <PairButton
                key={pair}
                pair={pair}
                isActive={pair === symbol}
                onSelect={onSelectSymbol}
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
};

function PairButton({ pair, isActive, onSelect }: PairButtonProps) {
  return (
    <button
      onClick={() => onSelect(pair)}
      aria-pressed={isActive}
      className={[
        'w-full text-left px-2 py-1.5 rounded text-sm font-mono transition cursor-pointer',
        'hover:bg-bg-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-info/60',
        isActive
          ? 'bg-bg-elevated border-l-2 border-accent text-fg font-semibold'
          : 'bg-transparent border-l-2 border-transparent text-fg-muted hover:text-fg',
      ].join(' ')}
    >
      {pair.replace('USDT', '')}
      <span className="text-fg-dim text-2xs ml-0.5">/USDT</span>
    </button>
  );
}