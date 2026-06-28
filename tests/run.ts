import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { test } from 'node:test';

/**
 * Central test runner for `node --test`.
 * Each test module is executed in a separate `tsx` process so that global stubs
 * (e.g. `fetch`) and async top-level runs cannot leak between test files.
 */
const __dirname = dirname(fileURLToPath(import.meta.url));
const tsxBin = process.platform === 'win32'
  ? join(__dirname, '..', 'node_modules', '.bin', 'tsx.cmd')
  : join(__dirname, '..', 'node_modules', '.bin', 'tsx');
const testFiles = [
  'adx.test.ts',
  'atr.test.ts',
  'a11yInteraction.test.ts',
  'apiContract.test.ts',
  'backtest.test.ts',
  'bollinger.test.ts',
  'chartViewport.test.ts',
  'demoData.test.ts',
  'divergence.test.ts',
  'ema.test.ts',
  'exchanges.test.ts',
  'fallback.test.ts',
  'fvg.test.ts',
  'gracefulDegradation.test.ts',
  'liquiditySweep.test.ts',
  'macd.test.ts',
  'marketStructure.test.ts',
  'multiTimeframeRowDeps.test.ts',
  'orderBlock.test.ts',
  'pairSelectorNav.test.ts',
  'popularPairs.test.ts',
  'priceChartViewport.test.ts',
  'riskMathRegression.test.ts',
  'rsi.test.ts',
  'safeIndicatorNull.test.ts',
  'scoring.test.ts',
  'signalHistoryDedup.test.ts',
  'supportResistance.test.ts',
  'volume.test.ts',
  'volumeProfile.test.ts',
  'webWorker.test.ts',
  'weightOptimizer.test.ts',
  'weightLabHook.test.ts',
  'weightLabPanel.test.tsx',
];

for (const file of testFiles) {
  test(file, () => {
    const result = spawnSync(tsxBin, [file], {
      cwd: __dirname,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    if (result.status !== 0) {
      throw new Error(`${file} exited with code ${result.status ?? 'signal'}`);
    }
  });
}
