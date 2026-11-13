'use strict';
// Alternate great shadows: the Chain Warden, the Candle King and the Hollow Choir.
// Each boss depth rolls between its original and its alternate once the original has been felled.
(function () {
  const fx = LF.fx, TAU = LF.TAU, TILE = LF.TILE, DEFS = LF.ENEMY_DEFS, B = LF.BH;


  // Drawing only: alternating open iron links along a straight chain.
  function drawIronChain(ctx, ax, ay, bx, by, lit, hit) {
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy), n = Math.max(1, Math.ceil(len / 9)), a = Math.atan2(dy, dx);
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(a); ctx.lineWidth = 2;
    ctx.strokeStyle = hit ? '#fff' : (lit ? '#71504b' : '#342027');
    for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.ellipse((i + 0.5) * len / n, 0, 5, i % 2 ? 1.7 : 3.8, 0, 0, TAU); ctx.stroke(); }
    ctx.restore();
  }

  // distance from point to segment
  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
    const t = LF.clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
    return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
  }
  function hurtIfNear(g, x, y, r, dmg, name) {
    const p = g.player;
    if (p.dead || p.dashing > 0 || p.invuln > 0) return false;
    if (LF.dist(p.x, p.y, x, y) < r + p.r - 3) { g.hurtPlayer(dmg, { x, y, name }); return true; }
    return false;
  }

  // =====================================================================================
  // THE CHAIN WARDEN (alternate for depth 3)
  // =====================================================================================
  DEFS.warden = {
    name: 'The Chain Warden', title: 'He kept the great chain. He keeps what is left of it', boss: true,
    hp: 1550, speed: 56, r: 30, dmg: 9.5, embers: 0, glass: 0, phases: [0.66, 0.33],
    eyes: [[10, -5, 2.4], [10, 5, 2.4]], eyeColor: '120,255,220',
    init(e) { B.bossInit(e); e.anchor = null; e.whirl = null; e.spinA = 0; },
    update(e, g, dt) {
      const p = g.player, ph = e.phase;
      e.t -= dt; e.spin += dt;
      B.updateTel(e, g, dt);
      if (B.phaseShift(e, g)) { e.state = 'idle'; e.t = 1.1; e.anchor = null; }
      const toP = Math.atan2(p.y - e.y, p.x - e.x);
      if (e.state !== 'anchor') e.face = LF.turnToward(e.face, toP, 3 * dt);
      const walk = sp => { const d = LF.dist(e.x, e.y, p.x, p.y); if (d > 70) { e.x += Math.cos(toP) * sp * dt; e.y += Math.sin(toP) * sp * dt; g.map.resolveCircle(e, e.r * 0.7); } };

      // whirlpool runs alongside everything else
      if (e.whirl) {
        const w = e.whirl; w.t -= dt;
        g.hazards.push({ x: w.x, y: w.y, r: 60 });
        const d = LF.dist(w.x, w.y, p.x, p.y);
        if (!p.dead && d < 230 && p.dashing <= 0) {
          const pull = 74 * (1 - d / 260);
          p.x += (w.x - p.x) / (d || 1) * pull * dt; p.y += (w.y - p.y) / (d || 1) * pull * dt; g.map.resolveCircle(p, p.r);
        }
        w.tick -= dt;
        if (w.tick <= 0) { w.tick = 0.55; hurtIfNear(g, w.x, w.y, 34, e.dmg * 0.8, 'the whirlpool'); }
        if (Math.random() < dt * 40) { const a = Math.random() * TAU, r = LF.rand(40, 200); fx.spawn({ x: w.x + Math.cos(a) * r, y: w.y + Math.sin(a) * r, vx: -Math.sin(a) * 120 - Math.cos(a) * 60, vy: Math.cos(a) * 120 - Math.sin(a) * 60, life: 0.6, size: 2, color: '#8fe8d8', drag: 0.5 }); }
        if (w.t <= 0) e.whirl = null;
      }

      switch (e.state) {
        case 'intro': if (e.t <= 0) { e.state = 'idle'; e.t = 0.8; } break;
        case 'idle':
          walk(e.speed + ph * 8);
          if (e.t <= 0) {
            const opts = ['anchor', 'spin', 'anchor'];
            if (!e.whirl) opts.push('whirl');
            if (B.minions(g) < 4) opts.push('leeches');
            e.state = B.pickAttack(e, opts);
            if (e.state === 'anchor') { e.count = ph; e.sub = 0; e.t = 0; }
            else if (e.state === 'spin') { e.sub = 0; e.t = 0.7; LF.audio.play('charge'); }
            else if (e.state === 'whirl') { e.t = 0.2; }
            else if (e.state === 'leeches') { e.t = 0.8; LF.audio.play('telegraph'); }
          }
          break;
        case 'anchor':
          if (e.sub === 0 && e.t <= 0) {
            // aim: the chain will fly along this line
            e.sa = Math.atan2(p.y + p.vy * 0.2 - e.y, p.x + p.vx * 0.2 - e.x); e.face = e.sa;
            e.len = Math.min(460, g.map.raycast(e.x, e.y, Math.cos(e.sa), Math.sin(e.sa), 460) - 10);
            e.sub = 1; e.t = 0.6; LF.audio.play('telegraph'); e.red = 1;
            e.anchor = { x: e.x, y: e.y, state: 'aim' };
          } else if (e.sub === 1) {
            e.red = 1;
            if (e.t <= 0) { e.sub = 2; e.t = 0.2; e.anchor.state = 'fly'; LF.audio.play('lunge'); }
          } else if (e.sub === 2) {
            const k = 1 - Math.max(0, e.t) / 0.2;
            e.anchor.x = e.x + Math.cos(e.sa) * e.len * k; e.anchor.y = e.y + Math.sin(e.sa) * e.len * k;
            hurtIfNear(g, e.anchor.x, e.anchor.y, 20, e.dmg * 1.2, 'the Chain Warden');
            if (e.t <= 0) {
              B.blast(g, e.anchor.x, e.anchor.y, 62, e.dmg * 1.2, 'the Chain Warden', '#8fe8d8');
              if (ph >= 2) B.ring(g, e.anchor.x, e.anchor.y, 6 + ph * 2, 130, e.dmg * 0.7, Math.random() * TAU, { color: '#8fe8d8' });
              e.sub = 3; e.t = 0.35; e.anchor.state = 'hold';
            }
          } else if (e.sub === 3) {
            if (e.t <= 0) { e.sub = 4; e.t = 0.3; e.anchor.state = 'back'; }
          } else if (e.sub === 4) {
            const k = Math.max(0, e.t) / 0.3;
            e.anchor.x = e.x + Math.cos(e.sa) * e.len * k; e.anchor.y = e.y + Math.sin(e.sa) * e.len * k;
            hurtIfNear(g, e.anchor.x, e.anchor.y, 18, e.dmg, 'the Chain Warden');
            if (e.t <= 0) {
              e.anchor = null;
              if (--e.count > 0) { e.sub = 0; e.t = 0.25; } else { e.state = 'idle'; e.t = 1.2; }
            }
          }
          break;
        case 'spin': {
          const L = 150 + ph * 8;
          if (e.sub === 0) {
            e.red = 1; g.hazards.push({ x: e.x, y: e.y, r: L + 20 });
            if (e.t <= 0) { e.sub = 1; e.t = 3 + ph * 0.4; e.spinA = toP + Math.PI; e.dropT = 0; e.dir = Math.random() < 0.5 ? 1 : -1; LF.audio.play('lunge'); }
          } else {
            e.red = 1; walk(34 + ph * 6);
            e.spinA += (2.5 + ph * 0.35) * e.dir * dt;
            const hx = e.x + Math.cos(e.spinA) * L, hy = e.y + Math.sin(e.spinA) * L;
            e.anchor = { x: hx, y: hy, state: 'spin' };
            g.hazards.push({ x: e.x, y: e.y, r: L + 20 });
            if (!p.dead && p.dashing <= 0 && p.invuln <= 0 && (LF.dist(p.x, p.y, hx, hy) < 22 + p.r || segDist(p.x, p.y, e.x, e.y, hx, hy) < 8 + p.r)) g.hurtPlayer(e.dmg * 0.9, { x: e.x, y: e.y, name: 'the Chain Warden' });
            e.dropT -= dt;
            if (ph >= 2 && e.dropT <= 0) { e.dropT = 0.22; g.fireEnemyBullet({ x: hx, y: hy, angle: e.spinA, speed: 120, dmg: e.dmg * 0.65, color: '#8fe8d8', life: 2.2 }); }
            if (Math.random() < 0.6) fx.spawn({ x: hx, y: hy, life: 0.3, size: 4, color: '#8fe8d8' });
            if (e.t <= 0) { e.anchor = null; e.state = 'idle'; e.t = 1.4; }
          }
          break;
        }
        case 'whirl':
          if (e.t <= 0) {
            const o = g.map.nearestOpen(p.x, p.y);
            B.telegraph(e, o.x, o.y, 110, 1.0, t => { e.whirl = { x: t.x, y: t.y, t: 5 + ph, tick: 0.3 }; LF.audio.play('descend'); fx.ring(t.x, t.y, 110, 10, 0.6, '#8fe8d8', 4); }, '120,255,220');
            LF.audio.play('telegraph'); e.state = 'idle'; e.t = 1.3;
          }
          break;
        case 'leeches':
          e.red = 1;
          if (e.t <= 0) {
            for (let i = 0; i < 2 + ph; i++) { const pt = B.arenaPoint(g); g.spawnEnemy('leech', pt.x, pt.y, { awake: true, spawnT: 0.7, room: 0, noDrops: i > 1 }); }
            LF.audio.play('spawn'); e.state = 'idle'; e.t = 1.3;
          }
          break;
      }
    },
    draw(e, ctx, g) {
      const time = (g && g.time) || 0, ph = e.maxHp > 0 ? B.phaseOf(e) : (e.phase || 1), r = e.r || 30, hit = e.flash > 0.6;
      if (e.tel) B.drawTel(e, ctx, g);
      if (e.whirl) {
        const w = e.whirl, a = Math.min(1, w.t);
        for (let i = 0; i < 4; i++) {
          ctx.strokeStyle = `rgba(225,65,80,${(0.22 - i * 0.04) * a})`; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(w.x, w.y, 30 + i * 46, time * (3 - i * 0.5) + i, time * (3 - i * 0.5) + i + 4.4); ctx.stroke();
        }
        ctx.fillStyle = `rgba(9,4,12,${0.75 * a})`; ctx.beginPath(); ctx.arc(w.x, w.y, 30, 0, TAU); ctx.fill();
      }
      if (e.state === 'anchor' && e.sub === 1) {
        ctx.strokeStyle = `rgba(255,90,90,${0.3 + 0.4 * (1 - (e.t || 0) / 0.6)})`; ctx.lineWidth = 30; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(e.sa === undefined ? (e.face || 0) : e.sa) * (e.len || 0), e.y + Math.sin(e.sa === undefined ? (e.face || 0) : e.sa) * (e.len || 0)); ctx.stroke();
      }
      if (e.state === 'spin' && e.sub === 0) {
        const L = 150 + (e.phase || ph) * 8;
        ctx.strokeStyle = 'rgba(255,90,90,0.7)'; ctx.lineWidth = 2; ctx.setLineDash([8, 8]); ctx.beginPath(); ctx.arc(e.x, e.y, L + 16, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,90,90,0.08)'; ctx.beginPath(); ctx.arc(e.x, e.y, L + 16, 0, TAU); ctx.fill();
      }
      // Heavy links follow the existing anchor path, including its whirl.
      if (e.anchor && e.anchor.state !== 'aim') {
        const ax = e.anchor.x === undefined ? e.x : e.anchor.x, ay = e.anchor.y === undefined ? e.y : e.anchor.y;
        drawIronChain(ctx, e.x, e.y, ax, ay, e.lit, hit);
        ctx.save(); ctx.translate(ax, ay); ctx.rotate(Math.atan2(ay - e.y, ax - e.x));
        ctx.strokeStyle = hit ? '#fff' : (e.lit ? '#8b615b' : '#51303a'); ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.moveTo(10, 0); ctx.arc(2, 0, 12, -1.1, 1.1); ctx.stroke();
        ctx.strokeStyle = 'rgba(225,65,80,0.65)'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
      }
      if (e.whirl) {
        const w = e.whirl;
        ctx.strokeStyle = e.lit ? '#67414b' : '#301b29'; ctx.lineWidth = 1.7;
        for (let j = 0; j < 4; j++) for (let i = 0; i < 12; i++) { const a = time * (3 - j * 0.5) + j + i * 4.4 / 12, d = 30 + j * 46; ctx.beginPath(); ctx.ellipse(w.x + Math.cos(a) * d, w.y + Math.sin(a) * d, 5, 2.5, a + Math.PI / 2, 0, TAU); ctx.stroke(); }
      }
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + r * 0.6, r * 1.1, r * 0.45, 0, 0, TAU); ctx.fill();
      const wind = e.state === 'anchor' && e.sub === 1 ? Math.max(0, 1 - (e.t || 0) / 0.6) : e.state === 'spin' && e.sub === 0 ? Math.max(0, 1 - (e.t || 0) / 0.7) : 0;
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.face || 0); ctx.scale(r / 30, r / 30);
      // Hunched back plates, separated shoulders and enormous iron fists.
      ctx.fillStyle = hit ? '#fff' : (e.lit ? '#262029' : '#0d0b13'); ctx.strokeStyle = e.lit ? '#584049' : '#241a28'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-31, -12); ctx.lineTo(-22, -26); ctx.lineTo(-6, -29); ctx.lineTo(17 - wind * 5, -19); ctx.lineTo(23 - wind * 5, 18); ctx.lineTo(-8, 29); ctx.lineTo(-27, 21); ctx.closePath(); ctx.fill(); ctx.stroke();
      for (const s of [-1, 1]) {
        const shift = Math.sin(time * (2 + ph * 0.5) + s) * 2 - wind * 6;
        ctx.fillStyle = hit ? '#fff' : (e.lit ? '#3b3035' : '#19131d'); ctx.beginPath(); ctx.ellipse(-5, s * 23, 17, 11, s * 0.3, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = hit ? '#fff' : (e.lit ? '#493638' : '#21171f'); ctx.beginPath(); ctx.moveTo(9 + shift, s * 20); ctx.lineTo(25 + shift, s * 24); ctx.lineTo(27 + shift, s * 34); ctx.lineTo(11 + shift, s * 36); ctx.lineTo(5 + shift, s * 28); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#83504c'; ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(13 + shift + i * 4, s * 25); ctx.lineTo(14 + shift + i * 4, s * 32); ctx.stroke(); }
        ctx.strokeStyle = e.lit ? '#584049' : '#241a28'; ctx.lineWidth = 2;
      }
      // Chain coils slide over overlapping, riveted plates.
      for (let i = 0; i < 3; i++) {
        const x = -18 + i * 9;
        ctx.fillStyle = hit ? '#fff' : (e.lit ? '#332b33' : '#16111b'); ctx.beginPath(); ctx.ellipse(x, 0, 10, 22 - i * 2, -0.12, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#775048'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(x, s * (16 - i), 1.2, 0, TAU); ctx.fill(); }
      }
      for (let j = 0; j < 2; j++) for (let i = 0; i < 9; i++) { const a = i * TAU / 9 + Math.sin(time * 2 + j) * 0.07; ctx.strokeStyle = hit ? '#fff' : (e.lit ? '#81605a' : '#38232b'); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(-9 + j * 9 + Math.cos(a) * 12, Math.sin(a) * (21 - j * 3), 5, i % 2 ? 2 : 3.5, a + Math.PI / 2, 0, TAU); ctx.stroke(); }
      // A shackle surrounds a slotted, eyeless iron visor.
      ctx.fillStyle = hit ? '#fff' : (e.lit ? '#3b3035' : '#17111b'); ctx.beginPath(); ctx.ellipse(10, 0, 15, 17, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = hit ? '#fff' : '#80534e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(6, 0, 17, -1.5, 1.5); ctx.stroke();
      ctx.fillStyle = '#07060b'; ctx.fillRect(8, -10, 9, 20);
      ctx.strokeStyle = '#4f343c'; ctx.lineWidth = 2; for (let i = -6; i <= 6; i += 6) { ctx.beginPath(); ctx.moveTo(7, i); ctx.lineTo(20, i); ctx.stroke(); }
      if (ph >= 2) { ctx.strokeStyle = '#0a060b'; ctx.lineWidth = ph + 1; ctx.beginPath(); ctx.moveTo(-20, -19); ctx.lineTo(-10, -9); ctx.lineTo(-14, 6); ctx.lineTo(-4, 16); ctx.stroke(); }
      if (ph >= 3) { ctx.fillStyle = '#07050b'; ctx.beginPath(); ctx.moveTo(-25, 21); ctx.lineTo(-16, 11); ctx.lineTo(-8, 27); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    },
    drawGlow(e, ctx, g) {
      const time = (g && g.time) || 0, ph = e.maxHp > 0 ? B.phaseOf(e) : (e.phase || 1), r = e.r || 30;
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.face || 0); ctx.scale(r / 30, r / 30);
      ctx.strokeStyle = 'rgba(240,66,71,0.6)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(18, -9); ctx.lineTo(18, 9); ctx.moveTo(24, -5); ctx.lineTo(25, 5); ctx.stroke();
      if (ph >= 2) { ctx.strokeStyle = 'rgba(222,48,68,' + (0.35 + Math.sin(time * 5) * 0.1) + ')'; ctx.lineWidth = ph === 3 ? 2 : 1; ctx.beginPath(); ctx.moveTo(-20, -19); ctx.lineTo(-10, -9); ctx.lineTo(-14, 6); ctx.lineTo(-4, 16); ctx.stroke(); }
      ctx.restore();
      LF.drawGlow(ctx, '#d93d50', e.x, e.y, r, 0.08);
      if (e.whirl) LF.drawGlow(ctx, '#d93d50', e.whirl.x, e.whirl.y, 120, 0.1);
      if (e.anchor && e.anchor.state !== 'aim') LF.drawGlow(ctx, '#ea5966', e.anchor.x === undefined ? e.x : e.anchor.x, e.anchor.y === undefined ? e.y : e.anchor.y, 16, 0.3);
    },
    light(e, lc, white) { lc.globalAlpha = 0.5; lc.drawImage(white, e.x - 90, e.y - 90, 180, 180); if (e.whirl) { lc.globalAlpha = 0.4; lc.drawImage(white, e.whirl.x - 120, e.whirl.y - 120, 240, 240); } },
  };

  // =====================================================================================
  // THE CANDLE KING (alternate for depth 6) and his candles
  // =====================================================================================
  DEFS.candle = {
    name: 'Votive', hp: 30, speed: 0, r: 9, dmg: 8, embers: 0.5, glass: 0.3, contact: false, selfLit: true,
    eyes: null,
    init(e) { e.cd = LF.rand(1, 2.6); },
    update(e, g, dt) {
      const p = g.player;
      e.cd -= dt;
      if (e.cd <= 0 && g.map.los(e.x, e.y, p.x, p.y)) {
        e.cd = 2.5;
        g.fireEnemyBullet({ x: e.x, y: e.y - 8, angle: Math.atan2(p.y - e.y, p.x - e.x), speed: 150, dmg: e.dmg, color: '#ffb347', size: 5 });
        LF.audio.play('spit');
      }
    },
    draw(e, ctx) {
      const r = e.r || 9, hit = e.flash > 0.6;
      ctx.save(); ctx.translate(e.x, e.y); ctx.scale(r / 9, r / 9);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0, 8, 10, 4, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = hit ? '#fff' : (e.lit ? '#aa9679' : '#625346'); ctx.beginPath(); ctx.ellipse(0, 7, 11, 5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = hit ? '#fff' : (e.lit ? '#e0cfaa' : '#9d8b70'); LF.roundRect(ctx, -6, -6, 12, 15, 3); ctx.fill();
      ctx.fillStyle = hit ? '#fff' : (e.lit ? '#f0e4c7' : '#bdac8a'); ctx.beginPath(); ctx.ellipse(0, -6, 6, 3, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#5f493b'; ctx.beginPath(); ctx.ellipse(0, -6, 3.5, 1.5, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = hit ? '#fff' : '#e5d7b7'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-4, -5); ctx.lineTo(-4, 4); ctx.moveTo(2, -4); ctx.lineTo(2, 0); ctx.moveTo(5, -3); ctx.lineTo(5, 7); ctx.stroke();
      ctx.strokeStyle = '#292024'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(1, -11); ctx.stroke(); ctx.restore();
    },
    drawGlow(e, ctx, g) {
      const time = (g && g.time) || 0, f = 1 + Math.sin(time * 12 + (e.wob || 0)) * 0.15, r = (e.r || 9) / 9;
      ctx.save(); ctx.translate(e.x, e.y); ctx.scale(r, r);
      ctx.fillStyle = 'rgba(255,147,63,0.8)'; ctx.beginPath(); ctx.moveTo(-3, -10); ctx.quadraticCurveTo(-4, -14, Math.sin(time * 4) * 2, -18 * f); ctx.quadraticCurveTo(5, -12, 3, -10); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,239,196,0.85)'; ctx.beginPath(); ctx.ellipse(0, -11, 1.4, 3, 0, 0, TAU); ctx.fill(); ctx.restore();
      LF.drawGlow(ctx, '#ffb347', e.x, e.y - 10 * r, 26 * r, 0.32);
    },
    light(e, lc, white) { lc.globalAlpha = 0.75; lc.drawImage(white, e.x - 70, e.y - 70, 140, 140); },
  };

  DEFS.king = {
    name: 'The Candle King', title: 'Crowned in wax, and still melting', boss: true, selfLit: true,
    hp: 2150, speed: 26, r: 32, dmg: 9.5, embers: 0, glass: 0, phases: [0.66, 0.33],
    eyes: [[10, -6, 2.4], [10, 6, 2.4]], eyeColor: '255,200,110',
    init(e) { B.bossInit(e); e.candles = []; e.candleT = 2.5; e.breathA = 0; },
    // warded while any of his candles still burns
    modDamage(e, dmg, src) {
      if (src.noShroud) return dmg;
      if (e.candles.length) { src.blocked = true; if (Math.random() < 0.2) fx.text(e.x, e.y - e.r - 18, 'WARDED', '#ffcf8a', 9, 0.5); return dmg * 0.4; }
      return dmg;
    },
    update(e, g, dt) {
      const p = g.player, ph = e.phase;
      e.t -= dt; e.spin += dt; e.candleT -= dt;
      B.updateTel(e, g, dt);
      e.candles = e.candles.filter(c => !c.dead);
      if (B.phaseShift(e, g)) { e.state = 'idle'; e.t = 1.1; e.candleT = Math.min(e.candleT, 1.5); }
      const toP = Math.atan2(p.y - e.y, p.x - e.x);
      if (e.state !== 'breath' || e.sub === 0) e.face = LF.turnToward(e.face, toP, 3 * dt);
      const lob = (x, y, fuse) => {
        const o = g.map.nearestOpen(x, y);
        B.telegraph(e, o.x, o.y, 46, fuse, t => {
          B.blast(g, t.x, t.y, 48, e.dmg * 1.1, 'burning wax', '#ffb347');
          if (!e.dead) g.addZone({ kind: 'wax', x: t.x, y: t.y, r: 42, life: 6.5, dmg: e.dmg * 0.45 });
        }, '255,170,90');
      };
      switch (e.state) {
        case 'intro': if (e.t <= 0) { e.state = 'idle'; e.t = 0.7; } break;
        case 'idle': {
          const d = LF.dist(e.x, e.y, p.x, p.y);
          if (d > 200) { e.x += Math.cos(toP) * e.speed * dt; e.y += Math.sin(toP) * e.speed * dt; g.map.resolveCircle(e, e.r * 0.7); }
          if (e.t <= 0) {
            if (!e.candles.length && e.candleT <= 0) { e.state = 'crown'; e.t = 0.9; LF.audio.play('charge'); break; }
            const opts = ['wax', 'breath', 'wax'];
            if (ph >= 2) opts.push('burst');
            if (ph >= 3) opts.push('rain');
            e.state = B.pickAttack(e, opts);
            if (e.state === 'wax') { e.count = 3 + ph * 2; e.t = 0.1; }
            else if (e.state === 'breath') { e.sub = 0; e.t = 0.75; e.breathA = toP; LF.audio.play('telegraph'); }
            else if (e.state === 'burst') { e.count = 3; e.t = 0.5; e.sub = 0; LF.audio.play('charge'); }
            else if (e.state === 'rain') { e.t = 4; e.sub = 0; LF.audio.play('roar'); }
          }
          break;
        }
        case 'crown':
          e.red = 1;
          if (e.t <= 0) {
            const n = 2 + ph;
            for (let i = 0; i < n; i++) { const pt = B.arenaPoint(g, 4); e.candles.push(g.spawnEnemy('candle', pt.x, pt.y, { awake: true, spawnT: 0.6, room: 0, noDrops: true })); }
            e.candleT = 16 - ph * 2;
            LF.audio.play('brazier'); fx.ring(e.x, e.y, e.r, 200, 0.6, '#ffcf8a', 4);
            g.banner = { text: 'His candles ward him', sub: 'Snuff them', t: 0, dur: 1.8, small: true, boss: true };
            e.state = 'idle'; e.t = 1.0;
          }
          break;
        case 'wax':
          if (e.t <= 0) {
            const a = Math.random() * TAU, d = Math.random() < 0.35 ? 0 : LF.rand(50, 160);
            lob(p.x + Math.cos(a) * d + p.vx * 0.35, p.y + Math.sin(a) * d + p.vy * 0.35, 0.9);
            LF.audio.play('spit');
            if (--e.count > 0) e.t = 0.26; else { e.state = 'idle'; e.t = 1.5; }
          }
          break;
        case 'breath':
          e.red = 1;
          if (e.sub === 0) {
            e.breathA = LF.turnToward(e.breathA, toP, 4 * dt); e.face = e.breathA;
            if (e.t <= 0) { e.sub = 1; e.t = 1.7 + ph * 0.2; e.dropT = 0; LF.audio.play('beam'); }
          } else {
            e.breathA = LF.turnToward(e.breathA, toP, (0.95 + ph * 0.12) * dt); e.face = e.breathA;
            e.dropT -= dt;
            if (e.dropT <= 0) {
              e.dropT = 0.055;
              for (let k = 0; k < 2; k++) g.fireEnemyBullet({ x: e.x + Math.cos(e.breathA) * e.r, y: e.y + Math.sin(e.breathA) * e.r, angle: e.breathA + LF.rand(-0.3, 0.3), speed: LF.rand(280, 350), dmg: e.dmg * 0.7, color: '#ff8a3d', life: 0.95, size: 5 });
            }
            if (e.t <= 0) { e.state = 'idle'; e.t = 1.6; }
          }
          break;
        case 'burst':
          e.red = 1;
          if (e.t <= 0) {
            e.sub++;
            B.ring(g, e.x, e.y, 16 + ph * 2, 140 + e.sub * 14, e.dmg * 0.7, e.sub * 0.2, { color: '#ffb347' });
            LF.audio.play('spit'); fx.ring(e.x, e.y, e.r, e.r * 3, 0.4, '#ffb347', 3);
            if (--e.count > 0) e.t = 0.5; else { e.state = 'idle'; e.t = 1.4; }
          }
          break;
        case 'rain':
          e.red = 1; e.sub -= dt;
          if (e.sub <= 0) { e.sub = 0.2; const pt = Math.random() < 0.4 ? { x: p.x + LF.rand(-60, 60), y: p.y + LF.rand(-60, 60) } : B.arenaPoint(g, 2); lob(pt.x, pt.y, 1.0); }
          if (e.t <= 0) { e.state = 'idle'; e.t = 1.8; }
          break;
      }
    },
    draw(e, ctx, g) {
      if (e.tel) B.drawTel(e, ctx, g);
      if (e.state === 'breath' && e.sub === 0) {
        ctx.fillStyle = `rgba(255,90,60,${0.14 + 0.2 * (1 - (e.t || 0) / 0.75)})`;
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.arc(e.x, e.y, 330, (e.breathA === undefined ? (e.face || 0) : e.breathA) - 0.34, (e.breathA === undefined ? (e.face || 0) : e.breathA) + 0.34); ctx.closePath(); ctx.fill();
      }
      const time = (g && g.time) || 0, ph = e.maxHp > 0 ? B.phaseOf(e) : (e.phase || 1), r = e.r || 32, hit = e.flash > 0.6;
      const wind = e.state === 'breath' && e.sub === 0 ? Math.max(0, 1 - (e.t || 0) / 0.75) : e.state === 'crown' ? Math.max(0, 1 - (e.t || 0) / 0.9) : 0;
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + r * 0.7, r * 1.2, r * 0.45, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.face || 0); ctx.scale(r / 32, r / 32);
      // Pooled tallow spreads beneath a slumped, layered body.
      ctx.fillStyle = hit ? '#fff' : (e.lit ? '#93816c' : '#51433c'); ctx.beginPath();
      for (let i = 0; i <= 24; i++) { const a = i * TAU / 24, d = 38 + Math.sin(a * 5 + time * 0.8) * 3; if (i) ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d * 0.92); else ctx.moveTo(Math.cos(a) * d, Math.sin(a) * d * 0.92); } ctx.closePath(); ctx.fill();
      ctx.strokeStyle = hit ? '#fff' : (e.lit ? '#b9a489' : '#77634d'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(-2, 0, 33, 28, 0, 0, TAU); ctx.stroke();
      ctx.save(); ctx.scale(1 + wind * 0.08 + Math.sin(time * (1.3 + ph * 0.3)) * 0.025, 1);
      ctx.fillStyle = hit ? '#fff' : (e.lit ? '#d4c4a5' : '#9a876e'); ctx.beginPath(); ctx.moveTo(31, -4); ctx.bezierCurveTo(37, 22, 8, 35, -18, 30); ctx.bezierCurveTo(-42, 29, -36, -25, -13, -30); ctx.bezierCurveTo(12, -36, 28, -20, 31, -4); ctx.fill();
      ctx.fillStyle = hit ? '#fff' : (e.lit ? '#ad9678' : '#6e5b4c'); ctx.beginPath(); ctx.ellipse(-6, 3, 22, 25, -0.2, 0, TAU); ctx.fill();
      ctx.fillStyle = hit ? '#fff' : (e.lit ? '#e3d5b9' : '#aa9779'); ctx.beginPath(); ctx.ellipse(0, -6, 23, 21, 0, 0, TAU); ctx.fill();
      // Runnels and hanging drips, with black fire showing through damage.
      ctx.lineCap = 'round';
      for (let i = 0; i < 8; i++) { const a = i * TAU / 8, x = Math.cos(a) * 24, y = Math.sin(a) * 24, d = 4 + (Math.sin(time * 1.5 + i * 2) * 0.5 + 0.5) * 6; ctx.strokeStyle = hit ? '#fff' : (e.lit ? '#f0e2c4' : '#b9a384'); ctx.lineWidth = 3 + i % 3; ctx.beginPath(); ctx.moveTo(x * 0.75, y * 0.75); ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); ctx.stroke(); }
      if (ph >= 2) { ctx.strokeStyle = '#30191c'; ctx.lineWidth = ph === 3 ? 6 : 3; ctx.beginPath(); ctx.moveTo(-25, 15); ctx.lineTo(-14, 10); ctx.lineTo(-18, -1); ctx.lineTo(-8, -14); ctx.stroke(); }
      if (ph >= 3) { ctx.fillStyle = '#160d13'; ctx.beginPath(); ctx.moveTo(3, 29); ctx.lineTo(4, 15); ctx.lineTo(15, 20); ctx.lineTo(21, 25); ctx.closePath(); ctx.fill(); }
      // The face is a hollow melted socket pointing toward the breath.
      ctx.fillStyle = '#1b1014'; ctx.beginPath(); ctx.ellipse(17, 0, 10, 14 + wind * 3, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#050408'; ctx.beginPath(); ctx.ellipse(21, 0, e.state === 'breath' ? 6 + wind * 2 : 4, e.state === 'breath' ? 9 : 5, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#7a4d3b'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(11, -8); ctx.lineTo(18, -6); ctx.moveTo(11, 8); ctx.lineTo(18, 6); ctx.stroke(); ctx.restore();
      // A fixed crown of five tall, uneven candle stubs.
      for (let i = 0; i < 5; i++) { const a = i * TAU / 5, x = -7 + Math.cos(a) * 17, y = Math.sin(a) * 17, h = ph === 3 && i === 2 ? 5 : 10 + i % 3 * 2;
        ctx.fillStyle = hit ? '#fff' : '#8c7153'; ctx.beginPath(); ctx.ellipse(x, y + 2, 5, 3.5, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = hit ? '#fff' : (e.lit ? '#ede1c3' : '#bdab8b'); LF.roundRect(ctx, x - 3, y - h, 6, h + 1, 2); ctx.fill();
        ctx.fillStyle = '#574030'; ctx.beginPath(); ctx.ellipse(x, y - h, 2.5, 1, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#201316'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x, y - h - 3); ctx.stroke();
      }
      ctx.restore();
      if (e.candles && e.candles.length) { ctx.strokeStyle = 'rgba(255,207,138,0.6)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.arc(e.x, e.y, r + 12, time, time + TAU); ctx.stroke(); ctx.setLineDash([]); }
    },
    drawGlow(e, ctx, g) {
      const time = (g && g.time) || 0, ph = e.maxHp > 0 ? B.phaseOf(e) : (e.phase || 1), r = (e.r || 32) / 32;
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.face || 0); ctx.scale(r, r);
      for (let i = 0; i < 5; i++) {
        const a = i * TAU / 5, x = -7 + Math.cos(a) * 17, h = ph === 3 && i === 2 ? 5 : 10 + i % 3 * 2, y = Math.sin(a) * 17 - h - 3, f = 1 + Math.sin(time * 11 + i * 2) * 0.2;
        ctx.fillStyle = 'rgba(255,161,67,0.75)'; ctx.beginPath(); ctx.ellipse(x, y - 2, 2.3 * f, 4.5 * f, Math.sin(time * 3 + i) * 0.16, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,241,203,0.8)'; ctx.beginPath(); ctx.ellipse(x, y - 1, 1, 2.5, 0, 0, TAU); ctx.fill();
        LF.drawGlow(ctx, '#ffb347', x, y, 12, 0.25);
      }
      if (ph >= 2) { ctx.strokeStyle = 'rgba(239,64,55,0.55)'; ctx.lineWidth = ph === 3 ? 2 : 1; ctx.beginPath(); ctx.moveTo(-25, 15); ctx.lineTo(-14, 10); ctx.lineTo(-18, -1); ctx.lineTo(-8, -14); ctx.stroke(); }
      ctx.restore();
      for (const c of (e.candles || [])) { if (!c || c.dead || c.spawnT > 0) continue; ctx.strokeStyle = 'rgba(255,207,138,0.16)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(c.x, c.y - 8); ctx.stroke(); }
      LF.drawGlow(ctx, '#ffb347', e.x, e.y, (e.r || 32) * 2.6, 0.12);
    },
    light(e, lc, white) { lc.globalAlpha = 0.85; lc.drawImage(white, e.x - 170, e.y - 170, 340, 340); },
  };

  // =====================================================================================
  // THE HOLLOW CHOIR (alternate for depth 9): three masks, one song
  // =====================================================================================
  const VOICES = [
    { kind: 'dirge', color: '#c9a0ff', rgb: '201,160,255' },
    { kind: 'lament', color: '#ff7b7b', rgb: '255,123,123' },
    { kind: 'hymn', color: '#9dffcf', rgb: '157,255,207' },
  ];
  DEFS.choirhead = {
    name: 'Hollow Mask', hp: 1150, speed: 0, r: 24, dmg: 13, embers: 0, glass: 0, contact: true, ghost: true, flies: true, noBar: true,
    eyes: null,
    init(e) { e.sing = 0; e.warn = 0; e.voice = VOICES[0]; e.acts = []; },
    modDamage(e, dmg, src) {
      if (src.noShroud) return dmg * 0.8;
      if (e.sing <= 0) { src.blocked = true; if (Math.random() < 0.18) fx.text(e.x, e.y - e.r - 14, 'SILENT', '#8d86a8', 9, 0.5); return dmg * 0.3; }
      return dmg * 1.15;
    },
    update(e, g, dt) {
      e.sing -= dt; e.warn -= dt;
      for (const a of e.acts) { a.t -= dt; if (a.t <= 0) { a.dead = true; if (!e.dead) a.fn(); } }
      LF.compact(e.acts);
    },
    draw(e, ctx, g) {
      const time = (g && g.time) || 0, r = e.r || 24, ph = e.maxHp > 0 ? B.phaseOf(e) : (e.phase || 1), voice = e.voice || VOICES[0], hit = e.flash > 0.6;
      const idx = voice.kind === 'lament' ? 1 : voice.kind === 'hymn' ? 2 : 0, open = e.sing > 0 ? 1 + Math.sin(time * (8 + ph)) * 0.12 : e.warn > 0 ? 0.5 : 0, bob = Math.sin(time * 2 + (e.wob || 0)) * 3;
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + r + 10, r * 0.8, r * 0.3, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(e.x, e.y + bob); ctx.rotate((e.face || 0) - Math.PI / 2); ctx.scale(r / 24, r / 24);
      // Three different cowls frame the faces, with trailing folded collars.
      ctx.fillStyle = hit ? '#fff' : (e.lit ? '#241c2d' : '#0c0913'); ctx.strokeStyle = e.lit ? '#4b3045' : '#251726'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(0, -30 - idx * 2); ctx.bezierCurveTo(32 + idx * 2, -22, 33, 13, 21, 26); ctx.lineTo(25, 34); ctx.lineTo(9, 29); ctx.lineTo(0, 36); ctx.lineTo(-8, 29); ctx.lineTo(-22, 34); ctx.lineTo(-19, 24); ctx.bezierCurveTo(-35, 9, -31, -23, 0, -30 - idx * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = e.lit ? '#58394c' : '#2a1b2e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-25, -9); ctx.quadraticCurveTo(-28, 18, -12, 26); ctx.moveTo(25, -8); ctx.quadraticCurveTo(28, 18, 12, 26); ctx.stroke();
      // Carved masks retain each voice's small identifying accent.
      ctx.fillStyle = hit ? '#fff' : (e.lit ? (e.sing > 0 ? '#b3a0a6' : '#80717e') : '#3a2d3c');
      ctx.beginPath(); ctx.moveTo(0, -23); ctx.bezierCurveTo(24, -24, 22 - idx * 2, 12, 0, 28); ctx.bezierCurveTo(-23 + idx, 12, -24, -24, 0, -23); ctx.fill();
      ctx.strokeStyle = e.lit ? '#b29a9f' : '#594150'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = hit ? '#fff' : (e.lit ? '#63505f' : '#261e2e'); ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(2, 1); ctx.lineTo(8, 7); ctx.lineTo(0, 9); ctx.lineTo(-4, 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#07050c';
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 9, -6, idx === 1 ? 3 : 5, idx === 2 ? 4 : 2.6, s * -0.2, 0, TAU); ctx.fill(); }
      ctx.beginPath(); ctx.ellipse(0, 12, 4.8 + open * 1.5, 1.4 + 7.2 * open, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(' + voice.rgb + ',0.45)'; ctx.lineWidth = 1;
      if (idx === 0) { for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 5, -20); ctx.lineTo(i * 5, -12 - Math.abs(i) * 2); ctx.stroke(); } }
      if (idx === 1) { for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 9, -2); ctx.lineTo(s * 11, 9); ctx.lineTo(s * 7, 15); ctx.stroke(); } }
      if (idx === 2) { ctx.beginPath(); ctx.arc(0, -13, 7, Math.PI, TAU); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-15, 9); ctx.quadraticCurveTo(-8, 28, 0, 29); ctx.quadraticCurveTo(8, 28, 15, 9); ctx.stroke(); }
      if (ph >= 2) { ctx.strokeStyle = '#20111c'; ctx.lineWidth = ph === 3 ? 3 : 1.5; ctx.beginPath(); ctx.moveTo(-3, -23); ctx.lineTo(3, -13); ctx.lineTo(0, -3); ctx.lineTo(8, 5); ctx.stroke(); }
      if (ph >= 3) { ctx.fillStyle = '#100911'; ctx.beginPath(); ctx.moveTo(-16, 10); ctx.lineTo(-5, 18); ctx.lineTo(-7, 25); ctx.closePath(); ctx.fill(); }
      ctx.restore();
      const w = 44, k = e.maxHp > 0 ? Math.max(0, e.hp / e.maxHp) : 1;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(e.x - w / 2 - 1, e.y - r - 20, w + 2, 5);
      ctx.fillStyle = voice.color; ctx.fillRect(e.x - w / 2, e.y - r - 19, w * k, 3);
    },
    drawGlow(e, ctx, g) {
      const time = (g && g.time) || 0, r = e.r || 24, ph = e.maxHp > 0 ? B.phaseOf(e) : (e.phase || 1), voice = e.voice || VOICES[0], bob = Math.sin(time * 2 + (e.wob || 0)) * 3;
      const angle = (e.face || 0) - Math.PI / 2, a = e.sing > 0 ? 0.6 : e.warn > 0 ? 0.25 : 0.12;
      ctx.save(); ctx.translate(e.x, e.y + bob); ctx.rotate(angle); ctx.scale(r / 24, r / 24);
      for (const s of [-1, 1]) { ctx.fillStyle = 'rgba(' + voice.rgb + ',0.4)'; ctx.beginPath(); ctx.ellipse(s * 9, -6, 2.4, 0.8, s * -0.2, 0, TAU); ctx.fill(); }
      if (e.sing > 0 || e.warn > 0) {
        ctx.strokeStyle = 'rgba(' + voice.rgb + ',' + a + ')'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(0, 12, 6, e.sing > 0 ? 8 + Math.sin(time * (8 + ph)) : 5, 0, 0, TAU); ctx.stroke();
        LF.drawGlow(ctx, voice.color, 0, 12, e.sing > 0 ? 28 : 18, a * 0.45);
        if (e.sing > 0) for (let i = 0; i < 2; i++) { ctx.strokeStyle = 'rgba(' + voice.rgb + ',' + (0.35 - i * 0.12) + ')'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 12, 14.4 + ((time * 60 + i * 22) % 44), 0, TAU); ctx.stroke(); }
      }
      if (ph >= 2) { ctx.strokeStyle = 'rgba(232,60,84,0.5)'; ctx.lineWidth = ph === 3 ? 1.5 : 0.7; ctx.beginPath(); ctx.moveTo(-3, -23); ctx.lineTo(3, -13); ctx.lineTo(0, -3); ctx.lineTo(8, 5); ctx.stroke(); }
      ctx.restore();
    },
    light(e, lc, white) { lc.globalAlpha = e.sing > 0 ? 0.7 : 0.4; lc.drawImage(white, e.x - 80, e.y - 80, 160, 160); },
  };

  DEFS.choir = {
    name: 'The Hollow Choir', title: 'They sang the lighting hours. No one is singing now', boss: true,
    hp: 4200, speed: 0, r: 1, dmg: 14, embers: 0, glass: 0, phases: [0.66, 0.33], contact: false, ghost: true,
    eyes: null,
    modDamage() { return 0; }, // the conductor itself cannot be struck; only the masks can
    init(e, g) {
      B.bossInit(e); e.intangible = true; e.heads = null; e.verse = 0; e.vt = 2.2; e.orbit = 0; e.cx = e.x; e.cy = e.y;
    },
    update(e, g, dt) {
      const p = g.player;
      e.intangible = true;
      if (!e.heads) {
        e.heads = VOICES.map((v, i) => {
          const h = g.spawnEnemy('choirhead', e.x, e.y, { awake: true, spawnT: 0.6, room: 0, noDrops: true });
          h.voice = v; h.name = 'the Hollow Choir'; h.idx = i; h.maxHp = e.maxHp / 3; h.hp = h.maxHp;
          return h;
        });
      }
      const alive = e.heads.filter(h => !h.dead);
      e.hp = Math.max(1, alive.reduce((s, h) => s + Math.max(0, h.hp), 0));
      if (!alive.length) { e.hp = 0; g.killEnemy(e, { type: 'boss' }); return; }
      const lost = 3 - alive.length;
      if (lost !== e.lost) {
        if (e.lost !== undefined) {
          LF.audio.play('roar'); g.shake(10);
          for (const b of g.ebullets) b.dead = true;
          g.banner = { text: lost === 2 ? 'One voice remains' : 'The song falters', sub: lost === 2 ? 'It sings for all three' : 'The others sing louder', t: 0, dur: 2, small: true, boss: true };
        }
        e.lost = lost;
      }
      e.phase = lost + 1;
      // orbit the arena centre
      const c = B.arena(g), cx = c.cx * TILE, cy = (c.cy - 0.5) * TILE;
      e.orbit += dt * (0.45 + lost * 0.3);
      const R = 118 + Math.sin(e.spin * 0.7) * 22; e.spin += dt;
      e.x = cx; e.y = cy;
      e.heads.forEach((h, i) => {
        if (h.dead) return;
        const a = e.orbit + i * TAU / 3;
        const tx = cx + Math.cos(a) * R * 1.25, ty = cy + Math.sin(a) * R * 0.8;
        h.x += (tx - h.x) * Math.min(1, dt * 4); h.y += (ty - h.y) * Math.min(1, dt * 4);
      });
      // verses: each living mask sings in turn; only a singing mask can really be hurt
      e.vt -= dt;
      if (e.vt <= 0) {
        e.verse++;
        const h = alive[e.verse % alive.length];
        const v = 1 + lost; // intensity
        h.warn = 0.55;
        LF.audio.play('telegraph');
        h.acts.push({ t: 0.55, fn: () => {
          h.sing = 2.0 + lost * 0.4;
          LF.audio.play(h.voice.kind === 'dirge' ? 'bell' : h.voice.kind === 'lament' ? 'howl' : 'whisper');
          if (h.voice.kind === 'dirge') {
            for (let k = 0; k < 1 + v; k++) h.acts.push({ t: k * 0.45, fn: () => { B.ring(g, h.x, h.y, 14 + v * 2, 128 + v * 8, e.dmg * 0.7, k * 0.22 + Math.random() * 0.3, { gapEvery: 5, gapSize: 1, color: h.voice.color }); fx.ring(h.x, h.y, h.r, h.r * 3, 0.35, h.voice.color, 3); } });
          } else if (h.voice.kind === 'lament') {
            for (let k = 0; k < 3 + v * 2; k++) h.acts.push({ t: k * 0.2, fn: () => { const a = Math.atan2(p.y + p.vy * 0.2 - h.y, p.x + p.vx * 0.2 - h.x); g.fireEnemyBullet({ x: h.x, y: h.y, angle: a + LF.rand(-0.05, 0.05), speed: 300, dmg: e.dmg * 0.8, color: h.voice.color, size: 5, ghost: true, life: 2.2 }); LF.audio.play('spit'); } });
          } else {
            let n = 0; for (const o of g.enemies) if (!o.dead && !o.boss && o.type !== 'choirhead') n++;
            if (n < 6) for (let k = 0; k < v; k++) { const pt = B.arenaPoint(g); g.spawnEnemy(k % 2 ? 'wraith' : 'moth', pt.x, pt.y, { awake: true, spawnT: 0.6, room: 0, noDrops: true }); }
            for (let k = 0; k < 1 + v; k++) g.fireEnemyBullet({ x: h.x, y: h.y, angle: Math.random() * TAU, speed: 105, dmg: e.dmg * 0.7, size: 6, color: h.voice.color, homing: 1.4, orb: true, life: 6 });
          }
        } });
        e.vt = Math.max(1.25, 2.7 - lost * 0.6);
      }
    },
    draw() {},
    drawGlow(e, ctx, g) {
      if (!e.heads) return;
      const time = (g && g.time) || 0, alive = e.heads.filter(h => h && !h.dead);
      ctx.save(); ctx.lineWidth = 1.2;
      for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i], b = alive[j], sing = a.sing > 0 || b.sing > 0;
        ctx.strokeStyle = 'rgba(188,82,113,' + (0.12 + 0.06 * Math.sin(time * 3 + i)) + ')';
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.strokeStyle = 'rgba(184,118,166,' + (sing ? 0.1 : 0.04) + ')'; ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + Math.sin(time * 2 + i + j) * 10, b.x, b.y); ctx.stroke();
      }
      ctx.restore();
    },
  };
})();
