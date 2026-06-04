'use client';
import useSWR from 'swr';
import { getTicker, type Ticker24h } from '../binance';

const fetcher = async (key: string): Promise<Ticker24h> => getTicker(key);

export const useTicker = (symbol: string) => {
  const { data, error, isLoading, mutate } = useSWR<Ticker24h>(`ticker:${symbol}`, fetcher, {
    refreshInterval: 15000,
    revalidateOnFocus: false,
  });
  return { ticker: data ?? null, error, isLoading, refresh: mutate };
};
