'use client';
import { useState, useEffect, useRef } from 'react';
import { Icon } from './Icon';
import { getSignalHistory, clearSignalHistory, type SignalHistoryEntry } from '../lib/signalHistory';
import { fmtPrice } from '../lib/utils';

type Props = { symbol?: string; interval?: string };

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
  const [confirming, setConfirming] = useState(false);
  const [visibleCount, setVisibleCount] = useState(50);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setEntries(getSignalHistory());
  }, []);

  useEffect(() => {
    if (confirming) {
      const t = window.setTimeout(() => confirmRef.current?.focus(), 50);
      return () => window.clearTimeout(t);
    }
  }, [confirming]);

  const filtered = filter === 'symbol' && symbol
    ? entries.filter((e) => e.symbol === symbol && (!interval || e.interval === interval))
    : entries;
  const visibleEntries = filtered.slice(0, visibleCount);

  useEffect(() => {
    setVisibleCount(50);
  }, [filter, symbol, interval, entries.length]);

  const handleClear = () => {
    clearSignalHistory();
    setEntries([]);
    setConfirming(false);
  };

  const handleExport = () => {
    const csv = [
      ['timestamp', 'symbol', 'interval', 'action', 'score', 'confidence', 'regime', 'regimeBias', 'price', 'sl', 'tp', 'rr', 'slSource', 'tpSource', 'reasons'].join(','),
      ...filtered.map((e) => [
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
          <span>Signal History · {filtered.length}{entries.length !== filtered.length ? ` / ${entries.length} total` : ''}</span>
        </div>
        <div className="flex items-center gap-2">
          {symbol && (
            <button
              onClick={() => setFilter(filter === 'all' ? 'symbol' : 'all')}
              aria-pressed={filter === 'symbol'}
              className={`h-7 px-2 text-2xs rounded border font-bold tabular transition cursor-pointer ${
                filter === 'symbol'
                  ? 'bg-info/15 border-info/40 text-info'
                  : 'bg-bg-elevated border-line text-fg-muted hover:border-line-strong hover:text-fg'
              }`}
            >
              {filter === 'symbol' ? `${symbol}` : 'All pairs'}
            </button>
          )}
          {entries.length > 0 && !confirming && (
            <>
              <button
                onClick={handleExport}
                className="h-7 px-2 text-2xs rounded bg-bg-elevated border border-line text-fg-muted hover:border-line-strong hover:text-fg transition cursor-pointer"
                title="Export to CSV"
              >
                CSV
              </button>
              <button
                onClick={() => setConfirming(true)}
                className="h-7 px-2 text-2xs rounded bg-bg-elevated border border-line text-fg-muted hover:border-warn/40 hover:text-warn transition cursor-pointer"
                title="Clear history"
              >
                Clear
              </button>
            </>
          )}
        </div>
      </div>

      {confirming && (
        <div role="alertdialog" aria-label="Confirm clear history" className="flex items-center justify-between gap-3 p-3 rounded bg-warn/10 border border-warn/40">
          <div className="flex items-center gap-2 text-xs text-warn">
            <Icon.Info size={14} />
            <span>Delete all {entries.length} history entries? This cannot be undone.</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setConfirming(false)}
              className="h-8 px-3 text-2xs rounded bg-bg-elevated border border-line text-fg-muted hover:border-line-strong hover:text-fg font-bold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              ref={confirmRef}
              onClick={handleClear}
              className="h-8 px-3 text-2xs rounded bg-warn/20 border border-warn/50 text-warn hover:bg-warn/30 font-bold transition cursor-pointer"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-xs text-fg-muted py-4 text-center">
          {entries.length === 0 ? 'No signals logged yet. Signals will appear here as they are computed.' : 'No signals match the current filter.'}
        </div>
      ) : (
        <div className="max-h-96 overflow-y-auto space-y-1.5 -mx-1 px-1">
          {visibleEntries.map((e) => {
            const slPct = e.action === 'SELL' ? ((e.sl - e.price) / e.price) * 100 : ((e.price - e.sl) / e.price) * 100;
            const tpPct = e.action === 'SELL' ? ((e.price - e.tp) / e.price) * 100 : ((e.tp - e.price) / e.price) * 100;
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
                    <div className="font-mono tabular text-warn">{slPct.toFixed(2)}%</div>
                  </div>
                  <div>
                    <div className="text-fg-dim">TP ({e.tpSource})</div>
                    <div className="font-mono tabular text-info">{tpPct.toFixed(2)}%</div>
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
                  <div
                    className="text-2xs text-fg-dim mt-1.5 leading-relaxed md:truncate md:[mask-image:linear-gradient(to_right,black_70%,transparent)]"
                    title={e.reasons.join(' · ')}
                  >
                    {e.reasons.slice(0, 3).join(' · ')}
                    {e.reasons.length > 3 && <span className="text-fg-dim/60"> · +{e.reasons.length - 3} more</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {filtered.length > visibleCount && (
        <div className="flex flex-col items-center gap-2 pt-1">
          <div className="text-2xs text-fg-dim text-center">
            Showing {visibleEntries.length} of {filtered.length} entries.
          </div>
          <button
            type="button"
            onClick={() => setVisibleCount((v) => Math.min(v + 50, filtered.length))}
            className="h-8 px-3 text-2xs rounded bg-bg-elevated border border-line text-fg-muted hover:border-line-strong hover:text-fg transition cursor-pointer"
          >
            Load 50 more
          </button>
        </div>
      )}

      <div className="text-2xs text-fg-dim leading-relaxed border-t border-line pt-2">
        Signals are auto-logged when action or score changes. Max 200 entries kept in localStorage.
        Export to CSV for backtesting in external tools.
      </div>
    </div>
  );
}
