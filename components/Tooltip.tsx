'use client';
import { useState, useId, type ReactNode, type KeyboardEvent, type FocusEvent } from 'react';

type Props = {
  label: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom';
  className?: string;
};

export default function Tooltip({ label, children, side = 'top', className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const show = () => setOpen(true);
  const hide = () => setOpen(false);
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') hide(); };
  const onFocus = (e: FocusEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) show(); };
  const onBlur = (e: FocusEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) hide(); };
  return (
    <span
      className={`relative inline-flex ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKey}
    >
      {children}
      {open && (
        <span
          id={id}
          role="tooltip"
          className={`pointer-events-none absolute z-tooltip left-1/2 -translate-x-1/2 px-2 py-1 text-2xs font-medium text-fg bg-bg-card border border-line rounded shadow-elev whitespace-nowrap max-w-[240px] ${
            side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          }`}
        >
          {label}
        </span>
      )}
    </span>
  );
}
