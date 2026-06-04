import type { ReactNode } from 'react';

type Variant = 'buy' | 'sell' | 'hold' | 'info' | 'warn' | 'accent' | 'neutral';

const STYLES: Record<Variant, string> = {
  buy: 'bg-buy/15 text-buy border-buy/30',
  sell: 'bg-sell/15 text-sell border-sell/30',
  hold: 'bg-hold/15 text-hold border-hold/30',
  info: 'bg-info/15 text-info border-info/30',
  warn: 'bg-warn/15 text-warn border-warn/30',
  accent: 'bg-accent/15 text-accent border-accent/30',
  neutral: 'bg-bg-panel text-fg-muted border-line',
};

type Props = {
  variant?: Variant;
  size?: 'sm' | 'md';
  dot?: boolean;
  children: ReactNode;
  className?: string;
};

export default function Badge({ variant = 'neutral', size = 'sm', dot = false, children, className = '' }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1 border rounded font-semibold ${STYLES[variant]} ${
        size === 'sm' ? 'px-1.5 py-0.5 text-2xs' : 'px-2 py-0.5 text-xs'
      } ${className}`}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
