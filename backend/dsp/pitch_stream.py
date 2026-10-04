"""
Streams pitch events from an audio source, one event per hop.

Defaults at 48 kHz:
  hop    = 1024 samples = 21.3 ms  -> about 47 events per second
  window = 2048 samples = 42.7 ms  -> enough history to see 2+ cycles of the low E string (82 Hz)

Every event carries `captured_at`: the wall-clock time its newest audio arrived.
The browser subtracts that from its own clock on receipt to measure latency.
"""
from __future__ import annotations

import asyncio
import math
import time
from typing import AsyncIterator

import numpy as np

from .pitch import detect_pitch, rms

SAMPLE_RATE = 48_000
HOP = 1024
WINDOW = 2048
SILENCE_RMS = 0.005  # below this, report "no note" instead of guessing from noise
ONSET_RATIO = 1.8  # loudness jump that counts as a newly picked note


async def device_blocks(sr: int = SAMPLE_RATE, hop: int = HOP, device=None) -> AsyncIterator[tuple[np.ndarray, float]]:
    """Blocks from an audio interface. Picks the loudest input channel (the guitar may be on input 2)."""
    import sounddevice as sd  # imported here so the simulator works without audio hardware

    loop = asyncio.get_running_loop()
    queue: asyncio.Queue[tuple[np.ndarray, float]] = asyncio.Queue()
    channels = min(2, int(sd.query_devices(device, "input")["max_input_channels"]))

    def callback(indata, frames, time_info, status):
        # runs on the audio thread: stamp the arrival time, hand the block to the event loop
        loop.call_soon_threadsafe(queue.put_nowait, (indata.copy(), time.time()))

    with sd.InputStream(samplerate=sr, blocksize=hop, channels=channels, dtype="float32",
                        callback=callback, device=device, latency="low"):
        while True:
            block, captured_at = await queue.get()
            loudest = int(np.argmax(np.sqrt(np.mean(block ** 2, axis=0))))
            yield block[:, loudest], captured_at


# Open strings, then a short melody: (MIDI note, seconds)
SIM_NOTES = [(40, 0.7), (45, 0.7), (50, 0.7), (55, 0.7), (59, 0.7), (64, 0.7),
             (64, 0.35), (67, 0.35), (69, 0.35), (71, 0.7), (None, 0.5)]


async def simulated_blocks(sr: int = SAMPLE_RATE, hop: int = HOP) -> AsyncIterator[tuple[np.ndarray, float]]:
    """A fake guitar: plucked-string-like tones (several harmonics, decaying), paced in real time."""
    rng = np.random.default_rng(0)
    start = time.perf_counter()
    k = 0
    while True:
        for midi, dur in SIM_NOTES:
            n = int(dur * sr)
            t = np.arange(n) / sr
            if midi is None:
                note = np.zeros(n)
            else:
                f = 440.0 * 2 ** ((midi - 69) / 12)
                note = sum((0.6 / h) * np.sin(2 * math.pi * f * h * t) for h in range(1, 6))
                note *= np.exp(-2.5 * t)  # pluck decay
            note = (note + rng.normal(0, 0.002, n)).astype(np.float32)
            for i in range(0, n - hop + 1, hop):
                k += 1
                # wait until this block would really have finished arriving
                delay = start + k * hop / sr - time.perf_counter()
                if delay > 0:
                    await asyncio.sleep(delay)
                yield note[i:i + hop], time.time()


async def pitch_events(source: str = "sim", sr: int = SAMPLE_RATE) -> AsyncIterator[dict]:
    blocks = simulated_blocks(sr) if source == "sim" else device_blocks(sr)
    buf = np.zeros(WINDOW, dtype=np.float32)
    level = 0.0
    seq = 0
    async for block, captured_at in blocks:
        t0 = time.perf_counter()
        buf = np.concatenate((buf[len(block):], block))  # rolling window, newest audio last
        loudness = rms(buf[-HOP:])
        onset = loudness > SILENCE_RMS and loudness > ONSET_RATIO * level
        level = 0.8 * level + 0.2 * loudness
        pitch = detect_pitch(buf, sr) if loudness >= SILENCE_RMS else None
        seq += 1
        yield {
            "seq": seq,
            "captured_at": captured_at,
            "processing_ms": (time.perf_counter() - t0) * 1000,
            "hz": pitch.hz if pitch else None,
            "midi": pitch.midi if pitch else None,
            "note": pitch.note if pitch else None,
            "cents": pitch.cents if pitch else None,
            "clarity": pitch.clarity if pitch else 0.0,
            "rms": loudness,
            "onset": bool(onset),
        }
