import React, { useState, useCallback, useRef, useEffect } from 'react';
import './App.css';
import MoodScanner from './components/MoodScanner';

// ── Per-mood RGB values ──
// Surprised = Bright Silver + Electric Blue (180,210,255)
const MOOD_RGB = {
  happy:    '251,191,36',   // Gold
  sad:      '96,165,250',   // Blue
  angry:    '239,68,68',    // Crimson
  surprised:'180,210,255',  // Electric Blue-Silver
  neutral:  '20,184,166',   // Teal
  low:      '129,140,248',  // Indigo
};

function App() {
  const [mood,        setMood]        = useState('neutral');
  const [volumeLevel, setVolumeLevel] = useState(0);
  const bgRef = useRef(null);

  // Callbacks lifted from MoodScanner so App can react
  const onMoodChange   = useCallback(m  => setMood(m),        []);
  const onVolumeChange = useCallback(v  => setVolumeLevel(v), []);

  // Push --mood-color, --vol, and --particle-boost onto :root
  // --particle-boost: 2.5 = Surprised warp-speed particles, 1 = normal
  useEffect(() => {
    const rgb   = MOOD_RGB[mood] || MOOD_RGB.neutral;
    const boost = mood === 'surprised' ? '2.5' : '1';
    document.documentElement.style.setProperty('--mood-color',      rgb);
    document.documentElement.style.setProperty('--vol',             volumeLevel.toFixed(4));
    document.documentElement.style.setProperty('--particle-boost',  boost);
  }, [mood, volumeLevel]);

  // Also push onto the bg element (belt-and-suspenders for ::after glow)
  useEffect(() => {
    if (!bgRef.current) return;
    const rgb = MOOD_RGB[mood] || MOOD_RGB.neutral;
    bgRef.current.style.setProperty('--mood-color', rgb);
    bgRef.current.style.setProperty('--vol', volumeLevel.toFixed(4));
  }, [mood, volumeLevel]);

  return (
    <>
      {/* ── Dynamic radial-gradient background ── */}
      <div ref={bgRef} className="aura-app-bg" aria-hidden="true" />

      {/* ── Particle field — gains mood-surprised class for electric glow ── */}
      <div
        className={`particle-field${mood === 'surprised' ? ' mood-surprised' : ''}`}
        aria-hidden="true"
      >
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} className={`particle p${i + 1}`} />
        ))}
      </div>

      {/* ── App shell ── */}
      <div className="min-h-screen text-white flex flex-col items-center justify-center p-4">

        {/* Brand header */}
        <div className="text-center mb-10">
          <h1 className="aura-title text-5xl font-black tracking-tighter leading-none">
            AURA<span style={{ color: `rgb(${MOOD_RGB[mood] || MOOD_RGB.neutral})`, transition: 'color 2s ease' }}>SOUND</span>
          </h1>
          <p className="text-white/25 text-[10px] uppercase tracking-[0.5em] mt-2">
            Mood-Responsive Audio Engine v2.0
          </p>
        </div>

        {/* Main scanner — exposes mood + volumeLevel upward */}
        <div className="aura-scanner-container w-full flex flex-col items-center">
          <MoodScanner
            onMoodChange={onMoodChange}
            onVolumeChange={onVolumeChange}
          />
        </div>

        {/* Footer */}
        <p
          className="aura-footer mt-10 text-white/20 text-[10px] max-w-xs text-center uppercase tracking-[0.4em] leading-loose"
          style={{ color: `rgba(${MOOD_RGB[mood] || MOOD_RGB.neutral},0.35)`, transition: 'color 2s ease' }}
        >
          TEAM APEX | AURA SERIES V2.0 | LOCAL VIBE-SYNC
        </p>
      </div>
    </>
  );
}

export default App;