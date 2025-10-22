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
        this.volume = 0.3; // Уменьшили громкость по умолчанию
        
        // Playlist with MP3 file
        this.playlist = [
            {
                title: 'Seven Nation Army',
                artist: 'Calli Malpas',
                type: 'mp3',
                src: 'audio/Calli Malpas - Seven Nation Army.mp3'
            }
        ];
        
        this.initializePlayer();
        this.setupEventListeners();
    }
    
    async initializePlayer() {
        // Load the MP3 file
        this.audio.src = this.playlist[0].src;
        this.audio.volume = this.volume;
        this.audio.loop = true; // Зацикливаем трек
        
        this.loadTrack(this.currentTrack);
    }
    
    setupEventListeners() {
        // Music player toggle
        const musicToggle = document.getElementById('musicToggle');
        const musicPanel = document.getElementById('musicPanel');
        const musicClose = document.getElementById('musicClose');
        
        musicToggle.addEventListener('click', () => {
            // Переключаем панель и играем музыку
            musicPanel.classList.toggle('show');
            this.togglePlay();
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
            this.audio.volume = this.volume;
        });
        
        // Playlist items
        const playlistItems = document.querySelectorAll('.playlist-item');
        playlistItems.forEach((item, index) => {
            item.addEventListener('click', () => {
                this.loadTrack(index);
                this.play();
            });
        });
        
        // Set initial volume
        this.audio.volume = this.volume;
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
        // Всегда начинаем играть заново при нажатии
        this.play();
    }
    
    play() {
        try {
            // Останавливаем предыдущую музыку если играет
            if (this.isPlaying) {
                this.audio.pause();
                this.audio.currentTime = 0;
            }
            
            // Загружаем и играем MP3 файл
            this.audio.load();
            this.audio.play().then(() => {
                this.isPlaying = true;
                this.updatePlayButton();
                this.updateToggleButton();
            }).catch(error => {
                console.error('Error playing audio:', error);
                showNotification('Failed to play audio. Please try again.', 'error');
            });
        } catch (error) {
            console.error('Error playing audio:', error);
            showNotification('Failed to play audio. Please try again.', 'error');
        }
    }
    
    pause() {
        this.audio.pause();
        this.isPlaying = false;
        this.updatePlayButton();
        this.updateToggleButton();
    }
    
    stop() {
        this.audio.pause();
        this.audio.currentTime = 0;
        this.isPlaying = false;
        this.updatePlayButton();
        this.updateToggleButton();
    }
    
    previousTrack() {
        // Restart current track
        if (this.isPlaying) {
            this.audio.currentTime = 0;
        }
    }
    
    nextTrack() {
        // Restart current track
        if (this.isPlaying) {
            this.audio.currentTime = 0;
        }
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
    
    // MP3 file will loop automatically
}

// Initialize music player when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    const musicPlayer = new MusicPlayer();
    await musicPlayer.initializePlayer();
    window.MusicPlayerRef = musicPlayer;
});
