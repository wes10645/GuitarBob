# Real-time pitch detection prototype

Branch `realtime-pitch-prototype`, October 2026, after the hackathon. Built with Claude Code as a reference implementation; it is not part of the original hackathon submission.

It adds a second live pipeline next to the hackathon's `/ws/live` (YIN, 20 events/sec):

| | Hackathon `/ws/live` | Prototype `/ws/pitch` |
| --- | --- | --- |
| Algorithm | `librosa.yin` | McLeod Pitch Method: autocorrelation computed with FFTs (`backend/dsp/pitch.py`) |
| Sample rate / hop / window | device default / 1024 / 4096 | 48 kHz / 1024 (21.3 ms) / 2048 (42.7 ms) |
| Events per second | ≤ 20 (throttled to every 50 ms) | ~47 (one per hop, no throttle) |
| Fields | pitch, note, confidence, onset, energy | + MIDI number, cents, clarity, capture timestamp, detection time |
| Works without hardware | No | Yes: `source=sim` plays a simulated guitar |
| Tests | None | 23 (`backend/tests/test_pitch.py`) |

## How the detector works

1. **Autocorrelation via FFT.** Comparing a frame with delayed copies of itself shows how often it repeats. Done directly that is O(n²); by the Wiener–Khinchin theorem it equals the inverse FFT of the power spectrum, which is O(n log n). The frame is zero-padded to avoid wrap-around.
2. **Normalize (NSDF).** Divide by the frame's energy at each delay so values run from −1 to 1, whatever the volume.
3. **Pick the first strong peak.** Each positive region gives one peak; the first one at least 90% as high as the highest is the period. Taking the first, not the tallest, prevents octave errors on overtone-rich guitar notes.
4. **Parabolic interpolation** around that peak gives a sub-sample period, so pitch is accurate to a few cents.
5. **Silence gate and clarity check:** quiet frames (RMS < 0.005) and unclear ones (peak < 0.5) report no note instead of guessing.

## Measured results

Run on an Apple-silicon MacBook, simulated guitar, 10 seconds (`python bench/latency_bench.py 10 sim`):

| Metric | Result |
| --- | --- |
| Updates per second | 46.9 |
| Latency, median / p95 / max | 1.04 / 1.51 / 1.99 ms |
| Detection time per frame, mean / max | 0.53 / 1.23 ms |

Test results (`python -m pytest tests`): every guitar note from low E (82 Hz) to the 24th fret of high E (1,319 Hz) is detected within 5 cents as a pure tone, with no octave errors on tones with 6 harmonics plus noise, including a weak fundamental. Detection takes under 2 ms per frame.

**What "latency" covers:** captured block → detection → JSON → WebSocket → client. It does not include waiting for a block to fill (up to 21.3 ms), the audio interface's own buffer (a few ms at low-latency settings), or one screen refresh in the browser (≤ 16.7 ms). An honest input-to-screen estimate is therefore roughly 25–45 ms. The `device` source has not been benchmarked on a real Scarlett yet; do that before quoting hardware numbers.

## Try it

```bash
# backend
cd backend && source venv/bin/activate
uvicorn main:app --host 127.0.0.1 --port 8000
python -m pytest tests                 # detector tests
python bench/latency_bench.py 10 sim   # stream benchmark

# frontend, from the repo root
npm run dev   # then open http://localhost:5173/pitch-lab
```

The Pitch Lab page shows the note, a cents meter, a 4-second pitch trace, and live updates/sec and latency measured in the browser.
