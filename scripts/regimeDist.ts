import { generateDemoCandles } from '../lib/demoData';
import { computeSignal } from '../lib/signal';

const presets: Array<{ name: 'ranging' | 'trending' | 'bear-trend' | 'volatile'; sym: string }> = [
  { name: 'ranging', sym: 'RANGE1' },
  { name: 'trending', sym: 'TREND1' },
  { name: 'bear-trend', sym: 'BEAR1' },
  { name: 'volatile', sym: 'VOL1' },
];
for (const p of presets) {
  const c = generateDemoCandles(p.name, 400, p.sym);
  let r = 0, t = 0, x = 0, sw = 0;
  for (let i = 210; i < c.length; i++) {
    const slice = c.slice(0, i + 1);
    const sig = computeSignal(slice);
    if (!sig) continue;
    if (sig.regime === 'ranging') r++;
    else if (sig.regime === 'trending') t++;
    else x++;
    if (sig.regime === 'ranging' && (sig as any).regime) sw++;
  }
  console.log(p.name.padEnd(10), 'ranging:', r, 'trending:', t, 'transitional:', x, 'sidewaysFlg:', sw);
}
