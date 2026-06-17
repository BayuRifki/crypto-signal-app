# Crypto Signal

Real-time crypto trading signal analyzer. Single pair, multi-timeframe, **signal-only** (no execution, no API keys).

**Stack:** Next.js 14 · TypeScript · Tailwind · lightweight-charts · Multi-exchange (Binance / OKX / Bybit) · PWA-ready.

## What it does

Fetches OHLCV data from multiple exchange public REST APIs (Binance, OKX, Bybit — no keys, no backend), runs **15 indicator modules** combined into **11 scoring components**, and produces a composite score in `[-100, +100]` → **BUY / SELL / HOLD** with sigmoid-based confidence, adaptive SL/TP, multi-timeframe consensus, a built-in backtester, and a local signal-history log.

> ⚠️ **Not financial advice.** Rule-based signals are not guarantees. Always do your own research.

## Indicators (15 modules → 11 scoring components)

| Tier | Indicator | Module | Use |
|---|---|---|---|
| 1 | Bollinger Bands (20, 2) | `bollinger.ts` | Volatility / mean reversion |
| 1 | RSI (14) | `rsi.ts` | Overbought / oversold |
| 1 | MACD (12, 26, 9) | `macd.ts` | Trend / momentum crossover |
| 1 | EMA 50 / 200 | `ema.ts` | HTF trend + golden/death cross |
| 1 | ATR (14) | `atr.ts` | Volatility → adaptive SL/TP |
| 1 | ADX / +DI / −DI | `adx.ts` | Regime classification (trend / range / transition) |
| 1 | Volume + CVD (tick rule) | `volume.ts` | Conviction filter (RVOL + CVD slope) |
| 1 | Support / Resistance | `supportResistance.ts` | Pivot + swing clustering |
| 1 | Volume Profile | `volumeProfile.ts` | POC / VAH / VAL proximity |
| 2 | Fair Value Gap (FVG) | `fvg.ts` | 3-candle imbalance |
| 2 | Order Block | `orderBlock.ts` | Last opposite candle before impulse |
| 2 | Market Structure (BOS/CHoCH) | `marketStructure.ts` | Trend continuation / reversal cues |
| 2 | Liquidity Sweep | `liquiditySweep.ts` | Stop-hunt detection |
| 2 | Divergence (RSI / MACD) | `divergence.ts` | Regular & hidden reversal confluence |
| 2 | CVD Divergence | `cvdDivergence.ts` | Net-flow vs price disagreement |

## Scoring (range −100..+100)

Weights are rebalanced to favor trend & smart-money structure over raw momentum oscillators (which produce false signals in strong trends).

| Component | Weight | Logic |
|---|---|---|
| Bollinger Bands | ±12 | Lower band → +12, upper → −12 |
| RSI | ±15 | <25 → +15, >75 → −15, graded |
| MACD | ±15 | Crossover + histogram direction |
| S/R | ±15 | Nearest support/resistance (+3 if near POC) |
| FVG | ±12 | Price inside FVG → ±12 |
| EMA 50/200 | ±13 | Price vs EMA50/200 position |
| Volume / CVD | ±10 | RVOL + CVD slope + CVD divergence |
| Order Block | ±12 | Inside OB → ±12 |
| Market Structure | ±12 | CHoCH stronger than BOS |
| Liquidity Sweep | ±8 | Recent stop-hunt |
| Trend alignment | ±15 | Price > EMA50 > EMA200 → strong bias |
| Divergence | ±6 | RSI/MACD divergence (±3 each) |

**Action thresholds:** `score ≥ +40 → BUY` · `score ≤ −40 → SELL` · else `HOLD`

**Confidence (sigmoid-based):**
```
confidence = 10 + 85 / (1 + e^(−(|score| − 50) / 10))
```
Maps `|score|` to `[10, 95]`, midpoint at `|score| = 50`. Avoids the linear `|score| + 10` cliff at the trigger threshold. Divergence adds a small confidence bonus (capped at 100).

**ADX regime gate:**
- Ranging (ADX < 20) → force `HOLD`, cap confidence at 35%
- Trending + counter-bias → −25 confidence penalty
- Transitional (ADX 20–25) → passes through

**Risk (adaptive S/R + ATR blend):**
- SL: more conservative of `S/R level − 0.15% buffer` and `ATR × 1.5`, capped at 5% distance
- TP: more realistic of `S/R level − 0.15% buffer` and `ATR × 2.5`
- Tracks `slSource` / `tpSource` (`sr` | `atr` | `ref`); warns if R:R < 1.2

## Features

- **Multi-timeframe consensus** — independently fetches 15m / 1h / 4h / 1d and shows BULLISH / BEARISH / MIXED / WAITING label
- **Backtester** — sliding-window replay (look-ahead-free), per-trade records + aggregate metrics: Sharpe (annualized), win rate, profit factor, max drawdown, EV/trade, equity curve, breakdowns by confidence bucket & action. Filter controls + CSV export
- **Signal history** — `localStorage`-backed log (max 200 entries) with filter + CSV export
- **Chart overlays** — BB, EMA50/200, FVG, Order Blocks, S/R price lines, Market Structure markers (toggleable)
- **PWA-ready** — installable, standalone display

## Run

```bash
npm install
npm run dev          # http://localhost:3000
# or
npm run build && npm run start
```

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint (`next/core-web-vitals`) |
| `npm run typecheck` | `tsc --noEmit` type check |
| `npm test` | Run all 16 test files via `tsx` |

## Structure

```
app/                  # Next.js App Router (page, layout, globals)
components/           # 21 UI components (chart, signal card, panels, drawers)
lib/
  ├── exchanges/  # Multi-exchange abstraction (registry, fetch, fallback)
  ├── signal.ts       # Scoring engine (11 components → score + confidence + risk)
  ├── backtest.ts     # Sliding-window backtester
  ├── signalHistory.ts# localStorage signal log (max 200)
  ├── utils.ts        # Math helpers (sma, ema, stdev, fmt, fmtPrice)
  ├── hooks/          # SWR hooks: useKlines, useTicker, useSymbols, useSignal, useBacktest
  └── indicators/     # 15 indicator modules
tests/                # 16 test files (1 per indicator + scoring + backtest)
public/               # manifest + icon
.github/workflows/    # CI (typecheck → lint → test → build, Node 18 & 20)
```

## Data

- All requests go to the selected exchange's public API (Binance / OKX / Bybit). No API keys required.
- Cached 60s (symbols) / 30s (klines) / 15s (ticker) via SWR + retry ×3.
- **Multi-exchange fallback:** Direct → exchange fallback → server proxy route → public CORS proxy.
- CORS headers configured in `next.config.mjs` for any future proxying.

## Testing

Plain assertion-based tests run via `tsx` (no Jest/Vitest). Each indicator has its own test file plus `scoring.test.ts` (signal engine) and `backtest.test.ts`. Tests use synthetic uptrend / downtrend / ranging candle generators.

```bash
npm test
```

## CI

`.github/workflows/ci.yml` runs on push/PR to `main`: `npm ci → typecheck → lint → test → build`, matrix Node 18 & 20 on `ubuntu-latest`.

## Networking

Direct browser → exchange fetches and server-side exchange fetches. If you are behind a corporate proxy, firewall, or in a geo-blocked region for an exchange:

- **TLS verification off (dev only):** `NODE_TLS_REJECT_UNAUTHORIZED=0 npm run dev` — bypasses Node.js CA cert checks. Some Windows installs / stripped Node images lack the cert chain for `api.binance.com` etc.
- **Demo data mode:** Click the `LIVE/DEMO` button in the top-right to switch to synthetic candles (4 presets: Trending, Ranging, Volatile, Bear). Useful for exploring the UI when no exchange is reachable.
- **Multi-exchange fallback:** Switch between Binance / OKX / Bybit via the selector. Each exchange's symbol/kline endpoint is different — see `lib/exchanges/`.
- **Proxy routes:** `/api/exchanges/{binance,okx,bybit}/{klines,ticker,symbols}` are server-side and try public CORS proxies as last resort. Disable via `DISABLE_CORS_PROXY=1`.

## PWA

`public/manifest.webmanifest` + `apple-mobile-web-app-capable` meta. Install from browser address bar → "Add to Home Screen".

> **Note:** `manifest.webmanifest` references `icon-192.png` and `icon-512.png` which are not currently in the repo — only `icon.svg` exists. Add PNG icons for full PWA install support.

## Disclaimer

Not financial advice. Rule-based signals are not guarantees. Always do your own research.
