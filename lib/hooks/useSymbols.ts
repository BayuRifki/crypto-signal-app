'use client';
import { getUsdtSymbols, type SymbolInfo } from '../binance';
import useSWR from 'swr';

const fetcher = async (): Promise<SymbolInfo[]> => getUsdtSymbols();

export const useSymbols = () => {
  const { data, error, isLoading } = useSWR<SymbolInfo[]>('symbols', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 3600_000,
  });
  return { symbols: data ?? [], error, isLoading };
};
