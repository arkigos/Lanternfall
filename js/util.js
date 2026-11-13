'use strict';
// Lanternfall - shared namespace and helpers
const LF = window.LF = {};
LF.TILE = 32;
LF.TAU = Math.PI * 2;

LF.clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
LF.lerp = (a, b, t) => a + (b - a) * t;
LF.dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
LF.dist2 = (ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; };
LF.rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
LF.randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
LF.pick = arr => arr[Math.floor(Math.random() * arr.length)];
LF.chance = p => Math.random() < p;
LF.angDiff = (a, b) => { let d = (b - a) % LF.TAU; if (d > Math.PI) d -= LF.TAU; if (d < -Math.PI) d += LF.TAU; return d; };
LF.approach = (v, target, delta) => v < target ? Math.min(v + delta, target) : Math.max(v - delta, target);
LF.turnToward = (a, target, maxStep) => { const d = LF.angDiff(a, target); return Math.abs(d) <= maxStep ? target : a + Math.sign(d) * maxStep; };
LF.smooth = t => t * t * (3 - 2 * t);
LF.ease = {
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inCubic: t => t * t * t,
  inOutQuad: t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outElastic: t => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (LF.TAU / 3)) + 1,
};

// Seeded RNG (mulberry32)
LF.RNG = class {
  constructor(seed) { this.s = (seed >>> 0) || 1; }
  next() {
    let t = this.s += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + this.next() * (b - a); }
  int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  chance(p) { return this.next() < p; }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  weighted(items, weightFn) {
    let total = 0;
    for (const it of items) total += weightFn(it);
    let r = this.next() * total;
    for (const it of items) { r -= weightFn(it); if (r <= 0) return it; }
    return items[items.length - 1];
  }
};

// Remove dead items from an array in place (order preserved).
LF.compact = (arr) => {
  let w = 0;
  for (let i = 0; i < arr.length; i++) { const e = arr[i]; if (!e.dead) arr[w++] = e; }
  arr.length = w;
};

LF.fmtTime = (s) => {
  s = Math.floor(s);
  const m = Math.floor(s / 60), r = s % 60;
  return m + ':' + (r < 10 ? '0' : '') + r;
};

// Word-wrap text for canvas; returns array of lines.
LF.wrapText = (ctx, text, maxW) => {
  const out = [];
  for (const para of String(text).split('\n')) {
    const words = para.split(' ');
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { out.push(line); line = w; }
      else line = test;
    }
    out.push(line);
  }
  return out;
};

LF.roundRect = (ctx, x, y, w, h, r) => {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};
