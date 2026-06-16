'use client';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { useKlines } from './useKlines';
import type { Candle } from '../utils';
import { generateDemoCandles, type DemoPreset } from '../demoData';
import type { ExchangeId, Interval } from '../exchanges/types';

const KEY = 'cs:demoMode';

const readDemoFlag = (): boolean => {
  if (typeof window === 'undefined') return false;
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
};
const writeDemoFlag = (v: boolean) => {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(KEY, v ? '1' : '0'); } catch {}
};

export const useCandleSource = (exchange: ExchangeId, symbol: string, interval: Interval, limit = 500) => {
  const [demoMode, setDemoModeState] = useState(false);
  const [demoPreset, setDemoPreset] = useState<DemoPreset>('trending');

  useEffect(() => { setDemoModeState(readDemoFlag()); }, []);

  const setDemoMode = useCallback((v: boolean) => {
    writeDemoFlag(v);
    setDemoModeState(v);
  }, []);

  const real = useKlines(exchange, symbol, interval, limit);
  const demoCandles = useMemo(
    () => (demoMode ? generateDemoCandles(demoPreset, limit, symbol) : []),
    [demoMode, demoPreset, limit, symbol]
  );

  return {
    candles: demoMode ? demoCandles : real.candles,
    error: demoMode ? null : real.error,
    isLoading: demoMode ? false : real.isLoading,
    refresh: real.refresh,
    isDemo: demoMode,
    demoPreset,
    setDemoPreset,
    setDemoMode,
    realError: real.error,
  };
};
