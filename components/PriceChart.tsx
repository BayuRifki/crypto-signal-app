'use client';
import { useEffect, useMemo, useRef } from 'react';
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type Time,
  type SeriesMarker,
  CrosshairMode,
  LineStyle,
} from 'lightweight-charts';
import type { Candle } from '../lib/utils';
import { bollinger } from '../lib/indicators/bollinger';
import { emaSeries } from '../lib/indicators/ema';
import type { FVG } from '../lib/indicators/fvg';
import type { OrderBlock } from '../lib/indicators/orderBlock';
import type { SRLevel } from '../lib/indicators/supportResistance';
import type { MSSignal } from '../lib/indicators/marketStructure';
import { Icon } from './Icon';

type Props = {
  symbol: string;
  intervalLabel: string;
  candles: Candle[];
  fvgs: FVG[];
  orderBlocks: OrderBlock[];
  srLevels: SRLevel[];
  msSignals: MSSignal[];
  showBB: boolean;
  showEMA: boolean;
  showFVG: boolean;
  showOB: boolean;
  showSR: boolean;
  showMS: boolean;
};

type OverlaySeries = {
  bbMid: ISeriesApi<'Line'> | null;
  bbUp: ISeriesApi<'Line'> | null;
  bbLo: ISeriesApi<'Line'> | null;
  ema50: ISeriesApi<'Line'> | null;
  ema200: ISeriesApi<'Line'> | null;
};

/**
 * Dataset signature used to detect a context switch (pair/timeframe change) vs.
 * a same-context live refresh.
 *
 * Strategy: compare the **bar interval** and the **last candle timestamp**.
 * - Live refresh: the window slides forward by one bar → `last` advances, but
 *   the interval stays the same and `last` always moves forward.
 * - Timeframe change: the interval itself changes.
 * - Pair change: `last` jumps to a completely different range (it may go
 *   backwards or jump far ahead). We detect this by checking whether the new
 *   `last` is a forward continuation of the old dataset (within 2× interval).
 *
 * Extracted as a pure helper so the context-switch policy can be unit-tested
 * without a chart instance (regression coverage for assessment R1: the viewport
 * used to leak from a previous pair/timeframe into a new dataset).
 */
export type DatasetSig = { last: number; interval: number };
export type ChartContextSig = DatasetSig & { symbol: string; intervalLabel: string };

export const computeDatasetSig = (times: number[]): DatasetSig | null => {
  if (times.length === 0) return null;
  const last = times[times.length - 1];
  const secondToLast = times[times.length - 2];
  const interval = secondToLast !== undefined && last > secondToLast
    ? last - secondToLast
    : times[1] !== undefined && times[1] > times[0]
      ? times[1] - times[0]
      : 0;
  return { last, interval };
};

export const isContextSwitch = (prev: ChartContextSig | null, next: ChartContextSig): boolean => {
  if (prev === null) return true;
  if (prev.symbol !== next.symbol) return true;
  if (prev.intervalLabel !== next.intervalLabel) return true;
  if (prev.interval !== next.interval) return true;
  // Same interval: if `last` moved forward by at most a few bars (within 20×
  // the bar interval), or stayed the same (no new data yet), it's a live
  // refresh. Anything else (backward jump, huge forward jump) is a context
  // switch (e.g. user switched pair or timeframe).
  const gap = next.last - prev.last;
  return gap < 0 || gap > next.interval * 20;
};

export default function PriceChart({
  symbol,
  intervalLabel,
  candles,
  fvgs,
  orderBlocks,
  srLevels,
  msSignals,
  showBB,
  showEMA,
  showFVG,
  showOB,
  showSR,
  showMS,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const overlayRef = useRef<OverlaySeries>({ bbMid: null, bbUp: null, bbLo: null, ema50: null, ema200: null });
  const priceLinesRef = useRef<IPriceLine[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: { background: { color: '#0B0E11' }, textColor: '#848E9C', fontSize: 11 },
      grid: {
        vertLines: { color: 'rgba(43,49,57,0.5)' },
        horzLines: { color: 'rgba(43,49,57,0.5)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#3E454D', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#1E2329' },
        horzLine: { color: '#3E454D', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#1E2329' },
      },
      rightPriceScale: { borderColor: '#2B3139', scaleMargins: { top: 0.08, bottom: 0.08 } },
      timeScale: { borderColor: '#2B3139', timeVisible: true, secondsVisible: false, rightOffset: 5, barSpacing: 8 },
    });
    const series = chart.addCandlestickSeries({
      upColor: '#0ECB81',
      downColor: '#F6465D',
      borderUpColor: '#0ECB81',
      borderDownColor: '#F6465D',
      wickUpColor: '#0ECB81',
      wickDownColor: '#F6465D',
      priceLineVisible: false,
    });
    chartRef.current = chart;
    candleSeriesRef.current = series;
    return () => {
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      overlayRef.current = { bbMid: null, bbUp: null, bbLo: null, ema50: null, ema200: null };
      priceLinesRef.current = [];
    };
  }, []);

  const candleData = useMemo(
    () => candles.map((c) => ({ time: c.time as Time, open: c.open, high: c.high, low: c.low, close: c.close })),
    [candles]
  );

  // Track the dataset identity to detect context switches (pair/timeframe change)
  // vs. live refreshes within the same context. A live refresh slides the window
  // by a few bars at most; a context switch swaps in a completely different range.
  // The signature is derived from the bar spacing of the first candle, which is
  // stable for the same interval but changes when the interval or pair changes.
  const datasetSigRef = useRef<ChartContextSig | null>(null);

  useEffect(() => {
    if (!candleSeriesRef.current || candleData.length === 0) return;
    candleSeriesRef.current.setData(candleData);

    const prevSymbol = datasetSigRef.current?.symbol;
    const prevInterval = datasetSigRef.current?.intervalLabel;
    const nextBaseSig = computeDatasetSig(candleData.map((c) => c.time as number));
    const nextSig = nextBaseSig
      ? { ...nextBaseSig, symbol, intervalLabel }
      : null;
    if (
      nextSig &&
      (prevSymbol !== symbol ||
        prevInterval !== intervalLabel ||
        isContextSwitch(datasetSigRef.current, nextSig))
    ) {
      // New pair/timeframe (or initial load): reset the viewport to fit the new
      // dataset so the user is not left looking at a stale zoom/pan position.
      chartRef.current?.timeScale().fitContent();
      datasetSigRef.current = nextSig;
    }
    // Same context live refresh: preserve the user's viewport.
  }, [candleData, symbol, intervalLabel]);

  const bbData = useMemo(() => (showBB ? bollinger(candles, 20, 2) : null), [candles, showBB]);
  const emaData = useMemo(() => {
    if (!showEMA) return null;
    const closes = candles.map((c) => c.close);
    return { e50: emaSeries(closes, 50), e200: emaSeries(closes, 200) };
  }, [candles, showEMA]);

  const markersData = useMemo<SeriesMarker<Time>[]>(() => {
    if (!showMS || msSignals.length === 0) return [];
    // Deduplicate nearby markers: if two consecutive signals share the same
    // type AND direction within 3 bars, keep only the latest one to reduce
    // visual clutter on dense structure zones.
    const raw = msSignals.slice(-30);
    const deduped: typeof raw = [];
    for (let i = 0; i < raw.length; i++) {
      const prev = deduped[deduped.length - 1];
      if (
        prev &&
        prev.type === raw[i].type &&
        prev.direction === raw[i].direction &&
        Math.abs(raw[i].time - prev.time) < (candles.length > 1 ? (candles[1].time - candles[0].time) * 3 : Infinity)
      ) continue;
      deduped.push(raw[i]);
    }
    return deduped.slice(-12).map((m) => ({
      time: m.time as Time,
      position: m.direction === 'bullish' ? 'belowBar' : 'aboveBar',
      color: m.direction === 'bullish' ? '#3B82F6' : '#F0B90B',
      shape: m.type === 'BOS' ? 'arrowUp' : 'circle',
      text: m.type,
    }));
  }, [msSignals, showMS, candles]);

  useEffect(() => {
    candleSeriesRef.current?.setMarkers(markersData);
  }, [markersData]);

  useEffect(() => {
    const chart = chartRef.current;
    const ov = overlayRef.current;
    if (!chart || !candleSeriesRef.current || candles.length === 0) return;

    const lineOpts = (color: string) => ({ color, lineWidth: 1 as const, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });

    if (showBB && bbData) {
      if (!ov.bbMid) {
        ov.bbMid = chart.addLineSeries(lineOpts('#475569'));
        ov.bbUp = chart.addLineSeries(lineOpts('#3B82F6'));
        ov.bbLo = chart.addLineSeries(lineOpts('#3B82F6'));
      }
      const bbMidData = bbData.map((b, i) => ({ time: candles[i]?.time as Time, value: b.middle ?? NaN })).filter(d => d.time !== undefined);
      const bbUpData = bbData.map((b, i) => ({ time: candles[i]?.time as Time, value: b.upper ?? NaN })).filter(d => d.time !== undefined);
      const bbLoData = bbData.map((b, i) => ({ time: candles[i]?.time as Time, value: b.lower ?? NaN })).filter(d => d.time !== undefined);
      ov.bbMid.setData(bbMidData);
      if (ov.bbUp) ov.bbUp.setData(bbUpData);
      if (ov.bbLo) ov.bbLo.setData(bbLoData);
    } else if (ov.bbMid) {
      try { chart.removeSeries(ov.bbMid); } catch {}
      if (ov.bbUp) try { chart.removeSeries(ov.bbUp); } catch {}
      if (ov.bbLo) try { chart.removeSeries(ov.bbLo); } catch {}
      ov.bbMid = null; ov.bbUp = null; ov.bbLo = null;
    }

    if (showEMA && emaData) {
      if (!ov.ema50) {
        ov.ema50 = chart.addLineSeries(lineOpts('#F0B90B'));
        ov.ema200 = chart.addLineSeries(lineOpts('#6366F1'));
      }
      const ema50Data = emaData.e50.map((v, i) => ({ time: candles[i]?.time as Time, value: v ?? NaN })).filter(d => d.time !== undefined);
      const ema200Data = emaData.e200.map((v, i) => ({ time: candles[i]?.time as Time, value: v ?? NaN })).filter(d => d.time !== undefined);
      ov.ema50.setData(ema50Data);
      if (ov.ema200) ov.ema200.setData(ema200Data);
    } else if (ov.ema50) {
      try { chart.removeSeries(ov.ema50); } catch {}
      if (ov.ema200) try { chart.removeSeries(ov.ema200); } catch {}
      ov.ema50 = null; ov.ema200 = null;
    }
  }, [candles, bbData, emaData, showBB, showEMA]);

  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series) return;
    for (const pl of priceLinesRef.current) {
      try { series.removePriceLine(pl); } catch {}
    }
    priceLinesRef.current = [];

    const addLine = (price: number, color: string, style: LineStyle, title: string) =>
      series.createPriceLine({ price, color, lineWidth: 1, lineStyle: style, axisLabelVisible: true, title });

    if (showFVG) {
      for (const f of fvgs) {
        if (f.mitigated) continue;
        const color = f.type === 'bullish' ? '#0ECB81' : '#F6465D';
        priceLinesRef.current.push(
          addLine(f.top, color, LineStyle.Dashed, `FVG ${f.type[0].toUpperCase()}`),
          addLine(f.bottom, color, LineStyle.Dashed, '')
        );
      }
    }

    if (showOB) {
      for (const o of orderBlocks) {
        const color = o.type === 'bullish' ? '#0ECB81' : '#F6465D';
        priceLinesRef.current.push(
          addLine(o.top, color, LineStyle.Solid, `OB ${o.type === 'bullish' ? '+' : '-'}`),
          addLine(o.bottom, color, LineStyle.Solid, '')
        );
      }
    }

    if (showSR) {
      for (const lvl of srLevels) {
        const color = lvl.type === 'support' ? '#3B82F6' : '#6366F1';
        priceLinesRef.current.push(addLine(lvl.price, color, LineStyle.LargeDashed, lvl.type[0].toUpperCase()));
      }
    }
  }, [fvgs, orderBlocks, srLevels, showFVG, showOB, showSR]);

  const handleFit = () => chartRef.current?.timeScale().fitContent();
  const handleZoom = (delta: number) => {
    const ts = chartRef.current?.timeScale();
    if (!ts) return;
    const logical = ts.getVisibleLogicalRange();
    if (!logical) return;
    const span = logical.to - logical.from;
    const factor = delta > 0 ? 1.25 : 0.8;
    const pad = (span * (factor - 1)) / 2;
    ts.setVisibleLogicalRange({ from: logical.from - pad, to: logical.to + pad });
  };

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {/* Zoom controls live at bottom-right so they don't overlap the crosshair
          label, time-axis labels, or the price scale at the top of the chart. */}
      <div className="absolute bottom-2 right-12 flex flex-col gap-1 z-10">
        <button onClick={() => handleZoom(1)} className="w-9 h-9 rounded bg-bg-elevated/90 border border-line hover:border-line-strong text-fg-muted hover:text-fg hover:bg-bg-panel flex items-center justify-center backdrop-blur transition cursor-pointer" aria-label="Zoom in" title="Zoom in">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
        </button>
        <button onClick={() => handleZoom(-1)} className="w-9 h-9 rounded bg-bg-elevated/90 border border-line hover:border-line-strong text-fg-muted hover:text-fg hover:bg-bg-panel flex items-center justify-center backdrop-blur transition cursor-pointer" aria-label="Zoom out" title="Zoom out">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12" /></svg>
        </button>
        <button onClick={handleFit} className="w-9 h-9 rounded bg-bg-elevated/90 border border-line hover:border-line-strong text-fg-muted hover:text-fg hover:bg-bg-panel flex items-center justify-center backdrop-blur transition cursor-pointer" aria-label="Fit to content" title="Fit to content">
          <Icon.Target size={14} />
        </button>
      </div>
    </div>
  );
}
