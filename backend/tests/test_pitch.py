"""Run from backend/: python -m pytest tests"""
import math
import time

import numpy as np
import pytest

from dsp.pitch import detect_pitch, hz_to_pitch
from dsp.pitch_stream import SAMPLE_RATE as SR, WINDOW

GUITAR_RANGE = [40, 45, 50, 55, 59, 64, 69, 76, 83, 88]  # low E (82 Hz) up to the 24th fret (1319 Hz)


def midi_hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def tone(hz, harmonics=5, noise=0.0, seed=0):
    t = np.arange(WINDOW) / SR
    x = sum((1 / h) * np.sin(2 * math.pi * hz * h * t + h) for h in range(1, harmonics + 1))
    return x + np.random.default_rng(seed).normal(0, noise, WINDOW)


def cents_off(measured, expected):
    return 1200 * math.log2(measured / expected)


@pytest.mark.parametrize("midi", GUITAR_RANGE)
def test_pure_tones_within_5_cents(midi):
    p = detect_pitch(tone(midi_hz(midi), harmonics=1), SR)
    assert p is not None and p.midi == midi
    assert abs(cents_off(p.hz, midi_hz(midi))) < 5


@pytest.mark.parametrize("midi", GUITAR_RANGE[:-1])
def test_guitar_like_tones_have_no_octave_errors(midi):
    # strong overtones are what usually fool pitch detectors into the wrong octave
    p = detect_pitch(tone(midi_hz(midi), harmonics=6, noise=0.02), SR)
    assert p is not None and p.midi == midi


def test_weak_fundamental_still_found():
    # the 2nd harmonic is louder than the fundamental, like a low guitar string
    t = np.arange(WINDOW) / SR
    f = midi_hz(40)
    x = 0.3 * np.sin(2 * math.pi * f * t) + np.sin(2 * math.pi * 2 * f * t) + 0.5 * np.sin(2 * math.pi * 3 * f * t)
    assert detect_pitch(x, SR).midi == 40


def test_noise_is_not_a_note():
    noise = np.random.default_rng(1).normal(0, 0.1, WINDOW)
    assert detect_pitch(noise, SR) is None


def test_hz_to_pitch_names_and_cents():
    p = hz_to_pitch(440.0, 1.0)
    assert (p.note, p.midi, round(p.cents, 6)) == ("A4", 69, 0)
    assert hz_to_pitch(82.41, 1.0).note == "E2"
    assert round(hz_to_pitch(440 * 2 ** (10 / 1200), 1.0).cents) == 10


def test_fast_enough_for_real_time():
    # one hop is 21 ms of audio; detection must take a small fraction of that
    frame = tone(midi_hz(45), harmonics=6)
    start = time.perf_counter()
    for _ in range(200):
        detect_pitch(frame, SR)
    per_frame_ms = (time.perf_counter() - start) / 200 * 1000
    assert per_frame_ms < 2.0
