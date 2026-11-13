'use strict';
// The three great shadows. Each is an enemy definition with a phase-driven attack scheduler.
(function () {
  const fx = LF.fx, TAU = LF.TAU, TILE = LF.TILE, DEFS = LF.ENEMY_DEFS;

  // ---------- shared boss toolkit ----------
  function phaseOf(e) { const f = e.hp / e.maxHp; return f > 0.66 ? 1 : f > 0.33 ? 2 : 3; }
  function arena(g) { return g.map.rooms[0]; }
  function arenaPoint(g, margin = 3) {
    const r = arena(g);
    for (let i = 0; i < 30; i++) {
      const x = (r.x + margin + Math.random() * (r.w - margin * 2)) * TILE, y = (r.y + margin + Math.random() * (r.h - margin * 2)) * TILE;
      if (!g.map.solidAt(x, y)) return { x, y };
    }
    return { x: r.cx * TILE, y: r.cy * TILE };
  }
  function clampToArena(g, e) {
    const r = arena(g), m = e.r + 6;
    e.x = LF.clamp(e.x, r.x * TILE + m, (r.x + r.w) * TILE - m);
    e.y = LF.clamp(e.y, r.y * TILE + m, (r.y + r.h) * TILE - m);
  }
  function ring(g, x, y, n, speed, dmg, offset, o = {}) {
    for (let i = 0; i < n; i++) {
      if (o.gapEvery && (i % o.gapEvery) < (o.gapSize || 1)) continue;
      g.fireEnemyBullet(Object.assign({ x, y, angle: offset + i * TAU / n, speed, dmg, size: 5 }, o));
    }
  }
  // Telegraphed circle: warns, then calls fn. Stored on the boss; the bot reads g.hazards.
  function telegraph(e, x, y, r, time, fn, color = '255,90,90') { e.tel.push({ x, y, r, t: time, max: time, fn, color }); }
  function updateTel(e, g, dt) {
    for (const t of e.tel) {
      t.t -= dt;
      g.hazards.push(t);
      if (t.t <= 0) { t.dead = true; t.fn(t); }
    }
    LF.compact(e.tel);
  }
  function drawTel(e, ctx, g) {
    for (const t of e.tel) {
      const k = 1 - t.t / t.max;
      ctx.fillStyle = `rgba(${t.color},${0.10 + 0.12 * k})`; ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(${t.color},0.85)`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, TAU); ctx.stroke();
      ctx.fillStyle = `rgba(${t.color},0.3)`; ctx.beginPath(); ctx.arc(t.x, t.y, t.r * k, 0, TAU); ctx.fill();
    }
  }
  function blast(g, x, y, r, dmg, name, color = '#ff6b6b') {
    const p = g.player;
    fx.ring(x, y, r * 0.3, r, 0.3, color, 4); fx.burst(x, y, 14, { color: [color, '#fff'], speed1: 220, life: 0.4 });
    g.addFlash(x, y, r * 1.6, 0.25, color); g.shake(5); LF.audio.play('explode');
    if (!p.dead && p.dashing <= 0 && LF.dist(x, y, p.x, p.y) < r + p.r - 4) g.hurtPlayer(dmg, { x, y, name });
  }
  function pickAttack(e, list) {
    let a;
    do { a = LF.pick(list); } while (list.length > 1 && a === e.lastAtk);
    e.lastAtk = a;
    return a;
  }
  function minions(g) { let n = 0; for (const o of g.enemies) if (!o.dead && !o.boss) n++; return n; }
  function bossInit(e) { e.state = 'intro'; e.t = 0.8; e.tel = []; e.beams = []; e.lastAtk = null; e.spin = 0; e.count = 0; e.sub = 0; e.phase = 1; }
  function phaseShift(e, g) {
    const ph = phaseOf(e);
    if (ph !== e.phase) {
      e.phase = ph;
      LF.audio.play('roar'); g.shake(10);
      fx.ring(e.x, e.y, e.r, e.r * 6, 0.7, '#e2c9ff', 6);
      for (const b of g.ebullets) b.dead = true;
      g.banner = { text: ph === 2 ? 'It wakes further' : 'It will not let you leave', sub: '', t: 0, dur: 1.8, small: true, boss: true };
      return true;
    }
    return false;
  }

  LF.BH = { phaseOf, arena, arenaPoint, clampToArena, ring, telegraph, updateTel, drawTel, blast, pickAttack, minions, bossInit, phaseShift };

  // =====================================================================================
  // 1. THE FALLEN BELL
  // =====================================================================================
  DEFS.bell = {
    name: 'The Fallen Bell', title: 'It rang the hours of the Lantern, and fell with it', boss: true,
    hp: 1400, speed: 42, r: 34, dmg: 10, embers: 0, glass: 0, phases: [0.66, 0.33],
    eyes: [[12, -9, 2.6], [12, 9, 2.6]], eyeColor: '120,220,255',
    init: bossInit,
    update(e, g, dt) {
      const p = g.player, ph = e.phase;
      e.t -= dt; e.spin += dt;
      updateTel(e, g, dt);
      if (phaseShift(e, g)) { e.state = 'idle'; e.t = 1.2; e.z = 0; e.intangible = false; e.tel.length = 0; }
      const toP = Math.atan2(p.y - e.y, p.x - e.x);
      e.face = LF.turnToward(e.face, toP, 2.5 * dt);
      switch (e.state) {
        case 'intro': if (e.t <= 0) { e.state = 'idle'; e.t = 0.8; } break;
        case 'idle': {
          const d = LF.dist(e.x, e.y, p.x, p.y);
          if (d > 120) { e.x += Math.cos(toP) * e.speed * dt; e.y += Math.sin(toP) * e.speed * dt; g.map.resolveCircle(e, e.r * 0.6); }
          if (e.t <= 0) {
            const opts = ['toll', 'slam', 'toll'];
            if (minions(g) < 4) opts.push('summon');
            if (ph >= 3) opts.push('undertow', 'undertow');
            e.state = pickAttack(e, opts);
            if (e.state === 'toll') { e.t = 0.8; e.count = ph; e.sub = 0; LF.audio.play('charge'); }
            else if (e.state === 'slam') { e.count = ph === 1 ? 1 : ph === 2 ? 2 : 3; e.t = 0.2; e.sub = 0; }
            else if (e.state === 'summon') { e.t = 0.9; LF.audio.play('telegraph'); }
            else if (e.state === 'undertow') { e.t = 3.4; e.sub = 0; LF.audio.play('charge'); }
          }
          break;
        }
        case 'toll':
          e.red = 1;
          if (e.t <= 0) {
            LF.audio.play('bell'); g.shake(7);
            const n = 22 + ph * 4;
            ring(g, e.x, e.y, n, 150 + ph * 12, e.dmg * 0.75, e.spin * 0.7 + e.sub * 0.14, { gapEvery: ph === 1 ? 6 : 7, gapSize: 2, color: '#6fd0ff' });
            fx.ring(e.x, e.y, e.r, e.r * 4, 0.5, '#6fd0ff', 5); e.flash = 0.6;
            e.sub++;
            if (--e.count > 0) e.t = 0.55; else { e.state = 'idle'; e.t = ph === 3 ? 0.8 : 1.3; }
          }
          break;
        case 'slam':
          if (e.sub === 0 && e.t <= 0) {
            // rise
            e.sub = 1; e.t = 0.85; e.tx = p.x + p.vx * 0.3; e.ty = p.y + p.vy * 0.3;
            const o = g.map.nearestOpen(e.tx, e.ty); e.tx = o.x; e.ty = o.y;
            telegraph(e, e.tx, e.ty, 78, 0.85, () => {});
            LF.audio.play('telegraph'); e.intangible = true;
          } else if (e.sub === 1) {
            e.z = Math.sin((1 - e.t / 0.85) * Math.PI) * 1;
            e.x = LF.lerp(e.x, e.tx, Math.min(1, dt * 5)); e.y = LF.lerp(e.y, e.ty, Math.min(1, dt * 5));
            if (e.t <= 0) {
              e.x = e.tx; e.y = e.ty; e.z = 0; e.intangible = false;
              blast(g, e.x, e.y, 82, e.dmg * 1.35, 'the Fallen Bell', '#6fd0ff');
              LF.audio.play('bell');
              ring(g, e.x, e.y, 10 + ph * 2, 135, e.dmg * 0.7, Math.random() * TAU, { color: '#6fd0ff' });
              if (--e.count > 0) { e.sub = 0; e.t = 0.35; } else { e.state = 'idle'; e.t = 1.2; }
            }
          }
          break;
        case 'summon':
          e.red = 1;
          if (e.t <= 0) {
            const n = 2 + ph;
            for (let i = 0; i < n; i++) { const pt = arenaPoint(g); g.spawnEnemy(i === 0 && ph >= 2 ? 'lurker' : 'skitter', pt.x, pt.y, { awake: true, spawnT: 0.8, room: 0, noDrops: i > 1 }); }
            LF.audio.play('spawn'); e.state = 'idle'; e.t = 1.4;
          }
          break;
        case 'undertow':
          e.red = 1; e.sub -= dt;
          if (e.sub <= 0) {
            e.sub = 0.11;
            for (let k = 0; k < 3; k++) g.fireEnemyBullet({ x: e.x, y: e.y, angle: e.spin * 1.7 + k * TAU / 3, speed: 165, dmg: e.dmg * 0.7, color: '#6fd0ff', size: 5 });
            LF.audio.play('spit');
          }
          if (e.t <= 0) { e.state = 'idle'; e.t = 1.6; }
          break;
      }
    },
    draw(e, ctx, g) {
      if (e.tel) drawTel(e, ctx, g);
      const time = (g && g.time) || 0, ph = e.maxHp > 0 ? phaseOf(e) : (e.phase || 1), r = e.r || 34;
      const z = e.z || 0, sc = 1 + z * 0.35, toll = e.state === 'toll', wind = toll ? Math.max(0, 1 - (e.t || 0) / 0.8) : 0;
      const sway = Math.sin(time * (toll ? 26 : 1.6)) * (toll ? 3 : 1.5), hit = e.flash > 0.6;
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + r * 0.5, r * (1.1 - z * 0.3), r * 0.5, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(e.x + sway, e.y - z * 60); ctx.rotate((e.face || 0) + Math.sin(time * 2) * 0.025 + wind * 0.08); ctx.scale(sc * r / 34, sc * r / 34);
      // Broken suspension chain, cast shoulder and heavy flared lip.
      ctx.strokeStyle = hit ? '#fff' : (e.lit ? '#554338' : '#201a19'); ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(-28 - i * 6, 10 + i * 3 + Math.sin(time * 2 + i) * 2, 5, i % 2 ? 2.5 : 4, -0.5, i === 3 ? 0.7 : 0, i === 3 ? 5.5 : TAU); ctx.stroke(); }
      ctx.fillStyle = hit ? '#fff' : (e.lit ? '#39302a' : '#161316'); ctx.beginPath(); ctx.ellipse(5, 0, 31, 35, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = hit ? '#fff' : (e.lit ? '#6b5140' : '#302321'); ctx.lineWidth = 5; ctx.stroke();
      ctx.fillStyle = hit ? '#fff' : (e.lit ? '#241e1d' : '#0d0b10'); ctx.beginPath(); ctx.ellipse(-6, -1, 26, 29, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = hit ? '#fff' : (e.lit ? '#514033' : '#241b1c'); ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-10, -1, 16, 21, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = hit ? '#fff' : '#171216'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(12, 0, 20, 29, 0, -1.3, 1.3); ctx.stroke();
      // Crown lugs and the snapped hanging loop.
      ctx.fillStyle = hit ? '#fff' : (e.lit ? '#514137' : '#231c1d');
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(-18, s * 11, 7, 5, s * 0.5, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = hit ? '#fff' : (e.lit ? '#775743' : '#3b2825'); ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(-22, 0, 9, 7, 0, 0.5, 5.6); ctx.stroke();
      // The clapper rolls forward as the bell prepares to toll.
      ctx.save(); ctx.translate(1, 0); ctx.rotate(Math.sin(time * (toll ? 16 : 2.2)) * (toll ? 0.5 : 0.12));
      ctx.strokeStyle = hit ? '#fff' : '#48332c'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(25 + wind * 9, 0); ctx.stroke();
      ctx.fillStyle = hit ? '#fff' : (e.lit ? '#6b4337' : '#302022'); ctx.beginPath(); ctx.ellipse(29 + wind * 9, 0, 8, 6, 0, 0, TAU); ctx.fill(); ctx.restore();
      ctx.strokeStyle = '#08060a'; ctx.lineWidth = 2 + ph * 1.6; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(-2, -29); ctx.lineTo(9, -18); ctx.lineTo(5, -6); ctx.lineTo(18, 7); ctx.lineTo(20, 30); ctx.stroke();
      if (ph >= 2) { ctx.beginPath(); ctx.moveTo(5, -6); ctx.lineTo(-6, 4); ctx.lineTo(-14, 20); ctx.stroke(); }
      if (ph >= 3) { ctx.fillStyle = '#060509'; ctx.beginPath(); ctx.moveTo(19, 35); ctx.lineTo(12, 22); ctx.lineTo(28, 23); ctx.lineTo(32, 31); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    },
    drawGlow(e, ctx, g) {
      const time = (g && g.time) || 0, ph = e.maxHp > 0 ? phaseOf(e) : (e.phase || 1), r = e.r || 34, z = e.z || 0, toll = e.state === 'toll';
      const pulse = 0.6 + 0.18 * Math.sin(time * (3 + ph)) + (toll ? 0.2 : 0), sway = Math.sin(time * (toll ? 26 : 1.6)) * (toll ? 3 : 1.5);
      const wind = toll ? Math.max(0, 1 - (e.t || 0) / 0.8) : 0, sc = (1 + z * 0.35) * r / 34;
      ctx.save(); ctx.translate(e.x + sway, e.y - z * 60); ctx.rotate((e.face || 0) + Math.sin(time * 2) * 0.025 + wind * 0.08); ctx.scale(sc, sc);
      ctx.strokeStyle = 'rgba(238,65,57,' + pulse + ')'; ctx.lineWidth = 0.8 + ph * 0.7; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(-2, -29); ctx.lineTo(9, -18); ctx.lineTo(5, -6); ctx.lineTo(18, 7); ctx.lineTo(20, 30); ctx.stroke();
      if (ph >= 2) { ctx.beginPath(); ctx.moveTo(5, -6); ctx.lineTo(-6, 4); ctx.lineTo(-14, 20); ctx.stroke(); }
      if (ph >= 3) { ctx.beginPath(); ctx.moveTo(9, -18); ctx.lineTo(22, -20); ctx.lineTo(29, -13); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(177,48,43,0.25)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(5, 0, 33, 35, 0, -1.1, 1.3); ctx.stroke(); ctx.restore();
      LF.drawGlow(ctx, '#dd3939', e.x + sway, e.y - z * 60, r * 1.3, 0.09 * pulse);
      if (e.state === 'undertow') LF.drawGlow(ctx, '#f14949', e.x, e.y - z * 60, r * 2.2, 0.18);
    },
    light(e, lc, white) { lc.globalAlpha = 0.5; lc.drawImage(white, e.x - 90, e.y - 90, 180, 180); },
  };

  // =====================================================================================
  // 2. MOTHER OF MOTHS
  // =====================================================================================
  DEFS.mother = {
    name: 'Mother of Moths', title: 'Every flame is hers to drink', boss: true,
    hp: 1950, speed: 150, r: 28, dmg: 9.5, embers: 0, glass: 0, phases: [0.66, 0.33], flies: true, ghost: true,
    eyes: [[9, -6, 2.2], [9, 6, 2.2]], eyeColor: '255,205,120',
    init(e, g) { bossInit(e); e.wx = e.x; e.wy = e.y; e.gustT = 9; },
    // she is only truly hurt while something lights her
    modDamage(e, dmg, src, g) {
      if (src.noShroud) return dmg;
      if (!e.lit) { src.blocked = true; if (Math.random() < 0.25) fx.text(e.x, e.y - e.r - 18, 'SHROUDED', '#8d86a8', 9, 0.5); return dmg * 0.3; }
      return dmg;
    },
    update(e, g, dt) {
      const p = g.player, ph = e.phase;
      e.t -= dt; e.spin += dt; e.gustT -= dt;
      updateTel(e, g, dt);
      if (phaseShift(e, g)) { e.state = 'idle'; e.t = 1.0; }
      const toP = Math.atan2(p.y - e.y, p.x - e.x);
      if (e.state !== 'swoop') e.face = LF.turnToward(e.face, toP, 5 * dt);
      const flyTo = (x, y, sp) => { const dx = x - e.x, dy = y - e.y, l = Math.hypot(dx, dy); if (l > 4) { e.x += dx / l * Math.min(l, sp * dt); e.y += dy / l * Math.min(l, sp * dt); } return l; };
      // she drinks a brazier now and then
      if (e.gustT <= 0 && e.state === 'idle') {
        const lit = g.props.filter(pr => pr.kind === 'brazier' && pr.lit && pr.room === 0);
        e.gustT = ph === 3 ? 7 : 10;
        if (lit.length) {
          const b = LF.pick(lit);
          b.lit = false; g.litBraziers = g.props.filter(q => q.kind === 'brazier' && q.lit);
          fx.arc(e.x, e.y, b.x, b.y - 8, '#ffcf8a', 0.4, 5, 'tendril');
          fx.burst(b.x, b.y - 8, 18, { color: ['#3a2d55', '#1a1030'], glow: false, speed1: 120, life: 0.8, size: 5 });
          LF.audio.play('steal'); fx.text(b.x, b.y - 30, 'SNUFFED', '#b89cff', 11, 1);
          e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.015);
        }
      }
      switch (e.state) {
        case 'intro': if (e.t <= 0) { e.state = 'idle'; e.t = 0.6; } break;
        case 'idle': {
          if (flyTo(e.wx, e.wy, e.speed) < 8 || Math.random() < dt * 0.4) { const pt = arenaPoint(g, 4); e.wx = pt.x; e.wy = pt.y; }
          e.y += Math.sin(e.spin * 5) * 12 * dt;
          if (e.t <= 0) {
            const opts = ['fan', 'swoop', 'fan'];
            if (minions(g) < 7) opts.push('swarm');
            if (ph >= 2) opts.push('spiral');
            if (ph >= 3) opts.push('swoop', 'spiral');
            e.state = pickAttack(e, opts);
            if (e.state === 'fan') { e.count = 2 + ph; e.t = 0.4; }
            else if (e.state === 'swarm') { e.t = 0.7; LF.audio.play('telegraph'); }
            else if (e.state === 'swoop') { e.count = ph; e.sub = 0; e.t = 0; }
            else if (e.state === 'spiral') { e.t = 2.6 + ph * 0.3; e.sub = 0; const c = arena(g); e.wx = c.cx * TILE; e.wy = c.cy * TILE; LF.audio.play('charge'); }
          }
          break;
        }
        case 'fan':
          e.red = 1;
          if (e.t <= 0) {
            const n = 5 + ph;
            for (let i = 0; i < n; i++) g.fireEnemyBullet({ x: e.x, y: e.y, angle: toP + (i - (n - 1) / 2) * 0.19, speed: 190 + (e.count % 2) * 40, dmg: e.dmg * 0.75, color: '#ffcf8a', size: 5 });
            LF.audio.play('spit'); e.flash = 0.3;
            if (--e.count > 0) e.t = 0.42; else { e.state = 'idle'; e.t = 1.1; }
          }
          break;
        case 'swarm':
          e.red = 1;
          if (e.t <= 0) {
            const n = 3 + ph * 2;
            for (let i = 0; i < n; i++) { const a = Math.random() * TAU; g.spawnEnemy('moth', e.x + Math.cos(a) * 30, e.y + Math.sin(a) * 30, { awake: true, spawnT: 0.3, room: 0, noDrops: Math.random() < 0.5 }); }
            LF.audio.play('spawn'); e.state = 'idle'; e.t = 1.3;
          }
          break;
        case 'swoop':
          if (e.sub === 0) {
            // pick a line through the player and warn along it
            e.sa = toP; e.sub = 1; e.t = 0.75;
            e.sx = e.x; e.sy = e.y; e.ex = e.x + Math.cos(e.sa) * 520; e.ey = e.y + Math.sin(e.sa) * 520;
            LF.audio.play('telegraph'); e.red = 1;
          } else if (e.sub === 1) {
            e.red = 1; e.face = e.sa;
            if (e.t <= 0) { e.sub = 2; e.t = 0.55; LF.audio.play('lunge'); e.dropT = 0; }
          } else if (e.sub === 2) {
            e.red = 1;
            e.x += Math.cos(e.sa) * 900 * dt; e.y += Math.sin(e.sa) * 900 * dt;
            clampToArena(g, e);
            e.dropT -= dt;
            if (ph >= 2 && e.dropT <= 0) { e.dropT = 0.07; g.fireEnemyBullet({ x: e.x, y: e.y, angle: e.sa + Math.PI / 2 * (Math.random() < 0.5 ? 1 : -1), speed: 40, dmg: e.dmg * 0.7, color: '#ffcf8a', life: 2.4, size: 5 }); }
            if (Math.random() < 0.9) fx.spawn({ x: e.x, y: e.y, life: 0.5, size: 8, color: '#2b2140', glow: false });
            if (e.t <= 0) { if (--e.count > 0) { e.sub = 0; e.t = 0.25; } else { e.state = 'idle'; e.t = 1.0; } }
          }
          break;
        case 'spiral':
          flyTo(e.wx, e.wy, e.speed * 1.4);
          e.red = 1; e.sub -= dt;
          if (e.sub <= 0) {
            e.sub = 0.115;
            const arms = ph === 3 ? 4 : 3;
            for (let k = 0; k < arms; k++) g.fireEnemyBullet({ x: e.x, y: e.y, angle: e.spin * 1.5 + k * TAU / arms, speed: 150, dmg: e.dmg * 0.7, color: '#ffcf8a', size: 5, spin: 0.35 });
          }
          if (e.t <= 0) { e.state = 'idle'; e.t = 1.5; }
          break;
      }
    },
    draw(e, ctx, g) {
      if (e.tel) drawTel(e, ctx, g);
      if (e.state === 'swoop' && e.sub === 1) {
        const k = 1 - (e.t || 0) / 0.75;
        ctx.strokeStyle = `rgba(255,90,90,${0.25 + 0.4 * k})`; ctx.lineWidth = 44; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(e.sx === undefined ? e.x : e.sx, e.sy === undefined ? e.y : e.sy); ctx.lineTo(e.ex === undefined ? e.x : e.ex, e.ey === undefined ? e.y : e.ey); ctx.stroke();
      }
      const time = (g && g.time) || 0, ph = e.maxHp > 0 ? phaseOf(e) : (e.phase || 1), r = e.r || 28, hit = e.flash > 0.6;
      const attack = e.state === 'swoop' || e.state === 'fan' || e.state === 'swarm' || e.state === 'spiral', flap = 0.64 + 0.3 * Math.sin(time * (attack ? 14 + ph : 3 + ph * 0.4) + (e.wob || 0));
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + 34, r * 1.2, r * 0.4, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.face || 0); ctx.scale(r / 28, r / 28);
      for (const s of [-1, 1]) {
        ctx.save(); ctx.scale(1, s * flap);
        // Forewing and hindwing have separate torn scalloped edges.
        ctx.fillStyle = hit ? '#fff' : (e.lit ? '#302532' : '#120d18'); ctx.strokeStyle = e.lit ? '#5c3542' : '#281b2c'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(12, 3); ctx.quadraticCurveTo(38, 21, 14, 52); ctx.lineTo(8, 47); ctx.lineTo(4, ph >= 3 ? 41 : 58); ctx.lineTo(-3, 53); ctx.lineTo(-9, 61); ctx.lineTo(-14, 48); ctx.lineTo(-20, 51); ctx.quadraticCurveTo(-32, 28, -9, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = hit ? '#fff' : (e.lit ? '#241d2b' : '#0d0a13');
        ctx.beginPath(); ctx.moveTo(-9, 4); ctx.quadraticCurveTo(-34, 3, -49, 23); ctx.lineTo(-44, 28); ctx.lineTo(-51, ph >= 2 ? 30 : 40); ctx.lineTo(-40, 39); ctx.lineTo(-39, 46); ctx.lineTo(-29, 40); ctx.lineTo(-23, 44); ctx.quadraticCurveTo(-9, 31, -9, 4); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = hit ? '#fff' : (e.lit ? '#70404a' : '#33202e'); ctx.lineWidth = 0.9;
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(0, 6); ctx.quadraticCurveTo(-14 + i * 8, 21, -15 + i * 9, 46 + Math.sin(i) * 6); ctx.stroke(); }
        ctx.beginPath(); ctx.moveTo(-12, 7); ctx.lineTo(-39, 31); ctx.moveTo(-19, 15); ctx.lineTo(-29, 36); ctx.stroke();
        // Soot eyespots with a red split pupil.
        for (const spot of [[-5, 34, 9], [-33, 25, 6]]) {
          ctx.fillStyle = hit ? '#fff' : (e.lit ? '#594249' : '#271b28'); ctx.beginPath(); ctx.ellipse(spot[0], spot[1], spot[2], spot[2] * 1.25, -0.25, 0, TAU); ctx.fill();
          ctx.fillStyle = '#09070e'; ctx.beginPath(); ctx.ellipse(spot[0], spot[1], spot[2] * 0.65, spot[2] * 0.9, -0.25, 0, TAU); ctx.fill();
          ctx.strokeStyle = '#81353f'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(spot[0], spot[1] - 4); ctx.lineTo(spot[0] + 1, spot[1] + 4); ctx.stroke();
        }
        if (ph >= 2) { ctx.strokeStyle = '#a73c47'; ctx.lineWidth = ph === 3 ? 2 : 1; ctx.beginPath(); ctx.moveTo(-11, 14); ctx.lineTo(-16, 26); ctx.lineTo(-13, 42); ctx.stroke(); }
        ctx.restore();
      }
      // Furred thorax, segmented abdomen and combed antennae.
      ctx.strokeStyle = hit ? '#fff' : (e.lit ? '#4c3947' : '#21182a'); ctx.lineWidth = 1.8;
      for (let i = 0; i < 11; i++) { const x = -24 + i * 4; ctx.beginPath(); ctx.moveTo(x, -4); ctx.lineTo(x - 3, -10 - Math.sin(i) * 2); ctx.moveTo(x, 4); ctx.lineTo(x - 3, 10 + Math.sin(i) * 2); ctx.stroke(); }
      ctx.fillStyle = hit ? '#fff' : (e.lit ? '#1d1623' : '#08060f'); ctx.beginPath(); ctx.ellipse(-5, 0, 23, 8, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = e.lit ? '#4d303d' : '#251728'; ctx.lineWidth = 1.4;
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(-21 + i * 6, 0, 2, 6, 0, -1.4, 1.4); ctx.stroke(); }
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(13, s * 3); ctx.quadraticCurveTo(24, s * 9, 29, s * 23); ctx.stroke(); for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(18 + i * 2, s * (6 + i * 3)); ctx.lineTo(24 + i * 2, s * (5 + i * 3)); ctx.stroke(); } }
      // Falling dust is painted, never spawned.
      ctx.fillStyle = e.lit ? 'rgba(133,96,109,0.4)' : 'rgba(64,40,60,0.25)';
      for (let i = 0; i < 10; i++) { const d = (time * 0.4 + i * 0.37) % 1; ctx.fillRect(-35 + i * 7 - d * 6, (i % 2 ? 1 : -1) * (34 * flap + d * 23), 1.5, 2); }
      ctx.restore();
    },
    drawGlow(e, ctx, g) {
      const time = (g && g.time) || 0, ph = e.maxHp > 0 ? phaseOf(e) : (e.phase || 1), r = e.r || 28;
      const attack = e.state === 'swoop' || e.state === 'fan' || e.state === 'swarm' || e.state === 'spiral', flap = 0.64 + 0.3 * Math.sin(time * (attack ? 14 + ph : 3 + ph * 0.4) + (e.wob || 0)), a = e.lit ? 0.7 : 0.2;
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.face || 0); ctx.scale(r / 28, r / 28);
      for (const s of [-1, 1]) {
        ctx.save(); ctx.scale(1, s * flap);
        for (const spot of [[-5, 34, 9], [-33, 25, 6]]) { ctx.strokeStyle = 'rgba(231,87,96,' + a + ')'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(spot[0], spot[1], spot[2] * 0.75, spot[2], -0.25, 0, TAU); ctx.stroke(); }
        if (ph >= 2) { ctx.strokeStyle = 'rgba(241,62,77,' + a * 0.7 + ')'; ctx.lineWidth = ph === 3 ? 1.5 : 0.7; ctx.beginPath(); ctx.moveTo(-11, 14); ctx.lineTo(-16, 26); ctx.lineTo(-13, 42); ctx.stroke(); }
        ctx.restore();
      }
      ctx.restore();
      if (!e.lit) { ctx.strokeStyle = 'rgba(140,110,200,0.35)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.arc(e.x, e.y, r + 22, time, time + TAU); ctx.stroke(); ctx.setLineDash([]); }
    },
  };

  // =====================================================================================
  // 3. THE ECLIPSE
  // =====================================================================================
  DEFS.eclipse = {
    name: 'The Eclipse', title: 'The dark that closed around the fallen Lantern', boss: true,
    hp: 4400, speed: 26, r: 40, dmg: 14, embers: 0, glass: 0, phases: [0.66, 0.33], flies: true, ghost: true,
    eyes: null,
    init(e, g) { bossInit(e); e.totalT = 14; e.total = 0; e.cx = e.x; e.cy = e.y; },
    update(e, g, dt) {
      const p = g.player, ph = e.phase;
      e.t -= dt; e.spin += dt; e.totalT -= dt;
      updateTel(e, g, dt);
      if (phaseShift(e, g)) { e.state = 'idle'; e.t = 1.2; e.beams.length = 0; }
      // drift around the arena centre
      const c = arena(g), hx = c.cx * TILE + Math.cos(e.spin * 0.23) * 110, hy = (c.cy - 1) * TILE + Math.sin(e.spin * 0.31) * 60;
      e.x += (hx - e.x) * Math.min(1, dt * 0.8); e.y += (hy - e.y) * Math.min(1, dt * 0.8);
      const toP = Math.atan2(p.y - e.y, p.x - e.x);
      // Totality: the whole hall dims
      if (e.total > 0) {
        e.total -= dt; g.snuffCount += ph >= 3 ? 2 : 1;
        if (e.total <= 0) { fx.ring(e.x, e.y, e.r, 500, 0.8, '#fff2cc', 4); }
      } else if (e.totalT <= 0 && e.state === 'idle') {
        e.totalT = 20 - ph * 2; e.total = 6.5;
        LF.audio.play('roar'); g.shake(8);
        g.banner = { text: 'Totality', sub: 'Your light gutters', t: 0, dur: 1.8, small: true, boss: true };
        if (minions(g) < 5) for (let i = 0; i < 1 + ph; i++) { const pt = arenaPoint(g); g.spawnEnemy(i % 2 ? 'wraith' : 'skitter', pt.x, pt.y, { awake: true, spawnT: 0.8, room: 0, noDrops: i > 0 }); }
      }
      // beams
      for (const b of e.beams) {
        b.t -= dt; b.a += (b.rot || 0) * dt;
        if (b.state === 'warn' && b.t <= 0) { b.state = 'fire'; b.t = b.dur; LF.audio.play('beam'); g.shake(4); }
        else if (b.state === 'fire') {
          const dx = Math.cos(b.a), dy = Math.sin(b.a);
          const px = p.x - e.x, py = p.y - e.y, along = px * dx + py * dy, perp = Math.abs(px * dy - py * dx);
          if (along > 0 && along < b.len && perp < b.w / 2 + p.r - 3 && p.dashing <= 0 && !p.dead) g.hurtPlayer(e.dmg * 1.3, { x: p.x - dy * 10, y: p.y + dx * 10, name: 'the Eclipse' });
          if (b.t <= 0) b.dead = true;
        }
      }
      LF.compact(e.beams);

      switch (e.state) {
        case 'intro': if (e.t <= 0) { e.state = 'idle'; e.t = 0.8; } break;
        case 'idle':
          if (e.t <= 0) {
            const opts = ['corona', 'lances', 'stars'];
            if (ph >= 2) opts.push('sweep', 'corona');
            if (ph >= 3) opts.push('maw', 'maw');
            e.state = pickAttack(e, opts);
            if (e.state === 'corona') { e.count = 3 + ph; e.t = 0.5; e.sub = Math.random() * TAU; LF.audio.play('charge'); }
            else if (e.state === 'lances') { e.count = ph; e.t = 0.1; }
            else if (e.state === 'stars') { e.count = 5 + ph * 2; e.t = 0.1; }
            else if (e.state === 'sweep') {
              const dir = Math.random() < 0.5 ? 1 : -1, n = ph === 3 ? 3 : 2;
              for (let i = 0; i < n; i++) e.beams.push({ a: toP + Math.PI * 0.5 * dir + i * TAU / n, t: 1.0, dur: 2.8, state: 'warn', w: 26, len: 900, rot: 0.75 * dir });
              LF.audio.play('telegraph'); e.t = 4.2;
            } else if (e.state === 'maw') { e.t = 4.5; e.sub = 0; LF.audio.play('roar'); }
          }
          break;
        case 'corona':
          if (e.t <= 0) {
            const n = 26 + ph * 4;
            e.sub += 0.21;
            ring(g, e.x, e.y, n, 125 + ph * 10, e.dmg * 0.7, e.sub, { gapEvery: Math.floor(n / 3), gapSize: 3, color: '#ffb36b', size: 5 });
            LF.audio.play('spit'); fx.ring(e.x, e.y, e.r, e.r * 2.6, 0.35, '#ffb36b', 3);
            if (--e.count > 0) e.t = 0.6; else { e.state = 'idle'; e.t = 1.2; }
          }
          break;
        case 'lances':
          if (e.t <= 0) {
            const n = 3 + ph, base = toP + LF.rand(-0.15, 0.15);
            for (let i = 0; i < n; i++) e.beams.push({ a: base + (i - (n - 1) / 2) * 0.5, t: 0.85, dur: 0.4, state: 'warn', w: 24, len: 900 });
            LF.audio.play('telegraph');
            if (--e.count > 0) e.t = 1.35; else { e.state = 'idle'; e.t = 1.9; }
          }
          break;
        case 'stars':
          if (e.t <= 0) {
            const a = Math.random() * TAU, d = Math.random() < 0.4 ? 0 : LF.rand(40, 170);
            const o = g.map.nearestOpen(p.x + Math.cos(a) * d + p.vx * 0.4, p.y + Math.sin(a) * d + p.vy * 0.4);
            telegraph(e, o.x, o.y, 50, 0.95, t => { blast(g, t.x, t.y, 52, e.dmg * 1.2, 'a falling shard', '#ffb36b'); fx.arc(t.x + LF.rand(-40, 40), t.y - 300, t.x, t.y, '#ffd9a0', 0.25, 5, 'beam'); }, '255,170,90');
            if (--e.count > 0) e.t = 0.22; else { e.state = 'idle'; e.t = 1.6; }
          }
          break;
        case 'sweep': if (e.t <= 0) { e.state = 'idle'; e.t = 1.0; } break;
        case 'maw': {
          // the black sun pulls you in while it sheds a spiral
          const d = LF.dist(e.x, e.y, p.x, p.y) || 1;
          if (!p.dead && p.dashing <= 0) { const pull = 58; p.x += (e.x - p.x) / d * pull * dt; p.y += (e.y - p.y) / d * pull * dt; g.map.resolveCircle(p, p.r); }
          e.sub -= dt;
          if (e.sub <= 0) {
            e.sub = 0.1;
            for (let k = 0; k < 4; k++) g.fireEnemyBullet({ x: e.x, y: e.y, angle: -e.spin * 1.3 + k * TAU / 4, speed: 140, dmg: e.dmg * 0.7, color: '#ff7b7b', size: 5 });
          }
          if (Math.random() < dt * 30) { const a = Math.random() * TAU, r = LF.rand(120, 320); fx.spawn({ x: e.x + Math.cos(a) * r, y: e.y + Math.sin(a) * r, vx: -Math.cos(a) * 240, vy: -Math.sin(a) * 240, life: 0.6, size: 2, color: '#ff9a7b', drag: 0 }); }
          if (e.t <= 0) { e.state = 'idle'; e.t = 1.8; }
          break;
        }
      }
    },
    draw(e, ctx, g) {
      if (e.tel) drawTel(e, ctx, g);
      const time = (g && g.time) || 0, ph = e.maxHp > 0 ? phaseOf(e) : (e.phase || 1), r = e.r || 40, total = e.total > 0, hit = e.flash > 0.6;
      const coil = e.state === 'maw' ? 1.12 : e.state === 'lances' || e.state === 'sweep' || e.state === 'corona' ? 1 + 0.1 * (0.5 + 0.5 * Math.sin(time * 5)) : 1;
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + 54, r, r * 0.3, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(e.x, e.y);
      // A writhing mantle grows out of the disc rather than shining from it.
      for (let i = 0; i < 14; i++) {
        const a = i * TAU / 14 + time * 0.12, wave = Math.sin(time * (1.1 + ph * 0.3) + i * 1.9), len = r * (total ? 1.85 : 1.3 + wave * 0.13) * coil;
        ctx.save(); ctx.rotate(a); ctx.fillStyle = hit ? '#fff' : (e.lit ? '#1b121e' : '#08060e');
        ctx.beginPath(); ctx.moveTo(r * 0.8, -7); ctx.bezierCurveTo(r * 1.22, -14, len, wave * 16, len, wave * 10); ctx.bezierCurveTo(r * 1.2, wave * 3, r, 5, r * 0.8, 7); ctx.fill(); ctx.restore();
      }
      // Small dark glass fragments orbit in a broken, uneven ring.
      for (let i = 0; i < 9; i++) {
        const a = i * TAU / 9 - time * (0.18 + ph * 0.04), d = r * (1.34 + Math.sin(time + i) * 0.07);
        ctx.save(); ctx.translate(Math.cos(a) * d, Math.sin(a) * d); ctx.rotate(a + time * 0.24);
        ctx.fillStyle = hit ? '#fff' : (e.lit ? '#38212c' : '#140c17'); ctx.strokeStyle = e.lit ? '#74333d' : '#381923'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(-3, -6); ctx.lineTo(4, -3); ctx.lineTo(2, 7); ctx.lineTo(-4, 2); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      }
      ctx.fillStyle = hit ? '#fff' : '#000'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = e.lit ? '#4c1827' : '#230d18'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
    },
    drawGlow(e, ctx, g) {
      const time = (g && g.time) || 0, ph = e.maxHp > 0 ? phaseOf(e) : (e.phase || 1), r = e.r || 40;
      ctx.save();
      // beams
      for (const b of (e.beams || [])) {
        const dx = Math.cos(b.a), dy = Math.sin(b.a);
        if (b.state === 'warn') {
          ctx.strokeStyle = 'rgba(255,90,90,0.55)'; ctx.lineWidth = 2; ctx.setLineDash([10, 8]);
          ctx.beginPath(); ctx.moveTo(e.x + dx * e.r, e.y + dy * e.r); ctx.lineTo(e.x + dx * b.len, e.y + dy * b.len); ctx.stroke(); ctx.setLineDash([]);
          ctx.strokeStyle = 'rgba(255,90,90,0.10)'; ctx.lineWidth = b.w; ctx.beginPath(); ctx.moveTo(e.x + dx * e.r, e.y + dy * e.r); ctx.lineTo(e.x + dx * b.len, e.y + dy * b.len); ctx.stroke();
        } else {
          const w = b.w * (0.8 + Math.sin(time * 50) * 0.15);
          ctx.lineCap = 'round';
          ctx.strokeStyle = 'rgba(255,120,60,0.55)'; ctx.lineWidth = w * 1.6; ctx.beginPath(); ctx.moveTo(e.x + dx * e.r, e.y + dy * e.r); ctx.lineTo(e.x + dx * b.len, e.y + dy * b.len); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,240,210,0.95)'; ctx.lineWidth = w * 0.55; ctx.stroke();
        }
      }
      const pulse = 0.7 + Math.sin(time * (2 + ph)) * 0.12, total = e.total > 0;
      LF.drawGlow(ctx, '#c42d49', e.x, e.y, r * (total ? 3.5 : 1.8), total ? 0.2 : 0.12);
      ctx.strokeStyle = 'rgba(228,59,82,' + pulse * 0.55 + ')'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(e.x, e.y, r + 1.5, 0, TAU); ctx.stroke();
      for (let i = 0; i < 14; i++) {
        const a = i * TAU / 14 + time * 0.12, wave = Math.sin(time * (1.1 + ph * 0.3) + i * 1.9), len = r * (total ? 1.85 : 1.3 + wave * 0.13);
        ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(a); ctx.strokeStyle = 'rgba(167,35,62,0.24)'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(r + 2, -3); ctx.quadraticCurveTo(r * 1.3, wave * 6 - 4, len, wave * 10); ctx.stroke(); ctx.restore();
      }
      // Keep the heart and totality black after the additive corona.
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = e.flash > 0.6 ? '#fff' : '#000'; ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, TAU); ctx.fill();
      if (e.total > 0) { ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.arc(e.x, e.y, 900, 0, TAU); ctx.fill(); }
      ctx.globalCompositeOperation = 'lighter';
      if (ph >= 2) {
        ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.face || 0);
        const open = ph === 3 ? 0.5 + Math.sin(time * 2) * 0.06 : 0.15 + Math.sin(time) * 0.025;
        ctx.strokeStyle = 'rgba(207,36,67,' + (ph === 3 ? 0.65 : 0.38) + ')'; ctx.lineWidth = ph === 3 ? 2 : 1;
        ctx.beginPath(); ctx.moveTo(12, -r * 0.55); ctx.bezierCurveTo(12 + r * open, -r * 0.2, 12 + r * open, r * 0.2, 12, r * 0.55); ctx.bezierCurveTo(12 - r * open, r * 0.2, 12 - r * open, -r * 0.2, 12, -r * 0.55); ctx.stroke();
        ctx.strokeStyle = 'rgba(251,66,83,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(12, -r * 0.25); ctx.lineTo(12, r * 0.25); ctx.stroke();
        if (ph === 3) { ctx.beginPath(); ctx.moveTo(-r, -5); ctx.lineTo(-r * 0.6, -9); ctx.lineTo(-r * 0.38, -2); ctx.moveTo(-r * 0.3, r * 0.9); ctx.lineTo(-r * 0.18, r * 0.6); ctx.lineTo(0, r * 0.5); ctx.stroke(); }
        ctx.restore();
      }
      ctx.restore();
    },
    light(e, lc, white) { lc.globalAlpha = 0.7; lc.drawImage(white, e.x - 130, e.y - 130, 260, 260); },
  };
})();
