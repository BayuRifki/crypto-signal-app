import { generateDemoCandles } from '../lib/demoData';
import { computeSignal } from '../lib/signal';

const c = generateDemoCandles('ranging', 400, 'RANGE1');
let buys = 0, sells = 0, holds = 0;
let buysInside = 0, sellsInside = 0;
const samples: any[] = [];
for (let i = 210; i < c.length; i++) {
  const slice = c.slice(0, i + 1);
  const sig = computeSignal(slice);
  if (!sig) continue;
  if (sig.action === 'BUY') buys++;
  else if (sig.action === 'SELL') sells++;
  else holds++;
  if (sig.regime === 'ranging' && sig.action !== 'HOLD') {
    if (sig.action === 'BUY') buysInside++;
    else sellsInside++;
    if (samples.length < 8) {
      samples.push({
        i, action: sig.action, score: sig.score, conf: sig.confidence,
        regime: sig.regime, bias: sig.regimeBias,
        rsi: sig.rsiValue?.toFixed(1), bbPos: sig.bbPos?.toFixed(0),
        rvol: sig.rvol?.toFixed(2), adx: sig.adx?.toFixed(1),
        cvdSlope: sig.cvdSlope?.toFixed(1),
      });
    }
  }
}
console.log('BUY', buys, 'SELL', sells, 'HOLD', holds);
console.log('Inside ranging BUY:', buysInside, 'SELL:', sellsInside);
console.log('Samples:', JSON.stringify(samples, null, 2));
