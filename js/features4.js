'use strict';
// Depth VI's three sections (see js/sections.js and the hooks in js/features.js):
//   prism  The Fallen Glass: shards of the Lantern's lens stand in the rooms. Shots glance off them, yours and theirs,
//          and nothing walks through them.
//   ash    The Cinder Fields: drifts of ash. Standing in one burns the lantern down faster; a flare blows it away for a while.
//   rest   The Lantern's Rest: the last of its light lies pooled on the floor. A pool gives embers back, slowly, but the
//          creatures are drawn to it too. Everywhere else the dark is closer.
(function () {
  const LF = window.LF, TAU = Math.PI * 2;
  LF.FEATURES = LF.FEATURES || {};

  // How hard a feature bites, scaled the way creature harm is (Game.loadFloor's enemyDmgMul), 1 at the start of the descent.
  const harm = g => LF.clamp((g.enemyDmgMul || 1.8) / 1.8, 1, 3.5);
  // a stable 0..1 number for a place, for drawing
  const seedOf = (x, y) => { const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return h - Math.floor(h); };
  // a room the feature may use: plain rooms and ambushes only (never the start, the boss, the Chandler, shrines, vaults ...)
  const usable = room => room.type === 'normal' || room.type === 'ambush';
  // a spot in a room that keeps clear of the props already there
  function clearSpot(map, room, rng, margin, gap, extra) {
    const m = Math.max(1, Math.min(margin, Math.floor((Math.min(room.w, room.h) - 2) / 2)));
    for (let tries = 0; tries < 24; tries++) {
      const sp = map.randomSpot(room, rng, m);
      if (map.solidAt(sp.x, sp.y)) continue;
      let ok = true;
      for (const pr of map.props) if (pr.room === room.id && LF.dist2(pr.x, pr.y, sp.x, sp.y) < gap * gap) { ok = false; break; }
      if (ok && extra) for (const q of extra) if (LF.dist2(q.x, q.y, sp.x, sp.y) < gap * gap) { ok = false; break; }
      if (ok) return sp;
    }
    return null;
  }
  // The feature's props on this Level, gathered once per map.
  function state(g, key) {
    let st = g._feat4;
    if (!st || st.map !== g.map || st.key !== key) {
      st = g._feat4 = { key, map: g.map, list: [], near: [] };
      for (const pr of g.props) if (pr.kind === 'feat' && pr.feat === key) st.list.push(pr);
    }
    return st;
  }
  // move an entity by (dx, dy) unless that puts it in a wall (each axis on its own, so it slides)
  function nudge(map, e, dx, dy) {
    if (!map.solidAt(e.x + dx, e.y)) e.x += dx;
    if (!map.solidAt(e.x, e.y + dy)) e.y += dy;
  }

  // put an entity back outside a shard's foot (radius R), sliding `side` px a frame round it; one dead on the centre goes out by the shard's own lean
  function pushOut(map, e, s, R, side) {
    let nx = e.x - s.x, ny = e.y - s.y, d = Math.hypot(nx, ny);
    if (d < 0.5) { const a = s.seed * TAU; nx = Math.cos(a); ny = Math.sin(a); d = 0; } else { nx /= d; ny /= d; }
    const k = R - d;
    nudge(map, e, nx * k - ny * side, ny * k + nx * side);
  }

  // ------------------------------------------------------------------ prism: The Fallen Glass
  // Turn a shot that crossed a shard this frame: from (x0, y0) to (x1, y1), radius `r`. Returns true if it glanced.
  function glance(s, b, x0, y0, r) {
    const R = s.r + r, x1 = b.x, y1 = b.y;
    const dx = x1 - x0, dy = y1 - y0, fx0 = x0 - s.x, fy0 = y0 - s.y;
    const a = dx * dx + dy * dy, bq = 2 * (fx0 * dx + fy0 * dy), c = fx0 * fx0 + fy0 * fy0 - R * R;
    let t;
    if (c <= 0) t = 0; // it began inside (spawned there, or the shard grew round it): push it out from where it is
    else {
      if (a < 1e-6) return false;
      const disc = bq * bq - 4 * a * c;
      if (disc < 0) return false;
      t = (-bq - Math.sqrt(disc)) / (2 * a);
      if (t < 0 || t > 1) return false;
    }
    const hx = x0 + dx * t, hy = y0 + dy * t;
    let nx = hx - s.x, ny = hy - s.y; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
    const vn = b.vx * nx + b.vy * ny;
    if (vn >= 0 && c <= 0) { b.x = s.x + nx * (R + 1); b.y = s.y + ny * (R + 1); return false; } // already leaving
    b.vx -= 2 * vn * nx; b.vy -= 2 * vn * ny;
    const left = Math.sqrt(a) * (1 - t), sp = Math.hypot(b.vx, b.vy) || 1;
    b.x = s.x + nx * (R + 1) + b.vx / sp * left; b.y = s.y + ny * (R + 1) + b.vy / sp * left;
    if (LF.fx) LF.fx.burst(hx, hy, 4, { color: ['#bff3ff', '#ffffff', '#7fd8f0'], speed1: 120, life: 0.25, size: 1.6, angle: Math.atan2(ny, nx), spread: 1.6 });
    s.flash = 1;
    return true;
  }
  LF.FEATURES.prism = {
    populate(map, room, rng) {
      if (!usable(room) || !rng.chance(0.85)) return;
      const n = rng.int(2, Math.max(2, Math.min(4, Math.floor(room.w * room.h / 50)))), placed = [];
      for (let i = 0; i < n; i++) {
        const sp = clearSpot(map, room, rng, 2, 84, placed);
        if (!sp) break;
        const pr = { kind: 'feat', feat: 'prism', x: sp.x, y: sp.y, room: room.id, r: rng.range(17, 25), lean: rng.range(-0.35, 0.35), h: rng.range(44, 70), seed: rng.range(0, 1), flash: 0 };
        placed.push(pr); map.props.push(pr);
      }
    },
    start(g) { state(g, 'prism'); },
    update(g, dt) {
      const st = state(g, 'prism'), p = g.player, map = g.map, near = st.near;
      near.length = 0;
      for (const s of st.list) { if (s.flash > 0) s.flash = Math.max(0, s.flash - dt * 3); if (LF.dist2(s.x, s.y, p.x, p.y) < 1100 * 1100) near.push(s); }
      if (!near.length) return;
      // shots glance off the glass: the lantern's bolts (not a gout in the air or a censer on its chain) and the creatures'
      for (const b of g.bullets) {
        if (b.dead || b.lob || b.ret) continue;
        for (const s of near) if (LF.dist2(b.x, b.y, s.x, s.y) < (s.r + 60) * (s.r + 60) && glance(s, b, b.px, b.py, b.r)) { b.hit && b.hit.clear && b.hit.clear(); break; }
      }
      for (const b of g.ebullets) {
        if (b.dead || b.ghost) continue;
        for (const s of near) if (LF.dist2(b.x, b.y, s.x, s.y) < (s.r + 50) * (s.r + 50) && glance(s, b, b.x - b.vx * dt, b.y - b.vy * dt, b.r)) break;
      }
      // nothing walks through a shard
      for (const s of near) {
        if (!p.dead) {
          const R = s.r + p.r, d2 = LF.dist2(p.x, p.y, s.x, s.y);
          if (d2 < R * R) pushOut(map, p, s, R, 0);
        }
        for (const e of g.enemies) {
          if (e.dead || e.boss || e.def.ghost || e.def.flies || e.intangible) continue;
          const R = s.r + e.r * 0.85;
          // pushed out, and a little sideways, so a creature that walks straight at it slides round
          if (LF.dist2(e.x, e.y, s.x, s.y) < R * R) pushOut(map, e, s, R, 0.6);
        }
        // the bot steers round the glass the way it steers round danger
        if (g.hazards) g.hazards.push({ x: s.x, y: s.y, r: s.r - 8 });
      }
    },
    // a shard of the lens standing on its edge: a tall leaning blade of pale glass, its foot in the stone
    draw(ctx, g, pr, x, y, time) {
      const r = pr.r, h = pr.h, ln = pr.lean, sd = pr.seed;
      ctx.fillStyle = 'rgba(4,10,14,0.45)'; ctx.beginPath(); ctx.ellipse(x, y + 2, r * 1.05, r * 0.5, 0, 0, TAU); ctx.fill();
      const tipX = x + ln * h, tipY = y - h, w = r * 0.95;
      // body
      const gr = ctx.createLinearGradient(x - w, y, x + w, tipY);
      gr.addColorStop(0, 'rgba(70,110,130,0.85)'); gr.addColorStop(0.45, 'rgba(150,215,235,0.7)'); gr.addColorStop(1, 'rgba(210,248,255,0.85)');
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x - w * 0.55 + ln * h * 0.6, y - h * (0.62 + 0.2 * sd)); ctx.lineTo(tipX, tipY); ctx.lineTo(x + w * 0.4 + ln * h * 0.75, y - h * 0.7); ctx.lineTo(x + w, y); ctx.closePath(); ctx.fill();
      // facets and the bright edge
      ctx.strokeStyle = 'rgba(191,243,255,0.9)'; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x - w * 0.2, y - 2); ctx.lineTo(tipX - 1, tipY + 4); ctx.moveTo(x + w * 0.5, y - 3); ctx.lineTo(x + ln * h * 0.5, y - h * 0.5); ctx.stroke();
      // a glint that walks up the glass
      const k = (time * 0.35 + sd) % 1, gx = x + (tipX - x) * k, gy = y + (tipY - y) * k;
      ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.5 * Math.sin(k * Math.PI)})`; ctx.beginPath(); ctx.arc(gx, gy, 1.8, 0, TAU); ctx.fill();
      // the foot, a ring of crushed glass
      ctx.strokeStyle = 'rgba(191,243,255,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.5, 0, 0, TAU); ctx.stroke();
    },
    glow(ctx, g, pr, x, y, time) {
      LF.drawGlow(ctx, '#bff3ff', x + pr.lean * pr.h * 0.5, y - pr.h * 0.5, pr.h * 0.55, 0.12 + 0.05 * Math.sin(time * 1.3 + pr.seed * 9) + 0.5 * (pr.flash || 0));
      LF.drawGlow(ctx, '#ffffff', x + pr.lean * pr.h, y - pr.h, 8, 0.3);
    },
    light(lc, white, g, pr) { lc.globalAlpha = 0.18 + 0.4 * (pr.flash || 0); lc.drawImage(white, pr.x - 40, pr.y - pr.h * 0.5 - 40, 80, 80); },
  };

  // ------------------------------------------------------------------ ash: The Cinder Fields
  const ASH_BLOWN = 14;               // seconds a flare keeps a drift away
  const ashAmount = pr => pr.blown > 0 ? (pr.blown < 3 ? 1 - pr.blown / 3 : 0) : 1;
  const inAsh = (pr, x, y) => { const dx = (x - pr.x) / pr.r, dy = (y - pr.y) / (pr.r * 0.68); return dx * dx + dy * dy < 1; };
  LF.FEATURES.ash = {
    populate(map, room, rng) {
      if (!usable(room)) return;
      const n = rng.int(3, Math.max(3, Math.min(5, 1 + Math.floor(room.w * room.h / 45)))), placed = [];
      for (let i = 0; i < n; i++) {
        const sp = clearSpot(map, room, rng, 2, 40, placed);
        if (!sp) break;
        const pr = { kind: 'feat', feat: 'ash', x: sp.x, y: sp.y, room: room.id, r: rng.range(58, 104), seed: rng.range(0, 1), blown: 0 };
        placed.push(pr); map.props.push(pr);
      }
    },
    start(g) { state(g, 'ash').inT = 0; },
    update(g, dt) {
      const st = state(g, 'ash'), p = g.player;
      // a flare blows the ash away from where it burst
      for (const z of g.zones) {
        if (!z.flare || z._ash) continue;
        z._ash = 1;
        const R = z.r / 1.3 + 30;
        for (const pr of st.list) {
          if (LF.dist2(pr.x, pr.y, z.x, z.y) > (R + pr.r) * (R + pr.r)) continue;
          if (ashAmount(pr) > 0.2 && LF.fx) {
            const a = Math.atan2(pr.y - z.y, pr.x - z.x);
            LF.fx.burst(pr.x, pr.y, 16, { color: ['#8a8280', '#5e5856', '#ff7f5a'], speed0: 60, speed1: 220, life: 0.8, size: 3, drag: 2, angle: a, spread: 2.2, glow: false });
          }
          pr.blown = ASH_BLOWN;
        }
      }
      let deep = 0;
      for (const pr of st.list) {
        if (pr.blown > 0) pr.blown = Math.max(0, pr.blown - dt);
        if (!p.dead && LF.dist2(pr.x, pr.y, p.x, p.y) < pr.r * pr.r && inAsh(pr, p.x, p.y)) deep = Math.max(deep, ashAmount(pr));
      }
      st.inT = deep > 0.5 ? Math.min(1, (st.inT || 0) + dt * 3) : Math.max(0, (st.inT || 0) - dt * 3);
      // the ash smothers the flame: the lantern burns down faster while it stands in a drift (never all the way out by
      // itself: the lantern's own burning does that)
      if (st.inT > 0 && g.drainActive && !p.dead && p.light > 3) {
        const s = p.stats, base = (0.9 + 0.05 * g.floor) * s.drainMul * g.diff.drain;
        p.light = Math.max(3, p.light - base * 0.55 * harm(g) * st.inT * dt);
        if (Math.random() < dt * 8 && LF.fx) LF.fx.spawn({ x: p.x + LF.rand(-8, 8), y: p.y + 4, vx: LF.rand(-14, 14), vy: LF.rand(-40, -18), life: 0.8, size: 2, color: '#7a7270', drag: 1, glow: false });
      }
    },
    // the drifts, under everything: grey heaps with the warm dark of the cinders in them
    floor(ctx, g, time, inView) {
      const st = state(g, 'ash');
      for (const pr of st.list) {
        if (!inView(pr.x, pr.y, pr.r + 20)) continue;
        const am = ashAmount(pr);
        if (am <= 0.02) {
          // swept: a ring of what the flare pushed aside
          ctx.strokeStyle = 'rgba(110,102,98,0.35)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(pr.x, pr.y, pr.r * 1.02, pr.r * 0.7, 0, 0, TAU); ctx.stroke();
          continue;
        }
        const sd = pr.seed;
        ctx.fillStyle = `rgba(30,26,26,${0.35 * am})`; ctx.beginPath(); ctx.ellipse(pr.x, pr.y + 3, pr.r * 1.04, pr.r * 0.72, 0, 0, TAU); ctx.fill();
        for (let i = 0; i < 5; i++) {
          const a = sd * 9 + i * 1.3, d = i ? pr.r * 0.38 : 0, rr = pr.r * (i ? 0.55 : 0.78) * am;
          const bx = pr.x + Math.cos(a) * d, by = pr.y + Math.sin(a) * d * 0.68;
          ctx.fillStyle = i ? `rgba(${118 + i * 6},${110 + i * 5},${106 + i * 4},${0.55 * am})` : `rgba(96,90,88,${0.75 * am})`;
          ctx.beginPath(); ctx.ellipse(bx, by, rr, rr * 0.66, 0, 0, TAU); ctx.fill();
        }
        // pale crust and a few slow cinders under it
        ctx.strokeStyle = `rgba(170,160,154,${0.35 * am})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(pr.x, pr.y, pr.r * 0.96 * (0.6 + 0.4 * am), pr.r * 0.66 * (0.6 + 0.4 * am), 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
        for (let i = 0; i < 4; i++) {
          const a = sd * 20 + i * 1.7, d = pr.r * 0.55 * ((sd * (i + 3)) % 1);
          const k = 0.5 + 0.5 * Math.sin(time * (0.8 + i * 0.3) + sd * 30 + i);
          ctx.fillStyle = `rgba(255,127,90,${(0.15 + 0.45 * k) * am})`; ctx.beginPath(); ctx.arc(pr.x + Math.cos(a) * d, pr.y + Math.sin(a) * d * 0.68, 1.6, 0, TAU); ctx.fill();
        }
      }
    },
    // cinders glow through the dark, so a drift can be seen before the light reaches it
    glow(ctx, g, pr, x, y, time) {
      const am = ashAmount(pr);
      if (am <= 0.05) return;
      for (let i = 0; i < 3; i++) {
        const a = pr.seed * 13 + i * 2.1, d = pr.r * 0.5 * ((pr.seed * (i + 5)) % 1);
        LF.drawGlow(ctx, '#ff7f5a', x + Math.cos(a) * d, y + Math.sin(a) * d * 0.68, 9, (0.12 + 0.1 * Math.sin(time * 0.9 + i + pr.seed * 20)) * am);
      }
    },
  };

  // ------------------------------------------------------------------ rest: The Lantern's Rest
  const POOL_MAX = 50;                // light a pool holds; it fills again, slowly
  LF.FEATURES.rest = {
    populate(map, room, rng) {
      if (!usable(room) || !rng.chance(0.55)) return;
      const sp = clearSpot(map, room, rng, 3, 70);
      if (!sp) return;
      map.props.push({ kind: 'feat', feat: 'rest', x: sp.x, y: sp.y, room: room.id, r: rng.range(56, 78), seed: rng.range(0, 1), res: POOL_MAX, drink: 0 });
    },
    start(g) { state(g, 'rest'); },
    update(g, dt) {
      const st = state(g, 'rest'), p = g.player, map = g.map;
      let inPool = null;
      const pull = 14 * harm(g) * dt;
      for (const pr of st.list) {
        pr.res = Math.min(POOL_MAX, pr.res + 0.4 * dt);
        pr.drink = Math.max(0, pr.drink - dt * 2);
        const here = !p.dead && LF.dist2(pr.x, pr.y, p.x, p.y) < pr.r * pr.r * 0.85;
        if (here) inPool = pr;
        // the creatures are drawn to the light as well: those in its room that are not hunting gather at it, and once
        // the lantern stands in it, the hunters come to it faster
        for (const e of g.enemies) {
          if (e.dead || e.boss || e.room !== pr.room || e.spawnT > 0 || e.intangible || e.def.ghost || (e.awake && !here)) continue;
          const dx = pr.x - e.x, dy = pr.y - e.y, d2 = dx * dx + dy * dy;
          if (d2 < pr.r * pr.r * 0.3 || d2 > 460 * 460) continue;
          const d = Math.sqrt(d2);
          nudge(map, e, dx / d * pull, dy / d * pull);
        }
      }
      // standing in it gives embers back, slowly
      if (inPool && inPool.res > 0.5 && p.light < p.stats.maxLight) {
        const v = Math.min(inPool.res, 3.2 * dt);
        p.addLight(v); inPool.res -= v; inPool.drink = 1;
        if (Math.random() < dt * 10 && LF.fx) LF.fx.spawn({ x: p.x + LF.rand(-14, 14), y: p.y + LF.rand(-4, 8), vx: LF.rand(-6, 6), vy: LF.rand(-55, -30), life: 0.7, size: 1.8, color: '#ffe08a', drag: 1 });
      }
      // everywhere else, the dark is closer (not in a great shadow's hall, which keeps its own light)
      if (!p.dead && !inPool && !map.boss) p.lightR = Math.min(p.lightR, p.lightRT * 0.8);
    },
    // a shallow pool of gold light on the stone, with slow rings on it
    floor(ctx, g, time, inView) {
      const st = state(g, 'rest');
      for (const pr of st.list) {
        if (!inView(pr.x, pr.y, pr.r + 30)) continue;
        const f = 0.35 + 0.65 * pr.res / POOL_MAX, r = pr.r;
        const gr = ctx.createRadialGradient(pr.x, pr.y, 0, pr.x, pr.y, r);
        gr.addColorStop(0, `rgba(255,236,170,${0.75 * f})`); gr.addColorStop(0.55, `rgba(255,214,120,${0.45 * f})`); gr.addColorStop(1, 'rgba(160,120,40,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(pr.x, pr.y, r, r * 0.62, 0, 0, TAU); ctx.fill();
        for (let i = 0; i < 3; i++) {
          const k = (time * 0.22 + i / 3 + pr.seed) % 1;
          ctx.strokeStyle = `rgba(255,240,190,${(1 - k) * 0.4 * f})`; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.ellipse(pr.x, pr.y, r * (0.2 + 0.7 * k), r * 0.62 * (0.2 + 0.7 * k), 0, 0, TAU); ctx.stroke();
        }
        ctx.strokeStyle = `rgba(255,224,138,${0.3 * f})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(pr.x, pr.y, r * 0.96, r * 0.6, 0, 0, TAU); ctx.stroke();
      }
    },
    glow(ctx, g, pr, x, y, time) {
      const f = 0.35 + 0.65 * pr.res / POOL_MAX;
      LF.drawGlow(ctx, '#ffe08a', x, y, pr.r * 1.15, (0.22 + 0.04 * Math.sin(time * 1.1 + pr.seed * 7)) * f + 0.12 * pr.drink);
    },
    light(lc, white, g, pr) {
      const f = 0.35 + 0.65 * pr.res / POOL_MAX, R = pr.r * 1.5;
      lc.globalAlpha = 0.75 * f; lc.drawImage(white, pr.x - R, pr.y - R * 0.8, R * 2, R * 1.6);
    },
  };
})();
