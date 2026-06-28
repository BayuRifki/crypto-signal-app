'use client';
import useSWR from 'swr';
import { getTickerWithFallback, type FallbackResult } from '../exchanges/fallback';
import type { ExchangeId } from '../exchanges/fallback';
import type { Ticker24h } from '../exchanges/types';

type TickerPayload = { data: Ticker24h; exchangeId: string };

const fetchDirect = async (exchange: ExchangeId, symbol: string): Promise<FallbackResult<Ticker24h>> =>
  getTickerWithFallback(symbol, exchange);

const fetchProxy = async (exchange: ExchangeId, symbol: string): Promise<FallbackResult<Ticker24h>> => {
  const res = await fetch(`/api/exchanges/${exchange}/ticker?symbol=${encodeURIComponent(symbol)}`, { cache: 'no-store' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`proxy ${res.status}: ${body.error ?? res.statusText}`);
  }
  const json = (await res.json()) as TickerPayload;
  return { data: json.data, exchangeId: (json.exchangeId as ExchangeId) ?? exchange, attempts: [{ id: (json.exchangeId as ExchangeId) ?? exchange, ok: true }] };
};

const fetcher = async (key: string): Promise<FallbackResult<Ticker24h>> => {
  const [, exchange, symbol] = key.split('|') as [string, ExchangeId, string];
  try {
    return await fetchDirect(exchange, symbol);
  } catch (directErr) {
    if (typeof console !== 'undefined') console.warn('[useTicker] direct failed:', directErr);
    try {
      return await fetchProxy(exchange, symbol);
    } catch (proxyErr) {
      if (typeof console !== 'undefined') console.error('[useTicker] proxy also failed:', proxyErr);
      throw proxyErr;
    }
  }
};

export const useTicker = (exchange: ExchangeId, symbol: string) => {
  const { data, error, isLoading, mutate } = useSWR<FallbackResult<Ticker24h>>(`ticker|${exchange}|${symbol}`, fetcher, {
    refreshInterval: 15000,
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
  return {
    ticker: data?.data ?? null,
    sourceExchange: data?.exchangeId ?? null,
    error,
    isLoading,
    refresh: mutate,
  };
};
