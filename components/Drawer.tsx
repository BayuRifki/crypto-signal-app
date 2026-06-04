'use client';
import { useEffect, type ReactNode } from 'react';
import { Icon } from './Icon';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  side?: 'right' | 'bottom';
};

export default function Drawer({ open, onClose, title, children, side = 'right' }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  if (side === 'bottom') {
    return (
      <div className="fixed inset-0 z-50 md:hidden">
        <div className="absolute inset-0 bg-black/60 animate-fade-in" onClick={onClose} />
        <div
          className="absolute bottom-0 left-0 right-0 max-h-[85vh] bg-bg-elevated border-t border-line rounded-t-xl shadow-elev flex flex-col animate-slide-up"
          style={{ paddingBottom: 'var(--safe-bottom)' }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-line flex-shrink-0">
            <div className="text-sm font-bold text-fg">{title}</div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded hover:bg-bg-panel text-fg-muted" aria-label="Close">
              <Icon.X size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin p-4">{children}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 hidden md:block">
      <div className="absolute inset-0 bg-black/60 animate-fade-in" onClick={onClose} />
      <div className="absolute right-0 top-0 bottom-0 w-96 max-w-[90vw] bg-bg-elevated border-l border-line shadow-elev flex flex-col animate-fade-in">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line flex-shrink-0">
          <div className="text-sm font-bold text-fg">{title}</div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded hover:bg-bg-panel text-fg-muted" aria-label="Close">
            <Icon.X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">{children}</div>
      </div>
    </div>
  );
}
