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

export default function PriceChart({
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
  const lineSeriesRef = useRef<ISeriesApi<'Line'>[]>([]);
  const priceLinesRef = useRef<IPriceLine[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: { background: { color: '#070b14' }, textColor: '#94a3b8', fontSize: 11 },
      grid: {
        vertLines: { color: 'rgba(148,163,184,0.04)' },
        horzLines: { color: 'rgba(148,163,184,0.04)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#475569', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#0d1320' },
        horzLine: { color: '#475569', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#0d1320' },
      },
      rightPriceScale: { borderColor: 'rgba(148,163,184,0.08)', scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { borderColor: 'rgba(148,163,184,0.08)', timeVisible: true, secondsVisible: false, rightOffset: 4, barSpacing: 7 },
    });
    const series = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
      priceLineVisible: false,
    });
    chartRef.current = chart;
    candleSeriesRef.current = series;
    return () => {
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      lineSeriesRef.current = [];
      priceLinesRef.current = [];
    };
  }, []);

  const candleData = useMemo(
    () => candles.map((c) => ({ time: c.time as Time, open: c.open, high: c.high, low: c.low, close: c.close })),
    [candles]
  );

  useEffect(() => {
    if (!candleSeriesRef.current || candleData.length === 0) return;
    candleSeriesRef.current.setData(candleData);
    chartRef.current?.timeScale().fitContent();
  }, [candleData]);

  const bbData = useMemo(() => (showBB ? bollinger(candles, 20, 2) : null), [candles, showBB]);
  const emaData = useMemo(() => {
    if (!showEMA) return null;
    const closes = candles.map((c) => c.close);
    return { e50: emaSeries(closes, 50), e200: emaSeries(closes, 200) };
  }, [candles, showEMA]);

  const markersData = useMemo<SeriesMarker<Time>[]>(() => {
    if (!showMS || msSignals.length === 0) return [];
    return msSignals.slice(-20).map((m) => ({
      time: m.time as Time,
      position: m.direction === 'bullish' ? 'belowBar' : 'aboveBar',
      color: m.direction === 'bullish' ? '#10b981' : '#ef4444',
      shape: m.type === 'BOS' ? 'arrowUp' : 'circle',
      text: m.type,
    }));
  }, [msSignals, showMS]);

  useEffect(() => {
    candleSeriesRef.current?.setMarkers(markersData);
  }, [markersData]);

  useEffect(() => {
    const chart = chartRef.current;
    const series = candleSeriesRef.current;
    if (!chart || !series || candles.length === 0) return;

    for (const ln of lineSeriesRef.current) {
      try { chart.removeSeries(ln); } catch {}
    }
    lineSeriesRef.current = [];
    for (const pl of priceLinesRef.current) {
      try { series.removePriceLine(pl); } catch {}
    }
    priceLinesRef.current = [];

    if (bbData) {
      const mid = chart.addLineSeries({ color: '#475569', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
      const up = chart.addLineSeries({ color: '#0ea5e9', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
      const lo = chart.addLineSeries({ color: '#0ea5e9', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
      mid.setData(bbData.map((b, i) => ({ time: candles[i].time as Time, value: b.middle ?? NaN })));
      up.setData(bbData.map((b, i) => ({ time: candles[i].time as Time, value: b.upper ?? NaN })));
      lo.setData(bbData.map((b, i) => ({ time: candles[i].time as Time, value: b.lower ?? NaN })));
      lineSeriesRef.current.push(mid, up, lo);
    }

    if (emaData) {
      const s50 = chart.addLineSeries({ color: '#f59e0b', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
      const s200 = chart.addLineSeries({ color: '#8b5cf6', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
      s50.setData(emaData.e50.map((v, i) => ({ time: candles[i].time as Time, value: v ?? NaN })));
      s200.setData(emaData.e200.map((v, i) => ({ time: candles[i].time as Time, value: v ?? NaN })));
      lineSeriesRef.current.push(s50, s200);
    }

    const addLine = (price: number, color: string, style: LineStyle, title: string) =>
      series.createPriceLine({ price, color, lineWidth: 1, lineStyle: style, axisLabelVisible: true, title });

    if (showFVG) {
      for (const f of fvgs) {
        if (f.mitigated) continue;
        const color = f.type === 'bullish' ? '#10b981' : '#ef4444';
        priceLinesRef.current.push(
          addLine(f.top, color, LineStyle.Dashed, `FVG ${f.type[0].toUpperCase()}`),
          addLine(f.bottom, color, LineStyle.Dashed, '')
        );
      }
    }

    if (showOB) {
      for (const o of orderBlocks) {
        const color = o.type === 'bullish' ? '#10b981' : '#ef4444';
        priceLinesRef.current.push(
          addLine(o.top, color, LineStyle.Solid, `OB ${o.type === 'bullish' ? '+' : '-'}`),
          addLine(o.bottom, color, LineStyle.Solid, '')
        );
      }
    }

    if (showSR) {
      for (const lvl of srLevels) {
        const color = lvl.type === 'support' ? '#22d3ee' : '#f472b6';
        priceLinesRef.current.push(addLine(lvl.price, color, LineStyle.LargeDashed, lvl.type[0].toUpperCase()));
      }
    }
  }, [candles, bbData, emaData, fvgs, orderBlocks, srLevels, showFVG, showOB, showSR]);

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
      <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
        <button onClick={() => handleZoom(1)} className="w-7 h-7 rounded bg-bg-elevated/90 border border-line hover:border-line-strong text-fg-muted hover:text-fg flex items-center justify-center backdrop-blur transition" aria-label="Zoom in">
          <span className="text-base font-bold leading-none">+</span>
        </button>
        <button onClick={() => handleZoom(-1)} className="w-7 h-7 rounded bg-bg-elevated/90 border border-line hover:border-line-strong text-fg-muted hover:text-fg flex items-center justify-center backdrop-blur transition" aria-label="Zoom out">
          <span className="text-base font-bold leading-none">−</span>
        </button>
        <button onClick={handleFit} className="w-7 h-7 rounded bg-bg-elevated/90 border border-line hover:border-line-strong text-fg-muted hover:text-fg flex items-center justify-center backdrop-blur transition" aria-label="Fit to content" title="Fit to content">
          <Icon.Target size={13} />
        </button>
      </div>
    </div>
  );
}
