'use client';
import { useEffect, useRef, useState } from 'react';
import type { ExchangeId, Interval, Ticker24h } from '../exchanges/types';
import type { Candle } from '../utils';

type Props = {
  exchange: ExchangeId;
  symbol: string;
  interval: Interval;
  isDemo?: boolean;
  onCandleUpdate: (candle: Candle) => void;
  onTickerUpdate: (ticker: Ticker24h) => void;
};

export function useWebSocketStream({
  exchange,
  symbol,
  interval,
  isDemo = false,
  onCandleUpdate,
  onTickerUpdate,
}: Props) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Keep callback refs fresh so we don't trigger effect re-binds on every callback change
  const onCandleRef = useRef(onCandleUpdate);
  const onTickerRef = useRef(onTickerUpdate);
  useEffect(() => {
    onCandleRef.current = onCandleUpdate;
    onTickerRef.current = onTickerUpdate;
  });

  useEffect(() => {
    if (isDemo) {
      setIsConnected(false);
      return;
    }

    let active = true;
    let socket: WebSocket | null = null;
    let pingInterval: ReturnType<typeof setInterval> | null = null;

    const connect = () => {
      if (!active) return;

      const sym = symbol.toUpperCase();

      try {
        if (exchange === 'binance') {
          // Binance expects lowercase symbol for WS streams
          const cleanSym = sym.toLowerCase();
          const url = `wss://stream.binance.com:9443/ws/${cleanSym}@kline_${interval}/${cleanSym}@ticker`;
          socket = new WebSocket(url);

          socket.onopen = () => {
            if (active) setIsConnected(true);
          };

          socket.onmessage = (event) => {
            if (!active) return;
            const data = JSON.parse(event.data);

            if (data.e === 'kline') {
              const k = data.k;
              onCandleRef.current({
                time: Math.floor(k.t / 1000),
                open: Number(k.o),
                high: Number(k.h),
                low: Number(k.l),
                close: Number(k.c),
                volume: Number(k.v),
              });
            } else if (data.e === '24hrTicker') {
              onTickerRef.current({
                symbol: sym,
                lastPrice: Number(data.c),
                priceChangePercent: Number(data.P),
                quoteVolume: Number(data.q),
              });
            }
          };
        } else if (exchange === 'bybit') {
          const url = 'wss://stream.bybit.com/v5/public/spot';
          socket = new WebSocket(url);

          // Bybit interval codes
          const bbInterval = {
            '1m': '1',
            '5m': '5',
            '15m': '15',
            '1h': '60',
            '4h': '240',
            '1d': 'D',
            '1w': 'W',
          }[interval] || '1';

          socket.onopen = () => {
            if (!active) return;
            setIsConnected(true);

            // Subscribe to channels
            socket?.send(JSON.stringify({
              op: 'subscribe',
              args: [`kline.${bbInterval}.${sym}`, `tickers.${sym}`],
            }));

            // Bybit ping keep-alive
            pingInterval = setInterval(() => {
              if (socket?.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ op: 'ping' }));
              }
            }, 20_000);
          };

          socket.onmessage = (event) => {
            if (!active) return;
            const data = JSON.parse(event.data);

            if (data.topic?.startsWith('kline.')) {
              const k = data.data?.[0];
              if (k) {
                onCandleRef.current({
                  time: Math.floor(Number(k.start) / 1000),
                  open: Number(k.open),
                  high: Number(k.high),
                  low: Number(k.low),
                  close: Number(k.close),
                  volume: Number(k.volume),
                });
              }
            } else if (data.topic?.startsWith('tickers.')) {
              const t = data.data;
              if (t) {
                // Bybit ticker updates are partial or full
                onTickerRef.current({
                  symbol: sym,
                  lastPrice: Number(t.lastPrice),
                  priceChangePercent: Number(t.price24hPcnt) * 100,
                  quoteVolume: Number(t.turnover24h),
                });
              }
            }
          };
        } else if (exchange === 'okx') {
          const url = 'wss://ws.okx.com:8443/ws/v5/public';
          socket = new WebSocket(url);

          // OKX interval codes
          const okxInterval = {
            '1m': '1m',
            '5m': '5m',
            '15m': '15m',
            '1h': '1H',
            '4h': '4H',
            '1d': '1D',
            '1w': '1W',
          }[interval] || '1m';

          // OKX format for symbol: BTC-USDT
          const okxSym = sym.endsWith('USDT') ? `${sym.slice(0, -4)}-USDT` : sym;

          socket.onopen = () => {
            if (!active) return;
            setIsConnected(true);

            // Subscribe to channels
            socket?.send(JSON.stringify({
              op: 'subscribe',
              args: [
                { channel: `candle${okxInterval}`, instId: okxSym },
                { channel: 'tickers', instId: okxSym },
              ],
            }));

            // OKX ping keepalive
            pingInterval = setInterval(() => {
              if (socket?.readyState === WebSocket.OPEN) {
                socket.send('ping');
              }
            }, 25_000);
          };

          socket.onmessage = (event) => {
            if (!active) return;
            // OKX ping response is text "pong", not JSON
            if (event.data === 'pong') return;
            const data = JSON.parse(event.data);

            if (data.arg?.channel?.startsWith('candle')) {
              const k = data.data?.[0];
              if (k) {
                onCandleRef.current({
                  time: Math.floor(Number(k[0]) / 1000),
                  open: Number(k[1]),
                  high: Number(k[2]),
                  low: Number(k[3]),
                  close: Number(k[4]),
                  volume: Number(k[5]),
                });
              }
            } else if (data.arg?.channel === 'tickers') {
              const t = data.data?.[0];
              if (t) {
                const lastPrice = Number(t.last);
                const open24h = Number(t.open24h);
                const changePct = open24h > 0 ? ((lastPrice - open24h) / open24h) * 100 : 0;
                onTickerRef.current({
                  symbol: sym,
                  lastPrice,
                  priceChangePercent: changePct,
                  quoteVolume: Number(t.volCcy24h),
                });
              }
            }
          };
        }

        if (socket) {
          wsRef.current = socket;
          socket.onclose = () => {
            if (active) {
              setIsConnected(false);
              // Retry connection after 5 seconds
              setTimeout(connect, 5000);
            }
          };
          socket.onerror = () => {
            socket?.close();
          };
        }
      } catch {
        // silently fallback
      }
    };

    connect();

    return () => {
      active = false;
      if (pingInterval) clearInterval(pingInterval);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsConnected(false);
    };
  }, [exchange, symbol, interval, isDemo]);

  return { isConnected };
}
