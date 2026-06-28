import type { Signal } from './signal';

export type SignalHistoryEntry = {
  ts: number;
  symbol: string;
  interval: string;
  action: Signal['action'];
  score: number;
  confidence: number;
  regime: Signal['regime'];
  regimeBias: Signal['regimeBias'];
  price: number;
  sl: number;
  tp: number;
  rr: number;
  slSource: Signal['risk']['slSource'];
  tpSource: Signal['risk']['tpSource'];
  reasons: string[];
};

const STORAGE_KEY = 'cs:signalHistory';
const MAX_ENTRIES = 200;

export const logSignal = (symbol: string, interval: string, sig: Signal): void => {
  try {
    const arr: SignalHistoryEntry[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const entry: SignalHistoryEntry = {
      ts: Date.now(),
      symbol,
      interval,
      action: sig.action,
      score: sig.score,
      confidence: sig.confidence,
      regime: sig.regime,
      regimeBias: sig.regimeBias,
      price: sig.price,
      sl: sig.risk.stopLoss,
      tp: sig.risk.takeProfit,
      rr: sig.risk.rr,
      slSource: sig.risk.slSource,
      tpSource: sig.risk.tpSource,
      reasons: sig.reasons,
    };
  for (const e of arr) {
    if (e.symbol !== entry.symbol || e.interval !== entry.interval) continue;
    if (
      e.action === entry.action &&
      Math.abs(e.score - entry.score) < 3 &&
      Math.abs(e.confidence - entry.confidence) < 5
    ) {
      return;
    }
    break;
  }
    arr.unshift(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr.slice(0, MAX_ENTRIES)));
  } catch {}
};

export const getSignalHistory = (): SignalHistoryEntry[] => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
};

export const clearSignalHistory = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
};