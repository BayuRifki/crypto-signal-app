import type { Candle } from '../utils';
import type { ExchangeProvider, Interval, SymbolInfo, Ticker24h } from './types';
import { fetchWithTimeout, DEFAULT_TIMEOUT_MS } from './fetch';

const BASE = 'https://api.bybit.com';

const mapInterval = (i: Interval): string => {
  switch (i) {
    case '1m': return '1';
    case '5m': return '5';
    case '15m': return '15';
    case '1h': return '60';
    case '4h': return '240';
    case '1d': return 'D';
    case '1w': return 'W';
  }
};

const toNativeSymbol = (s: string) => s.toUpperCase();
const toNormalizedSymbol = (s: string) => s.toUpperCase();

const fetchJson = async <T,>(url: string, attempt = 0): Promise<T> => {
  try {
    const res = await fetchWithTimeout(url, {}, DEFAULT_TIMEOUT_MS);
    if (!res.ok) throw new Error(`bybit HTTP ${res.status} (${res.statusText}) for ${url}`);
    const json = (await res.json()) as { retCode: number; retMsg?: string; result?: unknown } & T;
    if (json.retCode !== 0) {
      throw new Error(`bybit ${json.retCode}: ${json.retMsg ?? 'unknown error'} for ${url}`);
    }
    return json;
  } catch (err) {
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      return fetchJson<T>(url, attempt + 1);
    }
    throw err;
  }
};

let symbolsCache: { data: SymbolInfo[]; ts: number } | null = null;

export const bybitProvider: ExchangeProvider = {
  id: 'bybit',
  name: 'Bybit',

  async getKlines(symbol: string, interval: Interval, limit = 200): Promise<Candle[]> {
    const url = `${BASE}/v5/market/klines?category=spot&symbol=${toNativeSymbol(symbol)}&interval=${mapInterval(interval)}&limit=${Math.min(limit, 1000)}`;
    const json = await fetchJson<{ result: { list: string[][] } }>(url);
    const raw = json.result?.list ?? [];
    // Bybit returns DESC (newest first). Each row: [ts, open, high, low, close, volume, turnover]
    // Must reverse to ASC for lightweight-charts which requires ascending time order.
    return raw.map((r) => ({
      time: Math.floor(Number(r[0]) / 1000),
      open: Number(r[1]),
      high: Number(r[2]),
      low: Number(r[3]),
      close: Number(r[4]),
      volume: Number(r[5]),
    })).reverse();
  },

  async getTicker(symbol: string): Promise<Ticker24h> {
    const url = `${BASE}/v5/market/tickers?category=spot&symbol=${toNativeSymbol(symbol)}`;
    const json = await fetchJson<{ result: { list: { symbol: string; lastPrice: string; price24hPcnt: string; turnover24h: string }[] } }>(url);
    const t = json.result?.list?.[0];
    if (!t) throw new Error('Bybit ticker empty');
    return {
      symbol: toNormalizedSymbol(t.symbol),
      lastPrice: Number(t.lastPrice),
      priceChangePercent: Number(t.price24hPcnt) * 100,
      quoteVolume: Number(t.turnover24h),
    };
  },

  async getAllTickers(): Promise<Record<string, Ticker24h>> {
    const url = `${BASE}/v5/market/tickers?category=spot`;
    const json = await fetchJson<{ result: { list: { symbol: string; lastPrice: string; price24hPcnt: string; turnover24h: string }[] } }>(url);
    const map: Record<string, Ticker24h> = {};
    for (const t of json.result?.list ?? []) {
      const sym = toNormalizedSymbol(t.symbol);
      if (!sym.endsWith('USDT')) continue;
      map[sym] = {
        symbol: sym,
        lastPrice: Number(t.lastPrice),
        priceChangePercent: Number(t.price24hPcnt) * 100,
        quoteVolume: Number(t.turnover24h),
      };
    }
    return map;
  },

  async getUsdtSymbols(): Promise<SymbolInfo[]> {
    const TTL = 60 * 60 * 1000;
    if (symbolsCache && Date.now() - symbolsCache.ts < TTL) return symbolsCache.data;
    const url = `${BASE}/v5/market/instruments-info?category=spot&limit=1000`;
    const json = await fetchJson<{ result: { list: { symbol: string; baseCoin: string; quoteCoin: string; status: string }[] } }>(url);
    const list = (json.result?.list ?? [])
      .filter((s) => s.quoteCoin === 'USDT' && s.status === 'Trading')
      .map((s) => ({ symbol: toNormalizedSymbol(s.symbol), base: s.baseCoin, quote: s.quoteCoin }));
    symbolsCache = { data: list, ts: Date.now() };
    return list;
  },
};
