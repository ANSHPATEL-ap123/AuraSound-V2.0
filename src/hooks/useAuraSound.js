import { useEffect, useRef, useState, useCallback } from 'react';
import { MOOD_PLAYLISTS } from '../constants/MusicLibrary';

/**
 * ═══════════════════════════════════════════════════════════════════
 *  AuraSound Audio Engine  v9.0 — FINAL PRODUCTION STABLE
 * ═══════════════════════════════════════════════════════════════════
 */

const FADE_MS = 1000;
const MAX_VOL = 0.72;
const DEBOUNCE_MS = 1000;

export const useAuraSound = (mood) => {
    const [currentTrack, setCurrentTrack] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volumeLevel, setVolumeLevel] = useState(0);

    const ctxRef = useRef(null);
    const analyserRef = useRef(null);
    const gainRef = useRef(null);
    const audioElRef = useRef(null);
    const activeUrlRef = useRef(null);
    const unlockedRef = useRef(false);
    const moodRef = useRef(mood);
    const prevMoodRef = useRef(null);
    const debounceTimerRef = useRef(null);
    const isTransitioningRef = useRef(false);
    const rafRef = useRef(null);

    // Keep the mood Ref updated in real-time
    useEffect(() => { moodRef.current = mood; }, [mood]);

    const buildCtx = useCallback(() => {
        if (ctxRef.current) return ctxRef.current;
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        const gain = ctx.createGain();
        gain.gain.value = MAX_VOL;
        analyser.connect(gain);
        gain.connect(ctx.destination);
        ctxRef.current = ctx;
        analyserRef.current = analyser;
        gainRef.current = gain;
        return ctx;
    }, []);

    const startAnalyser = useCallback(() => {
        const tick = () => {
            if (!analyserRef.current) return;
            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < 10; i++) sum += dataArray[i];
            const newVolume = (sum / 10) / 255;
            setVolumeLevel(newVolume);
            rafRef.current = requestAnimationFrame(tick);
        };
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(tick);
    }, []);

    const fadeTo = (targetVol, durationMs, onDone) => {
        const gain = gainRef.current;
        if (!gain || !ctxRef.current) { onDone?.(); return; }
        const now = ctxRef.current.currentTime;
        gain.gain.cancelScheduledValues(now);
        gain.gain.linearRampToValueAtTime(targetVol, now + (durationMs / 1000));
        setTimeout(() => onDone?.(), durationMs + 50);
    };

    const loadAndPlay = (initialTrack) => {
        const ctx = buildCtx();
        if (ctx.state === 'suspended') ctx.resume();

        const doSwitch = () => {
            // SYNC-LOCK: Always grab the absolute LATEST mood before loading the file
            const actualMood = moodRef.current || 'neutral';
            const playlist = MOOD_PLAYLISTS[actualMood];
            const track = playlist ? playlist[0] : initialTrack;

            if (audioElRef.current) {
                audioElRef.current.pause();
                audioElRef.current.src = '';
            }

            const audio = new Audio();
            audio.src = track.url;
            audio.crossOrigin = 'anonymous';
            audioElRef.current = audio;

            const source = ctx.createMediaElementSource(audio);
            source.connect(analyserRef.current);

            gainRef.current.gain.setValueAtTime(0, ctx.currentTime);

            audio.play()
                .then(() => {
                    activeUrlRef.current = track.url;
                    setCurrentTrack({ title: track.title, artist: track.artist });
                    setIsPlaying(true);
                    startAnalyser();
                    fadeTo(MAX_VOL, FADE_MS, () => {
                        isTransitioningRef.current = false;
                    });
                })
                .catch(() => {
                    isTransitioningRef.current = false;
                });
        };

        if (audioElRef.current && !audioElRef.current.paused) {
            fadeTo(0, FADE_MS, doSwitch);
        } else {
            doSwitch();
        }
    };

    const unlockAudio = useCallback(() => {
        const ctx = buildCtx();
        ctx.resume().then(() => {
            unlockedRef.current = true;
            const track = MOOD_PLAYLISTS[moodRef.current || 'neutral'][0];
            if (track) loadAndPlay(track);
        });
    }, [buildCtx]);

    useEffect(() => {
        if (!mood || !unlockedRef.current || isTransitioningRef.current) return;
        if (mood === prevMoodRef.current) return;

        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
            isTransitioningRef.current = true;
            prevMoodRef.current = mood;
            const playlist = MOOD_PLAYLISTS[mood];
            if (playlist && playlist[0]) loadAndPlay(playlist[0]);
        }, DEBOUNCE_MS);

        return () => clearTimeout(debounceTimerRef.current);
    }, [mood]);

    useEffect(() => {
        return () => cancelAnimationFrame(rafRef.current);
    }, []);

    return { unlockAudio, isPlaying, currentTrack, volumeLevel };
};