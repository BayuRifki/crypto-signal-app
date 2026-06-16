'use client';
import useSWR from 'swr';
import { getUsdtSymbolsWithFallback, type FallbackResult } from '../exchanges/fallback';
import type { ExchangeId } from '../exchanges/fallback';
import type { SymbolInfo } from '../exchanges/types';

type SymbolsPayload = { exchange?: string; exchangeId?: string; count: number; symbols: SymbolInfo[] };

const fetcher = async (key: string): Promise<FallbackResult<SymbolInfo[]> | null> => {
  const [, exchange] = key.split('|') as [string, ExchangeId];

  try {
    const r = await getUsdtSymbolsWithFallback(exchange);
    if (r.data.length > 0) return r;
  } catch {}

  try {
    const res = await fetch(`/api/exchanges/${exchange}/symbols`, { cache: 'no-store' });
    if (res.ok) {
      const json = (await res.json()) as SymbolsPayload;
      if (Array.isArray(json.symbols) && json.symbols.length > 0) {
        return { data: json.symbols, exchangeId: (json.exchangeId as ExchangeId) ?? exchange, attempts: [{ id: exchange, ok: true }] };
      }
    }
  } catch {}

  return null;
};

export const useSymbols = (exchange: ExchangeId) => {
  const { data, error, isLoading, mutate } = useSWR<FallbackResult<SymbolInfo[]> | null>(`symbols|${exchange}`, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 3600_000,
    shouldRetryOnError: false,
  });
  return {
    symbols: data?.data ?? [],
    sourceExchange: data?.exchangeId ?? null,
    error,
    isLoading,
    refresh: mutate,
  };
};
