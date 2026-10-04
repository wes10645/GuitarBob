import { useCallback, useEffect, useRef, useState } from 'react';

const WS_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/^http/, 'ws');
const TRACE_SECONDS = 4; // how much pitch history the trace shows
const STATS_EVERY_MS = 500;

function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

/**
 * Connects to /ws/pitch and measures the stream as it arrives:
 *   updatesPerSec  events received in the last second
 *   latencyP50/P95 browser receive time - when the audio block was captured (ms)
 */
export function usePitchStream() {
  const [latest, setLatest] = useState(null);
  const [trace, setTrace] = useState([]); // [{ t, midi }] for the last few seconds
  const [stats, setStats] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);
  const arrivalsRef = useRef([]); // receive times (ms) for counting updates per second
  const latenciesRef = useRef([]); // last 200 latencies (ms)
  const detectionRef = useRef([]); // last 200 server detection times (ms)

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setIsConnected(false);
  }, []);

  const connect = useCallback((source = 'sim') => {
    disconnect();
    setError(null);
    setTrace([]);
    arrivalsRef.current = [];
    latenciesRef.current = [];
    detectionRef.current = [];

    const ws = new WebSocket(`${WS_URL}/ws/pitch?source=${source}`);
    wsRef.current = ws;
    ws.onopen = () => setIsConnected(true);
    ws.onerror = () => setError('Connection error – is the backend running on port 8000?');
    ws.onclose = () => setIsConnected(false);
    ws.onmessage = (e) => {
      const now = Date.now();
      const event = JSON.parse(e.data);
      if (event.error) {
        setError(event.error);
        return;
      }
      arrivalsRef.current.push(now);
      latenciesRef.current = [...latenciesRef.current.slice(-199), now - event.captured_at * 1000];
      detectionRef.current = [...detectionRef.current.slice(-199), event.processing_ms];
      setLatest(event);
      setTrace((prev) => [...prev.filter((p) => now - p.t < TRACE_SECONDS * 1000), { t: now, midi: event.midi, cents: event.cents }]);
    };
  }, [disconnect]);

  // Recompute the numbers twice a second instead of on every event
  useEffect(() => {
    if (!isConnected) return undefined;
    const id = setInterval(() => {
      const now = Date.now();
      arrivalsRef.current = arrivalsRef.current.filter((t) => now - t < 1000);
      const lat = [...latenciesRef.current].sort((a, b) => a - b);
      const det = detectionRef.current;
      setStats({
        updatesPerSec: arrivalsRef.current.length,
        latencyP50: percentile(lat, 50),
        latencyP95: percentile(lat, 95),
        detectionMs: det.length ? det.reduce((a, b) => a + b, 0) / det.length : null,
      });
    }, STATS_EVERY_MS);
    return () => clearInterval(id);
  }, [isConnected]);

  useEffect(() => disconnect, [disconnect]); // close the socket when leaving the page

  return { latest, trace, stats, isConnected, error, connect, disconnect };
}
