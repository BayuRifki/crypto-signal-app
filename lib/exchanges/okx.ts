import type { Candle } from '../utils';
import type { ExchangeProvider, Interval, SymbolInfo, Ticker24h } from './types';
import { fetchWithTimeout, DEFAULT_TIMEOUT_MS } from './fetch';

const BASE = 'https://www.okx.com';

const mapInterval = (i: Interval): string => {
  switch (i) {
    case '1m': return '1m';
    case '5m': return '5m';
    case '15m': return '15m';
    case '1h': return '1H';
    case '4h': return '4H';
    case '1d': return '1D';
    case '1w': return '1W';
  }
};

const toNativeSymbol = (s: string): string => {
  const norm = s.toUpperCase();
  if (norm.endsWith('USDT')) return `${norm.slice(0, -4)}-USDT`;
  return norm;
};

const toNormalizedSymbol = (native: string): string => native.replace('-', '').toUpperCase();

const fetchJson = async <T,>(url: string, attempt = 0): Promise<T> => {
  try {
    const res = await fetchWithTimeout(url, {}, DEFAULT_TIMEOUT_MS);
    if (!res.ok) throw new Error(`okx HTTP ${res.status} (${res.statusText}) for ${url}`);
    const json = (await res.json()) as { code?: string; msg?: string } & T;
    if (json.code && json.code !== '0') {
      throw new Error(`okx ${json.code}: ${json.msg ?? 'unknown error'}`);
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

export const okxProvider: ExchangeProvider = {
  id: 'okx',
  name: 'OKX',

  async getKlines(symbol: string, interval: Interval, limit = 300): Promise<Candle[]> {
    const instId = toNativeSymbol(symbol);
    const url = `${BASE}/api/v5/market/candles?instId=${instId}&bar=${mapInterval(interval)}&limit=${Math.min(limit, 300)}`;
    const json = await fetchJson<{ data: string[][] }>(url);
    const raw = json.data ?? [];
    // OKX returns DESC (newest first). Each row: [ts, o, h, l, c, vol, volCcy, volCcyQuote, confirm]
    const mapped: Candle[] = raw.map((r) => ({
      time: Math.floor(Number(r[0]) / 1000),
      open: Number(r[1]),
      high: Number(r[2]),
      low: Number(r[3]),
      close: Number(r[4]),
      volume: Number(r[5]),
    }));
    return mapped.reverse();
  },

  async getTicker(symbol: string): Promise<Ticker24h> {
    const instId = toNativeSymbol(symbol);
    const url = `${BASE}/api/v5/market/ticker?instId=${instId}`;
    const json = await fetchJson<{ data: { instId: string; last: string; open24h: string; volCcy24h: string }[] }>(url);
    const t = json.data?.[0];
    if (!t) throw new Error('OKX ticker empty');
    const lastPrice = Number(t.last);
    const open24h = Number(t.open24h);
    const changePct = open24h > 0 ? ((lastPrice - open24h) / open24h) * 100 : 0;
    return {
      symbol: toNormalizedSymbol(t.instId),
      lastPrice,
      priceChangePercent: changePct,
      quoteVolume: Number(t.volCcy24h),
    };
  },

  async getAllTickers(): Promise<Record<string, Ticker24h>> {
    const url = `${BASE}/api/v5/market/tickers?instType=SPOT`;
    const json = await fetchJson<{ data: { instId: string; last: string; open24h: string; volCcy24h: string }[] }>(url);
    const map: Record<string, Ticker24h> = {};
    for (const t of json.data ?? []) {
      const sym = toNormalizedSymbol(t.instId);
      if (!sym.endsWith('USDT')) continue;
      const lastPrice = Number(t.last);
      const open24h = Number(t.open24h);
      const changePct = open24h > 0 ? ((lastPrice - open24h) / open24h) * 100 : 0;
      map[sym] = {
        symbol: sym,
        lastPrice,
        priceChangePercent: changePct,
        quoteVolume: Number(t.volCcy24h),
      };
    }
    return map;
  },

  async getUsdtSymbols(): Promise<SymbolInfo[]> {
    const TTL = 60 * 60 * 1000;
    if (symbolsCache && Date.now() - symbolsCache.ts < TTL) return symbolsCache.data;
    const url = `${BASE}/api/v5/public/instruments?instType=SPOT`;
    const json = await fetchJson<{ data: { instId: string; baseCcy: string; quoteCcy: string; state: string }[] }>(url);
    const list = (json.data ?? [])
      .filter((s) => s.quoteCcy === 'USDT' && s.state === 'live')
      .map((s) => ({ symbol: toNormalizedSymbol(s.instId), base: s.baseCcy, quote: s.quoteCcy }));
    symbolsCache = { data: list, ts: Date.now() };
    return list;
  },
};
