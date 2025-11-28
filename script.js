const translations = {
  ru: {
    nav_home: "Главная", nav_services: "Услуги", nav_contact: "Связаться с нами",
    hero_title: "Профессиональные <span class=\"highlight\">услуги перевода</span>",
    hero_subtitle: "Быстрый и точный перевод документов с нотариальным заверением и апостилем. Работаем с более чем 100 языками.",
    services_title: "Почему выбирают нас", services_subtitle: "Профессиональные услуги для всех ваших потребностей в переводе",
    service_1_title: "Быстрый перевод", service_1_desc: "Экспресс-перевод документов за 24 часа",
    service_2_title: "Нотариальное заверение", service_2_desc: "Официальное заверение переводов",
    service_3_title: "Апостиль", service_3_desc: "Международное признание документов",
    service_4_title: "Все типы документов", service_4_desc: "Паспорта, сертификаты, контракты и многое другое",
    service_5_title: "Локализация сайтов", service_5_desc: "Перевод и адаптация веб-сайтов и контента",
    service_6_title: "Услуга консьержа", service_6_desc: "Персональный менеджер для срочных задач",
    service_7_title: "Доставка от двери до двери", service_7_desc: "Курьерская доставка переведённых документов",
    reviews_title: "Отзывы клиентов", reviews_subtitle: "Что говорят о нас наши клиенты",
    contact_title: "Связаться с нами", contact_subtitle: "Есть вопросы? Наша команда готова помочь с любым запросом на перевод.",
    contact_email: "Email", contact_whatsapp: "WhatsApp и телефон", contact_hours: "Часы работы", contact_hours_text: "Онлайн 24/7",
    form_name: "Ваше имя", form_email: "Email", form_subject: "Тема", form_message: "Ваше сообщение", form_submit: "Отправить сообщение",
    footer_tagline: "Мы переводим людей", footer_desc: "Профессиональные услуги перевода и локализации: документы, сайты, видео. Быстро и точно.", footer_follow: "Следите за нами"
  },
  en: {
    nav_home: "Home", nav_services: "Services", nav_contact: "Contact us",
    hero_title: "Professional <span class=\"highlight\">translation services</span>",
    hero_subtitle: "Fast and accurate document translations with notarization and apostille. We work with 100+ languages.",
    services_title: "Why choose us", services_subtitle: "Professional services for all your translation needs",
    service_1_title: "Fast translation", service_1_desc: "Express translation of documents in 24 hours",
    service_2_title: "Notarization", service_2_desc: "Official notarization of translations",
    service_3_title: "Apostille", service_3_desc: "International document recognition",
    service_4_title: "All document types", service_4_desc: "Passports, certificates, contracts, and more",
    service_5_title: "Website localization", service_5_desc: "Translation and adaptation of websites and content",
    service_6_title: "Concierge service", service_6_desc: "Personal manager for urgent tasks",
    service_7_title: "Door-to-door delivery", service_7_desc: "Courier delivery of translated documents",
    reviews_title: "Client Reviews", reviews_subtitle: "What our clients say about us",
    contact_title: "Contact us", contact_subtitle: "Have questions? Our team is ready to help with any translation request.",
    contact_email: "Email", contact_whatsapp: "WhatsApp and phone", contact_hours: "Working hours", contact_hours_text: "Online 24/7",
    form_name: "Your name", form_email: "Email", form_subject: "Subject", form_message: "Your message", form_submit: "Send message",
    footer_tagline: "We translate people", footer_desc: "Professional translation and localization services: documents, websites, video. Fast and accurate.", footer_follow: "Follow us"
  }
};

const reviewsData = [
  {name:"Anna Ivanova",rating:5,text:"Excellent service! They quickly translated and certified documents for my visa. Very satisfied with the quality and speed."},
  {name:"Dmitry Smirnov",rating:5,text:"Professional approach, translated technical contract into English. All terms are accurate, no mistakes."},
  {name:"Elena Petrova",rating:5,text:"Thank you for the promptness! Needed urgent translation for court, done in one day with notarization."}
];

let currentLang = localStorage.getItem('language') || 'ru';

const globeSwitcher = document.getElementById('globeSwitcher');
const currentLangEl = document.getElementById('currentLang');

function switchLanguage() {
  currentLang = currentLang === 'ru' ? 'en' : 'ru';
  localStorage.setItem('language', currentLang);
  updateLanguage();
}

function updateLanguage() {
  currentLangEl.textContent = currentLang.toUpperCase();
  document.documentElement.lang = currentLang;
  document.querySelectorAll('[data-translate]').forEach(el => {
    const key = el.getAttribute('data-translate');
    if (translations[currentLang][key]) el.innerHTML = translations[currentLang][key];
  });
  document.querySelectorAll('[data-translate-placeholder]').forEach(el => {
    const key = el.getAttribute('data-translate-placeholder');
    if (translations[currentLang][key]) el.placeholder = translations[currentLang][key];
  });
}

function loadReviews() {
  const container = document.getElementById('reviewsContainer');
  container.innerHTML = reviewsData.map(r => `
    <div class="review-card">
      <div class="review-header">
        <div class="review-avatar"><i class="fas fa-user"></i></div>
        <div class="review-info">
          <h4 class="review-name">${r.name}</h4>
          <div class="review-rating">${'<i class="fas fa-star"></i>'.repeat(r.rating)}</div>
        </div>
      </div>
      <p class="review-text">${r.text}</p>
    </div>
  `).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  updateLanguage();
  loadReviews();
  globeSwitcher.addEventListener('click', switchLanguage);
  document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault(); document.querySelector(a.getAttribute('href')).scrollIntoView({behavior:'smooth'});
  }));
  document.querySelector('.hamburger')?.addEventListener('click', () => {
    document.querySelector('.nav-menu').classList.toggle('active');
    document.querySelector('.hamburger').classList.toggle('active');
  });
  document.getElementById('contactForm')?.addEventListener('submit', e => {
    e.preventDefault();
    alert(currentLang === 'ru' ? 'Сообщение отправлено!' : 'Message sent!');
    e.target.reset();
  });
});
