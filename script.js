/* Reset */
*{margin:0;padding:0;box-sizing:border-box}

:root{
--primary:#1f4ba5;
--primary-dark:#173b85;
--secondary:#f59e0b;
--accent:#10b981;
--text:#1f2937;
--text-sec:#6b7280;
--text-light:#9ca3af;
--bg:#fff;
--bg-sec:#f9fafb;
--bg-dark:#111827;
--border:#e5e7eb;
--shadow-sm:0 1px 2px 0 rgba(0,0,0,.05);
--shadow-md:0 4px 6px -1px rgba(0,0,0,.1);
--shadow-lg:0 10px 15px -3px rgba(0,0,0,.1);
--shadow-xl:0 20px 25px -5px rgba(0,0,0,.1);
--gradient:linear-gradient(135deg,#2f5597 0%,#1f3f83 100%);
--radius:12px;
--radius-lg:16px
}

html,body{overflow-x:hidden;max-width:100vw}
body{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:var(--text);background:var(--bg);position:relative}
.container{max-width:1200px;margin:0 auto;padding:0 20px;width:100%}

/* Typography */
h1,h2,h3,h4,h5,h6{font-weight:600;line-height:1.2;margin-bottom:1rem}
h1{font-size:3.5rem}
h2{font-size:2.5rem}
h3{font-size:1.75rem}
h4{font-size:1.25rem}
p{margin-bottom:1rem;color:var(--text-sec);word-wrap:break-word}

/* Buttons */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;padding:.75rem 1.5rem;border:none;border-radius:var(--radius);font-weight:500;text-decoration:none;cursor:pointer;transition:all .3s ease;font-size:.95rem;white-space:nowrap}
.btn-primary{background:var(--gradient);color:#fff;box-shadow:var(--shadow-md)}
.btn-primary:hover{transform:translateY(-2px);box-shadow:var(--shadow-lg)}
.btn-outline{background:transparent;color:var(--primary);border:2px solid var(--primary)}
.btn-outline:hover{background:var(--primary);color:#fff;transform:translateY(-2px)}
.btn-large{padding:1rem 2rem;font-size:1.1rem}
.btn-full{width:100%}

/* Header */
.header{position:fixed;top:0;left:0;right:0;background:transparent;z-index:1000;width:100%}
.nav-container{display:flex;align-items:center;justify-content:space-between;padding:1rem 20px;max-width:1200px;margin:0 auto;width:100%}
.logo{display:flex;align-items:center;margin-right:auto;gap:.5rem;font-size:1.5rem;font-weight:700;color:var(--primary);position:relative}
.logo i{font-size:2rem}
.site-logo{height:180px;width:auto;display:block;filter:contrast(1.3) brightness(1.1) saturate(1.2);transition:filter .3s;margin-left:-140px}
.site-logo:hover{filter:contrast(1.5) brightness(1.2) saturate(1.4)}
.nav-menu{display:flex;list-style:none;gap:2rem;padding:0;margin:0}
.nav-menu li{position:relative;left:-20px}
.nav-menu a{text-decoration:none;color:var(--text);font-weight:500;transition:all .3s}
.nav-menu a:hover{color:var(--primary)}
.nav-buttons{display:flex;gap:1rem}
.hamburger{display:none;flex-direction:column;cursor:pointer;gap:4px}
.hamburger span{width:25px;height:3px;background:var(--text);transition:all .3s}

/* Hero */
.hero{padding:80px 0;background:linear-gradient(135deg,rgba(47,85,151,.35) 0%,rgba(31,63,131,.35) 100%),url('assets/background.jpg');background-position:center top;background-size:cover;min-height:100vh;color:#fff;position:relative;overflow:hidden;width:100%}
.hero-container{max-width:1200px;margin:0 auto;padding:0 20px;display:flex;flex-direction:column;align-items:center;text-align:center;position:relative;z-index:1;width:100%}
.hero-title{font-size:3.5rem;font-weight:700;margin-bottom:1.5rem;line-height:1.1;margin-top:120px}
.highlight{background:linear-gradient(45deg,#fbbf24,#f59e0b);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.hero-subtitle{font-size:1.25rem;margin-bottom:2rem;opacity:.9;line-height:1.6}
.hero-buttons{display:flex;gap:1rem;margin-bottom:3rem;flex-wrap:wrap;justify-content:center}

/* Features */
.features{padding:80px 0;width:100%}
.section-header{text-align:center;margin-bottom:4rem}
.section-header h2{font-size:2.5rem;margin-bottom:1rem}
.features-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:2rem;width:100%}
.feature-card{background:#fff;padding:2rem;border-radius:var(--radius-lg);box-shadow:var(--shadow-md);text-align:center;transition:all .3s;border:1px solid var(--border);min-height:200px;display:flex;flex-direction:column;justify-content:center}
.feature-card:hover{transform:translateY(-5px);box-shadow:var(--shadow-xl)}
.feature-icon{width:80px;height:80px;background:var(--gradient);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 1.5rem;font-size:2rem;color:#fff}
.feature-card h3{margin-bottom:1rem;color:var(--text);font-size:1.1rem;line-height:1.3}
.feature-card p{color:var(--text-sec);line-height:1.6}

/* Contact */
.contact{padding:80px 0;background:var(--bg-sec);width:100%;overflow:hidden}
.contact-content{display:grid;grid-template-columns:1fr 1fr;gap:4rem;align-items:start;max-width:100%}
.contact-info h2,.contact-info p,.contact-details{margin-bottom:1.5rem}
.contact-details{display:flex;flex-direction:column;gap:1.5rem;width:100%}
.contact-item{display:flex;align-items:flex-start;gap:1rem;max-width:100%;width:100%}
.contact-item i{width:50px;height:50px;min-width:50px;background:var(--primary);color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.2rem}
.contact-item img{width:auto;max-height:100px;max-width:100%}
.contact-item div{flex:1;min-width:0;width:100%}
.contact-item h4{margin-bottom:.5rem}
.contact-item p{word-break:break-word;overflow-wrap:break-word}
.contact-item a{word-break:break-all;color:var(--primary)}
.contact-form{background:#fff;padding:2rem;border-radius:var(--radius-lg);box-shadow:var(--shadow-md);max-width:100%;width:100%}
.form-group{margin-bottom:1.5rem}
.form-group input,.form-group textarea{width:100%;padding:1rem;border:2px solid var(--border);border-radius:var(--radius);font-size:1rem;font-family:inherit;transition:all .3s}
.form-group input:focus,.form-group textarea:focus{outline:none;border-color:var(--primary)}

/* Cookie */
.cookie-banner-contact{text-align:center;padding:50px 30px;max-width:600px;background:url('assets/car.jpg') center/cover no-repeat;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.15);position:relative;margin:0 auto}
.cookie-banner-contact h3,.cookie-banner-contact p,.cookie-banner-contact button{position:relative;z-index:2}
.cookie-banner-contact h3{font-size:26px;margin-bottom:16px;color:#1f2937}
.cookie-banner-contact p{font-size:17px;color:#6b7280;margin-bottom:28px;line-height:1.6}
.cookie-accept{padding:14px 36px;background:#0066ff;color:#fff;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;transition:all .2s}
.cookie-accept:hover{background:#0052cc;transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,102,255,.3)}

/* Footer */
.footer{background:var(--bg-dark);color:#fff;padding:60px 0 20px;width:100%;overflow:hidden}
.footer-content{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:3rem;margin-bottom:3rem}
.footer-tagline-inline{position:absolute;left:125%;top:50%;transform:translateY(-50%);white-space:nowrap;font-size:1.5rem;font-weight:700;color:#d4af37}

/* Music Player */
.music-player{position:fixed;top:20px;right:20px;z-index:1000}
.music-player-toggle{width:75px;height:75px;border-radius:50%;cursor:pointer;box-shadow:var(--shadow-lg);transition:all .3s}
.music-player-toggle:hover{transform:scale(1.1)}
.globe{width:75px;height:75px;background:url('https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/The_Blue_Marble_%28remastered%29.jpg/200px-The_Blue_Marble_%28remastered%29.jpg') center/cover no-repeat;border-radius:50%;animation:spin 12s infinite linear;box-shadow:var(--shadow-lg)}
@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}

/* Mobile */
@media(max-width:768px){
html,body{overflow-x:hidden!important;max-width:100vw}
.container,.nav-container,.hero-container{padding:0 20px;max-width:100%;width:100%}
.hamburger{display:flex;z-index:1001}
.nav-menu,.nav-buttons{display:none}
.site-logo{height:60px;margin-left:0;max-width:150px}
.nav-menu li{left:0}
.hero{padding:60px 0 40px;min-height:60vh}
.hero-title{font-size:2rem;margin-top:60px}
.hero-subtitle{font-size:1rem;padding:0 10px}
.hero-buttons{flex-direction:column;width:100%;padding:0 20px}
.hero-buttons .btn{width:100%}
.music-player{top:10px;right:10px}
.music-player-toggle,.globe{width:50px;height:50px}
h1{font-size:2rem}
h2{font-size:1.75rem}
h3{font-size:1.35rem}
h4{font-size:1.1rem}
.btn{padding:.75rem 1.25rem;font-size:.9rem;width:100%;max-width:100%}
.features-grid{grid-template-columns:1fr;gap:1.5rem}
.feature-card{min-height:auto;padding:1.5rem}
.feature-icon{width:60px;height:60px;font-size:1.5rem}
.contact{padding:60px 20px}
.contact-content{grid-template-columns:1fr;gap:2rem}
.contact-item{flex-direction:row;align-items:flex-start;gap:1rem;width:100%}
.contact-item img{max-width:100%;height:auto}
#wechatQR{max-width:100%!important;height:auto!important}
.contact-item p,.contact-item a{font-size:.9rem;word-break:break-all}
.contact-form{padding:1.5rem;width:100%}
.form-group input,.form-group textarea,.contact-form .btn{width:100%;max-width:100%;font-size:16px}
.cookie-banner-contact{max-width:90%;padding:30px 20px;min-height:auto}
.cookie-banner-contact p{font-size:15px}
.cookie-accept{padding:12px 24px;font-size:15px;width:100%;max-width:100%}
.footer{padding:40px 20px 20px}
.footer-content{grid-template-columns:1fr;gap:2rem}
.footer-tagline-inline{position:static;transform:none;display:block;margin-top:.5rem;font-size:1.2rem}
}

@media(max-width:480px){
.container,.nav-container,.contact{padding-left:15px;padding-right:15px}
.hero-title{font-size:1.6rem}
h2{font-size:1.5rem}
.btn{padding:.7rem 1rem;font-size:.9rem}
.contact-item{flex-direction:column;align-items:center;text-align:center;gap:.75rem}
.contact-item i{width:45px;height:45px;min-width:45px;font-size:1.1rem}
.contact-item img{max-height:200px;width:100%;object-fit:contain}
.contact-item div{width:100%}
.contact-item p,.contact-item a{font-size:.85rem}
.feature-icon{width:50px;height:50px;font-size:1.3rem}
.music-player-toggle,.globe{width:45px;height:45px}
.contact-form{padding:1.25rem}
}
