'use client';
import { useState, useEffect, useCallback } from 'react';
import type { ExchangeId, Interval } from '../exchanges/types';

/**
 * Persisted market selection state: exchange, symbol, timeframe, and the
 * rolling list of recently-used pairs. On mount we rehydrate from
 * localStorage (in an effect rather than a lazy useState initializer so the
 * first client render matches the server-rendered HTML and we avoid a
 * hydration mismatch); subsequently we write back every time the selection
 * changes.
 *
 * Extracted from `app/page.tsx` so the page component stops carrying 4
 * useState + 3 useEffect + 1 derivation just to remember what the user was
 * looking at.
 */
const LAST_PAIRS_KEY = 'cs:lastPairs';
const LAST_EXCHANGE_KEY = 'cs:lastExchange';
const LAST_SYMBOL_KEY = 'cs:lastSymbol';
const DEFAULT_PAIRS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'];
const DEFAULT_EXCHANGE: ExchangeId = 'okx';
const DEFAULT_SYMBOL = 'BTCUSDT';
const DEFAULT_INTERVAL: Interval = '1h';

const isExchangeId = (v: unknown): v is ExchangeId =>
  v === 'binance' || v === 'okx' || v === 'bybit';

export type ChartState = {
  exchange: ExchangeId;
  symbol: string;
  interval: Interval;
  recentPairs: string[];
  setExchange: (e: ExchangeId) => void;
  setSymbol: (s: string) => void;
  setInterval: (i: Interval) => void;
};

export const useChartState = (): ChartState => {
  const [exchange, setExchange] = useState<ExchangeId>(DEFAULT_EXCHANGE);
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [interval, setInterval] = useState<Interval>(DEFAULT_INTERVAL);
  const [recentPairs, setRecentPairs] = useState<string[]>(DEFAULT_PAIRS);

  // Rehydrate from localStorage on mount (post-hydration to avoid mismatch).
  useEffect(() => {
    try {
      const exRaw = localStorage.getItem(LAST_EXCHANGE_KEY);
      if (exRaw && isExchangeId(exRaw)) setExchange(exRaw);
      const symRaw = localStorage.getItem(LAST_SYMBOL_KEY);
      if (symRaw && typeof symRaw === 'string' && symRaw.trim()) setSymbol(symRaw);
      const pairsRaw = localStorage.getItem(LAST_PAIRS_KEY);
      const pairsParsed = pairsRaw ? JSON.parse(pairsRaw) : null;
      if (Array.isArray(pairsParsed) && pairsParsed.every((p) => typeof p === 'string')) {
        setRecentPairs(pairsParsed);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist symbol changes + update recents.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAST_PAIRS_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      const prev: string[] = Array.isArray(parsed) ? parsed : DEFAULT_PAIRS;
      const next = [symbol, ...prev.filter((s) => s !== symbol)].slice(0, 6);
      localStorage.setItem(LAST_PAIRS_KEY, JSON.stringify(next));
      setRecentPairs(next);
      localStorage.setItem(LAST_SYMBOL_KEY, symbol);
    } catch {}
  }, [symbol]);

  // Persist exchange changes.
  useEffect(() => {
    try { localStorage.setItem(LAST_EXCHANGE_KEY, exchange); } catch {}
  }, [exchange]);

  return { exchange, symbol, interval, recentPairs, setExchange, setSymbol, setInterval };
};