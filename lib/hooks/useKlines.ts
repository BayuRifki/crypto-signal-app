'use client';
import useSWR from 'swr';
import { getKlines, type Interval } from '../binance';
import type { Candle } from '../utils';

const fetcher = async (key: string): Promise<Candle[]> => {
  const [symbol, interval, limit] = key.split('|') as [string, Interval, string];
  return getKlines(symbol, interval, Number(limit));
};

export const useKlines = (symbol: string, interval: Interval, limit = 500) => {
  const key = `${symbol}|${interval}|${limit}`;
  const { data, error, isLoading, mutate } = useSWR<Candle[]>(key, fetcher, {
    refreshInterval: 30000,
    revalidateOnFocus: false,
  });
  return { candles: data ?? [], error, isLoading, refresh: mutate };
};
