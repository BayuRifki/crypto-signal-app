'use client';
import { Icon } from './Icon';
import Tooltip from './Tooltip';
import type { Signal } from '../lib/signal';
import type { Ticker24h } from '../lib/binance';

type Props = {
  symbol: string;
  interval: string;
  signal: Signal | null;
  ticker: Ticker24h | null;
};

const fmtPrice = (n: number) => {
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(3);
  return n.toFixed(6);
};

export default function KPIStrip({ signal, ticker }: Props) {
  const rsi = signal?.rsiValue ?? null;
  const rsiState = rsi === null ? 'neutral' : rsi > 70 ? 'sell' : rsi < 30 ? 'buy' : 'neutral';
  const macdHist = signal?.macdHist ?? null;
  const macdState = macdHist === null ? 'neutral' : macdHist > 0 ? 'buy' : 'sell';
  const emaTrend = signal
    ? signal.ema50 !== null && signal.ema200 !== null
      ? signal.price > signal.ema50 && signal.ema50 > signal.ema200
        ? 'buy'
        : signal.price < signal.ema50 && signal.ema50 < signal.ema200
          ? 'sell'
          : 'neutral'
      : 'neutral'
    : 'neutral';
  const change = ticker?.priceChangePercent ?? null;

  const items = [
    {
      label: 'Price',
      value: ticker ? fmtPrice(ticker.lastPrice) : signal ? fmtPrice(signal.price) : '-',
      sub: change !== null ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}% 24h` : 'Live',
      color: change !== null ? (change >= 0 ? 'text-buy' : 'text-sell') : 'text-fg',
      icon: change !== null ? (change >= 0 ? <Icon.TrendUp size={13} /> : <Icon.TrendDown size={13} />) : null,
    },
    {
      label: 'RSI',
      value: rsi !== null ? rsi.toFixed(0) : '-',
      sub: rsiState === 'buy' ? 'Oversold' : rsiState === 'sell' ? 'Overbought' : 'Neutral',
      color: rsiState === 'buy' ? 'text-buy' : rsiState === 'sell' ? 'text-sell' : 'text-fg-muted',
    },
    {
      label: 'MACD',
      value: macdHist !== null ? (macdHist > 0 ? 'Bull' : 'Bear') : '-',
      sub: macdHist !== null ? `Hist ${macdHist > 0 ? '+' : ''}${macdHist.toFixed(2)}` : 'No data',
      color: macdState === 'buy' ? 'text-buy' : macdState === 'sell' ? 'text-sell' : 'text-fg-muted',
    },
    {
      label: 'EMA Trend',
      value: emaTrend === 'buy' ? 'Bullish' : emaTrend === 'sell' ? 'Bearish' : 'Neutral',
      sub: '50 / 200',
      color: emaTrend === 'buy' ? 'text-buy' : emaTrend === 'sell' ? 'text-sell' : 'text-fg-muted',
    },
  ];

  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-line">
        {items.map((it, i) => (
          <Tooltip key={i} label={`${it.label}: ${it.value}`}>
            <div className="p-3 md:p-4 cursor-help hover:bg-bg-panel transition">
              <div className="flex items-center gap-1.5 text-2xs text-fg-dim uppercase tracking-wider font-semibold">
                {it.icon}
                <span>{it.label}</span>
              </div>
              <div className={`text-xl md:text-2xl font-bold tabular mt-1 ${it.color}`}>{it.value}</div>
              <div className="text-2xs text-fg-dim mt-0.5 truncate">{it.sub}</div>
            </div>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}
