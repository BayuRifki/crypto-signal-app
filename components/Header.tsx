'use client';
import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import Tooltip from './Tooltip';
import type { SignalAction } from '../lib/signal';
import Badge from './Badge';
import type { Ticker24h } from '../lib/exchanges/types';
import { fmtPrice } from '../lib/utils';

type Props = {
  signal: { action: SignalAction; confidence: number; score: number } | null;
  ticker: Ticker24h | null;
  isLoading: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  onOpenSettings: () => void;
  lastUpdate?: Date | null;
};

const ACTION_STYLE: Record<SignalAction, { bg: string; text: string; border: string; glow: string; dot: string }> = {
  BUY: { bg: 'bg-buy-soft', text: 'text-buy', border: 'border-buy', glow: 'glow-buy', dot: 'bg-buy' },
  SELL: { bg: 'bg-sell-soft', text: 'text-sell', border: 'border-sell', glow: 'glow-sell', dot: 'bg-sell' },
  HOLD: { bg: 'bg-hold-soft', text: 'text-hold', border: 'border-hold', glow: '', dot: 'bg-hold' },
};

const fmtVol = (n: number) => {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return `${n.toFixed(0)}`;
};

const LogoMark = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path
      d="M3 16 L8 10 L13 13 L21 4"
      stroke="#6366F1"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <circle cx="8" cy="10" r="1.2" fill="#6366F1" />
    <circle cx="13" cy="13" r="1.2" fill="#6366F1" />
    <circle cx="21" cy="4" r="1.5" fill="#6366F1" />
  </svg>
);

export default function Header({ signal, ticker, isLoading, isRefreshing, onRefresh, onOpenSettings, lastUpdate }: Props) {
  const s = signal ? ACTION_STYLE[signal.action] : null;
  const change = ticker?.priceChangePercent ?? null;
  const up = (change ?? 0) >= 0;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(id);
  }, []);

  const lastUpdateAge = (() => {
    if (!lastUpdate) return null;
    const seconds = Math.max(0, Math.floor((now - lastUpdate.getTime()) / 1000));
    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  })();

  return (
    <header className="z-header backdrop-blur bg-bg-panel/95 border-b border-line" style={{ paddingTop: 'var(--safe-top)' }}>
      <div className="max-w-[1600px] mx-auto px-3 md:px-5 h-14 flex items-center gap-3">
        <div className="flex items-center gap-2.5 mr-2">
          <div className="w-8 h-8 rounded-md bg-bg-elevated border border-line flex items-center justify-center flex-shrink-0">
            <LogoMark />
          </div>
          <div className="hidden md:block">
            <div className="text-sm font-bold text-fg leading-none tracking-tight">AURORA</div>
            <div className="text-2xs text-fg-dim leading-none mt-0.5 label-caps">Terminal</div>
          </div>
        </div>

        <div className="h-6 w-px bg-line hidden md:block" />

        {ticker && (
          <Tooltip label={`24h volume: ${fmtVol(ticker.quoteVolume)}`}>
            <div className="hidden md:flex items-center gap-2.5 px-3.5 h-9 rounded-md bg-bg-elevated border border-line">
              <span className="text-sm mono font-bold text-fg">{fmtPrice(ticker.lastPrice)}</span>
              <span className={`text-xs mono font-bold ${up ? 'text-info' : 'text-fg-muted'}`}>
                {up ? '+' : ''}{change!.toFixed(2)}%
              </span>
              <span className="text-2xs text-fg-dim mono tabular hidden lg:inline">Vol {fmtVol(ticker.quoteVolume)}</span>
            </div>
          </Tooltip>
        )}

        <div className="flex-1 min-w-0" />

        {signal && s && (
          <Tooltip label={`${signal.action} signal · ${signal.confidence}% confidence · score ${signal.score > 0 ? '+' : ''}${signal.score}`}>
            <div className={`flex items-center gap-2 px-3 h-9 rounded-md border ${s.bg} ${s.border}/40 cursor-help transition ${signal.action !== 'HOLD' ? s.glow : ''}`}>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot} animate-pulse-soft`} />
              <span className={`text-xs font-black tracking-widest text-fg ${s.text}`}>{signal.action}</span>
              <span className={`w-px h-3 bg-current ${s.border}/30`} aria-hidden="true" />
              <span className={`text-xs mono tabular ${s.text} opacity-90`}>{signal.confidence}%</span>
            </div>
          </Tooltip>
        )}
        {!signal && !isLoading && <Badge variant="neutral" size="md">NO SIGNAL</Badge>}
        {isLoading && <Badge variant="info" size="md" dot>SCANNING</Badge>}

        <div className="flex items-center gap-2">
          {lastUpdateAge && !isLoading && (
            <div className="hidden md:flex items-center gap-1.5 px-2.5 h-9 rounded-md bg-bg-elevated border border-line text-2xs text-fg-dim mono tabular">
              <span className="w-1.5 h-1.5 rounded-full bg-info" />
              {lastUpdateAge}
            </div>
          )}
          <div className="flex items-center gap-1">
            <Tooltip label={lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString()}` : 'Refresh data'}>
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                aria-label="Refresh data"
                className="w-9 h-9 flex items-center justify-center rounded-md bg-bg-elevated border border-line hover:border-line-strong hover:text-fg transition disabled:opacity-50"
              >
                <Icon.Refresh size={15} className={`transition-transform ${isRefreshing ? 'animate-spin-slow' : ''}`} />
              </button>
            </Tooltip>
            <Tooltip label="Settings">
              <button
                onClick={onOpenSettings}
                aria-label="Open settings"
                className="w-9 h-9 flex items-center justify-center rounded-md bg-bg-elevated border border-line hover:border-line-strong hover:text-fg transition"
              >
                <Icon.Settings size={15} />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>
    </header>
  );
}
