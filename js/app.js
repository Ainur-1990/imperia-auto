/* ============================================================
   ИМПЕРИЯ АВТО — оркестрация: прелоадер, скролл, курсор, UI
   Сцена: SeqStage (реальные кадры облёта) + кино-осмотр
   ============================================================ */
(function () {
'use strict';

/* сборщик ошибок для диагностики */
window.__errs = [];
window.addEventListener('error', e => window.__errs.push(String(e.message || e)));

/* тест-хук: ?jump=N — мгновенный переход к позиции скролла */
const __jump = location.search.match(/jump=(\d+)/);
if (__jump) {
  const __y = +__jump[1];
  const __snap = () => scrollTo({ top: __y, left: 0, behavior: 'instant' });
  __snap();
  addEventListener('load', __snap);
  history.replaceState(null, '', location.pathname);
}

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
const clamp01 = v => Math.max(0, Math.min(1, v));
const lerp = (a, b, t) => a + (b - a) * t;

const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;

/* ---------------- сцена на кадрах ---------------- */
const show = window.SeqStage ? new SeqStage($('#seqStage')) : null;
if (show) {
  show.setReduced(RM);
  window.__stage = show;
}

/* ---------------- метрики скролла ---------------- */
const acts = $$('.act');
const outro = $('#outro');
let tops = acts.map(el => el.offsetTop);
let outroTop = outro.offsetTop;
let W = innerWidth, H = innerHeight;

function measure() {
  tops = acts.map(el => el.offsetTop);
  outroTop = outro.offsetTop;
  W = innerWidth; H = innerHeight;
}
function resize() {
  measure();
  if (show) show.resize(W, H, devicePixelRatio || 1);
}
resize();
addEventListener('load', measure, { passive: true });
addEventListener('resize', resize, { passive: true });

/* ---------------- указатель → ракурс + курсор ---------------- */
const cursor = { tx: W / 2, ty: H / 2, x: W / 2, y: H / 2 };
const cursorEl = $('#cursor');

addEventListener('pointermove', e => {
  if (show) show.setPointer((e.clientX / W) * 2 - 1, (e.clientY / H) * 2 - 1);
  cursor.tx = e.clientX;
  cursor.ty = e.clientY;
}, { passive: true });

/* ---------------- прелоадер ---------------- */
const loader = $('#loader');
const loadNum = $('#loadNum');
const loadBar = $('#loadBar');
const progress = { fonts: 0, scene: 0, time: 0 };

if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => { progress.fonts = 1; }).catch(() => { progress.fonts = 1; });
} else progress.fonts = 1;
setTimeout(() => { progress.time = 1; }, 1050);

if (show) show.onFirstFrame(() => { progress.scene = 1; });
setTimeout(() => { progress.scene = 1; }, 900); /* фолбэк webview */

let loaded = false;
function startIntro() {
  if (!show) return;
  if (scrollY > H * 0.25) show.introSkip();
  else show.intro();
}

/* ---------------- reveal (после прелоадера) ---------------- */
function startReveals() {
  const io = new IntersectionObserver(es => {
    es.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -5% 0px' });
  const targets = $$('.rv, .act__inner .ln, .outro__inner .ln, .cinema .ln');
  /* фолбэк: часть webview не доставляет IO — проверяем видимость сразу */
  targets.forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.top < innerHeight * 0.92 && r.bottom > 0) el.classList.add('in');
    else io.observe(el);
  });

  const cio = new IntersectionObserver(es => {
    es.forEach(e => {
      if (!e.isIntersecting) return;
      cio.unobserve(e.target);
      const el = e.target;
      const to = +el.dataset.to;
      const suf = el.dataset.suf || '';
      const t0 = performance.now();
      const dur = 1400;
      (function step(now) {
        const k = clamp01((now - t0) / dur);
        const v = Math.round(to * (1 - Math.pow(1 - k, 3)));
        el.textContent = v.toLocaleString('ru-RU') + suf;
        if (k < 1) requestAnimationFrame(step);
      })(t0);
    });
  }, { threshold: 0.6 });
  $$('.count').forEach(el => cio.observe(el));
}

/* ---------------- главный цикл ---------------- */
let rafAlive = false;
let last = performance.now();
let lastAct = -1;
document.addEventListener('visibilitychange', () => { last = performance.now(); });

const hdr = $('#hdr');

function localAct(sy) {
  let act = 0;
  for (let i = 0; i < 4; i++) if (sy >= tops[i] - 1) act = i;
  return act;
}

function frame(now) {
  rafAlive = true;
  requestAnimationFrame(frame);
  const dt = Math.min(Math.max((now - last) / 1000, 0), 0.1);
  last = now;
  const sy = scrollY;

  const act = show ? show.tick(dt, sy, tops, H, outroTop) : localAct(sy);

  if (act !== lastAct) {
    lastAct = act;
    document.body.dataset.act = String(act);
    const railBtns = $$('#rail button');
    railBtns.forEach((b, i) => b.classList.toggle('on', i === act));
  }

  hdr.classList.toggle('scrolled', sy > 30);

  /* затухание карточек в самом конце акта (переезд машины) */
  acts.forEach((el, i) => {
    const fin = tops[i + 1] !== undefined ? tops[i + 1] : outroTop;
    const u = clamp01((sy - (fin - H * 0.5)) / (H * 0.5));
    const fading = u > 0.35;
    if (fading !== (el.dataset.f === '1')) {
      el.dataset.f = fading ? '1' : '0';
      $$('.hero,.card,.mid,.strip,.flank,.foot,.hint', el.firstElementChild)
        .forEach(n => n.classList.toggle('fading', fading));
    }
  });

  /* курсор */
  if (FINE && !RM) {
    cursor.x = lerp(cursor.x, cursor.tx, 0.22);
    cursor.y = lerp(cursor.y, cursor.ty, 0.22);
    cursorEl.style.transform = 'translate(' + cursor.x + 'px,' + cursor.y + 'px)';
  }

  /* прогресс кадров сцены */
  if (show) {
    const seqLoadEl = $('#seqLoad');
    const seqTxt = seqLoadEl.querySelector('span');
    let lastPct = -1;
    const updSeq = () => {
      const p = show.progress();
      const pct = Math.round(p * 100);
      if (pct === lastPct) return;
      lastPct = pct;
      seqTxt.textContent = 'кадры ' + pct + '%';
      seqLoadEl.classList.toggle('on', pct < 100);
    };
    updSeq();
    setInterval(updSeq, 500);
  }

  /* прелоадер */
  if (!loaded) {
    const p = (progress.fonts + progress.scene + progress.time) / 3;
    loadNum.textContent = String(Math.round(p * 100)).padStart(3, '0');
    loadBar.style.width = (p * 100).toFixed(1) + '%';
    if (p >= 1) {
      loaded = true;
      loader.classList.add('done');
      setTimeout(startIntro, 350);
      setTimeout(startReveals, 500);
      setTimeout(() => loader.remove(), 1700);
    }
  }
}
requestAnimationFrame(frame);

/* watchdog: некоторые webview замораживают rAF, но держат таймеры */
setInterval(() => {
  if (!rafAlive) frame(performance.now());
  rafAlive = false;
}, 50);

/* ---------------- курсор: ховеры ---------------- */
if (FINE && !RM) {
  document.addEventListener('mouseover', e => {
    const hot = e.target.closest('a,button,input,select,label.chk');
    cursorEl.classList.toggle('on', !!hot);
  });
  document.addEventListener('mouseleave', () => cursorEl.classList.remove('on'));
}

/* ---------------- магнитные кнопки ---------------- */
if (FINE && !RM) {
  $$('[data-mag]').forEach(btn => {
    btn.addEventListener('pointermove', e => {
      const r = btn.getBoundingClientRect();
      const dx = (e.clientX - r.left - r.width / 2) / r.width;
      const dy = (e.clientY - r.top - r.height / 2) / r.height;
      btn.style.transform = 'translate(' + (dx * 8) + 'px,' + (dy * 6) + 'px)';
    });
    btn.addEventListener('pointerleave', () => { btn.style.transform = ''; });
  });
}

/* ---------------- рельс ---------------- */
$$('#rail button').forEach((b, i) => {
  b.addEventListener('click', () => {
    scrollTo({ top: tops[i] + 2, behavior: RM ? 'auto' : 'smooth' });
  });
});

/* ---------------- мобильное меню ---------------- */
const burger = $('#burger');
burger.addEventListener('click', () => {
  const open = document.body.classList.toggle('menu');
  burger.setAttribute('aria-expanded', String(open));
});
$$('#mnav a').forEach(a => a.addEventListener('click', () => {
  document.body.classList.remove('menu');
  burger.setAttribute('aria-expanded', 'false');
}));

/* ---------------- форма ---------------- */
const form = $('#tdForm');
form.addEventListener('submit', e => {
  e.preventDefault();
  if (form.classList.contains('sent')) return;
  const els = form.elements;
  let ok = true;
  const mark = (fld, bad) => {
    fld.closest('.fld').classList.toggle('err', bad);
    if (bad) ok = false;
  };
  mark(els.name, els.name.value.trim().length < 2);
  mark(els.phone, els.phone.value.replace(/\D/g, '').length < 10);
  if (!els.agree.checked) {
    els.agree.closest('.chk').style.color = '#e2505a';
    ok = false;
  } else {
    els.agree.closest('.chk').style.color = '';
  }
  if (!ok) return;
  form.classList.add('sent');
});
})();
