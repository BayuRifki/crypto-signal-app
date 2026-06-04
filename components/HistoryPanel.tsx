'use client';
import { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { getSignalHistory, clearSignalHistory, type SignalHistoryEntry } from '../lib/signalHistory';

type Props = { symbol?: string; interval?: string };

const fmtPrice = (n: number) => {
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(3);
  return n.toFixed(6);
};

const fmtTime = (ts: number) => {
  const d = new Date(ts);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

const ACTION_COLOR: Record<SignalHistoryEntry['action'], string> = {
  BUY: 'text-buy',
  SELL: 'text-sell',
  HOLD: 'text-fg-dim',
};

export default function HistoryPanel({ symbol, interval }: Props) {
  const [entries, setEntries] = useState<SignalHistoryEntry[]>([]);
  const [filter, setFilter] = useState<'all' | 'symbol'>('all');

  useEffect(() => {
    setEntries(getSignalHistory());
  }, []);

  const filtered = filter === 'symbol' && symbol
    ? entries.filter((e) => e.symbol === symbol && (!interval || e.interval === interval))
    : entries;

  const handleClear = () => {
    if (!confirm('Clear all signal history? This cannot be undone.')) return;
    clearSignalHistory();
    setEntries([]);
  };

  const handleExport = () => {
    const csv = [
      ['timestamp', 'symbol', 'interval', 'action', 'score', 'confidence', 'regime', 'regimeBias', 'price', 'sl', 'tp', 'rr', 'slSource', 'tpSource', 'reasons'].join(','),
      ...entries.map((e) => [
        new Date(e.ts).toISOString(),
        e.symbol,
        e.interval,
        e.action,
        e.score,
        e.confidence,
        e.regime,
        e.regimeBias,
        e.price.toFixed(6),
        e.sl.toFixed(6),
        e.tp.toFixed(6),
        e.rr.toFixed(3),
        e.slSource,
        e.tpSource,
        `"${e.reasons.join('; ').replace(/"/g, '""')}"`,
      ].join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `signal-history-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-2xs text-fg-dim uppercase tracking-wider font-bold">
          <Icon.Clock size={12} />
          <span>Signal History · {entries.length}</span>
        </div>
        <div className="flex items-center gap-2">
          {symbol && (
            <button
              onClick={() => setFilter(filter === 'all' ? 'symbol' : 'all')}
              className={`text-2xs px-2 py-1 rounded border font-bold tabular transition ${
                filter === 'symbol'
                  ? 'bg-info/15 border-info/40 text-info'
                  : 'bg-bg-elevated border-line text-fg-muted hover:border-line-strong'
              }`}
            >
              {filter === 'symbol' ? `${symbol}` : 'All pairs'}
            </button>
          )}
          {entries.length > 0 && (
            <>
              <button
                onClick={handleExport}
                className="text-2xs px-2 py-1 rounded bg-bg-elevated border border-line text-fg-muted hover:border-line-strong"
                title="Export to CSV"
              >
                CSV
              </button>
              <button
                onClick={handleClear}
                className="text-2xs px-2 py-1 rounded bg-bg-elevated border border-line text-fg-muted hover:border-sell/40 hover:text-sell"
                title="Clear history"
              >
                Clear
              </button>
            </>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-xs text-fg-muted py-4 text-center">
          {entries.length === 0 ? 'No signals logged yet. Signals will appear here as they are computed.' : 'No signals match the current filter.'}
        </div>
      ) : (
        <div className="max-h-96 overflow-y-auto space-y-1.5 -mx-1 px-1">
          {filtered.slice(0, 50).map((e) => {
            const slPct = ((e.sl - e.price) / e.price) * 100;
            const tpPct = ((e.tp - e.price) / e.price) * 100;
            return (
              <div key={`${e.ts}-${e.symbol}-${e.interval}`} className="p-2 rounded bg-bg-elevated border border-line hover:border-line-strong transition">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className={`font-black ${ACTION_COLOR[e.action]}`}>{e.action}</span>
                    <span className="text-fg-dim">·</span>
                    <span className="text-fg-muted font-mono">{e.symbol}</span>
                    <span className="text-fg-dim text-2xs">{e.interval}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-2xs">
                    <span className="text-fg-dim">{fmtTime(e.ts)}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-2xs">
                  <div>
                    <div className="text-fg-dim">Price</div>
                    <div className="font-mono tabular text-fg">{fmtPrice(e.price)}</div>
                  </div>
                  <div>
                    <div className="text-fg-dim">SL ({e.slSource})</div>
                    <div className="font-mono tabular text-sell">{slPct.toFixed(2)}%</div>
                  </div>
                  <div>
                    <div className="text-fg-dim">TP ({e.tpSource})</div>
                    <div className="font-mono tabular text-buy">{tpPct.toFixed(2)}%</div>
                  </div>
                  <div>
                    <div className="text-fg-dim">Conf</div>
                    <div className="font-mono tabular text-fg">{e.confidence}%</div>
                  </div>
                  <div>
                    <div className="text-fg-dim">R:R</div>
                    <div className="font-mono tabular text-fg">1:{e.rr.toFixed(2)}</div>
                  </div>
                </div>
                {e.reasons.length > 0 && (
                  <div className="text-2xs text-fg-dim mt-1.5 leading-relaxed truncate" title={e.reasons.join(' · ')}>
                    {e.reasons.slice(0, 3).join(' · ')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="text-2xs text-fg-dim leading-relaxed border-t border-line pt-2">
        Signals are auto-logged when action or score changes. Max 200 entries kept in localStorage.
        Export to CSV for backtesting in external tools.
      </div>
    </div>
  );
}