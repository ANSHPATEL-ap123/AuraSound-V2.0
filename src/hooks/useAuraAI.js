import { useEffect, useState, useCallback } from 'react';
import * as faceapi from 'face-api.js';

// ─────────────────────────────────────────────────────────────
//  AuraAI Mood Detection Hook  v2.0
//
//  Custom "Low" mood:
//    Activates when face-api detects BOTH sad ≥ 0.30 AND
//    neutral ≥ 0.30, signalling a suppressed / introspective state.
//    This overrides the simple "highest confidence wins" rule.
// ─────────────────────────────────────────────────────────────

const LOW_MOOD_THRESHOLD = 0.30; // minimum score each expression needs

// Maps face-api expression names → our mood keys
const EXPRESSION_TO_MOOD = {
    happy:    'happy',
    sad:      'sad',
    angry:    'angry',
    fearful:  'angry',   // treat fear as angry-adjacent
    disgusted:'angry',
    surprised:'surprised',
    neutral:  'neutral',
};

// Setup detector options once (re-use across detections)
const detectorOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });

export const useAuraAI = (videoRef) => {
    const [mood, setMood]               = useState('neutral');
    const [isModelLoaded, setIsModelLoaded] = useState(false);
    const [expressions, setExpressions] = useState({});   // raw scores for debug

    // ── Load face-api.js models ────────────────────────────────
    useEffect(() => {
        const loadModels = async () => {
            try {
                const MODEL_URL = window.location.origin + '/ai_weights';
                console.log('[AuraAI] Loading models from', MODEL_URL);

                await Promise.all([
                    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                    faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
                ]);

                setIsModelLoaded(true);
                console.log('[AuraAI] ✅ Models ready.');
            } catch (err) {
                console.error('[AuraAI] ❌ Model load failed:', err);
            }
        };
        loadModels();
    }, []);

    // ── Core detection with custom "Low" logic ─────────────────
    const detectMood = useCallback(async () => {
        if (!videoRef.current || !isModelLoaded) return;
        if (videoRef.current.readyState < 2)    return;  // HAVE_CURRENT_DATA

        try {
            const detection = await faceapi
                .detectSingleFace(videoRef.current, detectorOptions)
                .withFaceExpressions();

            if (!detection?.expressions) return;

            const expr = detection.expressions;
            setExpressions(expr);

            // ── Custom "Low" mood override ─────────────────────
            //    If the person looks both sad AND zoned-out neutral,
            //    they're likely in a low, introspective state.
            if (expr.sad >= LOW_MOOD_THRESHOLD && expr.neutral >= LOW_MOOD_THRESHOLD) {
                setMood('low');
                return;
            }

            // ── Standard: highest confidence expression ────────
            const topExpression = Object.entries(expr).reduce(
                (best, [name, score]) => (score > best[1] ? [name, score] : best),
                ['neutral', 0]
            )[0];

            const mappedMood = EXPRESSION_TO_MOOD[topExpression] || 'neutral';
            setMood(mappedMood);

        } catch (err) {
            // Silently swallow transient detection errors (frames dropped etc.)
            console.debug('[AuraAI] Detection frame skip:', err?.message);
        }
    }, [videoRef, isModelLoaded]);

    return {
        mood,
        detectMood,
        isModelLoaded,
        expressions,   // expose raw scores for future debug overlay
    };
};