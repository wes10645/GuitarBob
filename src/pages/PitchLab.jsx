import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import TopBar from '../components/TopBar';
import { usePitchStream } from '../hooks/usePitchStream';

const SOURCES = [
  { value: 'sim', label: 'Simulated guitar' },
  { value: 'device', label: 'Audio interface' },
];
const TRACE_W = 400;
const TRACE_H = 120;
const MIDI_LOW = 38; // just below low E (40)
const MIDI_HIGH = 90; // just above the 24th fret of high E (88)

function fmt(value, digits = 1) {
  return value == null ? '–' : value.toFixed(digits);
}

// -50..+50 cents meter; the green band is "in tune" (within 5 cents)
function CentsMeter({ cents }) {
  const pos = cents == null ? 50 : 50 + Math.max(-50, Math.min(50, cents));
  const inTune = cents != null && Math.abs(cents) <= 5;
  return (
    <div className="w-full">
      <div className="relative h-4 rounded-full bg-amber-200 overflow-hidden">
        <div className="absolute inset-y-0 bg-green-400/70" style={{ left: '45%', width: '10%' }} />
        {cents != null && (
          <div
            className={`absolute inset-y-0 w-1.5 -ml-0.5 rounded ${inTune ? 'bg-bob-green-dark' : 'bg-red-500'}`}
            style={{ left: `${pos}%` }}
          />
        )}
      </div>
      <div className="flex justify-between font-body text-xs text-amber-800/70 mt-1">
        <span>−50¢ flat</span>
        <span>{inTune ? 'In tune' : ' '}</span>
        <span>sharp +50¢</span>
      </div>
    </div>
  );
}

// The last few seconds of detected notes, newest on the right
function PitchTrace({ trace }) {
  if (trace.length < 2) return <div style={{ height: TRACE_H }} />;
  const t0 = trace[0].t;
  const span = Math.max(1, trace[trace.length - 1].t - t0);
  const y = (midi, cents) => TRACE_H - ((midi + (cents || 0) / 100 - MIDI_LOW) / (MIDI_HIGH - MIDI_LOW)) * TRACE_H;
  return (
    <svg viewBox={`0 0 ${TRACE_W} ${TRACE_H}`} className="w-full" style={{ height: TRACE_H }}>
      {trace.map((p) =>
        p.midi == null ? null : (
          <circle key={p.t} cx={((p.t - t0) / span) * TRACE_W} cy={y(p.midi, p.cents)} r="2" className="fill-bob-green-dark" />
        )
      )}
    </svg>
  );
}

function Stat({ label, value, unit }) {
  return (
    <div className="rounded-xl bg-white/70 p-3 text-center">
      <div className="font-display text-xl text-bob-green-dark">
        {value}
        <span className="text-sm text-amber-800/70"> {unit}</span>
      </div>
      <div className="font-body text-xs text-amber-800/80">{label}</div>
    </div>
  );
}

export default function PitchLab() {
  const [source, setSource] = useState('sim');
  const { latest, trace, stats, isConnected, error, connect, disconnect } = usePitchStream();

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-amber-50 to-amber-100">
      <TopBar streak={0} xp={0} />
      <main className="flex-1 flex flex-col items-center px-6 py-8 max-w-lg mx-auto w-full gap-5">
        <div className="text-center">
          <h1 className="font-display text-2xl text-bob-green-dark mb-1">Pitch Lab</h1>
          <p className="font-body text-sm text-amber-800/80">
            Real-time pitch detection (FFT autocorrelation), streamed over a WebSocket
          </p>
        </div>

        <div className="flex gap-2 w-full">
          {SOURCES.map((s) => (
            <button
              key={s.value}
              disabled={isConnected}
              onClick={() => setSource(s.value)}
              className={`flex-1 py-2 rounded-xl font-body text-sm border-2 transition-all disabled:opacity-60 ${
                source === s.value ? 'border-bob-green bg-bob-green/10 text-bob-green-dark' : 'border-amber-200 text-amber-800'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <button
          onClick={isConnected ? disconnect : () => connect(source)}
          className={`w-full py-3 px-6 rounded-xl font-display font-semibold text-white transition-all ${
            isConnected ? 'bg-red-500 hover:bg-red-600' : 'bg-bob-green hover:bg-bob-green-dark'
          }`}
        >
          {isConnected ? 'Stop' : 'Start listening'}
        </button>
        {error && <p className="font-body text-sm text-red-600 -mt-3">{error}</p>}

        <div className="w-full rounded-2xl bg-white/80 p-5 flex flex-col items-center gap-3">
          <div className="font-display text-6xl text-bob-green-dark h-16">{latest?.note ?? '–'}</div>
          <div className="font-body text-sm text-amber-800/80">
            {latest?.hz ? `${fmt(latest.hz)} Hz · ${latest.cents >= 0 ? '+' : ''}${fmt(latest.cents, 0)}¢` : 'no note'}
          </div>
          <CentsMeter cents={latest?.cents ?? null} />
          <div className="w-full border-t border-amber-100 pt-2">
            <PitchTrace trace={trace} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 w-full">
          <Stat label="updates per second" value={fmt(stats?.updatesPerSec, 0)} unit="/s" />
          <Stat label="server detection (avg)" value={fmt(stats?.detectionMs, 2)} unit="ms" />
          <Stat label="latency, median" value={fmt(stats?.latencyP50)} unit="ms" />
          <Stat label="latency, 95th percentile" value={fmt(stats?.latencyP95)} unit="ms" />
        </div>
        <p className="font-body text-xs text-amber-800/70 text-center">
          Latency = when this page received an event − when its newest audio block was captured. It covers
          detection, JSON and the WebSocket. The audio arrives in 21 ms blocks, so input-to-screen time adds
          up to one block, the interface&apos;s own buffer and one screen refresh.
        </p>

        <Link to="/" className="font-body text-bob-green-dark hover:underline">
          ← Back to home
        </Link>
      </main>
    </div>
  );
}
