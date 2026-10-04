"""
Real-time pitch detection: FFT-based autocorrelation (McLeod Pitch Method).

How it works, for one short frame of audio:
  1. Autocorrelation via FFT: compare the frame with delayed copies of itself.
     Doing it directly costs O(n^2); the Wiener-Khinchin theorem says
     autocorrelation = inverse FFT of the power spectrum, which costs O(n log n).
  2. Normalize it (NSDF, values from -1 to 1) so loud and quiet notes look alike.
  3. The first strong peak is at a delay of one cycle (the period). Picking the
     *first* strong peak, not the highest, avoids octave errors.
  4. Parabolic interpolation between samples gives a sub-sample period,
     so the pitch is accurate to a few cents instead of a few percent.

Reference: McLeod & Wyvill, "A Smarter Way to Find Pitch" (2005).
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


@dataclass
class Pitch:
    hz: float
    midi: int  # nearest MIDI note number (69 = A4 = 440 Hz)
    note: str  # e.g. "E2"
    cents: float  # how far from that note, -50 to +50 (100 cents = 1 semitone)
    clarity: float  # 0 to 1: how periodic the frame is (1 = perfectly repeating)


def hz_to_pitch(hz: float, clarity: float) -> Pitch:
    exact = 69 + 12 * math.log2(hz / 440.0)
    midi = int(round(exact))
    name = f"{NOTE_NAMES[midi % 12]}{midi // 12 - 1}"
    return Pitch(hz=hz, midi=midi, note=name, cents=(exact - midi) * 100, clarity=clarity)


def nsdf(frame: np.ndarray) -> np.ndarray:
    """Normalized square difference function, computed with FFTs in O(n log n)."""
    x = frame - frame.mean()
    n = len(x)
    size = 1 << (2 * n - 1).bit_length()  # zero-pad so the circular FFT acts like a linear one
    spectrum = np.fft.rfft(x, size)
    acf = np.fft.irfft(spectrum * np.conj(spectrum), size)[:n]  # autocorrelation for delays 0..n-1

    # m[tau] = sum of x[j]^2 + x[j+tau]^2 over the overlap, via cumulative sums (O(n))
    sq = x * x
    cumsum = np.concatenate(([0.0], np.cumsum(sq)))
    tau = np.arange(n)
    m = (cumsum[n] - cumsum[tau]) + cumsum[n - tau]
    return 2 * acf / np.maximum(m, 1e-12)


def detect_pitch(
    frame: np.ndarray,
    sr: int,
    fmin: float = 70.0,
    fmax: float = 1400.0,  # just above the 24th fret of the high E string (1319 Hz)
    peak_threshold: float = 0.9,
    min_clarity: float = 0.5,
) -> Pitch | None:
    """Returns the pitch of a mono float frame, or None if it isn't clearly pitched."""
    d = nsdf(frame.astype(np.float64))
    tau_min = max(1, int(sr / fmax))
    tau_max = min(len(d) - 2, int(sr / fmin))

    # Collect the highest point of each positive region after the first zero crossing
    peaks: list[int] = []
    tau = 1
    while tau < tau_max and d[tau] > 0:  # skip the zero-delay hump
        tau += 1
    while tau < tau_max:
        if d[tau] > 0:
            best = tau
            while tau < tau_max and d[tau] > 0:
                if d[tau] > d[best]:
                    best = tau
                tau += 1
            if best >= tau_min:
                peaks.append(best)
        tau += 1
    if not peaks:
        return None

    # First peak that is nearly as strong as the strongest one = the fundamental period
    highest = max(d[p] for p in peaks)
    chosen = next(p for p in peaks if d[p] >= peak_threshold * highest)
    if d[chosen] < min_clarity:
        return None

    # Parabolic interpolation through the peak and its neighbors
    a, b, c = d[chosen - 1], d[chosen], d[chosen + 1]
    denom = a - 2 * b + c
    shift = 0.5 * (a - c) / denom if denom != 0 else 0.0
    period = chosen + shift
    clarity = float(b - 0.25 * (a - c) * shift)
    return hz_to_pitch(sr / period, min(1.0, clarity))


def rms(frame: np.ndarray) -> float:
    return float(np.sqrt(np.mean(frame.astype(np.float64) ** 2)))
