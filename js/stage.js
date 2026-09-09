/* ============================================================
   SEQ-STAGE — главный экран на реальных кадрах облёта
   Мышь листает кадры (ракурс), скролл меняет автомобили
   асимметричным кроссфейдом на тёмной подложке.
   Манифесты: media/turn/{free,l9,zh,dr}/manifest.js
   ============================================================ */
(function () {
'use strict';

if (!window.__SEQ || !window.__SEQ.free) { window.SeqStage = null; return; }

var clamp01 = function (v) { return Math.max(0, Math.min(1, v)); };
var lerp = function (a, b, t) { return a + (b - a) * t; };
var smooth = function (v) { var t = clamp01(v); return t * t * (3 - 2 * t); };

function Player(man, onFirst) {
  this.man = man;
  this.frames = new Array(man.count);
  this.loaded = 0;
  this.complete = false;
  this.onFirst = onFirst || null;
  var self = this;
  var queue = [];
  for (var i = 0; i < man.count; i++) queue.push(i);
  var active = 0;
  function pump() {
    while (active < 3 && queue.length) {
      var idx = queue.shift();
      active++;
      (function (n) {
        var im = new Image();
        im.decoding = 'async';
        im.onload = im.onerror = function () {
          self.frames[n] = im.width ? im : null;
          if (im.width) {
            self.loaded++;
            if (self.onFirst && n === 0) { self.onFirst(self); self.onFirst = null; }
            if (self.loaded >= man.count) self.complete = true;
          }
          active--;
          pump();
        };
        var s = String(n + 1);
        while (s.length < man.pad) s = '0' + s;
        im.src = man.dir + 'frame-' + s + man.ext;
      })(idx);
    }
  }
  pump();
}
Player.prototype.ready = function () { return this.loaded > 2; };
Player.prototype.draw = function (ctx, W, H, t, alpha, scale, ox) {
  if (alpha <= 0.004) return;
  var idx = Math.round(clamp01(t) * (this.man.count - 1));
  var im = this.frames[idx];
  if (!im) {
    for (var d = 1; d < this.man.count && !im; d++) {
      if (this.frames[idx - d]) im = this.frames[idx - d];
      else if (this.frames[idx + d]) im = this.frames[idx + d];
    }
    if (!im) return;
  }
  var s = Math.max(W / im.width, H / im.height) * (scale || 1);
  var dw = im.width * s, dh = im.height * s;
  ctx.globalAlpha = alpha;
  ctx.drawImage(im, (W - dw) / 2 + (ox || 0), (H - dh) / 2, dw, dh);
  ctx.globalAlpha = 1;
};

function SeqStage(canvas) {
  this.canvas = canvas;
  this.ctx = canvas.getContext('2d');
  this.keys = ['free', 'l9', 'zh', 'dr'];
  /* постоянный сдвиг картинки от текста карточек: вправо/влево/центр/вправо */
  this.ox = [0.16, -0.15, 0, 0.13];
  this.players = {};
  this.pointer = { x: 0, y: 0, tx: 0, ty: 0, lastMove: -10 };
  this.introV = 0;
  this.introOn = false;
  this.introT0 = 0;
  this.reduced = false;
  this.time = 0;
  this.started = false;
  var self = this;
  this.players[this.keys[0]] = new Player(window.__SEQ.free, function () {
    self.started = true;
    if (self.waitFirst) { self.waitFirst(); self.waitFirst = null; }
  });
  this.pend = 1;
}
SeqStage.prototype.loadNext = function (i) {
  if (i < 1 || i > 3) return;
  var k = this.keys[i];
  if (!this.players[k]) { this.players[k] = new Player(window.__SEQ[k], null); }
};
SeqStage.prototype.resize = function (w, h, dpr) {
  dpr = Math.min(dpr || 1, 2);
  this.canvas.width = Math.round(w * dpr);
  this.canvas.height = Math.round(h * dpr);
};
SeqStage.prototype.setPointer = function (nx, ny) {
  this.pointer.tx = nx;
  this.pointer.ty = ny;
  this.pointer.lastMove = this.time;
};
SeqStage.prototype.setReduced = function (b) { this.reduced = b; };
/* прогресс кадров активного и следующего сета (0..1) */
SeqStage.prototype.progress = function () {
  var act = this._lastAct || 0;
  var list = [this.players[this.keys[act]]];
  var nx = this.players[this.keys[Math.min(act + 1, 3)]];
  if (nx) list.push(nx);
  var ld = 0, tot = 0;
  for (var i = 0; i < list.length; i++) {
    if (!list[i]) continue;
    ld += list[i].loaded;
    tot += list[i].man.count;
  }
  return tot ? ld / tot : 0;
};
SeqStage.prototype.intro = function () {
  if (this.introV >= 1) return;
  this.introOn = true;
  this.introT0 = performance.now();
};
SeqStage.prototype.introSkip = function () { this.introV = 1; this.introOn = false; };
SeqStage.prototype.onFirstFrame = function (fn) { if (this.started) fn(); else this.waitFirst = fn; };

SeqStage.prototype.tick = function (dt, sy, tops, vh, outroTop) {
  this.time += dt;
  var t = this.time;
  var W = this.canvas.width, H = this.canvas.height;

  var u = [0, 0, 0];
  for (var i = 0; i < 3; i++) {
    var span = Math.max(tops[i + 1] - tops[i], 1);
    u[i] = clamp01((sy - tops[i]) / span);
  }
  var uOut = clamp01((sy - outroTop) / (vh * 0.92));

  if (this.introOn) {
    this.introV = Math.min(1, (performance.now() - this.introT0) / 1400);
    if (this.introV >= 1) this.introOn = false;
  }

  /* активная пара */
  var act = 0;
  for (var a = 0; a < 4; a++) if (sy >= tops[a] - 1) act = a;
  var uCur = act < 3 ? u[act] : uOut;
  /* следующий сет качаем только когда переход реально начался */
  if (uCur > 0.02 && act < 3) this.loadNext(act + 1);

  /* ракурс: мышь + тихий дрейф при простое */
  if (t - this.pointer.lastMove > 4 && !this.reduced) {
    this.pointer.tx = Math.sin(t * 0.22) * 0.55;
    this.pointer.ty = Math.cos(t * 0.16) * 0.2;
  }
  this.pointer.x = lerp(this.pointer.x, this.pointer.tx, 0.07);
  this.pointer.y = lerp(this.pointer.y, this.pointer.ty, 0.07);
  var angle = 0.5 + this.pointer.x * 0.46;

  var ctx = this.ctx;
  ctx.fillStyle = '#060609';
  ctx.fillRect(0, 0, W, H);

  var introA = smooth(this.introV);
  var oxNext = act < 3 ? this.ox[act + 1] : this.ox[3];
  var oxBase = lerp(this.ox[act], oxNext, smooth(uCur)) * W;
  var ox = oxBase + this.pointer.x * W * 0.012;

  var pCur = this.players[this.keys[act]];
  var pNext = act < 3 ? this.players[this.keys[act + 1]] : null;

  if (pCur && pCur.ready()) {
    /* уходящая: прокрутка ускоряется, лёгкий отъезд и затемнение */
    var spin = (angle + uCur * 1.4) % 1;
    var kOut = 1 - smooth((uCur - 0.18) / 0.5);
    var zoomOut = (1 + smooth(uCur) * 0.07) * 1.09;
    pCur.draw(ctx, W, H, spin, introA * kOut, zoomOut, ox);
  }
  if (pNext && uCur > 0.12) {
    if (!pNext.ready()) this.loadNext(act + 1);
    var kIn = smooth((uCur - 0.35) / 0.55);
    var zoomIn = (1.07 - 0.07 * kIn) * 1.09;
    pNext.draw(ctx, W, H, angle, introA * kIn, zoomIn, ox);
  }
  this._lastAct = act;
  return act;
};

window.SeqStage = SeqStage;
})();
