/**
 * Regression tests for exchange API route payload contracts.
 * Verifies route success/error payloads match hook expectations.
 */

import { GET as getKlines } from '../app/api/exchanges/[exchange]/klines/route';
import { GET as getTicker } from '../app/api/exchanges/[exchange]/ticker/route';

type FetchResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

const assert = (cond: boolean, msg: string) => {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  console.log('OK:', msg);
};

const stubFetch = (responder: (url: string) => { ok: boolean; status: number; body: unknown }) => {
  (globalThis as unknown as { fetch: (input: string, init?: unknown) => Promise<FetchResponse> }).fetch = async (url: string) => {
    const r = responder(url);
    return { ok: r.ok, status: r.status, json: async () => r.body };
  };
};

const req = (url: string) => new Request(url) as unknown as import('next/server').NextRequest;

const testKlinesDirectPayload = async () => {
  stubFetch((url) => {
    assert(url.includes('/api/v3/klines'), `klines direct uses binance klines endpoint (got ${url})`);
    return {
      ok: true,
      status: 200,
      body: [[1700000000000, '100', '110', '90', '105', '50', 0, 0, 0, 0, 0, 0]],
    };
  });

  const res = await getKlines(req('http://localhost/api/exchanges/binance/klines?symbol=BTCUSDT&interval=1h&limit=1'), { params: Promise.resolve({ exchange: 'binance' }) });
  const body = await res.json() as { data: Array<Record<string, number>>; exchangeId: string; source: string };

  assert(res.status === 200, `klines direct status=200 (got ${res.status})`);
  assert(Array.isArray(body.data), 'klines direct: data is array');
  assert(body.data.length === 1, `klines direct: 1 candle returned (got ${body.data.length})`);
  assert(body.exchangeId === 'binance', `klines direct: exchangeId=binance (got ${body.exchangeId})`);
  assert(body.source === 'direct', `klines direct: source=direct (got ${body.source})`);
  assert(body.data[0].close === 105, `klines direct: close=105 (got ${body.data[0].close})`);
};

const testKlinesProxyPayload = async () => {
  let callCount = 0;
  stubFetch((url) => {
    callCount += 1;
    if (callCount <= 3) {
      throw new Error(`direct blocked #${callCount}`);
    }
    assert(url.includes('/api/v3/klines'), `klines proxy retries same upstream endpoint (got ${url})`);
    return {
      ok: true,
      status: 200,
      body: [[1700000000000, '200', '220', '180', '210', '99', 0, 0, 0, 0, 0, 0]],
    };
  });

  const res = await getKlines(req('http://localhost/api/exchanges/binance/klines?symbol=BTCUSDT&interval=1h&limit=1'), { params: Promise.resolve({ exchange: 'binance' }) });
  const body = await res.json() as { data: Array<Record<string, number>>; exchangeId: string; source: string };

  assert(res.status === 200, `klines proxy status=200 (got ${res.status})`);
  assert(callCount === 4, `klines proxy uses 3 provider retries + 1 route proxy fetch (got ${callCount} calls)`);
  assert(body.exchangeId === 'binance', `klines proxy: exchangeId=binance (got ${body.exchangeId})`);
  assert(body.source === 'server-proxy', `klines proxy: source=server-proxy (got ${body.source})`);
  assert(body.data[0].close === 210, `klines proxy: close=210 (got ${body.data[0].close})`);
};

const testKlinesErrorPayload = async () => {
  stubFetch(() => {
    throw new Error('upstream down');
  });

  const res = await getKlines(req('http://localhost/api/exchanges/binance/klines?symbol=BTCUSDT&interval=1h&limit=1'), { params: Promise.resolve({ exchange: 'binance' }) });
  const body = await res.json() as { error: string; exchangeId: string; symbol: string; interval: string };

  assert(res.status === 502, `klines error status=502 (got ${res.status})`);
  assert(typeof body.error === 'string' && body.error.length > 0, 'klines error: error string present');
  assert(body.exchangeId === 'binance', `klines error: exchangeId=binance (got ${body.exchangeId})`);
  assert(body.symbol === 'BTCUSDT', `klines error: symbol=BTCUSDT (got ${body.symbol})`);
  assert(body.interval === '1h', `klines error: interval=1h (got ${body.interval})`);
};

const testTickerDirectPayload = async () => {
  stubFetch((url) => {
    assert(url.includes('/ticker/24hr'), `ticker direct uses binance ticker endpoint (got ${url})`);
    return {
      ok: true,
      status: 200,
      body: {
        symbol: 'BTCUSDT',
        lastPrice: '105',
        priceChangePercent: '5',
        highPrice: '110',
        lowPrice: '90',
        volume: '123',
        quoteVolume: '456',
      },
    };
  });

  const res = await getTicker(req('http://localhost/api/exchanges/binance/ticker?symbol=BTCUSDT'), { params: Promise.resolve({ exchange: 'binance' }) });
  const body = await res.json() as { data: Record<string, unknown>; exchangeId: string; source: string };

  assert(res.status === 200, `ticker direct status=200 (got ${res.status})`);
  assert(body.exchangeId === 'binance', `ticker direct: exchangeId=binance (got ${body.exchangeId})`);
  assert(body.source === 'direct', `ticker direct: source=direct (got ${body.source})`);
  assert(body.data.symbol === 'BTCUSDT', `ticker direct: symbol=BTCUSDT (got ${String(body.data.symbol)})`);
  assert(body.data.lastPrice === 105, `ticker direct: lastPrice=105 (got ${String(body.data.lastPrice)})`);
};

const testTickerErrorPayload = async () => {
  stubFetch(() => {
    throw new Error('ticker blocked');
  });

  const res = await getTicker(req('http://localhost/api/exchanges/binance/ticker?symbol=ETHUSDT'), { params: Promise.resolve({ exchange: 'binance' }) });
  const body = await res.json() as { error: string; exchangeId: string; symbol: string };

  assert(res.status === 502, `ticker error status=502 (got ${res.status})`);
  assert(typeof body.error === 'string' && body.error.length > 0, 'ticker error: error string present');
  assert(body.exchangeId === 'binance', `ticker error: exchangeId=binance (got ${body.exchangeId})`);
  assert(body.symbol === 'ETHUSDT', `ticker error: symbol=ETHUSDT (got ${body.symbol})`);
};

// ── Ticker fallback parity (assessment R3) ─────────────────────────────────────
// The ticker route must mirror the klines route's resilience: after the provider
// (3 internal retries) fails, the route retries the raw upstream URL, then the
// public CORS proxy, before finally returning 502.

const testTickerServerProxyFallback = async () => {
  let callCount = 0;
  stubFetch((url) => {
    callCount += 1;
    if (callCount <= 3) {
      // First 3 calls = provider.getTicker internal retries (all fail).
      throw new Error(`direct blocked #${callCount}`);
    }
    // 4th call = route server-proxy retry to the raw upstream ticker endpoint.
    assert(url.includes('/ticker/24hr'), `ticker server-proxy retries upstream ticker endpoint (got ${url})`);
    return {
      ok: true,
      status: 200,
      body: {
        symbol: 'BTCUSDT',
        lastPrice: '42000',
        priceChangePercent: '2.5',
        quoteVolume: '999',
      },
    };
  });

  const res = await getTicker(req('http://localhost/api/exchanges/binance/ticker?symbol=BTCUSDT'), { params: Promise.resolve({ exchange: 'binance' }) });
  const body = await res.json() as { data: Record<string, unknown>; exchangeId: string; source: string };

  assert(res.status === 200, `ticker server-proxy status=200 (got ${res.status})`);
  assert(callCount === 4, `ticker server-proxy uses 3 provider retries + 1 route upstream fetch (got ${callCount})`);
  assert(body.exchangeId === 'binance', `ticker server-proxy: exchangeId=binance (got ${body.exchangeId})`);
  assert(body.source === 'server-proxy', `ticker server-proxy: source=server-proxy (got ${body.source})`);
  assert(body.data.lastPrice === 42000, `ticker server-proxy: lastPrice=42000 (got ${String(body.data.lastPrice)})`);
  assert(body.data.priceChangePercent === 2.5, `ticker server-proxy: priceChangePercent=2.5 (got ${String(body.data.priceChangePercent)})`);
};

const testTickerCorsProxyFallback = async () => {
  let callCount = 0;
  stubFetch((url) => {
    callCount += 1;
    if (callCount <= 3) {
      // Provider retries fail.
      throw new Error(`direct blocked #${callCount}`);
    }
    if (callCount === 4) {
      // Route server-proxy upstream fetch also fails (non-ok).
      assert(url.includes('/ticker/24hr'), `ticker cors-proxy: server-proxy hits upstream (got ${url})`);
      return { ok: false, status: 503, body: { msg: 'upstream down' } };
    }
    // callCount >= 5: public CORS proxy tier (url wrapped by corsproxy / allorigins).
    assert(url.includes('corsproxy.io') || url.includes('allorigins.win'), `ticker cors-proxy: uses a public CORS proxy host (got ${url})`);
    return {
      ok: true,
      status: 200,
      body: {
        symbol: 'BTCUSDT',
        lastPrice: '43000',
        priceChangePercent: '1.25',
        quoteVolume: '1234',
      },
    };
  });

  const res = await getTicker(req('http://localhost/api/exchanges/binance/ticker?symbol=BTCUSDT'), { params: Promise.resolve({ exchange: 'binance' }) });
  const body = await res.json() as { data: Record<string, unknown>; exchangeId: string; source: string };

  assert(res.status === 200, `ticker cors-proxy status=200 (got ${res.status})`);
  assert(callCount >= 5, `ticker cors-proxy reaches the CORS proxy tier after server-proxy fails (got ${callCount} calls)`);
  assert(body.exchangeId === 'binance', `ticker cors-proxy: exchangeId=binance (got ${body.exchangeId})`);
  assert(body.source === 'public-cors-proxy', `ticker cors-proxy: source=public-cors-proxy (got ${body.source})`);
  assert(body.data.lastPrice === 43000, `ticker cors-proxy: lastPrice=43000 (got ${String(body.data.lastPrice)})`);
};

const testTickerOkxProxyFallback = async () => {
  // Verify the OKX upstream URL builder + parser work through the proxy path.
  let callCount = 0;
  stubFetch((url) => {
    callCount += 1;
    if (callCount <= 3) throw new Error(`direct blocked #${callCount}`);
    assert(url.includes('/api/v5/market/ticker'), `ticker okx proxy: upstream is okx ticker endpoint (got ${url})`);
    assert(url.includes('BTC-USDT'), `ticker okx proxy: symbol normalized to BTC-USDT (got ${url})`);
    return {
      ok: true,
      status: 200,
      body: { code: '0', data: [{ instId: 'BTC-USDT', last: '50000', open24h: '49000', volCcy24h: '500' }] },
    };
  });

  const res = await getTicker(req('http://localhost/api/exchanges/okx/ticker?symbol=BTCUSDT'), { params: Promise.resolve({ exchange: 'okx' }) });
  const body = await res.json() as { data: Record<string, unknown>; exchangeId: string; source: string };

  assert(res.status === 200, `ticker okx proxy status=200 (got ${res.status})`);
  assert(body.source === 'server-proxy', `ticker okx proxy: source=server-proxy (got ${body.source})`);
  assert(body.data.symbol === 'BTCUSDT', `ticker okx proxy: symbol normalized back to BTCUSDT (got ${String(body.data.symbol)})`);
  assert(body.data.lastPrice === 50000, `ticker okx proxy: lastPrice=50000 (got ${String(body.data.lastPrice)})`);
};

const testHookKeyFormats = () => {
  const klinesKey = `klines|okx|BTCUSDT|1h|500`;
  const tickerKey = `ticker|binance|ETHUSDT`;
  const candleSourceKey = `okx|BTCUSDT|1h|500`;

  assert(klinesKey.split('|').length === 5, 'useKlines key has 5 parts');
  assert(tickerKey.split('|').length === 3, 'useTicker key has 3 parts');
  assert(candleSourceKey.split('|').length === 4, 'useCandleSource key has 4 parts');
};

const run = async () => {
  await testKlinesDirectPayload();
  await testKlinesProxyPayload();
  await testKlinesErrorPayload();
  await testTickerDirectPayload();
  await testTickerErrorPayload();
  await testTickerServerProxyFallback();
  await testTickerCorsProxyFallback();
  await testTickerOkxProxyFallback();
  testHookKeyFormats();
  console.log('\nAll API contract tests passed.');
};

run().catch((e) => { console.error('Test crashed:', e); process.exit(1); });
