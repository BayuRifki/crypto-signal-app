'use client';
import { useEffect, useRef, useState } from 'react';
import type { ExchangeId, Ticker24h } from '../exchanges/types';
import { getExchange } from '../exchanges/registry';

/**
 * Fetches all tickers for the given exchange once, then refreshes every
 * `intervalMs` (default 30s). Returns a map of symbol → Ticker24h.
 *
 * Uses the bulk `getAllTickers()` endpoint when available (single HTTP call
 * for all symbols), falling back to nothing if the method is not implemented.
 */
export function useWatchlistTickers(
  exchange: ExchangeId,
  intervalMs = 30_000,
): Record<string, Ticker24h> {
  const [tickers, setTickers] = useState<Record<string, Ticker24h>>({});
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const load = async () => {
      try {
        const provider = getExchange(exchange);
        if (!provider.getAllTickers) return;
        const data = await provider.getAllTickers();
        if (mountedRef.current) setTickers(data);
      } catch {
        // silently ignore — watchlist tickers are non-critical
      }
    };

    load();
    timer = setInterval(load, intervalMs);

    return () => {
      mountedRef.current = false;
      if (timer) clearInterval(timer);
    };
  }, [exchange, intervalMs]);

  return tickers;
}
