import type { Candle } from '../utils';
import type { ExchangeProvider, Interval, SymbolInfo, Ticker24h } from './types';
import { fetchWithTimeout, DEFAULT_TIMEOUT_MS } from './fetch';

const BASE = 'https://api.binance.com';

const mapInterval = (i: Interval): string => i;
const toNativeSymbol = (s: string) => s.toUpperCase();
const toNormalizedSymbol = (s: string) => s.toUpperCase();

const mapKline = (k: (string | number)[]): Candle => ({
  time: Math.floor(Number(k[0]) / 1000),
  open: Number(k[1]),
  high: Number(k[2]),
  low: Number(k[3]),
  close: Number(k[4]),
  volume: Number(k[5]),
});

const fetchJson = async <T,>(url: string, attempt = 0): Promise<T> => {
  try {
    const res = await fetchWithTimeout(url, {}, DEFAULT_TIMEOUT_MS);
    if (!res.ok) throw new Error(`binance HTTP ${res.status} (${res.statusText}) for ${url}`);
    return (await res.json()) as T;
  } catch (err) {
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      return fetchJson<T>(url, attempt + 1);
    }
    throw err;
  }
};

let symbolsCache: { data: SymbolInfo[]; ts: number } | null = null;

export const binanceProvider: ExchangeProvider = {
  id: 'binance',
  name: 'Binance',

  async getKlines(symbol: string, interval: Interval, limit = 500): Promise<Candle[]> {
    const url = `${BASE}/api/v3/klines?symbol=${toNativeSymbol(symbol)}&interval=${mapInterval(interval)}&limit=${limit}`;
    const data = await fetchJson<(string | number)[][]>(url);
    return data.map(mapKline);
  },

  async getTicker(symbol: string): Promise<Ticker24h> {
    const url = `${BASE}/api/v3/ticker/24hr?symbol=${toNativeSymbol(symbol)}`;
    const t = await fetchJson<{ symbol: string; lastPrice: string; priceChangePercent: string; quoteVolume: string }>(url);
    return {
      symbol: toNormalizedSymbol(t.symbol),
      lastPrice: Number(t.lastPrice),
      priceChangePercent: Number(t.priceChangePercent),
      quoteVolume: Number(t.quoteVolume),
    };
  },

  async getAllTickers(): Promise<Record<string, Ticker24h>> {
    const url = `${BASE}/api/v3/ticker/24hr`;
    const data = await fetchJson<{ symbol: string; lastPrice: string; priceChangePercent: string; quoteVolume: string }[]>(url);
    const map: Record<string, Ticker24h> = {};
    for (const t of data) {
      map[toNormalizedSymbol(t.symbol)] = {
        symbol: toNormalizedSymbol(t.symbol),
        lastPrice: Number(t.lastPrice),
        priceChangePercent: Number(t.priceChangePercent),
        quoteVolume: Number(t.quoteVolume),
      };
    }
    return map;
  },

  async getUsdtSymbols(): Promise<SymbolInfo[]> {
    const TTL = 60 * 60 * 1000;
    if (symbolsCache && Date.now() - symbolsCache.ts < TTL) return symbolsCache.data;
    const url = `${BASE}/api/v3/exchangeInfo`;
    const info = await fetchJson<{ symbols: { symbol: string; baseAsset: string; quoteAsset: string; status: string; isSpotTradingAllowed: boolean }[] }>(url);
    const list = info.symbols
      .filter((s) => s.quoteAsset === 'USDT' && s.status === 'TRADING' && s.isSpotTradingAllowed)
      .map((s) => ({ symbol: toNormalizedSymbol(s.symbol), base: s.baseAsset, quote: s.quoteAsset }));
    symbolsCache = { data: list, ts: Date.now() };
    return list;
  },
};
