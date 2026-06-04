'use client';
import { useState, useMemo, useEffect, useCallback } from 'react';
import Header from '../components/Header';
import PairSelector from '../components/PairSelector';
import TimeframeTabs from '../components/TimeframeTabs';
import PriceChart from '../components/PriceChart';
import SignalCard from '../components/SignalCard';
import RiskCard from '../components/RiskCard';
import IndicatorPanel from '../components/IndicatorPanel';
import IndicatorSettings from '../components/IndicatorSettings';
import MultiTimeframeRow from '../components/MultiTimeframeRow';
import KPIStrip from '../components/KPIStrip';
import StructurePanel from '../components/StructurePanel';
import Drawer from '../components/Drawer';
import MobileSignalButton from '../components/MobileSignalButton';
import BacktestPanel from '../components/BacktestPanel';
import HistoryPanel from '../components/HistoryPanel';
import Tabs from '../components/Tabs';

import { useKlines } from '../lib/hooks/useKlines';
import { useTicker } from '../lib/hooks/useTicker';
import { useSignal } from '../lib/hooks/useSignal';
import type { Interval } from '../lib/binance';
import { supportResistance } from '../lib/indicators/supportResistance';
import { Icon } from '../components/Icon';

const LAST_PAIRS_KEY = 'cs:lastPairs';
const DEFAULT_PAIRS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'];

export default function HomePage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [interval, setInterval] = useState<Interval>('1h');
  const [showBB, setShowBB] = useState(true);
  const [showEMA, setShowEMA] = useState(true);
  const [showFVG, setShowFVG] = useState(false);
  const [showOB, setShowOB] = useState(false);
  const [showSR, setShowSR] = useState(false);
  const [showMS, setShowMS] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [signalDrawerOpen, setSignalDrawerOpen] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [bottomTab, setBottomTab] = useState<'structure' | 'backtest' | 'history'>('structure');

  const { candles, isLoading: klinesLoading, refresh: refreshKlines, error: klinesError } = useKlines(symbol, interval, 500);
  const { ticker, refresh: refreshTicker } = useTicker(symbol);
  const signal = useSignal(candles, symbol, interval);
  const srLevels = useMemo(() => {
    if (candles.length < 50) return [];
    const sr = supportResistance(candles, 100);
    return [...sr.pivots, ...sr.supports, ...sr.resistances];
  }, [candles]);

  useEffect(() => {
    if (candles.length > 0) setLastUpdate(new Date());
  }, [candles]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAST_PAIRS_KEY);
      const arr: string[] = Array.isArray(JSON.parse(raw || 'null')) ? JSON.parse(raw!) : DEFAULT_PAIRS;
      const next = [symbol, ...arr.filter((s) => s !== symbol)].slice(0, 6);
      localStorage.setItem(LAST_PAIRS_KEY, JSON.stringify(next));
    } catch {}
  }, [symbol]);

  const onRefresh = useCallback(() => {
    refreshKlines();
    refreshTicker();
  }, [refreshKlines, refreshTicker]);

  return (
    <div className="min-h-screen pb-24 md:pb-6">
      <Header
        symbol={symbol}
        interval={interval}
        signal={signal ? { action: signal.action, confidence: signal.confidence, score: signal.score } : null}
        ticker={ticker}
        isLoading={klinesLoading && candles.length === 0}
        isRefreshing={klinesLoading && candles.length > 0}
        onRefresh={onRefresh}
        onOpenSettings={() => setSettingsOpen(true)}
        lastUpdate={lastUpdate}
      />

      <main className="max-w-[1600px] mx-auto px-3 md:px-5 py-3 md:py-4 space-y-3 md:space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <PairSelector
            value={symbol}
            onChange={setSymbol}
            lastPrice={ticker?.lastPrice ?? signal?.price ?? null}
            change24h={ticker?.priceChangePercent ?? null}
          />
          <TimeframeTabs value={interval} onChange={setInterval} />
        </div>

        <KPIStrip symbol={symbol} signal={signal} ticker={ticker} interval={interval} />

        {klinesError && (
          <div className="card p-4 border-sell/40 text-sell text-sm flex items-center gap-2">
            <Icon.Info size={14} />
            Failed to load market data. Pull to refresh.
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-3 md:gap-4">
          <div className="space-y-3 md:space-y-4 min-w-0">
            <div className="card overflow-hidden">
              <div className="h-[55vh] min-h-[360px] max-h-[640px]">
                {klinesLoading && candles.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center gap-3">
                    <div className="w-8 h-8 border-2 border-info border-t-transparent rounded-full animate-spin-slow" />
                    <div className="text-sm text-fg-dim">Loading {symbol} {interval}…</div>
                  </div>
                ) : (
                  <PriceChart
                    candles={candles}
                    fvgs={signal?.fvgs ?? []}
                    orderBlocks={signal?.orderBlocks ?? []}
                    srLevels={srLevels}
                    msSignals={signal?.marketStructure ?? []}
                    showBB={showBB}
                    showEMA={showEMA}
                    showFVG={showFVG}
                    showOB={showOB}
                    showSR={showSR}
                    showMS={showMS}
                  />
                )}
              </div>
            </div>

            <MultiTimeframeRow symbol={symbol} activeTf={interval} />

            <div className="space-y-3">
              <Tabs
                value={bottomTab}
                onChange={(v) => setBottomTab(v as 'structure' | 'backtest' | 'history')}
                size="sm"
                tabs={[
                  { id: 'structure', label: 'Market Structure', icon: <Icon.Layers size={12} /> },
                  { id: 'backtest', label: 'Backtest', icon: <Icon.Activity size={12} /> },
                  { id: 'history', label: 'History', icon: <Icon.Clock size={12} /> },
                ]}
              />
              {bottomTab === 'structure' ? (
                <StructurePanel
                  price={signal?.price ?? 0}
                  fvgs={signal?.fvgs ?? []}
                  orderBlocks={signal?.orderBlocks ?? []}
                  msSignals={signal?.marketStructure ?? []}
                  sweeps={signal?.sweeps ?? []}
                  srLevels={srLevels}
                />
              ) : bottomTab === 'backtest' ? (
                <BacktestPanel candles={candles} symbol={symbol} interval={interval} />
              ) : (
                <HistoryPanel symbol={symbol} interval={interval} />
              )}
            </div>

            <div className="text-2xs text-fg-dim text-center py-2">
              Data: Binance public API · Not financial advice · For analysis only
            </div>
          </div>

          <aside className="hidden lg:block space-y-3 md:space-y-4">
            <SignalCard signal={signal} />
            <RiskCard signal={signal} />
            <IndicatorPanel signal={signal} />
          </aside>
        </div>
      </main>

      <MobileSignalButton signal={signal} onClick={() => setSignalDrawerOpen(true)} />

      <Drawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Chart Settings"
        side="right"
      >
        <IndicatorSettings
          showBB={showBB} setShowBB={setShowBB}
          showEMA={showEMA} setShowEMA={setShowEMA}
          showFVG={showFVG} setShowFVG={setShowFVG}
          showOB={showOB} setShowOB={setShowOB}
          showSR={showSR} setShowSR={setShowSR}
          showMS={showMS} setShowMS={setShowMS}
        />
        <div className="divider my-4" />
        <div className="text-2xs text-fg-dim leading-relaxed">
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
