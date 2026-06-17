import { NextRequest, NextResponse } from 'next/server';
import { exchangeList, type ExchangeId } from '@/lib/exchanges/registry';
import { fetchViaCorsProxy, DEFAULT_TIMEOUT_MS } from '@/lib/exchanges/fetch';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID: ReadonlyArray<ExchangeId> = exchangeList.map((e: { id: ExchangeId }) => e.id);
const isValid = (id: string): id is ExchangeId => (VALID as readonly string[]).includes(id);

const providerFor = (id: ExchangeId) =>
  exchangeList.find((e: { id: ExchangeId; name: string }) => e.id === id)!;

export async function GET(_req: NextRequest, ctx: { params: { exchange: string } }) {
  const id = ctx.params.exchange.toLowerCase();
  if (!isValid(id)) {
    return NextResponse.json({ error: `Unknown exchange: ${id}` }, { status: 400 });
  }
  try {
    const provider = providerFor(id);
    const list = await provider.getUsdtSymbols();
    return NextResponse.json(
      { exchange: id, count: list.length, source: 'direct', symbols: list },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' } }
    );
  } catch (e) {
    // Last-resort: public CORS proxy
    if (process.env.DISABLE_CORS_PROXY !== '1') {
      const upstream = upstreamSymbolsUrl(id);
      if (upstream) {
        try {
          const res = await fetchViaCorsProxy(upstream, {}, DEFAULT_TIMEOUT_MS);
          if (res.ok) {
            const body = await res.json();
            const symbols = parseSymbolsResponse(id, body);
            if (symbols.length > 0) {
              return NextResponse.json(
                { exchange: id, count: symbols.length, source: 'public-cors-proxy', symbols },
                { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' } }
              );
            }
          }
        } catch {
          // ignore
        }
      }
    }
    return NextResponse.json(
      { error: (e as Error).message || 'fetch failed', exchange: id },
      { status: 502 }
    );
  }
}

const upstreamSymbolsUrl = (id: ExchangeId): string | null => {
  if (id === 'binance') return 'https://api.binance.com/api/v3/exchangeInfo';
  if (id === 'okx') return 'https://www.okx.com/api/v5/public/instruments?instType=SPOT';
  if (id === 'bybit') return 'https://api.bybit.com/v5/market/instruments-info?category=spot&limit=1000';
  return null;
};

const parseSymbolsResponse = (id: ExchangeId, body: unknown): { symbol: string; base: string; quote: string }[] => {
  const b = body as Record<string, unknown>;
  if (id === 'binance' && b && Array.isArray((b as { symbols?: { symbol: string; baseAsset: string; quoteAsset: string; status: string; isSpotTradingAllowed: boolean }[] }).symbols)) {
    return ((b as { symbols: { symbol: string; baseAsset: string; quoteAsset: string; status: string; isSpotTradingAllowed: boolean }[] }).symbols)
      .filter((s) => s.quoteAsset === 'USDT' && s.status === 'TRADING' && s.isSpotTradingAllowed)
      .map((s) => ({ symbol: s.symbol, base: s.baseAsset, quote: s.quoteAsset }));
  }
  if (id === 'okx' && b && Array.isArray((b as { data?: { instId: string; baseCcy: string; quoteCcy: string; state: string }[] }).data)) {
    return ((b as { data: { instId: string; baseCcy: string; quoteCcy: string; state: string }[] }).data)
      .filter((s) => s.quoteCcy === 'USDT' && s.state === 'live')
      .map((s) => ({ symbol: s.instId.replace('-', ''), base: s.baseCcy, quote: s.quoteCcy }));
  }
  if (id === 'bybit' && b && (b as { result?: { list?: { symbol: string; baseCoin: string; quoteCoin: string; status: string }[] } }).result && Array.isArray((b as { result: { list: { symbol: string; baseCoin: string; quoteCoin: string; status: string }[] } }).result.list)) {
    return ((b as { result: { list: { symbol: string; baseCoin: string; quoteCoin: string; status: string }[] } }).result.list)
      .filter((s) => s.quoteCoin === 'USDT' && s.status === 'Trading')
      .map((s) => ({ symbol: s.symbol, base: s.baseCoin, quote: s.quoteCoin }));
  }
  return [];
};
