import type { Candle } from '../utils';
import type { ExchangeId, ExchangeProvider, Interval, SymbolInfo, Ticker24h } from './types';
import { exchangeList } from './registry';

export type { ExchangeId } from './types';

export type FallbackAttempt = { id: ExchangeId; ok: boolean; error?: string };
export type FallbackResult<T> = { data: T; exchangeId: ExchangeId; attempts: FallbackAttempt[] };

type CBState = { failures: number; openedUntil: number };
const breakers = new Map<ExchangeId, CBState>();

const CB_THRESHOLD = 3;
const CB_DURATION_MS = 30_000;
const PREFERRED_LIST: ExchangeId[] = ['binance', 'okx', 'bybit'];

const canTry = (id: ExchangeId): boolean => {
  const s = breakers.get(id);
  if (!s) return true;
  if (s.openedUntil > 0) {
    if (Date.now() > s.openedUntil) {
      breakers.delete(id);
      return true;
    }
    return false;
  }
  return true;
};

const recordFailure = (id: ExchangeId, err: unknown): void => {
  const cur = breakers.get(id) ?? { failures: 0, openedUntil: 0 };
  cur.failures += 1;
  if (cur.failures >= CB_THRESHOLD) {
    cur.openedUntil = Date.now() + CB_DURATION_MS;
  }
  breakers.set(id, cur);
  if (typeof console !== 'undefined' && (cur.failures === 1 || cur.failures === CB_THRESHOLD)) {
    console.warn(`[fallback] ${id} failure #${cur.failures}${cur.failures >= CB_THRESHOLD ? ` (circuit open ${CB_DURATION_MS / 1000}s)` : ''}: ${err instanceof Error ? err.message : String(err)}`);
  }
};

const recordSuccess = (id: ExchangeId): void => {
  if (breakers.has(id)) breakers.delete(id);
};

export const _resetBreakers = (): void => {
  breakers.clear();
};

export const _getBreakerState = (id: ExchangeId): CBState | null => breakers.get(id) ?? null;

const buildChain = (preferred?: ExchangeId): ExchangeId[] => {
  if (!preferred) return PREFERRED_LIST.slice();
  return [preferred, ...PREFERRED_LIST.filter((id) => id !== preferred)];
};

const findProvider = (id: ExchangeId): ExchangeProvider => {
  const p = exchangeList.find((e) => e.id === id);
  if (!p) throw new Error(`Unknown exchange: ${id}`);
  return p;
};

const tryChain = async <T,>(
  chain: ExchangeId[],
  fn: (p: ExchangeProvider) => Promise<T>
): Promise<FallbackResult<T>> => {
  const attempts: FallbackAttempt[] = [];
  for (const id of chain) {
    if (!canTry(id)) {
      attempts.push({ id, ok: false, error: 'circuit open' });
      continue;
    }
    const provider = findProvider(id);
    try {
      const data = await fn(provider);
      recordSuccess(id);
      attempts.push({ id, ok: true });
      return { data, exchangeId: id, attempts };
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      recordFailure(id, e);
      attempts.push({ id, ok: false, error: err });
    }
  }
  const lastErr = attempts.findLast?.((a) => a.error)?.error ?? 'all exchanges failed';
  throw new Error(`All exchanges failed: ${lastErr} (tried ${chain.join(', ')})`);
};

export const getKlinesWithFallback = (
  symbol: string,
  interval: Interval,
  limit: number,
  preferred?: ExchangeId
): Promise<FallbackResult<Candle[]>> => {
  const chain = buildChain(preferred);
  return tryChain(chain, (p) => p.getKlines(symbol, interval, limit));
};

export const getTickerWithFallback = (
  symbol: string,
  preferred?: ExchangeId
): Promise<FallbackResult<Ticker24h>> => {
  const chain = buildChain(preferred);
  return tryChain(chain, (p) => p.getTicker(symbol));
};

export const getUsdtSymbolsWithFallback = (
  preferred?: ExchangeId
): Promise<FallbackResult<SymbolInfo[]>> => {
  const chain = buildChain(preferred);
  return tryChain(chain, (p) => p.getUsdtSymbols());
};

export const FALLBACK_CONFIG = {
  CB_THRESHOLD,
  CB_DURATION_MS,
  PREFERRED_LIST: PREFERRED_LIST.slice(),
} as const;
