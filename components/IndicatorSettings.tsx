'use client';
import Toggle from './Toggle';
import { Icon } from './Icon';

type Props = {
  showBB: boolean; setShowBB: (v: boolean) => void;
  showEMA: boolean; setShowEMA: (v: boolean) => void;
  showFVG: boolean; setShowFVG: (v: boolean) => void;
  showOB: boolean; setShowOB: (v: boolean) => void;
  showSR: boolean; setShowSR: (v: boolean) => void;
  showMS: boolean; setShowMS: (v: boolean) => void;
};

export default function IndicatorSettings(p: Props) {
  return (
    <div className="space-y-1">
      <div className="text-2xs text-fg-dim uppercase tracking-wider font-bold mb-2 flex items-center gap-1.5">
        <Icon.Layers size={12} />
        Chart Overlays
      </div>
      <Toggle label="Bollinger Bands" description="Volatility envelope" icon={<span className="text-[10px] font-bold text-info">BB</span>} checked={p.showBB} onChange={p.setShowBB} />
      <Toggle label="EMA 50 / 200" description="Trend filter" icon={<span className="text-[10px] font-bold text-warn">EM</span>} checked={p.showEMA} onChange={p.setShowEMA} />
      <Toggle label="Fair Value Gaps" description="Smart money imbalance" icon={<span className="text-[10px] font-bold text-buy">FV</span>} checked={p.showFVG} onChange={p.setShowFVG} />
      <Toggle label="Order Blocks" description="Last opposite candle" icon={<span className="text-[10px] font-bold text-accent">OB</span>} checked={p.showOB} onChange={p.setShowOB} />
      <Toggle label="Support / Resistance" description="Pivot + swing levels" icon={<span className="text-[10px] font-bold text-fg-muted">S/R</span>} checked={p.showSR} onChange={p.setShowSR} />
      <Toggle label="Market Structure" description="BOS / CHoCH markers" icon={<span className="text-[10px] font-bold text-sell">MS</span>} checked={p.showMS} onChange={p.setShowMS} />
    </div>
  );
}
