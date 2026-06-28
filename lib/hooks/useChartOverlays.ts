'use client';
import { useState, useCallback } from 'react';

/**
 * Toggle state for the 6 chart overlays (BB / EMA / FVG / OB / S/R / MS).
 * Overlays only affect visual rendering — the signal scoring engine always
 * uses all indicators regardless of these toggles.
 *
 * Extracted from `app/page.tsx` (6 useState + 6 setters = 12 bindings) so
 * the page stops visual noise bleeding into the market-state hook bundle.
 * The "Hide all" / "Show defaults" presets are convenience helpers for the
 * settings drawer (P3 also adds an explicit UI affordance for this).
 */
export type ChartOverlays = {
  showBB: boolean;
  showEMA: boolean;
  showFVG: boolean;
  showOB: boolean;
  showSR: boolean;
  showMS: boolean;
  setShowBB: (v: boolean) => void;
  setShowEMA: (v: boolean) => void;
  setShowFVG: (v: boolean) => void;
  setShowOB: (v: boolean) => void;
  setShowSR: (v: boolean) => void;
  setShowMS: (v: boolean) => void;
  hideAll: () => void;
  showDefaults: () => void;
};

const DEFAULTS = { showBB: true, showEMA: true, showFVG: false, showOB: false, showSR: false, showMS: true };
type OverlayFlags = { showBB: boolean; showEMA: boolean; showFVG: boolean; showOB: boolean; showSR: boolean; showMS: boolean };

export const useChartOverlays = (): ChartOverlays => {
  const [showBB, setShowBB] = useState<boolean>(DEFAULTS.showBB);
  const [showEMA, setShowEMA] = useState<boolean>(DEFAULTS.showEMA);
  const [showFVG, setShowFVG] = useState<boolean>(DEFAULTS.showFVG);
  const [showOB, setShowOB] = useState<boolean>(DEFAULTS.showOB);
  const [showSR, setShowSR] = useState<boolean>(DEFAULTS.showSR);
  const [showMS, setShowMS] = useState<boolean>(DEFAULTS.showMS);

  const hideAll = useCallback(() => {
    setShowBB(false); setShowEMA(false); setShowFVG(false);
    setShowOB(false); setShowSR(false); setShowMS(false);
  }, []);

  const showDefaults = useCallback(() => {
    setShowBB(DEFAULTS.showBB); setShowEMA(DEFAULTS.showEMA); setShowFVG(DEFAULTS.showFVG);
    setShowOB(DEFAULTS.showOB); setShowSR(DEFAULTS.showSR); setShowMS(DEFAULTS.showMS);
  }, []);

  return {
    showBB, showEMA, showFVG, showOB, showSR, showMS,
    setShowBB, setShowEMA, setShowFVG, setShowOB, setShowSR, setShowMS,
    hideAll, showDefaults,
  };
};