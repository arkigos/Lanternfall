'use strict';
// Renderer: pre-rendered floor, world pass, darkness mask with a ray-cast lantern, glow pass.
(function () {
  const TILE = LF.TILE, TAU = LF.TAU, T = LF.T, fx = LF.fx;
  const LS = 0.5; // light buffer resolution scale

  const rgb = (a, m = 1, add = 0) => `rgb(${Math.round(LF.clamp(a[0] * m + add, 0, 255))},${Math.round(LF.clamp(a[1] * m + add, 0, 255))},${Math.round(LF.clamp(a[2] * m + add, 0, 255))})`;
  const rgba = (a, al) => `rgba(${a[0]},${a[1]},${a[2]},${al})`;

  const sprites = {};
  // Soft radial sprite, cached per colour. Drawn scaled for lights and glows.
  function glow(color) {
    let s = sprites[color];
    if (s) return s;
    s = document.createElement('canvas'); s.width = s.height = 128;
    const c = s.getContext('2d');
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, color); g.addColorStop(0.35, color);
    c.fillStyle = g;
    // build falloff with alpha stops
    const g2 = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g2.addColorStop(0, 'rgba(255,255,255,1)'); g2.addColorStop(0.3, 'rgba(255,255,255,0.75)'); g2.addColorStop(0.65, 'rgba(255,255,255,0.25)'); g2.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g2; c.fillRect(0, 0, 128, 128);
    c.globalCompositeOperation = 'source-in'; c.fillStyle = color; c.fillRect(0, 0, 128, 128);
    sprites[color] = s;
    return s;
  }
  LF.glowSprite = glow;
  function drawGlow(ctx, color, x, y, r, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.drawImage(glow(color), x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
  }
  // ---- floor hazards ----------------------------------------------------------------------
  // A plate you can read at a glance: at rest it is part of the floor, warned its rim beats red
  // and a ring closes in on it, and struck it fills the whole ring it is drawn with.
  const TRAP_RX = 28, TRAP_RY = 22;
  function trapClock(pr, time) {
    const left = pr.period - ((time + pr.phase) % pr.period);
    return { warn: pr.state === 1 ? LF.clamp(1 - (left - 0.65) / 0.9, 0, 1) : 0, act: pr.state === 2 ? LF.clamp(1 - left / 0.65, 0, 1) : 0 };
  }
  function trapSeed(pr) { const h = Math.sin(pr.x * 12.9898 + pr.y * 78.233) * 43758.5453; return h - Math.floor(h); }
  function tongue(ctx, x, y, w, h, sway) {
    ctx.beginPath(); ctx.moveTo(x - w, y);
    ctx.quadraticCurveTo(x - w * 0.5 + sway, y - h * 0.7, x + sway * 1.6, y - h);
    ctx.quadraticCurveTo(x + w * 0.6 + sway * 0.4, y - h * 0.5, x + w, y);
    ctx.closePath(); ctx.fill();
  }
  // The grasp: the one hazard nobody built. A split in the floor that the dark reaches up through.
  const CLAWS = [[-16, -6, -0.5], [-6, -10, -0.2], [7, -9, 0.25], [17, -4, 0.55], [-19, 5, -0.7], [-8, 8, -0.3], [5, 9, 0.2], [16, 7, 0.6], [0, 1, 0.1]];
  function trapRim(ctx, x, y, st, c, time) {
    // the rim is the warning: dull at rest, beating red before the strike, bright while it lasts
    const pulse = 0.5 + 0.5 * Math.sin(time * 14);
    ctx.strokeStyle = st === 2 ? 'rgba(255,90,90,0.95)' : st === 1 ? `rgba(255,90,90,${0.3 + 0.55 * pulse * (0.4 + 0.6 * c.warn)})` : 'rgba(150,140,130,0.2)';
    ctx.lineWidth = st ? 2.2 : 1.2; ctx.beginPath(); ctx.ellipse(x, y, TRAP_RX, TRAP_RY, 0, 0, TAU); ctx.stroke();
    if (st === 1) {
      const k = 1 - c.warn;
      ctx.strokeStyle = `rgba(255,90,90,${0.15 + 0.5 * c.warn})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(x, y, TRAP_RX + 18 * k, TRAP_RY + 14 * k, 0, 0, TAU); ctx.stroke();
    }
  }
  function drawGrasp(ctx, pr, x, y, time) {
    const st = pr.state || 0, c = trapClock(pr, time), RX = TRAP_RX, RY = TRAP_RY, seed = trapSeed(pr), calm = pr.calm > 0;
    // how far the split stands open: a slit when a flare has driven it back, wide when it strikes
    const open = calm ? 0.16 : st === 2 ? 1 : st === 1 ? 0.5 + 0.4 * c.warn : 0.34 + 0.04 * Math.sin(time * 1.5 + seed * 9);
    // hairline cracks running out across the flagstones
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const a = i * TAU / 7 + seed * 4, l1 = 0.9 + ((seed * 31 * (i + 2)) % 1) * 0.35, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(a + 0.22), sb = Math.sin(a + 0.22);
      ctx.beginPath(); ctx.moveTo(x + ca * RX * 0.3, y + sa * RY * 0.3); ctx.lineTo(x + cb * RX * 0.65, y + sb * RY * 0.65); ctx.lineTo(x + ca * RX * l1, y + sa * RY * l1); ctx.stroke();
    }
    // the split itself: a ragged star of black, with a lip of broken stone
    const star = (k, fill) => {
      ctx.fillStyle = fill; ctx.beginPath();
      for (let i = 0; i < 14; i++) {
        const a = i * TAU / 14 + seed * 6, jag = i % 2 ? 0.42 + 0.25 * ((seed * 53 * (i + 1)) % 1) : 1, d = open * jag * k;
        const qx = x + Math.cos(a) * (RX - 3) * d, qy = y + Math.sin(a) * (RY - 3) * d;
        if (i) ctx.lineTo(qx, qy); else ctx.moveTo(qx, qy);
      }
      ctx.closePath(); ctx.fill();
    };
    star(1.12, '#2d2b35'); star(1, '#040207');
    if (st && !calm) { ctx.fillStyle = `rgba(255,45,45,${st === 2 ? 0.3 : 0.1 + 0.18 * c.warn})`; ctx.beginPath(); ctx.ellipse(x, y, RX * 0.42 * open, RY * 0.42 * open, 0, 0, TAU); ctx.fill(); }
    // the reach: fingertips in the warning, the whole hand in the strike, red at the edge like everything of the dark's
    const up = calm ? 0 : st === 2 ? Math.min(1, c.act * 7) * (0.8 + 0.2 * Math.min(1, (1 - c.act) * 4)) : st === 1 ? 0.07 + 0.15 * c.warn : 0;
    if (up > 0) for (let i = 0; i < CLAWS.length; i++) {
      const bx = x + CLAWS[i][0] * 0.82, by = y + CLAWS[i][1] * 0.82, lean = CLAWS[i][2];
      const h = (i === 8 ? 36 : 23 + (i % 3) * 5) * up, wob = Math.sin(time * (st === 1 ? 30 : 9) + i * 1.9) * (st === 1 ? 0.8 : 2.2);
      // each one curls in at the tip, toward whoever is standing there
      const tx = bx - lean * h * 0.4 + wob, ty = by - h, mx = bx + lean * h * 0.32, my = by - h * 0.55;
      ctx.fillStyle = '#07040c'; ctx.beginPath(); ctx.moveTo(bx - 3.4, by); ctx.quadraticCurveTo(mx - 2.6, my, tx, ty); ctx.quadraticCurveTo(mx + 2.6, my, bx + 3.4, by); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = `rgba(255,70,70,${st === 2 ? 0.8 : 0.45})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bx - 3.4, by); ctx.quadraticCurveTo(mx - 2.6, my, tx, ty); ctx.stroke();
    }
    if (calm) {
      // driven back by a flare: a few embers of your own light still sit in the crack
      for (let i = 0; i < 4; i++) { const a = i * 1.6 + seed * 6 + time * 0.6; ctx.fillStyle = `rgba(255,200,120,${0.5 * Math.min(1, pr.calm / 1.5)})`; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 7, y + Math.sin(a) * 5, 1.3, 0, TAU); ctx.fill(); }
      return;
    }
    trapRim(ctx, x, y, st, c, time);
  }
  function drawTrap(ctx, pr, x, y, time) {
    if (pr.sub === 'grasp') { drawGrasp(ctx, pr, x, y, time); return; }
    const st = pr.state || 0, c = trapClock(pr, time), RX = TRAP_RX, RY = TRAP_RY, seed = trapSeed(pr);
    if (pr.sub === 'vent') {
      // soot burnt into the floor round the grate
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
      for (let i = 0; i < 7; i++) {
        const a = i * TAU / 7 + seed * 5, l = 5 + ((seed * 97 * (i + 1)) % 1) * 11, ca = Math.cos(a), sa = Math.sin(a);
        ctx.beginPath(); ctx.moveTo(x + ca * (RX + 2), y + sa * (RY + 2)); ctx.lineTo(x + ca * (RX + 2 + l), y + sa * (RY + 2 + l * 0.75)); ctx.stroke();
      }
    }
    // the setting: a ring of dressed stone sunk into the floor
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(x, y + 1.5, RX + 3.5, RY + 3.5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2d2b35'; ctx.beginPath(); ctx.ellipse(x, y, RX + 2, RY + 2, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y - 0.5, RX + 1.5, RY + 1.5, 0, Math.PI, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + seed * 6, ca = Math.cos(a), sa = Math.sin(a); ctx.beginPath(); ctx.moveTo(x + ca * (RX - 4), y + sa * (RY - 4)); ctx.lineTo(x + ca * (RX + 2), y + sa * (RY + 2)); ctx.stroke(); }
    ctx.fillStyle = '#0b0a10'; ctx.beginPath(); ctx.ellipse(x, y, RX - 4, RY - 4, 0, 0, TAU); ctx.fill();

    if (pr.sub === 'vent') {
      // an iron grate over a fire that is never quite out
      const heat = st === 2 ? 1 : st === 1 ? 0.35 + 0.65 * c.warn : 0.12 + 0.05 * Math.sin(time * 2 + seed * 9);
      ctx.fillStyle = `rgba(255,${Math.round(70 + 100 * heat)},${Math.round(20 + 50 * heat)},${0.22 + 0.7 * heat})`;
      ctx.beginPath(); ctx.ellipse(x, y, RX - 5, RY - 5, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.ellipse(x, y, RX - 4, RY - 4, 0, 0, TAU); ctx.clip();
      ctx.lineCap = 'butt';
      for (let i = -3; i <= 3; i++) {
        ctx.strokeStyle = '#131218'; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(x + i * 7.5, y - RY); ctx.lineTo(x + i * 7.5, y + RY); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.09)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + i * 7.5 - 1.2, y - RY); ctx.lineTo(x + i * 7.5 - 1.2, y + RY); ctx.stroke();
      }
      ctx.strokeStyle = '#131218'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - RX, y); ctx.lineTo(x + RX, y); ctx.stroke();
      ctx.restore();
    } else {
      // a broken drain: black water that swells before it bursts
      const swell = st === 1 ? c.warn : st === 2 ? 1 : 0;
      ctx.fillStyle = '#0f1d26'; ctx.beginPath(); ctx.ellipse(x, y, RX - 5, RY - 5, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(190,225,235,${0.16 + 0.4 * swell})`; ctx.lineWidth = 1.2;
      for (let i = 0; i < 3; i++) { const k = (time * (0.35 + 1.7 * swell) + i / 3 + seed) % 1; ctx.globalAlpha = 1 - k * 0.7; ctx.beginPath(); ctx.ellipse(x, y, (RX - 6) * k, (RY - 6) * k, 0, 0, TAU); ctx.stroke(); }
      ctx.globalAlpha = 1;
      if (st === 1) {
        ctx.fillStyle = `rgba(200,232,240,${0.22 + 0.4 * c.warn})`; ctx.beginPath(); ctx.ellipse(x, y - 2 * c.warn, 6 + 10 * c.warn, 4 + 6 * c.warn, 0, 0, TAU); ctx.fill();
        for (let i = 0; i < 7; i++) {
          const a = i * 0.9 + seed * 6, k = (time * 2.2 + i * 0.37) % 1;
          ctx.fillStyle = `rgba(222,240,246,${0.85 * (1 - k)})`; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 15 * (0.35 + 0.65 * k), y + Math.sin(a) * 10 * (0.35 + 0.65 * k) - k * 6, 1.3 + k * 1.4, 0, TAU); ctx.fill();
        }
      } else if (st === 2) {
        // the column goes up fast and falls back; spray is thrown out to the edge of the ring
        const env = Math.min(1, c.act * 7) * Math.min(1, (1 - c.act) * 3.5), hgt = 50 * env;
        for (let i = 0; i < 5; i++) {
          const k = i / 5;
          ctx.fillStyle = `rgba(${196 + i * 12},${228 + i * 5},${238 + i * 3},${0.5 + k * 0.4})`;
          ctx.beginPath(); ctx.ellipse(x + Math.sin(time * 30 + i * 1.3) * 1.4, y - hgt * k, 13 - i * 2.1, 5 + hgt * 0.16, 0, 0, TAU); ctx.fill();
        }
        for (let i = 0; i < 12; i++) {
          const a = i * TAU / 12 + seed * 4, k = (c.act * 1.25 + (i % 4) * 0.08) % 1, d = 8 + 26 * k;
          ctx.fillStyle = `rgba(226,242,248,${0.9 * (1 - k)})`; ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.78 - Math.sin(k * Math.PI) * 20, 2.4 * (1 - k) + 0.7, 0, TAU); ctx.fill();
        }
      }
    }
    trapRim(ctx, x, y, st, c, time);
  }
  function glowTrap(ctx, pr, x, y, t) {
    const st = pr.state || 0, c = trapClock(pr, t);
    if (pr.sub === 'vent') {
      if (st === 0) { drawGlow(ctx, '#ff5a1e', x, y, 18, 0.1 + 0.03 * Math.sin(t * 3 + pr.x)); return; }
      if (st === 1) {
        drawGlow(ctx, '#ff7b2e', x, y, 22 + 16 * c.warn + Math.sin(t * 16) * 2, 0.2 + 0.25 * c.warn);
        // sparks climbing out between the bars
        for (let i = 0; i < 6; i++) { const k = (t * 1.8 + i * 0.19) % 1; ctx.fillStyle = `rgba(255,190,90,${(1 - k) * (0.3 + 0.7 * c.warn)})`; ctx.beginPath(); ctx.arc(x + Math.sin(i * 2.4 + t * 3) * 14, y - k * 30, 1.4, 0, TAU); ctx.fill(); }
        return;
      }
      // the gout: an outer wall of five tongues, three hotter ones inside it, and a white heart
      const env = Math.min(1, c.act * 8) * Math.min(1, (1 - c.act) * 4);
      ctx.fillStyle = 'rgba(255,84,18,0.6)';
      for (let i = 0; i < 5; i++) tongue(ctx, x + (i - 2) * 7.5, y + 2, 7.5, (34 + (2 - Math.abs(i - 2)) * 13 + Math.sin(t * 24 + i * 2) * 7) * env, Math.sin(t * 9 + i) * 3);
      ctx.fillStyle = 'rgba(255,170,60,0.8)';
      for (let i = 0; i < 3; i++) tongue(ctx, x + (i - 1) * 7, y + 1, 6, (30 + (1 - Math.abs(i - 1)) * 14 + Math.sin(t * 28 + i * 3) * 6) * env, Math.sin(t * 11 + i * 2) * 2.5);
      ctx.fillStyle = 'rgba(255,245,210,0.9)'; tongue(ctx, x, y, 4.5, (26 + Math.sin(t * 31) * 5) * env, Math.sin(t * 13) * 2);
      drawGlow(ctx, '#ff7b2e', x, y - 14, 20 + 40 * env, 0.6);
      ctx.strokeStyle = `rgba(255,200,120,${0.5 * env})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y, TRAP_RX - 3, TRAP_RY - 3, 0, 0, TAU); ctx.stroke();
    } else if (pr.sub === 'geyser') {
      if (st === 1) drawGlow(ctx, '#bfe3ea', x, y, 20 + 10 * c.warn, 0.1 + 0.14 * c.warn);
      else if (st === 2) {
        drawGlow(ctx, '#d4eef4', x, y - 16, 40, 0.3 * (1 - c.act * 0.6));
        ctx.strokeStyle = `rgba(210,235,242,${0.5 * (1 - c.act)})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(x, y, TRAP_RX + 22 * c.act, TRAP_RY + 16 * c.act, 0, 0, TAU); ctx.stroke();
      }
    } else if (pr.calm > 0) drawGlow(ctx, '#ffb347', x, y, 14, 0.12);
    else if (st === 1) drawGlow(ctx, '#ff3a3a', x, y, 24 + 8 * c.warn + Math.sin(t * 16) * 3, 0.16 + 0.14 * c.warn);
    else if (st === 2) drawGlow(ctx, '#ff3a3a', x, y - 8, 36, 0.3 * (1 - c.act * 0.5));
  }
  LF.drawGlow = drawGlow;

  LF.drawTrap = drawTrap; LF.glowTrap = glowTrap;

  class Renderer {
    constructor(game) {
      this.g = game;
      this.light = document.createElement('canvas');
      this.lctx = this.light.getContext('2d');
      this.mapCanvas = null;
    }

    // ------------------------------------------------------------ static map
    buildMap(map, b) {
      const cv = this.mapCanvas = document.createElement('canvas'); this.mapCtx = null;
      cv.width = map.w * TILE; cv.height = map.h * TILE;
      const c = cv.getContext('2d');
      const rng = new LF.RNG((map.seed || 1) + 99);
      c.fillStyle = '#000'; c.fillRect(0, 0, cv.width, cv.height);
      const open = (x, y) => { const t = map.get(x, y); return t === T.FLOOR || t === T.WATER || t === T.PILLAR; };
      for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
        const t = map.get(x, y), v = map.variant[map.idx(x, y)] / 255, px = x * TILE, py = y * TILE;
        if (t === T.FLOOR || t === T.WATER || t === T.PILLAR) {
          c.fillStyle = rgb(b.floor, 0.84 + v * 0.26);
          c.fillRect(px, py, TILE, TILE);
          c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 1;
          c.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
          if (v > 0.62) { c.beginPath(); c.moveTo(px, py + 16.5); c.lineTo(px + TILE, py + 16.5); c.stroke(); }
          else if (v < 0.22) { c.beginPath(); c.moveTo(px + 16.5, py); c.lineTo(px + 16.5, py + TILE); c.stroke(); }
          c.fillStyle = 'rgba(255,255,255,0.035)'; c.fillRect(px + 1, py + 1, TILE - 2, 1.5);
          // grit
          for (let i = 0; i < 3; i++) { c.fillStyle = rng.chance(0.5) ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.04)'; c.fillRect(px + rng.int(2, 28), py + rng.int(2, 28), rng.int(1, 3), rng.int(1, 2)); }
          if (rng.chance(0.07)) { // crack
            c.strokeStyle = 'rgba(0,0,0,0.4)'; c.beginPath(); let cx = px + rng.int(4, 28), cy = py + rng.int(4, 28); c.moveTo(cx, cy);
            for (let i = 0; i < 4; i++) { cx += rng.int(-7, 7); cy += rng.int(-7, 7); c.lineTo(cx, cy); } c.stroke();
          }
          if (rng.chance(0.05)) { c.fillStyle = b.accent; c.globalAlpha = 0.07; c.beginPath(); c.arc(px + rng.int(6, 26), py + rng.int(6, 26), rng.int(3, 7), 0, TAU); c.fill(); c.globalAlpha = 1; }
          if (t === T.WATER) { c.fillStyle = rgba(b.water, 0.62); c.fillRect(px, py, TILE, TILE); }
        } else if (t === T.WALL) {
          c.fillStyle = rgb(b.wallTop, 0.85 + v * 0.3);
          c.fillRect(px, py, TILE, TILE);
          for (let i = 0; i < 2; i++) { c.fillStyle = 'rgba(255,255,255,0.025)'; c.fillRect(px + rng.int(2, 26), py + rng.int(2, 26), rng.int(2, 5), 1); }
        }
      }
      // second pass: wall faces, lips, shadows, water banks
      for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
        const t = map.get(x, y), px = x * TILE, py = y * TILE, v = map.variant[map.idx(x, y)] / 255;
        if (t === T.WALL) {
          if (open(x, y + 1)) {
            const fy = py + 10, fh = TILE - 10;
            const gr = c.createLinearGradient(0, fy, 0, fy + fh);
            gr.addColorStop(0, rgb(b.wallFace, 1.05 + v * 0.1)); gr.addColorStop(1, rgb(b.wallFace, 0.55));
            c.fillStyle = gr; c.fillRect(px, fy, TILE, fh);
            c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1;
            c.beginPath(); c.moveTo(px, fy + 8.5); c.lineTo(px + TILE, fy + 8.5); c.moveTo(px, fy + 15.5); c.lineTo(px + TILE, fy + 15.5);
            const off = (y % 2) * 8;
            c.moveTo(px + 8.5 + off, fy); c.lineTo(px + 8.5 + off, fy + 8); c.moveTo(px + 24.5 - off, fy + 8); c.lineTo(px + 24.5 - off, fy + 15); c.moveTo(px + 12.5 + off, fy + 15); c.lineTo(px + 12.5 + off, fy + fh);
            c.stroke();
            c.fillStyle = 'rgba(255,255,255,0.10)'; c.fillRect(px, fy - 1, TILE, 1.5); // lip
            if (rng.chance(0.14)) { c.fillStyle = b.accent; c.globalAlpha = 0.12; c.fillRect(px + rng.int(3, 24), fy + 2, rng.int(2, 5), rng.int(8, 18)); c.globalAlpha = 1; }
          }
          c.fillStyle = 'rgba(255,255,255,0.07)';
          if (open(x, y - 1)) c.fillRect(px, py, TILE, 1.5);
          if (open(x - 1, y)) c.fillRect(px, py, 1.5, TILE);
          if (open(x + 1, y)) c.fillRect(px + TILE - 1.5, py, 1.5, TILE);
        } else if (t === T.FLOOR || t === T.WATER) {
          const solidN = map.get(x, y - 1) === T.WALL, solidW = map.get(x - 1, y) === T.WALL, solidE = map.get(x + 1, y) === T.WALL;
          if (solidN) { const gr = c.createLinearGradient(0, py, 0, py + 14); gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(px, py, TILE, 14); }
          if (solidW) { const gr = c.createLinearGradient(px, 0, px + 8, 0); gr.addColorStop(0, 'rgba(0,0,0,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(px, py, 8, TILE); }
          if (solidE) { const gr = c.createLinearGradient(px + TILE, 0, px + TILE - 8, 0); gr.addColorStop(0, 'rgba(0,0,0,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(px + TILE - 8, py, 8, TILE); }
          if (t === T.WATER) {
            c.strokeStyle = 'rgba(190,235,255,0.10)'; c.lineWidth = 1.5; c.beginPath();
            if (map.get(x, y - 1) !== T.WATER) { c.moveTo(px, py + 1); c.lineTo(px + TILE, py + 1); }
            if (map.get(x, y + 1) !== T.WATER) { c.moveTo(px, py + TILE - 1); c.lineTo(px + TILE, py + TILE - 1); }
            if (map.get(x - 1, y) !== T.WATER) { c.moveTo(px + 1, py); c.lineTo(px + 1, py + TILE); }
            if (map.get(x + 1, y) !== T.WATER) { c.moveTo(px + TILE - 1, py); c.lineTo(px + TILE - 1, py + TILE); }
            c.stroke();
          }
        }
      }
      // biome dressing: decals scattered over open floor, so each third of the descent has its own look
      this.glowDecals = []; this.sigil = null;
      const bi = Math.max(0, LF.BIOMES.indexOf(b));
      for (let y = 1; y < map.h - 1; y++) for (let x = 1; x < map.w - 1; x++) {
        if (map.get(x, y) !== T.FLOOR) continue;
        const r = rng.next(), px = x * TILE + 16, py = y * TILE + 16;
        const jx = px + rng.range(-8, 8), jy = py + rng.range(-8, 8);
        if (bi === 0) {
          if (r < 0.035) { // weed
            c.strokeStyle = 'rgba(70,150,125,0.38)'; c.lineWidth = 1.4; c.lineCap = 'round';
            for (let i = 0; i < 3; i++) { const a = rng.range(0, 6.28), l = rng.range(6, 13); c.beginPath(); c.moveTo(jx, jy); c.quadraticCurveTo(jx + Math.cos(a) * l * 0.5 + rng.range(-4, 4), jy + Math.sin(a) * l * 0.5 + rng.range(-4, 4), jx + Math.cos(a) * l, jy + Math.sin(a) * l); c.stroke(); }
          } else if (r < 0.06) { // barnacles
            for (let i = 0; i < 5; i++) { const bx = jx + rng.range(-6, 6), by = jy + rng.range(-6, 6), br = rng.range(1.2, 2.6); c.fillStyle = 'rgba(200,220,220,0.16)'; c.beginPath(); c.arc(bx, by, br, 0, TAU); c.fill(); c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.arc(bx, by, br * 0.4, 0, TAU); c.fill(); }
          } else if (r < 0.068) { // a lost coin
            c.fillStyle = 'rgba(230,190,90,0.55)'; c.beginPath(); c.ellipse(jx, jy, 2.4, 1.6, rng.range(0, 3), 0, TAU); c.fill();
          } else if (r < 0.078) { // wet ring
            c.strokeStyle = 'rgba(150,210,230,0.10)'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(jx, jy, rng.range(7, 12), rng.range(4, 7), 0, 0, TAU); c.stroke();
          }
        } else if (bi === 1) {
          if (r < 0.04) { // bone
            const a = rng.range(0, 3.14), l = rng.range(5, 9), dx = Math.cos(a) * l, dy = Math.sin(a) * l;
            c.strokeStyle = 'rgba(214,204,184,0.36)'; c.lineWidth = 1.8; c.lineCap = 'round'; c.beginPath(); c.moveTo(jx - dx, jy - dy); c.lineTo(jx + dx, jy + dy); c.stroke();
            c.fillStyle = 'rgba(214,204,184,0.36)'; c.beginPath(); c.arc(jx - dx, jy - dy, 1.8, 0, TAU); c.arc(jx + dx, jy + dy, 1.8, 0, TAU); c.fill();
          } else if (r < 0.052) { // skull
            c.fillStyle = 'rgba(214,204,184,0.4)'; c.beginPath(); c.arc(jx, jy, 4.2, 0, TAU); c.fill(); c.fillRect(jx - 2.4, jy + 2.5, 4.8, 3);
            c.fillStyle = 'rgba(0,0,0,0.6)'; c.beginPath(); c.arc(jx - 1.6, jy - 0.4, 1.1, 0, TAU); c.arc(jx + 1.6, jy - 0.4, 1.1, 0, TAU); c.fill();
          } else if (r < 0.09 && map.get(x - 1, y) === T.WALL && map.get(x, y - 1) === T.WALL) { // cobweb in a corner
            const ox = x * TILE, oy = y * TILE;
            c.strokeStyle = 'rgba(225,225,235,0.14)'; c.lineWidth = 0.8;
            for (let i = 0; i <= 4; i++) { const a = i / 4 * 1.5708; c.beginPath(); c.moveTo(ox, oy); c.lineTo(ox + Math.cos(a) * 24, oy + Math.sin(a) * 24); c.stroke(); }
            for (const rr of [9, 16, 23]) { c.beginPath(); c.arc(ox, oy, rr, 0, 1.5708); c.stroke(); }
          } else if (r < 0.1) { // spilled wax
            c.fillStyle = 'rgba(233,220,196,0.13)'; c.beginPath(); c.ellipse(jx, jy, rng.range(3, 6), rng.range(2, 4), rng.range(0, 3), 0, TAU); c.fill();
          }
        } else {
          if (r < 0.032) { // a smouldering crack: also drawn in the glow pass, so it shows in the dark
            const pts = [jx, jy]; let cx = jx, cy = jy; const a0 = rng.range(0, 6.28);
            for (let i = 0; i < 5; i++) { cx += Math.cos(a0 + rng.range(-0.9, 0.9)) * rng.range(4, 9); cy += Math.sin(a0 + rng.range(-0.9, 0.9)) * rng.range(4, 9); pts.push(cx, cy); }
            c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 2.4; c.lineJoin = 'round'; c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.stroke();
            c.strokeStyle = 'rgba(150,30,24,0.7)'; c.lineWidth = 1; c.stroke();
            this.glowDecals.push({ pts, ph: rng.range(0, 6.28), x: jx, y: jy });
          } else if (r < 0.055) { // obsidian shard
            const a = rng.range(0, 6.28), l = rng.range(4, 8);
            c.fillStyle = 'rgba(8,4,6,0.85)'; c.beginPath(); c.moveTo(jx + Math.cos(a) * l, jy + Math.sin(a) * l); c.lineTo(jx + Math.cos(a + 2.3) * l * 0.6, jy + Math.sin(a + 2.3) * l * 0.6); c.lineTo(jx + Math.cos(a - 2.3) * l * 0.5, jy + Math.sin(a - 2.3) * l * 0.5); c.closePath(); c.fill();
            c.strokeStyle = 'rgba(255,150,150,0.16)'; c.lineWidth = 0.8; c.stroke();
          }
        }
      }
      // a great sigil marks each boss arena
      if (map.boss) {
        const ar = map.rooms[0], sx = ar.cx * TILE, sy = ar.cy * TILE, sr = 170;
        c.save(); c.strokeStyle = b.accent; c.fillStyle = b.accent; c.globalAlpha = 0.16; c.lineWidth = 2.5;
        c.beginPath(); c.arc(sx, sy, sr, 0, TAU); c.stroke();
        c.lineWidth = 1.2; c.beginPath(); c.arc(sx, sy, sr - 12, 0, TAU); c.stroke(); c.beginPath(); c.arc(sx, sy, sr * 0.45, 0, TAU); c.stroke();
        const spokes = 6 + bi * 3;
        for (let i = 0; i < spokes; i++) {
          const a = i / spokes * TAU - Math.PI / 2;
          c.beginPath(); c.moveTo(sx + Math.cos(a) * sr * 0.45, sy + Math.sin(a) * sr * 0.45); c.lineTo(sx + Math.cos(a) * (sr - 12), sy + Math.sin(a) * (sr - 12)); c.stroke();
          const ga = a + Math.PI / spokes, gx = sx + Math.cos(ga) * sr * 0.74, gy = sy + Math.sin(ga) * sr * 0.74;
          c.beginPath(); c.moveTo(gx, gy - 7); c.lineTo(gx + 5, gy); c.lineTo(gx, gy + 7); c.lineTo(gx - 5, gy); c.closePath(); c.stroke();
        }
        c.restore();
        this.sigil = { x: sx, y: sy, r: sr, color: b.accent };
      }
      // pillars on top
      for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
        if (map.get(x, y) !== T.PILLAR) continue;
        const px = x * TILE, py = y * TILE;
        c.fillStyle = 'rgba(0,0,0,0.45)'; c.beginPath(); c.ellipse(px + 16, py + 30, 17, 6, 0, 0, TAU); c.fill();
        const gr = c.createLinearGradient(0, py + 6, 0, py + 31);
        gr.addColorStop(0, rgb(b.wallFace, 1.1)); gr.addColorStop(1, rgb(b.wallFace, 0.5));
        c.fillStyle = gr; c.fillRect(px + 3, py + 6, 26, 25);
        c.strokeStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.moveTo(px + 3, py + 17.5); c.lineTo(px + 29, py + 17.5); c.moveTo(px + 3, py + 24.5); c.lineTo(px + 29, py + 24.5); c.stroke();
        c.fillStyle = rgb(b.wallTop, 1.9); LF.roundRect(c, px + 1, py - 6, 30, 16, 3); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(px + 3, py - 5, 26, 1.5);
      }
    }

    // permanent ink stain where a shadow died
    splat(x, y, r) {
      if (!this.mapCanvas) return;
      const c = this.mapCtx || (this.mapCtx = this.mapCanvas.getContext('2d'));
      c.fillStyle = 'rgba(8,4,16,0.5)';
      for (let i = 0; i < 6; i++) {
        const a = Math.random() * TAU, d = Math.random() * r * 1.2, rr = r * (0.2 + Math.random() * 0.5);
        c.beginPath(); c.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d, rr, rr * (0.5 + Math.random() * 0.5), Math.random() * TAU, 0, TAU); c.fill();
      }
      c.fillStyle = 'rgba(60,30,100,0.22)';
      c.beginPath(); c.arc(x, y, r * 0.6, 0, TAU); c.fill();
    }

    applyCam(ctx, scale) {
      const g = this.g, c = g.cam, cv = g.canvas, z = c.zoom * scale;
      ctx.setTransform(z, 0, 0, z, cv.width / 2 * scale - (c.x + c.sx) * z, cv.height / 2 * scale - (c.y + c.sy) * z);
    }

    // ------------------------------------------------------------ frame
    draw() {
      const g = this.g, ctx = g.ctx, cv = g.canvas, p = g.player, map = g.map, c = g.cam;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height);
      if (!map || !p) return;
      const vw = cv.width / c.zoom, vh = cv.height / c.zoom;
      const vx0 = c.x + c.sx - vw / 2, vy0 = c.y + c.sy - vh / 2;
      const inView = (x, y, m = 60) => x > vx0 - m && x < vx0 + vw + m && y > vy0 - m && y < vy0 + vh + m;
      this.applyCam(ctx, 1);

      // floor
      const sx = Math.max(0, Math.floor(vx0)), sy = Math.max(0, Math.floor(vy0));
      const sw = Math.min(this.mapCanvas.width - sx, Math.ceil(vw) + 2), sh = Math.min(this.mapCanvas.height - sy, Math.ceil(vh) + 2);
      if (sw > 0 && sh > 0) ctx.drawImage(this.mapCanvas, sx, sy, sw, sh, sx, sy, sw, sh);

      // water shimmer
      const tx0 = Math.max(0, Math.floor(vx0 / TILE)), tx1 = Math.min(map.w - 1, Math.floor((vx0 + vw) / TILE));
      const ty0 = Math.max(0, Math.floor(vy0 / TILE)), ty1 = Math.min(map.h - 1, Math.floor((vy0 + vh) / TILE));
      ctx.lineWidth = 1.2; ctx.lineCap = 'round';
      for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
        if (map.tiles[y * map.w + x] !== T.WATER) continue;
        const v = map.variant[y * map.w + x], px = x * TILE, py = y * TILE;
        const a = 0.10 + 0.10 * Math.sin(g.time * 1.6 + v * 0.3) + (g.tideHigh ? 0.3 : 0);
        if (g.tideHigh) { ctx.fillStyle = 'rgba(40,120,150,0.28)'; ctx.fillRect(px, py, TILE, TILE); }
        ctx.strokeStyle = `rgba(200,240,255,${a})`;
        const ox = Math.sin(g.time * 0.8 + v) * 4;
        ctx.beginPath(); ctx.moveTo(px + 5 + ox, py + 9 + (v % 9)); ctx.lineTo(px + 16 + ox, py + 9 + (v % 9));
        ctx.moveTo(px + 15 - ox, py + 22 - (v % 5)); ctx.lineTo(px + 27 - ox, py + 22 - (v % 5)); ctx.stroke();
      }

      // sealed gates
      for (const r of map.rooms) {
        if (!r.sealed) continue;
        for (const gt of r.gates) {
          const px = gt.x * TILE, py = gt.y * TILE;
          ctx.fillStyle = '#0a0612'; ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = 'rgba(120,70,190,0.35)';
          for (let i = 0; i < 3; i++) { const yy = (g.time * 30 + i * 11 + gt.x * 7) % TILE; ctx.fillRect(px + 2, py + yy, TILE - 4, 2); }
        }
      }

      // Wax the lantern has laid on the floor. Every pool goes into one path and is filled once, so pools that
      // overlap run together into one puddle with one edge, in place of stacking into a white smear.
      {
        const pools = g.zones.filter(z => z.kind === 'tallow' && !z.dead && inView(z.x, z.y, z.r + 30));
        if (pools.length) {
          // a pool's outline: an uneven ring, the same every frame because it is seeded from where the pool lies.
          // It spreads as it lands and draws in as it dries.
          const trace = (z, scale, pad, ox, oy) => {
            const sd = z.x * 0.731 + z.y * 0.197, n = Math.max(10, Math.min(28, Math.round(z.r / 5) + 8));
            const s = scale * Math.min(1, 0.5 + (z.t || 0) / 0.3 * 0.5) * (z.life < 0.9 ? 0.55 + 0.45 * z.life / 0.9 : 1);
            const at = i => {
              const a = i / n * TAU;
              const w = 0.86 + 0.13 * Math.sin(a * 2 + sd) + 0.09 * Math.sin(a * 3 + sd * 2.3) + 0.06 * Math.sin(a * 5 + sd * 4.1) + 0.04 * Math.sin(a * 9 + sd * 7.7);
              const rr = z.r * s * w + pad;
              return [z.x + ox + Math.cos(a) * rr, z.y + oy + Math.sin(a) * rr * 0.84];
            };
            let [px, py] = at(0), [qx, qy] = at(1);
            ctx.moveTo((px + qx) / 2, (py + qy) / 2);
            for (let i = 1; i <= n; i++) { [px, py] = at(i); [qx, qy] = at(i + 1); ctx.quadraticCurveTo(px, py, (px + qx) / 2, (py + qy) / 2); }
            ctx.closePath();
            // runnels: two or three drops that have crept out past the edge
            if (z.r >= 18 && scale === 1) for (let k = 0, nk = z.r >= 30 ? 3 : Math.abs(Math.sin(sd * 9.1)) < 0.3 ? 1 : 0; k < nk; k++) {
              const a = sd * (k + 1.7) % TAU, d = z.r * s * (0.98 + 0.14 * Math.abs(Math.sin(sd * (k + 3)))), dr = Math.max(2.2, z.r * s * (0.09 + 0.07 * Math.abs(Math.sin(sd * (k + 5))))) + pad;
              const dx = z.x + ox + Math.cos(a) * d, dy = z.y + oy + Math.sin(a) * d * 0.84;
              ctx.moveTo(dx + dr, dy); ctx.arc(dx, dy, dr, 0, TAU);
            }
          };
          const fillAll = (style, scale, pad, ox, oy) => { ctx.fillStyle = style; ctx.beginPath(); for (const z of pools) trace(z, scale, pad, ox, oy); ctx.fill(); };
          fillAll('rgba(20,14,10,0.45)', 1, 3.5, 1, 2.5);       // the shadow it throws on the stone
          fillAll('rgba(104,84,52,0.9)', 1, 1.6, 0, 0);        // the thin dark lip where it has cooled
          fillAll('rgba(186,168,126,0.84)', 1, 0, 0, 0);       // the body of the wax: the stone still shows through a little
          fillAll('rgba(214,198,158,0.6)', 0.7, 0, -1, -1.5);  // thicker, paler wax toward the middle
          // a wet shine on each pool: one soft streak and a bright point
          for (const z of pools) {
            if (z.r < 14 || z.life < 0.9) continue;
            const sd = z.x * 0.731 + z.y * 0.197, hx = z.x - z.r * 0.28 + Math.sin(sd) * z.r * 0.12, hy = z.y - z.r * 0.3 + Math.cos(sd * 1.3) * z.r * 0.08;
            ctx.strokeStyle = 'rgba(255,250,232,0.55)'; ctx.lineWidth = Math.max(1.2, z.r * 0.05); ctx.lineCap = 'round';
            ctx.beginPath(); ctx.ellipse(hx, hy, z.r * 0.26, z.r * 0.13, -0.5, Math.PI * 1.05, Math.PI * 1.75); ctx.stroke();
            ctx.fillStyle = 'rgba(255,253,244,0.8)'; ctx.beginPath(); ctx.arc(hx + z.r * 0.16, hy - z.r * 0.04, Math.max(0.9, z.r * 0.035), 0, TAU); ctx.fill();
          }
        }
      }

      // props (bodies)
      for (const pr of g.props) if (inView(pr.x, pr.y, 80)) this.drawProp(ctx, pr, g);

      // dark particles, enemies, player
      fx.draw(ctx, false);
      for (const e of g.enemies) if (!e.dead && inView(e.x, e.y, 140)) e.draw(ctx, g);
      if (!p.dead) p.draw(ctx);

      // ---------------- darkness ----------------
      const L = this.light, lc = this.lctx;
      const lw = Math.ceil(cv.width * LS), lh = Math.ceil(cv.height * LS);
      if (L.width !== lw || L.height !== lh) { L.width = lw; L.height = lh; }
      lc.setTransform(1, 0, 0, 1, 0, 0);
      lc.globalCompositeOperation = 'source-over';
      const amb = g.biome.ambient;
      lc.fillStyle = `rgba(${amb[0]},${amb[1]},${amb[2]},${g.biome.dark})`;
      lc.clearRect(0, 0, lw, lh); lc.fillRect(0, 0, lw, lh);
      lc.globalCompositeOperation = 'destination-out';
      this.applyCam(lc, LS);
      const flick = 1 + Math.sin(g.time * 13) * 0.012 + Math.sin(g.time * 5.1) * 0.014;
      let poly = null, R = 0;
      if (!p.dead) {
        R = p.lightR * flick;
        poly = map.visPoly(p.x, p.y, R, 300, 14);
        const gr = lc.createRadialGradient(p.x, p.y, 0, p.x, p.y, R);
        gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.95)'); gr.addColorStop(0.8, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        lc.fillStyle = gr; this.polyPath(lc, poly); lc.fill();
        // The dark presses in on the rim of the light: slow tongues of shadow that breathe inward,
        // reaching further the lower the flame burns. Other lights drawn after this still cut through them.
        lc.globalCompositeOperation = 'source-over';
        const press = 0.3 + 0.7 * (1 - Math.min(1, p.frac())) + 0.5 * (p.dim || 0);
        for (let i = 0; i < 12; i++) {
          const a = i / 12 * TAU + Math.sin(g.time * 0.21 + i * 1.7) * 0.4;
          const k = 0.5 + 0.5 * Math.sin(g.time * (0.45 + (i % 3) * 0.19) + i * 2.3);
          const d = R * (1.0 - (0.05 + 0.13 * press) * k), br = R * (0.15 + 0.07 * press);
          const bx = p.x + Math.cos(a) * d, by = p.y + Math.sin(a) * d;
          const tg = lc.createRadialGradient(bx, by, 0, bx, by, br);
          tg.addColorStop(0, `rgba(${amb[0]},${amb[1]},${amb[2]},${Math.min(0.85, 0.25 + 0.45 * press)})`); tg.addColorStop(1, `rgba(${amb[0]},${amb[1]},${amb[2]},0)`);
          lc.fillStyle = tg; lc.beginPath(); lc.arc(bx, by, br, 0, TAU); lc.fill();
        }
        lc.globalCompositeOperation = 'destination-out';
        // a faint halo so the player never fully vanishes behind corners
        lc.drawImage(glow('#ffffff'), p.x - 34, p.y - 34, 68, 68);
      }
      for (const b of g.litBraziers) {
        if (!inView(b.x, b.y, 200)) continue;
        const br = 170 * (1 + Math.sin(g.time * 9 + b.x) * 0.02);
        const gr = lc.createRadialGradient(b.x, b.y, 0, b.x, b.y, br);
        gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.85)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        lc.fillStyle = gr; this.polyPath(lc, b.poly); lc.fill();
      }
      const white = glow('#ffffff');
      for (const z of g.zones) {
        const k = Math.min(1, z.life / (z.kind === 'light' ? 1.5 : 0.5));
        if (z.kind === 'light') { lc.globalAlpha = 0.85 * k; lc.drawImage(white, z.x - z.r * 1.25, z.y - z.r * 1.25, z.r * 2.5, z.r * 2.5); }
        else if (z.kind === 'beacon') { lc.globalAlpha = k; lc.drawImage(white, z.x - z.r * 1.4, z.y - z.r * 1.4, z.r * 2.8, z.r * 2.8); }
        else if (z.kind === 'fire') { lc.globalAlpha = 0.7 * k; lc.drawImage(white, z.x - 50, z.y - 50, 100, 100); }
        else if (z.kind === 'wax') { lc.globalAlpha = 0.65 * k; lc.drawImage(white, z.x - z.r * 1.8, z.y - z.r * 1.8, z.r * 3.6, z.r * 3.6); }
      }
      // lamps carried by censers and moths
      lc.globalAlpha = 0.8;
      for (const c of (g.player && g.player.carried) || []) if (inView(c.x, c.y, c.r * 2)) lc.drawImage(white, c.x - c.r * 1.3, c.y - c.r * 1.3, c.r * 2.6, c.r * 2.6);
      // a creature carrying a light of its own shows in the dark
      lc.globalAlpha = 0.8;
      for (const e of g.enemies) if (!e.dead && e.selfGlow && e.spawnT <= 0) lc.drawImage(white, e.x - 58, e.y - 58, 116, 116);
      for (const f of g.flashes) { lc.globalAlpha = f.life / f.max; lc.drawImage(white, f.x - f.r, f.y - f.r, f.r * 2, f.r * 2); }
      lc.globalAlpha = 0.75;
      for (const b of g.bullets) lc.drawImage(white, b.x - 38, b.y - 38, 76, 76);
      lc.globalAlpha = 0.5;
      for (const pk of g.pickups) { const r = pk.kind === 'relic' ? 60 : pk.kind === 'ember' ? 26 : 16; lc.drawImage(white, pk.x - r, pk.y - r, r * 2, r * 2); }
      for (const pr of g.props) {
        if (!inView(pr.x, pr.y, 120)) continue;
        if (pr.kind === 'exit' && !pr.hidden) { if (g.victoryReady && g.mode === 'descent') { const hs = g.loop >= 4 ? 300 : 180; lc.globalAlpha = 1; lc.drawImage(white, pr.x - hs, pr.y - hs, hs * 2, hs * 2); } else { lc.globalAlpha = 0.6; lc.drawImage(white, pr.x - 70, pr.y - 70, 140, 140); } }
        else if (pr.kind === 'chest' && !pr.opened) { lc.globalAlpha = 0.45; lc.drawImage(white, pr.x - 46, pr.y - 46, 92, 92); }
        else if (pr.kind === 'shrine' && !pr.used) { lc.globalAlpha = 0.5; lc.drawImage(white, pr.x - 60, pr.y - 60, 120, 120); }
        else if (pr.kind === 'pedestal' && !pr.sold) { lc.globalAlpha = 0.5; lc.drawImage(white, pr.x - 44, pr.y - 44, 88, 88); }
        else if (pr.kind === 'font' && !pr.used) { lc.globalAlpha = 0.6; lc.drawImage(white, pr.x - 70, pr.y - 70, 140, 140); }
        else if (pr.kind === 'shopkeeper') { lc.globalAlpha = 0.6; lc.drawImage(white, pr.x - 80, pr.y - 80, 160, 160); }
        else if ((pr.kind === 'statue' || pr.kind === 'trial') && !pr.used) { lc.globalAlpha = 0.5; lc.drawImage(white, pr.x - 60, pr.y - 60, 120, 120); }
        else if (pr.kind === 'trap' && pr.state) { lc.globalAlpha = pr.state === 2 ? 0.7 : 0.4; lc.drawImage(white, pr.x - 46, pr.y - 46, 92, 92); }
        else if (pr.kind === 'lamp' && pr.lit) { lc.globalAlpha = 0.62; lc.drawImage(white, pr.x - 84, pr.y - 76, 168, 168); }
      }
      for (const e of g.enemies) if (!e.dead && e.def.light) e.def.light(e, lc, white, g);
      lc.globalAlpha = 1;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(L, 0, 0, lw, lh, 0, 0, cv.width, cv.height);

      // ---------------- warm tint + glow pass ----------------
      this.applyCam(ctx, 1);
      ctx.globalCompositeOperation = 'lighter';
      if (poly) {
        ctx.save(); this.polyPath(ctx, poly); ctx.clip();
        const f = p.frac();
        const warm = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R);
        warm.addColorStop(0, `rgba(255,170,80,${0.20 + 0.06 * f})`); warm.addColorStop(0.6, 'rgba(255,140,60,0.07)'); warm.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.fillStyle = warm; ctx.fillRect(p.x - R, p.y - R, R * 2, R * 2);
        // dust motes drifting through the lantern light
        const cell = 84, c0x = Math.floor((p.x - R) / cell), c1x = Math.floor((p.x + R) / cell), c0y = Math.floor((p.y - R) / cell), c1y = Math.floor((p.y + R) / cell);
        for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) {
          const h = Math.sin(cx * 127.1 + cy * 311.7) * 43758.5453, fr = h - Math.floor(h);
          const h2 = Math.sin(cx * 269.5 + cy * 183.3) * 43758.5453, fr2 = h2 - Math.floor(h2);
          const mx = (cx + fr) * cell + Math.sin(g.time * 0.5 + fr * 20) * 10, my = (cy + fr2) * cell + Math.cos(g.time * 0.37 + fr2 * 20) * 10 - ((g.time * 4 + fr * 50) % 20);
          const d = Math.hypot(mx - p.x, my - p.y) / R;
          if (d >= 1) continue;
          ctx.fillStyle = `rgba(255,220,170,${(1 - d) * (0.22 + 0.2 * Math.sin(g.time * 1.7 + fr * 30))})`;
          ctx.beginPath(); ctx.arc(mx, my, 0.9 + fr2 * 0.9, 0, TAU); ctx.fill();
        }
        ctx.restore();
      }
      for (const b of g.litBraziers) if (inView(b.x, b.y, 200)) drawGlow(ctx, '#ff9a3d', b.x, b.y, 150, 0.2);
      for (const z of g.zones) {
        const k = Math.min(1, z.life / 0.6);
        if (z.ward) {
          drawGlow(ctx, '#ffe9a8', z.x, z.y, z.r * 1.2, 0.34 * k);
          ctx.strokeStyle = `rgba(255,236,190,${0.85 * k})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, TAU); ctx.stroke();
          ctx.strokeStyle = `rgba(255,190,96,${0.5 * k})`; ctx.lineWidth = 1.5; ctx.setLineDash([10, 9]); ctx.lineDashOffset = -g.time * 40; ctx.beginPath(); ctx.arc(z.x, z.y, z.r - 7, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        } else if (z.kind === 'beacon') { drawGlow(ctx, '#ffe9a8', z.x, z.y, z.r * 1.1, 0.3 * k); drawGlow(ctx, '#ffffff', z.x, z.y - 6, 16 + Math.sin(g.time * 12) * 3, 0.9 * k); }
        else if (z.kind === 'candle') {
          // the Standing Candle: a pale stub and its flame, brightening as the next flare comes
          const kp = 1 - LF.clamp(z.pulse / 2, 0, 1);
          ctx.fillStyle = `rgba(240,226,192,${0.9 * k})`; ctx.fillRect(z.x - 4, z.y - 16, 8, 18); ctx.beginPath(); ctx.ellipse(z.x, z.y + 2, 9, 4, 0, 0, TAU); ctx.fill();
          drawGlow(ctx, '#ffd9a0', z.x, z.y - 22, 14 + 14 * kp + Math.sin(g.time * 11) * 2, (0.55 + 0.4 * kp) * k);
          ctx.fillStyle = `rgba(255,250,230,${k})`; ctx.beginPath(); ctx.ellipse(z.x, z.y - 21, 2.6, 5, 0, 0, TAU); ctx.fill();
        }
        else if (z.kind === 'fire') drawGlow(ctx, '#ff7b2e', z.x, z.y, z.r * 1.6, 0.5 * k);
        else if (z.kind === 'wax') {
          drawGlow(ctx, '#ff9a3d', z.x, z.y, z.r * 1.5, 0.45 * k);
          ctx.fillStyle = `rgba(255,214,150,${0.5 * k})`; ctx.beginPath(); ctx.ellipse(z.x, z.y, z.r * 0.8, z.r * 0.62, 0, 0, TAU); ctx.fill();
          ctx.strokeStyle = `rgba(255,120,50,${0.8 * k})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(z.x, z.y, z.r * (0.92 + Math.sin(g.time * 5 + z.x) * 0.04), z.r * 0.74, 0, 0, TAU); ctx.stroke();
        }
        else if (z.kind === 'light') {
          drawGlow(ctx, '#ffd9a0', z.x, z.y, z.r, 0.10 * Math.min(1, z.life / 2));
          // Glowing Flare: the light a flare left is where embers come back, so its edge is shown, fading as it runs out
          if (z.flare && g.player.stats.flareGlow) { const k2 = Math.min(1, z.life / 1.5); drawGlow(ctx, '#ffe9a8', z.x, z.y, z.r * 0.9, 0.08 * k2); ctx.strokeStyle = `rgba(255,226,150,${0.38 * k2})`; ctx.lineWidth = 1.5; ctx.setLineDash([3, 11]); ctx.lineDashOffset = g.time * 14; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
        }
        // (the lantern's own wax is drawn on the floor itself, with the props: see "Wax the lantern has laid")
      }
      for (const f of g.flashes) drawGlow(ctx, f.color, f.x, f.y, f.r, (g.meta.flash === 0 ? 0.22 : 0.5) * f.life / f.max);
      if (this.glowDecals && this.glowDecals.length) {
        ctx.lineWidth = 1.2; ctx.lineJoin = 'round';
        for (const d of this.glowDecals) {
          if (!inView(d.x, d.y, 40)) continue;
          ctx.strokeStyle = `rgba(255,70,45,${0.28 + 0.2 * Math.sin(g.time * 1.7 + d.ph)})`;
          ctx.beginPath(); ctx.moveTo(d.pts[0], d.pts[1]); for (let i = 2; i < d.pts.length; i += 2) ctx.lineTo(d.pts[i], d.pts[i + 1]); ctx.stroke();
        }
      }
      if (this.sigil && g.boss && !g.boss.dead) drawGlow(ctx, this.sigil.color, this.sigil.x, this.sigil.y, this.sigil.r * 1.2, 0.05 + 0.03 * Math.sin(g.time * 2));
      for (const pr of g.props) if (inView(pr.x, pr.y, 80)) this.drawPropGlow(ctx, pr, g);
      for (const pk of g.pickups) if (inView(pk.x, pk.y)) pk.draw(ctx, g);
      for (const b of g.bullets) b.draw(ctx);
      fx.draw(ctx, true);
      fx.drawArcs(ctx);
      if (!p.dead) p.drawGlow(ctx);
      if (g.hitDir && !p.dead) {
        // a red arc on the side the blow came from
        const hd = g.hitDir, k = Math.min(1, hd.t / 0.5);
        ctx.strokeStyle = `rgba(255,70,50,${0.9 * k})`; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(p.x, p.y, 30 + (1 - k) * 6, hd.a - 0.5, hd.a + 0.5); ctx.stroke();
        ctx.fillStyle = `rgba(255,70,50,${0.9 * k})`;
        const tx = p.x + Math.cos(hd.a) * 42, ty = p.y + Math.sin(hd.a) * 42;
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx - Math.cos(hd.a - 0.5) * 9, ty - Math.sin(hd.a - 0.5) * 9); ctx.lineTo(tx - Math.cos(hd.a + 0.5) * 9, ty - Math.sin(hd.a + 0.5) * 9); ctx.closePath(); ctx.fill();
      }
      for (const e of g.enemies) {
        if (e.dead || !inView(e.x, e.y, 140)) continue;
        e.drawEyes(ctx, g);
        if (e.def.drawGlow) e.def.drawGlow(e, ctx, g);
      }
      // sealed gate edges glow so they read in the dark
      for (const r of map.rooms) {
        if (!r.sealed) continue;
        for (const gt of r.gates) drawGlow(ctx, '#7a46be', (gt.x + 0.5) * TILE, (gt.y + 0.5) * TILE, 30, 0.35 + Math.sin(g.time * 4 + gt.x + gt.y) * 0.1);
      }
      ctx.globalCompositeOperation = 'source-over';

      // gloom clouds sit on top of the light
      for (const z of g.zones) {
        if (z.kind !== 'gloom') continue;
        const k = Math.min(1, z.life / 1.2) * Math.min(1, z.t * 4);
        const gr = ctx.createRadialGradient(z.x, z.y, 0, z.x, z.y, z.r);
        gr.addColorStop(0, `rgba(10,4,20,${0.82 * k})`); gr.addColorStop(0.7, `rgba(16,6,30,${0.6 * k})`); gr.addColorStop(1, 'rgba(20,8,36,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, TAU); ctx.fill();
        ctx.strokeStyle = `rgba(120,70,190,${0.35 * k})`; ctx.lineWidth = 1.5; ctx.setLineDash([5, 7]);
        ctx.beginPath(); ctx.arc(z.x, z.y, z.r * 0.95, g.time * 0.6, g.time * 0.6 + TAU); ctx.stroke(); ctx.setLineDash([]);
      }
      // enemy shots are pieces of the dark: drawn over everything, black with a red rim, casting no light
      for (const b of g.ebullets) if (inView(b.x, b.y)) b.draw(ctx, g);
      // world-space labels
      this.drawLabels(ctx, g);
      fx.drawTexts(ctx);

      // ---------------- screen-space overlays ----------------
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const W = cv.width, H = cv.height;
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
      const low = p.dead ? 0 : Math.max(0, 1 - p.frac() / 0.25);
      if (low > 0) {
        const pulse = 0.5 + 0.5 * Math.sin(g.realTime * 5);
        const lg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8);
        lg.addColorStop(0, 'rgba(0,0,0,0)'); lg.addColorStop(1, `rgba(60,0,10,${0.35 * low * (0.6 + 0.4 * pulse)})`);
        ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
      }
      if (g.dread > 0.05) {
        // something is hunting you: the dark presses in from the edges and beats with your heart
        const dk = g.dread * (0.75 + 0.25 * (g.heartBeat || 0));
        const dg = ctx.createRadialGradient(W / 2, H / 2, H * (0.42 - 0.14 * g.dread), W / 2, H / 2, H * 0.8);
        dg.addColorStop(0, 'rgba(0,0,0,0)'); dg.addColorStop(0.7, `rgba(6,0,4,${0.6 * dk})`); dg.addColorStop(1, `rgba(40,0,6,${0.85 * dk})`);
        ctx.fillStyle = dg; ctx.fillRect(0, 0, W, H);
      }
      if (g.hurtVig > 0) {
        const hg = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.85);
        hg.addColorStop(0, 'rgba(255,60,40,0)'); hg.addColorStop(1, `rgba(255,60,40,${0.4 * g.hurtVig})`);
        ctx.fillStyle = hg; ctx.fillRect(0, 0, W, H);
      }
    }

    polyPath(ctx, poly) {
      ctx.beginPath(); ctx.moveTo(poly[0], poly[1]);
      for (let i = 2; i < poly.length; i += 2) ctx.lineTo(poly[i], poly[i + 1]);
      ctx.closePath();
    }

    // ------------------------------------------------------------ props
    drawProp(ctx, pr, g) {
      const x = pr.x, y = pr.y;
      switch (pr.kind) {
        case 'brazier':
          ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(x, y + 9, 13, 5, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#2b2a33'; ctx.fillRect(x - 3, y - 2, 6, 12);
          ctx.fillStyle = '#3d3b48'; ctx.beginPath(); ctx.ellipse(x, y - 4, 12, 7, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = pr.lit ? '#5a2a10' : '#15141b'; ctx.beginPath(); ctx.ellipse(x, y - 5, 9, 4.5, 0, 0, TAU); ctx.fill();
          break;
        case 'chest':
          ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(x, y + 10, 16, 5, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#4a3320'; LF.roundRect(ctx, x - 14, y - 6, 28, 16, 2); ctx.fill();
          if (pr.opened) { ctx.fillStyle = '#120c08'; ctx.fillRect(x - 12, y - 5, 24, 7); ctx.fillStyle = '#5c4129'; LF.roundRect(ctx, x - 14, y - 15, 28, 8, 3); ctx.fill(); }
          else { ctx.fillStyle = '#6b4a2c'; LF.roundRect(ctx, x - 14, y - 11, 28, 11, 4); ctx.fill(); ctx.fillStyle = pr.locked ? '#7a6ad0' : '#d9b25c'; ctx.fillRect(x - 14, y - 1, 28, 2); ctx.fillRect(x - 2.5, y - 4, 5, 7); }
          ctx.fillStyle = '#d9b25c'; ctx.fillRect(x - 14, y - 6, 2, 16); ctx.fillRect(x + 12, y - 6, 2, 16);
          break;
        case 'shrine':
          ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(x, y + 12, 22, 6, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#2a2433'; LF.roundRect(ctx, x - 20, y - 4, 40, 16, 2); ctx.fill();
          ctx.fillStyle = '#3a3146'; LF.roundRect(ctx, x - 22, y - 9, 44, 8, 2); ctx.fill();
          ctx.fillStyle = pr.used ? '#3c3644' : '#e9dcc4';
          for (const ox of [-14, -5, 6, 15]) ctx.fillRect(x + ox - 1.5, y - 9 - 6 - (ox % 4), 3, 6 + (ox % 4));
          break;
        case 'pedestal':
          ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(x, y + 10, 13, 4, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#33303d'; ctx.fillRect(x - 8, y - 2, 16, 12);
          ctx.fillStyle = '#484454'; LF.roundRect(ctx, x - 11, y - 6, 22, 6, 2); ctx.fill();
          break;
        case 'shopkeeper': {
          ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(x, y + 16, 18, 6, 0, 0, TAU); ctx.fill();
          const sway = Math.sin(g.time * 1.2) * 1.5;
          ctx.fillStyle = '#3b2c22'; ctx.beginPath(); ctx.moveTo(x - 16, y + 16); ctx.quadraticCurveTo(x - 14 + sway, y - 20, x + sway, y - 24); ctx.quadraticCurveTo(x + 14 + sway, y - 20, x + 16, y + 16); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#0d0907'; ctx.beginPath(); ctx.ellipse(x + sway, y - 12, 6, 7, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#e9dcc4'; ctx.fillRect(x - 15, y - 12, 3, 8); ctx.fillRect(x + 12, y - 14, 3, 9); ctx.fillRect(x - 2 + sway, y - 31, 3, 7);
          break;
        }
        case 'exit':
          if (pr.hidden) break;
          if (g.victoryReady && g.mode === 'descent' && g.loop < 4) {
            // a shard of the Great Lantern: a curved splinter of its glass with fire still caught in it
            ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(x, y + 18, 26, 8, 0, 0, TAU); ctx.fill();
            ctx.fillStyle = '#3a2410'; ctx.beginPath(); ctx.moveTo(x - 6, y - 36); ctx.lineTo(x + 15, y - 12); ctx.lineTo(x + 8, y + 18); ctx.lineTo(x - 12, y + 14); ctx.lineTo(x - 17, y - 8); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = '#c99a4a'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke();
            break;
          }
          if (g.victoryReady && g.mode === 'descent') {
            // the Great Lantern, half buried where it came to rest: cracked glass around a heart that is nearly out
            ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(x, y + 22, 44, 12, 0, 0, TAU); ctx.fill();
            ctx.fillStyle = '#2a1a0c'; ctx.beginPath(); ctx.arc(x, y, 34, 0, TAU); ctx.fill();
            ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 4; ctx.stroke();
            ctx.strokeStyle = '#5a4424'; ctx.lineWidth = 3;
            for (let i = 0; i < 4; i++) { const a = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 34, y + Math.sin(a) * 34); ctx.lineTo(x - Math.cos(a) * 34, y - Math.sin(a) * 34); ctx.stroke(); }
            break;
          }
          ctx.fillStyle = '#05070b'; LF.roundRect(ctx, x - 22, y - 18, 44, 36, 4); ctx.fill();
          for (let i = 0; i < 5; i++) { ctx.fillStyle = `rgba(${g.victoryReady ? '255,240,200' : '110,160,200'},${0.34 - i * 0.06})`; ctx.fillRect(x - 20 + i * 3, y - 15 + i * 6, 40 - i * 6, 5); }
          ctx.strokeStyle = g.victoryReady ? '#ffe9b8' : '#3d5670'; ctx.lineWidth = 2; LF.roundRect(ctx, x - 22, y - 18, 44, 36, 4); ctx.stroke();
          break;
        case 'oiljar':
          if (pr.broken) { ctx.fillStyle = 'rgba(10,6,4,0.6)'; ctx.beginPath(); ctx.ellipse(x, y + 4, 13, 8, 0, 0, TAU); ctx.fill(); break; }
          ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x, y + 9, 9, 3.5, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#3a2a1e'; LF.roundRect(ctx, x - 8, y - 8, 16, 18, 5); ctx.fill();
          ctx.fillStyle = '#c2622a'; ctx.fillRect(x - 8, y - 1, 16, 4);
          ctx.fillStyle = '#54402e'; ctx.fillRect(x - 5, y - 11, 10, 4);
          ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x - 6, y - 6, 2, 12);
          break;
        case 'trap': drawTrap(ctx, pr, x, y, g.time); break;
        case 'lamp':
          ctx.fillStyle = '#2a2622'; ctx.fillRect(x - 1.5, y - 14, 3, 9);
          ctx.fillStyle = pr.lit ? '#6b5433' : '#34302b'; ctx.beginPath(); ctx.moveTo(x - 5, y - 6); ctx.lineTo(x + 5, y - 6); ctx.lineTo(x + 3.5, y - 1); ctx.lineTo(x - 3.5, y - 1); ctx.closePath(); ctx.fill();
          break;
        case 'urn':
          if (pr.broken) { ctx.fillStyle = '#2c2936'; ctx.fillRect(x - 6, y + 3, 5, 3); ctx.fillRect(x + 2, y + 5, 4, 2); break; }
          ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x, y + 8, 8, 3, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#4a4558'; ctx.beginPath(); ctx.ellipse(x, y, 7, 9, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#5e586e'; ctx.fillRect(x - 4, y - 11, 8, 3);
          ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.ellipse(x - 2, y - 2, 2, 4, 0.3, 0, TAU); ctx.fill();
          break;
        case 'statue': {
          ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(x, y + 16, 18, 6, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#34363f'; LF.roundRect(ctx, x - 14, y + 6, 28, 10, 2); ctx.fill();
          ctx.fillStyle = pr.used ? '#3d3f49' : '#565a68';
          ctx.beginPath(); ctx.moveTo(x - 11, y + 8); ctx.quadraticCurveTo(x - 10, y - 16, x, y - 22); ctx.quadraticCurveTo(x + 10, y - 16, x + 11, y + 8); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#23252c'; ctx.beginPath(); ctx.ellipse(x, y - 11, 5, 6, 0, 0, TAU); ctx.fill();
          ctx.strokeStyle = '#6b7080'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 8, y - 4); ctx.lineTo(x + 15, y + 1); ctx.stroke();
          ctx.fillStyle = '#2a2c34'; ctx.fillRect(x + 12, y + 1, 6, 8);
          break;
        }
        case 'trial':
          ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(x, y + 10, 16, 6, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#17131f'; ctx.fillRect(x - 4, y - 2, 8, 13);
          ctx.fillStyle = '#231c30'; ctx.beginPath(); ctx.ellipse(x, y - 4, 15, 8, 0, 0, TAU); ctx.fill();
          ctx.strokeStyle = '#6b46a8'; ctx.lineWidth = 1.5; ctx.stroke();
          ctx.fillStyle = '#0b0812'; ctx.beginPath(); ctx.ellipse(x, y - 5, 11, 5, 0, 0, TAU); ctx.fill();
          break;
        case 'font':
          ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(x, y + 12, 20, 6, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#3a3846'; ctx.fillRect(x - 5, y, 10, 12);
          ctx.fillStyle = '#4b4959'; ctx.beginPath(); ctx.ellipse(x, y - 2, 18, 9, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = pr.used ? '#1a1920' : '#ffe2a6'; ctx.beginPath(); ctx.ellipse(x, y - 3, 14, 6, 0, 0, TAU); ctx.fill();
          break;
      }
    }
    drawPropGlow(ctx, pr, g) {
      const x = pr.x, y = pr.y, t = g.time;
      switch (pr.kind) {
        case 'brazier':
          if (!pr.lit) {
            if (pr.kindle > 0) {
              // catching: a small flame that grows, and a ring that closes as it takes
              const k = Math.min(1, pr.kindle), h = (3 + 9 * k) * (1 + Math.sin(t * 22 + pr.x) * 0.18);
              ctx.fillStyle = 'rgba(255,170,70,0.85)'; ctx.beginPath(); ctx.moveTo(x - 2 - 2 * k, y - 5); ctx.quadraticCurveTo(x + Math.sin(t * 9) * 1.5, y - 5 - h * 1.6, x + 2 + 2 * k, y - 5); ctx.closePath(); ctx.fill();
              drawGlow(ctx, '#ffb347', x, y - 8, 8 + 16 * k, 0.5);
              ctx.strokeStyle = 'rgba(255,226,166,0.25)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y - 4, 19, 0, TAU); ctx.stroke();
              ctx.strokeStyle = 'rgba(255,226,166,0.95)'; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(x, y - 4, 19, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke();
            }
            break;
          }
          for (let i = 0; i < 3; i++) {
            const h = 13 + Math.sin(t * (9 + i * 3) + pr.x + i) * 4, w = 6 - i * 1.5;
            ctx.fillStyle = ['rgba(255,110,30,0.75)', 'rgba(255,180,70,0.8)', 'rgba(255,245,210,0.9)'][i];
            ctx.beginPath(); ctx.moveTo(x - w, y - 5); ctx.quadraticCurveTo(x - w * 0.6 + Math.sin(t * 7 + i) * 2, y - 5 - h * 0.6, x + Math.sin(t * 5 + i * 2) * 2.5, y - 5 - h * (1 - i * 0.2));
            ctx.quadraticCurveTo(x + w * 0.6, y - 5 - h * 0.5, x + w, y - 5); ctx.closePath(); ctx.fill();
          }
          drawGlow(ctx, '#ffb347', x, y - 8, 30, 0.6);
          if (Math.random() < 0.08) fx.spawn({ x: x + LF.rand(-4, 4), y: y - 12, vx: LF.rand(-10, 10), vy: LF.rand(-60, -30), life: 0.9, size: 1.5, color: '#ffb347', drag: 0.5 });
          break;
        case 'chest': if (!pr.opened) drawGlow(ctx, pr.locked ? '#7a6ad0' : '#ffe08a', x, y - 4, 26 + Math.sin(t * 3) * 3, 0.35); break;
        case 'trap': glowTrap(ctx, pr, x, y, t); break;
        case 'lamp':
          if (!pr.lit) break;
          ctx.fillStyle = 'rgba(255,214,150,0.95)'; ctx.beginPath(); ctx.ellipse(x, y - 9 + Math.sin(t * 9 + pr.x) * 0.6, 2, 3.4, 0, 0, TAU); ctx.fill();
          drawGlow(ctx, '#ffb347', x, y - 8, 16, 0.55);
          break;
        case 'shrine':
          if (pr.used) break;
          for (const ox of [-14, -5, 6, 15]) drawGlow(ctx, '#c08bff', x + ox, y - 17 - (ox % 4), 7 + Math.sin(t * 10 + ox) * 1.5, 0.9);
          drawGlow(ctx, '#a070ff', x, y - 10, 46, 0.25);
          break;
        case 'pedestal': {
          if (pr.sold || !pr.item) break;
          const by = y - 20 + Math.sin(t * 2.4 + pr.x) * 2.5;
          if (pr.item.type === 'relic') {
            const d = LF.RELICS[pr.item.relic];
            drawGlow(ctx, LF.RARITY[d.rarity].color, x, by, 20, 0.35);
            ctx.globalCompositeOperation = 'source-over'; LF.drawIcon(ctx, d.glyph, x, by, 18, d.color); ctx.globalCompositeOperation = 'lighter';
          } else {
            drawGlow(ctx, '#ffb347', x, by, 20, 0.4);
            ctx.globalCompositeOperation = 'source-over'; LF.drawIcon(ctx, 'drop', x, by, 18, '#ffb347'); ctx.globalCompositeOperation = 'lighter';
          }
          break;
        }
        case 'shopkeeper':
          drawGlow(ctx, '#ffcf8a', x - 13.5, y - 15, 8, 0.9); drawGlow(ctx, '#ffcf8a', x + 13.5, y - 17, 8, 0.9); drawGlow(ctx, '#ffcf8a', x, y - 34, 8, 0.9);
          drawGlow(ctx, '#ffb347', x, y - 10, 60, 0.18);
          ctx.fillStyle = 'rgba(255,220,150,0.9)'; ctx.beginPath(); ctx.arc(x - 2.2, y - 12, 1.1, 0, TAU); ctx.arc(x + 2.2, y - 12, 1.1, 0, TAU); ctx.fill();
          break;
        case 'exit':
          if (pr.hidden) break;
          if (g.victoryReady && g.mode === 'descent') {
            const beat = 0.5 + 0.5 * Math.sin(t * 1.3), big = g.loop >= 4, sc = big ? 1 : 0.5, nr = big ? 12 : 7;
            drawGlow(ctx, '#ffb347', x, y, (230 + beat * 40) * sc, 0.4); drawGlow(ctx, '#fff2cc', x, y, (80 + beat * 16) * sc, 0.85);
            ctx.fillStyle = `rgba(255,236,190,${0.75 + 0.2 * beat})`; ctx.beginPath(); ctx.arc(x, y, (15 + beat * 3) * sc, 0, TAU); ctx.fill();
            ctx.strokeStyle = 'rgba(255,214,150,0.35)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
            for (let i = 0; i < nr; i++) { const a = i / nr * TAU + t * 0.12, r0 = 46 * sc, r1 = (96 + 30 * Math.sin(t * 1.7 + i * 2.1)) * sc; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); ctx.stroke(); }
            if (Math.random() < 0.5) fx.spawn({ x: x + LF.rand(-30, 30), y: y + LF.rand(-20, 20), vy: LF.rand(-110, -50), life: 1.4, size: 2, color: '#ffd9a0', drag: 0 });
          } else if (g.victoryReady) {
            drawGlow(ctx, '#fff2cc', x, y, 90 + Math.sin(t * 2) * 8, 0.6);
            ctx.fillStyle = 'rgba(255,242,204,0.25)'; ctx.fillRect(x - 16, y - 400, 32, 400);
            if (Math.random() < 0.4) fx.spawn({ x: x + LF.rand(-18, 18), y: y + LF.rand(-10, 10), vy: LF.rand(-120, -60), life: 1.2, size: 2, color: '#fff2cc', drag: 0 });
          } else drawGlow(ctx, '#5fa8d8', x, y, 46 + Math.sin(t * 2) * 4, 0.3);
          break;
        case 'statue':
          if (pr.used) break;
          drawGlow(ctx, '#9fc7ff', x, y - 6, 38 + Math.sin(t * 2) * 3, 0.3);
          ctx.fillStyle = 'rgba(170,210,255,0.9)'; ctx.beginPath(); ctx.arc(x - 2, y - 10 + ((t * 9) % 8), 1, 0, TAU); ctx.arc(x + 2, y - 10 + ((t * 9 + 4) % 8), 1, 0, TAU); ctx.fill();
          break;
        case 'trial':
          if (pr.used) break;
          for (let i = 0; i < 2; i++) {
            const h = 11 + Math.sin(t * (8 + i * 3) + i) * 3, w = 5 - i * 2;
            ctx.fillStyle = i ? 'rgba(230,200,255,0.9)' : 'rgba(150,80,255,0.8)';
            ctx.beginPath(); ctx.moveTo(x - w, y - 5); ctx.quadraticCurveTo(x + Math.sin(t * 6 + i) * 2, y - 5 - h * 1.4, x + w, y - 5); ctx.closePath(); ctx.fill();
          }
          drawGlow(ctx, '#9a5cff', x, y - 8, 34 + Math.sin(t * 3) * 3, 0.5);
          break;
        case 'font':
          if (!pr.used) { drawGlow(ctx, '#ffe2a6', x, y - 4, 42 + Math.sin(t * 3) * 4, 0.55); if (Math.random() < 0.1) fx.spawn({ x: x + LF.rand(-10, 10), y: y - 6, vy: -40, life: 0.8, size: 1.6, color: '#ffe2a6', drag: 0 }); }
          break;
      }
    }
    drawLabels(ctx, g) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const pr of g.props) {
        if (pr.kind === 'pedestal' && !pr.sold && pr.item) {
          const cost = g.price(pr), afford = g.player.glass >= cost;
          ctx.font = `bold 9px ${LF.FONT_UI}`;
          ctx.fillStyle = 'rgba(0,0,0,0.6)'; LF.roundRect(ctx, pr.x - 15, pr.y + 13, 30, 12, 3); ctx.fill();
          ctx.fillStyle = afford ? '#8fe6ff' : '#ff8a8a'; ctx.fillText('◆ ' + cost, pr.x, pr.y + 19.5);
        }
      }
      // elite names
      for (const e of g.enemies) {
        if (e.dead || !e.elite || !e.lit || e.spawnT > 0 || e.boss) continue;
        ctx.font = `bold 8px ${LF.FONT_UI}`; ctx.fillStyle = 'rgba(255,130,120,0.9)';
        ctx.fillText(e.name.toUpperCase(), e.x, e.y - e.r - 17);
      }
      if (g.prompt && !g.player.dead) {
        const pr = g.prompt.prop, txt = g.prompt.text;
        ctx.font = `bold 10px ${LF.FONT_UI}`;
        const w = ctx.measureText(txt).width + 30, x = pr.x - w / 2, y = pr.y - 46;
        ctx.fillStyle = 'rgba(8,8,14,0.85)'; LF.roundRect(ctx, x, y, w, 18, 5); ctx.fill();
        ctx.strokeStyle = 'rgba(255,217,160,0.5)'; ctx.lineWidth = 1; LF.roundRect(ctx, x, y, w, 18, 5); ctx.stroke();
        ctx.fillStyle = '#1a1208'; LF.roundRect(ctx, x + 4, y + 3, 13, 12, 3); ctx.fill();
        ctx.fillStyle = '#ffd9a0'; LF.roundRect(ctx, x + 4, y + 3, 13, 12, 3); ctx.fill();
        ctx.fillStyle = '#1a1208'; ctx.fillText(LF.input.mode === 'pad' ? 'X' : LF.input.mode === 'touch' ? '!' : 'E', x + 10.5, y + 9.5);
        ctx.fillStyle = '#f3e9d6'; ctx.textAlign = 'left'; ctx.fillText(txt, x + 22, y + 9.5); ctx.textAlign = 'center';
        if (pr.kind === 'pedestal' && pr.item && pr.item.type === 'relic') {
          // what the relic on the pedestal does, set above the prompt
          const d = LF.RELICS[pr.item.relic], S = LF.SCHOOLS[d.school], W2 = 236;
          ctx.font = `9px ${LF.FONT_UI}`;
          const lines = LF.wrapText(ctx, d.desc, W2 - 20), h = 34 + lines.length * 11.5, bx = pr.x - W2 / 2, by0 = y - h - 6;
          ctx.fillStyle = 'rgba(8,8,14,0.92)'; LF.roundRect(ctx, bx, by0, W2, h, 6); ctx.fill();
          ctx.strokeStyle = LF.RARITY[d.rarity].color; ctx.lineWidth = 1; LF.roundRect(ctx, bx, by0, W2, h, 6); ctx.stroke();
          ctx.font = `bold 11px ${LF.FONT_UI}`; ctx.fillStyle = '#fff2d6'; ctx.fillText(d.name, pr.x, by0 + 11);
          ctx.font = `bold 7.5px ${LF.FONT_UI}`; ctx.fillStyle = S ? S.color : '#ffd9a0'; ctx.fillText(((S ? S.name : '') + (d.pathName ? '  \u00b7  ' + d.pathName : '') + (d.form ? '  \u00b7  ' + d.form + ' form' : '')).toUpperCase(), pr.x, by0 + 23);
          ctx.font = `9px ${LF.FONT_UI}`; ctx.fillStyle = '#d8cdb8'; lines.forEach((l, j) => ctx.fillText(l, pr.x, by0 + 36 + j * 11.5));
        }
      }
      if (g.hintT > 0 && !g.player.dead) {
        ctx.globalAlpha = Math.min(1, g.hintT * 2);
        ctx.font = `bold 9px ${LF.FONT_UI}`; ctx.fillStyle = '#ffb3a0';
        ctx.fillText(g.hintText, g.player.x, g.player.y + 26);
        ctx.globalAlpha = 1;
      }
    }
  }
  LF.Renderer = Renderer;
})();
