'use client';
import { useState, type ReactNode } from 'react';

type Props = {
  label: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom';
  className?: string;
};

export default function Tooltip({ label, children, side = 'top', className = '' }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className={`pointer-events-none absolute z-50 left-1/2 -translate-x-1/2 px-2 py-1 text-2xs font-medium text-fg bg-bg-card border border-line rounded shadow-elev whitespace-nowrap max-w-[220px] ${
            side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          }`}
        >
          {label}
        </span>
      )}
    </span>
  );
}
