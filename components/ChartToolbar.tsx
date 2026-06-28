'use client';

import { Interval } from '../lib/exchanges/types';

export interface ChartToolbarProps {
  interval: Interval;
  onIntervalChange: (interval: Interval) => void;
  showBB: boolean;
  setShowBB: (v: boolean) => void;
  showEMA: boolean;
  setShowEMA: (v: boolean) => void;
  showFVG: boolean;
  setShowFVG: (v: boolean) => void;
  showOB: boolean;
  setShowOB: (v: boolean) => void;
  showSR: boolean;
  setShowSR: (v: boolean) => void;
  showMS: boolean;
  setShowMS: (v: boolean) => void;
}

const INTERVALS: Interval[] = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'];

const OVERLAY_CONFIG = [
  { key: 'showBB' as const, label: 'BB', ariaLabel: 'Toggle Bollinger Bands' },
  { key: 'showEMA' as const, label: 'EMA', ariaLabel: 'Toggle EMA' },
  { key: 'showFVG' as const, label: 'FVG', ariaLabel: 'Toggle Fair Value Gap' },
  { key: 'showOB' as const, label: 'OB', ariaLabel: 'Toggle Order Blocks' },
  { key: 'showSR' as const, label: 'S/R', ariaLabel: 'Toggle Support & Resistance' },
  { key: 'showMS' as const, label: 'MS', ariaLabel: 'Toggle Market Structure' },
];

export default function ChartToolbar({
  interval,
  onIntervalChange,
  showBB,
  setShowBB,
  showEMA,
  setShowEMA,
  showFVG,
  setShowFVG,
  showOB,
  setShowOB,
  showSR,
  setShowSR,
  showMS,
  setShowMS,
}: ChartToolbarProps) {
  const toggleMap = { showBB, showEMA, showFVG, showOB, showSR, showMS };
  const setterMap = { showBB: setShowBB, showEMA: setShowEMA, showFVG: setShowFVG, showOB: setShowOB, showSR: setShowSR, showMS: setShowMS };

  return (
    <div className="flex items-center gap-sm px-xs py-xs h-9 bg-bg-base border-b border-line text-xs">
      {/* Timeframe selector */}
      <div className="flex items-center gap-1" role="group" aria-label="Chart timeframe">
        {INTERVALS.map((intv) => (
          <button
            key={intv}
            onClick={() => onIntervalChange(intv)}
            aria-label={`Set timeframe to ${intv}`}
            className={
              intv === interval
                ? 'px-2 py-1 rounded bg-accent text-fg font-medium'
                : 'px-2 py-1 rounded bg-bg-elevated text-fg-muted hover:bg-bg-hover'
            }
          >
            {intv}
          </button>
        ))}
      </div>

      <div className="w-px h-5 bg-line mx-1" />

      {/* Overlay toggles */}
      <div className="flex items-center gap-1" role="group" aria-label="Chart overlays">
        {OVERLAY_CONFIG.map(({ key, label, ariaLabel }) => {
          const active = toggleMap[key];
          const setToggle = setterMap[key];
          return (
            <button
              key={key}
              aria-pressed={active}
              aria-label={ariaLabel}
              onClick={() => setToggle(!active)}
              className={
                active
                  ? 'px-2 py-1 rounded border bg-info/15 text-info border-info/30'
                  : 'px-2 py-1 rounded border bg-bg-elevated text-fg-muted border-line hover:border-line-strong'
              }
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}