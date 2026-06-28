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
  wsConnected?: boolean;
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

export default function Header({ signal, ticker, isLoading, isRefreshing, onRefresh, onOpenSettings, lastUpdate, wsConnected }: Props) {
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
    <>
      <div className="flex items-center gap-2.5 mr-2 flex-shrink-0">
        <div className="w-7 h-7 rounded bg-bg-elevated border border-line flex items-center justify-center flex-shrink-0">
          <LogoMark />
        </div>
        <div className="hidden md:block">
          <div className="text-xs font-bold text-fg leading-none tracking-tight">AURORA</div>
          <div className="text-[9px] text-fg-dim leading-none mt-0.5 label-caps">Terminal</div>
        </div>
      </div>

      {ticker && (
        <Tooltip label={`24h volume: ${fmtVol(ticker.quoteVolume)}`}>
          <div className="hidden md:flex items-center gap-2 px-2.5 h-8 rounded bg-bg-elevated border border-line">
            {wsConnected !== undefined && (
              <span
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors duration-300 ${
                  wsConnected ? 'bg-buy shadow-[0_0_8px_#0ecb81]' : 'bg-warn animate-pulse-soft'
                }`}
                title={wsConnected ? 'Real-time WebSocket connected' : 'WebSocket connecting/disconnected'}
              />
            )}
            <span className="text-xs font-mono font-bold text-fg tabular">{fmtPrice(ticker.lastPrice)}</span>
            <span className={`text-2xs font-mono font-bold tabular ${up ? 'text-buy' : 'text-sell'}`}>
              {up ? '+' : ''}{change!.toFixed(2)}%
            </span>
            <span className="text-[10px] text-fg-dim font-mono tabular hidden lg:inline">Vol {fmtVol(ticker.quoteVolume)}</span>
          </div>
        </Tooltip>
      )}

      <div className="flex-1 min-w-0" />

      {signal && s && (
        <Tooltip label={`${signal.action} signal · ${signal.confidence}% confidence · score ${signal.score > 0 ? '+' : ''}${signal.score}`}>
          <div className={`flex items-center gap-1.5 px-2.5 h-8 rounded border ${s.bg} ${s.border}/40 cursor-help transition ${signal.action !== 'HOLD' ? s.glow : ''}`}>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot} animate-pulse-soft`} />
            <span className={`text-2xs font-black tracking-widest ${s.text}`}>{signal.action}</span>
            <span className={`w-px h-3 ${s.border}/20`} aria-hidden="true" />
            <span className={`text-2xs font-mono tabular ${s.text} opacity-90`}>{signal.confidence}%</span>
          </div>
        </Tooltip>
      )}
      {!signal && !isLoading && <Badge variant="neutral" size="md">NO SIGNAL</Badge>}
      {isLoading && <Badge variant="info" size="md" dot>SCANNING</Badge>}

      <div className="flex items-center gap-1.5">
        {lastUpdateAge && !isLoading && (
          <div className="hidden md:flex items-center gap-1.5 px-2 h-8 rounded bg-bg-elevated border border-line text-[10px] text-fg-dim font-mono tabular">
            <span className="w-1.5 h-1.5 rounded-full bg-buy" />
            {lastUpdateAge}
          </div>
        )}
        <Tooltip label={lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString()}` : 'Refresh data'}>
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="Refresh data"
            className="w-8 h-8 flex items-center justify-center rounded bg-bg-elevated border border-line hover:border-line-strong hover:text-fg transition disabled:opacity-50 cursor-pointer"
          >
            <Icon.Refresh size={13} className={`transition-transform ${isRefreshing ? 'animate-spin-slow' : ''}`} />
          </button>
        </Tooltip>
        <Tooltip label="Settings">
          <button
            onClick={onOpenSettings}
            aria-label="Open settings"
            className="w-8 h-8 flex items-center justify-center rounded bg-bg-elevated border border-line hover:border-line-strong hover:text-fg transition cursor-pointer"
          >
            <Icon.Settings size={13} />
          </button>
        </Tooltip>
      </div>
    </>
  );
}
