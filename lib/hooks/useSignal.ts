'use client';
import { useMemo, useEffect, useRef } from 'react';
import { computeSignal, type Signal } from '../signal';
import { logSignal } from '../signalHistory';
import type { Candle } from '../utils';

export const useSignal = (candles: Candle[], symbol?: string, interval?: string): Signal | null => {
  const sig = useMemo(() => computeSignal(candles), [candles]);
  const prevSigRef = useRef<Signal | null>(null);

  useEffect(() => {
    if (sig && symbol && interval) {
      if (!prevSigRef.current || prevSigRef.current.action !== sig.action || prevSigRef.current.score !== sig.score) {
        logSignal(symbol, interval, sig);
      }
      prevSigRef.current = sig;
    }
  }, [sig, symbol, interval]);

  return sig;
};