import type { Candle } from '../utils';

export type Interval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w';

export type Ticker24h = {
  symbol: string;
  lastPrice: number;
  priceChangePercent: number;
  quoteVolume: number;
};

export type SymbolInfo = { symbol: string; base: string; quote: string };

export type ExchangeId = 'binance' | 'okx' | 'bybit';

export interface ExchangeProvider {
  id: ExchangeId;
  name: string;
  /** Fetch OHLCV candlesticks (newest last). Symbol is in normalized form (e.g. BTCUSDT). */
  getKlines(symbol: string, interval: Interval, limit?: number): Promise<Candle[]>;
  /** Fetch 24h ticker stats. Symbol is in normalized form. */
  getTicker(symbol: string): Promise<Ticker24h>;
  /** Fetch all tradeable USDT-quoted spot symbols in normalized form (BTCUSDT). */
  getUsdtSymbols(): Promise<SymbolInfo[]>;
}
