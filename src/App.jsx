import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CharacterProvider } from './context/CharacterContext';
import Home from './pages/Home';
import Upload from './pages/Upload';
import Processing from './pages/Processing';
import Results from './pages/Results';
import Practice from './pages/Practice';
import Chords from './pages/Chords';
import ChordDetail from './pages/ChordDetail';
import CharacterShop from './pages/CharacterShop';
import Tuner from './pages/Tuner';
import LiveTranscribe from './pages/LiveTranscribe';
import PitchLab from './pages/PitchLab';

export default function App() {
  return (
    <CharacterProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<CharacterShop />} />
          <Route path="/tuner" element={<Tuner />} />
          <Route path="/chords" element={<Chords />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/processing" element={<Processing />} />
          <Route path="/results" element={<Results />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/transcribe" element={<LiveTranscribe />} />
          <Route path="/pitch-lab" element={<PitchLab />} />
          <Route path="/chord/:chordKey" element={<ChordDetail />} />
          <Route path="/visualizer" element={<Navigate to="/practice" replace />} />
        </Routes>
      </BrowserRouter>
    </CharacterProvider>
  );
}
