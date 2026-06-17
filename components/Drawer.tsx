'use client';
import { useEffect, type ReactNode, useRef } from 'react';
import { Icon } from './Icon';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  side?: 'right' | 'bottom';
};

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Drawer({ open, onClose, title, children, side = 'right' }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && panelRef.current) {
        const nodes = panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
        if (nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    const t = window.setTimeout(() => closeBtnRef.current?.focus(), 50);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open) return null;

  if (side === 'bottom') {
    return (
      <div className="fixed inset-0 z-drawer md:hidden">
        <div className="absolute inset-0 bg-black/60 animate-fade-in" onClick={onClose} aria-hidden="true" />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="absolute bottom-0 left-0 right-0 max-h-[85vh] bg-bg-elevated border-t border-line rounded-t-xl shadow-elev flex flex-col animate-slide-up"
          style={{ paddingBottom: 'var(--safe-bottom)' }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-line flex-shrink-0">
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-line-strong" aria-hidden="true" />
            <div className="text-sm font-bold text-fg">{title}</div>
            <button
              ref={closeBtnRef}
              onClick={onClose}
              className="w-11 h-11 -mr-2 flex items-center justify-center rounded-md hover:bg-bg-panel text-fg-muted hover:text-fg transition"
              aria-label="Close drawer"
            >
              <Icon.X size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin p-4">{children}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-drawer hidden md:block">
      <div className="absolute inset-0 bg-black/60 animate-fade-in" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute right-0 top-0 bottom-0 w-96 max-w-[90vw] bg-bg-elevated border-l border-line shadow-elev flex flex-col animate-fade-in"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-line flex-shrink-0">
          <div className="text-sm font-bold text-fg">{title}</div>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            className="w-11 h-11 -mr-2 flex items-center justify-center rounded-md hover:bg-bg-panel text-fg-muted hover:text-fg transition"
            aria-label="Close drawer"
          >
            <Icon.X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">{children}</div>
      </div>
    </div>
  );
}
