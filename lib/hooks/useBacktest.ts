'use client';
import { useMemo } from 'react';
import { runBacktest, type BacktestOptions, type BacktestResult } from '../backtest';
import type { Candle } from '../utils';

export const useBacktest = (candles: Candle[], options: BacktestOptions = {}): BacktestResult | null => {
  return useMemo(() => runBacktest(candles, options), [candles, options]);
};