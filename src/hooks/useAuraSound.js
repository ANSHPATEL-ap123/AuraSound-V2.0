import { useEffect, useRef, useState, useCallback } from 'react';
import { MOOD_PLAYLISTS } from '../constants/MusicLibrary';

// ═══════════════════════════════════════════════════════════════════
//  AuraSound Audio Engine  v5.0 — Local Fail-Proof Architecture
//
//  ① Local /music/ paths — zero CORS / 403 issues
//  ② volumeLevel (0-1) exposed for Vibe Coding scale() transform
//  ③ Missing-file onerror shows exact filename + folder fix hint
//  ④ Mood-watch useEffect [mood] dep-only — no stale closures
//  ⑤ audioContext.resume() called inside unlockAudio (Sync button)
// ═══════════════════════════════════════════════════════════════════

const FADE_MS     = 1000;   // cross-fade duration ms
const MAX_VOL     = 0.72;   // master volume ceiling
const FFT_SIZE    = 256;    // analyser FFT size (power of 2)
const BASS_BINS   = 10;     // low-frequency bins averaged → volumeLevel
const MAX_RETRIES = 2;      // missing-file retry attempts per mood

export const useAuraSound = (mood) => {

    // ── UI-reactive state ──────────────────────────────────────
    const [currentTrack, setCurrentTrack] = useState(null);
    const [isPlaying,    setIsPlaying]    = useState(false);
    const [volumeLevel,  setVolumeLevel]  = useState(0);   // 0-1, drives scale() Vibe Coding

    // ── Stable refs (never cause re-renders, always up-to-date) ─
    const ctxRef          = useRef(null);
    const analyserRef     = useRef(null);
    const gainRef         = useRef(null);
    const sourceRef       = useRef(null);
    const audioElRef      = useRef(null);
    const activeUrlRef    = useRef(null);

    // ① CRITICAL FIX: isUnlocked is a REF, not useState.
    //   This means reading it inside useEffect is always synchronous
    //   and does NOT trigger a re-render that would reset the mood.
    const unlockedRef     = useRef(false);

    // Keeps latest mood accessible inside callbacks without deps
    const moodRef         = useRef(mood);
    useEffect(() => { moodRef.current = mood; }, [mood]);

    const retryCountRef   = useRef(0);
    const fadeTimerRef    = useRef(null);
    const rafRef          = useRef(null);
    const dataArrayRef    = useRef(null);
    // Tracks last value we actually sent to setState — avoids
    // triggering a re-render on every animation frame.
    const lastVolumeLevelRef = useRef(0);

    // ── Stable fn refs (updated every render, called by effects) ─
    // Using fn-refs pattern so effects can call latest version
    // without listing functions in their dependency arrays.
    const loadAndPlayRef  = useRef(null);
    const pickTrackRef    = useRef(null);
    const fadeTo          = useRef(null);
    const startAnalyser   = useRef(null);

    // ──────────────────────────────────────────────────────────
    //  AUDIO CONTEXT BOOTSTRAP (idempotent)
    // ──────────────────────────────────────────────────────────
    const buildCtx = useCallback(() => {
        if (ctxRef.current) return ctxRef.current;

        const ctx      = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = ctx.createAnalyser();
        analyser.fftSize               = FFT_SIZE;
        analyser.smoothingTimeConstant = 0.82;

        const gain = ctx.createGain();
        gain.gain.value = MAX_VOL;

        analyser.connect(gain);
        gain.connect(ctx.destination);

        ctxRef.current       = ctx;
        analyserRef.current  = analyser;
        gainRef.current      = gain;
        dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

        return ctx;
    }, []);

    // ──────────────────────────────────────────────────────────
    //  VOLUME RAMP  (linearRampToValueAtTime — 1-second fade)
    // ──────────────────────────────────────────────────────────
    fadeTo.current = (targetVol, durationMs, onDone) => {
        const gain = gainRef.current;
        if (!gain || !ctxRef.current) { onDone?.(); return; }

        const now = ctxRef.current.currentTime;
        const dur = durationMs / 1000;

        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value ?? MAX_VOL, now);
        gain.gain.linearRampToValueAtTime(targetVol, now + dur);

        clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = setTimeout(() => onDone?.(), durationMs + 50);
    };

    // ──────────────────────────────────────────────────────────
    //  ANALYSER RAF LOOP → audioLevel state
    //
    //  FIX: setVolumeLevel is only called when the new value
    //  differs from the previously-set value by > 0.01.
    //  This prevents a React re-render storm (~60/s) that was
    //  causing "Maximum update depth exceeded" at line 110.
    // ──────────────────────────────────────────────────────────
    startAnalyser.current = () => {
        const tick = () => {
            if (!analyserRef.current || !dataArrayRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArrayRef.current);

            let sum = 0;
            for (let i = 0; i < BASS_BINS; i++) sum += dataArrayRef.current[i];
            const newVolume = (sum / BASS_BINS) / 255;

            // Only schedule a state update when the change is perceptible
            if (Math.abs(newVolume - lastVolumeLevelRef.current) > 0.01) {
                lastVolumeLevelRef.current = newVolume;
                setVolumeLevel(newVolume);
            }

            rafRef.current = requestAnimationFrame(tick);
        };
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(tick);
    };

    // ──────────────────────────────────────────────────────────
    //  TRACK PICKER  (avoids immediate repeat within a playlist)
    // ──────────────────────────────────────────────────────────
    pickTrackRef.current = (targetMood, excludeUrl = null) => {
        const key      = targetMood && MOOD_PLAYLISTS[targetMood] ? targetMood : 'neutral';
        const playlist = MOOD_PLAYLISTS[key];
        const exclude  = excludeUrl ?? activeUrlRef.current;
        const pool     = playlist.length > 1
            ? playlist.filter(t => t.url !== exclude)
            : playlist;

        const candidates = pool.length ? pool : playlist;
        return candidates[Math.floor(Math.random() * candidates.length)] || null;
    };

    // ──────────────────────────────────────────────────────────
    //  CORE: loadAndPlay
    //  Creates a fresh <Audio> element, wires it into the Web
    //  Audio graph, cross-fades out the previous track, and
    //  fades in the new one. Retries on broken links.
    // ──────────────────────────────────────────────────────────
    loadAndPlayRef.current = (track) => {
        if (!track?.url || track.url === 'PASTE_LINK_HERE') {
            console.warn(`[AuraSound] ⚠ No URL for "${track?.title}". Edit MusicLibrary.js.`);
            return;
        }

        // Derive the expected filename from the local path for clearer errors
        const expectedFile = track.url.replace('/music/', '');

        const ctx = buildCtx();
        if (ctx.state === 'suspended') ctx.resume();

        const doSwitch = () => {
            // ── Teardown previous source ──
            if (sourceRef.current) {
                try { sourceRef.current.disconnect(); } catch (_) {}
                sourceRef.current = null;
            }
            if (audioElRef.current) {
                audioElRef.current.onerror = null;
                audioElRef.current.pause();
                audioElRef.current.src = '';
            }

            // ── Create new <Audio> for cloud streaming ──
            const audio       = new Audio();
            audio.crossOrigin = 'anonymous';   // needed for Web Audio API CORS
            audio.preload     = 'auto';
            audio.src         = track.url;
            audioElRef.current = audio;

            // ── onLoadError: missing local file handler ──
            audio.onerror = () => {
                const mediaErr = audio.error;
                const CODE_MAP = { 1: 'ABORTED', 2: 'FILE NOT FOUND (404)', 3: 'DECODE ERROR', 4: 'FORMAT UNSUPPORTED' };
                const codeLabel = CODE_MAP[mediaErr?.code] ?? `UNKNOWN (${mediaErr?.code})`;

                console.group('%c[AuraSound] ❌ Missing File', 'color:#f87171;font-weight:bold');
                console.error('Missing File:', `Please add  ${expectedFile}  to the  public/music/  folder`);
                console.error('Full path   :', `c:\\dev\\aura-sound\\public\\music\\${expectedFile}`);
                console.error('Track       :', `"${track.title}" by ${track.artist}`);
                console.error('Error code  :', codeLabel);
                console.info ('Fix         : Drop your MP3 into public/music/ and rename it to match the path above.');
                console.groupEnd();

                if (retryCountRef.current < MAX_RETRIES) {
                    retryCountRef.current += 1;
                    console.info(`[AuraSound] Trying next track in playlist (attempt ${retryCountRef.current}/${MAX_RETRIES})…`);
                    const fallback = pickTrackRef.current(moodRef.current, track.url);
                    if (fallback && fallback.url !== track.url) {
                        loadAndPlayRef.current(fallback);
                    } else {
                        console.warn('[AuraSound] No alternative track found — add MP3 files to public/music/');
                        setIsPlaying(false);
                    }
                } else {
                    console.error(`[AuraSound] All tracks for mood "${moodRef.current}" are missing. Add MP3s to public/music/`);
                    retryCountRef.current = 0;
                    setIsPlaying(false);
                }
            };

            // ── Wire into Web Audio graph ──
            const source = ctx.createMediaElementSource(audio);
            source.connect(analyserRef.current);
            sourceRef.current = source;

            // Start gain at 0 → ramp up after play() resolves
            gainRef.current.gain.setValueAtTime(0, ctx.currentTime);

            console.info(`[AuraSound] ▶ Loading: "${track.title}" by ${track.artist}  [${track.url}]`);

            audio.play()
                .then(() => {
                    retryCountRef.current = 0;
                    activeUrlRef.current  = track.url;
                    setCurrentTrack({ title: track.title, artist: track.artist });
                    setIsPlaying(true);
                    fadeTo.current(MAX_VOL, FADE_MS);
                    startAnalyser.current();
                    console.info(`[AuraSound] ✅ Now playing: "${track.title}" — mood: ${moodRef.current}`);
                })
                .catch(err => {
                    console.group('%c[AuraSound] 🔇 Autoplay Blocked', 'color:#facc15;font-weight:bold');
                    console.warn('Browser blocked autoplay before user interaction.');
                    console.info('Fix: Click the "SYNC AUDIO" button on screen to unlock.');
                    console.warn('Browser message:', err.message);
                    console.groupEnd();
                    setIsPlaying(false);
                });
        };

        // ② CRITICAL FIX: cross-fade if currently playing, else switch instantly
        if (audioElRef.current && !audioElRef.current.paused) {
            fadeTo.current(0, FADE_MS, doSwitch);
        } else {
            doSwitch();
        }
    };

    // ──────────────────────────────────────────────────────────
    //  unlockAudio — called by the Sync Audio button
    //  This is the ONLY place that sets unlockedRef = true.
    //  Because it's a ref write (not setState), no re-render
    //  occurs — the mood-watch effect fires cleanly.
    // ──────────────────────────────────────────────────────────
    const unlockAudio = useCallback(() => {
        const ctx = buildCtx();

        // Resume suspended AudioContext (browser autoplay policy)
        const resume = () => {
            if (ctx.state === 'suspended') return ctx.resume();
            return Promise.resolve();
        };

        resume().then(() => {
            console.log('[AuraSound] ✅ AudioContext unlocked');

            const audio = audioElRef.current;

            if (audio && !audio.paused) {
                // ── Toggle: currently playing → pause ──
                fadeTo.current(0, FADE_MS, () => {
                    audio.pause();
                    setIsPlaying(false);
                    cancelAnimationFrame(rafRef.current);
                    // Only reset volumeLevel state if it isn't already 0
                    if (lastVolumeLevelRef.current !== 0) {
                        lastVolumeLevelRef.current = 0;
                        setVolumeLevel(0);
                    }
                });
                return;
            }

            if (audio && audio.paused && activeUrlRef.current) {
                // ── Resume paused track ──
                audio.play()
                    .then(() => {
                        setIsPlaying(true);
                        fadeTo.current(MAX_VOL, FADE_MS);
                        startAnalyser.current();
                    })
                    .catch(err => console.warn('[AuraSound] Resume failed:', err));
                return;
            }

            // ③ CRITICAL FIX: nothing loaded yet — read mood from REF,
            //   not from the closure (which would be stale 'neutral').
            unlockedRef.current = true;
            const currentMood = moodRef.current || 'neutral';
            const track = pickTrackRef.current(currentMood);
            if (track) loadAndPlayRef.current(track);
        });
    }, [buildCtx]);

    // ──────────────────────────────────────────────────────────
    //  ④ MOOD WATCH — the reactive core
    //
    //  Dependency array: [mood] ONLY.
    //  No functions listed → no stale-closure risk.
    //  All fn calls go through stable .current refs.
    //
    //  Guard: only run if the user has unlocked audio AND the
    //  new mood actually differs from the active one (use a ref
    //  for the previous mood, NOT a state comparison).
    // ──────────────────────────────────────────────────────────
    const prevMoodRef = useRef(null);

    useEffect(() => {
        if (!mood) return;

        // Skip if audio hasn't been unlocked yet
        if (!unlockedRef.current) return;

        // Skip if mood string is identical to the one we already loaded
        if (mood === prevMoodRef.current) return;
        prevMoodRef.current = mood;

        // Pick a random track (excluding the currently playing URL)
        const track = pickTrackRef.current(mood);
        if (!track) return;

        loadAndPlayRef.current(track);
    }, [mood]); // ← ONLY [mood] in deps — this is intentional

    // ──────────────────────────────────────────────────────────
    //  CLEANUP on unmount
    // ──────────────────────────────────────────────────────────
    useEffect(() => {
        return () => {
            cancelAnimationFrame(rafRef.current);
            clearTimeout(fadeTimerRef.current);
            if (audioElRef.current) {
                audioElRef.current.onerror = null;
                audioElRef.current.pause();
            }
            ctxRef.current?.close().catch(() => {});
        };
    }, []);

    // ──────────────────────────────────────────────────────────
    //  PUBLIC API
    // ──────────────────────────────────────────────────────────
    return {
        unlockAudio,    // call from Sync Audio button → resumes AudioContext
        isPlaying,      // boolean
        currentTrack,   // { title, artist } | null — for Now Playing UI
        volumeLevel,    // 0–1 live bass energy → drives scale() Vibe Coding
    };
};