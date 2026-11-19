'use strict';
// Great shadows of the deeper Depths: the Counterweight (Depth II, Level 9), the Founder (Depth III, Level 9) and the
// Lamp-Eater (Depth IV, Level 3).
// What each lays across the whole hall (the pendulum's arc, the slag channels, the links, the spat flame) is drawn by
// a small helper that sits at the corner of the view ('b4mark'), so a warning is seen even while its shadow is off
// the screen. The helper cannot be touched, hurt or targeted, and goes when its shadow does.
(function () {
  const fx = LF.fx, TAU = LF.TAU, TILE = LF.TILE, DEFS = LF.ENEMY_DEFS, B = LF.BH;

  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
    const t = LF.clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
    return Math.hypot(px - ax - dx * t, py - ay - dy * t);
  }
  function hurtIfNear(g, x, y, r, dmg, name) {
    const p = g.player;
    if (p.dead || p.dashing > 0 || p.invuln > 0) return false;
    if (LF.dist(p.x, p.y, x, y) < r + p.r - 3) { g.hurtPlayer(dmg, { x, y, name }); return true; }
    return false;
  }
  function bounds(g) {
    const r = B.arena(g);
    return { x0: r.x * TILE, y0: r.y * TILE, x1: (r.x + r.w) * TILE, y1: (r.y + r.h) * TILE, cx: r.cx * TILE, cy: r.cy * TILE };
  }
  function inArena(g, x, y, m) {
    const b = bounds(g);
    const o = g.map.nearestOpen(LF.clamp(x, b.x0 + m, b.x1 - m), LF.clamp(y, b.y0 + m, b.y1 - m));
    return o;
  }

  // ---------- the helper that draws across the hall ----------
  function park(m, g) {
    const c = g.cam || {}, z = c.zoom || 1, cv = g.canvas;
    const vw = (cv && cv.width ? cv.width : 1280) / z, vh = (cv && cv.height ? cv.height : 720) / z;
    const cx = (c.x === undefined ? g.player.x : c.x) + (c.sx || 0), cy = (c.y === undefined ? g.player.y : c.y) + (c.sy || 0);
    m.x = cx - vw / 2 - 40; m.y = cy - vh / 2 - 40;
  }
  DEFS.b4mark = {
    name: 'Mark', hp: 1e9, speed: 0, r: 2, dmg: 0, embers: 0, glass: 0, contact: false, noStun: true, noBar: true, ghost: true, flies: true,
    eyes: null,
    init(e) { e.intangible = true; },
    modDamage() { return 0; },
    update(e, g) {
      e.intangible = true; e.mark = 0; e.burn = 0; e.chill = 0; e.shackle = 0; e.glow = 0;
      const o = e.owner;
      if (!o || o.dead || (g.boss && g.boss !== o)) { e.noDrops = true; g.killEnemy(e, { type: 'self' }); return; }
      park(e, g);
    },
    draw(e, ctx, g) { const o = e.owner; if (o && !o.dead && o.def.drawFloor) o.def.drawFloor(o, ctx, g); },
    drawGlow(e, ctx, g) { const o = e.owner; if (o && !o.dead && o.def.glowFloor) o.def.glowFloor(o, ctx, g); },
  };
  function ensureMark(e, g) {
    if (e.markE && !e.markE.dead) return;
    const m = new LF.Enemy(g, 'b4mark', e.x, e.y, { awake: true, room: e.room, noDrops: true });
    m.owner = e; park(m, g); e.markE = m;
    // drawn first, under everything: added once this frame's creatures have all moved
    g.delay(0, () => { if (!m.dead && g.enemies.indexOf(m) < 0) g.enemies.unshift(m); });
  }

  // =====================================================================================
  // THE COUNTERWEIGHT (Depth II, Level 9: the Pendulum Hall)
  // It hangs from a pivot on the wall and swings along an arc. Before each set of swings the arc it will sweep is
  // shown: leave it. Now and then the chain goes slack and it falls on you, then is dragged back across the floor.
  // At the last it tears its pivot loose and swings from another wall.
  // =====================================================================================
  const IRON = '#d98a52', IRON_RGB = '217,138,82';
  function wPivots(g) {
    const b = bounds(g), W = b.x1 - b.x0, H = b.y1 - b.y0;
    return [
      { x: b.cx, y: b.y0 + 16, down: Math.PI / 2, reach: H - 64, half: W / 2 - 54 },
      { x: b.x0 + 16, y: b.cy, down: 0, reach: W - 64, half: H / 2 - 54 },
      { x: b.x1 - 16, y: b.cy, down: Math.PI, reach: W - 64, half: H / 2 - 54 },
      { x: b.cx, y: b.y1 - 16, down: -Math.PI / 2, reach: H - 64, half: W / 2 - 54 },
    ];
  }
  const W_MIN = 150;
  function wAmp(ph, piv, L) { return Math.min([0.95, 1.05, 1.15][ph - 1], Math.asin(Math.min(1, piv.half / L))); }
  function wHalf(ph, L) { return LF.clamp((1.5 - 0.17 * (ph - 1)) * Math.sqrt(L / 420), 0.8, 1.9); }
  function wPos(piv, L, th, out) { const a = piv.down + th; out.x = piv.x + Math.cos(a) * L; out.y = piv.y + Math.sin(a) * L; return out; }
  const wTmp = { x: 0, y: 0 };
  // the length that puts the arc through where you stand
  function wAimL(g, piv) { const p = g.player; return LF.clamp(LF.dist(p.x, p.y, piv.x, piv.y) + LF.rand(-25, 25), W_MIN, piv.reach); }
  // the whole arc as hazards, for the bot
  function wBandHazards(g, piv, L, A, r) {
    const n = Math.max(3, Math.ceil(2 * A * L / (r * 1.1)));
    for (let i = 0; i <= n; i++) { wPos(piv, L, -A + 2 * A * i / n, wTmp); g.hazards.push({ x: wTmp.x, y: wTmp.y, r: r + 4 }); }
  }
  function wStartReel(e, g, piv, L, side) {
    const ph = e.phase, A = wAmp(ph, piv, L);
    e.state = 'reel'; e.fx0 = e.x; e.fy0 = e.y; e.nPiv = piv; e.nL = L; e.nA = A; e.side = side;
    wPos(piv, L, side * A, wTmp); e.tx = wTmp.x; e.ty = wTmp.y;
    e.t = e.tMax = [1.25, 1.05, 0.95][ph - 1];
    LF.audio.play('charge');
    if (!e.told) { e.told = true; g.banner = { text: 'It still keeps the time', sub: 'Leave its arc before it swings', t: 0, dur: 2.8, small: true, boss: true }; }
  }
  function wStartSwing(e, g) {
    e.piv = e.nPiv; e.L = e.nL; e.A = e.nA; e.nPiv = null;
    e.state = 'swing'; e.st = 0; e.H = wHalf(e.phase, e.L); e.n = 3 + e.phase;
    LF.audio.play('lunge');
  }
  function wStartDrag(e, g, piv, L, side, warn) {
    const A = wAmp(e.phase, piv, L);
    e.nPiv = piv; e.nL = L; e.nA = A; e.side = side;
    wPos(piv, L, side * A, wTmp); e.tx = wTmp.x; e.ty = wTmp.y;
    e.fx0 = e.x; e.fy0 = e.y;
    e.state = 'drag'; e.sub = 0; e.t = e.tMax = warn; e.lastF = null;
    LF.audio.play('telegraph');
  }
  function wNext(e, g) {
    const ph = e.phase, p = g.player;
    const opts = ph === 1 ? ['reel', 'reel', 'drop'] : ph === 2 ? ['reel', 'drop', 'reel', 'drop'] : ['reel', 'drop', 'turn', 'turn'];
    let a = LF.pick(opts);
    if (a !== 'reel' && a === e.lastAtk) a = 'reel';
    e.lastAtk = a;
    if (a === 'reel') wStartReel(e, g, e.piv, wAimL(g, e.piv), e.side);
    else if (a === 'turn') {
      const others = e.pivs.filter(q => q !== e.piv);
      const piv = LF.pick(others), L = wAimL(g, piv), side = Math.random() < 0.5 ? 1 : -1;
      wStartDrag(e, g, piv, L, side, 1.15);
      fx.text(piv.x, piv.y + (piv.down > 0 && piv.down < 3 ? 30 : -24), 'IT TURNS', IRON, 11, 1.2);
      LF.audio.play('roar');
    } else {
      // drop: the chain goes slack and it falls on where you are going
      const piv = e.piv;
      let tx = p.x + p.vx * 0.35, ty = p.y + p.vy * 0.35;
      const d = LF.dist(tx, ty, piv.x, piv.y), dl = LF.clamp(d, W_MIN, piv.reach);
      if (d > 1) { tx = piv.x + (tx - piv.x) / d * dl; ty = piv.y + (ty - piv.y) / d * dl; }
      const o = inArena(g, tx, ty, 50);
      e.state = 'drop'; e.t = e.tMax = [1.05, 0.95, 0.85][ph - 1]; e.fx0 = e.x; e.fy0 = e.y; e.tx = o.x; e.ty = o.y;
      B.telegraph(e, o.x, o.y, 94, e.t, () => {}, IRON_RGB);
      e.intangible = true; LF.audio.play('telegraph');
    }
  }

  DEFS.weight = {
    name: 'The Counterweight', title: 'It swung to keep the chain taut. It has not stopped', boss: true,
    hp: 4300, speed: 0, r: 34, dmg: 13, embers: 0, glass: 0, phases: [0.66, 0.33], ghost: true, flies: true,
    eyes: null,
    lore: 'The weight fell first, before the Lantern. Someone had drawn its pin by hand.',
    init(e) { B.bossInit(e); e.piv = null; e.furrow = []; e.furT = 0; e.tick = 0; e.side = 1; e.told = false; e.chainA = Math.PI / 2; e.z = 0; },
    onTouch(e, g) {
      const p = g.player;
      if (p.invuln > 0) return;
      g.hurtPlayer(e.dmg * (e.state === 'swing' ? 1.2 : e.state === 'drag' ? 1.1 : 1), { x: e.x, y: e.y, name: 'the Counterweight' });
    },
    update(e, g, dt) {
      const p = g.player;
      e.t -= dt; e.spin += dt; e.furT -= dt;
      ensureMark(e, g);
      if (!e.piv) {
        e.pivs = wPivots(g); e.piv = e.pivs[0];
        e.L = LF.clamp(LF.dist(e.x, e.y, e.piv.x, e.piv.y), W_MIN, e.piv.reach); e.A = wAmp(1, e.piv, e.L);
        wPos(e.piv, e.L, 0, wTmp); e.x = wTmp.x; e.y = wTmp.y; e.t = 1.5;
      }
      B.updateTel(e, g, dt);
      if (B.phaseShift(e, g)) {
        e.tel.length = 0; e.z = 0; e.intangible = false;
        if (e.phase === 3) { const piv = LF.pick(e.pivs.filter(q => q !== e.piv)); wStartDrag(e, g, piv, wAimL(g, piv), Math.random() < 0.5 ? 1 : -1, 1.4); }
        else wStartReel(e, g, e.piv, wAimL(g, e.piv), e.side);
      }
      const ph = e.phase;
      // the furrow it leaves when it is dragged: scorched iron grit, for a little while
      for (const f of e.furrow) {
        f.t -= dt; if (f.t <= 0) { f.dead = true; continue; }
        g.hazards.push({ x: f.x, y: f.y, r: 16 });
        if (e.furT <= 0 && !p.dead && p.dashing <= 0 && p.invuln <= 0 && LF.dist2(p.x, p.y, f.x, f.y) < (14 + p.r) * (14 + p.r)) { e.furT = 0.5; g.hurtPlayer(e.dmg * 0.45, { x: f.x, y: f.y, name: 'its furrow' }); }
      }
      LF.compact(e.furrow);
      switch (e.state) {
        case 'intro': if (e.t <= 0) wStartReel(e, g, e.piv, wAimL(g, e.piv), Math.random() < 0.5 ? 1 : -1); break;
        case 'reel': {
          // hauled to the end of its new arc, which glows while it is drawn back
          const k = LF.smooth(LF.clamp(1 - e.t / e.tMax, 0, 1));
          e.x = LF.lerp(e.fx0, e.tx, k); e.y = LF.lerp(e.fy0, e.ty, k);
          wBandHazards(g, e.nPiv, e.nL, e.nA, e.r);
          e.red = 1;
          if (e.t <= 0) wStartSwing(e, g);
          break;
        }
        case 'swing': {
          e.st += dt * e.slowMul(g);
          if (e.st >= e.H) {
            e.st -= e.H; e.side = -e.side; e.n--; e.tick++;
            // the tock at the end of each swing
            LF.audio.play('hit'); g.shake(2);
            // rivets shaken loose, at every other tock
            if (ph >= 2 && e.tick % 2 === 0) {
              const n = 1 + ph, toP = Math.atan2(p.y - e.y, p.x - e.x);
              for (let i = 0; i < n; i++) g.fireEnemyBullet({ x: e.x, y: e.y, angle: toP + (i - (n - 1) / 2) * 0.24, speed: 150, dmg: e.dmg * 0.55, color: IRON, size: 5 });
            }
            if (e.n <= 0) { wPos(e.piv, e.L, e.side * e.A, wTmp); e.x = wTmp.x; e.y = wTmp.y; wNext(e, g); break; }
          }
          const th = e.side * e.A * Math.cos(Math.PI * e.st / e.H);
          wPos(e.piv, e.L, th, wTmp); e.x = wTmp.x; e.y = wTmp.y;
          g.hazards.push({ x: e.x, y: e.y, r: e.r + 8 });
          for (let k = 1; k <= 4; k++) {
            const s2 = Math.min(e.H, e.st + k * 0.13);
            wPos(e.piv, e.L, e.side * e.A * Math.cos(Math.PI * s2 / e.H), wTmp); g.hazards.push({ x: wTmp.x, y: wTmp.y, r: e.r + 6 });
          }
          if (Math.random() < dt * 20 * Math.abs(Math.sin(Math.PI * e.st / e.H))) fx.spawn({ x: e.x + LF.rand(-12, 12), y: e.y + LF.rand(-12, 12), life: 0.4, size: 3, color: '#3b2a22', glow: false });
          break;
        }
        case 'drop': {
          // it rises on the slack chain, then falls
          const k = LF.clamp(1 - e.t / e.tMax, 0, 1);
          e.z = Math.sin(k * Math.PI) * 1.1;
          e.x = LF.lerp(e.fx0, e.tx, LF.smooth(k)); e.y = LF.lerp(e.fy0, e.ty, LF.smooth(k));
          if (e.t <= 0) {
            e.x = e.tx; e.y = e.ty; e.z = 0; e.intangible = false;
            B.blast(g, e.x, e.y, 96, e.dmg * 1.4, 'the falling weight', IRON);
            if (e.dead) return;
            LF.audio.play('gate'); g.shake(10);
            if (ph >= 3) B.ring(g, e.x, e.y, 14, 125, e.dmg * 0.6, Math.random() * TAU, { color: IRON, gapEvery: 7, gapSize: 2 });
            // and the chain hauls it back to its arc
            const piv = e.piv, L = LF.clamp(LF.dist(e.x, e.y, piv.x, piv.y), W_MIN, piv.reach);
            const off = LF.angDiff(piv.down, Math.atan2(e.y - piv.y, e.x - piv.x));
            wStartDrag(e, g, piv, L, off >= 0 ? 1 : -1, [0.7, 0.6, 0.5][ph - 1]);
          }
          break;
        }
        case 'drag': {
          if (e.sub === 0) {
            // the lane it will be dragged along, and the arc it will swing on after
            const dx = e.tx - e.x, dy = e.ty - e.y, l = Math.hypot(dx, dy) || 1;
            for (let s = 0; s <= l; s += 40) g.hazards.push({ x: e.x + dx / l * s, y: e.y + dy / l * s, r: e.r + 4 });
            if (e.t < e.tMax * 0.5) wBandHazards(g, e.nPiv, e.nL, e.nA, e.r);
            e.red = 1;
            if (e.t <= 0) { e.sub = 1; e.fx0 = e.x; e.fy0 = e.y; LF.audio.play('lunge'); g.shake(4); }
          } else {
            const dx = e.tx - e.x, dy = e.ty - e.y, l = Math.hypot(dx, dy), sp = (520 + ph * 40) * e.slowMul(g) * dt;
            if (l <= sp) { e.x = e.tx; e.y = e.ty; }
            else { e.x += dx / l * sp; e.y += dy / l * sp; }
            g.hazards.push({ x: e.x, y: e.y, r: e.r + 8 });
            if (l > 1) for (let s = 40; s < Math.min(l, 200); s += 40) g.hazards.push({ x: e.x + dx / l * s, y: e.y + dy / l * s, r: e.r + 4 });
            if (ph >= 2 && (!e.lastF || LF.dist(e.lastF.x, e.lastF.y, e.x, e.y) > 28) && e.furrow.length < 90) { e.lastF = { x: e.x, y: e.y, t: 2.6 }; e.furrow.push(e.lastF); }
            if (Math.random() < 0.8) fx.spawn({ x: e.x + LF.rand(-14, 14), y: e.y + LF.rand(-14, 14), vx: LF.rand(-60, 60), vy: LF.rand(-60, 60), life: 0.35, size: 2, color: '#ffb36b' });
            if (l <= sp) wStartReelDone(e, g);
          }
          break;
        }
      }
      // the chain always points at the pivot
      const pv = e.state === 'drag' && e.sub === 1 ? e.piv : (e.nPiv && e.state === 'reel' ? e.nPiv : e.piv);
      if (pv) e.chainA = Math.atan2(e.y - pv.y, e.x - pv.x);
    },
    // under everything: the dial of the hall, the arc, the chain, the furrow
    drawFloor(e, ctx, g) {
      if (!e.piv) return;
      const piv = e.piv;
      // the arc it is on now: a groove worn in the floor
      ctx.save(); ctx.lineCap = 'butt';
      ctx.strokeStyle = 'rgba(70,46,34,0.55)'; ctx.lineWidth = e.r * 1.6;
      ctx.beginPath(); ctx.arc(piv.x, piv.y, e.L, piv.down - e.A, piv.down + e.A); ctx.stroke();
      // the hours, cut round the pivot
      ctx.strokeStyle = 'rgba(120,84,60,0.6)'; ctx.lineWidth = 2;
      for (let i = -6; i <= 6; i++) {
        const a = piv.down + i * 0.26, r0 = 30, r1 = i % 3 === 0 ? 62 : 48;
        ctx.beginPath(); ctx.moveTo(piv.x + Math.cos(a) * r0, piv.y + Math.sin(a) * r0); ctx.lineTo(piv.x + Math.cos(a) * r1, piv.y + Math.sin(a) * r1); ctx.stroke();
      }
      // the arc about to be swept
      const band = (pv, L, A, a) => {
        ctx.strokeStyle = `rgba(255,90,70,${a})`; ctx.lineWidth = e.r * 2.1; ctx.beginPath(); ctx.arc(pv.x, pv.y, L, pv.down - A, pv.down + A); ctx.stroke();
        ctx.strokeStyle = `rgba(255,120,90,${Math.min(0.9, a * 3)})`; ctx.lineWidth = 2; ctx.setLineDash([10, 8]);
        ctx.beginPath(); ctx.arc(pv.x, pv.y, L + e.r + 2, pv.down - A, pv.down + A); ctx.stroke();
        ctx.beginPath(); ctx.arc(pv.x, pv.y, Math.max(4, L - e.r - 2), pv.down - A, pv.down + A); ctx.stroke(); ctx.setLineDash([]);
      };
      if (e.state === 'reel' && e.nPiv) band(e.nPiv, e.nL, e.nA, 0.1 + 0.18 * LF.clamp(1 - e.t / e.tMax, 0, 1));
      if (e.state === 'drag' && e.nPiv) {
        const k = e.sub === 0 ? LF.clamp(1 - e.t / e.tMax, 0, 1) : 1;
        band(e.nPiv, e.nL, e.nA, 0.08 + 0.14 * k);
        if (e.sub === 0) {
          ctx.strokeStyle = `rgba(255,90,70,${0.18 + 0.3 * k})`; ctx.lineWidth = e.r * 2; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.tx, e.ty); ctx.stroke(); ctx.lineCap = 'butt';
        }
      }
      if (e.state === 'swing') {
        // the stretch it is about to cross
        const a0 = piv.down + e.side * e.A * Math.cos(Math.PI * e.st / e.H), a1 = piv.down + e.side * e.A * Math.cos(Math.PI * Math.min(e.H, e.st + 0.5) / e.H);
        ctx.strokeStyle = 'rgba(255,90,70,0.22)'; ctx.lineWidth = e.r * 2.1;
        ctx.beginPath(); ctx.arc(piv.x, piv.y, e.L, Math.min(a0, a1), Math.max(a0, a1)); ctx.stroke();
      }
      if (e.tel) B.drawTel(e, ctx, g);
      // the furrow
      for (const f of e.furrow) { const k = Math.min(1, f.t / 2.6); ctx.fillStyle = `rgba(255,${120 + 60 * k | 0},60,${0.25 + 0.45 * k})`; ctx.beginPath(); ctx.ellipse(f.x, f.y, 13, 8, (e.chainA || 0), 0, TAU); ctx.fill(); }
      ctx.restore();
      // the chain, from the pivot to the weight: slack while it falls
      const pv = e.state === 'drag' && e.sub === 1 ? e.piv : (e.nPiv && e.state === 'reel' ? e.nPiv : e.piv);
      const z = e.z || 0, wx = e.x, wy = e.y - z * 50;
      const L = LF.dist(pv.x, pv.y, wx, wy) || 1, ux = (wx - pv.x) / L, uy = (wy - pv.y) / L;
      const sag = e.state === 'drop' ? 60 * Math.sin(Math.PI * LF.clamp(1 - e.t / e.tMax, 0, 1)) : 0;
      ctx.lineWidth = 3;
      const n = Math.max(2, Math.floor(L / 13));
      for (let i = 0; i < n; i++) {
        const k = (i + 0.5) / n, x = pv.x + ux * L * k - uy * sag * Math.sin(k * Math.PI), y = pv.y + uy * L * k + ux * sag * Math.sin(k * Math.PI);
        ctx.strokeStyle = i % 2 ? '#2a1f1b' : '#3a2b23';
        ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(uy, ux)); ctx.beginPath(); ctx.ellipse(0, 0, 7, i % 2 ? 2 : 4, 0, 0, TAU); ctx.stroke(); ctx.restore();
      }
      // the pivot: an escapement wheel that turns a tooth with every swing
      ctx.save(); ctx.translate(pv.x, pv.y); ctx.rotate((e.tick || 0) * 0.42 + (e.state === 'swing' ? Math.sin(Math.PI * e.st / e.H) * 0.1 : 0));
      ctx.fillStyle = '#1b1412'; ctx.beginPath();
      for (let i = 0; i < 24; i++) { const a = i * TAU / 24, rr = i % 2 ? 22 : 28; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#4a3428'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#3a2a22'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill(); ctx.restore();
    },
    glowFloor(e, ctx, g) {
      if (!e.piv) return;
      for (const f of e.furrow) LF.drawGlow(ctx, '#ff8a3c', f.x, f.y, 22, 0.25 * Math.min(1, f.t / 2.6));
      const pv = e.state === 'drag' && e.sub === 1 ? e.piv : (e.nPiv && e.state === 'reel' ? e.nPiv : e.piv);
      LF.drawGlow(ctx, IRON, pv.x, pv.y, 40, 0.12 + 0.06 * Math.sin((g.time || 0) * 3));
    },
    draw(e, ctx, g) {
      const time = (g && g.time) || 0, ph = e.maxHp > 0 ? B.phaseOf(e) : (e.phase || 1), r = e.r || 34, hit = e.flash > 0.6;
      const z = e.z || 0, a = e.chainA === undefined ? Math.PI / 2 : e.chainA, sc = (1 + z * 0.3) * r / 34;
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + r * 0.45, r * (1.05 - z * 0.3), r * 0.5, 0, 0, TAU); ctx.fill();
      const body = hit ? '#fff' : (e.lit ? '#3a2c25' : '#1a1311'), dark = hit ? '#fff' : (e.lit ? '#241b17' : '#0c0908'), band = hit ? '#fff' : (e.lit ? '#6a4a36' : '#33241d');
      ctx.save(); ctx.translate(e.x, e.y - z * 50); ctx.rotate(a - Math.PI / 2); ctx.scale(sc, sc);
      // the hook ring that took the chain
      ctx.strokeStyle = band; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, -42, 8, 0, TAU); ctx.stroke();
      ctx.fillStyle = dark; ctx.fillRect(-7, -36, 14, 12);
      // the weight: narrow at the neck, broad and heavy below
      ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(-13, -25);
      ctx.bezierCurveTo(-30, -18, -38, 4, -34, 20); ctx.quadraticCurveTo(-30, 36, 0, 38); ctx.quadraticCurveTo(30, 36, 34, 20);
      ctx.bezierCurveTo(38, 4, 30, -18, 13, -25); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = band; ctx.lineWidth = 2; ctx.stroke();
      // iron bands and their rivets
      ctx.strokeStyle = band; ctx.lineWidth = 4;
      for (const by of [-8, 22]) { const w = by < 0 ? 29 : 33; ctx.beginPath(); ctx.moveTo(-w, by); ctx.quadraticCurveTo(0, by + 5, w, by); ctx.stroke(); }
      ctx.fillStyle = hit ? '#fff' : (e.lit ? '#8a6248' : '#3c2a21');
      for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.arc(i * 8, 23 + Math.abs(i) * -0.4, 1.6, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(i * 7, -7, 1.4, 0, TAU); ctx.fill(); }
      // a dial cut into its face, with one hand
      ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(0, 7, 11, 0, TAU); ctx.fill();
      ctx.strokeStyle = band; ctx.lineWidth = 1.2; ctx.stroke();
      for (let i = 0; i < 12; i++) { const q = i * TAU / 12; ctx.beginPath(); ctx.moveTo(Math.cos(q) * 8, 7 + Math.sin(q) * 8); ctx.lineTo(Math.cos(q) * 10, 7 + Math.sin(q) * 10); ctx.stroke(); }
      const hand = ((e.tick || 0) * TAU / 12) - Math.PI / 2;
      ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 7); ctx.lineTo(Math.cos(hand) * 8, 7 + Math.sin(hand) * 8); ctx.stroke();
      // cracks as it fails
      ctx.strokeStyle = '#070505'; ctx.lineWidth = 1.5 + ph; ctx.lineJoin = 'round';
      if (ph >= 2) { ctx.beginPath(); ctx.moveTo(-24, -10); ctx.lineTo(-15, 0); ctx.lineTo(-20, 12); ctx.lineTo(-11, 30); ctx.stroke(); }
      if (ph >= 3) { ctx.beginPath(); ctx.moveTo(26, -4); ctx.lineTo(17, 8); ctx.lineTo(24, 18); ctx.lineTo(14, 34); ctx.stroke(); }
      ctx.restore();
    },
    drawGlow(e, ctx, g) {
      const time = (g && g.time) || 0, ph = e.maxHp > 0 ? B.phaseOf(e) : (e.phase || 1), r = e.r || 34, z = e.z || 0;
      const a = e.chainA === undefined ? Math.PI / 2 : e.chainA, sc = (1 + z * 0.3) * r / 34, pulse = 0.55 + 0.2 * Math.sin(time * (2 + ph));
      ctx.save(); ctx.translate(e.x, e.y - z * 50); ctx.rotate(a - Math.PI / 2); ctx.scale(sc, sc);
      ctx.strokeStyle = `rgba(255,150,80,${pulse * 0.7})`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 7, 11, 0, TAU); ctx.stroke();
      const hand = ((e.tick || 0) * TAU / 12) - Math.PI / 2;
      ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, 7); ctx.lineTo(Math.cos(hand) * 8, 7 + Math.sin(hand) * 8); ctx.stroke();
      ctx.strokeStyle = `rgba(255,110,50,${pulse})`; ctx.lineWidth = 0.6 + ph * 0.5; ctx.lineJoin = 'round';
      if (ph >= 2) { ctx.beginPath(); ctx.moveTo(-24, -10); ctx.lineTo(-15, 0); ctx.lineTo(-20, 12); ctx.lineTo(-11, 30); ctx.stroke(); }
      if (ph >= 3) { ctx.beginPath(); ctx.moveTo(26, -4); ctx.lineTo(17, 8); ctx.lineTo(24, 18); ctx.lineTo(14, 34); ctx.stroke(); }
      ctx.restore();
      LF.drawGlow(ctx, IRON, e.x, e.y - z * 50, r * 1.4, 0.08 * pulse + (e.state === 'drag' ? 0.1 : 0));
    },
    light(e, lc, white) { lc.globalAlpha = 0.45; lc.drawImage(white, e.x - 80, e.y - 80, 160, 160); },
  };
  // arriving at the end of a drag: released into its swing (named apart so the switch above stays readable)
  function wStartReelDone(e, g) { e.x = e.tx; e.y = e.ty; wStartSwing(e, g); g.shake(3); }

  // =====================================================================================
  // THE FOUNDER (Depth III, Level 9: the Founders' Pit)
  // Slag runs down the channels cut across the floor: get out of a channel before it fills. Links it casts lie hot
  // where they land and bind whoever walks into them (a dash breaks free). Its hammer falls three times, on a beat,
  // and each blow splits the floor toward you.
  // =====================================================================================
  const SLAG = '#ff7a3a', SLAG_RGB = '255,122,58';
  function fChannels(g) {
    const r = B.arena(g), out = [];
    const hr = [Math.round(r.h * 0.32), Math.round(r.h * 0.64)], vc = [Math.round(r.w * 0.25), Math.round(r.w * 0.72)];
    for (const row of hr) out.push({ hor: true, c: (r.y + row + 0.5) * TILE, a0: r.x * TILE + 12, a1: (r.x + r.w) * TILE - 12, state: 'idle' });
    for (const col of vc) out.push({ hor: false, c: (r.x + col + 0.5) * TILE, a0: r.y * TILE + 12, a1: (r.y + r.h) * TILE - 12, state: 'idle' });
    return out;
  }
  const chPt = (ch, s, out) => { if (ch.hor) { out.x = s; out.y = ch.c; } else { out.x = ch.c; out.y = s; } return out; };
  const fTmp = { x: 0, y: 0 };
  function fBind(e, g, t) {
    const p = g.player;
    if (p.dead || p.dashing > 0) return;
    if (!(e.bindT > 0)) { fx.text(p.x, p.y - 34, 'BOUND', SLAG, 11, 0.9); LF.audio.play('crackle'); }
    e.bindT = Math.max(e.bindT || 0, t);
    if (!e.toldBind) { e.toldBind = true; g.banner = { text: 'Its links bind', sub: 'Dash to break free', t: 0, dur: 2.6, small: true, boss: true }; }
  }
  function fErupt(e, g, x, y, r) {
    fx.burst(x, y, 7, { color: [SLAG, '#ffd08a', '#3a1a10'], speed1: 170, life: 0.35, size: 2.4, grav: 120 });
    fx.ring(x, y, 4, r, 0.25, SLAG, 3);
    hurtIfNear(g, x, y, r, e.dmg * 0.55, 'the split floor');
  }

  DEFS.founder = {
    name: 'The Founder', title: 'It cast every link of the great chain', boss: true,
    hp: 3900, speed: 50, r: 36, dmg: 12, embers: 0, glass: 0, phases: [0.66, 0.33],
    eyes: [[13, -4, 2], [13, 4, 2]], eyeColor: '255,150,70',
    lore: 'No link it cast ever broke. The ones that fell were cut clean through.',
    init(e) { B.bossInit(e); e.chans = null; e.links = []; e.bindT = 0; e.linkT = 0; e.slagT = 0; e.wind = 0; e.tip = 0; e.toldBind = false; e.toldSlag = false; },
    update(e, g, dt) {
      const p = g.player;
      e.t -= dt; e.spin += dt; e.linkT -= dt; e.slagT -= dt; e.tip = Math.max(0, e.tip - dt * 1.5);
      ensureMark(e, g);
      if (!e.chans) e.chans = fChannels(g);
      B.updateTel(e, g, dt);
      if (B.phaseShift(e, g)) { e.state = 'idle'; e.t = 1.1; e.tel.length = 0; e.wind = 0; }
      const ph = e.phase, toP = Math.atan2(p.y - e.y, p.x - e.x);
      if (e.state !== 'hammer' || e.wind < 0.6) e.face = LF.turnToward(e.face, toP, 2.6 * dt);
      // bound: every step costs twice as much, until a dash breaks the links
      if (e.bindT > 0) {
        e.bindT -= dt;
        if (p.dead) e.bindT = 0;
        else if (p.dashing > 0) { e.bindT = 0; fx.burst(p.x, p.y, 10, { color: [SLAG, '#ffd08a'], speed1: 160, life: 0.4 }); LF.audio.play('crit'); }
        else { p.x -= p.vx * dt * 0.45; p.y -= p.vy * dt * 0.45; g.map.resolveCircle(p, p.r); }
      }
      // the channels
      const speed = [300, 340, 380][ph - 1], hold = [3.4, 3.9, 4.4][ph - 1];
      let anyLive = false;
      for (const ch of e.chans) {
        if (ch.crust > 0) ch.crust -= dt;
        if (ch.state === 'idle') continue;
        anyLive = true;
        ch.t -= dt;
        if (ch.state === 'warn') {
          for (let s = ch.a0; s <= ch.a1; s += 48) { chPt(ch, s, fTmp); g.hazards.push({ x: fTmp.x, y: fTmp.y, r: 24 }); }
          if (ch.t <= 0) { ch.state = 'flow'; ch.k = 0; ch.sp = 0.3; LF.audio.play('ignite'); }
          continue;
        }
        ch.k += dt;
        const start = ch.dir > 0 ? ch.a0 : ch.a1, end = ch.dir > 0 ? ch.a1 : ch.a0, len = ch.a1 - ch.a0;
        const fr = Math.min(len, speed * ch.k), tl = Math.max(0, speed * (ch.k - hold));
        ch.front = start + ch.dir * fr; ch.tail = start + ch.dir * Math.min(len, tl);
        if (tl >= len) { ch.state = 'idle'; ch.crust = 3; continue; }
        const lo = Math.min(ch.front, ch.tail), hi = Math.max(ch.front, ch.tail);
        for (let s = lo; s <= hi; s += 40) { chPt(ch, s, fTmp); g.hazards.push({ x: fTmp.x, y: fTmp.y, r: 24 }); }
        if (fr < len) for (let k = 1; k <= 3; k++) { chPt(ch, ch.front + ch.dir * k * 40, fTmp); g.hazards.push({ x: fTmp.x, y: fTmp.y, r: 24 }); }
        // standing in it burns
        const pa = ch.hor ? p.x : p.y, pc = ch.hor ? p.y : p.x;
        if (!p.dead && e.slagT <= 0 && p.dashing <= 0 && p.invuln <= 0 && Math.abs(pc - ch.c) < 18 + p.r - 4 && pa >= lo - 6 && pa <= hi + 6) {
          e.slagT = 0.45; g.hurtPlayer(e.dmg * 0.5, { x: ch.hor ? p.x : ch.c, y: ch.hor ? ch.c : p.y, name: 'running slag' });
        }
        // it spatters as it runs
        if (ph >= 2 && fr < len) {
          ch.sp -= dt;
          if (ch.sp <= 0) {
            ch.sp = 0.42; chPt(ch, ch.front, fTmp);
            const a = ch.hor ? Math.PI / 2 : 0;
            for (const s of [-1, 1]) g.fireEnemyBullet({ x: fTmp.x, y: fTmp.y, angle: a + (s < 0 ? Math.PI : 0) + LF.rand(-0.35, 0.35), speed: 105, dmg: e.dmg * 0.55, color: SLAG, size: 4, life: 1.6 });
          }
        }
        if (Math.random() < dt * 14) { chPt(ch, LF.rand(lo, hi), fTmp); fx.spawn({ x: fTmp.x + LF.rand(-8, 8), y: fTmp.y + LF.rand(-8, 8), vy: -40, life: 0.5, size: 2.4, color: LF.pick([SLAG, '#ffc24d', '#ff4d1f']) }); }
      }
      // the links: falling, then lying hot
      for (const l of e.links) {
        if (l.land > 0) {
          l.land -= dt;
          g.hazards.push({ x: l.x, y: l.y, r: 26 });
          if (l.land <= 0) {
            fx.burst(l.x, l.y, 6, { color: [SLAG, '#ffd08a'], speed1: 120, life: 0.3 });
            if (hurtIfNear(g, l.x, l.y, 22, e.dmg * 0.6, 'a falling link')) fBind(e, g, 1.8);
          }
          continue;
        }
        l.t -= dt;
        if (l.t <= 0) { l.dead = true; continue; }
        g.hazards.push({ x: l.x, y: l.y, r: 18 });
        if (!p.dead && p.dashing <= 0 && LF.dist2(p.x, p.y, l.x, l.y) < (14 + p.r) * (14 + p.r)) {
          const fresh = !(e.bindT > 0);
          fBind(e, g, 1.5);
          if (fresh && e.linkT <= 0 && p.invuln <= 0) { e.linkT = 1.2; g.hurtPlayer(e.dmg * 0.3, { x: l.x, y: l.y, name: 'a hot link' }); }
        }
      }
      LF.compact(e.links);

      switch (e.state) {
        case 'intro': if (e.t <= 0) { e.state = 'idle'; e.t = 0.6; } break;
        case 'idle': {
          const d = LF.dist(e.x, e.y, p.x, p.y);
          if (d > 150) { const sp = (e.speed + ph * 6) * e.slowMul(g); e.x += Math.cos(toP) * sp * dt; e.y += Math.sin(toP) * sp * dt; g.map.resolveCircle(e, e.r * 0.7); }
          if (e.t <= 0) {
            const opts = ['hammer', 'links'];
            if (!anyLive) opts.push('pour');
            e.state = B.pickAttack(e, opts);
            if (e.state === 'pour') { e.t = 0.9; LF.audio.play('charge'); }
            else if (e.state === 'links') { e.t = 0.7; LF.audio.play('telegraph'); }
            else if (e.state === 'hammer') { e.count = 3; e.sub = 0; e.t = 0; }
          }
          break;
        }
        case 'pour':
          // it tips the crucible: the channels nearest you fill
          e.tip = 1; e.red = 1;
          if (e.t <= 0) {
            const n = ph, byNear = e.chans.slice().sort((a, b) => Math.abs((a.hor ? p.y : p.x) - a.c) - Math.abs((b.hor ? p.y : p.x) - b.c));
            const pick = ph === 2 ? [byNear.find(c => c.hor), byNear.find(c => !c.hor)] : byNear.slice(0, n);
            for (const ch of pick) {
              if (!ch) continue;
              const self = ch.hor ? e.x : e.y;
              ch.state = 'warn'; ch.t = 1.05; ch.dir = Math.abs(self - ch.a0) < Math.abs(self - ch.a1) ? 1 : -1; ch.front = ch.tail = ch.dir > 0 ? ch.a0 : ch.a1;
            }
            fx.burst(e.x + Math.cos(e.face - 1) * 40, e.y + Math.sin(e.face - 1) * 40, 14, { color: [SLAG, '#ffd08a'], speed1: 160, life: 0.5, grav: 200 });
            LF.audio.play('ignite');
            if (!e.toldSlag) { e.toldSlag = true; g.banner = { text: 'The channels fill', sub: 'Get out before the slag runs', t: 0, dur: 2.6, small: true, boss: true }; }
            e.state = 'idle'; e.t = 1.3;
          }
          break;
        case 'links':
          e.red = 1;
          if (e.t <= 0) {
            // a length of chain, cast across your path
            const n = 4 + ph * 2, sets = ph === 3 ? 2 : 1, cx = p.x + p.vx * 0.3, cy = p.y + p.vy * 0.3;
            for (let s = 0; s < sets; s++) {
              const a = toP + Math.PI / 2 + s * Math.PI / 2;
              for (let i = 0; i < n; i++) {
                const k = (i - (n - 1) / 2) * 36, o = inArena(g, cx + Math.cos(a) * k, cy + Math.sin(a) * k, 24);
                e.links.push({ x: o.x, y: o.y, a: a + (i % 2 ? Math.PI / 2 : 0), land: 0.85 + i * 0.05 + s * 0.2, t: 6 + ph, sx: e.x, sy: e.y });
              }
            }
            LF.audio.play('lunge'); e.state = 'idle'; e.t = 1.2;
          }
          break;
        case 'hammer': {
          // three blows on the beat of an anvil; the third splits the floor three ways
          const beat = [0.78, 0.68, 0.6][ph - 1];
          if (e.sub === 0) {
            e.sub = 1; e.t = beat; e.ha = toP; e.wind = 0;
            const heavy = e.count === 1, lines = heavy ? [-0.42, 0, 0.42] : [0], steps = heavy ? 7 : 5;
            for (const off of lines) {
              // the crack runs out from the blow, zigzagging
              const a = e.ha + off, zig = Math.random() < 0.5 ? 13 : -13, nx = -Math.sin(a), ny = Math.cos(a);
              for (let i = 0; i < steps; i++) {
                const z = i % 2 ? zig : -zig, x = e.x + Math.cos(a) * (58 + i * 46) + nx * z, y = e.y + Math.sin(a) * (58 + i * 46) + ny * z;
                if (g.map.solidAt(x, y)) break;
                B.telegraph(e, x, y, 28, beat + 0.22 + i * 0.07, t => fErupt(e, g, t.x, t.y, 30), SLAG_RGB);
              }
            }
            LF.audio.play('telegraph');
          } else {
            e.red = 1; e.wind = LF.clamp(1 - e.t / beat, 0, 1); e.face = LF.turnToward(e.face, e.ha, 6 * dt);
            if (e.t <= 0) {
              e.wind = 0; g.shake(e.count === 1 ? 9 : 5); LF.audio.play(e.count === 1 ? 'explode' : 'crit'); LF.audio.play('gate');
              B.blast(g, e.x + Math.cos(e.ha) * 44, e.y + Math.sin(e.ha) * 44, 40, e.dmg, 'the hammer', SLAG);
              if (e.dead) return;
              if (--e.count > 0) { e.sub = 0; } else { e.state = 'idle'; e.t = 1.7; }
            }
          }
          break;
        }
      }
    },
    drawFloor(e, ctx, g) {
      if (!e.chans) return;
      const time = g.time || 0;
      // the channels cut across the floor, and what runs in them
      for (const ch of e.chans) {
        const a = chPt(ch, ch.a0, { x: 0, y: 0 }), b = chPt(ch, ch.a1, { x: 0, y: 0 });
        ctx.lineCap = 'butt';
        ctx.strokeStyle = 'rgba(14,8,6,0.75)'; ctx.lineWidth = 34; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.strokeStyle = 'rgba(80,44,30,0.6)'; ctx.lineWidth = 2;
        for (const s of [-17, 17]) { ctx.beginPath(); if (ch.hor) { ctx.moveTo(a.x, a.y + s); ctx.lineTo(b.x, b.y + s); } else { ctx.moveTo(a.x + s, a.y); ctx.lineTo(b.x + s, b.y); } ctx.stroke(); }
        if (ch.crust > 0) { ctx.strokeStyle = `rgba(60,30,22,${0.8 * Math.min(1, ch.crust)})`; ctx.lineWidth = 26; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
        if (ch.state === 'warn') {
          const k = 1 - Math.max(0, ch.t) / 1.05;
          ctx.strokeStyle = `rgba(255,90,60,${0.12 + 0.25 * k})`; ctx.lineWidth = 40; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,140,90,0.8)'; ctx.lineWidth = 2; ctx.setLineDash([12, 10]); ctx.lineDashOffset = -time * 60 * ch.dir;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
        } else if (ch.state === 'flow') {
          const f = chPt(ch, ch.front, { x: 0, y: 0 }), t = chPt(ch, ch.tail, { x: 0, y: 0 });
          ctx.strokeStyle = '#7a2a10'; ctx.lineWidth = 30; ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(f.x, f.y); ctx.stroke();
          ctx.strokeStyle = '#d8541e'; ctx.lineWidth = 20; ctx.stroke();
          ctx.strokeStyle = '#ffb04a'; ctx.lineWidth = 6; ctx.setLineDash([18, 14]); ctx.lineDashOffset = -time * 40 * ch.dir; ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
        }
      }
      // the links
      for (const l of e.links) {
        if (l.land > 0) {
          const k = 1 - LF.clamp(l.land / 0.85, 0, 1);
          ctx.strokeStyle = `rgba(255,90,60,${0.3 + 0.5 * k})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(l.x, l.y, 22, 0, TAU); ctx.stroke();
          ctx.fillStyle = `rgba(255,90,60,${0.1 + 0.15 * k})`; ctx.fill();
          continue;
        }
        const k = Math.min(1, l.t / 2);
        ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(l.a);
        ctx.strokeStyle = `rgb(${90 + 150 * k | 0},${40 + 60 * k | 0},${20 + 10 * k | 0})`; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.ellipse(0, 0, 14, 8, 0, 0, TAU); ctx.stroke(); ctx.restore();
      }
      // links in flight, and the chains on whoever they bound
      for (const l of e.links) {
        if (!(l.land > 0)) continue;
        const k = 1 - LF.clamp(l.land / 0.9, 0, 1), x = LF.lerp(l.sx, l.x, k), y = LF.lerp(l.sy, l.y, k) - Math.sin(k * Math.PI) * 90;
        ctx.strokeStyle = '#ffb04a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y, 7, 4, time * 8 + l.a, 0, TAU); ctx.stroke();
      }
      if (e.bindT > 0) {
        const p = g.player;
        ctx.strokeStyle = '#c86a32'; ctx.lineWidth = 3;
        for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + time; ctx.beginPath(); ctx.ellipse(p.x + Math.cos(a) * 16, p.y + Math.sin(a) * 16, 6, 3.5, a, 0, TAU); ctx.stroke(); }
      }
      if (e.tel) B.drawTel(e, ctx, g);
    },
    glowFloor(e, ctx, g) {
      if (!e.chans) return;
      for (const ch of e.chans) {
        if (ch.state !== 'flow') continue;
        const lo = Math.min(ch.front, ch.tail), hi = Math.max(ch.front, ch.tail);
        for (let s = lo; s <= hi; s += 90) { chPt(ch, s, fTmp); LF.drawGlow(ctx, SLAG, fTmp.x, fTmp.y, 60, 0.16); }
        chPt(ch, ch.front, fTmp); LF.drawGlow(ctx, '#ffd08a', fTmp.x, fTmp.y, 40, 0.3);
      }
      for (const l of e.links) if (!(l.land > 0)) LF.drawGlow(ctx, SLAG, l.x, l.y, 22, 0.25 * Math.min(1, l.t / 2));
    },
    draw(e, ctx, g) {
      const time = (g && g.time) || 0, ph = e.maxHp > 0 ? B.phaseOf(e) : (e.phase || 1), r = e.r || 36, hit = e.flash > 0.6;
      const wind = e.wind || 0, tip = e.tip || 0, step = Math.sin(time * 4) * (e.state === 'idle' ? 1 : 0.3);
      const body = hit ? '#fff' : (e.lit ? '#3a2b26' : '#16100f'), hide = hit ? '#fff' : (e.lit ? '#4e3426' : '#1f1410'), iron = hit ? '#fff' : (e.lit ? '#5a4a44' : '#25201e');
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + r * 0.55, r * 1.25, r * 0.5, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.face || 0); ctx.scale(r / 36, r / 36);
      // a length of the great chain slung over its back
      ctx.strokeStyle = iron; ctx.lineWidth = 4;
      for (let i = 0; i < 6; i++) { const a = -1.1 + i * 0.44; ctx.save(); ctx.translate(-26 + Math.cos(a) * 6, Math.sin(a) * 30); ctx.rotate(a + (i % 2 ? Math.PI / 2 : 0)); ctx.beginPath(); ctx.ellipse(0, 0, 7, 4.5, 0, 0, TAU); ctx.stroke(); ctx.restore(); }
      // shoulders and back: a hulk
      ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(-4, 0, 24, 36, 0, 0, TAU); ctx.fill();
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(-2, s * 30, 15, 13, 0, 0, TAU); ctx.fill(); }
      // the slag apron hanging in front, scorched through
      ctx.fillStyle = hide; ctx.beginPath(); ctx.moveTo(6, -24); ctx.lineTo(30 + step, -18); ctx.lineTo(33 + step, -6); ctx.lineTo(30 + step, 6); ctx.lineTo(33 + step, 18); ctx.lineTo(6, 24); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = hit ? '#fff' : '#120a08'; ctx.lineWidth = 1.5;
      for (const y of [-12, 0, 12]) { ctx.beginPath(); ctx.moveTo(10, y); ctx.lineTo(28, y + 2); ctx.stroke(); }
      // the head, low between the shoulders, under a hood
      ctx.fillStyle = hit ? '#fff' : (e.lit ? '#2c201c' : '#0e0a09'); ctx.beginPath(); ctx.ellipse(8, 0, 11, 10, 0, 0, TAU); ctx.fill();
      // left arm: the crucible
      ctx.save(); ctx.translate(14, -38); ctx.rotate(-tip * 0.9);
      ctx.strokeStyle = body; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(-14, 8); ctx.lineTo(6, 2); ctx.stroke();
      ctx.fillStyle = iron; ctx.beginPath(); ctx.ellipse(12, 0, 12, 10, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = hit ? '#fff' : '#3a1208'; ctx.beginPath(); ctx.ellipse(12, 0, 8, 6.5, 0, 0, TAU); ctx.fill();
      ctx.restore();
      // right arm: the hammer, raised on the backswing
      ctx.save(); ctx.translate(-2, 32); ctx.rotate(0.35 - wind * 2.4);
      ctx.strokeStyle = body; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(22, 6); ctx.stroke();
      ctx.strokeStyle = hit ? '#fff' : (e.lit ? '#4a3a30' : '#1d1612'); ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(20, 6); ctx.lineTo(54, 6); ctx.stroke();
      ctx.fillStyle = iron; ctx.fillRect(48, -8, 16, 28);
      ctx.fillStyle = hit ? '#fff' : (e.lit ? '#776560' : '#332b28'); ctx.fillRect(62, -8, 3, 28);
      ctx.restore();
      // cracks of slag through the hide as it fails
      ctx.strokeStyle = '#0a0605'; ctx.lineWidth = 1.5 + ph; ctx.lineJoin = 'round';
      if (ph >= 2) { ctx.beginPath(); ctx.moveTo(-18, -22); ctx.lineTo(-8, -10); ctx.lineTo(-16, 2); ctx.lineTo(-6, 16); ctx.stroke(); }
      if (ph >= 3) { ctx.beginPath(); ctx.moveTo(-24, 10); ctx.lineTo(-12, 22); ctx.lineTo(-18, 30); ctx.stroke(); }
      ctx.restore();
    },
    drawGlow(e, ctx, g) {
      const time = (g && g.time) || 0, ph = e.maxHp > 0 ? B.phaseOf(e) : (e.phase || 1), r = e.r || 36, tip = e.tip || 0, wind = e.wind || 0;
      const pulse = 0.65 + 0.2 * Math.sin(time * (3 + ph));
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.face || 0); ctx.scale(r / 36, r / 36);
      // the crucible's mouth
      ctx.save(); ctx.translate(14, -38); ctx.rotate(-tip * 0.9);
      ctx.fillStyle = `rgba(255,150,60,${0.7 * pulse})`; ctx.beginPath(); ctx.ellipse(12, 0, 7, 5.5, 0, 0, TAU); ctx.fill(); ctx.restore();
      // seams in the apron and the cracks
      ctx.strokeStyle = `rgba(255,110,50,${0.45 * pulse})`; ctx.lineWidth = 1;
      for (const y of [-12, 0, 12]) { ctx.beginPath(); ctx.moveTo(10, y); ctx.lineTo(28, y + 2); ctx.stroke(); }
      ctx.strokeStyle = `rgba(255,120,50,${pulse})`; ctx.lineWidth = 0.6 + ph * 0.5;
      if (ph >= 2) { ctx.beginPath(); ctx.moveTo(-18, -22); ctx.lineTo(-8, -10); ctx.lineTo(-16, 2); ctx.lineTo(-6, 16); ctx.stroke(); }
      if (ph >= 3) { ctx.beginPath(); ctx.moveTo(-24, 10); ctx.lineTo(-12, 22); ctx.lineTo(-18, 30); ctx.stroke(); }
      // the hammer's face glows as it comes up
      if (wind > 0) { ctx.save(); ctx.translate(-2, 32); ctx.rotate(0.35 - wind * 2.4); ctx.fillStyle = `rgba(255,170,90,${0.5 * wind})`; ctx.fillRect(48, -8, 16, 28); ctx.restore(); }
      ctx.restore();
      const cx = e.x + Math.cos((e.face || 0) - 1.2) * 44 * r / 36, cy = e.y + Math.sin((e.face || 0) - 1.2) * 44 * r / 36;
      LF.drawGlow(ctx, SLAG, cx, cy, 34 + tip * 20, 0.3 * pulse);
      LF.drawGlow(ctx, '#ff5a2a', e.x, e.y, r * 1.5, 0.07);
    },
    light(e, lc, white) { lc.globalAlpha = 0.5; lc.drawImage(white, e.x - 90, e.y - 90, 180, 180); },
  };

  // =====================================================================================
  // THE LAMP-EATER (Depth IV, Level 3: the Lamplighters' Hall)
  // The hall's lamps and braziers burn when you come in. It goes to them and swallows them, growing, mending, and
  // hardening with every flame it holds; it spits them back at you. Relight what it ate and the flame is torn back
  // out of it. Starved, it is soft. A flare while it is swallowing chokes it.
  // =====================================================================================
  const LAMP = '#ffc46b', LAMP_RGB = '255,196,107', MAXB = 6;
  function lSetup(e, g) {
    e.lights = [];
    const r = B.arena(g), T = LF.T, map = g.map;
    for (const pr of g.props) {
      if (pr.room !== 0 || (pr.kind !== 'brazier' && pr.kind !== 'lamp')) continue;
      if (pr.kind === 'brazier' && !pr.lit) g.lightBrazier(pr, true);
      if (pr.kind === 'lamp' && !pr.lit) { pr.lit = true; g.litLamps.push(pr); }
      e.lights.push(pr);
    }
    const add = (x, y) => {
      if (map.solidAt(x, y)) return;
      for (const l of e.lights) if (LF.dist2(l.x, l.y, x, y) < 60 * 60) return;
      const l = { kind: 'lamp', x, y, lit: true, room: 0 };
      g.props.push(l); g.litLamps.push(l); e.lights.push(l);
    };
    // sconces along the north wall, and one under every pillar
    for (let i = 0; i < 5; i++) { const tx = r.x + Math.round(2 + i * (r.w - 5) / 4); if (map.get(tx, r.y - 1) === T.WALL || map.get(tx, r.y - 1) === T.VOID) add((tx + 0.5) * TILE, r.y * TILE + 3); }
    for (let y = r.y; y < r.y + r.h - 1; y++) for (let x = r.x; x < r.x + r.w; x++) {
      if (map.get(x, y) === T.PILLAR && map.get(x, y + 1) !== T.PILLAR && !map.solidT(x, y + 1)) add((x + 0.5) * TILE, (y + 1) * TILE + 3);
    }
  }
  const lLit = e => { let n = 0; for (const l of e.lights) if (l.lit) n++; return n; };
  function lMouth(e, out) { const r = e.r || 30; out.x = e.x + Math.cos(e.face || 0) * r * 0.95; out.y = e.y + Math.sin(e.face || 0) * r * 0.95; return out; }
  const lTmp = { x: 0, y: 0 };
  function lChoose(e, g) {
    let best = null, bd = Infinity;
    for (const l of e.lights) { if (!l.lit) continue; const d = LF.dist(l.x, l.y, e.x, e.y); if (d < bd) { bd = d; best = l; } }
    return best;
  }
  function lSwallow(e, g, pr) {
    pr.lit = false;
    if (pr.kind === 'brazier') { pr.snuffed = true; pr.kindle = 0; pr.casting = false; g.litBraziers = g.props.filter(q => q.kind === 'brazier' && q.lit); }
    else g.litLamps = g.litLamps.filter(l => l.lit);
    e.eaten.push(pr); e.belly = Math.min(MAXB, e.belly + 1);
    e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.03);
    e.r = e.def.r * (1 + 0.07 * e.belly);
    lMouth(e, lTmp);
    fx.arc(pr.x, pr.y - 8, lTmp.x, lTmp.y, '#ffcf8a', 0.35, 5, 'tendril');
    fx.burst(pr.x, pr.y - 8, 14, { color: ['#2a1d10', '#110b06'], glow: false, speed1: 110, life: 0.6, size: 4 });
    fx.text(pr.x, pr.y - 30, 'SWALLOWED', LAMP, 11, 1);
    LF.audio.play('steal'); e.flash = 0.5;
    if (!e.toldEat) { e.toldEat = true; g.banner = { text: 'It eats the light', sub: 'Relight what it swallows to tear it back out', t: 0, dur: 3, small: true, boss: true }; }
  }
  function lChoke(e, g) {
    e.state = 'choke'; e.t = 1.6; e.tongue = null;
    fx.text(e.x, e.y - e.r - 20, 'CHOKED', LAMP, 14, 1.1); LF.audio.play('crit'); g.shake(6);
  }

  DEFS.lampeater = {
    name: 'The Lamp-Eater', title: 'It swallowed the lamps of a whole street', boss: true,
    hp: 1800, speed: 92, r: 30, dmg: 9.5, embers: 0, glass: 0, phases: [0.66, 0.33],
    eyes: [[27, -10, 1.7], [27, 10, 1.7], [21, -15, 1.3], [21, 15, 1.3]], eyeColor: '255,196,107',
    lore: 'It ate every lamp in Vael that was still burning after the fall. There were not many.',
    init(e) { B.bossInit(e); e.lights = null; e.eaten = []; e.belly = 0; e.globs = []; e.pools = []; e.feedCd = 0; e.poolT = 0; e.sootT = 0; e.gape = 0; e.tongue = null; e.toldEat = false; e.toldRip = false; e.feedN = 0; },
    modDamage(e, dmg, src, g) {
      if (src.type === 'rip') return dmg;
      let m = e.belly > 0 ? Math.max(0.58, 1 - 0.07 * e.belly) : 1.3;
      if (e.state === 'gulp' && src.type === 'flare' && g) lChoke(e, g);
      if (e.state === 'choke') m *= 1.5;
      if (!src.quiet && !src.sear && Math.random() < 0.06) fx.text(e.x, e.y - e.r - 18, e.belly > 0 ? 'GORGED' : 'STARVED', e.belly > 0 ? '#a08a66' : LAMP, 9, 0.5);
      return dmg * m;
    },
    update(e, g, dt) {
      const p = g.player;
      e.t -= dt; e.spin += dt; e.feedCd -= dt; e.poolT -= dt; e.gape = Math.max(0, e.gape - dt * 2);
      ensureMark(e, g);
      if (!e.lights) lSetup(e, g);
      B.updateTel(e, g, dt);
      if (B.phaseShift(e, g)) { e.state = 'idle'; e.t = 0.9; e.tel.length = 0; e.tongue = null; e.feedCd = 0; }
      const ph = e.phase, toP = Math.atan2(p.y - e.y, p.x - e.x);
      // a flame it ate, relit: torn back out of it
      for (let i = e.eaten.length - 1; i >= 0; i--) {
        const pr = e.eaten[i];
        if (!pr.lit) continue;
        e.eaten.splice(i, 1);
        if (e.belly <= 0) continue;
        e.belly--; e.r = e.def.r * (1 + 0.07 * e.belly);
        fx.arc(e.x, e.y, pr.x, pr.y - 8, '#ffe2a6', 0.35, 6, 'beam');
        fx.text(e.x, e.y - e.r - 22, 'TORN BACK', LAMP, 13, 1.1);
        LF.audio.play('crit'); g.shake(5);
        g.damageEnemy(e, e.maxHp * 0.05, { type: 'rip', noShroud: true, force: true });
        if (e.dead) return;
        if (e.state === 'idle' || e.state === 'stalk') { e.state = 'choke'; e.t = 0.8; }
      }
      // spat flame in flight, and the fires it leaves
      for (const gl of e.globs) {
        gl.t -= dt;
        g.hazards.push({ x: gl.x, y: gl.y, r: 44 });
        if (gl.t <= 0) {
          gl.dead = true;
          fx.burst(gl.x, gl.y, 12, { color: [LAMP, '#ff7b2e', '#fff'], speed1: 180, life: 0.4 }); fx.ring(gl.x, gl.y, 6, 40, 0.3, LAMP, 3);
          hurtIfNear(g, gl.x, gl.y, 38, e.dmg, 'spat flame');
          if (e.pools.length < 12) e.pools.push({ x: gl.x, y: gl.y, r: 32, t: 3.2 });
          LF.audio.play('ignite');
        }
      }
      LF.compact(e.globs);
      for (const pl of e.pools) {
        pl.t -= dt; if (pl.t <= 0) { pl.dead = true; continue; }
        g.hazards.push({ x: pl.x, y: pl.y, r: pl.r });
        if (e.poolT <= 0 && !p.dead && p.dashing <= 0 && p.invuln <= 0 && LF.dist2(p.x, p.y, pl.x, pl.y) < (pl.r + p.r - 6) * (pl.r + p.r - 6)) { e.poolT = 0.5; g.hurtPlayer(e.dmg * 0.4, { x: pl.x, y: pl.y, name: 'spat flame' }); }
        if (Math.random() < dt * 6) fx.spawn({ x: pl.x + LF.rand(-pl.r, pl.r) * 0.6, y: pl.y + LF.rand(-pl.r, pl.r) * 0.6, vy: -50, life: 0.5, size: 3, color: LF.pick(['#ff7b2e', '#ffc24d']) });
      }
      LF.compact(e.pools);
      // soot in the lantern: the light gutters for a while
      if (e.sootT > 0) { e.sootT -= dt; g.snuffCount += 2; }

      switch (e.state) {
        case 'intro': if (e.t <= 0) { e.state = 'idle'; e.t = 0.4; } break;
        case 'idle': {
          // it prowls at the edge of your light
          e.face = LF.turnToward(e.face, toP, 4 * dt);
          const d = LF.dist(e.x, e.y, p.x, p.y), want = 190;
          const rad = d > want + 30 ? 1 : d < want - 30 ? -1 : 0, sp = (e.speed + ph * 10) * e.slowMul(g);
          e.x += (Math.cos(toP) * rad - Math.sin(toP) * e.dir * 0.6) * sp * dt; e.y += (Math.sin(toP) * rad + Math.cos(toP) * e.dir * 0.6) * sp * dt;
          if (g.map.resolveCircle(e, e.r * 0.7) && Math.random() < dt * 4) e.dir *= -1;
          if (e.t <= 0) {
            const lit = lLit(e), opts = ['soot'];
            if (lit && e.belly < MAXB && e.feedCd <= 0) opts.push('feed', 'feed', 'feed');
            if (e.belly > 0) opts.push('spit', 'spit');
            if (e.belly === 0 || ph >= 2) opts.push('lunge');
            e.state = B.pickAttack(e, opts);
            if (e.state === 'feed') { e.state = 'stalk'; e.feedN = ph === 3 ? 2 : 1; e.prey = lChoose(e, g); e.t = 4; }
            else if (e.state === 'spit') { e.count = Math.min(6, 1 + Math.ceil(e.belly / 2) + (ph - 1)); e.t = 0.55; e.sub = 0; LF.audio.play('charge'); }
            else if (e.state === 'soot') { e.sub = 0; e.t = 0.85; e.sa = toP; LF.audio.play('telegraph'); }
            else if (e.state === 'lunge') { e.sub = 0; e.t = 0; e.count = ph >= 3 ? 2 : 1; }
          }
          break;
        }
        case 'stalk': {
          // to the nearest light it can see
          const pr = e.prey;
          if (!pr || !pr.lit || e.t <= 0) {
            e.prey = lChoose(e, g);
            if (!e.prey || e.t <= 0) { e.state = 'idle'; e.t = 0.8; e.feedCd = [7, 6, 5][ph - 1]; }
            break;
          }
          const a = Math.atan2(pr.y - e.y, pr.x - e.x), d = LF.dist(e.x, e.y, pr.x, pr.y), reach = ph >= 2 ? 170 : 70;
          e.face = LF.turnToward(e.face, a, 6 * dt);
          if (d > reach) { const sp = (e.speed * 1.5 + ph * 12) * e.slowMul(g); e.x += Math.cos(a) * sp * dt; e.y += Math.sin(a) * sp * dt; g.map.resolveCircle(e, e.r * 0.7); }
          else { e.state = 'gulp'; e.t = e.tMax = [0.9, 0.8, 0.6][ph - 1]; e.tongue = pr; LF.audio.play('whisper'); }
          break;
        }
        case 'gulp': {
          // its tongue is out to the flame: a flare now makes it choke
          const pr = e.tongue;
          e.gape = 1; e.red = 1;
          if (!pr || !pr.lit) { e.tongue = null; e.state = 'stalk'; e.prey = lChoose(e, g); e.t = 3; break; }
          e.face = LF.turnToward(e.face, Math.atan2(pr.y - e.y, pr.x - e.x), 8 * dt);
          lMouth(e, lTmp);
          if (ph >= 2) {
            // the tongue itself scalds
            for (let s = 0.25; s < 1; s += 0.25) g.hazards.push({ x: LF.lerp(lTmp.x, pr.x, s), y: LF.lerp(lTmp.y, pr.y, s), r: 14 });
            if (!p.dead && p.dashing <= 0 && p.invuln <= 0 && segDist(p.x, p.y, lTmp.x, lTmp.y, pr.x, pr.y) < 6 + p.r) g.hurtPlayer(e.dmg * 0.6, { x: p.x, y: p.y, name: 'the Lamp-Eater' });
          }
          if (Math.random() < dt * 30) { const k = Math.random(); fx.spawn({ x: LF.lerp(pr.x, lTmp.x, k), y: LF.lerp(pr.y - 8, lTmp.y, k), vx: (lTmp.x - pr.x) * 1.5, vy: (lTmp.y - pr.y) * 1.5, life: 0.3, size: 2, color: '#ffcf8a' }); }
          if (e.t <= 0) {
            lSwallow(e, g, pr); e.tongue = null;
            if (--e.feedN > 0 && lLit(e)) { e.state = 'stalk'; e.prey = lChoose(e, g); e.t = 3; }
            else { e.state = 'idle'; e.t = 1.0; e.feedCd = [8, 6.5, 5][ph - 1]; }
          }
          break;
        }
        case 'choke':
          e.gape = 0.6;
          if (e.t <= 0) { e.state = 'idle'; e.t = 0.6; e.feedCd = Math.max(e.feedCd, 3); }
          break;
        case 'spit':
          e.face = LF.turnToward(e.face, toP, 5 * dt); e.red = 1;
          if (e.t <= 0) {
            // a swallowed flame, lobbed where you are going
            lMouth(e, lTmp);
            const lead = 0.5 + e.sub * 0.1, o = inArena(g, p.x + p.vx * lead + LF.rand(-40, 40) * (e.sub ? 1 : 0), p.y + p.vy * lead + LF.rand(-40, 40) * (e.sub ? 1 : 0), 30);
            const ft = 0.85 + LF.dist(lTmp.x, lTmp.y, o.x, o.y) / 900;
            e.globs.push({ sx: lTmp.x, sy: lTmp.y, x: o.x, y: o.y, t: ft, max: ft });
            LF.audio.play('spit'); e.gape = 1; e.sub++;
            if (--e.count > 0) e.t = 0.28;
            else {
              // at the last it retches what is left in a ring
              if (ph >= 3 && e.belly >= 3) B.ring(g, e.x, e.y, 10 + e.belly * 2, 130, e.dmg * 0.6, Math.random() * TAU, { color: LAMP, gapEvery: 6, gapSize: 2 });
              e.state = 'idle'; e.t = 1.2;
            }
          }
          break;
        case 'soot': {
          // a cone of soot from its throat; it chokes your lantern
          const len = 250, half = 0.5;
          e.face = LF.turnToward(e.face, e.sa, 8 * dt); e.gape = 1; e.red = 1;
          for (const dd of [60, 120, 180, 235]) g.hazards.push({ x: e.x + Math.cos(e.sa) * dd, y: e.y + Math.sin(e.sa) * dd, r: dd * Math.tan(half) + 12 });
          if (e.sub === 0) {
            if (e.t <= 0) { e.sub = 1; e.t = 0.55; e.hitSoot = false; LF.audio.play('steal'); }
          } else {
            if (Math.random() < dt * 60) { const a = e.sa + LF.rand(-half, half), s = LF.rand(160, 320); fx.spawn({ x: e.x + Math.cos(e.sa) * e.r, y: e.y + Math.sin(e.sa) * e.r, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.7, size: 8, color: LF.pick(['#1a120c', '#0d0906', '#2a1d12']), glow: false, drag: 1.5 }); }
            const d = LF.dist(e.x, e.y, p.x, p.y);
            if (!e.hitSoot && !p.dead && p.dashing <= 0 && p.invuln <= 0 && d < len + p.r && Math.abs(LF.angDiff(e.sa, Math.atan2(p.y - e.y, p.x - e.x))) < half) {
              e.hitSoot = true; e.sootT = 3.5; g.hurtPlayer(e.dmg * 0.85, { x: e.x, y: e.y, name: 'the Lamp-Eater' });
              fx.text(p.x, p.y - 34, 'SOOTED', '#a08a66', 11, 1);
            }
            if (e.t <= 0) { e.state = 'idle'; e.t = 1.1; }
          }
          break;
        }
        case 'lunge': {
          if (e.sub === 0) {
            e.sa = Math.atan2(p.y + p.vy * 0.25 - e.y, p.x + p.vx * 0.25 - e.x); e.face = e.sa;
            e.len = Math.max(60, Math.min(380, g.map.raycast(e.x, e.y, Math.cos(e.sa), Math.sin(e.sa), 380) - e.r));
            e.sub = 1; e.t = e.tMax = ph >= 3 ? 0.5 : 0.62; LF.audio.play('telegraph');
          } else if (e.sub === 1) {
            e.red = 1; e.gape = 1;
            for (let s = 30; s <= e.len + 20; s += 50) g.hazards.push({ x: e.x + Math.cos(e.sa) * s, y: e.y + Math.sin(e.sa) * s, r: e.r + 8 });
            if (e.t <= 0) { e.sub = 2; e.t = 0.3; e.sx = e.x; e.sy = e.y; e.bit = false; LF.audio.play('lunge'); }
          } else {
            const k = LF.clamp(1 - e.t / 0.3, 0, 1);
            e.x = e.sx + Math.cos(e.sa) * e.len * k; e.y = e.sy + Math.sin(e.sa) * e.len * k; e.gape = 1;
            if (!e.bit && hurtIfNear(g, e.x + Math.cos(e.sa) * 10, e.y + Math.sin(e.sa) * 10, e.r + 2, e.dmg * 1.2, 'the Lamp-Eater')) { e.bit = true; e.contactCd = 0.75; }
            if (e.t <= 0) {
              g.map.resolveCircle(e, e.r * 0.7); B.clampToArena(g, e);
              if (--e.count > 0) { e.sub = 0; e.t = 0.25; } else { e.state = 'idle'; e.t = 1.1; }
            }
          }
          break;
        }
      }
    },
    drawFloor(e, ctx, g) {
      const time = g.time || 0;
      for (const pl of e.pools) {
        const k = Math.min(1, pl.t / 1);
        ctx.fillStyle = `rgba(120,50,14,${0.5 * k})`; ctx.beginPath(); ctx.ellipse(pl.x, pl.y, pl.r, pl.r * 0.7, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = `rgba(255,150,60,${0.35 * k})`; ctx.beginPath(); ctx.ellipse(pl.x, pl.y, pl.r * 0.6, pl.r * 0.4, 0, 0, TAU); ctx.fill();
      }
      for (const gl of e.globs) {
        const k = 1 - gl.t / gl.max;
        ctx.strokeStyle = `rgba(255,90,60,${0.3 + 0.5 * k})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(gl.x, gl.y, 40, 0, TAU); ctx.stroke();
        ctx.fillStyle = `rgba(255,90,60,${0.08 + 0.2 * k})`; ctx.beginPath(); ctx.arc(gl.x, gl.y, 40 * k, 0, TAU); ctx.fill();
      }
      if (e.state === 'soot') {
        const k = e.sub === 0 ? 1 - Math.max(0, e.t) / 0.85 : 1;
        ctx.fillStyle = `rgba(255,90,60,${0.1 + 0.18 * k})`; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.arc(e.x, e.y, 250, e.sa - 0.5, e.sa + 0.5); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = `rgba(255,120,90,${0.4 + 0.4 * k})`; ctx.lineWidth = 2; ctx.stroke();
      }
      if (e.state === 'lunge' && e.sub === 1) {
        const k = 1 - Math.max(0, e.t) / (e.tMax || 0.62);
        ctx.strokeStyle = `rgba(255,90,90,${0.22 + 0.4 * k})`; ctx.lineWidth = e.r * 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(e.sa) * e.len, e.y + Math.sin(e.sa) * e.len); ctx.stroke(); ctx.lineCap = 'butt';
      }
      // its next meal is marked
      if ((e.state === 'stalk' && e.prey) || (e.state === 'gulp' && e.tongue)) {
        const pr = e.state === 'gulp' ? e.tongue : e.prey;
        ctx.strokeStyle = `rgba(${LAMP_RGB},${0.4 + 0.3 * Math.sin(time * 10)})`; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.arc(pr.x, pr.y - 6, 22, time * 2, time * 2 + TAU); ctx.stroke(); ctx.setLineDash([]);
      }
      // the lamps it ate wait cold, ringed
      for (const pr of e.eaten) {
        ctx.strokeStyle = 'rgba(160,130,90,0.5)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 5]);
        ctx.beginPath(); ctx.arc(pr.x, pr.y - 6, 16, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      }
      if (e.tel) B.drawTel(e, ctx, g);
    },
    glowFloor(e, ctx, g) {
      for (const pl of e.pools) LF.drawGlow(ctx, '#ff8a3c', pl.x, pl.y, pl.r * 1.6, 0.25 * Math.min(1, pl.t));
      // spat flame arcs over toward where it lands
      for (const gl of e.globs) {
        const k = 1 - gl.t / gl.max, x = LF.lerp(gl.sx, gl.x, k), y = LF.lerp(gl.sy, gl.y, k) - Math.sin(k * Math.PI) * 110;
        ctx.fillStyle = 'rgba(255,230,170,0.95)'; ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fill();
        LF.drawGlow(ctx, LAMP, x, y, 26, 0.6);
      }
      // the tongue, out to the flame
      if (e.state === 'gulp' && e.tongue) {
        lMouth(e, lTmp); const pr = e.tongue;
        ctx.strokeStyle = 'rgba(255,170,110,0.7)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(lTmp.x, lTmp.y); ctx.quadraticCurveTo((lTmp.x + pr.x) / 2 + Math.sin((g.time || 0) * 20) * 6, (lTmp.y + pr.y) / 2 - 14, pr.x, pr.y - 8); ctx.stroke();
      }
    },
    draw(e, ctx, g) {
      const time = (g && g.time) || 0, ph = e.maxHp > 0 ? B.phaseOf(e) : (e.phase || 1), r = e.r || 30, hit = e.flash > 0.6;
      const belly = e.belly || 0, gape = e.gape || 0, sc = r / 30, crawl = Math.sin(time * (e.state === 'stalk' ? 14 : 6));
      const skin = hit ? '#fff' : (e.lit ? '#30251c' : '#110c09'), dark = hit ? '#fff' : (e.lit ? '#1d1611' : '#070504'), pale = hit ? '#fff' : (e.lit ? '#6b5a44' : '#2a2219');
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + r * 0.5, r * 1.4, r * 0.45, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.face || 0); ctx.scale(sc, sc);
      // long spindly limbs, two forward, two dragging
      ctx.strokeStyle = skin; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(8, s * 12); ctx.lineTo(22 + crawl * 3 * s, s * 32); ctx.lineTo(34 + crawl * 4 * s, s * 26); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-14, s * 16); ctx.lineTo(-28 - crawl * 3 * s, s * 34); ctx.lineTo(-44 - crawl * 2 * s, s * 30); ctx.stroke();
      }
      // a lamplighter's hooked pole, still held
      ctx.strokeStyle = pale; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-30, 24); ctx.lineTo(40, 34); ctx.stroke();
      ctx.beginPath(); ctx.arc(40, 28, 6, Math.PI / 2, Math.PI * 1.7, true); ctx.stroke();
      // rags trailing behind
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.moveTo(-26, -10); ctx.lineTo(-52 + crawl * 3, -6); ctx.lineTo(-44, 0); ctx.lineTo(-54 - crawl * 3, 8); ctx.lineTo(-26, 12); ctx.closePath(); ctx.fill();
      // the belly, swollen with what it ate
      const bw = 26 + belly * 2.2, bh = 20 + belly * 2;
      ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(-6, 0, bw, bh, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = pale; ctx.lineWidth = 1.2;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(-6, 0, bw * (0.35 + i * 0.18), bh * 0.98, 0, -1.2, 1.2); ctx.stroke(); }
      // the shapes of swallowed lamps, dark cages under the skin
      ctx.strokeStyle = hit ? '#fff' : (e.lit ? '#120d09' : '#050403'); ctx.lineWidth = 1.5;
      for (let i = 0; i < belly; i++) { const a = i * 2.4 + 0.6, d = 0.45 + (i % 2) * 0.25, x = -6 + Math.cos(a) * bw * d * 0.7, y = Math.sin(a) * bh * d * 0.7; ctx.strokeRect(x - 3.5, y - 5, 7, 10); ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x, y - 8); ctx.stroke(); }
      // the head: one round mouth, ringed with teeth
      const mr = 12 + gape * 4;
      ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(bw - 8, 0, 14 + gape * 3, 15 + gape * 3, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(bw - 2, 0, mr * 0.75, 0, TAU); ctx.fill();
      ctx.fillStyle = pale;
      for (let i = 0; i < 12; i++) { const a = i * TAU / 12 + time * 0.5 * gape; const x = bw - 2 + Math.cos(a) * mr * 0.75, y = Math.sin(a) * mr * 0.75; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(a) * 5 + Math.sin(a) * 1.5, y - Math.sin(a) * 5 - Math.cos(a) * 1.5); ctx.lineTo(x - Math.sin(a) * 1.5, y + Math.cos(a) * 1.5); ctx.closePath(); ctx.fill(); }
      if (ph >= 2) { ctx.strokeStyle = '#060403'; ctx.lineWidth = ph; ctx.beginPath(); ctx.moveTo(-20, -bh * 0.6); ctx.lineTo(-10, -4); ctx.lineTo(-18, bh * 0.5); ctx.stroke(); }
      ctx.restore();
    },
    drawGlow(e, ctx, g) {
      const time = (g && g.time) || 0, r = e.r || 30, sc = r / 30, belly = e.belly || 0;
      const bw = 26 + belly * 2.2, bh = 20 + belly * 2;
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.face || 0); ctx.scale(sc, sc);
      // the swallowed flames show through its skin
      for (let i = 0; i < belly; i++) {
        const a = i * 2.4 + 0.6, d = 0.45 + (i % 2) * 0.25, x = -6 + Math.cos(a) * bw * d * 0.7, y = Math.sin(a) * bh * d * 0.7, fl = 0.7 + 0.3 * Math.sin(time * 9 + i * 2);
        ctx.fillStyle = `rgba(255,200,120,${0.6 * fl})`; ctx.beginPath(); ctx.ellipse(x, y, 2.2, 3.5, 0, 0, TAU); ctx.fill();
      }
      if (e.state === 'gulp' || e.state === 'spit') { ctx.fillStyle = 'rgba(255,170,90,0.35)'; ctx.beginPath(); ctx.arc(bw - 2, 0, 8, 0, TAU); ctx.fill(); }
      ctx.restore();
      if (belly) LF.drawGlow(ctx, LAMP, e.x, e.y, r * (1 + belly * 0.15), 0.06 + belly * 0.025);
      if (e.state === 'choke') { ctx.fillStyle = `rgba(${LAMP_RGB},0.9)`; for (let i = 0; i < 3; i++) { const a = time * 4 + i * TAU / 3; ctx.beginPath(); ctx.arc(e.x + Math.cos(a) * r * 0.8, e.y - r - 6 + Math.sin(a) * 5, 2.2, 0, TAU); ctx.fill(); } }
    },
    light(e, lc, white) { const s = 70 + (e.belly || 0) * 14; lc.globalAlpha = 0.35 + (e.belly || 0) * 0.05; lc.drawImage(white, e.x - s, e.y - s, s * 2, s * 2); },
  };
})();
