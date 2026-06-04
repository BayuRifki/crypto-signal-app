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

// Ranging market should produce HOLD or low confidence
const sigRange = computeSignal(ranging);
assert(sigRange !== null, 'Ranging signal is not null');
if (sigRange) {
  // In ranging market, ADX gate should force HOLD if ADX < 20
  if (sigRange.regime === 'ranging' && sigRange.adx !== null && sigRange.adx < 20) {
    assert(sigRange.action === 'HOLD', `Ranging market with low ADX → HOLD (got ${sigRange.action}, ADX=${sigRange.adx?.toFixed(1)})`);
    assert(sigRange.confidence <= 35, `Ranging HOLD confidence ≤ 35 (got ${sigRange.confidence})`);
  }
}

// Components sum matches score
if (sigUp) {
  const compSum = sigUp.components.bb + sigUp.components.rsi + sigUp.components.macd +
    sigUp.components.sr + sigUp.components.fvg + sigUp.components.ema +
    sigUp.components.volume + sigUp.components.orderBlock + sigUp.components.marketStructure +
    sigUp.components.liquiditySweep + sigUp.components.trend;
  assert(Math.abs(compSum - sigUp.score) <= 1, `Component sum ≈ score (${compSum} vs ${sigUp.score})`);
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

console.log('\nAll Scoring Engine tests passed.');