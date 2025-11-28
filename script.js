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

  // Если мы на странице feedback.html — инициализируем загрузку отзывов и форму
  initFeedbackModuleIfPresent();
});

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

/* -----------------------------------
   Supabase feedback module (works if
   feedback page elements are present)
   ----------------------------------- */

/* --- Replace these with your Supabase values (already set) --- */
const SUPABASE_URL = 'https://mcgcijdnzduzyqbbjtkm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jZ2NpamRuemR1enlxYmJqdGttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzMDk1NzksImV4cCI6MjA3OTg4NTU3OX0.rhiArHGVbMt0nOgEeP-qGzL0ZuX3Cr1EoOMR1w3dDQ0';
/* ----------------------------------------------------------- */

function initFeedbackModuleIfPresent() {
  // Expected ids on feedback.html:
  // #name  -> input for name
  // #message -> textarea for message
  // #feedbackList -> container (ul or div) where messages will be rendered
  const nameInput = document.getElementById('name') || document.getElementById('userName'); // handle variants
  const messageInput = document.getElementById('message') || document.getElementById('userFeedback') || document.getElementById('fbMessage');
  const feedbackList = document.getElementById('feedbackList') || document.getElementById('feedbackMessages') || document.getElementById('feedbackListContainer');
  const feedbackForm = document.getElementById('feedbackForm') || document.getElementById('feedbackFormMain');

  // Если элементов нет — ничего не делаем (без ошибок)
  if (!feedbackList || !messageInput) return;

  // Load and render feedbacks
  loadFeedbacks();

  // If form exists — wire it
  if (feedbackForm) {
    feedbackForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = nameInput ? (nameInput.value.trim() || 'Anonymous') : 'Anonymous';
      const message = messageInput.value.trim();
      if (!message) return alert('Введите отзыв');

      // disable UI briefly
      const submitBtn = feedbackForm.querySelector('button[type="submit"]');
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sending...'; }

      try {
        await addFeedbackToSupabase({ name, message });
        // clear
        if (nameInput) nameInput.value = '';
        messageInput.value = '';
        await loadFeedbacks(); // refresh
      } catch (err) {
        console.error('Ошибка при отправке отзыва:', err);
        alert('Ошибка при отправке. Попробуй ещё раз.');
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Send'; }
      }
    });
  }
}

// Fetch feedbacks from Supabase and render into feedbackList
async function loadFeedbacks() {
  const feedbackList = document.getElementById('feedbackList') || document.getElementById('feedbackMessages') || document.getElementById('feedbackListContainer');
  if (!feedbackList) return;
  feedbackList.innerHTML = '<p style="opacity:.6">Loading...</p>';

  try {
    const url = `${SUPABASE_URL}/rest/v1/feedback?select=id,name,contact,message,reply,created_at&order=created_at.desc`;
    const res = await fetch(url, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      }
    });
    if (!res.ok) throw new Error(`Supabase error ${res.status}`);
    const data = await res.json();

    feedbackList.innerHTML = '';
    if (!data || data.length === 0) {
      feedbackList.innerHTML = '<p>No feedback yet.</p>';
      return;
    }

    data.forEach(item => {
      const wrapper = document.createElement('div');
      wrapper.className = 'feedback-item';
      // Show name, message, timestamp and optional reply
      const ts = new Date(item.created_at).toLocaleString();
      wrapper.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong style="margin-right:10px;">${escapeHtml(item.name || 'Anonymous')}</strong>
          <span style="font-size:0.8rem;color:#666;">${ts}</span>
        </div>
        <p style="margin:6px 0 0 0;">${escapeHtml(item.message)}</p>
        ${item.reply ? `<div style="margin-top:8px;padding:8px;border-left:3px solid #f0f0f0;background:#fafafa;"><strong>Reply:</strong><div>${escapeHtml(item.reply)}</div></div>` : ''}
      `;
      // For now no delete/edit controls here (they will be in admin.html)
      feedbackList.appendChild(wrapper);
    });

  } catch (err) {
    console.error('loadFeedbacks error:', err);
    feedbackList.innerHTML = '<p>Failed to load feedbacks.</p>';
  }
}

// Add a feedback to Supabase
async function addFeedbackToSupabase({ name, message, contact = '' }) {
  const url = `${SUPABASE_URL}/rest/v1/feedback`;
  const payload = [{ name, contact, message }];

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase insert failed: ${res.status} ${text}`);
  }
  const respJson = await res.json();
  return respJson;
}

/* Utility: escape to avoid XSS when inserting into innerHTML */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* Optional: polyfill for older browsers could be added here */
/* End of Supabase feedback module */
