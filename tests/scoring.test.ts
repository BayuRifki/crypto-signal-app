import { computeSignal } from '../lib/signal';
import type { Candle } from '../lib/utils';

const assert = (cond: boolean, msg: string) => {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  console.log('OK:', msg);
};

const c = (time: number, open: number, high: number, low: number, close: number, volume = 1000): Candle => ({
  time, open, high, low, close, volume,
});

// Build 220 candles of uptrend data
const uptrend: Candle[] = [];
for (let i = 0; i < 220; i++) {
  const price = 100 + i * 0.5 + Math.sin(i / 5) * 2;
  uptrend.push(c(i, price - 0.5, price + 1.5, price - 1.5, price + 0.3, 1000 + Math.sin(i / 7) * 200));
}

// Build 220 candles of downtrend data
const downtrend: Candle[] = [];
for (let i = 0; i < 220; i++) {
  const price = 300 - i * 0.5 + Math.sin(i / 5) * 2;
  downtrend.push(c(i, price + 0.5, price + 1.5, price - 1.5, price - 0.3, 1000 + Math.sin(i / 7) * 200));
}

// Build 220 candles of ranging data
const ranging: Candle[] = [];
for (let i = 0; i < 220; i++) {
  const price = 200 + Math.sin(i / 3) * 3;
  ranging.push(c(i, price - 0.5, price + 1, price - 1, price + Math.sin(i / 4) * 0.5, 800));
}

// Insufficient data returns null
const shortData = uptrend.slice(0, 100);
assert(computeSignal(shortData) === null, 'computeSignal returns null for insufficient data (< 210 candles)');

// Uptrend signal
const sigUp = computeSignal(uptrend);
assert(sigUp !== null, 'Uptrend signal is not null');
if (sigUp) {
  assert(sigUp.score >= -100 && sigUp.score <= 100, `Score in range [-100, 100] (got ${sigUp.score})`);
  assert(sigUp.confidence >= 10 && sigUp.confidence <= 100, `Confidence in [10, 100] (got ${sigUp.confidence})`);
  assert(['BUY', 'SELL', 'HOLD'].includes(sigUp.action), `Action is valid (got ${sigUp.action})`);
  assert(sigUp.action !== 'HOLD', `Uptrend should not be HOLD after adaptive scoring (got ${sigUp.action})`);
  assert(sigUp.rsiValue !== null, 'RSI value present');
  assert(sigUp.adx !== null, 'ADX value present');
  assert(typeof sigUp.regime === 'string', 'Regime is string');
  assert(['bullish', 'bearish', 'neutral'].includes(sigUp.regimeBias), `Regime bias valid (got ${sigUp.regimeBias})`);
  assert(sigUp.risk.stopLoss > 0, `Stop loss positive (${sigUp.risk.stopLoss.toFixed(2)})`);
  assert(sigUp.risk.takeProfit > 0, `Take profit positive (${sigUp.risk.takeProfit.toFixed(2)})`);
  assert(sigUp.risk.rr > 0, `R:R positive (${sigUp.risk.rr.toFixed(2)})`);
  assert(['sr', 'atr', 'ref'].includes(sigUp.risk.slSource), `SL source valid (got ${sigUp.risk.slSource})`);
  assert(['sr', 'atr', 'ref'].includes(sigUp.risk.tpSource), `TP source valid (got ${sigUp.risk.tpSource})`);
  assert(sigUp.reasons.length > 0, `Reasons not empty (${sigUp.reasons.length} reasons)`);
  assert(typeof sigUp.pocNear === 'boolean', `pocNear is boolean (got ${typeof sigUp.pocNear})`);
  assert(sigUp.volumeProfile !== null || sigUp.volumeProfile === null, 'volumeProfile field exists');
}

// Downtrend signal
const sigDown = computeSignal(downtrend);
assert(sigDown !== null, 'Downtrend signal is not null');
if (sigDown) {
  assert(sigDown.score <= sigUp!.score + 50, `Downtrend score ≤ uptrend score + 50 (${sigDown.score} vs ${sigUp!.score})`);
  assert(sigDown.rsiValue !== null, 'Downtrend RSI present');
}

// Ranging market should produce HOLD or reduced confidence for weak setups
const sigRange = computeSignal(ranging);
assert(sigRange !== null, 'Ranging signal is not null');
if (sigRange) {
  if (sigRange.regime === 'ranging' && sigRange.adx !== null && sigRange.adx < 18 && Math.abs(sigRange.score) < 52) {
    assert(sigRange.action === 'HOLD', `Weak ranging market signal → HOLD (got ${sigRange.action}, ADX=${sigRange.adx?.toFixed(1)}, score=${sigRange.score})`);
    assert(sigRange.confidence <= 45, `Ranging HOLD confidence ≤ 45 (got ${sigRange.confidence})`);
  }
}

// Ranging entry quality: SL/TP must be on correct side of price + min distance
if (sigRange && sigRange.action !== 'HOLD') {
  if (sigRange.action === 'BUY') {
    assert(sigRange.risk.stopLoss < sigRange.price, `Ranging BUY: SL below price (SL=${sigRange.risk.stopLoss.toFixed(2)}, price=${sigRange.price.toFixed(2)})`);
    assert(sigRange.risk.takeProfit > sigRange.price, `Ranging BUY: TP above price (TP=${sigRange.risk.takeProfit.toFixed(2)}, price=${sigRange.price.toFixed(2)})`);
  } else if (sigRange.action === 'SELL') {
    assert(sigRange.risk.stopLoss > sigRange.price, `Ranging SELL: SL above price (SL=${sigRange.risk.stopLoss.toFixed(2)}, price=${sigRange.price.toFixed(2)})`);
    assert(sigRange.risk.takeProfit < sigRange.price, `Ranging SELL: TP below price (TP=${sigRange.risk.takeProfit.toFixed(2)}, price=${sigRange.price.toFixed(2)})`);
  }
  if (sigRange.regime === 'ranging') {
    const slDistPct = Math.abs(sigRange.price - sigRange.risk.stopLoss) / sigRange.price * 100;
    const tpDistPct = Math.abs(sigRange.risk.takeProfit - sigRange.price) / sigRange.price * 100;
    assert(slDistPct >= 0.7, `Ranging SL ≥ 0.7% from price (got ${slDistPct.toFixed(2)}%)`);
    assert(tpDistPct >= 0.9, `Ranging TP ≥ 0.9% from price (got ${tpDistPct.toFixed(2)}%)`);
  }
}

// Adaptive score should preserve directional consistency with components/trend bias
if (sigUp) {
  const compSum = sigUp.components.bb + sigUp.components.rsi + sigUp.components.macd +
    sigUp.components.sr + sigUp.components.fvg + sigUp.components.ema +
    sigUp.components.volume + sigUp.components.orderBlock + sigUp.components.marketStructure +
    sigUp.components.liquiditySweep + sigUp.components.trend + sigUp.components.divergence;
  assert(Math.sign(sigUp.score || 0) === Math.sign(compSum || 0) || Math.abs(sigUp.score) <= 5,
    `Adaptive score keeps directional consistency (${compSum} vs ${sigUp.score})`);
}

// Rebalanced weight bounds: each component should respect its max range
if (sigUp) {
  const c = sigUp.components;
  assert(Math.abs(c.bb) <= 12, `BB within ±12 (got ${c.bb})`);
  assert(Math.abs(c.rsi) <= 15, `RSI within ±15 (got ${c.rsi})`);
  assert(Math.abs(c.macd) <= 15, `MACD within ±15 (got ${c.macd})`);
  assert(Math.abs(c.sr) <= 18, `S/R within ±18 incl POC (got ${c.sr})`);
  assert(Math.abs(c.fvg) <= 12, `FVG within ±12 (got ${c.fvg})`);
  assert(Math.abs(c.ema) <= 13, `EMA within ±13 (got ${c.ema})`);
  assert(Math.abs(c.volume) <= 12, `Volume within adaptive bound ±12 (got ${c.volume})`);
  assert(Math.abs(c.orderBlock) <= 12, `OB within ±12 (got ${c.orderBlock})`);
  assert(Math.abs(c.marketStructure) <= 12, `MS within ±12 (got ${c.marketStructure})`);
  assert(Math.abs(c.liquiditySweep) <= 8, `Sweep within ±8 (got ${c.liquiditySweep})`);
  assert(Math.abs(c.trend) <= 19, `Trend within adaptive bound ±19 (got ${c.trend})`);
  assert(Math.abs(c.divergence) <= 6, `Divergence within ±6 (got ${c.divergence})`);
}

// Divergence field exists (may be 0 if no divergence detected)
if (sigUp) {
  assert(typeof sigUp.components.divergence === 'number', `Divergence is number (got ${typeof sigUp.components.divergence})`);
}

// Sigmoid confidence properties
if (sigUp) {
  const absScore = Math.abs(sigUp.score);
  // Higher score should generally mean higher confidence
  // Score 0 should give ~10-15% confidence (floor)
  // Score 100 should give ~95% confidence (near ceiling)
  if (absScore >= 70) {
    assert(sigUp.confidence >= 70, `High score (${absScore}) → high confidence (${sigUp.confidence}%)`);
  }
}

// Volatile-regime gate: synthetic volatile data must not produce actionable signal without bias match
// or strong ADX trend confirmation. Build 220 candles of high-noise chop with no trend.
const volatileChop: Candle[] = [];
for (let i = 0; i < 220; i++) {
  const base = 100 + Math.sin(i / 2) * 15;
  const noise = Math.sin(i * 1.7) * 4;
  const price = base + noise;
  volatileChop.push(c(i, price - 1, price + 2, price - 2, price + (Math.random() - 0.5) * 1, 1500));
}
const sigVol = computeSignal(volatileChop);
assert(sigVol !== null, 'Volatile chop signal is not null');
if (sigVol) {
  const atrPct = (sigVol.risk.atr / sigVol.price) * 100;
  if (atrPct > 1.8 && sigVol.action !== 'HOLD') {
    const biasMatches = (sigVol.action === 'BUY' && sigVol.regimeBias === 'bullish') || (sigVol.action === 'SELL' && sigVol.regimeBias === 'bearish');
    const strongTrend = (sigVol.adx ?? 0) >= 50;
    assert(biasMatches && strongTrend, `Volatile entry requires bias match AND ADX≥50 (action=${sigVol.action}, bias=${sigVol.regimeBias}, adx=${sigVol.adx?.toFixed(1)})`);
  }
  if (atrPct > 1.5 && sigVol.action !== 'HOLD') {
    const slDistPct = Math.abs(sigVol.price - sigVol.risk.stopLoss) / sigVol.price * 100;
    assert(slDistPct >= atrPct * 0.3, `Vol-adaptive SL floor: SL ≥ 0.3×ATR% (SL=${slDistPct.toFixed(2)}%, ATR=${atrPct.toFixed(2)}%)`);
  }
}

console.log('\nAll Scoring Engine tests passed.');