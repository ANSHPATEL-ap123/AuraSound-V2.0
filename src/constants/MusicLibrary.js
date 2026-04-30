/**
 * ════════════════════════════════════════════════════════════
 *  AuraSound — Central Music Library  (v5 — Local / Fail-Proof)
 * ════════════════════════════════════════════════════════════
 *
 *  All URLs use LOCAL relative paths served from /public/music/.
 *  This completely eliminates 403 / CORS errors.
 *
 *  ┌─ HOW TO ADD YOUR MP3 FILES ─────────────────────────────┐
 *  │  Drop your .mp3 files into:  public/music/              │
 *  │  The filenames must EXACTLY match the `url` values below.│
 *  └──────────────────────────────────────────────────────────┘
 *
 *  Required files:
 *    public/music/happy.mp3
 *    public/music/happy2.mp3
 *    public/music/happy3.mp3
 *    public/music/sad.mp3
 *    public/music/sad2.mp3
 *    public/music/sad3.mp3
 *    public/music/neutral.mp3
 *    public/music/neutral2.mp3
 *    public/music/angry.mp3
 *    public/music/angry2.mp3
 *    public/music/low.mp3
 *    public/music/low2.mp3
 *    public/music/surprised.mp3
 * ════════════════════════════════════════════════════════════
 */

export const MOOD_PLAYLISTS = {

    // ── HAPPY ── Bollywood / Pritam style
    happy: [
        {
            title: "Subhanallah",
            artist: "Pritam",
            url: "/music/happy.mp3"
        },
        {
            title: "Mauja Hi Mauja",
            artist: "Pritam",
            url: "/music/happy2.mp3"
        },
        {
            title: "Ilahi",
            artist: "Pritam",
            url: "/music/happy3.mp3"
        }
    ],

    // ── SAD ── Emotional / Arijit Singh style
    sad: [
        {
            title: "Channa Mereya",
            artist: "Arijit Singh",
            url: "/music/sad.mp3"
        },
        {
            title: "Tum Hi Ho",
            artist: "Arijit Singh",
            url: "/music/sad2.mp3"
        },
        {
            title: "Phir Bhi Tumko Chaahunga",
            artist: "Arijit Singh",
            url: "/music/sad3.mp3"
        }
    ],

    // ── NEUTRAL ── Indie / The Local Train style
    neutral: [
        {
            title: "Dil Mere",
            artist: "The Local Train",
            url: "/music/neutral.mp3"
        },
        {
            title: "Dil Mere",
            artist: "The Local Train",
            url: "/music/neutral2.mp3"
        }
    ],

    // ── ANGRY ── Dark Phonk style
    angry: [
        {
            title: "Murder In My Mind",
            artist: "Phonk",
            url: "/music/angry.mp3"
        },
        {
            title: "Phonk Drive",
            artist: "Phonk",
            url: "/music/angry2.mp3"
        }
    ],

    // ── LOW ── Devotional / God songs
    //   Auto-triggered when AI detects sad + neutral together
    low: [
        {
            title: "Jai Kal Mahakal",
            artist: "Devotional",
            url: "/music/low.mp3"
        },
        {
            title: "Arambh Hai Prachand",
            artist: "Devotional",
            url: "/music/low2.mp3"
        }
    ],

    // ── SURPRISED ── Space-travel meme energy / Bag Raiders
    //   Bright Silver + Electric Blue aura. Particles at 2.5× speed.
    surprised: [
        {
            title: "Shooting Stars",
            artist: "Bag Raiders",
            url: "/music/surprised.mp3"
        }
    ]
};
