import { POPULAR_USDT_PAIRS, POPULAR_TRENDING } from '../lib/popularPairs';

const assert = (cond: boolean, msg: string) => {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  console.log('OK:', msg);
};

assert(POPULAR_USDT_PAIRS.length >= 100, `Popular list has 100+ pairs (got ${POPULAR_USDT_PAIRS.length})`);
assert(POPULAR_TRENDING.length === 5, '5 trending pairs');

const seen = new Set<string>();
for (const p of POPULAR_USDT_PAIRS) {
  assert(typeof p.symbol === 'string' && p.symbol.length > 0, `pair has symbol string`);
  assert(p.symbol === p.base + p.quote, `${p.symbol} symbol = base+quote`);
  assert(p.quote === 'USDT', `${p.symbol} quote is USDT`);
  assert(!seen.has(p.symbol), `${p.symbol} unique (no dups)`);
  seen.add(p.symbol);
}
const majors = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT'];
for (const m of majors) {
  assert(seen.has(m), `Major ${m} present in popular list`);
}

const trendingSet = new Set(POPULAR_TRENDING);
for (const t of trendingSet) assert(seen.has(t), `Trending ${t} present in popular list`);

console.log('\nAll Popular Pairs tests passed.');
