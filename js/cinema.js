/* ============================================================
   КИНО-ОСМОТР — покадровый скраббер на canvas
   Кадры нарезаны tools/slice.mjs (ffmpeg), манифест в
   media/cinema/manifest.js. Прокрутка колеса = выбор кадра.
   ============================================================ */
(function () {
'use strict';

var M = window.__CINEMA;
var sec = document.getElementById('cinema');
if (!M || !sec) return;

var canvas = document.getElementById('cinemaCanvas');
var ctx = canvas.getContext('2d');
var ui = sec.querySelector('.cinema__ui');
var loadEl = document.getElementById('cinLoad');
var loadTxt = loadEl.querySelector('span');
var prog = document.getElementById('cinProg');

var frames = new Array(M.count);
var loaded = 0;
var shown = -1;
var target = 0;
var current = 0;
var parX = 0, parTX = 0;
var W = 0, H = 0, dpr = 1;

function pad(n) {
  var s = String(n);
  while (s.length < M.pad) s = '0' + s;
  return s;
}

/* загрузка кадров: очередь с конверсией 3 */
var queue = [];
for (var i = 0; i < M.count; i++) queue.push(i);
var active = 0;
function pump() {
  while (active < 3 && queue.length) {
    var idx = queue.shift();
    active++;
    (function (n) {
      var im = new Image();
      im.decoding = 'async';
      im.onload = im.onerror = function () {
        frames[n] = im;
        if (im.width) {
          loaded++;
          var p = Math.round(loaded / M.count * 100);
          loadTxt.textContent = 'загрузка кадров ' + p + '%';
          if (loaded >= 12) loadEl.classList.add('off');
          if (loaded >= M.count) loadEl.classList.add('off');
        }
        active--;
        pump();
      };
      im.src = M.dir + 'frame-' + pad(n + 1) + M.ext;
    })(idx);
  }
}
pump();

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = canvas.clientWidth;
  H = canvas.clientHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  shown = -1;
}

/* отрисовка кадра «в обложку» + лёгкий параллакс от мыши */
function draw(idx) {
  var im = frames[idx];
  if (!im || !im.width) {
    /* ближайший готовый кадр */
    for (var d = 1; d < M.count && !im; d++) {
      if (frames[idx - d] && frames[idx - d].width) im = frames[idx - d];
      else if (frames[idx + d] && frames[idx + d].width) im = frames[idx + d];
    }
    if (!im) return;
  }
  var iw = im.width, ih = im.height;
  var s = Math.max(canvas.width / iw, canvas.height / ih) * 1.04;
  var dw = iw * s, dh = ih * s;
  ctx.drawImage(im, (canvas.width - dw) / 2 + parX * dpr, (canvas.height - dh) / 2, dw, dh);
}

function frame() {
  requestAnimationFrame(frame);
  var r = sec.getBoundingClientRect();
  var vh = window.innerHeight;
  /* прогресс по «закреплённому» диапазону: 0 — секция прилипла, 1 — уехала */
  var p = Math.max(0, Math.min(1, -r.top / (r.height - vh)));
  target = p * (M.count - 1);
  current += (target - current) * 0.14;
  parX += (parTX * 26 - parX) * 0.06;

  var idx = Math.round(current);
  prog.style.width = (p * 100).toFixed(2) + '%';
  if (p > 0.06 && p < 0.96) ui.classList.add('away');
  else ui.classList.remove('away');
  if (idx !== shown) {
    shown = idx;
    draw(idx);
  } else if (Math.abs(parX) > 0.4) {
    draw(idx);
  }
}

window.addEventListener('pointermove', function (e) {
  parTX = (e.clientX / window.innerWidth) * 2 - 1;
}, { passive: true });

var rsz;
window.addEventListener('resize', function () {
  clearTimeout(rsz);
  rsz = setTimeout(resize, 120);
}, { passive: true });

resize();
requestAnimationFrame(frame);
})();
