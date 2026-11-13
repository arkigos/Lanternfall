'use strict';
// Third great shadows: the False Light (depth 3, with the lures it hides beneath), the Sexton (depth 6)
// and the First Bearer (depth 9, with its echoes).
// Each can appear once the alternate before it has been felled.
(function () {
  const fx = LF.fx, TAU = LF.TAU, DEFS = LF.ENEMY_DEFS, B = LF.BH;
  const GLOW = '#e4ff9a', GLOW_RGB = '228,255,154';

  function hurtIfNear(g, x, y, r, dmg, name) {
    const p = g.player;
    if (p.dead || p.dashing > 0 || p.invuln > 0) return false;
    if (LF.dist(p.x, p.y, x, y) < r + p.r - 3) { g.hurtPlayer(dmg, { x, y, name }); return true; }
    return false;
  }

  // =====================================================================================
  // LURE: a bobbing light. One of them has the False Light beneath it.
  // The glow shows through the dark; the shadow under the real one only shows where your lantern reaches.
  // =====================================================================================
  DEFS.lure = {
    name: 'Lure', hp: 30, speed: 0, r: 10, dmg: 7, embers: 0, glass: 0, contact: false, selfLit: true,
    eyes: null,
    init(e) { e.cd = LF.rand(1.3, 2.4); e.real = false; e.rate = 2.8; e.ang = Math.random() * TAU; },
    update(e, g, dt) {
      const p = g.player;
      e.cd -= dt;
      if (e.cd <= 0) {
        e.cd = e.rate;
        if (!p.dead && g.map.los(e.x, e.y, p.x, p.y)) {
          g.fireEnemyBullet({ x: e.x, y: e.y - 12, angle: Math.atan2(p.y - e.y, p.x - e.x), speed: 135, dmg: e.dmg, color: GLOW, size: 5 });
          LF.audio.play('spit');
        }
      }
    },
    onDeath(e, g, src) {
      if (src.type === 'self' || e.real) return;
      // a false light bursts into teeth
      B.ring(g, e.x, e.y, 6, 115, e.dmg, Math.random() * TAU, { color: GLOW, life: 1.7 });
      fx.text(e.x, e.y - 22, 'FALSE', '#a9b890', 10, 0.8);
    },
    draw(e, ctx, g) {
      const time = (g && g.time) || 0, t = time + (e.wob || 0), bob = Math.sin(t * 2) * 2;
      if (e.real) {
        // Only the masked base pass shows what waits under the real lure.
        ctx.save(); ctx.translate(e.x, e.y + 4); ctx.rotate((e.ang || 0) + Math.sin(t * 0.8) * 0.15);
        ctx.fillStyle = 'rgba(5,3,10,0.85)'; ctx.beginPath(); ctx.ellipse(0, 0, 44, 25, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-38, 0); ctx.lineTo(-62, -15 + Math.sin(t * 3) * 4); ctx.lineTo(-54, 0); ctx.lineTo(-62, 15 + Math.sin(t * 3) * 4); ctx.closePath(); ctx.fill();
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-20, s * 15); ctx.quadraticCurveTo(-34, s * 37, -6, s * 23); ctx.fill(); }
        ctx.strokeStyle = 'rgba(93,38,61,0.45)'; ctx.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(-22 + i * 8, 0, 7, 19 - i, 0, -1.1, 1.1); ctx.stroke(); }
        ctx.fillStyle = 'rgba(132,63,75,0.45)'; for (const s of [-1, 1]) for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.moveTo(16 + i * 3, s * (7 + i * 0.5)); ctx.lineTo(18 + i * 3, s * (13 + i * 0.5)); ctx.lineTo(19 + i * 3, s * (7 + i * 0.5)); ctx.fill(); }
        ctx.restore();
        for (let i = 0; i < 2; i++) { const k = (t * 0.6 + i * 0.5) % 1; ctx.strokeStyle = 'rgba(129,64,93,' + 0.4 * (1 - k) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(e.x, e.y + 4, 40 + k * 34, 24 + k * 20, 0, 0, TAU); ctx.stroke(); }
      } else {
        const k = (t * 0.7) % 1; ctx.strokeStyle = 'rgba(129,64,93,' + 0.28 * (1 - k) + ')'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(e.x, e.y + 4, 8 + k * 12, 4 + k * 6, 0, 0, TAU); ctx.stroke();
      }
      ctx.strokeStyle = e.flash > 0.6 ? '#fff' : (e.lit ? '#4b333c' : '#21151f'); ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(e.x, e.y + 5); ctx.quadraticCurveTo(e.x + 4, e.y - 6, e.x, e.y - 13 + bob); ctx.stroke();
      // Both lures imitate the same fractured piece of sunlight.
      ctx.save(); ctx.translate(e.x, e.y - 15 + bob); ctx.rotate(Math.sin(t * 1.5) * 0.14);
      ctx.fillStyle = e.flash > 0.6 ? '#fff' : (e.lit ? '#e7bc68' : '#94733e'); ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(5, -3); ctx.lineTo(3, 5); ctx.lineTo(-2, 8); ctx.lineTo(-5, 1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f4dda0'; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, 2); ctx.lineTo(3, 5); ctx.lineTo(5, -3); ctx.closePath(); ctx.fill(); ctx.restore();
    },
    drawGlow(e, ctx, g) {
      const time = (g && g.time) || 0, t = time + (e.wob || 0), y = e.y - 15 + Math.sin(t * 2) * 2, pulse = 0.8 + 0.2 * Math.sin(time * 5 + (e.wob || 0));
      ctx.save(); ctx.translate(e.x, y); ctx.rotate(Math.sin(t * 1.5) * 0.14);
      ctx.strokeStyle = 'rgba(255,220,139,0.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(5, -3); ctx.lineTo(3, 5); ctx.lineTo(-2, 8); ctx.lineTo(-5, 1); ctx.closePath(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,242,190,0.7)'; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(2, -2); ctx.lineTo(0, 4); ctx.lineTo(-1, 0); ctx.closePath(); ctx.fill(); ctx.restore();
      LF.drawGlow(ctx, '#ffd17b', e.x, y, 30 * pulse, 0.35);
    },
  };

  // =====================================================================================
  // THE FALSE LIGHT (second alternate for depth 3)
  // =====================================================================================
  function endDive(e, g) {
    for (const l of e.lures) if (!l.dead) { l.noDrops = true; g.killEnemy(l, { type: 'self' }); }
    e.lures = []; e.realLure = null; e.dived = false; e.intangible = false;
    e.diveT = 15 - e.phase;
  }
  function startDive(e, g) {
    const p = g.player, ph = e.phase;
    fx.ring(e.x, e.y, e.r * 1.6, 8, 0.5, '#8fe8d8', 4);
    e.dived = true; e.intangible = true; e.state = 'dive'; e.t = 7 - ph * 0.5; e.tel.length = 0;
    const n = ph === 3 ? 4 : 3, pts = [];
    for (let tries = 0; tries < 240 && pts.length < n; tries++) {
      const pt = B.arenaPoint(g, 3);
      if (LF.dist(pt.x, pt.y, p.x, p.y) < 150) continue;
      if (pts.some(q => LF.dist(q.x, q.y, pt.x, pt.y) < 190)) continue;
      pts.push(pt);
    }
    while (pts.length < n) pts.push(B.arenaPoint(g, 3));
    const k = Math.floor(Math.random() * n);
    e.lures = pts.map((pt, i) => {
      const l = g.spawnEnemy('lure', pt.x, pt.y, { awake: true, spawnT: 0.6, room: 0, noDrops: true });
      l.real = i === k; l.rate = 3.3 - ph * 0.4;
      return l;
    });
    e.realLure = e.lures[k]; e.x = e.realLure.x; e.y = e.realLure.y;
    LF.audio.play('spawn');
    if (!e.toldDive) { e.toldDive = true; g.banner = { text: 'It hides beneath one light', sub: 'Your lantern shows the shadow', t: 0, dur: 2.8, small: true, boss: true }; }
  }

  DEFS.angler = {
    name: 'The False Light', title: 'Not every glow down here is a piece of the Lantern', boss: true,
    hp: 1500, speed: 58, r: 31, dmg: 9.5, embers: 0, glass: 0, phases: [0.66, 0.33],
    eyes: [[8, -13, 2.2], [8, 13, 2.2]], eyeColor: '200,255,160',
    hideEyes(e) { return e.dived; },
    init(e) { B.bossInit(e); e.lures = []; e.realLure = null; e.diveT = 7; e.dived = false; e.jaw = 0; e.lx = 0; e.ly = 0; e.k = 0; e.toldDive = false; },
    modDamage(e, dmg, src) {
      if (e.dived && src.type === 'flare') return 0; // a flare reaches most hidden things, but not this one
      if (e.state === 'dazed') { if (Math.random() < 0.12) fx.text(e.x, e.y - e.r - 18, 'EXPOSED', GLOW, 9, 0.5); return dmg * 1.5; }
      return dmg;
    },
    update(e, g, dt) {
      const p = g.player, ph = e.phase;
      e.t -= dt; e.spin += dt; e.diveT -= dt; e.jaw = Math.max(0, e.jaw - dt * 3);
      B.updateTel(e, g, dt);
      if (B.phaseShift(e, g)) { endDive(e, g); e.state = 'idle'; e.t = 1.1; e.tel.length = 0; }
      const toP = Math.atan2(p.y - e.y, p.x - e.x);
      if (e.state === 'idle' || e.state === 'spit' || e.state === 'moths') e.face = LF.turnToward(e.face, toP, 3.2 * dt);
      switch (e.state) {
        case 'intro': if (e.t <= 0) { e.state = 'idle'; e.t = 0.8; } break;
        case 'idle': {
          const d = LF.dist(e.x, e.y, p.x, p.y);
          if (d > 130) { const sp = (e.speed + ph * 8) * e.slowMul(g); e.x += Math.cos(toP) * sp * dt; e.y += Math.sin(toP) * sp * dt; g.map.resolveCircle(e, e.r * 0.7); }
          if (e.t <= 0) {
            if (e.diveT <= 0) { e.state = 'sink'; e.t = 0.7; LF.audio.play('descend'); break; }
            const opts = ['bite', 'spit', 'bite'];
            if (ph >= 2 && B.minions(g) < 3) opts.push('moths');
            e.state = B.pickAttack(e, opts);
            if (e.state === 'bite') { e.count = ph; e.sub = 0; e.t = 0; }
            else if (e.state === 'spit') { e.count = 2 + ph; e.t = 0.55; LF.audio.play('charge'); }
            else if (e.state === 'moths') { e.t = 0.8; LF.audio.play('telegraph'); }
          }
          break;
        }
        case 'bite':
          if (e.sub === 0) {
            if (e.t <= 0) {
              // aim: it will rush along this lane
              e.sa = Math.atan2(p.y + p.vy * 0.25 - e.y, p.x + p.vx * 0.25 - e.x); e.face = e.sa;
              e.len = Math.max(50, Math.min(430, g.map.raycast(e.x, e.y, Math.cos(e.sa), Math.sin(e.sa), 430) - e.r - 4));
              e.sub = 1; e.t = ph === 3 ? 0.5 : 0.62; LF.audio.play('telegraph');
            }
          } else {
            e.red = 1; e.jaw = 1;
            const cx = Math.cos(e.sa), cy = Math.sin(e.sa);
            for (let s = 40; s <= e.len + 20; s += 60) g.hazards.push({ x: e.x + cx * s, y: e.y + cy * s, r: e.r + 8 });
            if (e.t <= 0) { e.state = 'charge'; e.k = 0; e.sx = e.x; e.sy = e.y; e.lx = cx; e.ly = cy; e.bit = false; LF.audio.play('lunge'); }
          }
          break;
        case 'charge': {
          e.red = 1; e.jaw = 1;
          e.k = Math.min(1, e.k + dt / 0.3 * e.slowMul(g));
          e.x = e.sx + e.lx * e.len * e.k; e.y = e.sy + e.ly * e.len * e.k;
          if (Math.random() < 0.7) fx.spawn({ x: e.x - e.lx * e.r + LF.rand(-10, 10), y: e.y - e.ly * e.r + LF.rand(-10, 10), life: 0.35, size: 3, color: '#8fe8d8' });
          if (!e.bit && hurtIfNear(g, e.x + e.lx * 10, e.y + e.ly * 10, e.r + 2, e.dmg * 1.25, 'the False Light')) { e.bit = true; e.contactCd = 0.75; }
          if (e.dead) return;
          if (e.k >= 1) {
            e.jaw = 0; g.shake(4); fx.ring(e.x + e.lx * e.r, e.y + e.ly * e.r, 6, 40, 0.25, '#d8e4c8', 3);
            g.map.resolveCircle(e, e.r * 0.7); B.clampToArena(g, e);
            if (ph >= 2) B.ring(g, e.x, e.y, 6 + ph * 2, 130, e.dmg * 0.7, e.sa, { color: GLOW });
            if (--e.count > 0) { e.state = 'bite'; e.sub = 0; e.t = 0.3; } else { e.state = 'idle'; e.t = 1.25; }
          }
          break;
        }
        case 'spit':
          e.red = 1;
          if (e.t <= 0) {
            const n = ph === 3 ? 7 : 5;
            for (let i = 0; i < n; i++) g.fireEnemyBullet({ x: e.x + Math.cos(e.face) * e.r, y: e.y + Math.sin(e.face) * e.r, angle: toP + (i - (n - 1) / 2) * 0.2, speed: 185, dmg: e.dmg * 0.7, color: GLOW, size: 5 });
            LF.audio.play('spit'); e.jaw = 1;
            if (--e.count > 0) e.t = 0.5; else { e.state = 'idle'; e.t = 1.3; }
          }
          break;
        case 'moths':
          e.red = 1;
          if (e.t <= 0) {
            for (let i = 0; i < 1 + ph; i++) { const pt = B.arenaPoint(g); g.spawnEnemy('moth', pt.x, pt.y, { awake: true, spawnT: 0.7, room: 0, noDrops: i > 1 }); }
            LF.audio.play('spawn'); e.state = 'idle'; e.t = 1.2;
          }
          break;
        case 'sink':
          if (e.t <= 0) startDive(e, g);
          break;
        case 'dive':
          if (e.realLure && e.realLure.dead) {
            // found: dragged up into the light, stunned
            endDive(e, g);
            e.state = 'dazed'; e.t = 2.8; e.flash = 1;
            g.shake(9); g.hitstop(0.08); LF.audio.play('crit'); LF.audio.play('splash');
            fx.ring(e.x, e.y, 10, e.r * 4, 0.5, GLOW, 5); fx.burst(e.x, e.y, 18, { color: ['#8fe8d8', '#fff'], speed1: 240, life: 0.5 });
            fx.text(e.x, e.y - e.r - 26, 'FOUND', GLOW, 15, 1.2);
            for (let i = 0; i < 3; i++) g.pickups.push(new LF.Pickup('ember', e.x + LF.rand(-26, 26), e.y + LF.rand(-26, 26), LF.EMBER));
          } else if (e.t <= 0) {
            // nobody found it: it comes up beneath the lantern instead
            for (const l of e.lures) if (!l.dead) { l.noDrops = true; g.killEnemy(l, { type: 'self' }); }
            e.lures = []; e.realLure = null;
            const o = g.map.nearestOpen(p.x, p.y);
            e.x = o.x; e.y = o.y; e.state = 'erupt'; e.t = 0.9;
            B.telegraph(e, o.x, o.y, 86, 0.9, () => {});
            LF.audio.play('telegraph');
          }
          break;
        case 'erupt':
          if (e.t <= 0) {
            e.dived = false; e.intangible = false; e.diveT = 15 - ph; e.jaw = 1; e.face = toP;
            B.blast(g, e.x, e.y, 90, e.dmg * 1.4, 'the False Light', GLOW);
            if (e.dead) return;
            B.ring(g, e.x, e.y, 12 + ph * 3, 140, e.dmg * 0.7, Math.random() * TAU, { color: GLOW });
            LF.audio.play('splash'); e.state = 'idle'; e.t = 1.3;
          }
          break;
        case 'dazed':
          if (e.t <= 0) { e.state = 'idle'; e.t = 0.6; }
          break;
      }
    },
    draw(e, ctx, g) {
      if (e.tel) B.drawTel(e, ctx, g);
      if (e.dived) return;
      if (e.state === 'bite' && e.sub === 1) {
        ctx.strokeStyle = `rgba(255,90,90,${0.22 + 0.4 * (1 - Math.max(0, e.t || 0) / 0.62)})`; ctx.lineWidth = e.r * 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(e.sa === undefined ? (e.face || 0) : e.sa) * (e.len || 0), e.y + Math.sin(e.sa === undefined ? (e.face || 0) : e.sa) * (e.len || 0)); ctx.stroke();
      }
      const time = (g && g.time) || 0, ph = e.maxHp > 0 ? B.phaseOf(e) : (e.phase || 1), r = e.r || 31, hit = e.flash > 0.6;
      const sink = e.state === 'sink' ? LF.clamp((e.t || 0) / 0.7, 0, 1) : 1, dazed = e.state === 'dazed';
      const wag = Math.sin(time * (e.state === 'charge' ? 24 : dazed ? 2 : 4 + ph)) * 0.25, wind = e.state === 'bite' && e.sub === 1 ? Math.max(0, 1 - (e.t || 0) / 0.62) : 0;
      const jaw = Math.max(e.jaw || 0, wind), body = hit ? '#fff' : (e.lit ? '#241b2a' : '#0b0811'), rim = e.lit ? '#623b50' : '#29192e';
      ctx.fillStyle = 'rgba(0,0,0,' + 0.4 * sink + ')'; ctx.beginPath(); ctx.ellipse(e.x, e.y + r * 0.5, r * 1.2, r * 0.5, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate((e.face || 0) + (dazed ? Math.sin(time * 9) * 0.08 : 0)); ctx.scale(sink * r / 31, sink * r / 31); ctx.globalAlpha *= 0.25 + 0.75 * sink;
      ctx.strokeStyle = rim; ctx.lineWidth = 1.5;
      // A dragging tail and ribbed fins surround a low, blind head.
      ctx.save(); ctx.translate(-28, 0); ctx.rotate(wag); ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(8, -9); ctx.lineTo(-27, -19); ctx.lineTo(-18, -1); ctx.lineTo(-27, 19); ctx.lineTo(8, 9); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      for (const s of [-1, 1]) {
        const wave = Math.sin(time * (3 + ph) + s) * 3;
        ctx.fillStyle = hit ? '#fff' : (e.lit ? '#392437' : '#160e1e'); ctx.beginPath(); ctx.moveTo(-24, s * 11); ctx.quadraticCurveTo(-27, s * (34 + wave), -7, s * 34); ctx.lineTo(5, s * 19); ctx.closePath(); ctx.fill(); ctx.stroke();
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-21 + i * 6, s * 14); ctx.lineTo(-23 + i * 5, s * (27 + wave * 0.5)); ctx.stroke(); }
      }
      ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(-4 - wind * 2, 0, 31, 24, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = hit ? '#fff' : (e.lit ? '#302333' : '#120c1b'); ctx.beginPath(); ctx.ellipse(-11, -4, 20, 15, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = hit ? '#fff' : (e.lit ? '#64404f' : '#2a182c'); ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(-25 + i * 7, 0, 7, 19 - i * 0.6, 0, -1.2, 1.2); ctx.stroke(); }
      // Long jaws separate around a black throat and interlocking needles.
      const spread = 5 + jaw * 15;
      ctx.fillStyle = '#030207'; ctx.beginPath(); ctx.moveTo(7, -8); ctx.lineTo(40, -spread); ctx.quadraticCurveTo(48, 0, 40, spread); ctx.lineTo(7, 8); ctx.closePath(); ctx.fill();
      for (const s of [-1, 1]) {
        ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(6, s * 6); ctx.lineTo(14, s * 18); ctx.quadraticCurveTo(30, s * (20 + jaw * 7), 44, s * spread); ctx.lineTo(39, s * (spread - 3)); ctx.lineTo(12, s * 5); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = hit ? '#fff' : (e.lit ? '#c1afb0' : '#594353');
        for (let i = 0; i < 10; i++) { const x = 14 + i * 2.7, y = s * (6 + i / 9 * (spread - 6)), len = 4 + (i % 3) * 2 + jaw * 3; ctx.beginPath(); ctx.moveTo(x - 1.1, y); ctx.lineTo(x + 1.1, y); ctx.lineTo(x - 1.8, y - s * len); ctx.closePath(); ctx.fill(); }
        // Stitched blind sockets have only a trace of the old lure colour.
        ctx.strokeStyle = '#100a16'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, s * 15); ctx.lineTo(12, s * 14); ctx.stroke();
      }
      if (ph >= 2) { ctx.strokeStyle = '#09050c'; ctx.lineWidth = ph === 3 ? 5 : 3; ctx.beginPath(); ctx.moveTo(-22, -16); ctx.lineTo(-13, -7); ctx.lineTo(-17, 4); ctx.lineTo(-7, 17); ctx.stroke(); }
      if (ph >= 3) { ctx.fillStyle = '#050308'; ctx.beginPath(); ctx.moveTo(-26, 17); ctx.lineTo(-16, 7); ctx.lineTo(-10, 22); ctx.closePath(); ctx.fill(); }
      ctx.strokeStyle = hit ? '#fff' : rim; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(3, -9); ctx.bezierCurveTo(16, -38, 42, -34, 48, 0); ctx.stroke(); ctx.restore();
      if (dazed) { ctx.fillStyle = 'rgba(228,255,154,0.9)'; for (let i = 0; i < 3; i++) { const a = time * 4 + i * TAU / 3; ctx.beginPath(); ctx.arc(e.x + Math.cos(a) * r * 0.8, e.y - r - 6 + Math.sin(a) * 5, 2.2, 0, TAU); ctx.fill(); } }
    },
    drawGlow(e, ctx, g) {
      if (e.dived) return;
      const time = (g && g.time) || 0, r = e.r || 31, ph = e.maxHp > 0 ? B.phaseOf(e) : (e.phase || 1), sink = e.state === 'sink' ? LF.clamp((e.t || 0) / 0.7, 0, 1) : 1;
      const face = (e.face || 0) + (e.state === 'dazed' ? Math.sin(time * 9) * 0.08 : 0), pulse = (e.state === 'dazed' ? 0.45 : 0.8) + 0.2 * Math.sin(time * 5);
      const lx = e.x + Math.cos(face) * 48 * r / 31 * sink, ly = e.y + Math.sin(face) * 48 * r / 31 * sink;
      ctx.save(); ctx.globalAlpha *= sink;
      ctx.translate(lx, ly); ctx.rotate(face + Math.sin(time * 2) * 0.1); ctx.fillStyle = 'rgba(255,224,152,0.8)'; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4, -1); ctx.lineTo(1, 6); ctx.lineTo(-4, 2); ctx.closePath(); ctx.fill(); ctx.restore();
      LF.drawGlow(ctx, '#ffd17b', lx, ly, 34 * pulse, 0.28 * sink);
      if (ph >= 2) { ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(face); ctx.scale(r / 31 * sink, r / 31 * sink); ctx.strokeStyle = 'rgba(231,54,78,' + 0.5 * sink + ')'; ctx.lineWidth = ph === 3 ? 2 : 1; ctx.beginPath(); ctx.moveTo(-22, -16); ctx.lineTo(-13, -7); ctx.lineTo(-17, 4); ctx.lineTo(-7, 17); ctx.stroke(); ctx.restore(); }
    },
    light(e, lc, white) { if (e.dived) return; lc.globalAlpha = 0.5; lc.drawImage(white, e.x - 90, e.y - 90, 180, 180); },
  };

  // =====================================================================================
  // THE SEXTON (second alternate for depth 6)
  // His blows knock light out of you as embers. Take them back before he calls them in:
  // every ember he gathers mends him a little.
  // =====================================================================================
  const BONE = '#e8e0cc', GRAVE = '#c9a0ff', HALF = 0.95;
  function spill(g, e, lost) {
    const p = g.player;
    if (p.dead || p.stats.noEmbers || lost <= 0.5) return;
    const n = 3, v = lost * 0.55 / n, back = Math.atan2(e.y - p.y, e.x - p.x);
    for (let i = 0; i < n; i++) {
      const a = back + LF.rand(-0.8, 0.8), s = LF.rand(360, 500);
      g.pickups.push(new LF.Pickup('ember', p.x, p.y, v, { vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 9, tithe: true }));
    }
    fx.text(p.x, p.y - 36, 'TITHE', GRAVE, 11, 0.9);
    e.titheT = Math.min(e.titheT, 2.6);
    if (!e.told) { e.told = true; g.banner = { text: 'He takes his tithe', sub: 'Take your embers back before he calls them', t: 0, dur: 3, small: true, boss: true }; }
  }
  // any blow of his that lands: hurt, then spill
  function strike(g, e, dmg, x, y) {
    const p = g.player, before = p.light;
    g.hurtPlayer(dmg, { x, y, name: 'the Sexton' });
    if (!p.dead && p.light < before - 0.5) spill(g, e, before - p.light);
  }
  function arenaEmbers(g) {
    const r = B.arena(g), T = LF.TILE, out = [];
    for (const pk of g.pickups) {
      if (pk.dead || pk.kind !== 'ember') continue;
      if (pk.x < r.x * T || pk.x > (r.x + r.w) * T || pk.y < r.y * T || pk.y > (r.y + r.h) * T) continue;
      out.push(pk);
    }
    return out;
  }

  DEFS.sexton = {
    name: 'The Sexton', title: 'He buried every lamp beside its bearer', boss: true,
    hp: 2200, speed: 86, r: 30, dmg: 9.5, embers: 0, glass: 0, phases: [0.66, 0.33],
    eyes: [[11, -5, 2], [11, 5, 2]], eyeColor: '201,160,255',
    init(e) { B.bossInit(e); e.titheT = 9; e.told = false; e.swingT = 0; e.swingDir = 1; e.sa = 0; e.reach = 140; e.eaten = 0; e.call = 0; e.gl = 0; e.ga = 0; },
    onTouch(e, g) { if (g.player.invuln <= 0) strike(g, e, e.dmg, e.x, e.y); },
    update(e, g, dt) {
      const p = g.player, ph = e.phase;
      e.t -= dt; e.spin += dt; e.titheT -= dt; e.swingT = Math.max(0, e.swingT - dt); e.call = Math.max(0, e.call - dt * 2);
      B.updateTel(e, g, dt);
      if (B.phaseShift(e, g)) { e.state = 'idle'; e.t = 1.1; e.tel.length = 0; }
      const toP = Math.atan2(p.y - e.y, p.x - e.x);
      if (e.state !== 'sweep') e.face = LF.turnToward(e.face, toP, 3.4 * dt);
      switch (e.state) {
        case 'intro': if (e.t <= 0) { e.state = 'idle'; e.t = 0.8; } break;
        case 'idle': {
          const d = LF.dist(e.x, e.y, p.x, p.y);
          if (d > 105) { const sp = (e.speed + ph * 10) * e.slowMul(g); e.x += Math.cos(toP) * sp * dt; e.y += Math.sin(toP) * sp * dt; g.map.resolveCircle(e, e.r * 0.7); }
          if (e.t <= 0) {
            if (e.titheT <= 0) {
              if (arenaEmbers(g).length) { e.state = 'collect'; e.sub = 0; e.t = 1.0; LF.audio.play('charge'); break; }
              e.titheT = 3;
            }
            const opts = ['sweep', 'graves', 'bones', 'sweep'];
            if (B.minions(g) < 3) opts.push('raise');
            if (d > 300) opts.push('graves', 'bones');
            e.state = B.pickAttack(e, opts);
            if (e.state === 'sweep') { e.count = ph; e.sub = 0; e.t = 0; e.reach = 140; }
            else if (e.state === 'graves') { e.t = 0.5; LF.audio.play('telegraph'); }
            else if (e.state === 'bones') { e.count = 2 + ph; e.t = 0.5; LF.audio.play('charge'); }
            else if (e.state === 'raise') { e.t = 0.9; LF.audio.play('telegraph'); }
          }
          break;
        }
        case 'sweep':
          if (e.sub === 0) {
            if (e.t <= 0) {
              // lunge in and wind up: the red wedge is where the shovel will pass
              e.gl = LF.clamp(LF.dist(e.x, e.y, p.x, p.y) - 90, 0, 120); e.ga = toP;
              e.sa = toP; e.face = e.sa;
              e.sub = 1; e.t = ph === 3 ? 0.5 : 0.6; e.swingDir = -e.swingDir; LF.audio.play('telegraph');
            }
          } else {
            e.red = 1;
            if (e.gl > 0) { const m = Math.min(e.gl, 520 * dt * e.slowMul(g)); e.x += Math.cos(e.ga) * m; e.y += Math.sin(e.ga) * m; e.gl -= m; g.map.resolveCircle(e, e.r * 0.7); }
            g.hazards.push({ x: e.x + Math.cos(e.sa) * e.reach * 0.5, y: e.y + Math.sin(e.sa) * e.reach * 0.5, r: e.reach * 0.72 });
            if (e.t <= 0) {
              e.swingT = 0.2; LF.audio.play('lunge'); g.shake(4);
              const d = LF.dist(e.x, e.y, p.x, p.y), off = Math.abs(LF.angDiff(e.sa, Math.atan2(p.y - e.y, p.x - e.x)));
              if (!p.dead && p.dashing <= 0 && p.invuln <= 0 && d < e.reach + p.r && (off < HALF || d < e.r + p.r)) strike(g, e, e.dmg * 1.2, e.x, e.y);
              if (--e.count > 0) { e.sub = 0; e.t = 0.38; e.reach += 16; } else { e.state = 'idle'; e.t = 1.2; }
            }
          }
          break;
        case 'graves':
          e.red = 1;
          if (e.t <= 0) {
            // rows of graves open, marching away from him
            const side = Math.random() < 0.5 ? -0.3 : 0.3;
            const rows = ph === 3 ? [-0.45, -0.15, 0.15, 0.45] : ph === 2 ? [-0.3, 0, 0.3] : [0, side];
            for (const off of rows) {
              const a = toP + off;
              for (let i = 1; i <= 7; i++) {
                const x = e.x + Math.cos(a) * (40 + i * 62), y = e.y + Math.sin(a) * (40 + i * 62);
                if (g.map.solidAt(x, y)) break;
                B.telegraph(e, x, y, 38, 0.5 + i * 0.13, t => {
                  const before = p.light;
                  B.blast(g, t.x, t.y, 40, e.dmg, 'grasping bones', BONE);
                  if (!e.dead && !p.dead && p.light < before - 0.5) spill(g, e, before - p.light);
                });
              }
            }
            LF.audio.play('gate'); g.shake(5); e.state = 'idle'; e.t = 1.5;
          }
          break;
        case 'bones':
          e.red = 1;
          if (e.t <= 0) {
            const n = ph === 3 ? 5 : 3, off = (e.count % 2) * 0.13;
            for (let i = 0; i < n; i++) g.fireEnemyBullet({ x: e.x + Math.cos(e.face) * e.r, y: e.y + Math.sin(e.face) * e.r, angle: toP + (i - (n - 1) / 2) * 0.26 + off - (e.count % 2 ? 0.2 : -0.2), speed: 215, dmg: e.dmg * 0.7, color: BONE, size: 5, spin: e.count % 2 ? 0.4 : -0.4 });
            LF.audio.play('spit'); e.swingT = 0.12;
            if (--e.count > 0) e.t = 0.42; else { e.state = 'idle'; e.t = 1.25; }
          }
          break;
        case 'raise':
          e.red = 1;
          if (e.t <= 0) {
            for (let i = 0; i < 1 + ph; i++) { const pt = B.arenaPoint(g); g.spawnEnemy(i === 0 && ph >= 2 ? 'wraith' : 'skitter', pt.x, pt.y, { awake: true, spawnT: 0.8, room: 0, noDrops: i > 1 }); }
            LF.audio.play('spawn'); e.state = 'idle'; e.t = 1.3;
          }
          break;
        case 'collect':
          e.red = 1; e.call = 1;
          if (e.sub === 0) {
            if (e.t <= 0) { e.sub = 1; e.t = 1.9; e.eaten = 0; LF.audio.play('howl'); }
          } else {
            for (const pk of arenaEmbers(g)) {
              const d = LF.dist(pk.x, pk.y, e.x, e.y) || 1;
              pk.vx = (e.x - pk.x) / d * 340; pk.vy = (e.y - pk.y) / d * 340;
              if (d < e.r + 8) {
                pk.dead = true;
                fx.burst(pk.x, pk.y, 4, { color: [GRAVE, '#fff'], speed1: 70, life: 0.3, size: 1.6 });
                if (e.eaten < 9) {
                  e.eaten++;
                  const cap = e.maxHp * [1, 0.66, 0.33][ph - 1] - 1; // never mends back across a phase
                  if (e.hp < cap) { e.hp = Math.min(cap, e.hp + e.maxHp * 0.006); fx.text(e.x + LF.rand(-14, 14), e.y - e.r - 12, '+', '#b6f0a0', 12, 0.6); }
                }
              }
            }
            if (e.t <= 0) { e.state = 'idle'; e.t = 1.0; e.titheT = 13 - ph; }
          }
          break;
      }
    },
    draw(e, ctx, g) {
      if (e.tel) B.drawTel(e, ctx, g);
      if (e.state === 'sweep' && e.sub === 1) {
        ctx.fillStyle = `rgba(255,90,90,${0.14 + 0.24 * (1 - Math.max(0, e.t || 0) / 0.6)})`;
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.arc(e.x, e.y, e.reach || 140, (e.sa || 0) - HALF, (e.sa || 0) + HALF); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,90,90,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, e.reach || 140, (e.sa || 0) - HALF, (e.sa || 0) + HALF); ctx.stroke();
      }
      if (e.swingT > 0 && e.state !== 'bones') {
        ctx.strokeStyle = `rgba(232,224,204,${Math.min(1, e.swingT / 0.2)})`; ctx.lineWidth = 7; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(e.x, e.y, (e.reach || 140) * 0.82, (e.sa || 0) - HALF, (e.sa || 0) + HALF); ctx.stroke();
      }
      if (e.state === 'collect' && g && g.pickups && g.map && g.map.rooms && g.map.rooms[0]) {
        const k = e.sub === 0 ? 1 - Math.max(0, e.t || 0) : 1;
        ctx.strokeStyle = `rgba(201,160,255,${0.15 + 0.35 * k})`; ctx.lineWidth = 1.5; ctx.setLineDash([4, 6]);
        for (const pk of arenaEmbers(g)) { ctx.beginPath(); ctx.moveTo(pk.x, pk.y); ctx.lineTo(e.x, e.y); ctx.stroke(); }
        ctx.setLineDash([]);
      }
      const time = (g && g.time) || 0, ph = e.maxHp > 0 ? B.phaseOf(e) : (e.phase || 1), r = e.r || 30, hit = e.flash > 0.6, call = e.call || 0;
      const collect = e.state === 'collect', wind = collect ? Math.max(call, e.sub === 0 ? 1 - Math.max(0, e.t || 0) : 1) : 0, walk = Math.sin(time * (2 + ph * 0.5)) * 2;
      const robe = hit ? '#fff' : (e.lit ? '#241b2b' : '#0e0a16'), rim = e.lit ? '#594050' : '#291a30';
      ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + r * 0.6, r * 1.1, r * 0.45, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.face || 0); ctx.scale(r / 30, r / 30);
      // The spade keeps its original reach and sweep pose.
      const sw = e.swingT > 0 ? (e.swingDir || 1) * HALF * (1 - e.swingT / 0.2 * 2) : e.state === 'sweep' && e.sub === 1 ? (e.swingDir || 1) * HALF : e.state === 'graves' ? 0 : 0.55;
      ctx.save(); ctx.rotate(sw); ctx.strokeStyle = hit ? '#fff' : (e.lit ? '#675047' : '#2c2026'); ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(52.5, 0); ctx.stroke();
      ctx.strokeStyle = e.lit ? '#9b8180' : '#48343f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(10, 0, 6, 4, 0, 0, TAU); ctx.stroke();
      ctx.fillStyle = hit ? '#fff' : (e.lit ? '#706774' : '#322838'); ctx.beginPath(); ctx.moveTo(51, -9); ctx.lineTo(64.5, -7); ctx.lineTo(70.5, 0); ctx.lineTo(64.5, 7); ctx.lineTo(51, 9); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = e.lit ? '#b4a4a6' : '#66525e'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(64.5, -7); ctx.lineTo(70.5, 0); ctx.lineTo(64.5, 7); ctx.stroke();
      ctx.strokeStyle = '#3b2936'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(54, 0); ctx.lineTo(66, 0); ctx.stroke(); ctx.restore();
      // A long divided coat drags behind heavy shoulders.
      ctx.fillStyle = robe; ctx.strokeStyle = rim; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(18, -17); ctx.lineTo(-10, -30 - wind * 3); ctx.lineTo(-38, -21 + walk); ctx.lineTo(-33, -10); ctx.lineTo(-41, -4); ctx.lineTo(-28, 2); ctx.lineTo(-39, 17 - walk); ctx.lineTo(-23, 29); ctx.lineTo(9, 27); ctx.lineTo(22, 13); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#09060f'; ctx.beginPath(); ctx.moveTo(-29, 0); ctx.lineTo(7, -13 - wind * 5); ctx.lineTo(16, 0); ctx.lineTo(6, 15 + wind * 5); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = hit ? '#fff' : (e.lit ? '#4c3348' : '#25162c'); ctx.lineWidth = 2;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-33, s * (18 - walk)); ctx.quadraticCurveTo(-14, s * (16 + wind * 6), 8, s * 10); ctx.stroke(); ctx.fillStyle = robe; ctx.beginPath(); ctx.ellipse(-2, s * 23, 12, 9, s * 0.4, 0, TAU); ctx.fill(); ctx.stroke(); }
      // Stolen embers sit behind the ribs inside the open coat.
      const embers = Math.min(6, 2 + Math.floor(e.eaten || 0));
      ctx.fillStyle = 'rgba(156,48,59,0.65)'; for (let i = 0; i < embers; i++) { ctx.beginPath(); ctx.arc(-13 + i % 3 * 6, -5 + Math.floor(i / 3) * 10, 1.5 + wind * 0.6, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = '#4a293a'; ctx.lineWidth = 1.3; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-17 + i * 6, -9); ctx.lineTo(-14 + i * 6, 9); ctx.stroke(); }
      // Broad hat, pinched crown and a hollow face below its brim.
      ctx.fillStyle = hit ? '#fff' : (e.lit ? '#302333' : '#150d20'); ctx.strokeStyle = rim; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(7, 0, 18, 28, -0.12, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#06040b'; ctx.beginPath(); ctx.moveTo(11, -11); ctx.quadraticCurveTo(34, 0, 11, 11); ctx.closePath(); ctx.fill();
      ctx.fillStyle = hit ? '#fff' : (e.lit ? '#443044' : '#211329'); ctx.beginPath(); ctx.ellipse(1, 0, 12, 18, -0.12, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#6d4250'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(4, 0, 10, 18, -0.12, -1.5, 1.5); ctx.stroke();
      if (ph >= 2) { ctx.strokeStyle = '#0a060e'; ctx.lineWidth = ph === 3 ? 4 : 2; ctx.beginPath(); ctx.moveTo(-27, -22); ctx.lineTo(-18, -14); ctx.lineTo(-22, -5); ctx.stroke(); }
      if (ph >= 3) { ctx.fillStyle = '#07040b'; ctx.beginPath(); ctx.moveTo(-34, 20); ctx.lineTo(-22, 13); ctx.lineTo(-21, 28); ctx.closePath(); ctx.fill(); }
      // Caged grave lamp at the same hip as before.
      ctx.strokeStyle = hit ? '#fff' : '#6b526c'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(-1, -35, 4, Math.PI, TAU); ctx.stroke();
      ctx.fillStyle = hit ? '#fff' : (e.lit ? '#49374f' : '#211729'); LF.roundRect(ctx, -6, -35.6, 10, 12, 2); ctx.fill();
      ctx.fillStyle = 'rgba(145,123,166,' + (0.2 + call * 0.3) + ')'; ctx.fillRect(-4, -33.6, 6, 8);
      ctx.strokeStyle = '#1b1123'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-1, -35); ctx.lineTo(-1, -24); ctx.moveTo(-6, -29); ctx.lineTo(4, -29); ctx.stroke(); ctx.restore();
    },
    drawGlow(e, ctx, g) {
      const time = (g && g.time) || 0, face = e.face || 0, r = e.r || 30, call = e.call || 0, ph = e.maxHp > 0 ? B.phaseOf(e) : (e.phase || 1);
      const a = face - Math.PI / 2, lx = e.x + Math.cos(a) * r * 1.02 - Math.cos(face) * r / 30, ly = e.y + Math.sin(a) * r * 1.02 - Math.sin(face) * r / 30;
      ctx.fillStyle = 'rgba(201,178,224,' + (0.3 + 0.6 * call) + ')'; ctx.beginPath(); ctx.arc(lx, ly, 2.5, 0, TAU); ctx.fill();
      LF.drawGlow(ctx, GRAVE, lx, ly, 22 + call * 40, (0.18 + call * 0.8) * 0.45);
      if (call > 0) LF.drawGlow(ctx, GRAVE, e.x, e.y, r * 2.6, 0.14 * call);
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(face); ctx.scale(r / 30, r / 30);
      ctx.fillStyle = 'rgba(232,66,69,' + (0.2 + call * 0.3 + Math.sin(time * 3) * 0.05) + ')';
      for (let i = 0; i < Math.min(6, 2 + Math.floor(e.eaten || 0)); i++) { ctx.beginPath(); ctx.arc(-13 + i % 3 * 6, -5 + Math.floor(i / 3) * 10, 1.3, 0, TAU); ctx.fill(); }
      if (ph >= 2) { ctx.strokeStyle = 'rgba(196,56,81,0.4)'; ctx.lineWidth = ph === 3 ? 1.5 : 0.8; ctx.beginPath(); ctx.moveTo(-27, -22); ctx.lineTo(-18, -14); ctx.lineTo(-22, -5); ctx.stroke(); }
      ctx.restore();
    },
    light(e, lc, white) { lc.globalAlpha = 0.45; lc.drawImage(white, e.x - 85, e.y - 85, 170, 170); },
  };

  // =====================================================================================
  // THE FIRST BEARER (second alternate for depth 9) and its echoes
  // It reached the bottom long ago and stayed. It fights the way you do, and it answers
  // your dash with its own and your flare with its own.
  // =====================================================================================
  const COLD = '#cfc4ff', COLD_RGB = '207,196,255';
  const FIG_LIT = { coat: '#bdb5d2', coatHi: '#e4def2', deep: '#8f88a6', hat: '#a9a1c0', hatTop: '#e4def2', rim: '#d2cbe6', trim: '#6f6890', metal: '#3d3852', core: '#3d3852', pole: '#5a546e', boot: '#2c2838', dark: '#07060c' };
  const FIG_DIM = { coat: '#4c475e', coatHi: '#625c78', deep: '#3a3648', hat: '#444056', hatTop: '#625c78', rim: '#565069', trim: '#2c2838', metal: '#3d3852', core: '#3d3852', pole: '#2c2838', boot: '#1c1a26', dark: '#07060c' };
  function drawBearer(e, ctx, g, alpha) {
    // it has no velocity of its own to read: take the way it is going from where it was last frame
    const dx = e.x - (e.figX === undefined ? e.x : e.figX), dy = e.y - (e.figY === undefined ? e.y : e.figY);
    e.figX = e.x; e.figY = e.y;
    if (dx * dx + dy * dy > 0.04) { e.figMv = Math.atan2(dy, dx); e.figGo = 0.2; } else e.figGo = (e.figGo || 0) - 1 / 60;
    const dash = e.state === 'charge' && dx * dx + dy * dy > 9;
    ctx.globalAlpha = alpha;
    const lp = LF.drawFigure(ctx, LF.lookOf(g.meta), { x: e.x, y: e.y, sc: e.r / 10, aim: e.face, mv: e.figMv || e.face, sp: e.figGo > 0 ? 130 : 0, bob: g.time * 11 + e.wob, t: g.time + e.wob, flash: e.flash > 0, dash, frac: 1, st: e.fig || (e.fig = {}), pal: e.lit ? FIG_LIT : FIG_DIM });
    e.lampX = lp.x; e.lampY = lp.y;
    ctx.globalAlpha = 1;
  }
  function glowBearer(e, ctx, g, k) {
    const sc = e.r / 12, lx = e.lampX === undefined ? e.x + Math.cos(e.face) * 15 * sc : e.lampX, ly = e.lampY === undefined ? e.y + Math.sin(e.face) * 15 * sc : e.lampY;
    const fl = 1 + Math.sin(g.time * 17 + e.wob) * 0.07;
    ctx.fillStyle = `rgba(${COLD_RGB},${Math.min(1, 0.95 * k)})`; ctx.beginPath(); ctx.arc(lx, ly, 3 * sc, 0, TAU); ctx.fill();
    LF.drawGlow(ctx, COLD, lx, ly, 20 * sc * fl, Math.min(1, 0.5 * k));
  }
  // circle the lantern at a set distance, turning round when blocked
  function roam(e, g, dt, R, sp) {
    const p = g.player, toP = Math.atan2(p.y - e.y, p.x - e.x), d = LF.dist(e.x, e.y, p.x, p.y);
    e.orbitT -= dt;
    if (e.orbitT <= 0) { e.orbit = -e.orbit; e.orbitT = LF.rand(1.4, 3.4); }
    const want = d > R + 45 ? toP + e.orbit * 0.5 : d < R - 45 ? toP + Math.PI - e.orbit * 0.6 : toP + e.orbit * Math.PI / 2;
    const ox = e.x, oy = e.y;
    e.x += Math.cos(want) * sp * dt; e.y += Math.sin(want) * sp * dt;
    g.map.resolveCircle(e, e.r);
    if (LF.dist(ox, oy, e.x, e.y) < sp * dt * 0.35) { e.orbit = -e.orbit; e.orbitT = 1.2; }
  }

  DEFS.echo = {
    name: 'Echo', hp: 75, speed: 120, r: 12, dmg: 10, embers: 0.7, glass: 0.4, contact: false,
    eyes: [[4, -1.5, 1], [4, 1.5, 1]], eyeColor: '207,196,255',
    init(e) { e.cd = LF.rand(0.9, 1.7); e.orbit = Math.random() < 0.5 ? 1 : -1; e.orbitT = LF.rand(1, 3); },
    update(e, g, dt) {
      const p = g.player, toP = Math.atan2(p.y - e.y, p.x - e.x);
      e.face = LF.turnToward(e.face, toP, 6 * dt);
      roam(e, g, dt, 210, e.speed * e.speedMod(g));
      e.cd -= dt;
      if (e.cd <= 0.35) e.red = 1;
      if (e.cd <= 0) {
        e.cd = 1.8;
        if (!p.dead && g.map.los(e.x, e.y, p.x, p.y)) {
          g.fireEnemyBullet({ x: e.x + Math.cos(e.face) * 16, y: e.y + Math.sin(e.face) * 16, angle: toP, speed: 250, dmg: e.dmg, color: COLD, size: 4 });
          LF.audio.play('spit');
        }
      }
    },
    draw(e, ctx, g) { drawBearer(e, ctx, g, 0.6); },
    drawGlow(e, ctx, g) { glowBearer(e, ctx, g, 0.6); },
  };

  DEFS.bearer = {
    name: 'The First Bearer', title: 'The first Lamplighter to reach the Lantern. It stayed', boss: true,
    hp: 4600, speed: 128, r: 18, dmg: 14, embers: 0, glass: 0, phases: [0.66, 0.33],
    eyes: [[6, -2.2, 1.3], [6, 2.2, 1.3]], eyeColor: '255,255,255',
    init(e) { B.bossInit(e); e.orbit = 1; e.orbitT = 2; e.mirrorT = 4; e.pDash = false; e.pFlare = 0; e.told = false; e.k = 0; e.lx = 0; e.ly = 0; e.aim = 0; e.shotT = 0; e.ghosts = []; e.fl = 0; },
    update(e, g, dt) {
      const p = g.player, ph = e.phase;
      e.t -= dt; e.spin += dt; e.mirrorT -= dt; e.fl = Math.max(0, e.fl - dt * 2);
      if (e.ghosts.length) { for (const gh of e.ghosts) gh.life -= dt; e.ghosts = e.ghosts.filter(gh => gh.life > 0); }
      B.updateTel(e, g, dt);
      if (B.phaseShift(e, g)) { e.state = 'idle'; e.t = 1.0; e.tel.length = 0; }
      const toP = Math.atan2(p.y - e.y, p.x - e.x), d = LF.dist(e.x, e.y, p.x, p.y);
      // the mirror: while it is free to act, your dash and your flare are each answered in kind
      const dashed = p.dashing > 0 && !e.pDash, flared = p.flareT > e.pFlare + 1;
      e.pDash = p.dashing > 0; e.pFlare = p.flareT;
      if ((dashed || flared) && e.mirrorT <= 0 && e.state === 'idle' && !p.dead) {
        e.mirrorT = 3.0 - ph * 0.4;
        fx.text(e.x, e.y - e.r - 16, 'ANSWERED', COLD, 10, 0.8);
        if (!e.told) { e.told = true; g.banner = { text: 'It moves as you move', sub: 'Every dash and flare is answered', t: 0, dur: 3, small: true, boss: true }; }
        if (flared) { e.state = 'flare'; e.sub = 0; e.t = 0.85; LF.audio.play('charge'); }
        else { e.state = 'slash'; e.count = 1; e.sub = 0; e.t = 0.12; }
      }
      if (e.state !== 'slash' && e.state !== 'charge') e.face = LF.turnToward(e.face, toP, 7 * dt);
      switch (e.state) {
        case 'intro': if (e.t <= 0) { e.state = 'idle'; e.t = 0.8; } break;
        case 'idle':
          roam(e, g, dt, 250, (e.speed + ph * 8) * e.slowMul(g)); B.clampToArena(g, e);
          if (e.t <= 0) {
            const opts = ['volley', 'slash', 'volley'];
            if (d < 230) opts.push('flare');
            if (ph >= 2 && B.minions(g) < ph - 1) opts.push('echo', 'echo');
            e.state = B.pickAttack(e, opts);
            if (e.state === 'volley') { e.count = 9 + ph * 3; e.sub = 0; e.t = 0.45; e.aim = toP; LF.audio.play('telegraph'); }
            else if (e.state === 'slash') { e.count = ph >= 3 ? 2 : 1; e.sub = 0; e.t = 0.1; }
            else if (e.state === 'flare') { e.sub = 0; e.t = 0.85; LF.audio.play('charge'); }
            else if (e.state === 'echo') { e.t = 0.7; LF.audio.play('telegraph'); }
          }
          break;
        case 'volley':
          e.red = 1;
          roam(e, g, dt, 250, e.speed * 0.45 * e.slowMul(g)); B.clampToArena(g, e);
          e.aim = LF.turnToward(e.aim, toP, (e.sub === 0 ? 6 : 1.5 + ph * 0.25) * dt); e.face = e.aim;
          if (e.sub === 0) { if (e.t <= 0) { e.sub = 1; e.shotT = 0; } }
          else {
            e.shotT -= dt;
            if (e.shotT <= 0) {
              e.shotT = 0.085;
              g.fireEnemyBullet({ x: e.x + Math.cos(e.aim) * e.r * 1.3, y: e.y + Math.sin(e.aim) * e.r * 1.3, angle: e.aim + LF.rand(-0.05, 0.05), speed: 330, dmg: e.dmg * 0.6, color: COLD, size: 4, life: 2.2 });
              LF.audio.play('spit'); e.fl = 1;
              if (--e.count <= 0) { e.state = 'idle'; e.t = 1.1; }
            }
          }
          break;
        case 'slash':
          if (e.sub === 0) {
            if (e.t <= 0) {
              // aim a lane through the lantern and out the far side
              e.sa = Math.atan2(p.y + p.vy * 0.2 - e.y, p.x + p.vx * 0.2 - e.x); e.face = e.sa;
              const ray = g.map.raycast(e.x, e.y, Math.cos(e.sa), Math.sin(e.sa), 520) - e.r - 4;
              e.len = Math.max(40, Math.min(ray, d + 150));
              e.sub = 1; e.t = ph === 3 ? 0.4 : 0.48; LF.audio.play('telegraph');
            }
          } else {
            e.red = 1;
            const cx = Math.cos(e.sa), cy = Math.sin(e.sa);
            for (let s = 30; s <= e.len + 10; s += 50) g.hazards.push({ x: e.x + cx * s, y: e.y + cy * s, r: e.r + 14 });
            if (e.t <= 0) { e.state = 'charge'; e.k = 0; e.sx = e.x; e.sy = e.y; e.lx = cx; e.ly = cy; e.bit = false; LF.audio.play('lunge'); }
          }
          break;
        case 'charge':
          e.red = 1;
          e.k = Math.min(1, e.k + dt / 0.2 * e.slowMul(g));
          e.ghosts.push({ x: e.x, y: e.y, life: 0.25 });
          e.x = e.sx + e.lx * e.len * e.k; e.y = e.sy + e.ly * e.len * e.k;
          if (!e.bit && hurtIfNear(g, e.x, e.y, e.r + 8, e.dmg * 1.15, 'the First Bearer')) e.bit = true;
          if (e.dead) return;
          if (e.k >= 1) {
            g.map.resolveCircle(e, e.r); B.clampToArena(g, e);
            if (--e.count > 0) { e.state = 'slash'; e.sub = 0; e.t = 0.22; } else { e.state = 'idle'; e.t = 0.9; }
          }
          break;
        case 'flare':
          e.red = 1;
          if (e.sub === 0) {
            g.hazards.push({ x: e.x, y: e.y, r: 178 });
            if (e.t <= 0) {
              B.blast(g, e.x, e.y, 172, e.dmg * 1.3, 'the First Bearer', COLD);
              if (e.dead) return;
              B.ring(g, e.x, e.y, 14 + ph * 2, 170, e.dmg * 0.65, e.spin, { color: COLD });
              LF.audio.play('flare'); e.fl = 1;
              if (ph >= 3) { e.sub = 1; e.t = 0.35; } else { e.state = 'idle'; e.t = 1.1; }
            }
          } else if (e.t <= 0) {
            B.ring(g, e.x, e.y, 14 + ph * 2, 150, e.dmg * 0.65, e.spin + 0.2, { color: COLD });
            e.state = 'idle'; e.t = 1.1;
          }
          break;
        case 'echo':
          e.red = 1;
          if (e.t <= 0) {
            const o = g.map.nearestOpen(e.x + Math.cos(e.face + Math.PI / 2) * 60, e.y + Math.sin(e.face + Math.PI / 2) * 60);
            g.spawnEnemy('echo', o.x, o.y, { awake: true, spawnT: 0.6, room: 0 });
            fx.ring(o.x, o.y, 6, 50, 0.4, COLD, 3); LF.audio.play('spawn');
            e.state = 'idle'; e.t = 1.0;
          }
          break;
      }
    },
    draw(e, ctx, g) {
      B.drawTel(e, ctx, g);
      if (e.state === 'slash' && e.sub === 1) {
        ctx.strokeStyle = `rgba(255,90,90,${0.22 + 0.4 * (1 - Math.max(0, e.t) / 0.48)})`; ctx.lineWidth = (e.r + 8) * 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(e.sa) * e.len, e.y + Math.sin(e.sa) * e.len); ctx.stroke();
      }
      if (e.state === 'volley' && e.sub === 0) {
        ctx.strokeStyle = 'rgba(255,90,90,0.6)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(e.aim) * 420, e.y + Math.sin(e.aim) * 420); ctx.stroke(); ctx.setLineDash([]);
      }
      if (e.state === 'flare' && e.sub === 0) {
        const k = 1 - Math.max(0, e.t) / 0.85;
        ctx.fillStyle = `rgba(255,90,90,${0.08 + 0.14 * k})`; ctx.beginPath(); ctx.arc(e.x, e.y, 172, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,90,90,0.85)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, 172, 0, TAU); ctx.stroke();
        ctx.fillStyle = 'rgba(255,90,90,0.25)'; ctx.beginPath(); ctx.arc(e.x, e.y, 172 * k, 0, TAU); ctx.fill();
      }
      for (const gh of e.ghosts) { ctx.fillStyle = `rgba(207,196,255,${Math.max(0, gh.life / 0.25) * 0.35})`; ctx.beginPath(); ctx.arc(gh.x, gh.y, e.r, 0, TAU); ctx.fill(); }
      drawBearer(e, ctx, g, 1);
    },
    drawGlow(e, ctx, g) {
      glowBearer(e, ctx, g, 1 + e.fl * 0.6);
      if (e.state === 'flare' && e.sub === 0) LF.drawGlow(ctx, COLD, e.x, e.y, 60 + (1 - Math.max(0, e.t) / 0.85) * 90, 0.3);
    },
    light(e, lc, white) { lc.globalAlpha = 0.6; lc.drawImage(white, e.x - 120, e.y - 120, 240, 240); },
  };
})();
