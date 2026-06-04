'use client';
import { Icon } from './Icon';
import type { Signal } from '../lib/signal';
import Badge from './Badge';

const fmtPrice = (n: number) => {
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(3);
  return n.toFixed(6);
};

type Props = { signal: Signal | null; onClick: () => void };

export default function MobileSignalButton({ signal, onClick }: Props) {
  if (!signal) return null;
  const isAction = signal.action !== 'HOLD';
  const variant = signal.action === 'BUY' ? 'buy' : signal.action === 'SELL' ? 'sell' : 'hold';
  return (
    <button
      onClick={onClick}
      className={`md:hidden fixed left-3 right-3 bottom-3 z-30 h-14 rounded-xl border backdrop-blur shadow-elev flex items-center justify-between px-4 active:scale-[0.98] transition ${
        isAction
          ? signal.action === 'BUY'
            ? 'bg-buy/90 border-buy text-bg-base'
            : 'bg-sell/90 border-sell text-white'
          : 'bg-bg-elevated/95 border-line text-fg'
      }`}
      style={{ marginBottom: 'var(--safe-bottom)' }}
    >
      <div className="flex items-center gap-2.5">
        <span className={`w-2 h-2 rounded-full ${isAction ? 'bg-white animate-pulse-soft' : 'bg-fg-dim'}`} />
        <span className="font-black text-lg">{signal.action}</span>
        <Badge variant={variant} size="sm">{signal.confidence}%</Badge>
      </div>
      <div className="flex items-center gap-1 text-xs">
        <span className="font-mono tabular opacity-80">{fmtPrice(signal.price)}</span>
        <Icon.Chevron size={14} />
      </div>
    </button>
  );
}
