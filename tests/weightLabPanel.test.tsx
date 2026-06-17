import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import WeightLabPanel from '../components/WeightLabPanel';
import { DEFAULT_WEIGHTS } from '../lib/signal';
import type { UseWeightLabResult } from '../lib/hooks/useWeightLab';
import { generateDemoCandles } from '../lib/demoData';

const assert = (cond: boolean, msg: string) => {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  console.log('OK:', msg);
};

const candles = generateDemoCandles('trending', 300, 'BTCUSDT');

const makeLab = (overrides: Partial<UseWeightLabResult> = {}): UseWeightLabResult => ({
  weights: { ...DEFAULT_WEIGHTS },
  baselineWeights: { ...DEFAULT_WEIGHTS },
  savedAt: null,
  isCustom: false,
  isOptimized: false,
  isRunning: false,
  progress: null,
  lastResult: null,
  error: null,
  setWeight: () => {},
  setAllWeights: () => {},
  resetToDefault: () => {},
  save: () => {},
  clear: () => {},
  optimize: () => {},
  applyResult: () => {},
  WEIGHT_LABELS: {
    bb: 'Bollinger',
    rsi: 'RSI',
    macd: 'MACD',
    sr: 'Support/Resistance',
    fvg: 'FVG',
    ema: 'EMA Cross',
    volume: 'Volume',
    orderBlock: 'Order Block',
    marketStructure: 'Market Structure',
    liquiditySweep: 'Liquidity Sweep',
    trend: 'Trend',
    divergence: 'Divergence',
  },
  ...overrides,
});

const render = (lab: UseWeightLabResult) =>
  renderToStaticMarkup(React.createElement(WeightLabPanel, { candles, lab }));

const testDefaultState = () => {
  const html = render(makeLab());
  assert(html.includes('Weight Lab'), 'panel renders heading');
  assert(html.includes('Run Genetic Optimize'), 'panel renders optimize CTA');
  assert(html.includes('Component Weights (12)'), 'panel renders weight section');
  assert(html.includes('DEFAULT'), 'panel renders default badge');
  assert(html.includes('value="12"'), 'bb slider input bound to current default weight');
};

const testCustomWeightBinding = () => {
  const customWeights = { ...DEFAULT_WEIGHTS, bb: 20 };
  const html = render(makeLab({ weights: customWeights, isCustom: true }));
  assert(html.includes('CUSTOM'), 'custom badge shown when weights differ');
  assert(html.includes('value="20"'), 'bb slider input value reflects current weight');
  assert(html.includes('20.0'), 'bb current weight text reflects current weight');
  assert(html.includes('+8.0 (+67%)'), 'bb delta text reflects current minus baseline');
  assert(html.includes('12</span><span class="text-2xs text-fg-dim">→</span><span class="text-xs font-bold tabular text-fg">20.0'), 'slider row renders baseline -> current mapping');
};

testDefaultState();
testCustomWeightBinding();

console.log('\nAll Weight Lab panel tests passed.');
