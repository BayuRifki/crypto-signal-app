'use client';
import { Icon } from './Icon';
import type { Signal } from '../lib/signal';
import Badge from './Badge';
import { fmtPrice } from '../lib/utils';

type Props = { signal: Signal | null; onClick: () => void };

export default function MobileSignalButton({ signal, onClick }: Props) {
  if (!signal) return null;
  const isAction = signal.action !== 'HOLD';
  const variant = signal.action === 'BUY' ? 'buy' : signal.action === 'SELL' ? 'sell' : 'hold';
  return (
    <button
      onClick={onClick}
      aria-label={`View ${signal.action} signal details, ${signal.confidence}% confidence at ${fmtPrice(signal.price)}`}
      className={`md:hidden fixed left-3 right-3 bottom-3 z-header h-14 rounded-xl border backdrop-blur shadow-elev flex items-center justify-between px-4 active:scale-[0.98] transition cursor-pointer ${
        isAction
          ? signal.action === 'BUY'
            ? 'bg-buy border-buy text-white'
            : 'bg-sell border-sell text-white'
          : 'bg-bg-elevated/95 border-line text-fg'
      }`}
      style={{ marginBottom: 'var(--safe-bottom)' }}
    >
      <div className="flex items-center gap-2.5">
        <span className={`w-2 h-2 rounded-full ${isAction ? 'bg-white animate-pulse-soft' : 'bg-fg-dim'}`} />
        <span className="font-black text-lg">{signal.action}</span>
        <Badge variant={variant} size="sm" className={isAction ? '!bg-white/20 !border-white/30 !text-white' : ''}>{signal.confidence}%</Badge>
      </div>
      <div className="flex items-center gap-1 text-xs">
        <span className={`font-mono tabular ${isAction ? 'opacity-95' : 'opacity-80'}`}>{fmtPrice(signal.price)}</span>
        <Icon.Chevron size={14} />
      </div>
    </button>
  );
}
