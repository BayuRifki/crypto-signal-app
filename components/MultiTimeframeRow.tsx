'use client';
import { useEffect, useState } from 'react';
import { useKlines } from '../lib/hooks/useKlines';
import { computeSignal, type SignalAction } from '../lib/signal';
import { KEY_TIMEFRAMES } from './TimeframeTabs';
import type { ExchangeId, Interval } from '../lib/exchanges/types';
import { Icon } from './Icon';
import Tooltip from './Tooltip';
import { logSignal } from '../lib/signalHistory';

type Props = { symbol: string; activeTf: Interval; exchange: ExchangeId };

const ACTION_STYLES: Record<SignalAction, { ring: string; bg: string; text: string; dot: string }> = {
  BUY: { ring: 'border-buy/40', bg: 'bg-buy/10', text: 'text-buy', dot: 'bg-buy' },
  SELL: { ring: 'border-sell/40', bg: 'bg-sell/10', text: 'text-sell', dot: 'bg-sell' },
  HOLD: { ring: 'border-line-strong', bg: 'bg-bg-elevated', text: 'text-fg-muted', dot: 'bg-fg-dim' },
};

const Row = ({ symbol, tf, activeTf, exchange, onResult }: { symbol: string; tf: Interval; activeTf: Interval; exchange: ExchangeId; onResult: (s: SignalAction | null, score: number | null) => void }) => {
  const { candles } = useKlines(exchange, symbol, tf, 300);
  const [res, setRes] = useState<{ action: SignalAction | null; score: number | null }>({ action: null, score: null });
  useEffect(() => {
    if (candles.length < 210) return;
    const sig = computeSignal(candles);
    const next = sig ? { action: sig.action, score: sig.score } : { action: null, score: null };
    setRes(next);
    onResult(next.action, next.score);
    if (sig) logSignal(symbol, tf, sig);
  }, [candles, onResult]);
  const isActive = tf === activeTf;
  const loading = res.action === null;
  const s = res.action ? ACTION_STYLES[res.action] : null;

  return (
    <Tooltip label={res.action ? `${res.action} signal · score ${res.score! > 0 ? '+' : ''}${res.score}` : `Loading ${tf}…`}>
      <div
        className={`relative flex flex-col gap-0.5 p-2 md:p-2.5 rounded-md border transition cursor-help ${
          isActive ? 'border-info/50 bg-info/5' : s ? `${s.ring} ${s.bg}` : 'border-line bg-bg-elevated'
        }`}
      >
        <div className="flex items-center gap-1.5 text-2xs text-fg-dim uppercase tracking-wider font-bold">
          <span>{tf}</span>
          {isActive && <Icon.Zap size={10} className="text-info" />}
        </div>
        {loading ? (
          <div className="h-4 w-12 shimmer rounded" />
        ) : (
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${s?.dot}`} />
            <span className={`text-sm font-black ${s?.text}`}>{res.action}</span>
          </div>
        )}
        {res.score !== null && (
          <div className="text-2xs text-fg-dim tabular">{res.score > 0 ? '+' : ''}{res.score}</div>
        )}
      </div>
    </Tooltip>
  );
};

export default function MultiTimeframeRow({ symbol, activeTf, exchange }: Props) {
  const [rows, setRows] = useState<Record<Interval, { action: SignalAction | null; score: number | null }>>({} as any);

  const valid = Object.values(rows).filter((r) => r.action);
  const buy = valid.filter((r) => r.action === 'BUY').length;
  const sell = valid.filter((r) => r.action === 'SELL').length;
  const hold = valid.filter((r) => r.action === 'HOLD').length;
  const dominant = buy > sell && buy > hold ? 'BULLISH' : sell > buy && sell > hold ? 'BEARISH' : buy === 0 && sell === 0 ? 'WAITING' : 'MIXED';
  const dominantColor = dominant === 'BULLISH' ? 'text-buy' : dominant === 'BEARISH' ? 'text-sell' : 'text-fg-muted';

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-2xs text-fg-dim uppercase tracking-wider font-bold">
          <Icon.Layers size={12} />
          <span>Multi-Timeframe</span>
        </div>
        <div className="flex items-center gap-2 text-2xs">
          <span className="text-fg-dim">Consensus:</span>
          <span className={`font-black ${dominantColor}`}>{dominant}</span>
          <span className="text-fg-dim">· {buy}/{valid.length || 0} BUY</span>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
        {KEY_TIMEFRAMES.map((tf) => (
          <Row
            key={tf}
            symbol={symbol}
            tf={tf}
            activeTf={activeTf}
            exchange={exchange}
            onResult={(action, score) => setRows((r) => ({ ...r, [tf]: { action, score } }))}
          />
        ))}
      </div>
    </div>
  );
}
