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

export async function GET(req: NextRequest, ctx: { params: { exchange: string } }) {
  const exId = ctx.params.exchange.toLowerCase() as ExchangeId;
  if (!(VALID_EX as readonly string[]).includes(exId)) {
    return NextResponse.json({ error: `Unknown exchange: ${exId}` }, { status: 400 });
  }
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get('symbol') || '').toUpperCase();
  if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 });

  const provider = providerFor(exId);

  try {
    const ticker = await provider.getTicker(symbol);
    return tickerResponse(exId, ticker, 'direct');
  } catch (directErr) {
    const errorMsg = (directErr as Error).message || 'fetch failed';
    console.error(`[ticker] direct failed for ${exId}/${symbol}:`, errorMsg);
    return NextResponse.json(
      { error: errorMsg, exchangeId: exId, symbol },
      { status: 502 }
    );
  }
}
