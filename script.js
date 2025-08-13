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
        overlay.appendChild(card);
        document.body.appendChild(overlay);
        const dismiss = () => { if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay); };
        overlay.addEventListener('click', () => { onFirstGesture(); dismiss(); }, { once: true });
        const btn = card.querySelector('#enableSoundBtn');
        if (btn) btn.addEventListener('click', (e) => { e.stopPropagation(); onFirstGesture(); dismiss(); }, { once: true });
    }
}

// Event Listeners
function setupEventListeners() {
    // Translation functionality
    inputText.addEventListener('input', updateCharCount);
    inputText.addEventListener('input', debounce(handleInputChange, 500));
    translateBtn.addEventListener('click', performTranslation);
    swapBtn.addEventListener('click', swapLanguages);
    clearBtn.addEventListener('click', clearText);
    copyBtn.addEventListener('click', copyTranslation);
    speakBtn.addEventListener('click', speakTranslation);
    
    // Form handling
    contactForm.addEventListener('submit', handleContactForm);
    
    // Mobile menu
    hamburger.addEventListener('click', toggleMobileMenu);
    
    // Navigation
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // Scroll effects
    window.addEventListener('scroll', handleScroll);
}

// Translation Functions
function updateCharCount() {
    const count = inputText.value.length;
    charCount.textContent = `${count}/5000`;
    
    if (count > 4500) {
        charCount.style.color = '#ef4444';
    } else if (count > 4000) {
        charCount.style.color = '#f59e0b';
    } else {
        charCount.style.color = '#9ca3af';
    }
}

function handleInputChange() {
    const text = inputText.value.trim();
    if (text.length > 0) {
        translateBtn.classList.add('btn-primary');
        translateBtn.classList.remove('btn-outline');
    } else {
        translateBtn.classList.remove('btn-primary');
        translateBtn.classList.add('btn-outline');
    }
}

function performTranslation() {
    const text = inputText.value.trim();
    if (!text) {
        showNotification('Please enter text to translate', 'error');
        return;
    }
    
    // Show loading state
    translateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Translating...';
    translateBtn.disabled = true;
    outputText.classList.add('loading');
    
    // Simulate API call
    setTimeout(() => {
        const fromLangCode = fromLang.value;
        const toLangCode = toLang.value;
        const translationKey = `${fromLangCode}-${toLangCode}`;
        
        let translatedText = '';
        
        // Check if we have a direct translation
        if (translations[translationKey] && translations[translationKey][text]) {
            translatedText = translations[translationKey][text];
        } else {
            // Simulate translation with some common patterns
            translatedText = simulateTranslation(text, fromLangCode, toLangCode);
        }
        
        // Update output
        outputText.innerHTML = `<p>${translatedText}</p>`;
        outputText.classList.remove('loading');
        
        // Reset button
        translateBtn.innerHTML = '<i class="fas fa-language"></i> Translate';
        translateBtn.disabled = false;
        
        // Show success notification
        showNotification('Translation completed successfully!', 'success');
        
        // Enable copy and speak buttons
        copyBtn.disabled = false;
        speakBtn.disabled = false;
        
    }, 1500);
}

function simulateTranslation(text, fromLang, toLang) {
    // Simple simulation of translation
    const commonTranslations = {
        'ru-en': {
            'привет': 'hello',
            'спасибо': 'thank you',
            'пожалуйста': 'please',
            'да': 'yes',
            'нет': 'no',
            'хорошо': 'good',
            'плохо': 'bad'
        },
        'en-ru': {
            'hello': 'привет',
            'thank you': 'спасибо',
            'please': 'пожалуйста',
            'yes': 'да',
            'no': 'нет',
            'good': 'хорошо',
            'bad': 'плохо'
        }
    };
    
    const translationKey = `${fromLang}-${toLang}`;
    const translations = commonTranslations[translationKey] || {};
    
    let result = text.toLowerCase();
    
    // Replace common words
    Object.keys(translations).forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        result = result.replace(regex, translations[word]);
    });
    
    // Capitalize first letter
    result = result.charAt(0).toUpperCase() + result.slice(1);
    
    return result || `[Translation: ${text}]`;
}

function swapLanguages() {
    const tempLang = fromLang.value;
    fromLang.value = toLang.value;
    toLang.value = tempLang;
    
    // Swap text if there's content
    if (inputText.value.trim() && outputText.innerHTML !== '<p class="placeholder">The translation will appear here</p>') {
        const tempText = inputText.value;
        inputText.value = outputText.textContent;
        outputText.innerHTML = `<p>${tempText}</p>`;
    }
    
    // Animate swap button
    swapBtn.style.transform = 'rotate(180deg)';
    setTimeout(() => {
        swapBtn.style.transform = 'rotate(0deg)';
    }, 300);
}

function clearText() {
    inputText.value = '';
    outputText.innerHTML = '<p class="placeholder">The translation will appear here</p>';
    updateCharCount();
    handleInputChange();
    
    // Disable buttons
    copyBtn.disabled = true;
    speakBtn.disabled = true;
}

function copyTranslation() {
    const text = outputText.textContent;
    if (text && text !== 'The translation will appear here') {
        navigator.clipboard.writeText(text).then(() => {
            showNotification('Translation copied to clipboard!', 'success');
        }).catch(() => {
            showNotification('Failed to copy text', 'error');
        });
    }
}

function speakTranslation() {
    const text = outputText.textContent;
    if (text && text !== 'The translation will appear here') {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = toLang.value;
        speechSynthesis.speak(utterance);
        showNotification('Playing translation...', 'info');
    }
}

// Form Handling
async function handleContactForm(e) {
    e.preventDefault();
    
    const formDataHtml = new FormData(contactForm);
    const data = {
        name: formDataHtml.get('name') || document.getElementById('name').value,
        email: formDataHtml.get('email') || document.getElementById('email').value,
        subject: formDataHtml.get('subject') || document.getElementById('subject').value,
        message: formDataHtml.get('message') || document.getElementById('message').value
    };
    
    // Validate form
    if (!data.name || !data.email || !data.subject || !data.message) {
        showNotification('Please fill in all fields', 'error');
        return;
    }
    
    if (!isValidEmail(data.email)) {
        showNotification('Please enter a valid email', 'error');
        return;
    }
    
    // Show loading state
    const submitBtn = contactForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    submitBtn.disabled = true;
    
    // Open WhatsApp in new tab
    const waText = encodeURIComponent(`New request from the site:%0AName: ${data.name}%0AEmail: ${data.email}%0ASubject: ${data.subject}%0AMessage: ${data.message}`);
    const waLink = `https://wa.me/79991251025?text=${waText}`;
    window.open(waLink, '_blank');

    // Send email via FormSubmit (AJAX endpoint)
    try {
        const emailFormData = new FormData();
        emailFormData.append('name', data.name);
        emailFormData.append('email', data.email);
        emailFormData.append('subject', data.subject);
        emailFormData.append('message', data.message);
        emailFormData.append('_subject', 'запрос с сайта');
        emailFormData.append('_template', 'table');
        emailFormData.append('_replyto', data.email);
        // append attachments if any
        const fileInput = document.getElementById('attachment');
        if (fileInput && fileInput.files && fileInput.files.length) {
            Array.from(fileInput.files).forEach((file, idx) => {
                emailFormData.append(`attachments`, file, file.name);
            });
        }

        const endpoint = 'https://formsubmit.co/ajax/' + encodeURIComponent('mailtomorrow@yandex.com');
        const response = await fetch(endpoint, {
            method: 'POST',
            body: emailFormData,
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            throw new Error('Email sending failed');
        }

        showNotification('Message sent! We will contact you shortly.', 'success');
        contactForm.reset();
    } catch (err) {
        showNotification('Could not send email. Please try again later.', 'error');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// Utility Functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas ${getNotificationIcon(type)}"></i>
            <span>${message}</span>
            <button class="notification-close">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${getNotificationColor(type)};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        transform: translateX(100%);
        transition: transform 0.3s ease;
        max-width: 400px;
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        removeNotification(notification);
    }, 5000);
    
    // Close button functionality
    notification.querySelector('.notification-close').addEventListener('click', () => {
        removeNotification(notification);
    });
}

function removeNotification(notification) {
    notification.style.transform = 'translateX(100%)';
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 300);
}

function getNotificationIcon(type) {
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    return icons[type] || icons.info;
}

function getNotificationColor(type) {
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6'
    };
    return colors[type] || colors.info;
}

// Mobile Menu
function toggleMobileMenu() {
    navMenu.classList.toggle('active');
    hamburger.classList.toggle('active');
}

// Scroll Effects
function handleScroll() {
    const header = document.querySelector('.header');
    if (window.scrollY > 100) {
        header.style.background = 'rgba(255, 255, 255, 0.9)';
        header.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.08)';
        header.style.backdropFilter = 'blur(8px)';
    } else {
        header.style.background = 'transparent';
        header.style.boxShadow = 'none';
        header.style.backdropFilter = 'none';
    }
}

// Smooth Scrolling
function setupSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const headerHeight = document.querySelector('.header').offsetHeight;
                const targetPosition = target.offsetTop - headerHeight;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Animations
function setupAnimations() {
    // Intersection Observer for fade-in animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observe elements for animation
    document.querySelectorAll('.feature-card, .pricing-card, .language-category').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
}

// Statistics Counter Animation
function animateCounters() {
    const counters = document.querySelectorAll('.stat-number');
    
    counters.forEach(counter => {
        const target = parseInt(counter.textContent.replace(/\D/g, ''));
        const increment = target / 100;
        let current = 0;
        
        const updateCounter = () => {
            if (current < target) {
                current += increment;
                counter.textContent = Math.ceil(current) + (counter.textContent.includes('+') ? '+' : '') + 
                                    (counter.textContent.includes('%') ? '%' : '');
                requestAnimationFrame(updateCounter);
            } else {
                counter.textContent = counter.textContent.replace(/\d+/, target);
            }
        };
        
        updateCounter();
    });
}

// Initialize counter animation when hero section is visible
const heroObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            animateCounters();
            heroObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

const heroSection = document.querySelector('.hero');
if (heroSection) {
    heroObserver.observe(heroSection);
}

// Add CSS for mobile menu
const mobileMenuStyles = `
    @media (max-width: 768px) {
        .nav-menu {
            position: fixed;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            flex-direction: column;
            padding: 2rem;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            transform: translateY(-100%);
            opacity: 0;
            visibility: hidden;
            transition: all 0.3s ease;
        }
        
        .nav-menu.active {
            transform: translateY(0);
            opacity: 1;
            visibility: visible;
        }
        
        .hamburger.active span:nth-child(1) {
            transform: rotate(45deg) translate(5px, 5px);
        }
        
        .hamburger.active span:nth-child(2) {
            opacity: 0;
        }
        
        .hamburger.active span:nth-child(3) {
            transform: rotate(-45deg) translate(7px, -6px);
        }
    }
`;

// Add styles to head
const styleSheet = document.createElement('style');
styleSheet.textContent = mobileMenuStyles;
document.head.appendChild(styleSheet);

// Export functions for potential use
window.TranslationApp = {
    performTranslation,
    swapLanguages,
    clearText,
    copyTranslation,
    speakTranslation,
    showNotification
};

// Music Player Functionality
class MusicPlayer {
    constructor() {
        this.audio = new Audio();
        this.isPlaying = false;
        this.currentTrack = 0;
        this.volume = 0.5;
        
        // Music generators for different types of music
        this.musicGenerators = {
            relaxing: null,
            motivational: null,
            focus: null
        };
        
        // Playlist with generated music
        this.playlist = [
            {
                title: 'Расслабляющая музыка',
                artist: 'Фоновая музыка',
                type: 'relaxing'
            },
            {
                title: 'Мотивационная музыка',
                artist: 'Энергичная музыка',
                type: 'motivational'
            },
            {
                title: 'Концентрация',
                artist: 'Спокойная музыка',
                type: 'focus'
            }
        ];
        
        this.initializePlayer();
        this.setupEventListeners();
    }
    
    async initializePlayer() {
        // Initialize music generators
        this.musicGenerators.relaxing = new RelaxingMusicGenerator();
        this.musicGenerators.motivational = new MotivationalMusicGenerator();
        this.musicGenerators.focus = new FocusMusicGenerator();
        
        // Initialize all generators
        await Promise.all([
            this.musicGenerators.relaxing.initialize(),
            this.musicGenerators.motivational.initialize(),
            this.musicGenerators.focus.initialize()
        ]);
        
        this.loadTrack(this.currentTrack);
    }
    
    setupEventListeners() {
        // Music player toggle
        const musicToggle = document.getElementById('musicToggle');
        const musicPanel = document.getElementById('musicPanel');
        const musicClose = document.getElementById('musicClose');
        
        musicToggle.addEventListener('click', () => {
            musicPanel.classList.toggle('show');
        });
        
        musicClose.addEventListener('click', () => {
            musicPanel.classList.remove('show');
        });
        
        // Play/Pause button
        const playBtn = document.getElementById('playBtn');
        playBtn.addEventListener('click', () => this.togglePlay());
        
        // Previous/Next buttons
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        
        prevBtn.addEventListener('click', () => this.previousTrack());
        nextBtn.addEventListener('click', () => this.nextTrack());
        
        // Volume control
        const volumeSlider = document.getElementById('volumeSlider');
        volumeSlider.addEventListener('input', (e) => {
            this.volume = e.target.value / 100;
            // Update volume for all generators
            Object.values(this.musicGenerators).forEach(generator => {
                if (generator) {
                    generator.setVolume(this.volume);
                }
            });
        });
        
        // Playlist items
        const playlistItems = document.querySelectorAll('.playlist-item');
        playlistItems.forEach((item, index) => {
            item.addEventListener('click', () => {
                this.loadTrack(index);
                this.play();
            });
        });
        
        // Set initial volume for all generators
        Object.values(this.musicGenerators).forEach(generator => {
            if (generator) {
                generator.setVolume(this.volume);
            }
        });
    }
    
    loadTrack(index) {
        this.currentTrack = index;
        this.updateTrackInfo();
        this.updatePlaylistActive();
    }
    
    updateTrackInfo() {
        const track = this.playlist[this.currentTrack];
        document.getElementById('musicTitle').textContent = track.title;
        document.getElementById('musicArtist').textContent = track.artist;
    }
    
    updatePlaylistActive() {
        document.querySelectorAll('.playlist-item').forEach((item, index) => {
            item.classList.toggle('active', index === this.currentTrack);
        });
    }
    
    togglePlay() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }
    
    play() {
        const currentTrack = this.playlist[this.currentTrack];
        const generator = this.musicGenerators[currentTrack.type];
        
        if (generator) {
            generator.play();
            this.isPlaying = true;
            this.updatePlayButton();
            this.updateToggleButton();
        } else {
            showNotification('Failed to play audio. Please try again.', 'error');
        }
    }
    
    pause() {
        const currentTrack = this.playlist[this.currentTrack];
        const generator = this.musicGenerators[currentTrack.type];
        
        if (generator) {
            generator.stop();
        }
        
        this.isPlaying = false;
        this.updatePlayButton();
        this.updateToggleButton();
    }
    
    previousTrack() {
        // Stop current track
        if (this.isPlaying) {
            const currentTrack = this.playlist[this.currentTrack];
            const generator = this.musicGenerators[currentTrack.type];
            if (generator) generator.stop();
        }
        
        this.currentTrack = (this.currentTrack - 1 + this.playlist.length) % this.playlist.length;
        this.loadTrack(this.currentTrack);
        if (this.isPlaying) this.play();
    }
    
    nextTrack() {
        // Stop current track
        if (this.isPlaying) {
            const currentTrack = this.playlist[this.currentTrack];
            const generator = this.musicGenerators[currentTrack.type];
            if (generator) generator.stop();
        }
        
        this.currentTrack = (this.currentTrack + 1) % this.playlist.length;
        this.loadTrack(this.currentTrack);
        if (this.isPlaying) this.play();
    }
    
    updatePlayButton() {
        const playBtn = document.getElementById('playBtn');
        const icon = playBtn.querySelector('i');
        
        if (this.isPlaying) {
            icon.className = 'fas fa-pause';
            playBtn.classList.add('playing');
        } else {
            icon.className = 'fas fa-play';
            playBtn.classList.remove('playing');
        }
    }
    
    updateToggleButton() {
        const toggle = document.getElementById('musicToggle');
        if (this.isPlaying) {
            toggle.classList.add('playing');
        } else {
            toggle.classList.remove('playing');
        }
    }
    
    // For generated music, we don't need progress tracking
    // as it's continuous background music
}

// Initialize music player when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    const musicPlayer = new MusicPlayer();
    await musicPlayer.initializePlayer();
});
