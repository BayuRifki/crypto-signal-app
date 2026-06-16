import type { ExchangeProvider, ExchangeId, Interval, SymbolInfo, Ticker24h } from './types';
import { binanceProvider } from './binance';
import { okxProvider } from './okx';
import { bybitProvider } from './bybit';
import type { Candle } from '../utils';

export const exchanges: Record<ExchangeId, ExchangeProvider> = {
  binance: binanceProvider,
  okx: okxProvider,
  bybit: bybitProvider,
};

export const exchangeList: ExchangeProvider[] = [binanceProvider, okxProvider, bybitProvider];

export const getExchange = (id: ExchangeId): ExchangeProvider => {
  const p = exchanges[id];
  if (!p) throw new Error(`Unknown exchange: ${id}`);
  return p;
};

export const getKlines = (id: ExchangeId, symbol: string, interval: Interval, limit?: number): Promise<Candle[]> =>
  getExchange(id).getKlines(symbol, interval, limit);

export const getTicker = (id: ExchangeId, symbol: string): Promise<Ticker24h> =>
  getExchange(id).getTicker(symbol);

export const getUsdtSymbols = (id: ExchangeId): Promise<SymbolInfo[]> =>
  getExchange(id).getUsdtSymbols();

export type { ExchangeProvider, ExchangeId, Interval, SymbolInfo, Ticker24h } from './types';
