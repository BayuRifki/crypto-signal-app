'use client';
import { useState } from 'react';
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

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 h-9 px-2.5 rounded-md border text-2xs font-bold transition focus-ring ${
          isDemo
            ? 'bg-accent/15 border-accent/40 text-accent'
            : 'bg-bg-elevated border-line text-fg-muted hover:border-line-strong'
        }`}
        title={isDemo ? 'Demo data mode active' : 'Toggle demo data mode (synthetic candles)'}
      >
        <Icon.Activity size={11} />
        <span>{isDemo ? 'DEMO' : 'LIVE'}</span>
      </button>
      {open && (
        <div className="absolute z-40 top-full right-0 mt-2 w-64 card shadow-elev p-3 animate-fade-in space-y-2">
          <div className="text-2xs text-fg-dim uppercase tracking-wider font-bold">Data Source</div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => onToggle(false)}
              className={`px-2 py-1.5 rounded text-xs font-bold border transition ${
                !isDemo
                  ? 'bg-buy/15 border-buy/40 text-buy'
                  : 'bg-bg-elevated border-line text-fg-muted hover:border-line-strong'
              }`}
            >
              Live (exchange)
            </button>
            <button
              onClick={() => onToggle(true)}
              className={`px-2 py-1.5 rounded text-xs font-bold border transition ${
                isDemo
                  ? 'bg-accent/15 border-accent/40 text-accent'
                  : 'bg-bg-elevated border-line text-fg-muted hover:border-line-strong'
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
                    onClick={() => onPresetChange(p.id)}
                    className={`px-2 py-1 rounded text-2xs font-bold border transition ${
                      p.id === preset
                        ? 'bg-accent/15 border-accent/40 text-accent'
                        : 'bg-bg-elevated border-line text-fg-muted hover:border-line-strong'
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
