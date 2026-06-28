import { NextRequest, NextResponse } from 'next/server';
import { exchangeList, type ExchangeId } from '@/lib/exchanges/registry';
import type { Ticker24h } from '@/lib/exchanges/types';
import { fetchWithTimeout, fetchViaCorsProxy, DEFAULT_TIMEOUT_MS } from '@/lib/exchanges/fetch';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_EX: ReadonlyArray<ExchangeId> = exchangeList.map((e: { id: ExchangeId }) => e.id);

const providerFor = (id: ExchangeId) =>
  exchangeList.find((e: { id: ExchangeId; name: string }) => e.id === id)!;

const tickerResponse = (exchangeId: ExchangeId, ticker: Ticker24h, source: string) =>
  NextResponse.json(
    { data: ticker, exchangeId, source },
    { headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=20' } }
  );

const tryWithCorsProxy = async (url: string): Promise<Response | null> => {
  if (process.env.DISABLE_CORS_PROXY === '1') return null;
  try {
    return await fetchViaCorsProxy(url, {}, DEFAULT_TIMEOUT_MS);
  } catch {
    return null;
  }
};

export async function GET(req: NextRequest, ctx: { params: Promise<{ exchange: string }> }) {
  const { exchange: exchangeParam } = await ctx.params;
  const exId = exchangeParam.toLowerCase() as ExchangeId;
  if (!(VALID_EX as readonly string[]).includes(exId)) {
    return NextResponse.json({ error: `Unknown exchange: ${exId}` }, { status: 400 });
  }
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get('symbol') || '').toUpperCase();
  if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 });

  const provider = providerFor(exId);

  // 1. Direct fetch via exchange provider (has its own retry x3).
  try {
    const ticker = await provider.getTicker(symbol);
    return tickerResponse(exId, ticker, 'direct');
  } catch (directErr) {
    const errorMsg = (directErr as Error).message || 'fetch failed';
    console.error(`[ticker] direct failed for ${exId}/${symbol}:`, errorMsg);

    // 2. Server-side retry to the raw upstream URL (parity with klines route).
    const upstreamUrl = buildUpstreamTickerUrl(exId, symbol);
    if (upstreamUrl) {
      try {
        const proxyRes = await fetchWithTimeout(upstreamUrl, {}, DEFAULT_TIMEOUT_MS);
        if (proxyRes.ok) {
          const body = await proxyRes.json();
          const ticker = parseTickerResponse(exId, body, symbol);
          if (ticker) {
            return tickerResponse(exId, ticker, 'server-proxy');
          }
        }
      } catch (proxyErr) {
        console.error(`[ticker] server-proxy failed for ${exId}/${symbol}:`, (proxyErr as Error).message);
      }

      // 3. Last-resort public CORS proxy (parity with klines/symbols routes).
      try {
        const res = await tryWithCorsProxy(upstreamUrl);
        if (res && res.ok) {
          const body = await res.json();
          const ticker = parseTickerResponse(exId, body, symbol);
          if (ticker) {
            return tickerResponse(exId, ticker, 'public-cors-proxy');
          }
        }
      } catch (corsErr) {
        console.error(`[ticker] cors-proxy failed for ${exId}/${symbol}:`, (corsErr as Error).message);
      }
    }

    return NextResponse.json(
      { error: errorMsg, code: 'UPSTREAM_FAILED', exchangeId: exId, symbol },
      { status: 502 }
    );
  }
}

const buildUpstreamTickerUrl = (exId: ExchangeId, symbol: string): string | null => {
  switch (exId) {
    case 'binance':
      return `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`;
    case 'okx': {
      const inst = symbol.endsWith('USDT') ? `${symbol.slice(0, -4)}-USDT` : symbol;
      return `https://www.okx.com/api/v5/market/ticker?instId=${inst}`;
    }
    case 'bybit':
      return `https://api.bybit.com/v5/market/tickers?category=spot&symbol=${symbol}`;
  }
};

const parseTickerResponse = (exId: ExchangeId, body: unknown, symbol: string): Ticker24h | null => {
  const b = body as Record<string, unknown>;
  try {
    if (exId === 'binance' && b && typeof (b as { lastPrice?: string }).lastPrice === 'string') {
      const t = b as { symbol?: string; lastPrice: string; priceChangePercent: string; quoteVolume: string };
      return {
        symbol: t.symbol ?? symbol,
        lastPrice: Number(t.lastPrice),
        priceChangePercent: Number(t.priceChangePercent),
        quoteVolume: Number(t.quoteVolume),
      };
    }
    if (exId === 'okx' && b && Array.isArray((b as { data?: unknown[] }).data)) {
      const arr = (b as { data: { instId: string; last: string; open24h: string; volCcy24h: string }[] }).data;
      const t = arr[0];
      if (!t) return null;
      const lastPrice = Number(t.last);
      const open24h = Number(t.open24h);
      const changePct = open24h > 0 ? ((lastPrice - open24h) / open24h) * 100 : 0;
      return {
        symbol: t.instId.replace('-', '').toUpperCase(),
        lastPrice,
        priceChangePercent: changePct,
        quoteVolume: Number(t.volCcy24h),
      };
    }
    if (exId === 'bybit' && b && (b as { result?: { list?: unknown[] } }).result && Array.isArray((b as { result: { list: unknown[] } }).result.list)) {
      const arr = (b as { result: { list: { symbol: string; lastPrice: string; price24hPcnt: string; turnover24h: string }[] } }).result.list;
      const t = arr[0];
      if (!t) return null;
      return {
        symbol: t.symbol.toUpperCase(),
        lastPrice: Number(t.lastPrice),
        priceChangePercent: Number(t.price24hPcnt) * 100,
        quoteVolume: Number(t.turnover24h),
      };
    }
  } catch {
    return null;
  }
  return null;
};
