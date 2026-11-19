'use strict';
// The own things of Depth IV and Depth V (see js/sections.js and the hooks in js/features.js):
//   lamphall   The Lamplighters' Hall: darker than anywhere so far, but full of the order's lamps; each one relit gives an ember back
//   choir      The Choir Vaults: every dash rings out, and what sleeps inside the ring wakes and turns toward it
//   pages      The Archive of Names: drifting clouds of loose pages dim the lantern and hide what stands in them; a flare scatters them
//   falling    The Hanging Streets: pieces of the upside-down city fall, marked a moment before; they crush the bearer and creatures alike
//   roadlamps  The Bearers' Road: old roadside lamps flare as the bearer passes and sear what comes near them for a while
//   shrine     The Unlit Sanctum: shrines of the dark shrink the lantern near them; a few blows break one, and it gives embers back
// No hazard is laid in the start room, a shop, or a great shadow's hall (populate is only ever called for ordinary rooms,
// and the falling stone checks the room it would land in). Per-Level state lives on g.f3, keyed by the feature.
(function () {
  const LF = window.LF, TAU = LF.TAU, TILE = LF.TILE, fx = LF.fx;
  const FE = LF.FEATURES = LF.FEATURES || {};
  const play = n => { if (LF.audio) LF.audio.play(n); };
  const SAFE = { start: 1, shop: 1, boss: 1 };
  // may a hazard fall here? (never in the start room, a shop, or a great shadow's hall)
  const safeRoom = (g, x, y) => { const r = g.map.roomOf(x, y); return !!(r && SAFE[r.type]); };
  const mine = (g, key) => g.f3 && g.f3.key === key && g.section && g.section.feature === key;
  const embers = (g, x, y, n) => { if (g.player.stats.noEmbers) return; for (let i = 0; i < n; i++) g.pickups.push(new LF.Pickup('ember', x, y, LF.EMBER)); };
  // the flares that went off since the last frame: each flare burst leaves a zone of light behind it, marked here once seen
  function newFlares(g, out) {
    out.length = 0;
    for (const z of g.zones) if (z.flare && !z.f3) { z.f3 = 1; out.push(z); }
    return out;
  }
  // a prop that follows the bearer, so a feature's marks (rings, falling stone) are drawn in the glow pass and show in the dark
  function anchor(g, key) { const p = g.player; const a = { kind: 'feat', feat: key, x: p.x, y: p.y, anchor: true, room: -1 }; g.props.push(a); return a; }
  const frac = v => v - Math.floor(v);

  // ------------------------------------------------------------------ The Lamplighters' Hall
  FE.lamphall = {
    // the order's lamps line the north wall of every room, a few paces apart
    populate(map, r, rng) {
      const T = LF.T;
      let next = r.x + rng.int(1, 2), n = 0;
      for (let x = r.x + 1; x < r.x + r.w - 1 && n < 8; x++) {
        if (x < next) continue;
        const t = map.get(x, r.y);
        if ((t !== T.FLOOR && t !== T.WATER) || map.get(x, r.y - 1) !== T.WALL) continue;
        map.props.push({ kind: 'lamp', x: (x + 0.5) * TILE, y: r.y * TILE + 3, lit: false, room: r.id, hall: true });
        next = x + rng.int(2, 3); n++;
      }
    },
    start(g) {
      // the ordinary sconces laid after the rooms would crowd the hall's own: drop those that stand too close to one
      const hall = g.props.filter(pr => pr.kind === 'lamp' && pr.hall);
      if (hall.length) for (let i = g.props.length - 1; i >= 0; i--) {
        const pr = g.props[i];
        if (pr.kind === 'lamp' && !pr.hall && !pr.lit && hall.some(h => LF.dist2(h.x, h.y, pr.x, pr.y) < 90 * 90)) g.props.splice(i, 1);
      }
      g.f3 = { key: 'lamphall', seen: g.litLamps.length };
    },
    update(g, dt) {
      if (!mine(g, 'lamphall')) return;
      const s = g.f3, p = g.player;
      // every lamp relit gives a little back
      while (s.seen < g.litLamps.length) {
        const l = g.litLamps[s.seen++];
        embers(g, l.x, l.y + 14, 1);
        fx.burst(l.x, l.y - 8, 8, { color: ['#ffc46b', '#fff1cf'], speed1: 80, life: 0.6, grav: -50, size: 1.8 });
      }
      // the hall is darker than anywhere so far: the lantern reaches less far, except beside a fire or a relit lamp
      if (p.dead || g.map.boss || g.nearFire) return;
      for (const l of g.litLamps) if (LF.dist2(p.x, p.y, l.x, l.y) < 150 * 150) return;
      p.dim = Math.max(p.dim || 0, 0.8);
    },
  };

  // ------------------------------------------------------------------ The Choir Vaults
  const CHOIR = '#8fb4ff', RING_R = 290, RING_T = 0.6;
  FE.choir = {
    start(g) { g.f3 = { key: 'choir', dashes: g.run.dashes || 0, rings: [], a: anchor(g, 'choir') }; },
    update(g, dt) {
      if (!mine(g, 'choir')) return;
      const s = g.f3, p = g.player;
      s.a.x = p.x; s.a.y = p.y;
      if ((g.run.dashes || 0) > s.dashes) {
        s.dashes = g.run.dashes;
        // the sound of a dash carries; in a great shadow's hall everything is awake already
        if (!g.map.boss && s.rings.length < 6) { s.rings.push({ x: p.x, y: p.y, r: 0, t: 0 }); play('whisper'); }
      }
      for (const ring of s.rings) {
        ring.t += dt; ring.r = Math.min(RING_R, RING_R * ring.t / RING_T);
        if (ring.t > RING_T) continue;
        const rr = ring.r * ring.r;
        for (const e of g.enemies) {
          if (e.dead || e.awake || e.spawnT > 0 || e.boss || LF.dist2(e.x, e.y, ring.x, ring.y) > rr) continue;
          e.wake(g); e.face = Math.atan2(ring.y - e.y, ring.x - e.x);
          fx.ring(e.x, e.y, 4, 22, 0.35, CHOIR, 2);
        }
      }
      if (s.rings.length && s.rings[0].t > RING_T + 0.5) s.rings.shift();
    },
    glow(ctx, g, pr, x, y, t) {
      if (!pr.anchor || !mine(g, 'choir')) return;
      for (const ring of g.f3.rings) {
        const k = Math.min(1, ring.t / RING_T), fade = ring.t < RING_T ? 1 - 0.6 * k : Math.max(0, 0.4 - (ring.t - RING_T) * 0.8);
        if (fade <= 0) continue;
        ctx.strokeStyle = `rgba(143,180,255,${0.75 * fade})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(ring.x, ring.y, ring.r, 0, TAU); ctx.stroke();
        // the echo behind it, broken like a sung line
        ctx.strokeStyle = `rgba(190,210,255,${0.4 * fade})`; ctx.lineWidth = 1.5; ctx.setLineDash([12, 10]); ctx.lineDashOffset = -t * 30;
        ctx.beginPath(); ctx.arc(ring.x, ring.y, Math.max(1, ring.r * 0.82), 0, TAU); ctx.stroke();
        ctx.beginPath(); ctx.arc(ring.x, ring.y, Math.max(1, ring.r * 0.62), 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        LF.drawGlow(ctx, CHOIR, ring.x, ring.y, 30 + ring.r * 0.2, 0.18 * fade);
      }
    },
  };

  // ------------------------------------------------------------------ The Archive of Names
  const PAGE = ['#d9d2ae', '#c8c094', '#e8e2c6', '#b3ab80'];
  FE.pages = {
    populate(map, r, rng) {
      if (!rng.chance(0.7)) return;
      const n = r.w * r.h > 190 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const sp = map.randomSpot(r, rng, 2);
        map.props.push({ kind: 'feat', feat: 'pages', x: sp.x, y: sp.y, room: r.id, R: rng.range(62, 84), a: rng.range(0, TAU), seed: rng.range(0, 100),
          x0: (r.x + 2) * TILE, x1: (r.x + r.w - 2) * TILE, y0: (r.y + 2) * TILE, y1: (r.y + r.h - 2) * TILE, gone: 0, form: 1 });
      }
    },
    start(g) {
      g.f3 = { key: 'pages', list: g.props.filter(pr => pr.kind === 'feat' && pr.feat === 'pages'), fl: [] };
      // what stands in a cloud of pages is lit only deep in the lantern's light (a wrapper on this game's own isLit, put on once)
      if (!g.f3Lit) {
        g.f3Lit = true;
        const prev = g.isLit;
        g.isLit = function (x, y) {
          const lit = prev.call(this, x, y);
          if (!lit || this.litDepth >= 0.55 || !mine(this, 'pages')) return lit;
          for (const c of this.f3.list) if (c.form > 0.5 && LF.dist2(x, y, c.x, c.y) < c.R * c.R * 0.8) { this.litDepth = 0; this.litByFire = false; this.litByWax = false; return false; }
          return lit;
        };
      }
    },
    update(g, dt) {
      if (!mine(g, 'pages')) return;
      const s = g.f3, p = g.player, fl = newFlares(g, s.fl);
      let inside = false;
      for (const c of s.list) {
        // drifting slowly about its room
        c.a += Math.sin(g.time * 0.3 + c.seed) * 0.7 * dt;
        c.x += Math.cos(c.a) * 15 * dt; c.y += Math.sin(c.a) * 15 * dt;
        if (c.x < c.x0 || c.x > c.x1) { c.a = Math.PI - c.a; c.x = LF.clamp(c.x, c.x0, c.x1); }
        if (c.y < c.y0 || c.y > c.y1) { c.a = -c.a; c.y = LF.clamp(c.y, c.y0, c.y1); }
        if (c.gone > 0) { c.gone -= dt; c.form = 0; } else c.form = Math.min(1, c.form + dt / 3);
        // a flare scatters it; the pages settle back together after a while
        for (const f of fl) if (c.form > 0.1 && LF.dist2(f.x, f.y, c.x, c.y) < (f.r + c.R) * (f.r + c.R)) {
          c.gone = 10; c.form = 0;
          fx.burst(c.x, c.y, 26, { color: PAGE, speed0: 80, speed1: 300, life: 0.9, size: 2.8, drag: 3, glow: false });
          play('flutter');
        }
        if (c.form > 0.5 && !p.dead && LF.dist2(p.x, p.y, c.x, c.y) < c.R * c.R * 0.75) inside = true;
      }
      // the bearer's own light is dimmed while it walks through one
      if (inside) g.snuffCount++;
    },
    draw(ctx, g, c, x, y, t) {
      const k = c.form;
      if (k <= 0.02) return;
      const gr = ctx.createRadialGradient(x, y, 0, x, y, c.R);
      gr.addColorStop(0, `rgba(20,19,12,${0.4 * k})`); gr.addColorStop(1, 'rgba(20,19,12,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, c.R, 0, TAU); ctx.fill();
      const n = Math.round(22 * k);
      for (let i = 0; i < n; i++) {
        const f = frac(i * 0.618 + c.seed), dir = i % 2 ? 1 : -1;
        const a = c.seed * 7 + i * 2.4 + t * (0.22 + (i % 3) * 0.1) * dir, d = c.R * (0.15 + 0.8 * f);
        const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 0.75 + Math.sin(t * 1.3 + i) * 4;
        ctx.save(); ctx.translate(px, py); ctx.rotate(a + t * 0.8 * dir); ctx.scale(Math.cos(t * 2.6 + i * 1.7), 1);
        ctx.fillStyle = PAGE[i % 4]; ctx.globalAlpha = 0.85 * k; ctx.fillRect(-4, -3, 8, 6);
        ctx.fillStyle = 'rgba(60,56,36,0.8)'; ctx.fillRect(-2.6, -1.4, 5, 0.8); ctx.fillRect(-2.6, 0.6, 4, 0.8);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    },
    // a few pages catch what light there is, so a cloud can be seen coming
    glow(ctx, g, c, x, y, t) {
      const k = c.form;
      if (k <= 0.02) return;
      ctx.fillStyle = `rgba(200,211,138,${0.16 * k})`;
      for (let i = 0; i < 7; i++) {
        const a = c.seed * 3 + i * 0.9 + t * 0.3 * (i % 2 ? 1 : -1), d = c.R * (0.3 + 0.6 * frac(i * 0.37 + c.seed));
        ctx.fillRect(x + Math.cos(a) * d - 3, y + Math.sin(a) * d * 0.75 - 2, 6, 4);
      }
    },
    // and the cloud itself is a patch of dark that hides what is in it
    light(lc, white, g, c) {
      const k = c.form;
      if (k <= 0.02) return;
      const amb = g.biome.ambient;
      lc.globalCompositeOperation = 'source-over';
      const gr = lc.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.R * 1.1);
      gr.addColorStop(0, `rgba(${amb[0]},${amb[1]},${amb[2]},${0.62 * k})`); gr.addColorStop(0.7, `rgba(${amb[0]},${amb[1]},${amb[2]},${0.4 * k})`); gr.addColorStop(1, `rgba(${amb[0]},${amb[1]},${amb[2]},0)`);
      lc.fillStyle = gr; lc.beginPath(); lc.arc(c.x, c.y, c.R * 1.1, 0, TAU); lc.fill();
      lc.globalCompositeOperation = 'destination-out';
    },
  };

  // ------------------------------------------------------------------ The Hanging Streets
  const HANG = '#c49cff', FALL_T = 1.4;
  FE.falling = {
    start(g) { g.f3 = { key: 'falling', t: 4, falls: [], rubble: [], a: anchor(g, 'falling') }; },
    update(g, dt) {
      if (!mine(g, 'falling')) return;
      const s = g.f3, p = g.player, map = g.map;
      s.a.x = p.x; s.a.y = p.y;
      // now and then a piece of the city above comes down near the bearer, never in a safe room or a great shadow's hall
      if (!p.dead && !map.boss && (s.t -= dt) <= 0) {
        s.t = LF.rand(3.4, 5.6);
        for (let k = 0; k < 8; k++) {
          let x, y;
          if (Math.random() < 0.4) { x = p.x + p.vx * 0.7 + LF.rand(-50, 50); y = p.y + p.vy * 0.7 + LF.rand(-50, 50); }
          else { const a = Math.random() * TAU, d = LF.rand(70, 230); x = p.x + Math.cos(a) * d; y = p.y + Math.sin(a) * d; }
          if (map.solidAt(x, y) || safeRoom(g, x, y) || !map.los(p.x, p.y, x, y)) continue;
          s.falls.push({ x, y, R: LF.rand(44, 60), t: 0, seed: Math.random() });
          play('telegraph');
          break;
        }
      }
      for (const f of s.falls) {
        f.t += dt;
        if (f.t < FALL_T) { g.hazards.push({ x: f.x, y: f.y, r: f.R }); continue; }
        if (f.done) continue;
        f.done = true;
        play('explode'); g.shake(5);
        fx.burst(f.x, f.y, 26, { color: ['#3c3248', '#60507a', '#a58ad0', '#1e1828'], speed0: 60, speed1: 300, life: 0.7, size: 3.2, drag: 3, glow: false });
        fx.ring(f.x, f.y, f.R * 0.4, f.R * 1.15, 0.35, HANG, 4);
        s.rubble.push({ x: f.x, y: f.y, R: f.R, life: 7, seed: f.seed });
        if (s.rubble.length > 14) s.rubble.shift();
        const hr = f.R + p.r - 4;
        if (!p.dead && p.dashing <= 0 && !p.stats.trapProof && LF.dist2(p.x, p.y, f.x, f.y) < hr * hr) g.hurtPlayer(7 * g.enemyDmgMul, { x: f.x, y: f.y, name: 'a falling street' });
        // it crushes creatures just the same: a share of what they can take, so it matters at any depth
        for (const e of g.enemies) {
          if (e.dead || e.spawnT > 0 || e.intangible || LF.dist2(e.x, e.y, f.x, f.y) > (f.R + e.r) * (f.R + e.r)) continue;
          g.damageEnemy(e, e.maxHp * (e.boss ? 0.015 : 0.4), { type: 'fall', noShroud: true });
          if (!e.dead && !e.boss) e.stun = Math.max(e.stun, 0.6);
        }
      }
      if (s.falls.length && s.falls[0].done) s.falls.shift();
      for (const r of s.rubble) r.life -= dt;
      if (s.rubble.length && s.rubble[0].life <= 0) s.rubble.shift();
    },
    // on the floor: the shadow of what is coming, darkening as it nears, and the rubble it leaves
    floor(ctx, g, t, inView) {
      if (!mine(g, 'falling')) return;
      const s = g.f3;
      for (const r of s.rubble) {
        if (!inView(r.x, r.y, 80)) continue;
        ctx.globalAlpha = Math.min(1, r.life / 2);
        for (let i = 0; i < 9; i++) {
          const a = r.seed * 20 + i * 2.1, d = r.R * 0.75 * frac(r.seed * 7 + i * 0.37), sz = 3 + 5 * frac(r.seed * 3 + i * 0.71);
          ctx.fillStyle = i % 3 ? '#2a2234' : '#4a3e5c';
          ctx.fillRect(r.x + Math.cos(a) * d - sz / 2, r.y + Math.sin(a) * d * 0.8 - sz / 2, sz, sz * 0.7);
        }
      }
      ctx.globalAlpha = 1;
      for (const f of s.falls) {
        if (f.done || !inView(f.x, f.y, 80)) continue;
        const k = Math.min(1, f.t / FALL_T);
        ctx.fillStyle = `rgba(8,4,14,${0.18 + 0.5 * k})`;
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.R * (0.35 + 0.65 * k), f.R * (0.28 + 0.52 * k), 0, 0, TAU); ctx.fill();
      }
    },
    // the piece itself, the last moment before it lands: a block of upside-down street, a window still in it
    draw(ctx, g, pr, x, y, t) {
      if (!pr.anchor || !mine(g, 'falling')) return;
      for (const f of g.f3.falls) {
        if (f.done || f.t < FALL_T - 0.4) continue;
        const u = (f.t - (FALL_T - 0.4)) / 0.4, h = 300 * (1 - u) * (1 - u), w = f.R * 0.9, by = f.y - h;
        ctx.fillStyle = '#2b2338'; ctx.beginPath(); ctx.moveTo(f.x - w, by - w * 0.9); ctx.lineTo(f.x + w, by - w * 0.9); ctx.lineTo(f.x + w * 0.7, by); ctx.lineTo(f.x - w * 0.7, by); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#3c3250'; ctx.fillRect(f.x - w * 0.55, by - w * 0.75, w * 1.1, w * 0.12);
        // its roof points down
        ctx.fillStyle = '#1c1626'; ctx.beginPath(); ctx.moveTo(f.x - w * 0.7, by); ctx.lineTo(f.x + w * 0.7, by); ctx.lineTo(f.x, by + w * 0.5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(196,156,255,0.7)'; ctx.fillRect(f.x - 4, by - w * 0.55, 8, 10);
      }
    },
    // the mark: a ring where it will land, and a second ring closing in on it as the moment comes
    glow(ctx, g, pr, x, y, t) {
      if (!pr.anchor || !mine(g, 'falling')) return;
      for (const f of g.f3.falls) {
        if (f.done) continue;
        const k = Math.min(1, f.t / FALL_T);
        ctx.strokeStyle = `rgba(196,156,255,${0.35 + 0.45 * k})`; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.R, 0, TAU); ctx.stroke();
        ctx.strokeStyle = `rgba(255,120,140,${0.25 + 0.6 * k})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(f.x, f.y, Math.max(2, f.R * (1.6 - 1.6 * k)), 0, TAU); ctx.stroke();
        LF.drawGlow(ctx, HANG, f.x, f.y, f.R * 1.2, 0.08 + 0.14 * k);
      }
    },
  };

  // ------------------------------------------------------------------ The Bearers' Road
  const ROAD = '#ffcf6b', SEAR_R = 150, ROAD_ON = 8, ROAD_CD = 20;
  FE.roadlamps = {
    populate(map, r, rng) {
      if (!rng.chance(0.75)) return;
      const n = r.w * r.h > 190 ? 2 : 1;
      for (let i = 0; i < n; i++) { const sp = map.randomSpot(r, rng, 1, { x: r.cx * TILE, y: r.cy * TILE }, 90); map.props.push({ kind: 'feat', feat: 'roadlamps', x: sp.x, y: sp.y, room: r.id, on: 0, cd: 0 }); }
    },
    start(g) { g.f3 = { key: 'roadlamps', list: g.props.filter(pr => pr.kind === 'feat' && pr.feat === 'roadlamps') }; },
    update(g, dt) {
      if (!mine(g, 'roadlamps')) return;
      const p = g.player;
      for (const l of g.f3.list) {
        l.cd -= dt;
        if (l.on <= 0 && l.cd <= 0 && !p.dead && LF.dist2(p.x, p.y, l.x, l.y) < 80 * 80) {
          // it knows the bearer: it flares up as one passes
          l.on = ROAD_ON; l.cd = ROAD_CD;
          fx.burst(l.x, l.y - 34, 16, { color: ['#ffcf6b', '#fff1c8'], speed1: 160, life: 0.6, grav: -60, size: 2.2 });
          fx.ring(l.x, l.y, 10, SEAR_R, 0.45, ROAD, 3);
          play('brazier');
        }
        if (l.on <= 0) continue;
        l.on -= dt;
        const k = Math.min(1, l.on / 1.5);
        // and for a while it sears what comes near, and shows it
        for (const e of g.enemies) {
          if (e.dead || e.spawnT > 0 || e.intangible || LF.dist2(e.x, e.y, l.x, l.y) > (SEAR_R + e.r) * (SEAR_R + e.r)) continue;
          e.glow = Math.max(e.glow || 0, 0.2);
          g.damageEnemy(e, e.maxHp * (e.boss ? 0.004 : 0.075) * k * dt, { type: 'lamp', quiet: true, noShroud: true });
          if (Math.random() < dt * 4) fx.spawn({ x: e.x + LF.rand(-e.r, e.r) * 0.6, y: e.y, vx: LF.rand(-10, 10), vy: -40, life: 0.4, size: 1.6, color: '#ffcf6b', drag: 1 });
        }
      }
    },
    draw(ctx, g, l, x, y, t) {
      const on = l.on > 0 ? Math.min(1, l.on / 1.5) : 0;
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(x, y + 2, 11, 5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#4c4029'; ctx.fillRect(x - 7, y - 4, 14, 6);                  // a milestone base
      ctx.fillStyle = '#2a241a'; ctx.fillRect(x - 2, y - 34, 4, 31);                 // the iron post
      ctx.fillStyle = '#1a160f'; ctx.fillRect(x - 7, y - 47, 14, 3); ctx.fillRect(x - 6, y - 34, 12, 2);
      ctx.fillStyle = on ? `rgba(255,${200 + 40 * on | 0},140,${0.5 + 0.45 * on})` : 'rgba(110,84,40,0.6)';
      ctx.fillRect(x - 5, y - 44, 10, 10);                                           // the glass
      ctx.strokeStyle = '#1a160f'; ctx.lineWidth = 1; ctx.strokeRect(x - 5, y - 44, 10, 10);
      ctx.beginPath(); ctx.moveTo(x, y - 44); ctx.lineTo(x, y - 34); ctx.stroke();
    },
    glow(ctx, g, l, x, y, t) {
      const on = l.on > 0 ? Math.min(1, l.on / 1.5) : 0;
      if (!on) { LF.drawGlow(ctx, ROAD, x, y - 39, 12 + Math.sin(t * 3 + x) * 1.5, l.cd > 0 ? 0.12 : 0.3); return; }
      LF.drawGlow(ctx, ROAD, x, y - 39, 34 + Math.sin(t * 11 + x) * 3, 0.65 * on);
      LF.drawGlow(ctx, '#ffffff', x, y - 39, 10, 0.8 * on);
      // how far it reaches
      ctx.strokeStyle = `rgba(255,207,107,${0.28 * on})`; ctx.lineWidth = 1.5; ctx.setLineDash([4, 10]); ctx.lineDashOffset = t * 12;
      ctx.beginPath(); ctx.arc(x, y, SEAR_R, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    },
    light(lc, white, g, l) {
      const on = l.on > 0 ? Math.min(1, l.on / 1.5) : 0;
      if (on) { lc.globalAlpha = 0.85 * on; lc.drawImage(white, l.x - 175, l.y - 175, 350, 350); }
      else { lc.globalAlpha = l.cd > 0 ? 0.25 : 0.45; lc.drawImage(white, l.x - 40, l.y - 70, 80, 80); }
    },
  };

  // ------------------------------------------------------------------ The Unlit Sanctum
  const SANCT = '#8fe08a', NEAR = 130, FAR = 260, SHRINE_HP = 6;
  FE.shrine = {
    populate(map, r, rng) {
      if (!rng.chance(0.55)) return;
      const sp = map.randomSpot(r, rng, 2);
      map.props.push({ kind: 'feat', feat: 'shrine', x: sp.x, y: sp.y, room: r.id, hp: SHRINE_HP, broken: false, hitT: 0, dashT: 0, seed: rng.range(0, 100) });
    },
    start(g) { g.f3 = { key: 'shrine', list: g.props.filter(pr => pr.kind === 'feat' && pr.feat === 'shrine'), fl: [] }; },
    update(g, dt) {
      if (!mine(g, 'shrine')) return;
      const s = g.f3, p = g.player, fl = newFlares(g, s.fl);
      let pull = 0;
      for (const sh of s.list) {
        if (sh.broken) continue;
        sh.hitT -= dt; sh.dashT -= dt;
        const d2 = LF.dist2(p.x, p.y, sh.x, sh.y);
        if (d2 > 800 * 800) continue;
        if (!p.dead) pull = Math.max(pull, d2 < NEAR * NEAR ? 2 : d2 < FAR * FAR ? 1 : 0);
        // a few blows break it: bolts, a dash through it, or a flare counts for three
        let dmg = 0;
        for (const b of g.bullets) if (!b.dead && LF.dist2(b.x, b.y, sh.x, sh.y - 10) < 18 * 18) { b.dead = true; dmg += b.minor ? 0.5 : 1; }
        if (p.dashing > 0 && sh.dashT <= 0 && d2 < 26 * 26) { sh.dashT = 0.5; dmg += 2; }
        for (const f of fl) if (LF.dist2(f.x, f.y, sh.x, sh.y) < f.r * f.r) dmg += 3;
        if (dmg > 0) FE.shrine.hit(g, sh, dmg);
      }
      // the dark it was built for drinks the bearer's light
      if (pull) g.snuffCount += pull;
    },
    hit(g, sh, n) {
      sh.hp -= n; sh.hitT = 0.18;
      fx.burst(sh.x, sh.y - 12, 6, { color: ['#24302a', '#8fe08a', '#0b0f0c'], speed1: 120, life: 0.35, size: 2, glow: false });
      play('hit');
      if (sh.hp > 0) return;
      sh.broken = true;
      fx.burst(sh.x, sh.y - 12, 26, { color: ['#24302a', '#3a4a3e', '#8fe08a', '#e8ffe0'], speed0: 60, speed1: 280, life: 0.7, size: 3, drag: 3, glow: false });
      fx.ring(sh.x, sh.y, 10, 90, 0.4, SANCT, 3);
      embers(g, sh.x, sh.y, 3);
      play('kill'); g.shake(3);
    },
    draw(ctx, g, sh, x, y, t) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(x, y + 3, 18, 7, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#24302a'; ctx.fillRect(x - 15, y - 6, 30, 9);                  // the plinth
      ctx.fillStyle = '#36463b'; ctx.fillRect(x - 15, y - 6, 30, 2);
      // the heap of snuffed wicks offered on it
      ctx.lineCap = 'round';
      for (let i = 0; i < 9; i++) {
        const wx = x - 11 + i * 2.7, h = 4 + 4 * frac(sh.seed + i * 0.37), lean = (frac(sh.seed * 3 + i * 0.61) - 0.5) * 3;
        ctx.strokeStyle = '#cfc8b0'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(wx, y - 6); ctx.lineTo(wx + lean, y - 6 - h); ctx.stroke();
        ctx.fillStyle = '#050605'; ctx.fillRect(wx + lean - 1, y - 8 - h, 2, 2.5);
      }
      if (sh.broken) {
        ctx.fillStyle = '#1a221d'; for (let i = 0; i < 5; i++) ctx.fillRect(x - 12 + i * 5, y - 18 + (i % 2) * 4, 4, 3);
        return;
      }
      // the hollow it keeps: a black stone that drinks the light, cracking as it is struck
      const shk = sh.hitT > 0 ? Math.sin(t * 90) * 2 : 0, cy = y - 22;
      ctx.fillStyle = sh.hitT > 0 ? '#4a5a4e' : '#050806';
      ctx.beginPath(); ctx.ellipse(x + shk, cy, 10, 12, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(143,224,138,0.35)'; ctx.lineWidth = 1.2; ctx.stroke();
      const cracks = SHRINE_HP - Math.max(0, sh.hp);
      ctx.strokeStyle = 'rgba(143,224,138,0.8)'; ctx.lineWidth = 1;
      for (let i = 0; i < cracks; i++) {
        const a = sh.seed + i * 1.9;
        ctx.beginPath(); ctx.moveTo(x + shk, cy); ctx.lineTo(x + shk + Math.cos(a) * 6, cy + Math.sin(a) * 7); ctx.lineTo(x + shk + Math.cos(a + 0.5) * 9, cy + Math.sin(a + 0.5) * 11); ctx.stroke();
      }
    },
    glow(ctx, g, sh, x, y, t) {
      if (sh.broken) return;
      LF.drawGlow(ctx, SANCT, x, y - 22, 16 + Math.sin(t * 2 + sh.seed) * 2, 0.16 + (sh.hitT > 0 ? 0.4 : 0));
      // where its pull begins, faint and slowly turning
      ctx.strokeStyle = 'rgba(143,224,138,0.13)'; ctx.lineWidth = 1.5; ctx.setLineDash([2, 14]); ctx.lineDashOffset = -t * 8;
      ctx.beginPath(); ctx.arc(x, y, NEAR, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    },
    // a pocket of dark around it, whatever else is lit
    light(lc, white, g, sh) {
      if (sh.broken) return;
      const amb = g.biome.ambient;
      lc.globalCompositeOperation = 'source-over';
      const gr = lc.createRadialGradient(sh.x, sh.y, 0, sh.x, sh.y, NEAR);
      gr.addColorStop(0, `rgba(${amb[0]},${amb[1]},${amb[2]},0.55)`); gr.addColorStop(1, `rgba(${amb[0]},${amb[1]},${amb[2]},0)`);
      lc.fillStyle = gr; lc.beginPath(); lc.arc(sh.x, sh.y, NEAR, 0, TAU); lc.fill();
      lc.globalCompositeOperation = 'destination-out';
    },
  };
})();
