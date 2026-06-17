'use client';
import useSWR from 'swr';
import { getKlinesWithFallback, type FallbackResult } from '../exchanges/fallback';
import type { ExchangeId } from '../exchanges/fallback';
import type { Interval } from '../exchanges/types';
import type { Candle } from '../utils';

type KlinesPayload = { data: Candle[]; exchangeId: string };

const fetchDirect = async (exchange: ExchangeId, symbol: string, interval: Interval, limit: number): Promise<FallbackResult<Candle[]>> => {
  return getKlinesWithFallback(symbol, interval, limit, exchange);
};

const fetchProxy = async (exchange: ExchangeId, symbol: string, interval: Interval, limit: number): Promise<FallbackResult<Candle[]>> => {
  const res = await fetch(`/api/exchanges/${exchange}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`proxy ${res.status}`);
  const json = (await res.json()) as KlinesPayload;
  return { data: json.data, exchangeId: (json.exchangeId as ExchangeId) ?? exchange, attempts: [{ id: (json.exchangeId as ExchangeId) ?? exchange, ok: true }] };
};

const fetcher = async (key: string): Promise<FallbackResult<Candle[]>> => {
  const [, exchange, symbol, interval, limit] = key.split('|') as [string, ExchangeId, string, Interval, string];
  const lim = Number(limit);
  try {
    return await fetchDirect(exchange, symbol, interval, lim);
  } catch {
    return await fetchProxy(exchange, symbol, interval, lim);
  }
};

export const useKlines = (exchange: ExchangeId, symbol: string, interval: Interval, limit = 500) => {
  const key = `klines|${exchange}|${symbol}|${interval}|${limit}`;
  const { data, error, isLoading, mutate } = useSWR<FallbackResult<Candle[]>>(key, fetcher, {
    refreshInterval: 30000,
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
  return {
    candles: data?.data ?? [],
    sourceExchange: data?.exchangeId ?? null,
    attempts: data?.attempts ?? [],
    error,
    isLoading,
    refresh: mutate,
  };
};
