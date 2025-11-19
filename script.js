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

const musicToggle = document.getElementById('musicToggle');
const volumeSlider = document.getElementById('volumeSlider');

let audio; // создаём при первом клике

document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  updateCharCount();
  setupSmoothScrolling();
  setupScrollHeader();
  setupMusicToggle();
});

function setupMusicToggle() {
  if (!musicToggle) return console.log('Нота не найдена');
  musicToggle.addEventListener('click', () => {
    if (!audio) {
      audio = new Audio('audio/Calli Malpas - Seven Nation Army.mp3');
      audio.loop = true;
      audio.volume = 0.4;
    }

    if (audio.paused) {
      audio.play().catch(err => console.log('Ошибка воспроизведения:', err));
      musicToggle.innerHTML = '<i class="fas fa-pause"></i>';
    } else {
      audio.pause();
      musicToggle.innerHTML = '<i class="fas fa-music"></i>';
    }
  });

  if (volumeSlider) {
    volumeSlider.addEventListener('input', e => {
      if (audio) audio.volume = e.target.value / 100;
    });
  }
}

// Event listeners
function setupEventListeners() {
  inputText.addEventListener('input', updateCharCount);
  inputText.addEventListener('input', debounce(handleInputChange, 500));
  translateBtn.addEventListener('click', performTranslation);
  swapBtn.addEventListener('click', swapLanguages);
  clearBtn.addEventListener('click', clearText);
  copyBtn.addEventListener('click', copyTranslation);
  speakBtn.addEventListener('click', speakTranslation);
  contactForm.addEventListener('submit', handleContactForm);
  hamburger.addEventListener('click', toggleMobileMenu);
}

// Translation
function performTranslation() {
  const text = inputText.value.trim();
  if (!text) return alert('Enter text');

  translateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Translating...';
  translateBtn.disabled = true;

  setTimeout(() => {
    const translated = simulateTranslation(text);
    outputText.innerHTML = `<p>${translated}</p>`;
    translateBtn.innerHTML = '<i class="fas fa-language"></i> Translate';
    translateBtn.disabled = false;
  }, 500);
}

function simulateTranslation(text) {
  return text.toUpperCase(); // заглушка
}

function swapLanguages() {
  const temp = fromLang.value;
  fromLang.value = toLang.value;
  toLang.value = temp;
}

function clearText() {
  inputText.value = '';
  outputText.innerHTML = '<p class="placeholder">The translation will appear here</p>';
  updateCharCount();
}

function copyTranslation() {
  navigator.clipboard.writeText(outputText.textContent);
}

function speakTranslation() {
  const utterance = new SpeechSynthesisUtterance(outputText.textContent);
  utterance.lang = toLang.value;
  speechSynthesis.speak(utterance);
}

function handleContactForm(e) {
  e.preventDefault();
  alert('Message sent!');
  contactForm.reset();
}

function toggleMobileMenu() {
  navMenu.classList.toggle('active');
  hamburger.classList.toggle('active');
}

// Helpers
function updateCharCount() {
  const count = inputText.value.length;
  charCount.textContent = `${count}/5000`;
  charCount.style.color = count > 4500 ? '#ef4444' : count > 4000 ? '#f59e0b' : '#9ca3af';
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

function setupSmoothScrolling() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
      e.preventDefault();
      document.querySelector(anchor.getAttribute('href')).scrollIntoView({ behavior: 'smooth' });
    });
  });
}

function setupScrollHeader() {
  window.addEventListener('scroll', () => {
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
  });
}

// Simple debounce
function debounce(fn, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}
