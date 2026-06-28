'use client';
import { useState, useMemo, useEffect, useCallback } from 'react';
import Header from '../components/Header';
import PairSelector from '../components/PairSelector';
import PriceChart from '../components/PriceChart';
import SignalCard from '../components/SignalCard';
import RiskCard from '../components/RiskCard';
import IndicatorPanel from '../components/IndicatorPanel';
import IndicatorSettings from '../components/IndicatorSettings';
import StructurePanel from '../components/StructurePanel';
import Drawer from '../components/Drawer';
import MobileSignalButton from '../components/MobileSignalButton';
import BacktestPanel from '../components/BacktestPanel';
import HistoryPanel from '../components/HistoryPanel';
import WeightLabPanel from '../components/WeightLabPanel';
import WatchlistSidebar from '../components/WatchlistSidebar';
import ChartToolbar from '../components/ChartToolbar';
import BottomTabBar, { type BottomTab } from '../components/BottomTabBar';

import { useTicker } from '../lib/hooks/useTicker';
import { useSignal } from '../lib/hooks/useSignal';
import { useCandleSource } from '../lib/hooks/useCandleSource';
import { useWeightLab } from '../lib/hooks/useWeightLab';
import { useChartState } from '../lib/hooks/useChartState';
import { useChartOverlays } from '../lib/hooks/useChartOverlays';
import { supportResistance } from '../lib/indicators/supportResistance';
import { Icon } from '../components/Icon';
import ExchangeSelector from '../components/ExchangeSelector';
import DemoToggle from '../components/DemoToggle';

export default function HomePage() {
  // Persisted market selection (exchange/symbol/interval/recents) + overlay toggles
  const { exchange, symbol, interval, recentPairs, setExchange, setSymbol, setInterval } = useChartState();
  const overlays = useChartOverlays();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [signalDrawerOpen, setSignalDrawerOpen] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [bottomTab, setBottomTab] = useState<'structure' | 'backtest' | 'weightlab' | 'history'>('structure');
  const [dismissError, setDismissError] = useState(false);

  const { candles, isLoading: klinesLoading, refresh: refreshKlines, error: klinesError, isDemo, demoPreset, setDemoPreset, setDemoMode, realError } = useCandleSource(exchange, symbol, interval, 500);
  const { ticker, refresh: refreshTicker } = useTicker(exchange, symbol);
  const weightLab = useWeightLab();
  const { weights: weightLabWeights, isCustom: weightLabIsCustom } = weightLab;
  const signal = useSignal(candles, weightLabWeights, symbol, interval);
  const srLevels = useMemo(() => {
    if (candles.length < 50) return [];
    const sr = supportResistance(candles, 100);
    return [...sr.pivots, ...sr.supports, ...sr.resistances];
  }, [candles]);

  useEffect(() => {
    if (candles.length > 0) setLastUpdate(new Date());
  }, [candles]);

  const onRefresh = useCallback(() => {
    refreshKlines();
    refreshTicker();
  }, [refreshKlines, refreshTicker]);

  const bottomTabs: BottomTab[] = useMemo(() => [
    {
      id: 'structure',
      label: 'Structure',
      icon: <Icon.Layers size={12} />,
      panel: (
        <StructurePanel
          price={signal?.price ?? 0}
          fvgs={signal?.fvgs ?? []}
          orderBlocks={signal?.orderBlocks ?? []}
          msSignals={signal?.marketStructure ?? []}
          sweeps={signal?.sweeps ?? []}
          srLevels={srLevels}
        />
      ),
    },
    {
      id: 'backtest',
      label: 'Backtest',
      icon: <Icon.Activity size={12} />,
      panel: <BacktestPanel candles={candles} symbol={symbol} interval={interval} weights={weightLabWeights} />,
    },
    {
      id: 'weightlab',
      label: 'Weight Lab',
      icon: <Icon.Box size={12} />,
      badge: weightLabIsCustom ? <span className="w-1.5 h-1.5 rounded-full bg-accent" aria-label="custom weights active" /> : undefined,
      panel: <WeightLabPanel candles={candles} lab={weightLab} />,
    },
    {
      id: 'history',
      label: 'History',
      icon: <Icon.Clock size={12} />,
      panel: <HistoryPanel symbol={symbol} interval={interval} />,
    },
  ], [candles, interval, signal, srLevels, symbol, weightLabWeights, weightLabIsCustom, weightLab]);

  return (
    <div className="min-h-screen md:h-screen md:overflow-hidden flex flex-col bg-bg-base pb-20 md:pb-0">
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* ── Top terminal bar ── */}
      <header className="shrink-0 h-11 border-b border-line bg-bg-panel flex items-center px-2 gap-2" style={{ paddingTop: 'var(--safe-top)' }}>
        <Header
            signal={signal ? { action: signal.action, confidence: signal.confidence, score: signal.score } : null}
            ticker={ticker}
            isLoading={klinesLoading && candles.length === 0}
            isRefreshing={klinesLoading && candles.length > 0}
            onRefresh={onRefresh}
            onOpenSettings={() => setSettingsOpen(true)}
            lastUpdate={lastUpdate}
          />
        <div className="hidden md:block w-px h-5 bg-line" />
        <div className="hidden md:flex items-center gap-1.5">
          <ExchangeSelector value={exchange} onChange={setExchange} />
          <PairSelector
            value={symbol}
            onChange={setSymbol}
            lastPrice={ticker?.lastPrice ?? signal?.price ?? null}
            change24h={ticker?.priceChangePercent ?? null}
            exchange={exchange}
            recents={recentPairs}
          />
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <DemoToggle
            isDemo={isDemo}
            preset={demoPreset}
            onToggle={setDemoMode}
            onPresetChange={setDemoPreset}
            realError={realError}
          />
        </div>
      </header>

      {/* ── Main terminal layout ── */}
      <main id="main-content" className="flex-1 min-h-0 flex flex-col md:flex-row">
        {/* Left watchlist */}
        <WatchlistSidebar
          symbol={symbol}
          recents={recentPairs}
          onSelectSymbol={setSymbol}
          className="hidden md:flex"
        />

        {/* Center: chart + multi-timeframe + bottom tabs */}
        <section className="flex-1 min-w-0 flex flex-col overflow-y-auto">
          {realError && !isDemo && !dismissError && (
            <div className="shrink-0 card mx-1.5 mt-1.5 p-2.5 border-warn/40 text-xs flex items-start gap-2">
              <Icon.Info size={14} className="mt-0.5 flex-shrink-0 text-warn" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-warn">Live data unavailable from {exchange}</div>
                <div className="text-2xs text-fg-muted mt-1 break-all">
                  {realError.message || 'Network or geo-block error. The exchange API may be blocked in your region.'}
                </div>
                <div className="text-2xs text-info mt-1.5">
                  Tip: Switch to <span className="font-bold">DEMO</span> mode in the top-right to explore with synthetic data.
                </div>
              </div>
              <button
                onClick={() => setDismissError(true)}
                aria-label="Dismiss error"
                className="flex-shrink-0 p-1 text-fg-muted hover:text-fg transition"
              >
                <Icon.X size={14} />
              </button>
            </div>
          )}

          <div className="flex-1 min-h-[320px] card overflow-hidden m-1.5 flex flex-col">
            <ChartToolbar
              interval={interval}
              onIntervalChange={setInterval}
              showBB={overlays.showBB}
              setShowBB={overlays.setShowBB}
              showEMA={overlays.showEMA}
              setShowEMA={overlays.setShowEMA}
              showFVG={overlays.showFVG}
              setShowFVG={overlays.setShowFVG}
              showOB={overlays.showOB}
              setShowOB={overlays.setShowOB}
              showSR={overlays.showSR}
              setShowSR={overlays.setShowSR}
              showMS={overlays.showMS}
              setShowMS={overlays.setShowMS}
            />
            <div className="relative flex-1 min-h-0">
              {candles.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-3" role="status" aria-live="polite">
                  <div className="w-8 h-8 border-2 border-info border-t-transparent rounded-full animate-spin-slow" />
                  <div className="text-sm text-fg-dim">Loading {symbol} {interval}…</div>
                </div>
              ) : (
                <>
                  <PriceChart
                    symbol={symbol}
                    intervalLabel={interval}
                    candles={candles}
                    fvgs={signal?.fvgs ?? []}
                    orderBlocks={signal?.orderBlocks ?? []}
                    srLevels={srLevels}
                    msSignals={signal?.marketStructure ?? []}
                    showBB={overlays.showBB}
                    showEMA={overlays.showEMA}
                    showFVG={overlays.showFVG}
                    showOB={overlays.showOB}
                    showSR={overlays.showSR}
                    showMS={overlays.showMS}
                  />
                  {klinesLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-bg-base/80 backdrop-blur-sm z-20" role="status" aria-live="polite">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-2 border-info border-t-transparent rounded-full animate-spin-slow" />
                        <div className="text-sm text-fg-dim">Refreshing {symbol} {interval}…</div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <BottomTabBar
            ariaLabel="Analysis panels"
            value={bottomTab}
            onChange={(v) => setBottomTab(v as typeof bottomTab)}
            tabs={bottomTabs}
            className="shrink-0 h-56 border-t border-line"
          />
        </section>

        {/* Right signal panel */}
        <aside className="hidden md:flex w-72 flex-col gap-2 p-2 overflow-y-auto scrollbar-thin bg-bg-panel border-l border-line">
          <SignalCard signal={signal} />
          <RiskCard signal={signal} />
          <IndicatorPanel signal={signal} />
          <div className="text-[9px] text-fg-dim text-center py-1.5 mt-auto">
            Data from {exchange} · Not financial advice
          </div>
        </aside>
      </main>

      <MobileSignalButton signal={signal} onClick={() => setSignalDrawerOpen(true)} />

      <Drawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Chart Settings"
        side="right"
      >
        <IndicatorSettings
          showBB={overlays.showBB}
          showEMA={overlays.showEMA}
          showFVG={overlays.showFVG}
          showOB={overlays.showOB}
          showSR={overlays.showSR}
          showMS={overlays.showMS}
          setShowBB={overlays.setShowBB}
          setShowEMA={overlays.setShowEMA}
          setShowFVG={overlays.setShowFVG}
          setShowOB={overlays.setShowOB}
          setShowSR={overlays.setShowSR}
          setShowMS={overlays.setShowMS}
        />
        <div className="divider my-4" />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={overlays.showDefaults}
            className="flex-1 h-9 rounded text-xs font-bold border bg-bg-elevated border-line text-fg-muted hover:border-line-strong hover:text-fg transition cursor-pointer"
          >
            Show Defaults
          </button>
          <button
            type="button"
            onClick={overlays.hideAll}
            className="flex-1 h-9 rounded text-xs font-bold border bg-bg-elevated border-line text-fg-muted hover:border-line-strong hover:text-fg transition cursor-pointer"
          >
            Hide All
          </button>
        </div>
        <div className="text-2xs text-fg-dim leading-relaxed mt-3">
          Overlays only change visual rendering. The signal scoring always uses all 10 indicators regardless of toggles.
        </div>
      </Drawer>

      <Drawer
        open={signalDrawerOpen}
        onClose={() => setSignalDrawerOpen(false)}
        title={`${symbol} Signal`}
        side="bottom"
      >
        <div className="space-y-3">
          <SignalCard signal={signal} />
          <RiskCard signal={signal} />
          <IndicatorPanel signal={signal} />
        </div>
      </Drawer>
    </div>
  );
}
