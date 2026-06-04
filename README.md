# Crypto Signal

Real-time crypto trading signal analyzer. Single pair, multi-timeframe, **signal-only** (no execution, no API keys).

**Stack:** Next.js 14 · TypeScript · Tailwind · lightweight-charts · Binance public API · PWA-ready.

## Indicators (10)

| Tier | Indicator | Use |
|---|---|---|
| 1 | Bollinger Bands (20, 2) | Volatility / mean reversion |
| 1 | RSI (14) | Overbought / oversold |
| 1 | MACD (12, 26, 9) | Trend / momentum crossover |
| 1 | EMA 50 / 200 | HTF trend + golden/death cross |
| 1 | ATR (14) | Volatility → auto SL/TP |
| 1 | Volume + CVD (tick rule) | Conviction filter |
| 1 | Support / Resistance | Pivot + swing clustering |
| 2 | Fair Value Gap (FVG) | 3-candle imbalance |
| 2 | Order Block | Last opposite candle before impulse |
| 2 | Market Structure (BOS/CHoCH) | Trend reversal cues |
| 2 | Liquidity Sweep | Stop-hunt detection |

## Scoring (range −100..+100)

| Component | Weight | Logic |
|---|---|---|
| BB | 15 | Lower band → +15, upper → −15 |
| RSI | 20 | <25 → +20, >75 → −20, graded |
| MACD | 20 | Crossover + histogram direction |
| S/R | 15 | Nearest support/resistance proximity |
| FVG | 15 | Price inside FVG → ±15 |
| EMA 50/200 | 13 | Trend alignment |
| Volume/CVD | 10 | RVOL + CVD slope |
| Order Block | 10 | Inside OB → ±10 |
| Market Structure | 5 | CHoCH stronger than BOS |
| Liquidity Sweep | 5 | Recent stop-hunt |
| MTF Trend | 5 | EMA50 vs EMA200 + price |

**Action thresholds:** `score ≥ +40 → BUY` · `score ≤ −40 → SELL` · else `HOLD`
**Confidence:** `min(100, |score| + 10)`

**Risk (ATR-based):** SL = `price − ATR·1.5` (BUY) / `+ ATR·1.5` (SELL); TP = `± ATR·2.5`.

## Run

```bash
npm install
npm run dev          # http://localhost:3000
# or
npm run build && npm run start
```

Lint + typecheck:
```bash
npm run lint
npm run typecheck
```

## Structure

```
app/                  # Next.js App Router (page, layout, globals)
components/           # UI: chart, signal card, indicator panel, etc.
lib/
  ├── binance.ts      # Public REST client (klines, ticker, symbols)
  ├── signal.ts       # Indicator + scoring engine
  ├── utils.ts        # Math helpers (sma, ema, stdev)
  ├── hooks/          # useKlines, useSignal, useSymbols (SWR)
  └── indicators/     # 10 indicator modules
public/               # manifest + icon
```

## Data

- All requests to `https://api.binance.com/api/v3/*` (no key, no backend).
- Cached 60s (symbols) / 30s (klines) via SWR + retry x3.
- CORS handled by `next.config.mjs` headers for any future proxying.

## PWA

`public/manifest.webmanifest` + `apple-mobile-web-app-capable` meta. Install from browser address bar → "Add to Home Screen".

## Disclaimer

Not financial advice. Rule-based signals are not guarantees. Always do your own research.
