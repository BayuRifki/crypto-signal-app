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
  return (
    <div className="space-y-1.5 max-h-64 overflow-y-auto scrollbar-thin">
      {activeFVG.slice(-6).reverse().map((f, i) => {
        const inside = price >= f.bottom && price <= f.top;
        return (
          <div key={`f${i}`} className={`flex items-center gap-2 p-2 rounded text-xs ${inside ? 'bg-info/10 ring-1 ring-info/40' : 'bg-bg-elevated'}`}>
            <span className={`px-1.5 py-0.5 rounded text-2xs font-bold ${f.type === 'bullish' ? 'bg-accent/20 text-accent' : 'bg-warn/20 text-warn'}`}>
              FVG
            </span>
            <div className="flex-1 font-mono tabular text-fg">
              {fmtPrice(f.bottom)} → {fmtPrice(f.top)}
            </div>
            <div className="text-2xs text-fg-dim tabular w-14 text-right">
              {inside ? <span className="text-info font-bold">INSIDE</span> : `${(((price - f.midpoint) / price) * 100).toFixed(2)}%`}
            </div>
          </div>
        );
      })}
      {obs.slice(-6).reverse().map((o, i) => {
        const inside = price >= o.bottom && price <= o.top;
        return (
          <div key={`o${i}`} className={`flex items-center gap-2 p-2 rounded text-xs ${inside ? 'bg-info/10 ring-1 ring-info/40' : 'bg-bg-elevated'}`}>
            <span className={`px-1.5 py-0.5 rounded text-2xs font-bold ${o.type === 'bullish' ? 'bg-accent/20 text-accent' : 'bg-warn/20 text-warn'}`}>
              OB
            </span>
            <div className="flex-1 font-mono tabular text-fg">
              {fmtPrice(o.bottom)} → {fmtPrice(o.top)}
            </div>
            <div className="text-2xs text-fg-dim tabular w-14 text-right">
              {inside ? <span className="text-info font-bold">INSIDE</span> : `Imp ${o.impulsePct.toFixed(1)}%`}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const StructureView = ({ signals, sweeps, price }: { signals: MSSignal[]; sweeps: Sweep[]; price: number }) => {
  if (signals.length === 0 && sweeps.length === 0) return <EmptyMsg text="No structure signals" />;
  return (
    <div className="space-y-1.5 max-h-64 overflow-y-auto scrollbar-thin">
      {signals.slice(-8).reverse().map((m, i) => (
        <div key={`m${i}`} className="flex items-center gap-2 p-2 rounded bg-bg-elevated text-xs">
          <span className={`px-1.5 py-0.5 rounded text-2xs font-bold ${m.direction === 'bullish' ? 'bg-accent/20 text-accent' : 'bg-warn/20 text-warn'}`}>
            {m.type}
          </span>
          <span className="text-fg-muted capitalize">{m.direction}</span>
          <span className="ml-auto font-mono tabular text-fg">{fmtPrice(m.price)}</span>
        </div>
      ))}
      {sweeps.slice(-6).reverse().map((s, i) => {
        const dist = ((price - s.level) / price) * 100;
        return (
          <div key={`s${i}`} className="flex items-center gap-2 p-2 rounded bg-bg-elevated text-xs">
            <span className={`px-1.5 py-0.5 rounded text-2xs font-bold ${s.type === 'bullish' ? 'bg-accent/20 text-accent' : 'bg-warn/20 text-warn'}`}>
              SWEEP
            </span>
            <span className="text-fg-muted capitalize">{s.type}</span>
            <span className="ml-auto font-mono tabular text-fg">{fmtPrice(s.level)}</span>
            <span className="text-2xs text-fg-dim tabular w-12 text-right">{dist > 0 ? '+' : ''}{dist.toFixed(2)}%</span>
          </div>
        );
      })}
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
