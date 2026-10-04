"""
Measures the /ws/pitch stream end to end.

  1. Start the backend:  uvicorn main:app --host 127.0.0.1 --port 8000
  2. Run:                python bench/latency_bench.py [seconds] [sim|device]

Latency = time the event is received here - time its newest audio block arrived (captured_at).
It covers detection + JSON + WebSocket. It does NOT include the audio driver's own buffering
or the browser's screen refresh (~16 ms at 60 Hz); add those when quoting input-to-screen time.
"""
import asyncio
import json
import statistics
import sys
import time

import websockets


async def main(seconds: float, source: str):
    url = f"ws://127.0.0.1:8000/ws/pitch?source={source}"
    latencies, processing, notes = [], [], 0
    async with websockets.connect(url) as ws:
        first = await ws.recv()  # don't count connection setup
        start = time.time()
        count = 0
        while time.time() - start < seconds:
            event = json.loads(await ws.recv())
            received = time.time()
            count += 1
            latencies.append((received - event["captured_at"]) * 1000)
            processing.append(event["processing_ms"])
            notes += event["note"] is not None
        elapsed = time.time() - start

    q = statistics.quantiles(latencies, n=100)
    print(f"source={source}  events={count}  over {elapsed:.1f}s")
    print(f"updates/sec:         {count / elapsed:.1f}")
    print(f"latency ms:          p50 {q[49]:.2f}   p95 {q[94]:.2f}   max {max(latencies):.2f}")
    print(f"detection ms:        mean {statistics.mean(processing):.3f}   max {max(processing):.3f}")
    print(f"events with a note:  {notes / count:.0%}")


if __name__ == "__main__":
    asyncio.run(main(float(sys.argv[1]) if len(sys.argv) > 1 else 10, sys.argv[2] if len(sys.argv) > 2 else "sim"))
