/**
 * Backward-compat shim. All Binance logic now lives in `lib/exchanges/binance.ts`.
 * Prefer importing from `lib/exchanges/registry` for new code.
 */
import { binanceProvider } from './exchanges/binance';

export const BASE = 'https://api.binance.com';
export type Interval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w';

export type Ticker24h = {
  symbol: string;
  lastPrice: number;
  priceChangePercent: number;
  quoteVolume: number;
};

export type SymbolInfo = { symbol: string; base: string; quote: string };

export const getKlines = (symbol: string, interval: Interval, limit = 500) =>
  binanceProvider.getKlines(symbol, interval, limit);

export const getTicker = (symbol: string): Promise<Ticker24h> =>
  binanceProvider.getTicker(symbol);

export const getUsdtSymbols = (): Promise<SymbolInfo[]> =>
  binanceProvider.getUsdtSymbols();
