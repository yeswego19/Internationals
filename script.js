// DOM Elements
const inputText = document.getElementById('inputText');
const outputText = document.getElementById('outputText');
const fromLang = document.getElementById('fromLang');
const toLang = document.getElementById('toLang');
const translateBtn = document.getElementById('translateBtn');
const swapBtn = document.getElementById('swapBtn');
const clearBtn = document.getElementById('clearBtn');
const copyBtn = document.getElementById('copyBtn');
const speakBtn = document.getElementById('speakBtn');
const charCount = document.querySelector('.char-count');
const contactForm = document.getElementById('contactForm');
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');



// Scroll to translator function
function scrollToTranslator() {
    const translatorSection = document.querySelector('.translation-tool');
    if (translatorSection) {
        translatorSection.scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
        });
    }
}

// Translation data (simulated)
const translations = {
    'ru-en': {
        'Привет! Как дела?': 'Hello! How are you?',
        'Спасибо': 'Thank you',
        'Пожалуйста': 'Please',
        'Добро пожаловать': 'Welcome',
        'До свидания': 'Goodbye'
    },
    'en-ru': {
        'Hello! How are you?': 'Привет! Как дела?',
        'Thank you': 'Спасибо',
        'Please': 'Пожалуйста',
        'Welcome': 'Добро пожаловать',
        'Goodbye': 'До свидания'
    }
};

// Language mappings
const languageMap = {
    'ru': 'Русский',
    'en': 'English',
    'es': 'Español',
    'fr': 'Français',
    'de': 'Deutsch',
    'it': 'Italiano',
    'pt': 'Português',
    'ja': '日本語',
    'ko': '한국어',
    'zh': '中文'
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupIntroJingle();
    // Fallback for WeChat QR
    window.handleWeChatQRError = function() {
        const img = document.getElementById('wechatQR');
        if (img && img.src.indexOf('wechat-qr.png') === -1) {
            // try png as fallback
            img.src = 'assets/wechat-qr.png';
            img.onerror = () => {
                const fb = document.getElementById('wechatFallback');
                if (fb) fb.style.display = 'block';
            };
        } else {
            const fb = document.getElementById('wechatFallback');
            if (fb) fb.style.display = 'block';
        }
    };
});

function initializeApp() {
    setupEventListeners();
    setupSmoothScrolling();
    setupAnimations();
    updateCharCount();
}

// Setup and play a short jingle once per browser respecting autoplay policies
function setupIntroJingle() {
    const key = 'intro_jingle_v2';
    const urlForcing = new URLSearchParams(window.location.search).get('jingle') === '1';
    if (localStorage.getItem(key) && !urlForcing) return;

    const startJingle = async () => {
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            const ctx = new AudioContextClass();
            if (ctx.state === 'suspended') {
                await ctx.resume();
            }
            // Seven Nation Army riff — typewriter sound
            const baseRiff = [
                { freq: 164.81, dur: 0.48 }, // E3
                { freq: 164.81, dur: 0.48 }, // E3  
                { freq: 196.00, dur: 0.48 }, // G3
                { freq: 164.81, dur: 0.48 }, // E3
                { freq: 146.83, dur: 0.48 }, // D3
                { freq: 130.81, dur: 0.48 }, // C3
                { freq: 123.47, dur: 0.70 }, // B2
                { freq: 164.81, dur: 0.48 }, // E3
                { freq: 164.81, dur: 0.48 }, // E3
                { freq: 196.00, dur: 0.48 }, // G3
                { freq: 164.81, dur: 0.48 }, // E3
                { freq: 146.83, dur: 0.48 }, // D3
                { freq: 130.81, dur: 0.48 }, // C3
                { freq: 146.83, dur: 0.48 }, // D3
                { freq: 130.81, dur: 0.48 }, // C3
                { freq: 123.47, dur: 0.90 }  // B2
            ];

            const speed = 1.25;
            const targetTotal = 13.0;
            const riff = baseRiff.map(n => ({ freq: n.freq, dur: n.dur / speed }));
            const oneLoopDur = riff.reduce((s, n) => s + n.dur, 0) + 0.05 * riff.length;
            const repeats = Math.max(1, Math.ceil(targetTotal / oneLoopDur));

            const now = ctx.currentTime;

            // Typewriter sound chain
            const master = ctx.createGain();
            master.gain.value = 0.35;
            master.connect(ctx.destination);

            // Mechanical click filter
            const clickFilter = ctx.createBiquadFilter();
            clickFilter.type = 'bandpass';
            clickFilter.frequency.value = 800;
            clickFilter.Q.value = 8;

            // Paper rustle simulation
            const rustleFilter = ctx.createBiquadFilter();
            rustleFilter.type = 'highpass';
            rustleFilter.frequency.value = 2000;
            rustleFilter.Q.value = 2;

            // Bell ring simulation
            const bellFilter = ctx.createBiquadFilter();
            bellFilter.type = 'bandpass';
            bellFilter.frequency.value = 1200;
            bellFilter.Q.value = 12;

            let t = now;
            for (let r = 0; r < repeats; r++) {
                riff.forEach((step, index) => {
                    // Main key click
                    const click = ctx.createOscillator();
                    const clickGain = ctx.createGain();
                    click.type = 'square';
                    click.frequency.value = step.freq * 4; // higher harmonics
                    clickGain.gain.setValueAtTime(0, t);
                    clickGain.gain.linearRampToValueAtTime(0.4, t + 0.001);
                    clickGain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
                    click.connect(clickGain).connect(clickFilter).connect(master);
                    click.start(t);
                    click.stop(t + 0.05);

                    // Paper rustle
                    const rustle = ctx.createOscillator();
                    const rustleGain = ctx.createGain();
                    rustle.type = 'sawtooth';
                    rustle.frequency.value = 3000 + Math.random() * 2000;
                    rustleGain.gain.setValueAtTime(0, t);
                    rustleGain.gain.linearRampToValueAtTime(0.15, t + 0.002);
                    rustleGain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
                    rustle.connect(rustleGain).connect(rustleFilter).connect(master);
                    rustle.start(t + 0.01);
                    rustle.stop(t + 0.08);

                    // Bell ring (every 7th note)
                    if (index % 7 === 6) {
                        const bell = ctx.createOscillator();
                        const bellGain = ctx.createGain();
                        bell.type = 'sine';
                        bell.frequency.value = 800;
                        bellGain.gain.setValueAtTime(0, t);
                        bellGain.gain.linearRampToValueAtTime(0.3, t + 0.01);
                        bellGain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
                        bell.connect(bellGain).connect(bellFilter).connect(master);
                        bell.start(t + 0.02);
                        bell.stop(t + 0.3);
                    }

                    // Carriage return sound (end of each loop)
                    if (index === riff.length - 1) {
                        const carriage = ctx.createOscillator();
                        const carriageGain = ctx.createGain();
                        carriage.type = 'sawtooth';
                        carriage.frequency.value = 150;
                        carriageGain.gain.setValueAtTime(0, t + step.dur);
                        carriageGain.gain.linearRampToValueAtTime(0.25, t + step.dur + 0.01);
                        carriageGain.gain.exponentialRampToValueAtTime(0.01, t + step.dur + 0.2);
                        carriage.connect(carriageGain).connect(master);
                        carriage.start(t + step.dur);
                        carriage.stop(t + step.dur + 0.2);
                    }

                    // Carriage return sound (end of each loop)
                    t += step.dur + 0.05;
                });
            }
            localStorage.setItem(key, '1');
            if (typeof showNotification === 'function') {
                showNotification('Playing intro jingle...', 'info');
            }
            removeUserGestures();
        } catch (_) { /* ignore */ }
    };

    // Many browsers block autoplay until user interaction → attach one‑time listeners
    const userGestures = ['click', 'touchstart', 'keydown', 'scroll'];
    const onFirstGesture = () => startJingle();
    function removeUserGestures() {
        userGestures.forEach(evt => document.removeEventListener(evt, onFirstGesture));
    }
    userGestures.forEach(evt => document.addEventListener(evt, onFirstGesture, { once: true }));

    // If forced via URL, start immediately after a short delay (still requires user gesture in some browsers)
    if (urlForcing) {
        setTimeout(() => {
            onFirstGesture();
        }, 200);
    }

    // Visual prompt to enable sound (works well on iOS/Android)
    if (!localStorage.getItem(key)) {
        const overlay = document.createElement('div');
        overlay.id = 'soundOverlay';
        overlay.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 99999;
            display: flex; align-items: center; justify-content: center; backdrop-filter: blur(2px);
        `;
        const card = document.createElement('div');
        card.style.cssText = `background: #fff; padding: 16px 20px; border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,.2); text-align: center; font-family: inherit;`;
        card.innerHTML = `
            <div style="font-weight:700; margin-bottom:8px; color:#111827;">Enable sound</div>
            <div style="font-size:14px; color:#6b7280; margin-bottom:12px;">Tap anywhere to play the intro tune once.</div>
            <button id="enableSoundBtn" style="background:#1f4ba5;color:#fff;border:none;border-radius:8px;padding:10px 16px;cursor:pointer;">Play</button>
        `;