// ===================
// DOM Elements
// ===================
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

// ===================
// Audio Elements
// ===================
const audio = document.getElementById('bgMusic');
const musicToggle = document.getElementById('musicToggle');
const volumeSlider = document.getElementById('volumeSlider');

// ===================
// Audio setup
// ===================
if (audio) audio.volume = 0.4; // стартовая громкость 40%

function updateMusicIcon() {
  if (!audio || !musicToggle) return;
  musicToggle.innerHTML = audio.paused ? '<i class="fas fa-music"></i>' : '<i class="fas fa-pause"></i>';
}

if (musicToggle) {
  musicToggle.addEventListener('click', () => {
    if (!audio) return;
    if (audio.paused) {
      audio.play().then(updateMusicIcon).catch(err => {
        console.error('Audio play blocked:', err);
        alert('Для воспроизведения музыки кликните по кнопке ещё раз.');
      });
    } else {
      audio.pause();
      updateMusicIcon();
    }
  });
}

if (volumeSlider && audio) {
  volumeSlider.addEventListener('input', e => {
    audio.volume = e.target.value / 100;
  });
}

if (audio) {
  audio.addEventListener('ended', updateMusicIcon);
}

// ===================
// Scroll to translator
// ===================
function scrollToTranslator() {
  const translatorSection = document.querySelector('.translation-tool');
  if (translatorSection) translatorSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ===================
// Translation simulation
// ===================
function simulateTranslation(text) {
  return text.toUpperCase(); // заглушка
}

// ===================
// Event listeners
// ===================
document.addEventListener('DOMContentLoaded', () => {
  updateCharCount();
  setupSmoothScrolling();
  setupScrollHeader();
  updateMusicIcon();

  if (inputText) {
    inputText.addEventListener('input', updateCharCount);
    inputText.addEventListener('input', debounce(handleInputChange, 500));
  }

  if (translateBtn) translateBtn.addEventListener('click', performTranslation);
  if (swapBtn) swapBtn.addEventListener('click', swapLanguages);
  if (clearBtn) clearBtn.addEventListener('click', clearText);
  if (copyBtn) copyBtn.addEventListener('click', copyTranslation);
  if (speakBtn) speakBtn.addEventListener('click', speakTranslation);
  if (contactForm) contactForm.addEventListener('submit', handleContactForm);
  if (hamburger) hamburger.addEventListener('click', toggleMobileMenu);
// ===================
// Functions
// ===================
function updateCharCount() {
  if (!charCount || !inputText) return;
  const count = inputText.value.length;
  charCount.textContent = `${count}/5000`;
  charCount.style.color = count > 4500 ? '#ef4444' : count > 4000 ? '#f59e0b' : '#9ca3af';
}

function handleInputChange() {
  if (!translateBtn || !inputText) return;
  if (inputText.value.trim().length > 0) {
    translateBtn.classList.add('btn-primary');
    translateBtn.classList.remove('btn-outline');
  } else {
    translateBtn.classList.remove('btn-primary');
    translateBtn.classList.add('btn-outline');
  }
}

function performTranslation() {
  if (!inputText || !outputText || !translateBtn) return;
  const text = inputText.value.trim();
  if (!text) return alert('Enter text');

  translateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Translating...';
  translateBtn.disabled = true;

  setTimeout(() => {
    outputText.innerHTML = `<p>${simulateTranslation(text)}</p>`;
    translateBtn.innerHTML = '<i class="fas fa-language"></i> Translate';
    translateBtn.disabled = false;
  }, 1000);
}

function swapLanguages() {
  if (!fromLang || !toLang) return;
  const temp = fromLang.value;
  fromLang.value = toLang.value;
  toLang.value = temp;
}

function clearText() {
  if (!inputText || !outputText) return;
  inputText.value = '';
  outputText.innerHTML = '<p class="placeholder">The translation will appear here</p>';
  updateCharCount();
}

function copyTranslation() {
  if (!outputText) return;
  navigator.clipboard.writeText(outputText.textContent || '');
}

function speakTranslation() {
  if (!outputText) return;
  const utterance = new SpeechSynthesisUtterance(outputText.textContent || '');
  utterance.lang = toLang ? toLang.value : 'en';
  speechSynthesis.speak(utterance);
}

function handleContactForm(e) {
  if (!contactForm) return;
  e.preventDefault();
  alert('Message sent!');
  contactForm.reset();
}

function toggleMobileMenu() {
  if (!navMenu || !hamburger) return;
  navMenu.classList.toggle('active');
  hamburger.classList.toggle('active');
}

function setupSmoothScrolling() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
      e.preventDefault();
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  });
}

function setupScrollHeader() {
  window.addEventListener('scroll', () => {
    const header = document.querySelector('.header');
    if (!header) return;
    if (window.scrollY > 100) {
      header.style.background = 'rgba(255, 255, 255, 0.9)';
      header.style.boxShadow = '0 2px 20px rgba(0,0,0,0.08)';
      header.style.backdropFilter = 'blur(8px)';
    } else {
      header.style.background = 'transparent';
      header.style.boxShadow = 'none';
      header.style.backdropFilter = 'none';
    }
  });
}

// ===================
// Debounce helper
// ===================
function debounce(fn, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}
}
