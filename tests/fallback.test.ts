/**
 * Tests for auto-fallback chain + circuit breaker.
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

import { _resetBreakers, _getBreakerState, FALLBACK_CONFIG } from '../lib/exchanges/fallback';
import { getKlinesWithFallback, getTickerWithFallback, getUsdtSymbolsWithFallback } from '../lib/exchanges/fallback';

const stubFetch = (responder: (url: string) => { ok: boolean; status: number; body: unknown }) => {
  (global as unknown as { fetch: FetchFn }).fetch = async (url: string) => {
    const r = responder(url);
    return { ok: r.ok, status: r.status, json: async () => r.body };
  };
};

// ── Test 1: First exchange in chain succeeds → returns its data ───────────

const testFirstSucceeds = async () => {
  _resetBreakers();
  stubFetch((url) => {
    if (url.includes('api.binance.com')) {
      return { ok: true, status: 200, body: [[1700000000000, '100', '110', '90', '105', '50', 0, 0, 0, 0, 0, 0]] };
    }
    throw new Error('unexpected URL: ' + url);
  });

  const r = await getKlinesWithFallback('BTCUSDT', '1h', 1, 'binance');
  assert(r.exchangeId === 'binance', `first-succeeds: returns binance (got ${r.exchangeId})`);
  assert(r.data.length === 1, 'first-succeeds: 1 candle returned');
  assert(r.attempts.length === 1, 'first-succeeds: 1 attempt logged');
  assert(r.attempts[0].ok === true, 'first-succeeds: attempt 0 ok');
};

// ── Test 2: First fails, second succeeds → falls through ──────────────────

const testFirstFailsSecondSucceeds = async () => {
  _resetBreakers();
  stubFetch((url) => {
    if (url.includes('api.binance.com')) {
      return { ok: false, status: 500, body: { error: 'server error' } };
    }
    if (url.includes('www.okx.com')) {
      return { ok: true, status: 200, body: { code: '0', data: [[1700000000000, '200', '220', '180', '210', '100', '10000', '1000000', '1']] } };
    }
    throw new Error('unexpected URL: ' + url);
  });

  const r = await getKlinesWithFallback('BTCUSDT', '1h', 1, 'binance');
  assert(r.exchangeId === 'okx', `fallthrough: returns okx (got ${r.exchangeId})`);
  assert(r.data[0].close === 210, 'fallthrough: okx candle close=210');
  assert(r.attempts.length === 2, 'fallthrough: 2 attempts');
  assert(r.attempts[0].ok === false, 'fallthrough: binance failed');
  assert(r.attempts[1].ok === true, 'fallthrough: okx succeeded');
};

// ── Test 3: All fail → throws aggregate error ─────────────────────────────

const testAllFail = async () => {
  _resetBreakers();
  stubFetch(() => ({ ok: false, status: 503, body: { error: 'unavailable' } }));
  try {
    await getKlinesWithFallback('BTCUSDT', '1h', 1, 'binance');
    assert(false, 'all-fail: should throw');
  } catch (e) {
    const msg = (e as Error).message;
    assert(msg.includes('All exchanges failed'), 'all-fail: aggregate error message');
    assert(msg.includes('binance') && msg.includes('okx') && msg.includes('bybit'), 'all-fail: lists all 3 exchanges');
  }
};

// ── Test 4: Circuit breaker opens after threshold failures ────────────────

const testCircuitBreakerOpens = async () => {
  _resetBreakers();
  let binanceFetches = 0;
  let bybitFetches = 0;
  stubFetch((url) => {
    if (url.includes('api.binance.com')) {
      binanceFetches++;
      return { ok: false, status: 500, body: { error: 'down' } };
    }
    if (url.includes('api.bybit.com')) {
      bybitFetches++;
      return { ok: true, status: 200, body: { retCode: 0, result: { list: [[1700000000000, '200', '220', '180', '210', '100', '5000']] } } };
    }
    if (url.includes('www.okx.com')) {
      return { ok: true, status: 200, body: { code: '0', data: [[1700000000000, '200', '220', '180', '210', '100', '10000', '1000000', '1']] } };
    }
    throw new Error('unexpected URL: ' + url);
  });

  // Each provider call internally retries 3x (1 + 2 backoff). So binanceFetches
  // per provider call = 3. Threshold = 3 provider failures.
  for (let i = 0; i < FALLBACK_CONFIG.CB_THRESHOLD; i++) {
    await getKlinesWithFallback('BTCUSDT', '1h', 1, 'binance');
  }
  const binanceFetchesAt3 = binanceFetches;
  assert(binanceFetchesAt3 === FALLBACK_CONFIG.CB_THRESHOLD * 3, `cb-open: binance fetched ${FALLBACK_CONFIG.CB_THRESHOLD * 3}x (3 retries per call) — got ${binanceFetchesAt3}x`);

  const cbState = _getBreakerState('binance');
  assert(cbState !== null, 'cb-open: breaker state exists');
  assert(cbState !== null && cbState.openedUntil > Date.now(), 'cb-open: circuit open with future timestamp');

  // 4th call: binance should be skipped (circuit open)
  const r4 = await getKlinesWithFallback('BTCUSDT', '1h', 1, 'binance');
  assert(binanceFetches === binanceFetchesAt3, `cb-open: binance NOT fetched on 4th call (was ${binanceFetchesAt3}, now ${binanceFetches})`);
  assert(r4.attempts[0].error === 'circuit open', 'cb-open: attempt 0 marked as circuit open');
  assert(r4.exchangeId !== 'binance', 'cb-open: returned from non-binance exchange');
};

// ── Test 5: Successful call resets breaker ────────────────────────────────

const testSuccessResetsBreaker = async () => {
  _resetBreakers();
  let binanceFetches = 0;
  stubFetch((url) => {
    if (url.includes('api.binance.com')) {
      binanceFetches++;
      if (binanceFetches <= 3) return { ok: false, status: 500, body: { error: 'flaky' } };
      return { ok: true, status: 200, body: [[1700000000000, '100', '110', '90', '105', '50', 0, 0, 0, 0, 0, 0]] };
    }
    if (url.includes('www.okx.com')) {
      return { ok: true, status: 200, body: { code: '0', data: [[1700000000000, '200', '220', '180', '210', '100', '10000', '1000000', '1']] } };
    }
    throw new Error('unexpected URL: ' + url);
  });

  // First call: binance fails (1 provider failure) → okx succeeds
  const r1 = await getKlinesWithFallback('BTCUSDT', '1h', 1, 'binance');
  assert(r1.exchangeId === 'okx', 'cb-reset: 1st call used okx fallback');
  // Second call: binance succeeds → breaker cleared
  const r2 = await getKlinesWithFallback('BTCUSDT', '1h', 1, 'binance');
  assert(r2.exchangeId === 'binance', 'cb-reset: 2nd call used binance after success');
  assert(_getBreakerState('binance') === null, 'cb-reset: breaker cleared after success');
};

// ── Test 6: Preferred exchange is first in chain ──────────────────────────

const testPreferredFirst = async () => {
  _resetBreakers();
  const calls: string[] = [];
  stubFetch((url) => {
    if (url.includes('api.binance.com')) calls.push('binance');
    if (url.includes('www.okx.com')) calls.push('okx');
    if (url.includes('api.bybit.com')) calls.push('bybit');
    // OKX returns 1 candle
    if (url.includes('www.okx.com')) {
      return { ok: true, status: 200, body: { code: '0', data: [[1700000000000, '200', '220', '180', '210', '100', '10000', '1000000', '1']] } };
    }
    return { ok: false, status: 500, body: { error: 'fail' } };
  });

  const r = await getKlinesWithFallback('BTCUSDT', '1h', 1, 'okx');
  assert(calls[0] === 'okx', `preferred-first: okx tried first (got order: ${calls.join(',')})`);
  assert(r.exchangeId === 'okx', 'preferred-first: returns okx (succeeded first)');
};

// ── Test 7: getTickerWithFallback falls through ───────────────────────────

const testTickerFallback = async () => {
  _resetBreakers();
  stubFetch((url) => {
    if (url.includes('api.binance.com')) return { ok: false, status: 500, body: { error: 'down' } };
    if (url.includes('www.okx.com')) return { ok: false, status: 500, body: { error: 'down' } };
    if (url.includes('api.bybit.com')) {
      return {
        ok: true, status: 200,
        body: { retCode: 0, result: { list: [{ symbol: 'BTCUSDT', lastPrice: '50000', price24hPcnt: '0.05', turnover24h: '1000' }] } },
      };
    }
    throw new Error('unexpected: ' + url);
  });
  const r = await getTickerWithFallback('BTCUSDT', 'binance');
  assert(r.exchangeId === 'bybit', `ticker-fallback: fell to bybit (got ${r.exchangeId})`);
  assert(r.data.lastPrice === 50000, 'ticker-fallback: price parsed');
};

// ── Test 8: getUsdtSymbolsWithFallback ────────────────────────────────────

const testSymbolsFallback = async () => {
  _resetBreakers();
  stubFetch((url) => {
    if (url.includes('api.binance.com')) return { ok: false, status: 500, body: { error: 'down' } };
    if (url.includes('api.bybit.com')) return { ok: false, status: 500, body: { error: 'down' } };
    if (url.includes('www.okx.com')) {
      return {
        ok: true, status: 200,
        body: { code: '0', data: [
          { instId: 'BTC-USDT', baseCcy: 'BTC', quoteCcy: 'USDT', state: 'live' },
          { instId: 'ETH-USDT', baseCcy: 'ETH', quoteCcy: 'USDT', state: 'live' },
        ]},
      };
    }
    throw new Error('unexpected: ' + url);
  });
  const r = await getUsdtSymbolsWithFallback('binance');
  assert(r.exchangeId === 'okx', `symbols-fallback: fell to okx (got ${r.exchangeId})`);
  assert(r.data.length === 2, 'symbols-fallback: 2 symbols');
};

const run = async () => {
  await testFirstSucceeds();
  await testFirstFailsSecondSucceeds();
  await testAllFail();
  await testCircuitBreakerOpens();
  await testSuccessResetsBreaker();
  await testPreferredFirst();
  await testTickerFallback();
  await testSymbolsFallback();
  console.log('\nAll Fallback tests passed.');
};

run().catch((e) => { console.error('Test crashed:', e); process.exit(1); });
