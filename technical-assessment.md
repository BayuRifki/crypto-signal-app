# Technical Assessment: Crypto Signal App

> **Update: 2026-06-17** - Audit ulang codebase, runtime behavior, UI/UX, hooks, exchange fallback, worker path, docs, test gaps. Hasil hari ini menggantikan sebagian klaim lama yang sudah stale. Fokus dokumen ini: kondisi aktual repo, bug terkonfirmasi, risiko arsitektur, prioritas perbaikan.
>
> **Update: 2026-06-17 (session 2)** - Semua P0, P1, dan sebagian besar P2 telah diperbaiki. Lihat §12 untuk daftar perbaikan lengkap. Skor diperbarui.
>
> **Update: 2026-06-17 (session 3)** - Semua P3 dan P4 juga telah diperbaiki. PairSelector virtualization, chart overlay incremental update, worker availability robust check, NaN degradation, KPIStrip props cleanup, symbols route cleanup, PairSelector semantics, Tabs tabpanel linkage semua selesai. Semua severity level sekarang 0.

## 1. Executive Summary

Status repo setelah perbaikan:

- `npm test` -> pass (24 test files, all green)
- `npm run lint` -> pass
- `npm run build` -> pass
- `npm run typecheck` -> pass

Kesimpulan:

- **Core indicator/backtest engine cukup matang** - banyak test lulus, scoring engine modular, fallback exchange sudah ada, worker support sudah disiapkan.
- **Semua bug High Priority (P0) telah diperbaiki** - proxy payload mismatch, SL floor unit bug, Weight Lab detached state, history spam, typecheck config.
- **Semua bug Medium Priority (P1) telah diperbaiki** - chart auto-fit, SELL risk card, stale copy, worker race, demo mode polling.
- **Semua bug Low Priority (P2) telah diperbaiki** - a11y perbaikan, history panel, consensus reset, hygiene.
- **Semua P3 perbaikan lanjutan telah selesai** - PairSelector virtualization, chart overlay incremental update, worker availability robust check, NaN degradation.
- **Semua P4 nice-to-have telah selesai** - KPIStrip props cleanup, symbols route import, PairSelector semantics, Tabs tabpanel linkage.
- **Ruang perbaikan tersisa** hanya regression tests, E2E tests, dan integration test gaps.

Ringkasan severity (sisa):

| Severity | Count | Sisa terbuka |
|---|---:|---|
| Critical | 0 | 0 |
| High | 0 | 0 |
| Medium | 0 | 0 (semua diperbaiki) |
| Low | 0 | 0 (semua diperbaiki) |

## 2. Reproduksi Audit Hari Ini

Perintah yang dijalankan:

```bash
npm test
npm run lint
npm run build
npm run typecheck
```

Semua pass setelah perbaikan.

## 3. Kondisi Arsitektur Saat Ini

Komponen besar yang ada:

- **UI App Router** - `app/page.tsx` + 20+ komponen client
- **Scoring engine** - `lib/signal.ts` + indikator terpisah
- **Backtest engine** - `lib/backtest.ts`
- **Exchange abstraction** - provider Binance / OKX / Bybit
- **Fallback layer** - direct -> exchange fallback -> proxy route
- **Local persistence** - signal history, weight presets
- **Weight optimizer** - genetic optimizer + UI panel
- **Worker support** - shared web worker utk backtest/optimize

Kekuatan arsitektur:

- indikator modular
- test coverage engine relatif luas
- exchange provider abstraction rapi
- fallback/circuit-breaker sudah ada
- scoring configurable via `SignalWeights`
- proxy route payloads sekarang sinkron dengan hook consumers

Kelemahan arsitektur (sisa): **tidak ada lagi yang signifikan**. Semua issue yang teridentifikasi sudah diperbaiki atau di-mitigate.

## 4. Bug yang Sudah Diperbaiki

### 4.1 Proxy payload mismatch - `useKlines` ✅ FIXED

**File:** `lib/hooks/useKlines.ts`, `app/api/exchanges/[exchange]/klines/route.ts`

Fix: Klines route sekarang return `{ data: Candle[], exchangeId: string, source: string }` yang cocok dengan `useKlines` hook consumer.

### 4.2 Proxy payload mismatch - `useTicker` ✅ FIXED

**File:** `lib/hooks/useTicker.ts`, `app/api/exchanges/[exchange]/ticker/route.ts`

Fix: Ticker route sekarang return `{ data: ticker, exchangeId: string, source: string }` yang cocok dengan `useTicker` hook consumer. Juga menambahkan proper fallback proxy pathway ke ticker route.

### 4.3 Bug satuan persen pada adaptive SL floor ✅ FIXED

**File:** `lib/signal.ts`

Fix: `atrPctForFloor` diubah dari `(atrVal / price) * 100` (persen) menjadi `atrVal / price` (decimal fraction), konsisten dengan `baseMinSLPct` dan penggunaan lainnya. Display string juga sudah diperbaiki.

### 4.4 Weight Lab detached from active signal state ✅ FIXED

**File:** `components/WeightLabPanel.tsx`, `app/page.tsx`

Fix: `WeightLabPanel` sekarang menerima `lab: UseWeightLabResult` sebagai prop dari parent, bukan membuat hook instance sendiri. State `weightLab` dari `app/page.tsx` adalah single source of truth.

### 4.5 Signal history spam / noisy audit trail ✅ FIXED

**File:** `components/MultiTimeframeRow.tsx`, `lib/hooks/useSignal.ts`, `lib/signalHistory.ts`

Fix:
- `MultiTimeframeRow` tidak lagi memanggil `logSignal()` — hanya main signal hook yang melakukan logging.
- `logSignal()` sekarang punya dedupe: skip jika entry terakhir punya symbol, interval, action yang sama dan score serta confidence hampir identik.

### 4.6 Chart always resets user viewport ✅ FIXED

**File:** `components/PriceChart.tsx`

Fix: `fitContent()` hanya dipanggil pada initial data load (via `hasFittedRef`), bukan pada setiap update candle.

### 4.7 Risk card misleading for short trades ✅ FIXED

**File:** `components/RiskCard.tsx`

Fix: `distToSL` dan `distToTP` sekarang dihitung sebagai absolute distance dari entry, terpisah untuk BUY (SL below, TP above) dan SELL (SL above, TP below).

### 4.8 Hardcoded source copy no longer true ✅ FIXED

**File:** `app/page.tsx`, `README.md`

Fix: Footer UI sekarang menampilkan exchange aktif dinamis. README diperbarui untuk mencerminkan multi-exchange support.

### 4.9 Accessibility blocker - mobile zoom disabled ✅ FIXED

**File:** `app/layout.tsx`

Fix: Dihapus `maximumScale: 1` dari viewport config.

### 4.10 Accessibility blocker - global focus suppression ✅ FIXED

**File:** `app/globals.css`

Fix: Dihapus `*:focus { outline: none; }`, tetap mempertahankan `*:focus-visible` style.

## 5. Bug yang Sudah Diperbaiki (Medium Priority)

### 5.1 Typecheck config stale / fragile ✅ FIXED

**File:** `tsconfig.json`

Fix: Dihapus `.next/types/**/*.ts` dari include. Next.js build menambahkannya kembali saat diperlukan.

### 5.2 Demo mode still polls live data ✅ FIXED

**File:** `lib/hooks/useCandleSource.ts`

Fix: Refactored untuk menggunakan SWR langsung dengan key `null` saat demo mode aktif, sehingga tidak ada network request saat demo.

### 5.3 Worker/backtest async race ✅ FIXED

**File:** `lib/hooks/useWorkerTask.ts`

Fix: Diganti `cancelledRef` boolean dengan `versionRef` counter yang di-increment pada setiap effect run. Hanya result dengan version yang cocok yang diterima.

### 5.5 `isOptimized` semantic drift ✅ FIXED

**File:** `lib/hooks/useWeightLab.ts`

Fix: `isOptimized` sekarang memeriksa bahwa current weights sama dengan optimized result weights (dalam tolerance 1e-6), bukan hanya cek `lastResult !== null && savedAt !== null`.

### 5.6 Klines route fallback labeling ✅ FIXED

**File:** `app/api/exchanges/[exchange]/klines/route.ts`

Fix: Route sekarang menggunakan helper `klinesResponse()` yang return format konsisten `{ data, exchangeId, source }`. Source labels: `'direct'`, `'server-proxy'`, `'public-cors-proxy'`.

### 5.7 Ticker route fallback ✅ FIXED

**File:** `app/api/exchanges/[exchange]/ticker/route.ts`

Fix: Route sekarang menggunakan helper `tickerResponse()` yang return format konsisten `{ data, exchangeId, source }`. Ticker route juga sekarang punya proper error handling dan logging.

### 5.8 History panel misleading export/count/truncation ✅ FIXED

**File:** `components/HistoryPanel.tsx`

Fix:
- Export CSV sekarang menggunakan `filtered` entries, bukan `entries`
- Header count menampilkan `filtered.length` + total jika berbeda
- List truncation disclosure: "Showing 50 of N entries"

### 5.9 Multi-timeframe stale/partial consensus ✅ FIXED

**File:** `components/MultiTimeframeRow.tsx`

Fix: `rows` state di-reset ke `{}` ketika `symbol` atau `exchange` berubah via `useEffect`. Juga dihapus duplicate `type Props` declaration.

### 5.12 Tabs/radiogroup/tooltip semantics ✅ PARTIALLY FIXED

**Files:** `components/Tabs.tsx`, `components/TimeframeTabs.tsx`, `components/ExchangeSelector.tsx`, `components/Tooltip.tsx`, `components/DemoToggle.tsx`

Fix:
- `Tabs`: Added `id`, `aria-controls`, `tabIndex`, keyboard arrow navigation (ArrowLeft/Right/Home/End), `focus-visible` styles
- `TimeframeTabs`: Added `tabIndex`, keyboard navigation, `focus-visible` styles
- `ExchangeSelector`: Added `tabIndex`, keyboard navigation, `focus-visible` styles
- `Tooltip`: Added `useId()` for `aria-describedby` linkage, `id` on tooltip element
- `DemoToggle`: Auto-close popup on selection (Live, Demo, Preset buttons)

## 6. Bug yang Sudah Diperbaiki (Low Priority / Hygiene)

| File | Issue | Fix |
|---|---|---|
| `app/page.tsx` | `localStorage` parse dua kali | Disederhanakan ke single parse |
| `app/page.tsx` | unused import `useKlines` | Dihapus |
| `lib/hooks/useKlines.ts` | SWR key tidak namespaced | Ditambah prefix `klines\|` |
| `components/SignalCard.tsx` | top reasons di-sort berdasarkan panjang string | Diubah ke original order (slice tanpa sort) |
| `components/DemoToggle.tsx` | popup tidak auto-close setelah select | Ditambah `setOpen(false)` pada semua selection actions |
| `components/HistoryPanel.tsx` | SL/TP pct salah untuk short trades | Diubah perhitungan absolute distance per trade direction |

## 7. Bug yang Masih Terbuka

**Semua bug yang teridentifikasi dalam audit awal telah diperbaiki.** Tidak ada lagi bug terbuka yang signifikan.

Ruang perbaikan tersisa hanyalah dalam kategori **testing**:

1. **Hook <-> API contract regression tests** - Perlu test memastikan payload route cocok dengan hook consumer setelah fix.
2. **Risk math regression tests** - Perlu sentinel test untuk unit `%` vs decimal pada adaptive SL floor.
3. **Component integration tests** - Perlu test untuk WeightLabPanel state binding.

## 8. Review Ulang Klaim Dokumen Lama

### 8.1 "Typecheck/test suite clean" ✅ NOW ACCURATE

- Test pass, standalone typecheck pass (setelah fix tsconfig).
- Build pass.

### 8.2 "WeightLabPanel UI done" ✅ NOW ACCURATE

- Panel sekarang menggunakan shared state dari parent.
- No longer detached.

### 8.3 "Auto-fallback antar exchange solid" ✅ NOW ACCURATE

- Hook ↔ proxy route contracts now match.
- Proxy fallback UI path verified correct.

### 8.4 "Graceful degradation resolved" ✅ NOW ACCURATE

- Throw dari indicator bisa ditangani.
- NaN/malformed numeric path sekarang diperlakukan sebagai degradation yang aman oleh `safeIndicator`.

### 8.5 "Web Worker concurrency done" ✅ FIXED

- Version counter sekarang digunakan untuk stale result detection.
- Worker availability sekarang menggunakan robust check yang mencoba membuat worker sungguhan.

### 8.6 "Production-ready beta" ✅ NOW ACCURATE

- Semua bug signifikan diperbaiki.
- Semua P0/P1/P2/P3/P4 items selesai.
- Status: **production-ready** dengan catatan bahwa testing coverage masih perlu ditingkatkan (integration tests, regression tests).

## 9. Kualitas Testing Saat Ini

Yang kuat:

- indicator unit tests luas
- scoring engine tests cukup banyak
- exchange provider tests ada
- fallback chain tests ada
- worker shape tests ada

Yang masih perlu ditambahkan:

1. **Hook <-> API contract tests** - Sekarang contracts fixed, perlu regression test.
2. **Risk math regression tests** - Perlu sentinel test untuk unit `%` vs decimal pada adaptive SL floor.
3. **Component integration tests** - Perlu test untuk WeightLabPanel state binding.

## 10. Penilaian Teknis Terkini (Revised)

Skor direvisi berdasarkan kondisi setelah perbaikan:

| Kategori | Skor Sebelum | Skor Sesudah | Catatan |
|---|---:|---:|---|
| Arsitektur dasar | 8.5/10 | 8.5/10 | modular, exchange abstraction bagus |
| Engine indikator/scoring | 7.5/10 | 8.5/10 | risk math fixed, NaN degradation handled |
| Risk management | 5.5/10 | 8.0/10 | SL floor unit fixed, SELL risk display fixed |
| Exchange resilience | 6.5/10 | 9.0/10 | contracts fixed, ticker fallback, robust worker |
| UI/UX | 6.0/10 | 8.5/10 | chart churn fixed, virtualization, copy fixed, a11y |
| Accessibility | 4.5/10 | 7.5/10 | zoom, focus, keyboard nav, ARIA, tabpanel |
| Testing | 7.5/10 | 7.5/10 | breadth bagus, integration/regression test gaps remain |
| Production readiness | 5.5/10 | 8.5/10 | semua P0-P4 fixed, production-ready with test gaps |
| **Overall** | **6.4/10** | **8.5/10** | production-ready, test gaps tetap perlu ditutup |

## 11. Prioritas Perbaikan Lanjutan

Semua item P0-P4 telah selesai. Yang tersisa adalah **testing gaps**:

1. **Hook <-> API contract regression tests** - tambah test memastikan payload route cocok dengan hook consumer
2. **Risk math regression tests** - tambah sentinel test untuk unit `%` vs decimal pada adaptive SL floor
3. **Component integration tests** - tambah test untuk WeightLabPanel state binding
4. **E2E tests** - Playwright atau Cypress untuk user journey utama
5. **Accessibility interaction tests** - keyboard-nav/focus-trap/ARIA behavior test

## 12. Changelog Perbaikan (2026-06-17 Session 2)

### P0 - Critical Fixes

| # | Bug | File(s) | Fix |
|---|---|---|---|
| 1 | Proxy payload mismatch (klines) | `useKlines.ts`, `klines/route.ts` | Route returns `{ data, exchangeId, source }` |
| 2 | Proxy payload mismatch (ticker) | `useTicker.ts`, `ticker/route.ts` | Route returns `{ data, exchangeId, source }` + error handling |
| 3 | SL floor unit bug | `lib/signal.ts` | `atrPctForFloor` changed to decimal fraction, display strings fixed |
| 4 | Weight Lab detached state | `WeightLabPanel.tsx`, `page.tsx` | Panel accepts `lab` prop from parent |
| 5 | Signal history spam | `MultiTimeframeRow.tsx`, `signalHistory.ts` | Removed duplicate logging, added dedupe in `logSignal()` |
| 6 | Standalone typecheck fail | `tsconfig.json` | Removed `.next/types/**/*.ts` from include |

### P1 - Important Fixes

| # | Bug | File(s) | Fix |
|---|---|---|---|
| 7 | Chart auto-fit on refresh | `PriceChart.tsx` | Only `fitContent()` on initial load via `hasFittedRef` |
| 8 | SELL risk pct display | `RiskCard.tsx`, `HistoryPanel.tsx` | Absolute distance per trade direction |
| 9 | Stale/misleading copy | `page.tsx`, `README.md` | Dynamic exchange label, multi-exchange docs |
| 10 | Worker race handling | `useWorkerTask.ts` | Version counter instead of boolean cancelled ref |
| 11 | Demo mode polls live | `useCandleSource.ts` | SWR key `null` when demo mode active |

### P2 - Quality / UX / A11y Fixes

| # | Bug | File(s) | Fix |
|---|---|---|---|
| 12 | Global focus suppression | `globals.css` | Removed `*:focus { outline: none }` |
| 13 | Mobile zoom blocked | `layout.tsx` | Removed `maximumScale: 1` |
| 14 | HistoryPanel export/count/truncation | `HistoryPanel.tsx` | Export uses filtered, count shows filtered, truncation disclosure |
| 15 | Multi-timeframe stale consensus | `MultiTimeframeRow.tsx` | Reset rows on symbol/exchange change |
| 16 | Unused import useKlines | `page.tsx` | Removed |
| 17 | localStorage double parse | `page.tsx` | Simplified to single parse |
| 18 | SWR key namespace | `useKlines.ts` | Added `klines\|` prefix |
| 19 | isOptimized semantic | `useWeightLab.ts` | Now checks weights match last result |
| 20 | SignalCard reason sort | `SignalCard.tsx` | Original order instead of string length sort |
| 21 | DemoToggle auto-close | `DemoToggle.tsx` | Close popup on selection |
| 22 | Klines route fallback labels | `klines/route.ts` | Accurate source labels: `direct`, `server-proxy`, `public-cors-proxy` |
| 23 | Ticker route fallback impl | `ticker/route.ts` | Proper error handling + consistent response format |
| 24 | Tabs keyboard nav | `Tabs.tsx` | Arrow keys, Home/End, tabIndex roving, aria-controls |
| 25 | TimeframeTabs keyboard nav | `TimeframeTabs.tsx` | Arrow keys, focus-visible |
| 26 | ExchangeSelector keyboard nav | `ExchangeSelector.tsx` | Arrow keys, focus-visible |
| 27 | Tooltip ARIA | `Tooltip.tsx` | `useId()`, `aria-describedby` linkage |

## 13. File-by-File Watchlist (Revised)

| File | Status | Notes |
|---|---|---|
| `lib/signal.ts` | ✅ Fixed | Risk math bug diperbaiki |
| `lib/hooks/useKlines.ts` | ✅ Fixed | Proxy contract match + SWR namespace |
| `lib/hooks/useTicker.ts` | ✅ Fixed (no change needed) | Route fixed to match hook contract |
| `components/WeightLabPanel.tsx` | ✅ Fixed | Prop-based, not detached |
| `lib/hooks/useWeightLab.ts` | ✅ Fixed | isOptimized semantic fixed |
| `components/MultiTimeframeRow.tsx` | ✅ Fixed | Deduped logging + reset on exchange/symbol change |
| `components/PriceChart.tsx` | ✅ Fixed | No auto-fit on refresh + incremental overlay update |
| `components/PairSelector.tsx` | ✅ Fixed | Virtual scroll windowing + keyboard nav + ARIA |
| `components/RiskCard.tsx` | ✅ Fixed | SELL risk display correct |
| `tsconfig.json` | ✅ Fixed | No stale `.next/types` |
| `README.md` | ✅ Fixed | Multi-exchange, accurate description |
| `app/page.tsx` | ✅ Fixed | Dynamic exchange label, no unused imports |
| `app/globals.css` | ✅ Fixed | No focus suppression |
| `app/layout.tsx` | ✅ Fixed | Mobile zoom enabled |
| `components/HistoryPanel.tsx` | ✅ Fixed | Export/count/truncation |
| `components/Tabs.tsx` | ✅ Fixed | Keyboard nav + ARIA |
| `components/TimeframeTabs.tsx` | ✅ Fixed | Keyboard nav + focus-visible |
| `components/ExchangeSelector.tsx` | ✅ Fixed | Keyboard nav + focus-visible |
| `components/Tooltip.tsx` | ✅ Fixed | ARIA linkage |
| `components/DemoToggle.tsx` | ✅ Fixed | Auto-close on select |
| `components/SignalCard.tsx` | ✅ Fixed | Reason order |
| `lib/hooks/useCandleSource.ts` | ✅ Fixed | Demo mode stops polling |
| `lib/safeIndicator.ts` | ✅ Fixed | NaN/Infinity detection in safeIndicator |
| `lib/hooks/useWorkerTask.ts` | ✅ Fixed | Version counter + robust worker availability check |
| `components/KPIStrip.tsx` | ✅ Fixed | Removed unused props |
| `app/api/exchanges/[exchange]/symbols/route.ts` | ✅ Fixed | Removed unused `fetchWithTimeout` import |
| `lib/signalHistory.ts` | ✅ Fixed | Dedupe mechanism |
| `app/api/exchanges/[exchange]/klines/route.ts` | ✅ Fixed | Consistent payload format |
| `app/api/exchanges/[exchange]/ticker/route.ts` | ✅ Fixed | Consistent payload format + error handling |

---

### Appendix A - Command Results (Post-Fix)

| Command | Result |
|---|---|
| `npm test` | Pass (24 test files) |
| `npm run lint` | Pass |
| `npm run build` | Pass |
| `npm run typecheck` | Pass |

### Appendix B - Bug Classes Resolved

| Class | Status | Fix Summary |
|---|---|---|
| contract mismatch | ✅ | Route payloads aligned with hook consumers |
| unit conversion bug | ✅ | atrPctForFloor decimal fraction |
| stale documentation | ✅ | README + footer updated |
| detached state ownership | ✅ | WeightLabPanel receives prop |
| duplicate event logging | ✅ | Removed from MTF row + dedupe in logSignal |
| async race risk | ✅ | Version counter in useWorkerBacktest |
| misleading UI copy | ✅ | Dynamic exchange label |
| accessibility regression | ✅ | Zoom + focus + keyboard nav |
| performance churn | ✅ | Incremental BB/EMA overlay update, price lines separate effect |
| missing integration tests | ⬜ | Contract + risk math tests needed |

### Appendix C - Session 3 Changelog (2026-06-17)

### P3 - Advanced Fixes

| # | Bug | File(s) | Fix |
|---|---|---|---|
| 16 | PairSelector virtualization | `PairSelector.tsx` | Scroll-based windowing rendering only visible items + 4 buffer. `ITEM_HEIGHT=44`, `VISIBLE_COUNT=8`. Keyboard nav (ArrowUp/Down), `aria-activedescendant`, `focus-visible` styles |
| 17 | Price chart overlay churn | `PriceChart.tsx` | Overlay series (BB/EMA) stored in `overlayRef` and updated via `setData()` instead of destroy/recreate. Separate price lines effect with deps only on overlay data, not candles. Toggle on/off creates/removes series, data updates just set data |
| 18 | Worker availability robust check | `useWorkerTask.ts` | Replaced `isWorkerSupported()` (which only checked `typeof Worker`) with `checkWorkerAvailable()` that creates a real worker via Blob URL, terminates it, and caches the result. |
| 19 | NaN degradation path | `safeIndicator.ts` | Extended `safeIndicator` to also check `typeof result === 'number' && (!Number.isFinite(result) || Number.isNaN(result))`, returning fallback and marking degraded. |

### P4 - Nice-to-have Fixes

| # | Bug | File(s) | Fix |
|---|---|---|---|
| 21 | KPIStrip unused props | `KPIStrip.tsx`, `page.tsx` | Removed `symbol` and `interval` from Props type and component signature |
| 22 | Symbols route unused import | `symbols/route.ts` | Removed unused `fetchWithTimeout` import |
| 23 | PairSelector semantics | `PairSelector.tsx` | Full rewrite with virtual scroll, keyboard nav, `role="listbox"`/`role="option"`, `aria-activedescendant`, `focus-visible` |
| 24 | Tabs tabpanel linkage | `page.tsx` | Added `role="tabpanel"`, `id`, `aria-labelledby` to each tab content panel |