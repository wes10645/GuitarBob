# GuitarBob

**AI guitar tutor.** Upload a song to get its chords, tabs and a Guitar Hero-style note highway to practice with, guided by Bob, a Duolingo-style guitar buddy. A live mode listens to your guitar through an audio interface and shows the notes you play.

Built in a 36-hour hackathon (Feb 21–22, 2026) by:

- **Wesley Chang**: React frontend (pages, chord diagrams, tab viewer, note highway, live transcription UI)
- **Nathan Park**: Python backend (audio analysis, chord and note detection, live pitch streaming)

## Features

- **Upload**: drop in an MP3/WAV; the backend finds the tempo, chords and notes
- **Results**: chord timeline, chord diagrams and tabs
- **Practice**: scrolling note highway with 0.25x–1x playback speed
- **Chords**: chord library with clickable diagrams and note names
- **Live Transcribe**: play your guitar and see detected notes on a fretboard
- **Pitch Lab** (prototype branch): real-time FFT-autocorrelation pitch detection, ~47 updates/sec, with live latency stats. See [docs/REALTIME_PITCH.md](docs/REALTIME_PITCH.md)
- **Tuner UI** and a character shop (Bob and Riff)

## How it works

- **Chords**: `librosa` computes chroma (how much of each of the 12 note names is present) and matches each slice against 24 major/minor chord templates, then smooths the result.
- **Notes**: on macOS/Linux, Spotify's [basic-pitch](https://github.com/spotify/basic-pitch) neural network transcribes notes, which are mapped to string and fret. Otherwise, onset detection plus chroma is used.
- **Live mode**: the backend reads the audio interface with `sounddevice`, detects pitch with the YIN algorithm and streams note events to the browser over a WebSocket.

## Running locally

You need Node.js, Python 3.10+ and [ffmpeg](https://ffmpeg.org/) on your PATH. Use two terminals.

**1. Backend (FastAPI), port 8000**

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
pip install basic-pitch         # optional, macOS/Linux only: more accurate notes
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Check http://127.0.0.1:8000/health. `"basic_pitch": "enabled"` means note transcription will use basic-pitch.

**2. Frontend (React + Vite), port 5173**

From the repository root:

```bash
npm install
npm run dev
```

Open http://localhost:5173. The frontend calls the backend at `http://127.0.0.1:8000`; set `VITE_API_URL` to change it.

**Live mode** needs an audio interface (a Focusrite Scarlett is picked automatically). List inputs at http://127.0.0.1:8000/devices and set `SCARLETT_DEVICE=<index>` to choose one.

## Tech stack

React 18, Vite, Tailwind CSS, React Router, alphaTab · FastAPI, Uvicorn, librosa, NumPy, SciPy, sounddevice, basic-pitch, ffmpeg
