import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useAuraAI } from '../hooks/useAuraAI';
import { useAuraSound } from '../hooks/useAuraSound';

// ─────────────────────────────────────────────────────────────
//  MoodScanner  v3.0  — Next-Level Living UI
//  • 8-bar volumeLevel visualizer inside Now Playing card
//  • Triple portal rings (slow CW / CCW / fast CW)
//  • Lifts mood + volumeLevel to parent via optional callbacks
// ─────────────────────────────────────────────────────────────

// Per-mood colour system
// Surprised: Electric Blue-Silver (matches App.jsx MOOD_RGB + CSS --mood-silver)
const AURA_THEMES = {
  happy:    { rgb: '251,191,36',  glow: '251,191,36',  label: 'HAPPY',    emoji: '😄' },
  sad:      { rgb: '96,165,250',  glow: '59,130,246',  label: 'SAD',      emoji: '😢' },
  angry:    { rgb: '248,113,113', glow: '239,68,68',   label: 'ANGRY',    emoji: '😠' },
  surprised:{ rgb: '180,210,255', glow: '100,160,255', label: 'SURPRISED',emoji: '😲' },
  neutral:  { rgb: '52,211,153',  glow: '16,185,129',  label: 'NEUTRAL',  emoji: '😐' },
  low:      { rgb: '129,140,248', glow: '99,102,241',  label: 'LOW',      emoji: '🙏' },
};

// 8 visualizer bars — pre-computed phase offsets for organic look
const VIZ_PHASES = [0, 0.9, 1.7, 2.6, 3.4, 4.2, 5.1, 6.0];

// ─────────────────────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────────────────────
const MoodScanner = ({ onMoodChange, onVolumeChange }) => {
  const videoRef   = useRef(null);
  const scannerRef = useRef(null);  // outer orb — vibe transform
  const cardRef    = useRef(null);  // status card — vibe glow
  const rafVizRef  = useRef(null);  // rAF for viz bars

  const { mood, detectMood, isModelLoaded } = useAuraAI(videoRef);
  const { unlockAudio, isPlaying, currentTrack, volumeLevel } = useAuraSound(mood);

  const theme = AURA_THEMES[mood] || AURA_THEMES.neutral;

  // ── Lift mood + volumeLevel to parent App ──────────────────
  useEffect(() => { onMoodChange?.(mood); },        [mood,        onMoodChange]);
  useEffect(() => { onVolumeChange?.(volumeLevel); },[volumeLevel, onVolumeChange]);

  // ── Webcam initialisation ──────────────────────────────────
  useEffect(() => {
    let stream;
    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(s => {
          stream = s;
          if (videoRef.current) videoRef.current.srcObject = s;
        })
        .catch(err => console.error('[AuraSound] Webcam blocked:', err));
    }
    return () => stream?.getTracks().forEach(t => t.stop());
  }, []);

  // ── Mood detection interval ────────────────────────────────
  useEffect(() => {
    const id = setInterval(detectMood, 500);
    return () => clearInterval(id);
  }, [detectMood]);

  // ── Vibe Coding — beat-reactive DOM physics ────────────────
  useEffect(() => {
    if (!scannerRef.current || !cardRef.current) return;

    const scale   = 1 + volumeLevel * 0.2;
    const spread  = Math.round(volumeLevel * 60);
    const opacity = (0.15 + volumeLevel * 0.55).toFixed(2);
    const floatY  = (-volumeLevel * 8).toFixed(2);

    scannerRef.current.style.transform =
      `scale(${scale.toFixed(4)}) translateY(${floatY}px)`;
    scannerRef.current.style.filter =
      `drop-shadow(0 0 ${spread}px rgba(${theme.glow},${opacity}))`;

    cardRef.current.style.boxShadow =
      `0 0 ${40 + spread}px -10px rgba(${theme.glow},${opacity}), 0 20px 60px rgba(0,0,0,0.5)`;
    cardRef.current.style.borderColor =
      `rgba(${theme.rgb},${(0.1 + volumeLevel * 0.4).toFixed(2)})`;
  }, [volumeLevel, theme]);

  // ── 8-bar visualizer scaleY driven by volumeLevel ─────────
  const [vizScales, setVizScales] = useState(Array(8).fill(0.08));

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      setVizScales(VIZ_PHASES.map(phase => {
        if (!isPlaying) return 0.08;
        const wave = Math.sin(now / 180 + phase) * 0.5 + 0.5;
        return Math.max(0.08, volumeLevel * wave);
      }));
      rafVizRef.current = requestAnimationFrame(tick);
    };
    rafVizRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafVizRef.current);
  }, [isPlaying, volumeLevel]);

  // ── Legacy mini-eq bar heights (7-bar row in card) ─────────
  const BAR_COUNT = 7;
  const getBarHeight = (i) => {
    if (!isPlaying) return 3;
    const phase = Math.sin(Date.now() / 200 + i * 0.8) * 0.5 + 0.5;
    return Math.max(3, Math.round(volumeLevel * 32 * phase + 4));
  };
  const [barHeights, setBarHeights] = useState(Array(BAR_COUNT).fill(3));
  useEffect(() => {
    if (!isPlaying) { setBarHeights(Array(BAR_COUNT).fill(3)); return; }
    const id = setInterval(() => {
      setBarHeights(Array.from({ length: BAR_COUNT }, (_, i) => getBarHeight(i)));
    }, 80);
    return () => clearInterval(id);
  }, [isPlaying, volumeLevel]); // eslint-disable-line

  // ─────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center justify-center w-full max-w-2xl mx-auto py-8 select-none">

      {/* ── Vibe-animated Scanner Orb ── */}
      <div
        ref={scannerRef}
        className="relative vibe-orb"
        style={{ transition: 'transform 0.12s ease-out, filter 0.12s ease-out' }}
      >
        {/* Ring 1 — slow CW dashed (portal layer 1) */}
        <div
          className="absolute inset-[-10px] rounded-full border border-dashed opacity-25 aura-ring"
          style={{ borderColor: `rgba(${theme.rgb},1)` }}
        />

        {/* Ring 2 — slower CCW dotted (portal layer 2) */}
        <div
          className="absolute inset-[-22px] rounded-full border border-dotted opacity-15 aura-ring-rev"
          style={{ borderColor: `rgba(${theme.rgb},0.9)` }}
        />

        {/* Ring 3 — fast CW solid thin (innermost energy ring) */}
        <div
          className="absolute inset-[-4px] rounded-full border opacity-20 aura-ring-3"
          style={{
            borderColor: `rgba(${theme.rgb},1)`,
            borderWidth: '1px',
            borderStyle: 'solid',
          }}
        />

        {/* Video lens */}
        <div
          className="relative w-72 h-72 md:w-80 md:h-80 rounded-full overflow-hidden bg-black"
          style={{
            border: `1px solid rgba(${theme.rgb},0.4)`,
            transition: 'border-color 1s ease'
          }}
        >
          {/* Scan line */}
          <div
            className="scan-line absolute w-full h-[2px] top-0 z-10 pointer-events-none"
            style={{ background: `linear-gradient(to right, transparent, rgba(${theme.rgb},0.7), transparent)` }}
          />

          <video
            ref={videoRef}
            autoPlay muted playsInline
            className="w-full h-full object-cover scale-x-[-1] brightness-105 contrast-105 opacity-90"
          />

          {/* Vignette */}
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.65)_100%)]" />

          {/* Centre crosshair */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-10 h-10 opacity-30">
              <div className="absolute inset-x-0 top-1/2 h-px bg-white/60" />
              <div className="absolute inset-y-0 left-1/2 w-px bg-white/60" />
              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-white/80" />
              <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-white/80" />
              <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-white/80" />
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-white/80" />
            </div>
          </div>
        </div>

        {/* Mood emoji badge */}
        <div
          className="absolute -bottom-3 -right-3 w-12 h-12 rounded-full bg-[#0d0d0d] border flex items-center justify-center text-xl shadow-2xl mood-badge"
          style={{ borderColor: `rgba(${theme.rgb},0.5)`, transition: 'border-color 1s ease' }}
        >
          {theme.emoji}
        </div>
      </div>

      {/* ── Status + Now Playing Card ── */}
      <div
        ref={cardRef}
        className="mt-14 w-full max-w-sm glassmorphism-card"
        style={{ transition: 'box-shadow 0.12s ease-out, border-color 0.12s ease-out' }}
      >
        {/* Top accent line */}
        <div
          className="absolute top-0 left-0 h-[2px] w-full rounded-t-2xl"
          style={{ background: `linear-gradient(to right, transparent, rgba(${theme.rgb},0.9), transparent)`, transition: 'background 1s ease' }}
        />

        {/* Row 1: status + mood label */}
        <div className="flex justify-between items-start mb-5">
          <div className="text-left">
            <p className="text-[10px] text-white/35 uppercase tracking-[0.4em] mb-1">System Status</p>
            <h3 className="text-sm font-light tracking-widest text-white/90 mb-4">
              {isModelLoaded
                ? <span className="text-emerald-400">◉ AI ACTIVE</span>
                : <span className="text-white/40 animate-pulse">◌ INITIALIZING</span>
              }
            </h3>
            <button
              id="sync-audio-btn"
              onClick={unlockAudio}
              className="sync-btn text-[9px] uppercase tracking-widest px-4 py-2 rounded-md transition-all duration-300 active:scale-95 flex items-center gap-2"
              style={{
                border: `1px solid rgba(${theme.rgb},0.4)`,
                color: `rgb(${theme.rgb})`,
                transition: 'border-color 1s ease, color 1s ease'
              }}
            >
              <span className={isPlaying ? 'playing-dot' : ''}>{isPlaying ? '◼' : '▶'}</span>
              {isPlaying ? 'PLAYING' : 'SYNC AUDIO'}
            </button>
          </div>

          <div className="text-right">
            <p className="text-[10px] text-white/35 uppercase tracking-[0.4em] mb-1">Detected Aura</p>
            <h3
              className="card-mood-label text-2xl font-black tracking-[0.15em] uppercase"
              style={{ color: `rgb(${theme.rgb})`, transition: 'color 1s ease' }}
            >
              {theme.label}
            </h3>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-white/5 mb-4" />

        {/* ── 8-bar Visualizer (new!) ── */}
        <div className="visualizer-container overflow-hidden mb-4">
          {vizScales.map((scale, i) => (
            <div
              key={i}
              className="viz-bar"
              style={{
                transform: `scaleY(${scale.toFixed(4)})`,
                height: '36px',
                background: `linear-gradient(to top, rgba(${theme.rgb},0.9), rgba(${theme.glow},0.4))`,
                boxShadow: isPlaying
                  ? `0 0 ${Math.round(scale * 12)}px rgba(${theme.glow},${(scale * 0.7).toFixed(2)})`
                  : 'none',
                opacity: 0.2 + scale * 0.8,
                transition: 'transform 0.08s ease-out, background 2s ease, box-shadow 0.08s ease-out, opacity 0.08s ease-out',
              }}
            />
          ))}
        </div>

        {/* Divider */}
        <div className="h-px bg-white/5 mb-4" />

        {/* Row 2: Now Playing (legacy mini-eq + track info) */}
        <div className="now-playing-row flex items-center gap-4">
          {/* Legacy mini equalizer */}
          <div className="flex items-end gap-[3px] h-8 shrink-0">
            {barHeights.map((h, i) => (
              <div
                key={i}
                className="w-[3px] rounded-full eq-bar"
                style={{
                  height: `${h}px`,
                  background: `rgba(${theme.rgb},${isPlaying ? 0.8 : 0.25})`,
                  transition: 'height 0.08s ease-out, background 1s ease'
                }}
              />
            ))}
          </div>

          {/* Track info */}
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[9px] text-white/30 uppercase tracking-[0.35em] mb-0.5">
              {isPlaying ? '♫ Now Playing' : 'Last Track'}
            </p>
            {currentTrack ? (
              <>
                <p className="text-sm font-semibold text-white/90 truncate leading-tight">
                  {currentTrack.title}
                </p>
                <p
                  className="text-[11px] truncate mt-0.5"
                  style={{ color: `rgba(${theme.rgb},0.7)`, transition: 'color 1s ease' }}
                >
                  {currentTrack.artist}
                </p>
              </>
            ) : (
              <p className="text-sm text-white/25 italic">Waiting for mood...</p>
            )}
          </div>
        </div>

        {/* Load bar */}
        <div className="mt-5 h-px w-full bg-white/5 relative overflow-hidden">
          <div
            className="absolute h-full top-0 left-0 rounded-full"
            style={{
              width: isModelLoaded ? '100%' : '20%',
              background: `rgba(${theme.rgb},0.6)`,
              transition: 'width 1.5s ease, background 1s ease'
            }}
          />
          {isPlaying && (
            <div
              className="absolute h-full top-0 w-16 bar-shimmer"
              style={{ background: `linear-gradient(to right, transparent, rgba(${theme.rgb},0.5), transparent)` }}
            />
          )}
        </div>
      </div>

      {/* ── Inline keyframes (component-scoped safety net) ── */}
      <style>{`
        @keyframes scan-v {
          0%   { top: -2px; opacity: 0; }
          20%  { opacity: 1; }
          80%  { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .scan-line { animation: scan-v 3s ease-in-out infinite; }

        @keyframes badge-float {
          0%, 100% { transform: translateY(0px); }
          50%      { transform: translateY(-4px); }
        }
        .mood-badge { animation: badge-float 3s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

export default MoodScanner;