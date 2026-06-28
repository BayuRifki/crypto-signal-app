'use client';
import { Icon } from './Icon';
import Tabs from './Tabs';
import type { FVG } from '../lib/indicators/fvg';
import type { OrderBlock } from '../lib/indicators/orderBlock';
import type { MSSignal } from '../lib/indicators/marketStructure';
import type { Sweep } from '../lib/indicators/liquiditySweep';
import type { SRLevel } from '../lib/indicators/supportResistance';
import { useState } from 'react';
import { fmtPrice } from '../lib/utils';

type Props = {
  price: number;
  fvgs: FVG[];
  orderBlocks: OrderBlock[];
  msSignals: MSSignal[];
  sweeps: Sweep[];
  srLevels: SRLevel[];
};

export default function StructurePanel({ price, fvgs, orderBlocks, msSignals, sweeps, srLevels }: Props) {
  const [tab, setTab] = useState('im');

  const activeFVG = fvgs.filter((f) => !f.mitigated).length;
  const tabs = [
    { id: 'im', label: 'Imbalance', count: activeFVG + orderBlocks.length },
    { id: 'st', label: 'Structure', count: msSignals.length + sweeps.length },
    { id: 'sr', label: 'S / R', count: srLevels.length },
  ];

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-2xs text-fg-dim uppercase tracking-wider font-bold">
          <Icon.Layers size={12} />
          <span>Smart Money Map</span>
        </div>
        <div className="text-2xs text-fg-dim tabular font-mono">{fmtPrice(price)}</div>
      </div>
      <Tabs tabs={tabs} value={tab} onChange={setTab} size="sm" ariaLabel="Smart money map views" />
      <div className="mt-3">
        {tab === 'im' && <ImbalanceView price={price} fvgs={fvgs} obs={orderBlocks} />}
        {tab === 'st' && <StructureView signals={msSignals} sweeps={sweeps} price={price} />}
        {tab === 'sr' && <SRView price={price} levels={srLevels} />}
      </div>
    </div>
  );
}

const EmptyMsg = ({ text }: { text: string }) => (
  <div className="text-center text-2xs text-fg-dim py-6">{text}</div>
);

const ImbalanceView = ({ price, fvgs, obs }: { price: number; fvgs: FVG[]; obs: OrderBlock[] }) => {
  const activeFVG = fvgs.filter((f) => !f.mitigated);
  if (activeFVG.length === 0 && obs.length === 0) return <EmptyMsg text="No active imbalance zones" />;

  const bullishFVG = activeFVG.filter((f) => f.type === 'bullish').slice(-4);
  const bearishFVG = activeFVG.filter((f) => f.type === 'bearish').slice(-4);
  const bullishOB = obs.filter((o) => o.type === 'bullish').slice(-4);
  const bearishOB = obs.filter((o) => o.type === 'bearish').slice(-4);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto scrollbar-thin pr-0.5">
      <ZoneColumn
        title="Bullish Zones"
        tone="bullish"
        fvgs={bullishFVG}
        obs={bullishOB}
        price={price}
        priceLabel="below price"
      />
      <ZoneColumn
        title="Bearish Zones"
        tone="bearish"
        fvgs={bearishFVG}
        obs={bearishOB}
        price={price}
        priceLabel="above price"
      />
    </div>
  );
};

const ZoneColumn = ({
  title,
  tone,
  fvgs,
  obs,
  price,
  priceLabel,
}: {
  title: string;
  tone: 'bullish' | 'bearish';
  fvgs: FVG[];
  obs: OrderBlock[];
  price: number;
  priceLabel: string;
}) => {
  const isBull = tone === 'bullish';
  const headerDot = isBull ? 'bg-buy' : 'bg-sell';
  const headerBorder = isBull ? 'border-buy/20' : 'border-sell/20';
  const tagStyle = isBull
    ? 'bg-buy/15 text-buy border-buy/30'
    : 'bg-sell/15 text-sell border-sell/30';

  return (
    <div className={`rounded border ${headerBorder} bg-bg-elevated/40 overflow-hidden`}>
      <div className={`flex items-center justify-between px-2 py-1 border-b ${headerBorder} bg-bg-elevated`}>
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${headerDot}`} aria-hidden="true" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-fg">{title}</span>
        </div>
        <span className="text-[9px] text-fg-dim">{priceLabel}</span>
      </div>
      <div className="p-1.5 space-y-1">
        {fvgs.length === 0 && obs.length === 0 && (
          <div className="text-[10px] text-fg-dim text-center py-2">—</div>
        )}
        {fvgs.map((f, i) => {
          const inside = price >= f.bottom && price <= f.top;
          return (
            <div key={`f${i}`} className={`flex items-center gap-1.5 px-1.5 py-1 rounded text-[11px] ${inside ? 'bg-info/10' : 'bg-bg-elevated'}`}>
              <span className={`px-1 py-0.5 rounded text-[9px] font-bold border ${tagStyle}`}>FVG</span>
              <span className="flex-1 font-mono tabular text-fg truncate">
                {fmtPrice(f.bottom)}→{fmtPrice(f.top)}
              </span>
              <span className="text-[9px] tabular text-fg-dim w-10 text-right flex-shrink-0">
                {inside ? <span className="text-info font-bold">IN</span> : `${(((price - f.midpoint) / price) * 100).toFixed(1)}%`}
              </span>
            </div>
          );
        })}
        {obs.map((o, i) => {
          const inside = price >= o.bottom && price <= o.top;
          return (
            <div key={`o${i}`} className={`flex items-center gap-1.5 px-1.5 py-1 rounded text-[11px] ${inside ? 'bg-info/10' : 'bg-bg-elevated'}`}>
              <span className={`px-1 py-0.5 rounded text-[9px] font-bold border ${tagStyle}`}>OB</span>
              <span className="flex-1 font-mono tabular text-fg truncate">
                {fmtPrice(o.bottom)}→{fmtPrice(o.top)}
              </span>
              <span className="text-[9px] tabular text-fg-dim w-10 text-right flex-shrink-0">
                {inside ? <span className="text-info font-bold">IN</span> : `${o.impulsePct.toFixed(1)}%`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const StructureView = ({ signals, sweeps, price }: { signals: MSSignal[]; sweeps: Sweep[]; price: number }) => {
  if (signals.length === 0 && sweeps.length === 0) return <EmptyMsg text="No structure signals" />;
  const bull = [...signals.filter((m) => m.direction === 'bullish'), ...sweeps.filter((s) => s.type === 'bullish')];
  const bear = [...signals.filter((m) => m.direction === 'bearish'), ...sweeps.filter((s) => s.type === 'bearish')];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto scrollbar-thin pr-0.5">
      <StructureColumn
        title="Bullish Structure"
        tone="bullish"
        items={bull}
        price={price}
      />
      <StructureColumn
        title="Bearish Structure"
        tone="bearish"
        items={bear}
        price={price}
      />
    </div>
  );
};

const StructureColumn = ({
  title,
  tone,
  items,
  price,
}: {
  title: string;
  tone: 'bullish' | 'bearish';
  items: Array<MSSignal | Sweep>;
  price: number;
}) => {
  const isBull = tone === 'bullish';
  const headerDot = isBull ? 'bg-buy' : 'bg-sell';
  const headerBorder = isBull ? 'border-buy/20' : 'border-sell/20';
  const tagStyle = isBull
    ? 'bg-buy/15 text-buy border-buy/30'
    : 'bg-sell/15 text-sell border-sell/30';
  return (
    <div className={`rounded border ${headerBorder} bg-bg-elevated/40 overflow-hidden`}>
      <div className={`flex items-center justify-between px-2 py-1 border-b ${headerBorder} bg-bg-elevated`}>
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${headerDot}`} aria-hidden="true" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-fg">{title}</span>
        </div>
        <span className="text-[9px] text-fg-dim">{items.length} signal{items.length === 1 ? '' : 's'}</span>
      </div>
      <div className="p-1.5 space-y-1">
        {items.length === 0 && <div className="text-[10px] text-fg-dim text-center py-2">—</div>}
        {items.slice(0, 6).map((item, i) => {
          const isMSSignal = 'time' in item;
          const label = isMSSignal ? (item as MSSignal).type : 'SWEEP';
          const direction = isMSSignal ? (item as MSSignal).direction : (item as Sweep).type;
          const level = isMSSignal ? (item as MSSignal).price : (item as Sweep).level;
          const dist = ((price - level) / price) * 100;
          return (
            <div key={i} className="flex items-center gap-1.5 px-1.5 py-1 rounded bg-bg-elevated text-[11px]">
              <span className={`px-1 py-0.5 rounded text-[9px] font-bold border ${tagStyle}`}>{label}</span>
              <span className="text-fg-muted capitalize text-[10px]">{direction}</span>
              <span className="ml-auto font-mono tabular text-fg">{fmtPrice(level)}</span>
              <span className="text-[9px] text-fg-dim tabular w-12 text-right flex-shrink-0">
                {dist > 0 ? '+' : ''}{dist.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const SRView = ({ price, levels }: { price: number; levels: SRLevel[] }) => {
  if (levels.length === 0) return <EmptyMsg text="No support/resistance levels" />;
  // Include levels exactly at price in BOTH columns: a support level at the
  // current price is where price is resting, and a resistance at price is
  // the breakout threshold. Dropping them (strict < / >) silently hides
  // important confluence zones.
  const supports = levels.filter((l) => l.type === 'support' && l.price <= price).sort((a, b) => b.price - a.price).slice(0, 5);
  const resistances = levels.filter((l) => l.type === 'resistance' && l.price >= price).sort((a, b) => a.price - b.price).slice(0, 5);
  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <div className="text-2xs text-fg-dim uppercase tracking-wider font-bold mb-1.5 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-info" /> Supports
        </div>
        <div className="space-y-1">
          {supports.length === 0 && <div className="text-2xs text-fg-dim">—</div>}
          {supports.map((l, i) => (
            <div key={i} className="flex justify-between text-xs p-1.5 rounded bg-bg-elevated">
              <span className="font-mono tabular text-info">{fmtPrice(l.price)}</span>
              <span className="text-2xs text-fg-dim capitalize">{l.source}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="text-2xs text-fg-dim uppercase tracking-wider font-bold mb-1.5 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-accent" /> Resistances
        </div>
        <div className="space-y-1">
          {resistances.length === 0 && <div className="text-2xs text-fg-dim">—</div>}
          {resistances.map((l, i) => (
            <div key={i} className="flex justify-between text-xs p-1.5 rounded bg-bg-elevated">
              <span className="font-mono tabular text-accent">{fmtPrice(l.price)}</span>
              <span className="text-2xs text-fg-dim capitalize">{l.source}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
