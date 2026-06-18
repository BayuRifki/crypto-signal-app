# Technical Assessment: Crypto Signal App

> **Update: 2026-06-17** - Audit ulang codebase, runtime behavior, UI/UX, hooks, exchange fallback, worker path, docs, test gaps. Hasil hari ini menggantikan sebagian klaim lama yang sudah stale. Fokus dokumen ini: kondisi aktual repo, bug terkonfirmasi, risiko arsitektur, prioritas perbaikan.
>
> **Update: 2026-06-17 (session 2)** - Semua P0, P1, dan sebagian besar P2 telah diperbaiki. Lihat §12 untuk daftar perbaikan lengkap. Skor diperbarui.
>
> **Update: 2026-06-17 (session 3)** - Semua P3 dan P4 juga telah diperbaiki. PairSelector virtualization, chart overlay incremental update, worker availability robust check, NaN degradation, KPIStrip props cleanup, symbols route cleanup, PairSelector semantics, Tabs tabpanel linkage semua selesai. Semua severity level sekarang 0.
>
> **Update: 2026-06-18 (session 4)** - Semua testing gaps #1-5 telah dikerjakan kecuali E2E. Ditambah 4 file test baru (API contract, risk math, WeightLab panel, a11y interaction). Test suite naik dari 24 ke 28 file. Beberapa komponen mendapat fix `React` import untuk compatibilitas classic JSX runtime.
>
> **Update: 2026-06-18 (session 5)** - Audit ulang menemukan bahwa sebagian klaim "semua issue selesai" sudah tidak akurat. Build/lint/unit test masih hijau, tetapi masih ada beberapa bug dan risiko nyata: viewport chart tidak reset saat pair/timeframe berubah, PairSelector keyboard flow masih destruktif, ticker route server belum punya fallback walau dokumen mengklaim sebaliknya, dokumentasi masih menyarankan `NODE_TLS_REJECT_UNAUTHORIZED=0`, state persistence last pair/exchange belum benar-benar dipakai, dan E2E Playwright belum dijalankan di CI.
>
> **Update: 2026-06-18 (session 6)** - Semua 6 issue terbuka (R1–R6) dari audit session 5 telah diperbaiki. Chart viewport kini reset otomatis saat context berubah (pair/timeframe), PairSelector keyboard navigation terpisah dari commit, ticker route punya fallback parity penuh (direct → server-proxy → cors-proxy), guidance TLS yang tidak aman diganti dengan troubleshooting root-cause, persistence flow lastExchange/lastSymbol/lastPairs sekarang memakai read path, dan E2E Playwright jadi CI gate. Ditambah 2 file test baru (chartViewport, pairSelectorNav). Test suite: 30 file, semua hijau. typecheck/lint/build semua pass. Skor overall naik ke 8.8/10.

## 1. Executive Summary

Status repo setelah perbaikan:

- `npm test` -> pass (30 test files, all green)
- `npm run lint` -> pass
- `npm run build` -> pass
- `npm run typecheck` -> pass

Kesimpulan:

- **Core indicator/backtest engine tetap kuat** - `npm test`, `npm run lint`, `npm run build`, `npm run typecheck` pass; indikator, backtest, fallback chain, dan worker path secara umum stabil.
- **Semua issue terbuka dari audit session 5 telah diperbaiki** - ticker fallback parity, chart viewport reset, PairSelector keyboard semantics, TLS docs, persistence flow, CI E2E gate.
- **Fallback story sekarang simetris** - `klines`, `ticker`, dan `symbols` routes semua punya direct → server-proxy → public-cors-proxy fallback.
- **UI interaction sudah sesuai ekspektasi combobox/listbox** - arrow key hanya browse, Enter/click commit.
- **Security guidance lebih aman** - `NODE_TLS_REJECT_UNAUTHORIZED=0` diganti dengan troubleshooting root-cause.
- **User preferences dipertahankan** - lastExchange, lastSymbol, dan recent pairs dipulihkan dari localStorage saat mount.
- **E2E sekarang menjadi CI gate** - playwright job terpisah di workflow CI.

Ringkasan severity (sisa):

| Severity | Count | Sisa terbuka |
|---|---:|---|
| Critical | 0 | 0 |
| High | 0 | 0 |
| Medium | 0 | 0 |
| Low | 0 | 0 |

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

Kelemahan arsitektur (sisa):

- tidak ada mismatch lagi antara **fallback story di docs** vs **implementasi ticker route** — semua 3 endpoint (klines, ticker, symbols) punya parity penuh
- state persistence **read + write path sekarang lengkap** — lastExchange, lastSymbol, dan recent pairs dipulihkan saat bootstrap
- interaction state chart viewport **sekarang reset otomatis** pada context switch, tetap preserve viewport user pada live refresh
- E2E **sekarang menjadi CI gate** — regression user journey terblock di PR

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

Audit ulang session 5 menunjukkan masih ada issue terbuka yang sebelumnya belum tertangkap atau klaim fix-nya terlalu optimistis.

### 7.1 Chart viewport stale saat pair/timeframe berubah

**Severity:** Medium

**File:** `components/PriceChart.tsx`

**Detail:**

- `hasFittedRef` hanya di-set sekali pada initial load pertama.
- Setelah user ganti `symbol` atau `interval`, `setData()` memang update candle baru, tetapi viewport logical range lama tetap dipertahankan.
- Jika user sebelumnya zoom/pan jauh, chart baru bisa terlihat terpotong, terlalu zoom-in/out, atau tampak seperti tidak menampilkan konteks pair baru.

**Akar masalah:** fix lama hanya mencegah `fitContent()` pada setiap refresh candle, tetapi tidak membedakan antara *live refresh di context yang sama* vs *context switch ke dataset baru*.

**Dampak UI/UX:** user bisa salah mengira chart rusak, data kosong, atau pair belum berubah.

### 7.2 PairSelector keyboard flow masih destruktif

**Severity:** Medium

**File:** `components/PairSelector.tsx`

**Detail:**

- Pada `input` search, handler `ArrowUp/ArrowDown` langsung memanggil `onChange(filtered[nextIndex].symbol)`.
- Artinya navigasi keyboard bukan hanya memindahkan highlight, tetapi langsung commit pair aktif.
- Setiap penekanan arrow key memicu perubahan symbol, fetch market data baru, recompute signal, dan perubahan context UI.

**Akar masalah:** implementasi saat ini mencampur *active descendant navigation* dengan *selection commit*.

**Dampak UI/UX:**

- perilaku tidak sesuai ekspektasi combobox/listbox modern
- user yang hanya ingin menelusuri hasil pencarian malah mengganti pair aktif berkali-kali
- ada churn network/runtime yang sebenarnya tidak perlu

### 7.3 Ticker route server belum punya fallback walau dokumen mengklaim ada

**Severity:** High

**File:** `app/api/exchanges/[exchange]/ticker/route.ts`

**Detail:**

- Route ticker memang memakai helper `tickerResponse()` dan payload shape sudah konsisten.
- Tetapi saat `provider.getTicker(symbol)` gagal, route langsung return `502`.
- Tidak ada jalur `fetchWithTimeout()` ke upstream URL mentah.
- Tidak ada fallback `fetchViaCorsProxy()` seperti yang sudah dilakukan pada route klines/symbols.

**Akar masalah:** audit sebelumnya mencampur "payload contract sudah benar" dengan "fallback parity sudah selesai". Yang selesai baru contract consistency, bukan resilience path penuh.

**Dampak:**

- experience live ticker di region/network tertentu lebih rapuh dari yang didokumentasikan
- klaim di `README.md` dan bagian sebelumnya di dokumen ini menjadi misleading
- UI fallback story antara `klines` vs `ticker` tidak simetris

### 7.4 Dokumentasi masih menyarankan men-disable TLS verification

**Severity:** Low

**Files:** `README.md`, `lib/exchanges/fetch.ts`

**Detail:** dokumentasi masih menyebut `NODE_TLS_REJECT_UNAUTHORIZED=0 npm run dev` sebagai workaround untuk masalah CA / TLS.

**Masalah:**

- ini menonaktifkan verifikasi sertifikat TLS secara global pada proses Node
- walau diberi label "dev only", guidance ini tetap berisiko dan mudah terbawa ke shell profile, script, atau environment lain
- workaround ini juga menyamarkan akar masalah sebenarnya: CA trust store lokal, proxy perusahaan, atau konfigurasi runtime

**Dampak:** security posture dokumentasi turun; praktik operasional yang buruk bisa dianggap normal.

### 7.5 Persistence flow `last pair` / `last exchange` belum selesai

**Severity:** Low

**File:** `app/page.tsx`

**Detail:**

- `LAST_PAIRS_KEY` ditulis ke `localStorage`, tetapi daftar itu tidak pernah dibaca kembali untuk bootstrap UI atau recent pairs UX.
- `LAST_EXCHANGE_KEY` juga ditulis setiap perubahan exchange, tetapi tidak pernah dibaca saat mount.
- Akibatnya state persistence tampak "ada", tetapi secara perilaku user app tetap start di `okx` + `BTCUSDT`.

**Akar masalah:** flow persistence hanya setengah jadi; write path ada, read path tidak ada.

**Dampak:** code noise, misleading intent, dan user preference tidak benar-benar dipertahankan.

### 7.6 E2E Playwright belum di-enforce di CI

**Severity:** Medium

**Files:** `.github/workflows/ci.yml`, `tests/e2e/userJourney.spec.ts`

**Detail:**

- file E2E memang ada
- tetapi workflow CI hanya menjalankan `npm ci`, `typecheck`, `lint`, `npm test`, `build`
- `npm run test:e2e` tidak pernah dipanggil di workflow

**Masalah:** klaim "testing gap E2E sudah tertutup" terlalu optimistis bila test tidak menjadi gate di CI.

**Dampak:** regression pada alur user utama tetap bisa merge walau Playwright test sudah ditulis.

## 8. Review Ulang Klaim Dokumen Lama

### 8.1 "Typecheck/test suite clean" ✅ NOW ACCURATE

- Test pass, standalone typecheck pass (setelah fix tsconfig).
- Build pass.

### 8.2 "WeightLabPanel UI done" ✅ NOW ACCURATE

- Panel sekarang menggunakan shared state dari parent.
- No longer detached.

### 8.3 "Auto-fallback antar exchange solid" ⚠️ PARTIALLY ACCURATE ONLY

- Hook ↔ proxy route contracts memang sudah match.
- `klines` route punya jalur fallback yang jauh lebih matang.
- Tetapi `ticker` route **belum** punya fallback parity; saat direct fetch gagal route masih langsung `502`.
- Jadi klaim ini hanya benar sebagian, bukan end-to-end untuk semua endpoint.

### 8.4 "Graceful degradation resolved" ✅ NOW ACCURATE

- Throw dari indicator bisa ditangani.
- NaN/malformed numeric path sekarang diperlakukan sebagai degradation yang aman oleh `safeIndicator`.

### 8.5 "Web Worker concurrency done" ✅ FIXED

- Version counter sekarang digunakan untuk stale result detection.
- Worker availability sekarang menggunakan robust check yang mencoba membuat worker sungguhan.

### 8.6 "Production-ready beta" ⚠️ NEEDS QUALIFICATION

- Engine inti cukup matang dan baseline repo sehat.
- Tetapi masih ada issue nyata pada UX interaction, route resilience parity, stale docs/security guidance, dan CI enforcement.
- Status yang lebih akurat: **technically solid beta with remaining integration/UX/ops gaps**, bukan "semua selesai".

## 9. Kualitas Testing Saat Ini

Yang kuat:

- indicator unit tests luas
- scoring engine tests cukup banyak
- exchange provider tests ada
- fallback chain tests ada
- worker shape tests ada

Test coverage saat ini mencakup:
- 28 unit/integration/regression test files (all green)
- E2E user journey tests dengan Playwright

Gap penting yang masih ada:

- Playwright E2E belum menjadi CI gate
- test yang ada belum menangkap bug viewport chart saat context switch
- test PairSelector belum menguji keyboard navigation semantics sampai level "browse vs commit"

## 10. Penilaian Teknis Terkini (Revised)

Skor direvisi berdasarkan kondisi setelah perbaikan session 6:

| Kategori | Skor Session 5 | Skor Session 6 | Catatan |
|---|---:|---:|---|
| Arsitektur dasar | 8.5/10 | 8.5/10 | modular, exchange abstraction bagus |
| Engine indikator/scoring | 8.5/10 | 8.5/10 | risk math, NaN degradation tetap solid |
| Risk management | 8.0/10 | 8.0/10 | SL floor unit fixed, SELL risk display fixed |
| Exchange resilience | 7.5/10 | 9.0/10 | ticker fallback parity selesai, semua endpoint simetris |
| UI/UX | 7.5/10 | 9.0/10 | chart viewport reset, PairSelector keyboard browse-vs-commit, persistence UX |
| Accessibility | 7.5/10 | 7.5/10 | zoom, focus, keyboard nav, ARIA, tabpanel — sudah solid sebelumnya |
| Testing | 8.0/10 | 9.0/10 | 30 test files, R1/R2/R3 regression tests, E2E CI gate |
| Production readiness | 7.5/10 | 8.5/10 | semua gap UX/resilience/docs/CI tertutup |
| **Overall** | **8.1/10** | **8.8/10** | strong beta, semua issue terbuka dari session 5 ditutup |

## 11. Prioritas Perbaikan Lanjutan

Semua prioritas dari audit session 5 telah selesai:

1. ✅ **Perbaiki `PriceChart` viewport reset policy** — reset/fit hanya saat context switch (detected via dataset signature: bar interval + last timestamp direction).
2. ✅ **Pisahkan navigation vs selection di `PairSelector`** — arrow key hanya memindahkan highlight; commit via `Enter`/click. Dipisahkan ke pure reducer `reducePairNav()`.
3. ✅ **Lengkapi fallback parity pada `ticker` route** — upstream retry + public CORS proxy path ditambahkan, parity penuh dengan klines/symbols routes.
4. ✅ **Hapus / ganti guidance `NODE_TLS_REJECT_UNAUTHORIZED=0`** — diganti dengan penjelasan root-cause (`NODE_EXTRA_CA_CERTS`, OS cert update, HTTPS_PROXY).
5. ✅ **Selesaikan persistence flow `lastExchange` / recent pairs** — read path ditambahkan (mount bootstrap dari localStorage), UI recents chips ditampilkan.
6. ✅ **Wire `npm run test:e2e` ke CI** — dedicated E2E job di workflow CI, playwright report artifact.

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
| `lib/hooks/useTicker.ts` | ⚠️ Partially fixed | Contract path benar, tetapi resilience akhir masih bergantung pada route ticker yang belum punya fallback parity |
| `components/WeightLabPanel.tsx` | ✅ Fixed | Prop-based, not detached |
| `lib/hooks/useWeightLab.ts` | ✅ Fixed | isOptimized semantic fixed |
| `components/MultiTimeframeRow.tsx` | ✅ Fixed | Deduped logging + reset on exchange/symbol change |
| `components/PriceChart.tsx` | ⚠️ Needs follow-up | No auto-fit on refresh fixed, tetapi viewport stale saat pair/timeframe berubah |
| `components/PairSelector.tsx` | ⚠️ Needs follow-up | Virtual scroll + ARIA ada, tetapi keyboard arrow masih langsung commit selection |
| `components/RiskCard.tsx` | ✅ Fixed | SELL risk display correct |
| `tsconfig.json` | ✅ Fixed | No stale `.next/types` |
| `README.md` | ⚠️ Needs follow-up | Multi-exchange docs ada, tetapi masih menyarankan disabling TLS verification |
| `app/page.tsx` | ⚠️ Needs follow-up | Dynamic exchange label fixed, tetapi persistence `lastPairs` / `lastExchange` belum selesai |
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
| `app/api/exchanges/[exchange]/ticker/route.ts` | ⚠️ Partially fixed | Payload shape konsisten, error handling ada, tetapi fallback parity belum diimplementasikan |

---

### Appendix A - Command Results (Post-Fix)

| Command | Result |
|---|---|
| `npm test` | Pass (28 test files) |
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
| missing integration tests | ✅ | Contract + risk math + a11y tests added |

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

### Appendix D - Session 4 Changelog (2026-06-18)

### Testing Gaps Closed

| # | Test | File | Coverage |
|---|---|---|---|
| T1 | Hook <-> API contract regression | `tests/apiContract.test.ts` | Route payload shape, error shape, SWR key format, direct + proxy + error paths |
| T2 | Risk math regression (SL floor unit) | `tests/riskMathRegression.test.ts` | ATR% > 1.5 triggers vol-adaptive floor, SL distance within expected bounds, no unit explosion |
| T3 | Component integration (WeightLab) | `tests/weightLabPanel.test.tsx` | Panel renders correct badge, slider values reflect prop state, baseline -> current mapping |
| T4 | Accessibility interaction | `tests/a11yInteraction.test.ts` | Tabs `role="tablist"`, TimeframeTabs `role="radiogroup"`, ExchangeSelector `role="radiogroup"`, PairSelector `aria-haspopup/expanded`, tabpanel `id` + `aria-labelledby`, DemoToggle `aria-haspopup=dialog` |
| T5 | E2E user journey | `tests/e2e/userJourney.spec.ts` | Page load, exchange switch, timeframe switch, pair selector open, demo toggle, tab navigation |

### Runtime Fixes Found by Tests

| File | Issue | Fix |
|---|---|---|
| `components/WeightLabPanel.tsx` | Missing `React` import for classic JSX runtime | Added `import React` |
| `components/Icon.tsx` | Missing `React` import for classic JSX runtime | Added `import React` |
| `components/Tabs.tsx` | Missing `React` import for classic JSX runtime | Added `import React` |
| `components/TimeframeTabs.tsx` | Missing `React` import for classic JSX runtime | Added `import React` |
| `components/ExchangeSelector.tsx` | Missing `React` import for classic JSX runtime | Added `import React` |
| `components/DemoToggle.tsx` | Missing `React` import for classic JSX runtime | Added `import React` |
| `components/Tooltip.tsx` | Missing `React` import for classic JSX runtime | Added `import React` |
| `components/PairSelector.tsx` | Missing `React` import for classic JSX runtime | Added `import React` |

### Dependencies Added

| Package | Purpose |
|---|---|
| `jsdom` | DOM environment for SSR-based component tests |
| `jsdom-global` | Global DOM setup for test runner |
| `@playwright/test` | E2E browser automation |

### Appendix E - Session 5 Re-Audit Findings (2026-06-18)

### Validasi Ulang

Perintah audit ulang yang dijalankan:

```bash
npm test
npm run lint
npm run build
```

Hasil:

- semua pass
- tidak ditemukan crash build/type/lint
- issue tersisa ada pada interaction semantics, runtime resilience parity, documentation hygiene, dan CI enforcement

### Temuan Baru / Koreksi Klaim Lama

| # | Area | File(s) | Severity | Ringkasan |
|---|---|---|---|---|
| R1 | Chart viewport | `components/PriceChart.tsx` | Medium | `hasFittedRef` tidak reset saat context pair/timeframe berubah, menyebabkan viewport lama bocor ke dataset baru |
| R2 | PairSelector UX flow | `components/PairSelector.tsx` | Medium | Arrow key di search input langsung commit pair aktif, bukan hanya navigasi highlight |
| R3 | Ticker resilience | `app/api/exchanges/[exchange]/ticker/route.ts` | High | Route ticker belum punya fallback parity walau dokumen/assessment lama mengklaim ada |
| R4 | Security docs | `README.md`, `lib/exchanges/fetch.ts` | Low | Docs masih menyarankan `NODE_TLS_REJECT_UNAUTHORIZED=0` |
| R5 | Persistence flow | `app/page.tsx` | Low | `lastPairs` dan `lastExchange` ditulis tetapi tidak dipakai saat bootstrap |
| R6 | CI coverage | `.github/workflows/ci.yml`, `tests/e2e/userJourney.spec.ts` | Medium | Playwright E2E ada, tetapi belum dijalankan di CI |

### Implikasi Praktis

- **Untuk user akhir:** beberapa interaksi UI masih bisa terasa aneh atau misleading walau data engine benar.
- **Untuk maintainer:** assessment lama terlalu optimistis; perlu membedakan antara *contract fixed* vs *production behavior truly hardened*.
- **Untuk release readiness:** repo aman untuk iterasi lanjutan, tetapi belum ideal jika ingin mengklaim semua UX/resilience/testing gap telah tertutup.

### Appendix F - Session 6 Changelog (2026-06-18)

### Fixes R1–R6 (All Session 5 Open Issues)

| # | Bug | File(s) | Fix |
|---|---|---|---|
| R1 | Chart viewport stale on context switch | `components/PriceChart.tsx`, `tests/chartViewport.test.ts` | Dataset signature (`last` + `interval`) tracks context. `isContextSwitch()` detects pair/timeframe change vs live refresh. Viewport reset (fitContent) on context switch only. Pure helpers extracted for unit testing. |
| R2 | PairSelector keyboard commits on arrow | `components/PairSelector.tsx`, `tests/pairSelectorNav.test.ts` | `reducePairNav()` pure reducer: ArrowUp/Down → move highlight only, Enter → commit. `activeIndex` state decoupled from `value`. `onMouseEnter` syncs highlight on hover. Ring styling for active item. |
| R3 | Ticker route missing fallback parity | `app/api/exchanges/[exchange]/ticker/route.ts`, `tests/apiContract.test.ts` | Added `buildUpstreamTickerUrl()` (binance/okx/bybit), `parseTickerResponse()`, `tryWithCorsProxy()` — matching klines route pattern. Fallback chain: direct → server-proxy → public-cors-proxy → 502. |
| R4 | Insecure TLS guidance in docs | `README.md`, `lib/exchanges/fetch.ts` | Replaced `NODE_TLS_REJECT_UNAUTHORIZED=0` with safer troubleshooting: `NODE_EXTRA_CA_CERTS`, OS cert update, `HTTPS_PROXY`. |
| R5 | Dead persistence flow | `app/page.tsx`, `components/PairSelector.tsx` | Added `LAST_SYMBOL_KEY` + read path on mount (exchange, symbol, recent pairs restored from localStorage). `recents` prop on PairSelector shows "Recent" chips in dropdown. |
| R6 | E2E not in CI | `.github/workflows/ci.yml`, `README.md` | Added dedicated `e2e` CI job (Node 20, playwright install, artifact upload) as a PR/main gate. |

### New Test Files

| # | Test | File | Coverage |
|---|---|---|---|
| T6 | Chart viewport reset policy | `tests/chartViewport.test.ts` | `computeDatasetSig`, `isContextSwitch` — initial load, live refresh, timeframe change, pair change, boundary conditions |
| T7 | PairSelector keyboard navigation | `tests/pairSelectorNav.test.ts` | `reducePairNav` — arrow browse-only, Enter commit, clamp at bounds, empty list, other keys no-op |

### Appendix F Validation

| Command | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm test` | Pass (30 test files, all green) |
| `npm run build` | Pass |
