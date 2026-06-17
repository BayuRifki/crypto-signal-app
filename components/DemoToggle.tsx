'use client';
import { useState, useEffect, useRef } from 'react';
import { Icon } from './Icon';
import type { DemoPreset } from '../lib/demoData';

type Props = {
  isDemo: boolean;
  preset: DemoPreset;
  onToggle: (v: boolean) => void;
  onPresetChange: (p: DemoPreset) => void;
  realError: Error | null | undefined;
};

const PRESETS: { id: DemoPreset; label: string }[] = [
  { id: 'trending', label: 'Trending' },
  { id: 'ranging', label: 'Ranging' },
  { id: 'volatile', label: 'Volatile' },
  { id: 'bear-trend', label: 'Bear' },
];

export default function DemoToggle({ isDemo, preset, onToggle, onPresetChange, realError }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Data source: ${isDemo ? 'Demo' : 'Live'}. Click to change.`}
        className={`flex items-center gap-1.5 h-10 px-3 rounded-md border text-xs font-bold transition ${
          isDemo
            ? 'bg-accent/15 border-accent/40 text-accent hover:bg-accent/20'
            : 'bg-bg-elevated border-line text-fg-muted hover:border-line-strong hover:text-fg'
        }`}
        title={isDemo ? 'Demo data mode active' : 'Toggle demo data mode (synthetic candles)'}
      >
        <Icon.Activity size={12} />
        <span>{isDemo ? 'DEMO' : 'LIVE'}</span>
        <Icon.Chevron size={12} className={`opacity-60 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Data source settings"
          className="absolute z-dropdown top-full right-0 mt-2 w-64 card shadow-elev p-3 animate-fade-in space-y-2"
        >
          <div className="text-2xs text-fg-dim uppercase tracking-wider font-bold">Data Source</div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => { onToggle(false); setOpen(false); }}
              className={`h-9 px-2 rounded text-xs font-bold border transition ${
                !isDemo
                  ? 'bg-buy/15 border-buy/40 text-buy'
                  : 'bg-bg-elevated border-line text-fg-muted hover:border-line-strong hover:text-fg'
              }`}
            >
              Live (exchange)
            </button>
            <button
              onClick={() => { onToggle(true); setOpen(false); }}
              className={`h-9 px-2 rounded text-xs font-bold border transition ${
                isDemo
                  ? 'bg-accent/15 border-accent/40 text-accent'
                  : 'bg-bg-elevated border-line text-fg-muted hover:border-line-strong hover:text-fg'
              }`}
            >
              Demo (synthetic)
            </button>
          </div>
          {isDemo && (
            <>
              <div className="text-2xs text-fg-dim uppercase tracking-wider font-bold pt-1">Preset</div>
              <div className="grid grid-cols-2 gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { onPresetChange(p.id); setOpen(false); }}
                    className={`h-8 px-2 rounded text-xs font-bold border transition ${
                      p.id === preset
                        ? 'bg-accent/15 border-accent/40 text-accent'
                        : 'bg-bg-elevated border-line text-fg-muted hover:border-line-strong hover:text-fg'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </>
          )}
          {realError && !isDemo && (
            <div className="text-2xs text-warn leading-relaxed pt-1 border-t border-line">
              Live fetch failing. Use Demo to explore the UI without network access.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
