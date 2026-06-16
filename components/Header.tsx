'use client';
import { Icon } from './Icon';
import Tooltip from './Tooltip';
import type { SignalAction } from '../lib/signal';
import Badge from './Badge';
import type { Ticker24h } from '../lib/exchanges/types';
import { fmtPrice } from '../lib/utils';

type Props = {
  symbol: string;
  interval: string;
  signal: { action: SignalAction; confidence: number; score: number } | null;
  ticker: Ticker24h | null;
  isLoading: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  onOpenSettings: () => void;
  lastUpdate?: Date | null;
};

const ACTION_STYLE: Record<SignalAction, { bg: string; text: string; border: string; glow: string; dot: string }> = {
  BUY: { bg: 'bg-buy/20', text: 'text-buy', border: 'border-buy/40', glow: 'shadow-glow-buy', dot: 'bg-buy' },
  SELL: { bg: 'bg-sell/20', text: 'text-sell', border: 'border-sell/40', glow: 'shadow-glow-sell', dot: 'bg-sell' },
  HOLD: { bg: 'bg-hold/20', text: 'text-hold', border: 'border-hold/40', glow: '', dot: 'bg-hold' },
};

const fmtVol = (n: number) => {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return `${n.toFixed(0)}`;
};

export default function Header({ signal, ticker, isLoading, isRefreshing, onRefresh, onOpenSettings, lastUpdate }: Props) {
  const s = signal ? ACTION_STYLE[signal.action] : null;
  const change = ticker?.priceChangePercent ?? null;
  const up = (change ?? 0) >= 0;

  return (
    <header className="sticky top-0 z-30 backdrop-blur bg-bg-base/85 border-b border-line" style={{ paddingTop: 'var(--safe-top)' }}>
      <div className="max-w-[1600px] mx-auto px-3 md:px-5 h-14 flex items-center gap-2 md:gap-3">
        <div className="flex items-center gap-2 mr-1">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-buy via-info to-accent flex items-center justify-center font-black text-bg-base text-sm">
            Σ
          </div>
          <div className="hidden md:block">
            <div className="text-sm font-bold text-fg leading-none">Crypto Signal</div>
            <div className="text-2xs text-fg-dim leading-none mt-0.5">Smart Money Suite</div>
          </div>
        </div>

        <div className="h-6 w-px bg-line hidden md:block" />

        {ticker && (
          <div className="hidden md:flex items-center gap-2 px-3 h-9 rounded-md bg-bg-elevated border border-line">
            <span className="text-sm font-mono font-bold tabular text-fg">{fmtPrice(ticker.lastPrice)}</span>
            <span className={`text-xs font-mono tabular font-bold ${up ? 'text-buy' : 'text-sell'}`}>
              {up ? '+' : ''}{change!.toFixed(2)}%
            </span>
            <span className="text-2xs text-fg-dim tabular">Vol {fmtVol(ticker.quoteVolume)}</span>
          </div>
        )}

        <div className="flex-1 min-w-0" />

        {signal && s && (
          <Tooltip label={`${signal.action} signal · ${signal.confidence}% confidence · score ${signal.score > 0 ? '+' : ''}${signal.score}`}>
            <div className={`flex items-center gap-2 px-3 h-9 rounded-md border ${s.bg} ${s.border} ${s.glow} cursor-help transition`}>
              <span className={`w-2 h-2 rounded-full ${s.dot} animate-pulse-soft`} />
              <span className={`text-sm font-black ${s.text}`}>{signal.action}</span>
              <span className={`text-xs font-mono tabular ${s.text} opacity-80`}>{signal.confidence}%</span>
            </div>
          </Tooltip>
        )}
        {!signal && !isLoading && <Badge variant="neutral" size="md">NO SIGNAL</Badge>}
        {isLoading && <Badge variant="info" size="md" dot>SCANNING</Badge>}

        <div className="flex items-center gap-1">
          <Tooltip label={lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString()}` : 'Refresh data'}>
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="w-9 h-9 flex items-center justify-center rounded-md bg-bg-elevated border border-line hover:border-line-strong hover:bg-bg-panel transition focus-ring disabled:opacity-50"
            >
              <Icon.Refresh size={16} className={isRefreshing ? 'animate-spin-slow' : ''} />
            </button>
          </Tooltip>
          <Tooltip label="Settings">
            <button
              onClick={onOpenSettings}
              className="w-9 h-9 flex items-center justify-center rounded-md bg-bg-elevated border border-line hover:border-line-strong hover:bg-bg-panel transition focus-ring"
            >
              <Icon.Settings size={16} />
            </button>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}
