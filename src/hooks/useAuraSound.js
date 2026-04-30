import { useEffect, useRef, useState, useCallback } from 'react';
import { MOOD_PLAYLISTS } from '../constants/MusicLibrary';

/**
 * ═══════════════════════════════════════════════════════════════════
 *  AuraSound Audio Engine  v7.0 — EMERGENCY LAUNCH VERSION
 * ═══════════════════════════════════════════════════════════════════
 */

const FADE_MS     = 1000;
const MAX_VOL     = 0.72;
const DEBOUNCE_MS = 1000; // Increased for deployment stability

export const useAuraSound = (mood) => {
    const [currentTrack, setCurrentTrack] = useState(null);
    const [isPlaying,    setIsPlaying]    = useState(false);
    const [volumeLevel,  setVolumeLevel]  = useState(0);

    const ctxRef         = useRef(null);
    const analyserRef    = useRef(null);
    const gainRef        = useRef(null);
    const audioElRef     = useRef(null);
    const activeUrlRef   = useRef(null);
    const unlockedRef    = useRef(false);
    const moodRef        = useRef(mood);
    const prevMoodRef    = useRef(null);
    const debounceTimerRef = useRef(null);
    const isTransitioningRef = useRef(false);

    useEffect(() => { moodRef.current = mood; }, [mood]);

    const buildCtx = useCallback(() => {
        if (ctxRef.current) return ctxRef.current;
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = ctx.createAnalyser();
        const gain = ctx.createGain();
        gain.gain.value = MAX_VOL;
        analyser.connect(gain);
        gain.connect(ctx.destination);
        ctxRef.current = ctx;
        analyserRef.current = analyser;
        gainRef.current = gain;
        return ctx;
    }, []);

    const fadeTo = (targetVol, durationMs, onDone) => {
        const gain = gainRef.current;
        if (!gain || !ctxRef.current) { onDone?.(); return; }
        const now = ctxRef.current.currentTime;
        gain.gain.cancelScheduledValues(now);
        gain.gain.linearRampToValueAtTime(targetVol, now + (durationMs / 1000));
        setTimeout(() => onDone?.(), durationMs + 50);
    };

    const loadAndPlay = (track) => {
        const ctx = buildCtx();
        if (ctx.state === 'suspended') ctx.resume();

        const doSwitch = () => {
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
                    fadeTo(MAX_VOL, FADE_MS, () => {
                        isTransitioningRef.current = false; // UNLOCK
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
            isTransitioningRef.current = true; // LOCK
            prevMoodRef.current = mood;
            const playlist = MOOD_PLAYLISTS[mood];
            if (playlist && playlist[0]) loadAndPlay(playlist[0]);
        }, DEBOUNCE_MS);

        return () => clearTimeout(debounceTimerRef.current);
    }, [mood]);

    return { unlockAudio, isPlaying, currentTrack, volumeLevel };
};