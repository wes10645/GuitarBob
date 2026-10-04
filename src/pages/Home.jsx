import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCharacter } from '../context/CharacterContext';
import { CHARACTERS } from '../context/CharacterContext';
import BobWithSpeech from '../components/BobWithSpeech';
import TopBar from '../components/TopBar';
import GuitarIconSvg from '../components/GuitarIconSvg';
import { getCharacterDialogue } from '../data/characterDialogues';

const MusicNotes = ({ count = 8 }) => {
  const notes = Array.from({ length: count }, (_, i) => {
    const delay = i * 0.1;
    const duration = 2 + Math.random() * 1;
    const xOffset = (Math.random() - 0.5) * 200;
    return (
      <div
        key={i}
        className="absolute text-2xl animate-pulse"
        style={{
          left: '50%',
          top: '50%',
          animation: `flyUp ${duration}s ease-out ${delay}s forwards`,
          transform: `translateX(${xOffset}px)`,
        }}
      >
        ♪
      </div>
    );
  });

  return (
    <>
      <style>{`
        @keyframes flyUp {
          0% {
            opacity: 1;
            transform: translateY(0px) translateX(var(--tx, 0));
          }
          100% {
            opacity: 0;
            transform: translateY(-200px) translateX(var(--tx, 0));
          }
        }
      `}</style>
      {notes}
    </>
  );
};

export default function Home() {
  const { characterId } = useCharacter();
  const tutorName = CHARACTERS.find((c) => c.id === characterId)?.name ?? 'Bob';
  const [dialogue, setDialogue] = useState(null);
  const [showIcon, setShowIcon] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  // Set dialogue only when character changes
  useEffect(() => {
    setDialogue(getCharacterDialogue(characterId));
  }, [characterId]);

  useEffect(() => {
    // Start fade out at 2 seconds, let it fade for 2 seconds (until 4s), then hide and push up
    const fadeTimer = setTimeout(() => {
      setFadeOut(true);
    }, 2000);

    const hideTimer = setTimeout(() => {
      setShowIcon(false);
      setShowNotes(true);
    }, 4000);

    const notesTimer = setTimeout(() => {
      setShowNotes(false);
    }, 6000);
    
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
      clearTimeout(notesTimer);
    };
  }, []);

  if (!dialogue) {
    return (
      <div className="min-h-screen flex flex-col">
        <TopBar streak={0} xp={0} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar streak={0} xp={0} />
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 max-w-2xl mx-auto relative">
        <div
          className="flex justify-center overflow-hidden"
          style={{
            opacity: showIcon ? (fadeOut ? 0 : 1) : 0,
            height: showIcon ? 'auto' : '0px',
            marginBottom: showIcon ? '1rem' : '0px',
            transitionProperty: 'opacity, height, margin-bottom',
            transitionDuration: showIcon && fadeOut ? '0ms' : (showIcon ? '2000ms' : '500ms'),
            transitionTimingFunction: 'ease-out',
          }}
        >
          <GuitarIconSvg width={112} height={128} />
        </div>
        
        {showNotes && (
          <div className="fixed inset-0 pointer-events-none flex items-start justify-center pt-20">
            {Array.from({ length: 8 }, (_, i) => {
              const delay = i * 0.1;
              const duration = 2.5 + Math.random() * 1;
              const xOffset = (Math.random() - 0.5) * 300;
              const keyframes = `
                @keyframes flyUp${i} {
                  0% {
                    opacity: 1;
                    transform: translateY(0px) translateX(0px);
                  }
                  100% {
                    opacity: 0;
                    transform: translateY(-500px) translateX(${xOffset}px);
                  }
                }
              `;
              return (
                <React.Fragment key={i}>
                  <style>{keyframes}</style>
                  <div
                    className="absolute text-4xl pointer-events-none"
                    style={{
                      left: '50%',
                      top: '80px',
                      animation: `flyUp${i} ${duration}s ease-out ${delay}s forwards`,
                      color: '#22c55e',
                      textShadow: '0 0 10px rgba(34, 197, 94, 0.5)',
                    }}
                  >
                    ♪
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}
        <h1 className="font-display text-4xl md:text-5xl text-bob-green-dark text-center mb-2">
          {dialogue.greeting}
        </h1>
        <p className="font-body text-xl text-gray-600 text-center mb-10">
          {dialogue.subtext}
        </p>
        <BobWithSpeech
          message={dialogue.main}
          pose="default"
          bobSize={240}
        />
        <div className="mt-12 flex flex-col sm:flex-row gap-4 w-full max-w-sm">
          <Link
            to="/upload"
            className="btn-bob-green flex-1 text-center no-underline py-4"
          >
            Upload a song
          </Link>
          <Link
            to="/practice"
            className="btn-bob-outline flex-1 text-center no-underline py-4"
          >
            Practice
          </Link>
          <Link
            to="/chords"
            className="btn-bob-outline flex-1 text-center no-underline py-4"
          >
            Chord Library
          </Link>
          <Link
            to="/transcribe"
            className="btn-bob-outline flex-1 text-center no-underline py-4"
          >
            Live Transcribe
          </Link>
          <Link
            to="/pitch-lab"
            className="btn-bob-outline flex-1 text-center no-underline py-4"
          >
            Pitch Lab
          </Link>
        </div>
        <p className="font-body text-sm text-gray-500 mt-8 text-center">
          {dialogue.cta}
        </p>
      </main>
    </div>
  );
}
