'use client';
import { useState, useCallback, useEffect, useMemo } from 'react';
import useSWR, { type Key } from 'swr';
import { getKlinesWithFallback, type FallbackResult } from '../exchanges/fallback';
import type { ExchangeId } from '../exchanges/fallback';
import type { Interval } from '../exchanges/types';
import type { Candle } from '../utils';
import { generateDemoCandles, type DemoPreset } from '../demoData';

const DEMO_KEY = 'cs:demoMode';

const readDemoFlag = (): boolean => {
  if (typeof window === 'undefined') return false;
  try { return localStorage.getItem(DEMO_KEY) === '1'; } catch { return false; }
};
const writeDemoFlag = (v: boolean) => {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(DEMO_KEY, v ? '1' : '0'); } catch {}
};

const klinesFetcher = async (key: string): Promise<FallbackResult<Candle[]>> => {
  const [exchange, symbol, interval, limit] = key.split('|') as [ExchangeId, string, Interval, string];
  const lim = Number(limit);
  try {
    return await getKlinesWithFallback(symbol, interval, lim, exchange);
  } catch {
    const res = await fetch(`/api/exchanges/${exchange}/klines?symbol=${symbol}&interval=${interval}&limit=${lim}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`proxy ${res.status}`);
    const json = (await res.json()) as { data: Candle[]; exchangeId: string };
    return { data: json.data, exchangeId: (json.exchangeId as ExchangeId) ?? exchange, attempts: [{ id: (json.exchangeId as ExchangeId) ?? exchange, ok: true }] };
  }
};

export const useCandleSource = (exchange: ExchangeId, symbol: string, interval: Interval, limit = 500) => {
  const [demoMode, setDemoModeState] = useState(false);
  const [demoPreset, setDemoPreset] = useState<DemoPreset>('trending');

  useEffect(() => { setDemoModeState(readDemoFlag()); }, []);

  const setDemoMode = useCallback((v: boolean) => {
    writeDemoFlag(v);
    setDemoModeState(v);
  }, []);

  const swrKey: Key = demoMode ? null : `${exchange}|${symbol}|${interval}|${limit}`;
  const { data, error, isLoading, mutate } = useSWR<FallbackResult<Candle[]>>(swrKey, klinesFetcher, {
    refreshInterval: 30000,
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  const demoCandles = useMemo(
    () => (demoMode ? generateDemoCandles(demoPreset, limit, symbol) : []),
    [demoMode, demoPreset, limit, symbol]
  );

  return {
    candles: demoMode ? demoCandles : (data?.data ?? []),
    error: demoMode ? null : error,
    isLoading: demoMode ? false : isLoading,
    refresh: mutate,
    isDemo: demoMode,
    demoPreset,
    setDemoPreset,
    setDemoMode,
    realError: error ?? null,
  };
};
