'use strict';
// The last Depth's great shadows: the Weeping Glass (Level 3), the Last Keeper (Level 6) and the Unwritten
// (Level 9, in front of the Great Lantern).
(function () {
  const fx = LF.fx, TAU = LF.TAU, TILE = LF.TILE, DEFS = LF.ENEMY_DEFS, B = LF.BH;

  // ---------- small shared helpers ----------
  function hurtIfNear(g, x, y, r, dmg, name) {
    const p = g.player;
    if (p.dead || p.dashing > 0 || p.invuln > 0) return false;
    if (LF.dist(p.x, p.y, x, y) < r + p.r - 3) { g.hurtPlayer(dmg, { x, y, name }); return true; }
    return false;
  }
  // how far a point is from a segment, and the nearest point on it (kept in NEAR, so nothing is allocated)
  const NEAR = { x: 0, y: 0 };
  function segDist(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy || 1;
    let k = ((px - x1) * dx + (py - y1) * dy) / l2; k = k < 0 ? 0 : k > 1 ? 1 : k;
    NEAR.x = x1 + dx * k; NEAR.y = y1 + dy * k;
    return Math.hypot(px - NEAR.x, py - NEAR.y);
  }
  function hurtOnSeg(g, s, w, dmg, name) {
    const p = g.player;
    if (p.dead || p.dashing > 0 || p.invuln > 0) return false;
    if (segDist(p.x, p.y, s[0], s[1], s[2], s[3]) < w + p.r - 3) { g.hurtPlayer(dmg, { x: NEAR.x, y: NEAR.y, name }); return true; }
    return false;
  }
  // the bot keeps out of a line by keeping out of a row of circles along it
  function segHazard(g, s, r) {
    const len = Math.hypot(s[2] - s[0], s[3] - s[1]), n = Math.max(1, Math.ceil(len / 48));
    for (let i = 0; i <= n; i++) g.hazards.push({ x: s[0] + (s[2] - s[0]) * i / n, y: s[1] + (s[3] - s[1]) * i / n, r });
  }
  function rayTo(g, x, y, a, max) {
    const d = g.map.raycast(x, y, Math.cos(a), Math.sin(a), max);
    return [x, y, x + Math.cos(a) * d, y + Math.sin(a) * d];
  }
  // a phase shift with words of its own
  function shift(e, g, ph, text, sub, color) {
    e.phase = ph;
    LF.audio.play('roar'); g.shake(10);
    fx.ring(e.x, e.y, e.r, e.r * 6, 0.7, color || '#e2c9ff', 6);
    for (const b of g.ebullets) b.dead = true;
    g.banner = { text, sub: sub || '', t: 0, dur: 3.2, small: true, boss: true };
  }
  function strokeSeg(ctx, s) { ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); ctx.stroke(); }

  // =====================================================================================
  // THE WEEPING GLASS (Depth VI, Level 3: the Fallen Glass)
  // The Lantern's broken lens. Its tears split as they fall, its beams break into fans through the prisms it
  // throws down, and it shatters into shards that pull themselves back together if they are left alone.
  // =====================================================================================
  const LENS = '#bff3ff', LENS_RGB = '191,243,255';
  // the shards of its body: [x, y, half-width, half-height, turn] around an upright lens
  const BODY = [[0, 8, 9, 26, 0], [-13, 2, 6, 20, -0.35], [13, 2, 6, 20, 0.35], [-22, -6, 5, 14, -0.8], [22, -6, 5, 14, 0.8], [-9, 24, 5, 12, 0.3], [9, 24, 5, 12, -0.3], [-27, 10, 4, 9, -1.2], [27, 10, 4, 9, 1.2]];
  function shardPath(ctx, x, y, w, h, a) {
    const c = Math.cos(a), s = Math.sin(a), pt = (u, v) => [x + u * c - v * s, y + u * s + v * c];
    const q = [pt(0, -h), pt(w, -h * 0.25), pt(w * 0.6, h), pt(-w * 0.7, h * 0.7), pt(-w, -h * 0.4)];
    ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1]); for (let i = 1; i < 5; i++) ctx.lineTo(q[i][0], q[i][1]); ctx.closePath();
  }

  DEFS.glassshard = {
    name: 'Lens Shard', hp: 64, speed: 250, r: 12, dmg: 10, embers: 0, glass: 0.4, contact: false, flies: true, ghost: true, selfLit: true, noBar: true,
    eyes: null,
    init(e) { e.slot = 0; e.cd = LF.rand(1.8, 3); e.boss2 = null; e.spinA = Math.random() * TAU; },
    update(e, g, dt) {
      const b = e.boss2, p = g.player;
      e.spinA += dt * 2.5;
      if (!b || b.dead || !b.shattered) return;
      const a = b.webA + e.slot * TAU / b.shardN, tx = b.webX + Math.cos(a) * b.webR, ty = b.webY + Math.sin(a) * b.webR;
      const dx = tx - e.x, dy = ty - e.y, l = Math.hypot(dx, dy);
      if (l > 1) { const m = Math.min(l, e.speed * dt * e.slowMul(g)); e.x += dx / l * m; e.y += dy / l * m; }
      e.cd -= dt;
      if (e.cd < 0.35) e.red = 1;
      if (e.cd <= 0) {
        e.cd = LF.rand(2.6, 3.6);
        if (!p.dead) { g.fireEnemyBullet({ x: e.x, y: e.y, angle: Math.atan2(p.y - e.y, p.x - e.x), speed: 170, dmg: e.dmg * 0.8, color: LENS, size: 4, ghost: true }); LF.audio.play('spit'); }
      }
    },
    onDeath(e, g, src) {
      const b = e.boss2;
      if (src.type === 'self' || !b || b.dead || !b.shattered) return;
      fx.burst(e.x, e.y, 14, { color: [LENS, '#fff'], speed1: 200, life: 0.45 }); LF.audio.play('crit');
      fx.arc(e.x, e.y, b.x, b.y, LENS, 0.3, 2);
      g.damageEnemy(b, b.maxHp * 0.035, { type: 'shard', force: true, noShroud: true });
    },
    draw(e, ctx, g) {
      const time = (g && g.time) || 0, hit = e.flash > 0.6;
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.spinA || time);
      ctx.fillStyle = hit ? '#fff' : (e.lit ? '#2e4a55' : '#15232a'); ctx.strokeStyle = '#7fc4d4'; ctx.lineWidth = 1.5;
      shardPath(ctx, 0, 0, 7, 13, 0); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(220,250,255,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(1, 6); ctx.stroke();
      ctx.restore();
    },
    drawGlow(e, ctx, g) {
      const time = (g && g.time) || 0;
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.spinA || time);
      ctx.strokeStyle = `rgba(${LENS_RGB},${e.red > 0 ? 0.95 : 0.7})`; ctx.lineWidth = 1.2; shardPath(ctx, 0, 0, 7, 13, 0); ctx.stroke(); ctx.restore();
      LF.drawGlow(ctx, LENS, e.x, e.y, 26, e.red > 0 ? 0.4 : 0.22);
    },
    light(e, lc, white) { lc.globalAlpha = 0.45; lc.drawImage(white, e.x - 50, e.y - 50, 100, 100); },
  };

  function prismBeam(e, g) {
    const p = g.player, segs = [], prisms = [], n = e.phase === 1 ? 2 : 3;
    const fan = e.phase >= 3 ? [-0.62, -0.2, 0.2, 0.62] : [-0.5, 0, 0.5];
    for (let i = 0; i < n; i++) {
      let pt = null;
      if (i === 0) {
        // the first prism stands across your path, so its fan comes your way
        const a = Math.atan2(p.y - e.y, p.x - e.x), d = LF.dist(e.x, e.y, p.x, p.y) * LF.rand(0.4, 0.6), side = LF.rand(-90, 90);
        pt = g.map.nearestOpen(e.x + Math.cos(a) * d - Math.sin(a) * side, e.y + Math.sin(a) * d + Math.cos(a) * side);
        if (LF.dist(pt.x, pt.y, e.x, e.y) < 90) pt = null;
      }
      for (let k = 0; k < 24 && !pt; k++) {
        const c = B.arenaPoint(g, 4);
        if (LF.dist(c.x, c.y, e.x, e.y) > 170 && prisms.every(q => LF.dist(q.x, q.y, c.x, c.y) > 150)) pt = c;
      }
      if (!pt) continue;
      const a = Math.atan2(pt.y - e.y, pt.x - e.x), d = LF.dist(e.x, e.y, pt.x, pt.y), s = rayTo(g, e.x, e.y, a, d);
      segs.push(s);
      if (Math.hypot(s[2] - s[0], s[3] - s[1]) < d - 4) continue; // a pillar takes the beam before it reaches the prism
      prisms.push(pt);
      for (const o of fan) segs.push(rayTo(g, pt.x, pt.y, a + o, 1000));
    }
    return { segs, prisms, state: 'warn', t: 1.15, dur: 0.45, w: 14, hit: false };
  }
  // a lance that does not leave the way it came: it turns off every wall it meets
  function bounceLance(e, g, a, bounces) {
    const segs = [];
    let x = e.x, y = e.y, dx = Math.cos(a), dy = Math.sin(a);
    for (let i = 0; i <= bounces; i++) {
      const d = g.map.raycast(x, y, dx, dy, 1100), hx = x + dx * d, hy = y + dy * d;
      segs.push([x, y, hx, hy]);
      if (d >= 1100) break;
      const bx = hx - dx * 3, by = hy - dy * 3, sx = g.map.solidAt(bx + dx * 6, by), sy = g.map.solidAt(bx, by + dy * 6);
      if (sx === sy) { dx = -dx; dy = -dy; } else if (sx) dx = -dx; else dy = -dy;
      x = bx; y = by;
    }
    return { segs, prisms: [], state: 'warn', t: 1.0, dur: 0.5, w: 16, hit: false };
  }
  function updateBeam(e, g, dt) {
    const b = e.beam;
    if (!b) return;
    b.t -= dt;
    for (const s of b.segs) segHazard(g, s, b.w / 2 + 14);
    if (b.state === 'warn') { if (b.t <= 0) { b.state = 'fire'; b.t = b.dur; LF.audio.play('beam'); g.shake(3); } }
    else {
      if (!b.hit) for (const s of b.segs) if (hurtOnSeg(g, s, b.w / 2, e.dmg * 1.2, 'the Weeping Glass')) { b.hit = true; break; }
      if (b.t <= 0) e.beam = null;
    }
  }
  function updateTears(e, g, dt) {
    if (!e.tears.length) return;
    for (const t of e.tears) {
      const b = t.b;
      if (b.dead) { t.dead = true; continue; }
      if (b.t >= t.at) {
        t.dead = true; b.dead = true;
        const a = Math.atan2(b.vy, b.vx);
        for (const o of t.fan) g.fireEnemyBullet({ x: b.x, y: b.y, angle: a + o, speed: 200, dmg: e.dmg * 0.6, color: LENS, size: 4 });
        fx.burst(b.x, b.y, 4, { color: [LENS, '#fff'], speed1: 80, life: 0.25, size: 1.6 });
      }
    }
    LF.compact(e.tears);
  }
  function startShatter(e, g) {
    const n = e.phase >= 3 ? 5 : 4, c = B.arena(g);
    e.shattered = true; e.intangible = true; e.state = 'shattered'; e.shatterT = e.phase >= 3 ? 9 : 10.5;
    e.shardN = n; e.webA = Math.random() * TAU; e.webT = 0; e.webX = c.cx * TILE; e.webY = c.cy * TILE; e.webR = 210; e.webHit = 0;
    e.beam = null; e.tel.length = 0; e.shards = [];
    for (let i = 0; i < n; i++) {
      const a = e.webA + i * TAU / n;
      const s = g.spawnEnemy('glassshard', e.x + Math.cos(a) * 18, e.y + Math.sin(a) * 18, { awake: true, spawnT: 0.35, room: 0, noDrops: true });
      s.slot = i; s.boss2 = e; e.shards.push(s);
    }
    fx.burst(e.x, e.y, 30, { color: [LENS, '#fff', '#7fc4d4'], speed1: 320, life: 0.6, size: 2.4 });
    fx.ring(e.x, e.y, 10, 140, 0.4, LENS, 4); g.addFlash(e.x, e.y, 220, 0.3, LENS);
    LF.audio.play('explode'); LF.audio.play('crit'); g.shake(8);
  }
  function reform(e, g, quiet) {
    let n = 0, sx = 0, sy = 0;
    for (const s of e.shards) {
      if (s.dead) continue;
      n++; sx += s.x; sy += s.y;
      if (!quiet) { fx.arc(s.x, s.y, e.x, e.y, LENS, 0.4, 3); B.ring(g, s.x, s.y, 6, 130, e.dmg * 0.6, Math.random() * TAU, { color: LENS }); }
      s.noDrops = true; g.killEnemy(s, { type: 'self' });
    }
    e.shards = []; e.shattered = false; e.intangible = false; e.periodic = 22;
    const c = B.arena(g), pt = g.map.nearestOpen(n ? sx / n : c.cx * TILE, n ? sy / n : c.cy * TILE);
    e.x = pt.x; e.y = pt.y; e.wx = pt.x; e.wy = pt.y;
    fx.ring(e.x, e.y, 120, 10, 0.4, LENS, 4);
    if (quiet) { e.state = 'idle'; e.t = 1; return; }
    if (n === 0) {
      // every piece was broken before it could come home: it comes back cracked, and easier to hurt
      e.state = 'cracked'; e.t = 3; e.flash = 1; g.shake(8); g.hitstop(0.06);
      fx.text(e.x, e.y - e.r - 24, 'CRACKED', LENS, 15, 1.2); LF.audio.play('crit');
    } else { e.state = 'idle'; e.t = 1.3; LF.audio.play('bell'); }
  }
  function updateWeb(e, g, dt) {
    e.webT += dt; e.shatterT -= dt; e.webHit -= dt;
    e.webA += dt * (0.28 + 0.06 * e.phase);
    e.webR = 205 + Math.sin(e.webT * 0.85) * 75;
    // the links between the shards: they warn, then burn, then go out for a breath, and burn again
    const k = e.webT - 1.4, live = k > 0 && (k % 3.4) < 2.5, warn = !live && (k < 0 || (k % 3.4) > 2.9);
    e.webLive = live; e.webWarn = warn;
    let first = null, prev = null, alive = 0;
    const link = (a, b) => {
      if (a.spawnT > 0 || b.spawnT > 0) return;
      const s = e.webSeg; s[0] = a.x; s[1] = a.y; s[2] = b.x; s[3] = b.y;
      if (live || warn) segHazard(g, s, 22);
      if (live && e.webHit <= 0 && hurtOnSeg(g, s, 6, e.dmg * 0.9, 'a line of light')) e.webHit = 0.7;
    };
    for (const s of e.shards) {
      if (s.dead) continue;
      alive++;
      if (prev) link(prev, s); else first = s;
      prev = s;
    }
    if (alive > 2) link(prev, first);
    if (e.shatterT <= 0 || alive === 0) reform(e, g, false);
  }

  DEFS.weeping = {
    name: 'The Weeping Glass', title: 'The lens of the Great Lantern. It saw everything, and has not stopped weeping', boss: true,
    hp: 2700, speed: 44, r: 30, dmg: 11, embers: 0, glass: 0, phases: [0.66, 0.33], flies: true,
    eyes: null,
    lore: 'The lens saw who stood on the chain that night, close enough to touch the glass. It knew the face. It never learned the name.',
    init(e) {
      B.bossInit(e); e.tears = []; e.beam = null; e.shards = []; e.shattered = false; e.shatterT = 0; e.shatterNext = false; e.shardN = 4;
      e.webA = 0; e.webR = 200; e.webX = e.x; e.webY = e.y; e.webT = 0; e.webHit = 0; e.webSeg = [0, 0, 0, 0]; e.webLive = false; e.webWarn = false;
      e.splitT = 0; e.periodic = 22; e.wx = e.x; e.wy = e.y; e.bendT = 0;
    },
    // a bolt that strikes it breaks in two, and the pieces bend away
    modDamage(e, dmg, src, g) {
      if (e.state === 'cracked') { if (Math.random() < 0.15) fx.text(e.x, e.y - e.r - 18, 'CRACKED', LENS, 9, 0.5); dmg *= 1.5; }
      if (src.type === 'bolt' && src.angle !== undefined && g.time >= e.splitT) {
        e.splitT = g.time + 0.18;
        for (const o of [-0.6, 0.6]) g.fireBolt({ x: src.x === undefined ? e.x : src.x, y: src.y === undefined ? e.y : src.y, angle: src.angle + o, dmg: dmg * 0.3, minor: true, noSplit: true, hit: new Set([e]), size: 3, color: '#d6f6ff', life: 0.45 });
      }
      return dmg;
    },
    update(e, g, dt) {
      const p = g.player;
      e.t -= dt; e.spin += dt; e.periodic -= dt; e.bendT = Math.max(0, e.bendT - dt * 3);
      B.updateTel(e, g, dt);
      updateTears(e, g, dt);
      updateBeam(e, g, dt);
      const ph = B.phaseOf(e);
      if (ph !== e.phase) {
        if (e.shattered) reform(e, g, true);
        shift(e, g, ph, ph === 2 ? 'The glass breaks, and does not stay broken' : 'Its light bends around it', ph === 2 ? 'Break the shards before they find each other' : 'Come close. Bolts from afar go astray', LENS);
        e.beam = null; e.tel.length = 0; e.state = 'idle'; e.t = 1.4; e.shatterNext = true;
      }
      if (e.shattered) { updateWeb(e, g, dt); return; }
      const toP = Math.atan2(p.y - e.y, p.x - e.x), d = LF.dist(e.x, e.y, p.x, p.y);
      e.face = LF.turnToward(e.face, toP, 2 * dt);
      // in the last phase its light bends your bolts around it, unless you are close
      if (ph >= 3) {
        const R = 175, rIn = e.r + 18;
        for (const b of g.bullets) {
          if (b.dead || b.lob || b.ret || b.ray) continue;
          const dx = e.x - b.x, dy = e.y - b.y, d2 = dx * dx + dy * dy;
          if (d2 > R * R || d2 < rIn * rIn || b.dist < 70) continue;
          const turn = (b.vx * dy - b.vy * dx > 0 ? -1 : 1) * 2.1 * dt, c = Math.cos(turn), s = Math.sin(turn), vx = b.vx * c - b.vy * s;
          b.vy = b.vx * s + b.vy * c; b.vx = vx; e.bendT = 1;
        }
      }
      switch (e.state) {
        case 'intro': if (e.t <= 0) { e.state = 'idle'; e.t = 0.8; } break;
        case 'idle': {
          // drifts, keeping a little way off
          if (LF.dist(e.x, e.y, e.wx, e.wy) < 10 || Math.random() < dt * 0.3) {
            const pt = B.arenaPoint(g, 4);
            if (LF.dist(pt.x, pt.y, p.x, p.y) > 170) { e.wx = pt.x; e.wy = pt.y; }
          }
          const dx = e.wx - e.x, dy = e.wy - e.y, l = Math.hypot(dx, dy) || 1, sp = (e.speed + ph * 8) * e.slowMul(g);
          e.x += dx / l * Math.min(l, sp * dt); e.y += dy / l * Math.min(l, sp * dt);
          if (d < 140) { e.x -= Math.cos(toP) * sp * 0.6 * dt; e.y -= Math.sin(toP) * sp * 0.6 * dt; }
          g.map.resolveCircle(e, e.r * 0.7); B.clampToArena(g, e);
          if (e.t <= 0) {
            if (e.shatterNext || (ph >= 3 && e.periodic <= 0)) { e.shatterNext = false; e.state = 'gather'; e.t = 1.0; LF.audio.play('charge'); break; }
            const opts = ['weep', 'prism', 'weep', 'prism'];
            if (ph >= 2) opts.push('mirror', 'mirror');
            e.state = B.pickAttack(e, opts);
            if (e.state === 'weep') { e.count = 2 + ph; e.t = 0.5; LF.audio.play('drip'); }
            else if (e.state === 'prism') { e.beam = prismBeam(e, g); e.t = e.beam.t + e.beam.dur + 0.15; LF.audio.play('telegraph'); }
            else if (e.state === 'mirror') { e.count = ph >= 3 ? 2 : 1; e.t = 0.1; }
          }
          break;
        }
        case 'weep':
          e.red = 1;
          if (e.t <= 0) {
            // tears fall slowly, then each breaks into three
            const n = 3 + ph, fan = ph >= 3 ? [-0.45, 0, 0.45] : [-0.4, 0.4];
            for (let i = 0; i < n; i++) {
              const b = g.fireEnemyBullet({ x: e.x, y: e.y + 6, angle: toP + (i - (n - 1) / 2) * 0.34 + LF.rand(-0.05, 0.05), speed: 115, dmg: e.dmg * 0.7, color: LENS, size: 6 });
              if (b) e.tears.push({ b, at: 0.7 + (e.count % 2) * 0.15, fan, dead: false });
            }
            LF.audio.play('drip'); e.flash = 0.3;
            if (--e.count > 0) e.t = 0.55; else { e.state = 'idle'; e.t = 1.2; }
          }
          break;
        case 'prism':
          if (e.t <= 0) { e.state = 'idle'; e.t = 1.0; }
          break;
        case 'mirror':
          if (e.t <= 0 && !e.beam) {
            const lead = Math.atan2(p.y + p.vy * 0.3 - e.y, p.x + p.vx * 0.3 - e.x);
            e.beam = bounceLance(e, g, lead + LF.rand(-0.08, 0.08), ph >= 3 ? 3 : 2);
            LF.audio.play('telegraph');
            if (--e.count > 0) e.t = 1.7; else { e.state = 'prism'; e.t = e.beam.t + e.beam.dur + 0.1; }
          }
          break;
        case 'gather':
          e.red = 1;
          if (Math.random() < dt * 30) { const a = Math.random() * TAU; fx.spawn({ x: e.x + Math.cos(a) * 60, y: e.y + Math.sin(a) * 60, vx: -Math.cos(a) * 120, vy: -Math.sin(a) * 120, life: 0.45, size: 2, color: LENS, drag: 0 }); }
          if (e.t <= 0) startShatter(e, g);
          break;
        case 'cracked':
          if (e.t <= 0) { e.state = 'idle'; e.t = 0.6; }
          break;
      }
    },
    draw(e, ctx, g) {
      if (e.tel) B.drawTel(e, ctx, g);
      const time = (g && g.time) || 0, ph = e.maxHp > 0 ? B.phaseOf(e) : (e.phase || 1), r = e.r || 30, hit = e.flash > 0.6;
      if (e.shattered) {
        // only the outline of where it stood, while its pieces are elsewhere
        ctx.strokeStyle = 'rgba(127,196,212,0.25)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 6]);
        ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        return;
      }
      const bob = Math.sin(time * 1.4) * 3, gather = e.state === 'gather' ? 1 - Math.max(0, e.t || 0) : 0, cracked = e.state === 'cracked';
      ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + r * 1.1, r * 0.9, r * 0.3, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(e.x + (gather ? Math.sin(time * 60) * 2 * gather : 0), e.y + bob - 6); ctx.scale(r / 30, r / 30);
      // a standing figure of broken lens, the shards a little apart from one another
      const apart = 1 + (cracked ? 0.25 : 0) + gather * 0.2 + (ph - 1) * 0.05;
      for (let i = 0; i < BODY.length; i++) {
        const s = BODY[i], wob = Math.sin(time * 1.3 + i * 1.7) * 0.05;
        ctx.fillStyle = hit ? '#fff' : (e.lit ? '#2b4651' : '#121f26'); ctx.strokeStyle = e.lit ? '#6fb3c4' : '#2f5562'; ctx.lineWidth = 1.6;
        shardPath(ctx, s[0] * apart, s[1] * apart, s[2], s[3], s[4] + wob); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = e.lit ? 'rgba(210,245,255,0.35)' : 'rgba(110,170,190,0.2)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(s[0] * apart, s[1] * apart - s[3] * 0.8); ctx.lineTo(s[0] * apart + s[2] * 0.3, s[1] * apart + s[3] * 0.6); ctx.stroke();
      }
      // the lens: a round eye of glass for a head, cracked across
      ctx.fillStyle = hit ? '#fff' : (e.lit ? '#3a5f6c' : '#182a32'); ctx.beginPath(); ctx.arc(0, -24, 14, 0, TAU); ctx.fill();
      ctx.strokeStyle = e.lit ? '#9fe0ee' : '#3f6d7a'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.strokeStyle = e.lit ? '#6fb3c4' : '#2f5562'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, -24, 9, 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#061015'; ctx.lineWidth = 1.2 + ph * 0.4;
      ctx.beginPath(); ctx.moveTo(-10, -32); ctx.lineTo(-2, -24); ctx.lineTo(-5, -15); if (ph >= 2) { ctx.moveTo(-2, -24); ctx.lineTo(9, -27); } if (ph >= 3) { ctx.moveTo(9, -27); ctx.lineTo(12, -18); } ctx.stroke();
      ctx.restore();
    },
    drawGlow(e, ctx, g) {
      const time = (g && g.time) || 0, ph = e.maxHp > 0 ? B.phaseOf(e) : (e.phase || 1), r = e.r || 30;
      // beams and their prisms
      const b = e.beam;
      if (b) {
        ctx.lineCap = 'round';
        if (b.state === 'warn') {
          const k = 1 - Math.max(0, b.t) / 1.1;
          ctx.strokeStyle = `rgba(255,90,90,${0.35 + 0.4 * k})`; ctx.lineWidth = 2; ctx.setLineDash([10, 8]);
          for (const s of b.segs) strokeSeg(ctx, s);
          ctx.setLineDash([]); ctx.strokeStyle = 'rgba(255,90,90,0.08)'; ctx.lineWidth = b.w;
          for (const s of b.segs) strokeSeg(ctx, s);
        } else {
          const w = b.w * (0.85 + Math.sin(time * 50) * 0.15);
          ctx.strokeStyle = `rgba(${LENS_RGB},0.5)`; ctx.lineWidth = w * 1.7; for (const s of b.segs) strokeSeg(ctx, s);
          ctx.strokeStyle = 'rgba(245,255,255,0.95)'; ctx.lineWidth = w * 0.5; for (const s of b.segs) strokeSeg(ctx, s);
        }
        for (const q of b.prisms) {
          ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(time * 2);
          ctx.fillStyle = 'rgba(230,252,255,0.85)'; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 0); ctx.lineTo(0, 9); ctx.lineTo(-6, 0); ctx.closePath(); ctx.fill(); ctx.restore();
          LF.drawGlow(ctx, LENS, q.x, q.y, 34, 0.5);
        }
      }
      if (e.shattered && e.shards) {
        // the web between its shards
        let first = null, prev = null, n = 0;
        ctx.lineCap = 'round';
        const line = (a, c) => {
          if (a.spawnT > 0 || c.spawnT > 0) return;
          if (e.webLive) {
            ctx.strokeStyle = `rgba(${LENS_RGB},0.45)`; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke();
            ctx.strokeStyle = 'rgba(245,255,255,0.9)'; ctx.lineWidth = 2.5; ctx.stroke();
          } else if (e.webWarn) {
            ctx.strokeStyle = 'rgba(255,90,90,0.6)'; ctx.lineWidth = 2; ctx.setLineDash([8, 8]); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke(); ctx.setLineDash([]);
          } else {
            ctx.strokeStyle = `rgba(${LENS_RGB},0.12)`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke();
          }
        };
        for (const s of e.shards) { if (s.dead) continue; n++; if (prev) line(prev, s); else first = s; prev = s; }
        if (n > 2) line(prev, first);
        return;
      }
      const bob = Math.sin(time * 1.4) * 3, x = e.x, y = e.y + bob - 6, sc = r / 30;
      ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
      ctx.strokeStyle = `rgba(${LENS_RGB},0.45)`; ctx.lineWidth = 1;
      for (let i = 0; i < BODY.length; i++) { const s = BODY[i]; shardPath(ctx, s[0], s[1], s[2], s[3], s[4] + Math.sin(time * 1.3 + i * 1.7) * 0.05); ctx.stroke(); }
      // the tears: light running down from the lens and dripping off the shards
      ctx.lineCap = 'round';
      for (const sx of [-5, 5]) {
        ctx.strokeStyle = `rgba(${LENS_RGB},0.7)`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx, -16); ctx.quadraticCurveTo(sx * 1.6, 4, sx * 1.2, 30); ctx.stroke();
        for (let k = 0; k < 3; k++) { const f = (time * 0.7 + k / 3 + (sx > 0 ? 0.5 : 0)) % 1; ctx.fillStyle = `rgba(240,255,255,${0.9 * (1 - f)})`; ctx.beginPath(); ctx.arc(sx * (1 + f * 0.3), -14 + f * 52, 1.8, 0, TAU); ctx.fill(); }
      }
      ctx.fillStyle = 'rgba(240,255,255,0.85)'; ctx.beginPath(); ctx.arc(0, -24, 4 + Math.sin(time * 3) * 0.6, 0, TAU); ctx.fill();
      ctx.restore();
      LF.drawGlow(ctx, LENS, x, y - 24 * sc, 30 + ph * 4, 0.45);
      LF.drawGlow(ctx, LENS, x, y, r * 2, 0.1 + (e.state === 'cracked' ? 0.15 : 0));
      if (ph >= 3) {
        // the halo that bends bolts
        ctx.strokeStyle = `rgba(${LENS_RGB},${0.18 + e.bendT * 0.3})`; ctx.lineWidth = 1.5; ctx.setLineDash([3, 9]);
        ctx.beginPath(); ctx.arc(e.x, e.y, 175, time * 0.4, time * 0.4 + TAU); ctx.stroke(); ctx.setLineDash([]);
      }
    },
    light(e, lc, white) { if (e.shattered) return; lc.globalAlpha = 0.55; lc.drawImage(white, e.x - 110, e.y - 110, 220, 220); },
  };

  // =====================================================================================
  // THE LAST KEEPER (Depth VI, Level 6: the Cinder Fields)
  // The keeper who tended the Great Lantern at the top of its chain, burnt hollow. It flings lamp-oil that lies dead
  // until something lights it, and lights it all at once. Your bolts light it too: burn the oil under it.
  // Its snuffer puts your light down to a glimmer.
  // =====================================================================================
  const OIL = '#ffb347', FIRE = '#ff7b2e';
  function addPool(e, x, y, r, fire, life) {
    if (e.pools.length >= 18) {
      let i = -1;
      for (let k = 0; k < e.pools.length; k++) if (e.pools[k].state === 'oil') { i = k; break; }
      if (i < 0) return;
      e.pools.splice(i, 1);
    }
    e.pools.push({ x, y, r, state: fire ? 'fire' : 'oil', t: fire ? (life || 3.4) : 26, fireT: life || 3.4, tick: 0.15, ktick: 0, byPlayer: false, wob: Math.random() * TAU, dead: false });
  }
  function lightPool(q, delay, byPlayer) { if (q.state !== 'oil') return; q.state = 'catch'; q.t = delay; q.byPlayer = byPlayer; }
  function oilCount(e) { let n = 0; for (const q of e.pools) if (q.state === 'oil') n++; return n; }
  function updatePools(e, g, dt) {
    const p = g.player;
    for (const q of e.pools) {
      q.t -= dt;
      if (q.state === 'oil') {
        if (q.t <= 0) { q.dead = true; continue; }
        // a bolt of yours that crosses the oil sets it alight
        for (const b of g.bullets) if (!b.dead && !b.lob && LF.dist2(b.x, b.y, q.x, q.y) < q.r * q.r) { lightPool(q, 0.3, true); break; }
      } else if (q.state === 'catch') {
        g.hazards.push(q);
        if (q.t <= 0) { q.state = 'fire'; q.t = q.fireT; fx.burst(q.x, q.y, 10, { color: [FIRE, OIL, '#fff'], speed1: 160, life: 0.4 }); LF.audio.play('ignite'); }
      } else {
        g.hazards.push(q);
        q.tick -= dt; q.ktick -= dt;
        if (q.tick <= 0 && !p.dead && p.dashing <= 0 && LF.dist2(p.x, p.y, q.x, q.y) < (q.r + p.r * 0.4) * (q.r + p.r * 0.4)) { q.tick = 0.5; g.hurtPlayer(e.dmg * 0.55, { x: q.x, y: q.y, name: 'burning oil' }); }
        // oil that you set alight burns it too (its own fire it has long stopped feeling)
        if (q.ktick <= 0 && q.byPlayer && LF.dist2(e.x, e.y, q.x, q.y) < (q.r + e.r * 0.4) * (q.r + e.r * 0.4)) {
          q.ktick = 0.5;
          if (Math.random() < 0.4) fx.text(e.x, e.y - e.r - 18, 'IT BURNS', OIL, 10, 0.6);
          g.damageEnemy(e, e.maxHp * 0.009, { type: 'oil', noShroud: true, quiet: true });
          if (e.dead) return;
        }
        // fire runs into any oil that touches it
        for (const o of e.pools) if (o.state === 'oil' && LF.dist2(o.x, o.y, q.x, q.y) < (o.r + q.r) * (o.r + q.r) * 0.7) lightPool(o, 0.35, q.byPlayer);
        if (Math.random() < dt * (6 + q.r * 0.1)) { const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * q.r * 0.8; fx.spawn({ x: q.x + Math.cos(a) * d, y: q.y + Math.sin(a) * d, vy: -60, life: 0.5, size: 3, color: LF.pick([FIRE, '#ffc24d', '#ff4d1f']) }); }
        if (q.t <= 0) q.dead = true;
      }
    }
    LF.compact(e.pools);
  }

  DEFS.lastkeeper = {
    name: 'The Last Keeper', title: 'It tended the Great Lantern at the top of the chain, for a lifetime', boss: true,
    hp: 3100, speed: 62, r: 28, dmg: 11, embers: 0, glass: 0, phases: [0.66, 0.33],
    eyes: [[13, -4, 2], [13, 4, 2]], eyeColor: '255,150,80',
    lore: 'From the top of the chain it heard the shears below, and knew whose step was on the links. It said nothing then. It says nothing now.',
    init(e) { B.bossInit(e); e.pools = []; e.snuffT = 0; e.aflame = false; e.trailT = 0; e.told = false; e.reach = 0; e.sa = 0; e.thrust = 0; e.pourT = 0; },
    update(e, g, dt) {
      const p = g.player;
      e.t -= dt; e.spin += dt; e.thrust = Math.max(0, e.thrust - dt * 2.5);
      B.updateTel(e, g, dt);
      updatePools(e, g, dt);
      if (e.dead) return;
      if (e.snuffT > 0) { e.snuffT -= dt; g.snuffCount += 2; }
      const ph = B.phaseOf(e);
      if (ph !== e.phase) {
        shift(e, g, ph, ph === 2 ? 'The oil remembers the flame' : 'It sets itself alight', ph === 2 ? 'Everything it spilled catches' : 'What is left of the oil burns with it', OIL);
        e.state = 'idle'; e.t = 1.3; e.tel.length = 0;
        for (const q of e.pools) lightPool(q, 0.9, false);
        if (ph === 3) { e.aflame = true; fx.burst(e.x, e.y, 30, { color: [FIRE, OIL, '#fff'], speed1: 260, life: 0.6 }); LF.audio.play('ignite'); }
      }
      const toP = Math.atan2(p.y - e.y, p.x - e.x), d = LF.dist(e.x, e.y, p.x, p.y);
      if (e.state !== 'snuff') e.face = LF.turnToward(e.face, toP, 3 * dt);
      // alight, it leaves fire where it walks
      if (e.aflame) {
        e.trailT -= dt;
        if (e.trailT <= 0) { e.trailT = 0.5; addPool(e, e.x - Math.cos(e.face) * e.r * 0.6, e.y - Math.sin(e.face) * e.r * 0.6, 30, true, 2.4); }
        if (Math.random() < dt * 14) fx.spawn({ x: e.x + LF.rand(-e.r, e.r) * 0.6, y: e.y + LF.rand(-e.r, e.r) * 0.6, vy: -70, life: 0.5, size: 3, color: LF.pick([FIRE, '#ffc24d']) });
      }
      const walk = (sp, near) => { if (d > near) { e.x += Math.cos(toP) * sp * dt; e.y += Math.sin(toP) * sp * dt; g.map.resolveCircle(e, e.r * 0.7); B.clampToArena(g, e); } };
      switch (e.state) {
        case 'intro': if (e.t <= 0) { e.state = 'idle'; e.t = 0.8; } break;
        case 'idle': {
          walk((e.speed + ph * 10) * e.slowMul(g), 150);
          if (e.t <= 0) {
            const opts = ['fling', 'snuff', 'fling', 'pour'];
            if (oilCount(e) >= 3) opts.push('kindle', 'kindle');
            if (ph >= 2) opts.push('ash', 'snuff');
            e.state = B.pickAttack(e, opts);
            if (e.state === 'kindle' && oilCount(e) < 3) e.state = 'fling';
            if (e.state === 'fling') { e.t = 0.45; LF.audio.play('telegraph'); }
            else if (e.state === 'snuff') { e.count = ph; e.sub = 0; e.t = 0.1; }
            else if (e.state === 'pour') { e.t = 2.4; e.pourT = 0; LF.audio.play('drip'); }
            else if (e.state === 'kindle') {
              e.t = 1.3; LF.audio.play('charge');
              for (const q of e.pools) lightPool(q, 1.05, false);
              if (!e.told) { e.told = true; g.banner = { text: 'It lights what it spilled', sub: 'Your bolts light the oil too. Burn it under the Keeper', t: 0, dur: 3.2, small: true, boss: true }; }
            } else if (e.state === 'ash') { e.count = 2; e.t = 0.6; LF.audio.play('charge'); }
          }
          break;
        }
        case 'fling':
          e.red = 1;
          if (e.t <= 0) {
            // lamp-oil, flung where you stand and around it; deeper in, some of it already burning
            const n = 3 + ph;
            for (let i = 0; i < n; i++) {
              const a = Math.random() * TAU, rr = i === 0 ? 0 : LF.rand(70, 190), lit = ph >= 2 && i % 3 === 1;
              const o = g.map.nearestOpen(p.x + p.vx * 0.4 + Math.cos(a) * rr, p.y + p.vy * 0.4 + Math.sin(a) * rr);
              fx.arc(e.x, e.y, o.x, o.y, lit ? FIRE : '#8a6a3a', 0.3, 2);
              B.telegraph(e, o.x, o.y, 46, 0.85 + i * 0.12, t => {
                B.blast(g, t.x, t.y, 44, e.dmg * 0.8, 'a flung lamp', lit ? FIRE : OIL);
                if (!e.dead) addPool(e, t.x, t.y, 58, lit, 3.2);
              }, lit ? '255,90,60' : '255,180,90');
            }
            LF.audio.play('spit'); e.state = 'idle'; e.t = 1.5;
          }
          break;
        case 'pour':
          // it walks at you, pouring oil behind it
          e.red = 1;
          walk((e.speed * 1.6 + ph * 12) * e.slowMul(g), 60);
          e.pourT -= dt;
          if (e.pourT <= 0) { e.pourT = 0.3; addPool(e, e.x - Math.cos(e.face) * e.r, e.y - Math.sin(e.face) * e.r, 36, e.aflame, 2.4); }
          if (e.t <= 0) { e.state = 'idle'; e.t = 1.1; }
          break;
        case 'kindle':
          e.red = 1;
          if (e.t <= 0) { g.shake(5); e.state = 'idle'; e.t = 1.0; if (ph >= 3) B.ring(g, e.x, e.y, 16, 140, e.dmg * 0.6, Math.random() * TAU, { color: FIRE }); }
          break;
        case 'snuff':
          e.red = 1;
          if (e.sub === 0) {
            if (e.t <= 0) {
              // the snuffer comes down where you are going
              let tx = p.x + p.vx * 0.3, ty = p.y + p.vy * 0.3;
              const a = Math.atan2(ty - e.y, tx - e.x), dd = Math.min(250, LF.dist(e.x, e.y, tx, ty));
              const o = g.map.nearestOpen(e.x + Math.cos(a) * dd, e.y + Math.sin(a) * dd); tx = o.x; ty = o.y;
              e.sa = a; e.face = a; e.reach = LF.dist(e.x, e.y, tx, ty); e.sub = 1;
              const fuse = ph >= 3 ? 0.55 : 0.7;
              e.t = fuse + 0.1;
              B.telegraph(e, tx, ty, 54, fuse, t => {
                e.thrust = 1; g.shake(4); LF.audio.play('lunge');
                fx.ring(t.x, t.y, 8, 60, 0.3, '#5a4a3a', 4); fx.burst(t.x, t.y, 10, { color: ['#3a3030', '#6a5a4a'], speed1: 140, life: 0.4, glow: false });
                const before = p.light;
                if (hurtIfNear(g, t.x, t.y, 54, e.dmg * 1.25, 'the snuffer') && !p.dead && p.light < before) {
                  e.snuffT = 4; fx.text(p.x, p.y - 36, 'SNUFFED', '#c9bfae', 12, 1.1); LF.audio.play('hiss');
                }
              }, '255,110,80');
              LF.audio.play('telegraph');
            }
          } else if (e.t <= 0) {
            if (--e.count > 0) { e.sub = 0; e.t = 0.3; } else { e.state = 'idle'; e.t = 1.2; }
          }
          break;
        case 'ash':
          e.red = 1;
          if (e.t <= 0) {
            // a sweep of the pole throws up ash and cinders
            const n = 11, off = e.count % 2 ? 0.07 : -0.07;
            for (let i = 0; i < n; i++) g.fireEnemyBullet({ x: e.x + Math.cos(e.face) * e.r, y: e.y + Math.sin(e.face) * e.r, angle: toP + (i - (n - 1) / 2) * 0.15 + off, speed: 150 + (i % 2) * 30, dmg: e.dmg * 0.6, color: '#b8a898', size: 5 });
            LF.audio.play('cinder'); e.thrust = 0.6;
            if (--e.count > 0) e.t = 0.5; else { e.state = 'idle'; e.t = 1.2; }
          }
          break;
      }
    },
    draw(e, ctx, g) {
      const time = (g && g.time) || 0, ph = e.maxHp > 0 ? B.phaseOf(e) : (e.phase || 1), r = e.r || 28, hit = e.flash > 0.6;
      // its oil: dark and still until it burns
      for (const q of (e.pools || [])) {
        const fade = q.state === 'oil' ? Math.min(1, q.t / 2) : 1;
        ctx.fillStyle = `rgba(14,10,6,${0.75 * fade})`; ctx.beginPath(); ctx.ellipse(q.x, q.y, q.r, q.r * 0.82, q.wob, 0, TAU); ctx.fill();
        ctx.strokeStyle = `rgba(110,84,46,${0.5 * fade})`; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = `rgba(160,130,80,${0.18 * fade})`; ctx.beginPath(); ctx.ellipse(q.x - q.r * 0.25, q.y - q.r * 0.25, q.r * 0.35, q.r * 0.14, q.wob - 0.5, 0, TAU); ctx.fill();
        if (q.state === 'catch') { ctx.strokeStyle = `rgba(255,90,90,${0.5 + 0.4 * Math.sin(time * 30)})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(q.x, q.y, q.r, q.r * 0.82, q.wob, 0, TAU); ctx.stroke(); }
      }
      if (e.tel) B.drawTel(e, ctx, g);
      ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + r * 0.6, r * 1.1, r * 0.45, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.face || 0); ctx.scale(r / 28, r / 28);
      const coat = hit ? '#fff' : (e.lit ? '#2e2724' : '#121010'), rim = e.lit ? '#5a4a40' : '#2a2220';
      // the snuffer-pole: long, held out ahead, its cap a black bell at the end
      const reach = e.thrust > 0 || (e.state === 'snuff' && e.sub === 1) ? Math.max(70, (e.reach || 80) / (r / 28)) : 70, lift = e.state === 'snuff' && e.sub === 1 && e.thrust <= 0 ? 0.35 : 0.12;
      ctx.save(); ctx.rotate(lift);
      ctx.strokeStyle = hit ? '#fff' : (e.lit ? '#6a5642' : '#2e251e'); ctx.lineWidth = 3.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-8, 12); ctx.lineTo(reach, 12); ctx.stroke();
      ctx.fillStyle = hit ? '#fff' : (e.lit ? '#3e3a38' : '#161414'); ctx.strokeStyle = e.lit ? '#7a6a5a' : '#3a3230'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(reach - 2, 7); ctx.lineTo(reach + 12, 2); ctx.lineTo(reach + 12, 22); ctx.lineTo(reach - 2, 17); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
      // a long burnt coat, hunched; the oil can at its back
      ctx.fillStyle = coat; ctx.strokeStyle = rim; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(16, -14); ctx.lineTo(-6, -27); ctx.lineTo(-30, -20); ctx.lineTo(-38, -6); ctx.lineTo(-31, 3); ctx.lineTo(-39, 15); ctx.lineTo(-24, 27); ctx.lineTo(6, 25); ctx.lineTo(18, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = hit ? '#fff' : (e.lit ? '#4a3a2a' : '#1e1812'); LF.roundRect(ctx, -34, -24, 12, 14, 3); ctx.fill();
      ctx.strokeStyle = e.lit ? '#7a5a3a' : '#3a2a1e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-23, -21); ctx.lineTo(-17, -27); ctx.stroke();
      // the burn has hollowed it: cracks through the coat show the dark inside
      ctx.strokeStyle = '#050303'; ctx.lineWidth = 2 + ph * 0.6; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(-22, -16); ctx.lineTo(-14, -6); ctx.lineTo(-20, 4); ctx.lineTo(-10, 16); ctx.stroke();
      if (ph >= 2) { ctx.beginPath(); ctx.moveTo(-4, -22); ctx.lineTo(0, -10); ctx.lineTo(-6, -2); ctx.stroke(); }
      for (const s of [-1, 1]) { ctx.fillStyle = coat; ctx.strokeStyle = rim; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(2, s * 20, 10, 7, s * 0.4, 0, TAU); ctx.fill(); ctx.stroke(); }
      // the hood, and nothing in it
      ctx.fillStyle = hit ? '#fff' : (e.lit ? '#3a302a' : '#181412'); ctx.beginPath(); ctx.ellipse(8, 0, 14, 15, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = rim; ctx.stroke();
      ctx.fillStyle = '#020101'; ctx.beginPath(); ctx.ellipse(13, 0, 7, 9, 0, 0, TAU); ctx.fill();
      // ash falling from it, painted
      ctx.fillStyle = 'rgba(150,140,130,0.35)';
      for (let i = 0; i < 8; i++) { const f = (time * 0.5 + i * 0.29) % 1; ctx.fillRect(-30 + i * 6 - f * 8, (i % 2 ? 1 : -1) * (14 + f * 22), 1.6, 1.6); }
      ctx.restore();
    },
    drawGlow(e, ctx, g) {
      const time = (g && g.time) || 0, ph = e.maxHp > 0 ? B.phaseOf(e) : (e.phase || 1), r = e.r || 28;
      for (const q of (e.pools || [])) {
        if (q.state === 'fire') {
          const k = Math.min(1, q.t / 0.6), fl = 1 + Math.sin(time * 14 + q.wob * 5) * 0.08;
          LF.drawGlow(ctx, FIRE, q.x, q.y, q.r * 1.7 * fl, 0.55 * k);
          LF.drawGlow(ctx, '#ffd28a', q.x, q.y, q.r * 0.9 * fl, 0.45 * k);
        } else if (q.state === 'catch') LF.drawGlow(ctx, FIRE, q.x, q.y, q.r, 0.25);
        else {
          // a dull sheen, so the oil can be seen in the dark
          const k = Math.min(1, q.t / 2);
          ctx.strokeStyle = `rgba(200,150,80,${0.28 * k})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(q.x, q.y, q.r, q.r * 0.82, q.wob, 0, TAU); ctx.stroke();
          ctx.strokeStyle = `rgba(230,190,120,${(0.2 + 0.1 * Math.sin(time * 1.5 + q.wob * 4)) * k})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(q.x - q.r * 0.25, q.y - q.r * 0.25, q.r * 0.35, q.r * 0.14, q.wob - 0.5, 0, TAU); ctx.stroke();
        }
      }
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.face || 0); ctx.scale(r / 28, r / 28);
      // embers still caught in the cracks of it
      const pulse = 0.45 + 0.25 * Math.sin(time * 3) + (e.aflame ? 0.3 : 0);
      ctx.strokeStyle = `rgba(255,120,50,${pulse})`; ctx.lineWidth = 1 + ph * 0.4; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(-22, -16); ctx.lineTo(-14, -6); ctx.lineTo(-20, 4); ctx.lineTo(-10, 16); ctx.stroke();
      if (ph >= 2) { ctx.beginPath(); ctx.moveTo(-4, -22); ctx.lineTo(0, -10); ctx.lineTo(-6, -2); ctx.stroke(); }
      ctx.restore();
      LF.drawGlow(ctx, FIRE, e.x, e.y, r * (e.aflame ? 2.6 : 1.5), e.aflame ? 0.35 : 0.1);
      if (e.snuffT > 0 && g && g.player) LF.drawGlow(ctx, '#3a3a50', g.player.x, g.player.y, 40, 0.3);
    },
    light(e, lc, white) {
      for (const q of e.pools) if (q.state === 'fire') { const R = q.r * 2.4; lc.globalAlpha = 0.7 * Math.min(1, q.t / 0.6); lc.drawImage(white, q.x - R, q.y - R, R * 2, R * 2); }
      lc.globalAlpha = e.aflame ? 0.6 : 0.3; lc.drawImage(white, e.x - 80, e.y - 80, 160, 160);
    },
  };

  // =====================================================================================
  // THE UNWRITTEN (Depth VI, Level 9: the Lantern's Rest)
  // The fifth born to the Vigil, struck from every roll: the one who cut the Lantern loose. It fights as the Wick
  // fights, in the dark: bolts, a dash that leaves a cut in the air, a flare turned inside out. Its lantern casts
  // darkness. It has the shears. In the end the dead Lantern draws your light toward it.
  // =====================================================================================
  const VOID = '#a99cff', VOID_RGB = '169,156,255';
  const FIG_VOID_LIT = { coat: '#2a2438', coatHi: '#3a3350', deep: '#191523', hat: '#252034', hatTop: '#3f3760', rim: '#6c5fa0', trim: '#544a80', metal: '#7d72ad', core: '#000000', pole: '#352e4a', boot: '#0e0c15', dark: '#000000' };
  const FIG_VOID_DIM = { coat: '#120f1a', coatHi: '#1c1828', deep: '#0a0810', hat: '#110e18', hatTop: '#211c30', rim: '#3a3258', trim: '#2c2645', metal: '#4a4270', core: '#000000', pole: '#1c1828', boot: '#06050a', dark: '#000000' };
  const FIG_VOID_GLOW = { coat: '#1a1630', coatHi: '#28204a', deep: '#120e22', hat: '#1a1630', hatTop: '#2c2450', rim: '#5a4c9a', trim: '#3a3070', metal: '#4a4080', core: '#000000', pole: '#1a1630', boot: '#0a0816', dark: '#000000' };
  function phase4(e) { const f = e.hp / e.maxHp; return f > 0.75 ? 1 : f > 0.5 ? 2 : f > 0.25 ? 3 : 4; }
  function say(g, text, sub) { g.banner = { text, sub: sub || '', t: 0, dur: 3.6, small: true, boss: true }; }
  // it walks where you are going, and waits for you there
  function stalk(e, g, dt, sp) {
    const p = g.player, ax = p.x + p.vx * 0.9, ay = p.y + p.vy * 0.9;
    e.orbitT -= dt;
    if (e.orbitT <= 0) { e.orbit = -e.orbit; e.orbitT = LF.rand(1.6, 3.4); }
    const a = Math.atan2(e.y - ay, e.x - ax) + e.orbit * 0.45, R = 200;
    const tx = ax + Math.cos(a) * R, ty = ay + Math.sin(a) * R, dx = tx - e.x, dy = ty - e.y, l = Math.hypot(dx, dy);
    if (l > 4) { const m = Math.min(l, sp * dt); e.x += dx / l * m; e.y += dy / l * m; }
    g.map.resolveCircle(e, e.r); B.clampToArena(g, e);
  }
  function addCut(e, x1, y1, x2, y2, t) { e.cuts.push({ s: [x1, y1, x2, y2], t, max: t, tick: 0.35, dead: false }); }

  DEFS.fifth = {
    name: 'The Unwritten', title: 'The fifth born to the Vigil, struck from every roll', boss: true,
    hp: 6600, speed: 150, r: 17, dmg: 14, embers: 0, glass: 0, phases: [0.75, 0.5, 0.25],
    eyes: [[6, -2.2, 1.3], [6, 2.2, 1.3]], eyeColor: '210,200,255',
    lore: 'It was the fifth born to the Vigil, and Vael struck its name from every roll. It climbed the chain in the dark and cut the Lantern loose. It never said why.',
    init(e) {
      B.bossInit(e); e.cuts = []; e.pools = []; e.darkR = 130; e.said = false; e.lastLine = false; e.age2 = 0;
      e.orbit = 1; e.orbitT = 2; e.k = 0; e.lx = 0; e.ly = 0; e.len = 0; e.sa = 0; e.aim = 0; e.shotT = 0; e.fl = 0;
      e.ghosts = []; e.shear = null; e.uf = null; e.coldT = 5; e.cold = null; e.lanGlow = 0; e.drawn = 0;
    },
    update(e, g, dt) {
      const p = g.player;
      if (e.lanX === undefined) { const c = B.arena(g), ex = g.map.exit; e.lanX = ex ? ex.x : c.cx * TILE; e.lanY = ex ? ex.y : c.cy * TILE; }
      e.t -= dt; e.spin += dt; e.age2 += dt; e.fl = Math.max(0, e.fl - dt * 2);
      if (e.ghosts.length) { for (const gh of e.ghosts) { gh.life -= dt; if (gh.life <= 0) gh.dead = true; } LF.compact(e.ghosts); }
      B.updateTel(e, g, dt);
      if (!e.said && e.age2 > 3.4) { e.said = true; say(g, '"You were not the last."'); }
      const ph = phase4(e);
      if (ph !== e.phase) {
        const lines = [null, null, ['"There were five of us. They wrote down four."', 'It sets down its lantern now'], ['"I climbed the chain with no light, so no one saw me."', ''], ['"I cut it. I held the shears, and I cut it."', 'The Lantern draws your light toward it']];
        shift(e, g, ph, lines[ph][0], lines[ph][1], VOID);
        e.state = 'idle'; e.t = 1.4; e.shear = null; e.uf = null; e.tel.length = 0;
        if (ph === 4) { e.coldT = 3; fx.ring(e.lanX, e.lanY, 20, 300, 0.9, VOID, 5); LF.audio.play('bell'); }
      }
      if (ph >= 4 && !e.lastLine && e.hp / e.maxHp < 0.1) { e.lastLine = true; say(g, '"Leave it dark. It never once shone on me."'); }
      e.darkR = 110 + ph * 22;
      // its lantern casts darkness: near it, your light shrinks
      if (!p.dead && LF.dist2(p.x, p.y, e.x, e.y) < e.darkR * e.darkR) g.snuffCount += 1;
      // the cuts it leaves in the air
      for (const c of e.cuts) {
        c.t -= dt; c.tick -= dt;
        segHazard(g, c.s, 18);
        if (c.tick <= 0 && hurtOnSeg(g, c.s, 7, e.dmg * 0.5, 'a cut in the dark')) c.tick = 0.8;
        if (c.t <= 0) c.dead = true;
      }
      LF.compact(e.cuts);
      // where it set its lantern down
      for (const d of e.pools) {
        d.t -= dt;
        if (d.t <= 0) { d.dead = true; continue; }
        g.hazards.push(d);
        if (!p.dead && LF.dist2(p.x, p.y, d.x, d.y) < d.r * d.r) {
          g.snuffCount += 2; d.tick -= dt;
          if (d.tick <= 0) { d.tick = 0.6; g.hurtPlayer(e.dmg * 0.35, { x: d.x, y: d.y, name: 'its lantern' }); }
        }
      }
      LF.compact(e.pools);
      // the last phase: the dead Lantern draws your light to it, and breathes out cold embers
      if (ph >= 4) {
        e.lanGlow = Math.min(1, e.lanGlow + dt * 0.3);
        const dd = LF.dist(p.x, p.y, e.lanX, e.lanY) || 1;
        if (!p.dead && p.dashing <= 0 && dd > 40) { const pull = 48; p.x += (e.lanX - p.x) / dd * pull * dt; p.y += (e.lanY - p.y) / dd * pull * dt; g.map.resolveCircle(p, p.r); }
        if (!p.dead && p.light > p.stats.maxLight * 0.2) { const k = p.stats.maxLight * 0.008 * dt; p.light -= k; e.drawn += k; }
        g.hazards.push({ x: e.lanX, y: e.lanY, r: 56 });
        if (!p.dead && Math.random() < dt * 22) { const a = Math.atan2(e.lanY - p.y, e.lanX - p.x) + LF.rand(-0.4, 0.4); fx.spawn({ x: p.x, y: p.y, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, life: Math.min(1.2, dd / 260), size: 2, color: '#ffd28a', drag: 0 }); }
        e.coldT -= dt;
        if (!e.cold && e.coldT <= 0) { e.cold = { warn: 0.9, t: 2.8, sub: 0, a: Math.random() * TAU }; LF.audio.play('charge'); }
        if (e.cold) {
          const c = e.cold;
          if (c.warn > 0) { c.warn -= dt; g.hazards.push({ x: e.lanX, y: e.lanY, r: 90 }); }
          else {
            c.t -= dt; c.sub -= dt;
            if (c.sub <= 0) { c.sub = 0.16; c.a += 0.27; for (let k = 0; k < 3; k++) g.fireEnemyBullet({ x: e.lanX, y: e.lanY, angle: c.a + k * TAU / 3, speed: 125, dmg: e.dmg * 0.55, color: '#7d72ad', size: 5, ghost: true }); }
            if (c.t <= 0) { e.cold = null; e.coldT = 7; }
          }
        }
      }
      const toP = Math.atan2(p.y - e.y, p.x - e.x), d = LF.dist(e.x, e.y, p.x, p.y);
      if (e.state !== 'cut' && e.state !== 'dash') e.face = LF.turnToward(e.face, toP, 7 * dt);
      switch (e.state) {
        case 'intro': if (e.t <= 0) { e.state = 'idle'; e.t = 1.0; } break;
        case 'idle':
          stalk(e, g, dt, (e.speed + ph * 10) * e.slowMul(g));
          if (e.t <= 0) {
            const opts = ['bolts', 'cut', 'bolts', 'unflare'];
            if (ph >= 2) opts.push('shears', 'lantern');
            if (ph >= 3) opts.push('shears', 'cut');
            e.state = B.pickAttack(e, opts);
            if (e.state === 'bolts') { e.count = 3 + (ph >= 3 ? 1 : 0); e.sub = 0; e.t = 0.45; e.aim = toP; LF.audio.play('telegraph'); }
            else if (e.state === 'cut') { e.count = Math.min(3, ph); e.sub = 0; e.t = 0.1; }
            else if (e.state === 'unflare') { e.uf = { x: e.x, y: e.y, R: 300, warn: 0.8, rings: ph >= 2 ? 2 : 1, n: 0, next: 0 }; e.t = 3.2; LF.audio.play('charge'); }
            else if (e.state === 'shears') { e.count = ph >= 3 ? 2 : 1; e.sub = 0; e.t = 0.1; }
            else if (e.state === 'lantern') { e.t = 0.6; LF.audio.play('telegraph'); }
          }
          break;
        case 'bolts':
          // black bolts, aimed where you will be
          e.red = 1;
          stalk(e, g, dt, e.speed * 0.5 * e.slowMul(g));
          if (e.t <= 0) {
            const lead = Math.min(0.5, d / 300), a = Math.atan2(p.y + p.vy * lead - e.y, p.x + p.vx * lead - e.x);
            for (const o of [-0.13, 0, 0.13]) g.fireEnemyBullet({ x: e.x + Math.cos(a) * e.r, y: e.y + Math.sin(a) * e.r, angle: a + o, speed: 290, dmg: e.dmg * 0.6, color: VOID, size: 4, life: 2.6 });
            LF.audio.play('spit'); e.fl = 1; e.aim = a;
            if (--e.count > 0) e.t = 0.42; else { e.state = 'idle'; e.t = 1.0; }
          }
          break;
        case 'cut':
          if (e.sub === 0) {
            if (e.t <= 0) {
              // it dashes through where you are going, and the air stays cut behind it
              const tx = p.x + p.vx * 0.35, ty = p.y + p.vy * 0.35;
              e.sa = Math.atan2(ty - e.y, tx - e.x); e.face = e.sa;
              const ray = g.map.raycast(e.x, e.y, Math.cos(e.sa), Math.sin(e.sa), 560) - e.r - 4;
              e.len = Math.max(60, Math.min(ray, LF.dist(e.x, e.y, tx, ty) + 170));
              e.sub = 1; e.t = ph >= 3 ? 0.42 : 0.52; LF.audio.play('telegraph');
            }
          } else {
            e.red = 1;
            const cx = Math.cos(e.sa), cy = Math.sin(e.sa);
            for (let s = 30; s <= e.len + 10; s += 46) g.hazards.push({ x: e.x + cx * s, y: e.y + cy * s, r: e.r + 16 });
            if (e.t <= 0) { e.state = 'dash'; e.k = 0; e.sx = e.x; e.sy = e.y; e.lx = cx; e.ly = cy; e.bit = false; LF.audio.play('slash'); }
          }
          break;
        case 'dash':
          e.red = 1;
          e.k = Math.min(1, e.k + dt / 0.18 * e.slowMul(g));
          e.ghosts.push({ x: e.x, y: e.y, life: 0.3, dead: false });
          e.x = e.sx + e.lx * e.len * e.k; e.y = e.sy + e.ly * e.len * e.k;
          if (!e.bit && hurtIfNear(g, e.x, e.y, e.r + 8, e.dmg * 1.15, 'the Unwritten')) e.bit = true;
          if (e.dead) return;
          if (e.k >= 1) {
            g.map.resolveCircle(e, e.r); B.clampToArena(g, e);
            addCut(e, e.sx, e.sy, e.x, e.y, 1.3 + ph * 0.25);
            if (--e.count > 0) { e.state = 'cut'; e.sub = 0; e.t = 0.24; } else { e.state = 'idle'; e.t = 1.0; }
          }
          break;
        case 'unflare': {
          // a flare turned inside out: the dark closes in from a ring, with a way through it
          const u = e.uf;
          if (!u) { e.state = 'idle'; e.t = 0.6; break; }
          e.red = 1;
          if (u.warn > 0) {
            u.warn -= dt;
            if (u.warn <= 0) u.next = 0;
          } else if (u.n < u.rings) {
            u.next -= dt;
            if (u.next <= 0) {
              const n = 34 + ph * 3, off = u.n * 0.5 * TAU / n * 4 + e.spin, gap = 9;
              for (let i = 0; i < n; i++) {
                if (i % gap < 2) continue;
                const a = off + i * TAU / n;
                g.fireEnemyBullet({ x: u.x + Math.cos(a) * u.R, y: u.y + Math.sin(a) * u.R, angle: a + Math.PI, speed: 165, dmg: e.dmg * 0.6, color: VOID, size: 5, life: u.R / 165, ghost: true });
              }
              LF.audio.play('flare'); fx.ring(u.x, u.y, u.R, u.R * 0.8, 0.3, VOID, 3);
              u.n++; u.next = 0.55;
            }
          }
          if (e.t <= 0) { e.uf = null; e.state = 'idle'; e.t = 1.0; }
          break;
        }
        case 'shears':
          if (e.sub === 0) {
            if (e.t <= 0) {
              // the blades open across you; they close along the line from it to you
              const px = p.x + p.vx * 0.2, py = p.y + p.vy * 0.2;
              e.shear = { x: px, y: py, a: Math.atan2(py - e.y, px - e.x), s: ph >= 3 ? 0.7 : 0.62, L: 300, t: ph >= 3 ? 0.75 : 0.9, snap: 0 };
              e.shear.max = e.shear.t; e.sub = 1; LF.audio.play('telegraph');
            }
          } else if (e.sub === 1) {
            const sh = e.shear;
            e.red = 1; sh.t -= dt;
            const ca = Math.cos(sh.a), sa = Math.sin(sh.a), tn = Math.tan(sh.s);
            g.hazards.push({ x: sh.x, y: sh.y, r: 44 });
            for (let s = 50; s <= sh.L; s += 50) { const w = Math.min(110, s * tn) + 10; for (const k of [-1, 1]) g.hazards.push({ x: sh.x + ca * s * k, y: sh.y + sa * s * k, r: w }); }
            if (sh.t <= 0) {
              // snap
              LF.audio.play('slash'); g.shake(6); sh.snap = 0.3; e.sub = 2; e.t = 0.35;
              if (!p.dead && p.dashing <= 0 && p.invuln <= 0) {
                const dd = LF.dist(p.x, p.y, sh.x, sh.y), pa = Math.atan2(p.y - sh.y, p.x - sh.x);
                const off = Math.min(Math.abs(LF.angDiff(pa, sh.a)), Math.abs(LF.angDiff(pa, sh.a + Math.PI)));
                if (dd < sh.L + p.r && (dd < 26 || off < sh.s)) g.hurtPlayer(e.dmg * 1.3, { x: sh.x, y: sh.y, name: 'the shears' });
              }
              const a1 = rayTo(g, sh.x, sh.y, sh.a, sh.L), a2 = rayTo(g, sh.x, sh.y, sh.a + Math.PI, sh.L);
              addCut(e, a2[2], a2[3], a1[2], a1[3], 1.1);
              fx.burst(sh.x, sh.y, 14, { color: [VOID, '#fff'], speed1: 220, life: 0.35 });
            }
          } else {
            if (e.shear) e.shear.snap -= dt;
            if (e.t <= 0) { e.shear = null; if (--e.count > 0) { e.sub = 0; e.t = 0.15; } else { e.state = 'idle'; e.t = 1.1; } }
          }
          break;
        case 'lantern':
          e.red = 1;
          if (e.t <= 0) {
            // it sets its lantern down, and the dark stays there a while
            const spots = ph >= 3 ? [[p.x, p.y], [p.x + p.vx * 0.9, p.y + p.vy * 0.9]] : [[p.x + p.vx * 0.3, p.y + p.vy * 0.3]];
            for (const sp of spots) {
              const o = g.map.nearestOpen(sp[0], sp[1]);
              B.telegraph(e, o.x, o.y, 100, 0.85, t => { if (!e.dead) { e.pools.push({ x: t.x, y: t.y, r: 100, t: 6.5, max: 6.5, tick: 0.3, dead: false }); fx.ring(t.x, t.y, 100, 20, 0.4, VOID, 4); LF.audio.play('whisper'); } }, '150,130,230');
            }
            e.state = 'idle'; e.t = 1.0;
          }
          break;
      }
    },
    draw(e, ctx, g) {
      const time = (g && g.time) || 0, ph = e.maxHp > 0 ? phase4(e) : 1;
      // the Great Lantern, dead, where it came to rest
      if (g && g.map && e.lanX !== undefined) {
        const x = e.lanX, y = e.lanY, R = 38;
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(x, y + 26, R * 1.3, R * 0.35, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#1a140c'; ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#4a3a22'; ctx.lineWidth = 4; ctx.stroke();
        ctx.strokeStyle = '#33281a'; ctx.lineWidth = 3;
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 4 + 0.2; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * R, y + Math.sin(a) * R); ctx.lineTo(x - Math.cos(a) * R, y - Math.sin(a) * R); ctx.stroke(); }
        ctx.fillStyle = '#0a0806'; ctx.beginPath(); ctx.arc(x, y, R * 0.45, 0, TAU); ctx.fill();
        // the cut end of its chain
        ctx.strokeStyle = '#3a3026'; ctx.lineWidth = 3;
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(x + R + 8 + i * 9, y - R * 0.6 - i * 5, 5, 3, -0.5, 0, TAU); ctx.stroke(); }
      }
      for (const d of (e.pools || [])) { ctx.fillStyle = `rgba(4,2,10,${0.55 * Math.min(1, d.t)})`; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU); ctx.fill(); }
      for (const c of (e.cuts || [])) { ctx.strokeStyle = `rgba(2,0,6,${0.9 * Math.min(1, c.t / 0.4)})`; ctx.lineWidth = 6; ctx.lineCap = 'round'; strokeSeg(ctx, c.s); }
      if (e.tel) B.drawTel(e, ctx, g);
      if (e.state === 'cut' && e.sub === 1) {
        ctx.strokeStyle = `rgba(255,90,90,${0.22 + 0.4 * (1 - Math.max(0, e.t) / 0.52)})`; ctx.lineWidth = (e.r + 10) * 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(e.sa) * e.len, e.y + Math.sin(e.sa) * e.len); ctx.stroke();
      }
      if (e.state === 'bolts' && e.count > 0) {
        ctx.strokeStyle = 'rgba(255,90,90,0.45)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(e.face) * 380, e.y + Math.sin(e.face) * 380); ctx.stroke(); ctx.setLineDash([]);
      }
      const sh = e.shear;
      if (sh && e.sub === 1) {
        const k = 1 - Math.max(0, sh.t) / sh.max;
        ctx.fillStyle = `rgba(255,90,90,${0.1 + 0.18 * k})`;
        for (const b of [0, Math.PI]) { ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.arc(sh.x, sh.y, sh.L, sh.a + b - sh.s, sh.a + b + sh.s); ctx.closePath(); ctx.fill(); }
        ctx.strokeStyle = 'rgba(255,90,90,0.8)'; ctx.lineWidth = 2;
        for (const b of [-sh.s, sh.s]) { ctx.beginPath(); ctx.moveTo(sh.x - Math.cos(sh.a + b) * sh.L, sh.y - Math.sin(sh.a + b) * sh.L); ctx.lineTo(sh.x + Math.cos(sh.a + b) * sh.L, sh.y + Math.sin(sh.a + b) * sh.L); ctx.stroke(); }
      }
      if (e.uf && e.uf.warn > 0) {
        const u = e.uf, k = 1 - u.warn / 0.8;
        ctx.strokeStyle = `rgba(255,90,90,${0.4 + 0.4 * k})`; ctx.lineWidth = 3; ctx.setLineDash([12, 10]);
        ctx.beginPath(); ctx.arc(u.x, u.y, u.R, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      }
      for (const gh of (e.ghosts || [])) { ctx.fillStyle = `rgba(4,2,10,${Math.max(0, gh.life / 0.3) * 0.6})`; ctx.beginPath(); ctx.arc(gh.x, gh.y, e.r, 0, TAU); ctx.fill(); }
      // the figure: one of the Wick's own kind, in the dark
      const dx = e.x - (e.figX === undefined ? e.x : e.figX), dy = e.y - (e.figY === undefined ? e.y : e.figY);
      e.figX = e.x; e.figY = e.y;
      if (dx * dx + dy * dy > 0.04) { e.figMv = Math.atan2(dy, dx); e.figGo = 0.2; } else e.figGo = (e.figGo || 0) - 1 / 60;
      const lp = LF.drawFigure(ctx, 'wick', { x: e.x, y: e.y, sc: e.r / 10, aim: e.face, mv: e.figMv || e.face, sp: e.figGo > 0 ? 130 : 0, bob: time * 11 + e.wob, t: time + e.wob, flash: e.flash > 0.6, dash: e.state === 'dash', frac: 1, st: e.fig || (e.fig = {}), pal: e.lit ? FIG_VOID_LIT : FIG_VOID_DIM });
      e.lampX = lp.x; e.lampY = lp.y;
      // the shears, at its other side
      const open = e.state === 'shears' && e.sub === 1 ? 0.6 : 0.12 + Math.sin(time * 2) * 0.04, ha = e.face - 1.9, sc = e.r / 10;
      const hx = e.x + Math.cos(ha) * 9 * sc, hy = e.y + Math.sin(ha) * 9 * sc;
      ctx.strokeStyle = e.flash > 0.6 ? '#fff' : (e.lit ? '#6a6480' : '#2a2638'); ctx.lineWidth = 2.2 * sc / 1.7; ctx.lineCap = 'round';
      for (const s of [-1, 1]) { const a = e.face + s * open; ctx.beginPath(); ctx.moveTo(hx - Math.cos(a) * 5 * sc, hy - Math.sin(a) * 5 * sc); ctx.lineTo(hx + Math.cos(a) * 15 * sc, hy + Math.sin(a) * 15 * sc); ctx.stroke(); }
    },
    drawGlow(e, ctx, g) {
      const time = (g && g.time) || 0, ph = e.maxHp > 0 ? phase4(e) : 1, sc = e.r / 10;
      // the Lantern: cold embers, and in the end your light pooling in it
      if (g && g.map && e.lanX !== undefined) {
        const x = e.lanX, y = e.lanY;
        for (let i = 0; i < 7; i++) { const a = i * 2.4 + 0.5, rr = 8 + (i * 7) % 20, f = 0.3 + 0.2 * Math.sin(time * 1.3 + i); ctx.fillStyle = `rgba(150,140,170,${f})`; ctx.beginPath(); ctx.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr, 1.6, 0, TAU); ctx.fill(); }
        if (e.lanGlow > 0) {
          const beat = 0.6 + 0.4 * Math.sin(time * 2.2);
          LF.drawGlow(ctx, '#ffd28a', x, y, 30 + 50 * e.lanGlow * beat, 0.25 * e.lanGlow);
          if (e.cold && e.cold.warn > 0) LF.drawGlow(ctx, VOID, x, y, 90, 0.4);
        }
      }
      for (const d of (e.pools || [])) { ctx.strokeStyle = `rgba(${VOID_RGB},${0.35 * Math.min(1, d.t)})`; ctx.lineWidth = 1.5; ctx.setLineDash([5, 7]); ctx.beginPath(); ctx.arc(d.x, d.y, d.r, -time * 0.5, -time * 0.5 + TAU); ctx.stroke(); ctx.setLineDash([]); }
      for (const c of (e.cuts || [])) { ctx.strokeStyle = `rgba(${VOID_RGB},${0.55 * Math.min(1, c.t / 0.4)})`; ctx.lineWidth = 1.5; ctx.lineCap = 'round'; strokeSeg(ctx, c.s); }
      const sh = e.shear;
      if (sh && sh.snap > 0) {
        ctx.strokeStyle = `rgba(235,230,255,${sh.snap / 0.3})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(sh.x - Math.cos(sh.a) * sh.L, sh.y - Math.sin(sh.a) * sh.L); ctx.lineTo(sh.x + Math.cos(sh.a) * sh.L, sh.y + Math.sin(sh.a) * sh.L); ctx.stroke();
      }
      // a faint figure of it, so it can be found in its own dark
      ctx.save(); ctx.globalAlpha = 0.45;
      LF.drawFigure(ctx, 'wick', { x: e.x, y: e.y, sc, aim: e.face, mv: e.figMv || e.face, sp: e.figGo > 0 ? 130 : 0, bob: time * 11 + e.wob, t: time + e.wob, dash: e.state === 'dash', frac: 1, st: e.figG || (e.figG = {}), pal: FIG_VOID_GLOW, noShadow: true });
      ctx.restore(); ctx.globalAlpha = 1;
      const ha = e.face - 1.9, hx = e.x + Math.cos(ha) * 9 * sc, hy = e.y + Math.sin(ha) * 9 * sc;
      ctx.strokeStyle = 'rgba(220,215,245,0.55)'; ctx.lineWidth = 1;
      const open = e.state === 'shears' && e.sub === 1 ? 0.6 : 0.12 + Math.sin(time * 2) * 0.04;
      for (const s of [-1, 1]) { const a = e.face + s * open; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.cos(a) * 15 * sc, hy + Math.sin(a) * 15 * sc); ctx.stroke(); }
      // its lantern: a black flame with a cold rim
      const lx = e.lampX === undefined ? e.x + Math.cos(e.face) * 15 * sc : e.lampX, ly = e.lampY === undefined ? e.y + Math.sin(e.face) * 15 * sc : e.lampY;
      LF.drawGlow(ctx, VOID, lx, ly, 16 * sc * (1 + e.fl * 0.4), 0.35);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(lx, ly, 3.4 * sc, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(${VOID_RGB},0.8)`; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(lx, ly, 3.6 * sc, 0, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(${VOID_RGB},0.16)`; ctx.lineWidth = 1.5; ctx.setLineDash([4, 10]);
      ctx.beginPath(); ctx.arc(e.x, e.y, e.darkR || 130, time * 0.3, time * 0.3 + TAU); ctx.stroke(); ctx.setLineDash([]);
      if (ph >= 4 && g && g.player && !g.player.dead && e.lanX !== undefined) {
        // your light, drawn off toward the Lantern
        const p = g.player;
        ctx.strokeStyle = 'rgba(255,210,140,0.18)'; ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) { const w = Math.sin(time * 3 + i * 2) * 30; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.quadraticCurveTo((p.x + e.lanX) / 2 + w, (p.y + e.lanY) / 2 - w, e.lanX, e.lanY); ctx.stroke(); }
      }
    },
    // its lantern casts darkness, where it walks and where it has set it down
    light(e, lc, white) {
      const dark = LF.glowSprite && LF.glowSprite('#000000');
      if (!dark) return;
      lc.globalCompositeOperation = 'source-over';
      const R = (e.darkR || 130) * 1.25, x = e.lampX === undefined ? e.x : e.lampX, y = e.lampY === undefined ? e.y : e.lampY;
      lc.globalAlpha = 0.75; lc.drawImage(dark, x - R, y - R, R * 2, R * 2);
      for (const d of e.pools) { const r = d.r * 1.3; lc.globalAlpha = 0.8 * Math.min(1, d.t); lc.drawImage(dark, d.x - r, d.y - r, r * 2, r * 2); }
      lc.globalCompositeOperation = 'destination-out';
      if (e.lanGlow > 0 && e.lanX !== undefined) { const r = 60 + 80 * e.lanGlow; lc.globalAlpha = 0.5 * e.lanGlow; lc.drawImage(white, e.lanX - r, e.lanY - r, r * 2, r * 2); }
      lc.globalAlpha = 1;
    },
  };
})();
