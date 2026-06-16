/**
 * Tests for exchange provider symbol translation and registry.
 * Network calls are stubbed via global.fetch.
 */

type FetchFn = (input: string) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

const assert = (cond: boolean, msg: string) => {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  console.log('OK:', msg);
};

// ── Symbol translation (pure, no network) ──────────────────────────────────

import { exchangeList } from '../lib/exchanges/registry';

// We test translation indirectly through provider.getKlines by mocking fetch.
const stubFetch = (responder: (url: string) => { ok: boolean; status: number; body: unknown }) => {
  (global as unknown as { fetch: FetchFn }).fetch = async (url: string) => {
    const r = responder(url);
    return { ok: r.ok, status: r.status, json: async () => r.body };
  };
};

// ── OKX symbol translation ─────────────────────────────────────────────────

const testOkx = async () => {
  const okx = exchangeList.find((e) => e.id === 'okx')!;

  stubFetch((url) => {
    if (url.includes('/market/candles')) {
      // Return 1 candle: [ts, o, h, l, c, vol, volCcy, volCcyQuote, confirm]
      return {
        ok: true,
        status: 200,
        body: { code: '0', data: [['1700000000000', '100', '110', '90', '105', '50', '5000', '500000', '1']] },
      };
    }
    throw new Error('unexpected URL: ' + url);
  });

  const candles = await okx.getKlines('BTCUSDT', '1h', 1);
  assert(candles.length === 1, 'OKX returns 1 candle');
  assert(candles[0].open === 100, 'OKX open=100');
  assert(candles[0].close === 105, 'OKX close=105');
  assert(candles[0].time === 1700000000, 'OKX time is unix seconds');
  // Verify URL used dash format
  stubFetch((url) => {
    assert(url.includes('instId=BTC-USDT'), `OKX URL uses BTC-USDT (got ${url})`);
    assert(url.includes('bar=1H'), `OKX URL uses 1H (got ${url})`);
    return { ok: true, status: 200, body: { code: '0', data: [] } };
  });
  await okx.getKlines('BTCUSDT', '1h', 1);
};

// ── Bybit symbol translation ───────────────────────────────────────────────

const testBybit = async () => {
  const bybit = exchangeList.find((e) => e.id === 'bybit')!;

  stubFetch((url) => {
    if (url.includes('/v5/market/klines')) {
      return {
        ok: true,
        status: 200,
        body: {
          retCode: 0,
          result: {
            list: [['1700000000000', '100', '110', '90', '105', '50', '5000']],
          },
        },
      };
    }
    throw new Error('unexpected URL: ' + url);
  });
  const candles = await bybit.getKlines('BTCUSDT', '1h', 1);
  assert(candles.length === 1, 'Bybit returns 1 candle');
  assert(candles[0].open === 100, 'Bybit open=100');
  assert(candles[0].close === 105, 'Bybit close=105');

  // Verify URL used 60 for 1h
  stubFetch((url) => {
    assert(url.includes('interval=60'), `Bybit URL uses 60 (got ${url})`);
    assert(url.includes('category=spot'), 'Bybit URL uses category=spot');
    return { ok: true, status: 200, body: { retCode: 0, result: { list: [] } } };
  });
  await bybit.getKlines('BTCUSDT', '1h', 1);
};

// ── Binance still works (regression) ──────────────────────────────────────

const testBinance = async () => {
  const binance = exchangeList.find((e) => e.id === 'binance')!;

  stubFetch((url) => {
    if (url.includes('/api/v3/klines')) {
      return {
        ok: true,
        status: 200,
        body: [[1700000000000, '100', '110', '90', '105', '50', 0, 0, 0, 0, 0, 0]],
      };
    }
    throw new Error('unexpected URL: ' + url);
  });
  const candles = await binance.getKlines('BTCUSDT', '1h', 1);
  assert(candles.length === 1, 'Binance returns 1 candle');
  assert(candles[0].open === 100, 'Binance open=100');
  assert(candles[0].close === 105, 'Binance close=105');
};

// ── Error handling ────────────────────────────────────────────────────────

const testErrorHandling = async () => {
  const okx = exchangeList.find((e) => e.id === 'okx')!;
  stubFetch(() => ({ ok: true, status: 200, body: { code: '50001', msg: 'invalid instId' } }));
  try {
    await okx.getKlines('BTCUSDT', '1h', 1);
    assert(false, 'OKX should throw on non-zero code');
  } catch (e) {
    assert((e as Error).message.includes('50001'), 'OKX error message contains code');
  }

  const bybit = exchangeList.find((e) => e.id === 'bybit')!;
  stubFetch(() => ({ ok: true, status: 200, body: { retCode: 10001, retMsg: 'bad symbol' } }));
  try {
    await bybit.getKlines('BAD', '1h', 1);
    assert(false, 'Bybit should throw on non-zero retCode');
  } catch (e) {
    assert((e as Error).message.includes('10001'), 'Bybit error message contains code');
  }
};

// ── Ticker parsing ────────────────────────────────────────────────────────

const testTickers = async () => {
  const okx = exchangeList.find((e) => e.id === 'okx')!;
  stubFetch(() => ({
    ok: true,
    status: 200,
    body: { code: '0', data: [{ instId: 'BTC-USDT', last: '105', open24h: '100', volCcy24h: '1234567' }] },
  }));
  const t1 = await okx.getTicker('BTCUSDT');
  assert(t1.symbol === 'BTCUSDT', 'OKX ticker symbol normalized');
  assert(t1.lastPrice === 105, 'OKX ticker lastPrice');
  assert(Math.abs(t1.priceChangePercent - 5) < 0.001, `OKX ticker changePct=5 (got ${t1.priceChangePercent})`);

  const bybit = exchangeList.find((e) => e.id === 'bybit')!;
  stubFetch(() => ({
    ok: true,
    status: 200,
    body: {
      retCode: 0,
      result: { list: [{ symbol: 'BTCUSDT', lastPrice: '105', price24hPcnt: '0.05', turnover24h: '1234567' }] },
    },
  }));
  const t2 = await bybit.getTicker('BTCUSDT');
  assert(t2.symbol === 'BTCUSDT', 'Bybit ticker symbol normalized');
  assert(t2.lastPrice === 105, 'Bybit ticker lastPrice');
  assert(Math.abs(t2.priceChangePercent - 5) < 0.001, `Bybit ticker changePct=5 (got ${t2.priceChangePercent})`);
};

// ── Symbols list ──────────────────────────────────────────────────────────

const testSymbols = async () => {
  const okx = exchangeList.find((e) => e.id === 'okx')!;
  stubFetch(() => ({
    ok: true,
    status: 200,
    body: {
      code: '0',
      data: [
        { instId: 'BTC-USDT', baseCcy: 'BTC', quoteCcy: 'USDT', state: 'live' },
        { instId: 'ETH-USDT', baseCcy: 'ETH', quoteCcy: 'USDT', state: 'live' },
        { instId: 'DOGE-USDT', baseCcy: 'DOGE', quoteCcy: 'USDT', state: 'live' },
        { instId: 'BTC-EUR', baseCcy: 'BTC', quoteCcy: 'EUR', state: 'live' },
        { instId: 'XRP-USDT', baseCcy: 'XRP', quoteCcy: 'USDT', state: 'suspend' },
      ],
    },
  }));
  const syms = await okx.getUsdtSymbols();
  assert(syms.length === 3, `OKX filters non-USDT and non-live (got ${syms.length})`);
  assert(syms.every((s) => s.symbol === s.base + s.quote), 'OKX symbols normalized to BTCUSDT form');
  assert(syms[0].symbol === 'BTCUSDT', 'OKX first symbol is BTCUSDT');
};

const run = async () => {
  await testOkx();
  await testBybit();
  await testBinance();
  await testErrorHandling();
  await testTickers();
  await testSymbols();
  console.log('\nAll Exchange tests passed.');
};

run().catch((e) => { console.error('Test crashed:', e); process.exit(1); });
