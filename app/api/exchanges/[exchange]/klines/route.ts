import { NextRequest, NextResponse } from 'next/server';
import { exchangeList, type ExchangeId } from '@/lib/exchanges/registry';
import type { Interval } from '@/lib/exchanges/types';
import { fetchWithTimeout, fetchViaCorsProxy, DEFAULT_TIMEOUT_MS } from '@/lib/exchanges/fetch';
import type { Candle } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_EX: ReadonlyArray<ExchangeId> = exchangeList.map((e: { id: ExchangeId }) => e.id);
const VALID_INT: ReadonlyArray<Interval> = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'];

const providerFor = (id: ExchangeId) =>
  exchangeList.find((e: { id: ExchangeId; name: string }) => e.id === id)!;

const tryWithCorsProxy = async (url: string): Promise<Response | null> => {
  if (process.env.DISABLE_CORS_PROXY === '1') return null;
  try {
    return await fetchViaCorsProxy(url, {}, DEFAULT_TIMEOUT_MS);
  } catch {
    return null;
  }
};

const klinesResponse = (exchangeId: ExchangeId, candles: Candle[], source: string) =>
  NextResponse.json(
    { data: candles, exchangeId, source },
    { headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' } }
  );

export async function GET(req: NextRequest, ctx: { params: { exchange: string } }) {
  const exId = ctx.params.exchange.toLowerCase() as ExchangeId;
  if (!(VALID_EX as readonly string[]).includes(exId)) {
    return NextResponse.json({ error: `Unknown exchange: ${exId}` }, { status: 400 });
  }
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get('symbol') || '').toUpperCase();
  const interval = (searchParams.get('interval') || '1h') as Interval;
  const limit = Number(searchParams.get('limit') || '500');
  if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 });
  if (!(VALID_INT as readonly string[]).includes(interval)) {
    return NextResponse.json({ error: `Bad interval: ${interval}` }, { status: 400 });
  }

  const provider = providerFor(exId);

  try {
    const candles = await provider.getKlines(symbol, interval, limit);
    return klinesResponse(exId, candles, 'direct');
  } catch (directErr) {
    const errorMsg = (directErr as Error).message || 'fetch failed';
    console.error(`[klines] direct failed for ${exId}/${symbol}/${interval}:`, errorMsg);
    const upstreamUrl = buildUpstreamKlinesUrl(exId, symbol, interval, limit);
    if (upstreamUrl) {
      try {
        const proxyRes = await fetchWithTimeout(upstreamUrl, {}, DEFAULT_TIMEOUT_MS);
        if (proxyRes.ok) {
          const body = await proxyRes.json();
          const candles = parseKlinesResponse(exId, body);
          if (candles.length > 0) {
            return klinesResponse(exId, candles, 'server-proxy');
          }
        }
      } catch {
        try {
          const res = await tryWithCorsProxy(upstreamUrl);
          if (res && res.ok) {
            const body = await res.json();
            const candles = parseKlinesResponse(exId, body);
            if (candles.length > 0) {
              return klinesResponse(exId, candles, 'public-cors-proxy');
            }
          }
        } catch (corsErr) {
          console.error(`[klines] cors-proxy failed for ${exId}:`, (corsErr as Error).message);
        }
      }
    }
    return NextResponse.json(
      { error: errorMsg, code: 'UPSTREAM_FAILED', exchangeId: exId, symbol, interval },
      { status: 502 }
    );
  }
}

const buildUpstreamKlinesUrl = (exId: ExchangeId, symbol: string, interval: Interval, limit: number): string | null => {
  switch (exId) {
    case 'binance':
      return `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    case 'okx': {
      const inst = symbol.endsWith('USDT') ? `${symbol.slice(0, -4)}-USDT` : symbol;
      const bar = interval === '1h' ? '1H' : interval === '4h' ? '4H' : interval === '1d' ? '1D' : interval === '1w' ? '1W' : interval;
      return `https://www.okx.com/api/v5/market/candles?instId=${inst}&bar=${bar}&limit=${Math.min(limit, 300)}`;
    }
    case 'bybit': {
      const intv = interval === '1h' ? '60' : interval === '4h' ? '240' : interval === '1d' ? 'D' : interval === '1w' ? 'W' : interval;
      return `https://api.bybit.com/v5/market/klines?category=spot&symbol=${symbol}&interval=${intv}&limit=${Math.min(limit, 1000)}`;
    }
  }
};

const parseKlinesResponse = (exId: ExchangeId, body: unknown): import('@/lib/utils').Candle[] => {
  const b = body as Record<string, unknown>;
  if (exId === 'binance' && Array.isArray(b)) {
    return (b as (string | number)[][]).map((k) => ({
      time: Math.floor(Number(k[0]) / 1000),
      open: Number(k[1]),
      high: Number(k[2]),
      low: Number(k[3]),
      close: Number(k[4]),
      volume: Number(k[5]),
    }));
  }
  if (exId === 'okx' && b && Array.isArray((b as { data?: string[][] }).data)) {
    const arr = (b as { data: string[][] }).data;
    return arr.map((r) => ({
      time: Math.floor(Number(r[0]) / 1000),
      open: Number(r[1]),
      high: Number(r[2]),
      low: Number(r[3]),
      close: Number(r[4]),
      volume: Number(r[5]),
    })).reverse();
  }
  if (exId === 'bybit' && b && (b as { result?: { list?: string[][] } }).result && Array.isArray((b as { result: { list: string[][] } }).result.list)) {
    const arr = (b as { result: { list: string[][] } }).result.list;
    return arr.map((r) => ({
      time: Math.floor(Number(r[0]) / 1000),
      open: Number(r[1]),
      high: Number(r[2]),
      low: Number(r[3]),
      close: Number(r[4]),
      volume: Number(r[5]),
    }));
  }
  return [];
};
