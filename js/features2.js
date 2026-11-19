'use strict';
// The own things of Depth II and Depth III (see js/sections.js and the hooks in js/features.js):
//   sluice    The Sluice Works: channels cross some rooms; they flood on a cycle (a trickle first) and slow whoever wades them
//   ossuary   The Ossuary Stair: heaps of bones stand like low walls; a bolt or a dash brings one down, and sometimes something with it
//   pendulum  The Pendulum Hall: great weights swing on chains along a groove worn in the floor; they strike the bearer and creatures alike
//   runnel    The Chainworks: molten runnels cross the floor; they brighten, then flare, and burn whoever stands in them
//   softwax   The Wax Galleries: soft old wax on the floor slows everyone; a creature standing in it is waxed
//   slag      The Founders' Pit: casting moulds tip and pour on a cycle: a marked circle, then a pool of slag that burns a while
// Only ordinary rooms are given any of this (populate is never called for the start room, a shop or a great shadow's hall).
// Per-Level state lives on g.f2, keyed by the feature and the map it was built for.
(function () {
  const LF = window.LF, TAU = LF.TAU, TILE = LF.TILE, fx = LF.fx;
  const FE = LF.FEATURES = LF.FEATURES || {};
  const play = n => { if (LF.audio) LF.audio.play(n); };
  const frac = v => v - Math.floor(v);
  const hash = (x, y) => frac(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453);

  // ---------------------------------------------------------------- shared
  const roomOk = r => r.type === 'normal' || r.type === 'ambush';
  const tileOpen = (map, r, tx, ty) => map.inb(tx, ty) && !map.solidT(tx, ty) && map.roomAt[map.idx(tx, ty)] === r.id;
  const nearGate = (r, x, y, d) => { for (const gt of r.gates) if (LF.dist2((gt.x + 0.5) * TILE, (gt.y + 0.5) * TILE, x, y) < d * d) return true; return false; };
  const nearProp = (map, x, y, d) => { for (const o of map.props) if (LF.dist2(o.x, o.y, x, y) < d * d) return true; return false; };
  // open floor all round a point, out to radius d, and inside the room
  function clearDisc(map, r, x, y, d) {
    if (map.solidAt(x, y) || map.roomOf(x, y) !== r) return false;
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8; if (map.solidAt(x + Math.cos(a) * d, y + Math.sin(a) * d)) return false; }
    return true;
  }
  // this Level's state for a feature, built once per map
  function state(g, key, build) {
    let s = g.f2;
    if (!s || s.key !== key || s.map !== g.map) { s = g.f2 = build(g); s.key = key; s.map = g.map; }
    return s;
  }
  const featProps = (g, key) => g.props.filter(pr => pr.kind === 'feat' && pr.feat === key);
  const floorMover = e => !e.dead && e.spawnT <= 0 && !e.intangible && !e.boss && !e.def.flies && !e.def.ghost && e.def.speed > 0;
  // A slow is worked from outside the movers: whoever stands in it this frame keeps only part of the step it just took.
  // (Each mover's place is noted at the end of every frame; a jump of more than a tile in one frame is a teleport, left alone.)
  function drag(map, o, k) {
    const ox = o._f2x;
    if (ox === undefined) return;
    const oy = o._f2y, dx = o.x - ox, dy = o.y - oy;
    if (dx * dx + dy * dy > 32 * 32 || (dx === 0 && dy === 0)) return;
    const nx = ox + dx * k, ny = oy + dy * k;
    if (!map.solidAt(nx, ny)) { o.x = nx; o.y = ny; }
  }
  const note = o => { o._f2x = o.x; o._f2y = o.y; };
  const nearPlayer = (g, x, y, d) => LF.dist2(g.player.x, g.player.y, x, y) < d * d;
  const rgb = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const glowAt = (ctx, color, x, y, r, a) => { if (a <= 0.01) return; ctx.globalAlpha = Math.min(1, a); ctx.drawImage(LF.glowSprite(color), x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1; };
  // the trap's language for a strike that is coming: a rim beating red and a ring closing in on it
  function warnRing(ctx, x, y, R, k, time) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 14);
    ctx.strokeStyle = `rgba(255,90,90,${0.3 + 0.55 * pulse * (0.4 + 0.6 * k)})`; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(255,90,90,${0.15 + 0.5 * k})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, R + 22 * (1 - k), 0, TAU); ctx.stroke();
  }
  // a straight line of open tiles across a room, `lane` tiles in from its edge, `wide` tiles wide
  // (standing water is left out: a channel or a runnel is cut in dry stone)
  function laneTiles(map, r, horiz, lane, wide) {
    const out = [], len = horiz ? r.w : r.h;
    for (let i = 0; i < len; i++) for (let j = 0; j < wide; j++) {
      const tx = horiz ? r.x + i : lane + j, ty = horiz ? lane + j : r.y + i;
      if (tileOpen(map, r, tx, ty) && map.get(tx, ty) !== LF.T.WATER) out.push(map.idx(tx, ty));
    }
    return out;
  }

  // ------------------------------------------------------------------ The Sluice Works
  // A channel's clock: dry, a trickle (the warning), flooded, draining.
  const SL_WARN = 1.6, SL_FLOOD = 3.2, SL_DRAIN = 0.5;
  function sluiceClock(pr, t) {
    const P = pr.period, left = P - ((t + pr.phase) % P);
    if (left > SL_WARN + SL_FLOOD + SL_DRAIN) return { st: 0, lvl: 0, k: 0 };
    if (left > SL_FLOOD + SL_DRAIN) { const k = 1 - (left - SL_FLOOD - SL_DRAIN) / SL_WARN; return { st: 1, lvl: 0.08 + 0.3 * k, k }; }
    if (left > SL_DRAIN) return { st: 2, lvl: 1, k: 1 };
    return { st: 3, lvl: left / SL_DRAIN, k: 0 };
  }
  FE.sluice = {
    populate(map, r, rng) {
      if (!roomOk(r) || r.w < 7 || r.h < 7 || r.pattern === 'flooded' || !rng.chance(0.6)) return;
      const n = (r.w >= 13 || r.h >= 13) && rng.chance(0.4) ? 2 : 1, used = [];
      for (let c = 0; c < n; c++) for (let tries = 0; tries < 8; tries++) {
        const horiz = r.w > r.h ? rng.chance(0.7) : rng.chance(0.3);
        const lane = (horiz ? r.y : r.x) + rng.int(2, (horiz ? r.h : r.w) - 4);
        if (used.some(u => u.horiz === horiz && Math.abs(u.lane - lane) < 4)) continue;
        const tiles = laneTiles(map, r, horiz, lane, 2);
        if (tiles.length < 12) continue;
        // the gate stands across the channel where it comes into the room
        let gx = null, gy = 0;
        const len = horiz ? r.w : r.h;
        for (let i = 0; i < len && gx === null; i++) {
          const ax = horiz ? r.x + i : lane, ay = horiz ? lane : r.y + i, bx = horiz ? ax : lane + 1, by = horiz ? lane + 1 : ay;
          if (tileOpen(map, r, ax, ay) && tileOpen(map, r, bx, by)) { gx = horiz ? (ax + 0.5) * TILE : (lane + 1) * TILE; gy = horiz ? (lane + 1) * TILE : (ay + 0.5) * TILE; }
        }
        if (gx === null) continue;
        used.push({ horiz, lane });
        map.props.push({ kind: 'feat', feat: 'sluice', x: gx, y: gy, room: r.id, horiz, lane, tiles, phase: rng.range(0, 10), period: rng.range(9.5, 11.5), st: 0 });
        break;
      }
    },
    build(g) {
      const map = g.map, chans = featProps(g, 'sluice'), mask = new Int16Array(map.w * map.h);
      chans.forEach((c, i) => { for (const t of c.tiles) mask[t] = i + 1; });
      return { chans, mask };
    },
    start(g) { state(g, 'sluice', FE.sluice.build); },
    // whoever stands in a flooded channel
    wet(s, map, x, y) {
      const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
      if (!map.inb(tx, ty)) return false;
      const c = s.mask[map.idx(tx, ty)];
      return c > 0 && s.chans[c - 1].st === 2;
    },
    update(g, dt) {
      const s = state(g, 'sluice', FE.sluice.build), map = g.map, p = g.player;
      if (!s.chans.length) return;
      for (const c of s.chans) {
        const k = sluiceClock(c, g.time);
        if (k.st !== c.st) {
          const near = nearPlayer(g, c.x, c.y, 520);
          if (k.st === 1 && near) play('drip');
          if (k.st === 2 && near) { play('splash'); fx.burst(c.x, c.y, 10, { color: ['#9fe3ff', '#e8fbff', '#5fd6c4'], speed1: 120, life: 0.5, glow: false }); }
        }
        c.st = k.st;
      }
      const K = 0.42;
      if (!p.dead) { if (p.dashing <= 0 && !p.stats.hover && FE.sluice.wet(s, map, p.x, p.y)) drag(map, p, K); note(p); }
      for (const e of g.enemies) { if (!floorMover(e)) continue; if (FE.sluice.wet(s, map, e.x, e.y)) drag(map, e, K); note(e); }
      // fire does not last in running water
      for (const z of g.zones) if (z.kind === 'fire' && !z.dead && FE.sluice.wet(s, map, z.x, z.y)) z.life = Math.min(z.life, 0.2);
    },
    floor(ctx, g, time, inView) {
      const s = state(g, 'sluice', FE.sluice.build), map = g.map, W = map.w, S = g.section || {};
      const water = S.water || [24, 92, 96];
      for (const c of s.chans) {
        if (!inView(c.x, c.y, 760)) continue;
        const k = sluiceClock(c, time);
        // the trough: a step down in the stone, darker, with a worn lip along each side
        ctx.fillStyle = 'rgba(0,0,0,0.26)'; ctx.beginPath();
        for (const t of c.tiles) { const px = (t % W) * TILE, py = Math.floor(t / W) * TILE; if (inView(px + 16, py + 16, 20)) ctx.rect(px, py, TILE, TILE); }
        ctx.fill();
        const L0 = c.lane * TILE, L1 = (c.lane + 2) * TILE;
        ctx.lineWidth = 2; ctx.strokeStyle = k.st === 1 ? `rgba(95,214,196,${0.25 + 0.35 * (0.5 + 0.5 * Math.sin(time * 12)) * k.k})` : k.st ? `rgba(95,214,196,${0.4 * k.lvl})` : 'rgba(120,160,155,0.2)';
        ctx.beginPath();
        for (const t of c.tiles) {
          const tx = t % W, ty = Math.floor(t / W), px = tx * TILE, py = ty * TILE;
          if (!inView(px + 16, py + 16, 20)) continue;
          if (c.horiz) { if (ty === c.lane) { ctx.moveTo(px, L0 + 1); ctx.lineTo(px + TILE, L0 + 1); } else { ctx.moveTo(px, L1 - 1); ctx.lineTo(px + TILE, L1 - 1); } }
          else if (tx === c.lane) { ctx.moveTo(L0 + 1, py); ctx.lineTo(L0 + 1, py + TILE); } else { ctx.moveTo(L1 - 1, py); ctx.lineTo(L1 - 1, py + TILE); }
        }
        ctx.stroke();
        if (k.lvl <= 0) {
          // dry: a dark wet line down the middle where it last ran
          ctx.strokeStyle = 'rgba(10,30,32,0.35)'; ctx.lineWidth = 3; ctx.beginPath();
          for (const t of c.tiles) {
            const tx = t % W, ty = Math.floor(t / W), px = tx * TILE, py = ty * TILE;
            if ((c.horiz ? ty !== c.lane : tx !== c.lane) || !inView(px + 16, py + 16, 20)) continue;
            if (c.horiz) { ctx.moveTo(px, L0 + TILE); ctx.lineTo(px + TILE, L0 + TILE); } else { ctx.moveTo(L0 + TILE, py); ctx.lineTo(L0 + TILE, py + TILE); }
          }
          ctx.stroke();
          continue;
        }
        // the water: a thin sheet while it comes in, then the whole channel full and running
        const a = k.st === 1 ? 0.2 + 0.35 * k.k : 0.8 * k.lvl;
        ctx.fillStyle = rgb([Math.round(water[0] * 1.3), Math.round(water[1] * 1.35), Math.round(water[2] * 1.35)], a); // a shade brighter than standing water: this water is moving ctx.beginPath();
        if (k.st === 1) {
          // the trickle widens from the middle out
          const half = 4 + 22 * k.k;
          for (const t of c.tiles) {
            const tx = t % W, ty = Math.floor(t / W), px = tx * TILE, py = ty * TILE;
            if (!inView(px + 16, py + 16, 20)) continue;
            if (c.horiz) { const top = ty === c.lane ? Math.max(py, L0 + TILE - half) : py, bot = ty === c.lane ? py + TILE : Math.min(py + TILE, L0 + TILE + half); ctx.rect(px, top, TILE, bot - top); }
            else { const lft = tx === c.lane ? Math.max(px, L0 + TILE - half) : px, rgt = tx === c.lane ? px + TILE : Math.min(px + TILE, L0 + TILE + half); ctx.rect(lft, py, rgt - lft, TILE); }
          }
        } else for (const t of c.tiles) { const px = (t % W) * TILE, py = Math.floor(t / W) * TILE; if (inView(px + 16, py + 16, 20)) ctx.rect(px, py + 1, TILE, TILE - 2); }
        ctx.fill();
        // running water: short bright streaks carried along the channel
        if (k.st >= 2) {
          ctx.strokeStyle = `rgba(190,245,240,${0.28 * k.lvl})`; ctx.lineWidth = 1.3; ctx.lineCap = 'round'; ctx.beginPath();
          for (const t of c.tiles) {
            const tx = t % W, ty = Math.floor(t / W), px = tx * TILE, py = ty * TILE;
            if (!inView(px + 16, py + 16, 20)) continue;
            const h = hash(tx, ty), off = ((time * 70 + h * TILE) % TILE), side = 6 + h * 20;
            if (c.horiz) { ctx.moveTo(px + off - 6, py + side); ctx.lineTo(px + off + 4, py + side); }
            else { ctx.moveTo(px + side, py + off - 6); ctx.lineTo(px + side, py + off + 4); }
          }
          ctx.stroke();
        }
      }
    },
    // the gate: two iron posts across the channel, a board between them that lifts to let the water through
    draw(ctx, g, pr, x, y, time) {
      const k = sluiceClock(pr, time), up = k.st === 1 ? k.k : k.st === 2 ? 1 : k.st === 3 ? k.lvl : 0;
      const hz = pr.horiz, ax = hz ? x : x - TILE + 3, ay = hz ? y - TILE + 3 : y, bx = hz ? x : x + TILE - 3, by = hz ? y + TILE - 3 : y;
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x, y + 6, hz ? 10 : 34, hz ? 34 : 10, 0, 0, TAU); ctx.fill();
      // the board, raised as it opens
      ctx.fillStyle = '#3c3326';
      if (hz) LF.roundRect(ctx, x - 4, ay - 10 * up, 8, (by - ay) * (1 - 0.45 * up), 2); else LF.roundRect(ctx, ax, y - 4 - 10 * up, (bx - ax), 8, 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(95,214,196,0.35)'; ctx.lineWidth = 1; ctx.stroke();
      // posts and the wheel that winds it
      ctx.fillStyle = '#28302f';
      ctx.fillRect(ax - 4, ay - 4, 8, 8); ctx.fillRect(bx - 4, by - 4, 8, 8);
      const wx = hz ? x : bx + 2, wy = hz ? ay - 12 : y - 12, spin = time * (k.st ? 3 : 0) + pr.phase;
      ctx.strokeStyle = '#59675f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(wx, wy, 7, 0, TAU); ctx.stroke();
      ctx.beginPath(); for (let i = 0; i < 3; i++) { const a = spin + i * Math.PI / 3; ctx.moveTo(wx + Math.cos(a) * 7, wy + Math.sin(a) * 7); ctx.lineTo(wx - Math.cos(a) * 7, wy - Math.sin(a) * 7); } ctx.stroke();
    },
    glow(ctx, g, pr, x, y, time) {
      const k = sluiceClock(pr, time);
      if (k.st === 1) glowAt(ctx, '#5fd6c4', x, y, 26 + 14 * k.k, 0.25 + 0.3 * (0.5 + 0.5 * Math.sin(time * 12)));
      else if (k.st === 2) glowAt(ctx, '#5fd6c4', x, y, 30, 0.22);
    },
    light(lc, white, g, pr) {
      const k = sluiceClock(pr, g.time);
      if (!k.st) return;
      lc.globalAlpha = k.st === 1 ? 0.3 : 0.4 * k.lvl;
      lc.drawImage(white, pr.x - 56, pr.y - 56, 112, 112);
    },
  };

  // ------------------------------------------------------------------ The Ossuary Stair
  function boneHeap(pr) {
    // the bones of one heap, laid out once from where it stands: long bones crossing, a few skulls on top
    const out = [], n = 9 + Math.round(pr.r / 3);
    let h = pr.seed * 1000;
    const rnd = () => (h = frac(Math.sin(h * 1.37 + 7.1) * 43758.5453));
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU, d = Math.sqrt(rnd()) * pr.r * 0.78;
      out.push({ skull: i >= n - 3, x: Math.cos(a) * d, y: Math.sin(a) * d * 0.75 - (1 - d / pr.r) * 7, a: rnd() * Math.PI, l: 8 + rnd() * 8, s: 0.85 + rnd() * 0.3 });
    }
    out.sort((p, q) => p.y - q.y);
    return out;
  }
  function drawBone(ctx, b, x, y, flat) {
    const bx = x + b.x, by = y + b.y + (flat ? 4 : 0), ca = Math.cos(b.a) * b.l * 0.5, sa = Math.sin(b.a) * b.l * 0.5 * (flat ? 0.5 : 1);
    if (b.skull) {
      ctx.fillStyle = flat ? '#8f8266' : '#d9c9a2'; ctx.beginPath(); ctx.ellipse(bx, by, 5.2 * b.s, 4.6 * b.s, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#c4b38a'; ctx.fillRect(bx - 2.6 * b.s, by + 2.6 * b.s, 5.2 * b.s, 2.4 * b.s);
      ctx.fillStyle = '#1b140d'; ctx.beginPath(); ctx.arc(bx - 2 * b.s, by - 0.2, 1.4 * b.s, 0, TAU); ctx.arc(bx + 2 * b.s, by - 0.2, 1.4 * b.s, 0, TAU); ctx.fill();
      return;
    }
    ctx.strokeStyle = flat ? '#6f6450' : '#b7a681'; ctx.lineWidth = 3.4 * b.s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(bx - ca, by - sa); ctx.lineTo(bx + ca, by + sa); ctx.stroke();
    ctx.fillStyle = flat ? '#7d7058' : '#e2d3ac';
    ctx.beginPath(); ctx.arc(bx - ca, by - sa, 2.4 * b.s, 0, TAU); ctx.arc(bx + ca, by + sa, 2.4 * b.s, 0, TAU); ctx.fill();
    if (!flat) { ctx.strokeStyle = '#e8dcbc'; ctx.lineWidth = 1.2 * b.s; ctx.beginPath(); ctx.moveTo(bx - ca * 0.7, by - sa * 0.7 - 1); ctx.lineTo(bx + ca * 0.7, by + sa * 0.7 - 1); ctx.stroke(); }
  }
  FE.ossuary = {
    populate(map, r, rng) {
      if (!roomOk(r) || !rng.chance(0.65)) return;
      const n = rng.int(2, 4) + (r.w * r.h > 180 ? 1 : 0);
      for (let i = 0; i < n; i++) for (let tries = 0; tries < 10; tries++) {
        const sp = map.randomSpot(r, rng, 2), x = sp.x + rng.range(-8, 8), y = sp.y + rng.range(-8, 8), R = rng.range(15, 21);
        // room to walk round it on every side, and never across a doorway
        if (!clearDisc(map, r, x, y, R + 26) || nearGate(r, x, y, 120) || nearProp(map, x, y, R + 48)) continue;
        map.props.push({ kind: 'feat', feat: 'ossuary', x, y, room: r.id, r: R, seed: rng.next(), down: false });
        break;
      }
    },
    build(g) { return { heaps: featProps(g, 'ossuary') }; },
    start(g) { state(g, 'ossuary', FE.ossuary.build); },
    collapse(g, h) {
      if (h.down) return;
      h.down = true;
      fx.burst(h.x, h.y - 4, 16, { color: ['#e6d3a8', '#bfae88', '#8a7c62'], speed1: 150, life: 0.6, size: 2.6, glow: false, grav: 220 });
      fx.burst(h.x, h.y, 8, { color: ['#3a3226', '#2a241c'], speed1: 60, life: 0.9, size: 7, glow: false, alpha: 0.5 });
      if (nearPlayer(g, h.x, h.y, 600)) { play('crackle'); g.shake(2); }
      // what was buried in it: sometimes a few skitters, sometimes an ember
      const roll = Math.random();
      if (roll < 0.28) {
        const n = 2 + (Math.random() < 0.4 ? 1 : 0);
        for (let i = 0; i < n; i++) {
          const pos = g.map.nearestOpen(h.x + LF.rand(-14, 14), h.y + LF.rand(-14, 14));
          g.spawnEnemy('skitter', pos.x, pos.y, { awake: true, spawnT: 0.5, hpMul: 0.6, noDrops: true, room: h.room });
        }
      } else if (roll < 0.52 && !g.player.stats.noEmbers) g.pickups.push(new LF.Pickup('ember', h.x, h.y, LF.EMBER));
    },
    // stand a mover off a heap, as a circle: no tile is changed, so the paths through the room stay as they were
    shove(map, o, h, or) {
      const dx = o.x - h.x, dy = o.y - h.y, rr = h.r + or, d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr) return;
      const d = Math.sqrt(d2) || 1, ux = d2 ? dx / d : 1, uy = d2 ? dy / d : 0;
      const nx = h.x + ux * rr, ny = h.y + uy * rr;
      if (!map.solidAt(nx, ny)) { o.x = nx; o.y = ny; }
    },
    update(g, dt) {
      const s = state(g, 'ossuary', FE.ossuary.build), map = g.map, p = g.player;
      for (const h of s.heaps) {
        if (h.down) continue;
        const pd2 = LF.dist2(p.x, p.y, h.x, h.y);
        if (pd2 > 1000 * 1000) continue;
        for (const b of g.bullets) if (!b.dead && LF.dist2(b.x, b.y, h.x, h.y) < (h.r + 3) * (h.r + 3)) { b.dead = true; FE.ossuary.collapse(g, h); break; }
        if (h.down) continue;
        if (!p.dead && p.dashing > 0 && pd2 < (h.r + p.r + 4) * (h.r + p.r + 4)) { FE.ossuary.collapse(g, h); continue; }
        if (!p.dead) FE.ossuary.shove(map, p, h, p.r);
        for (const e of g.enemies) if (floorMover(e)) FE.ossuary.shove(map, e, h, e.r);
        // the bot walks round them
        if (pd2 < 180 * 180) { const hz = h.hz || (h.hz = { x: h.x, y: h.y, r: h.r - 8 }); g.hazards.push(hz); }
      }
    },
    draw(ctx, g, pr, x, y) {
      const bones = pr.bones || (pr.bones = boneHeap(pr));
      if (pr.down) {
        // fallen: a low scatter, nothing to stop a step
        ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(x, y + 4, pr.r * 1.25, pr.r * 0.7, 0, 0, TAU); ctx.fill();
        for (let i = 0; i < bones.length; i += 2) drawBone(ctx, { skull: bones[i].skull, x: bones[i].x * 1.35, y: bones[i].y * 1.1, a: bones[i].a, l: bones[i].l, s: bones[i].s * 0.9 }, x, y, true);
        return;
      }
      ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.beginPath(); ctx.ellipse(x, y + 6, pr.r * 1.15, pr.r * 0.62, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3b3326'; ctx.beginPath(); ctx.ellipse(x, y + 1, pr.r, pr.r * 0.72, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#4c4232'; ctx.beginPath(); ctx.ellipse(x, y - 3, pr.r * 0.72, pr.r * 0.48, 0, 0, TAU); ctx.fill();
      for (const b of bones) drawBone(ctx, b, x, y, false);
    },
  };

  // ------------------------------------------------------------------ The Pendulum Hall
  const BOB = 20;
  // where the weight is: along an arc of radius L about a point overhead, swinging `amp` either side
  function bobAt(pr, t, out) {
    const a = pr.amp * Math.sin(pr.w * t + pr.phase), ca = Math.cos(pr.ang), sa = Math.sin(pr.ang);
    const lat = pr.L * Math.sin(a), sag = pr.L * (1 - Math.cos(a)) * pr.sag;
    out.x = pr.cx + ca * lat - sa * sag; out.y = pr.cy + sa * lat + ca * sag;
    // its velocity
    const da = pr.amp * pr.w * Math.cos(pr.w * t + pr.phase), vl = pr.L * Math.cos(a) * da, vs = pr.L * Math.sin(a) * da * pr.sag;
    out.vx = ca * vl - sa * vs; out.vy = sa * vl + ca * vs;
    return out;
  }
  const _b = { x: 0, y: 0, vx: 0, vy: 0 }, _b2 = { x: 0, y: 0, vx: 0, vy: 0 };
  FE.pendulum = {
    populate(map, r, rng) {
      if (!roomOk(r) || r.w < 8 || r.h < 7 || !rng.chance(0.6)) return;
      const n = r.w * r.h > 220 && rng.chance(0.4) ? 2 : 1;
      for (let i = 0; i < n; i++) for (let tries = 0; tries < 24; tries++) {
        const c = map.randomSpot(r, rng, 2);
        const pr = { kind: 'feat', feat: 'pendulum', x: c.x, y: c.y, room: r.id, cx: c.x, cy: c.y, ang: rng.pick([0, Math.PI / 2, Math.PI / 4, -Math.PI / 4]),
          L: rng.range(170, 250), amp: rng.range(0.38, 0.5), sag: rng.chance(0.5) ? 1 : -1, w: TAU / rng.range(3.5, 4.3), phase: rng.range(0, TAU), hitT: 0 };
        if (nearProp(map, c.x, c.y, 170)) continue;
        // the whole sweep must be open floor in this room, clear of doorways and of anything set down in it
        let ok = true;
        for (let k = -1; k <= 1.001 && ok; k += 0.2) {
          const a = pr.amp * k, ca = Math.cos(pr.ang), sa = Math.sin(pr.ang), lat = pr.L * Math.sin(a), sag = pr.L * (1 - Math.cos(a)) * pr.sag;
          const x = pr.cx + ca * lat - sa * sag, y = pr.cy + sa * lat + ca * sag;
          if (!clearDisc(map, r, x, y, BOB + 6) || nearGate(r, x, y, 80) || nearProp(map, x, y, BOB + 34)) ok = false;
        }
        if (!ok) continue;
        map.props.push(pr);
        break;
      }
    },
    build(g) { return { arms: featProps(g, 'pendulum') }; },
    start(g) { const s = state(g, 'pendulum', FE.pendulum.build); for (const pr of s.arms) { bobAt(pr, g.time, _b); pr.x = _b.x; pr.y = _b.y; } },
    update(g, dt) {
      const s = state(g, 'pendulum', FE.pendulum.build), p = g.player;
      for (const pr of s.arms) {
        const b = bobAt(pr, g.time, _b);
        pr.x = b.x; pr.y = b.y; // the prop follows the weight, so it is drawn wherever the weight is
        if (!nearPlayer(g, pr.cx, pr.cy, 900)) continue;
        const sp = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / sp, uy = b.vy / sp;
        // the bot sees where it is and where it is going
        const h1 = pr.hz1 || (pr.hz1 = { x: 0, y: 0, r: BOB + 14 }), h2 = pr.hz2 || (pr.hz2 = { x: 0, y: 0, r: BOB + 8 });
        h1.x = b.x; h1.y = b.y; bobAt(pr, g.time + 0.3, _b2); h2.x = _b2.x; h2.y = _b2.y;
        g.hazards.push(h1, h2);
        if (!p.dead && p.dashing <= 0 && !p.stats.trapProof && g.time > pr.hitT && LF.dist2(p.x, p.y, b.x, b.y) < (BOB + p.r - 2) * (BOB + p.r - 2)) {
          pr.hitT = g.time + 0.9;
          g.hurtPlayer(4 * g.enemyDmgMul, { x: b.x - ux * 12, y: b.y - uy * 12, name: 'a swinging weight' });
          // it does not stop for you
          p.vx += ux * 240 * Math.min(1, sp / 150); p.vy += uy * 240 * Math.min(1, sp / 150);
          fx.burst(b.x, b.y, 8, { color: ['#d98a52', '#ffd0a0'], speed1: 140, life: 0.35, size: 1.8 });
          play('chain');
        }
        for (const e of g.enemies) {
          if (e.dead || e.spawnT > 0 || e.intangible || e.boss || e.def.ghost) continue;
          if (LF.dist2(e.x, e.y, b.x, b.y) > (BOB + e.r) * (BOB + e.r) || (e._pendT || 0) > g.time) continue;
          e._pendT = g.time + 0.7;
          g.damageEnemy(e, 12 * g.enemyHpMul, { type: 'blast', noShroud: true, x: b.x, y: b.y });
          if (!e.dead && e.def.speed > 0) { const a = Math.atan2(e.y - b.y, e.x - b.x); e.kx += ux * 260 + Math.cos(a) * 90; e.ky += uy * 260 + Math.sin(a) * 90; e.stun = Math.max(e.stun, 0.3); }
        }
      }
    },
    // the groove the weight has worn into the floor along its sweep
    floor(ctx, g, time, inView) {
      const s = state(g, 'pendulum', FE.pendulum.build);
      for (const pr of s.arms) {
        if (!inView(pr.cx, pr.cy, pr.L * 0.7)) continue;
        const ca = Math.cos(pr.ang), sa = Math.sin(pr.ang);
        const at = k => { const a = pr.amp * 1.08 * k, lat = pr.L * Math.sin(a), sag = pr.L * (1 - Math.cos(a)) * pr.sag; return [pr.cx + ca * lat - sa * sag, pr.cy + sa * lat + ca * sag]; };
        ctx.lineCap = 'round';
        for (const [style, w] of [['rgba(0,0,0,0.3)', 16], ['rgba(0,0,0,0.25)', 7], ['rgba(217,138,82,0.14)', 1.5]]) {
          ctx.strokeStyle = style; ctx.lineWidth = w; ctx.beginPath();
          for (let i = 0; i <= 16; i++) { const q = at(-1 + i / 8); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }
          ctx.stroke();
        }
      }
    },
    draw(ctx, g, pr, x, y, time) {
      const b = bobAt(pr, time, _b2), bx = b.x, by = b.y, lift = 12;
      // its shadow on the floor, and the chain up into the dark
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(bx, by + 4, BOB * 1.05, BOB * 0.55, 0, 0, TAU); ctx.fill();
      const hx = pr.cx, hy = pr.cy - 150, dx = hx - bx, dy = hy - (by - lift - BOB * 0.6), len = Math.hypot(dx, dy) || 1, n = Math.floor(len / 9);
      for (let i = 0; i < n; i++) {
        const k = i / n, cx = bx + dx * k, cy = by - lift - BOB * 0.6 + dy * k;
        ctx.globalAlpha = Math.max(0, 1 - k * 1.1);
        ctx.strokeStyle = i % 2 ? '#4a3a2e' : '#6e5544'; ctx.lineWidth = 2;
        ctx.beginPath();
        if (i % 2) ctx.ellipse(cx, cy, 1.6, 4.4, Math.atan2(dy, dx) + Math.PI / 2, 0, TAU); else ctx.ellipse(cx, cy, 4.4, 2.6, Math.atan2(dy, dx), 0, TAU);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // a smear behind it when it is moving fast
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > 60) { ctx.fillStyle = `rgba(40,28,22,${Math.min(0.35, sp / 700)})`; ctx.beginPath(); ctx.ellipse(bx - b.vx * 0.05, by - lift - b.vy * 0.05, BOB, BOB * 0.9, 0, 0, TAU); ctx.fill(); }
      // the weight: a squat iron bell with a banded rim
      ctx.fillStyle = '#2e231c'; ctx.beginPath(); ctx.ellipse(bx, by - lift, BOB, BOB * 0.92, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#7a5a44'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.strokeStyle = '#4a3528'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(bx, by - lift + 4, BOB * 0.8, BOB * 0.42, 0, 0, Math.PI); ctx.stroke();
      ctx.fillStyle = '#5a4434'; ctx.fillRect(bx - 4, by - lift - BOB - 3, 8, 6);
      ctx.fillStyle = 'rgba(255,220,180,0.18)'; ctx.beginPath(); ctx.ellipse(bx - 6, by - lift - 7, 6, 3.5, -0.6, 0, TAU); ctx.fill();
    },
    glow(ctx, g, pr, x, y, time) {
      const b = bobAt(pr, time, _b2), sp = Math.hypot(b.vx, b.vy);
      glowAt(ctx, '#d98a52', b.x, b.y - 12, 32, 0.12 + 0.18 * Math.min(1, sp / 200));
    },
    light(lc, white, g, pr) {
      lc.globalAlpha = 0.32; lc.drawImage(white, pr.x - 48, pr.y - 60, 96, 96);
    },
  };

  // ------------------------------------------------------------------ The Chainworks
  // A runnel's clock: dull, brightening (the warning), the flare, then cooling.
  const RN_WARN = 1.4, RN_FLARE = 1.0, RN_COOL = 0.3;
  function runnelClock(line, t) {
    const P = line.period, left = P - ((t + line.phase) % P);
    if (left > RN_WARN + RN_FLARE + RN_COOL) return { st: 0, heat: 0.18 + 0.04 * Math.sin(t * 2 + line.phase), k: 0 };
    if (left > RN_FLARE + RN_COOL) { const k = 1 - (left - RN_FLARE - RN_COOL) / RN_WARN; return { st: 1, heat: 0.25 + 0.55 * k, k }; }
    if (left > RN_COOL) return { st: 2, heat: 1, k: 1 - (left - RN_COOL) / RN_FLARE };
    return { st: 3, heat: 0.18 + 0.82 * left / RN_COOL, k: 0 };
  }
  FE.runnel = {
    populate(map, r, rng) {
      if (!roomOk(r) || r.w < 7 || r.h < 7 || !rng.chance(0.55)) return;
      const n = rng.chance(0.35) ? 2 : 1;
      let first = null;
      for (let c = 0; c < n; c++) for (let tries = 0; tries < 8; tries++) {
        const horiz = first ? !first.horiz : rng.chance(r.w >= r.h ? 0.65 : 0.35);
        const lane = (horiz ? r.y : r.x) + rng.int(2, (horiz ? r.h : r.w) - 3);
        const tiles = laneTiles(map, r, horiz, lane, 1);
        if (tiles.length < 6) continue;
        // never under a brazier or anything else set down in the room
        if (tiles.some(t => nearProp(map, (t % map.w + 0.5) * TILE, (Math.floor(t / map.w) + 0.5) * TILE, 44))) continue;
        const line = { horiz, lane, tiles, phase: rng.range(0, 7), period: rng.range(6.2, 7.4), st: 0, hit: false };
        first = line;
        // cut into short lengths, each its own prop, so every part is drawn when it is on screen
        for (let i = 0; i < tiles.length; i += 3) {
          const seg = tiles.slice(i, i + 3), mid = seg[Math.floor((seg.length - 1) / 2)];
          map.props.push({ kind: 'feat', feat: 'runnel', x: (mid % map.w + 0.5) * TILE, y: (Math.floor(mid / map.w) + 0.5) * TILE, room: r.id, line, seg });
        }
        break;
      }
    },
    build(g) {
      const map = g.map, lines = [], mask = new Int16Array(map.w * map.h);
      for (const pr of featProps(g, 'runnel')) if (!lines.includes(pr.line)) lines.push(pr.line);
      lines.forEach((l, i) => {
        for (const t of l.tiles) mask[t] = i + 1;
        l.hz = l.tiles.map(t => ({ x: (t % map.w + 0.5) * TILE, y: (Math.floor(t / map.w) + 0.5) * TILE, r: 20 }));
      });
      return { lines, mask };
    },
    start(g) { state(g, 'runnel', FE.runnel.build); },
    at(s, map, x, y) {
      const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
      if (!map.inb(tx, ty)) return null;
      const i = s.mask[map.idx(tx, ty)];
      return i > 0 ? s.lines[i - 1] : null;
    },
    update(g, dt) {
      const s = state(g, 'runnel', FE.runnel.build), map = g.map, p = g.player;
      if (!s.lines.length) return;
      for (const l of s.lines) {
        const k = runnelClock(l, g.time);
        if (k.st !== l.st && k.st === 2) {
          l.hit = false;
          let near = false;
          for (const h of l.hz) if (nearPlayer(g, h.x, h.y, 560)) { near = true; if (Math.random() < 0.5) fx.burst(h.x, h.y, 3, { color: ['#ff9a3c', '#ffd27a', '#ff5a1f'], speed1: 90, life: 0.5, grav: -140, size: 2 }); }
          if (near) play('burn');
        }
        l.st = k.st;
        if (k.st === 1 || k.st === 2) for (const h of l.hz) if (nearPlayer(g, h.x, h.y, 320)) g.hazards.push(h);
      }
      if (!p.dead && p.dashing <= 0 && !p.stats.trapProof) {
        const l = FE.runnel.at(s, map, p.x, p.y);
        if (l && l.st === 2 && !l.hit) { l.hit = true; g.hurtPlayer(3 * g.enemyDmgMul, { name: 'a molten runnel' }); }
      }
      const dps = 9 * g.enemyHpMul;
      for (const e of g.enemies) {
        if (e.dead || e.spawnT > 0 || e.intangible || e.def.flies || e.def.ghost) continue;
        const l = FE.runnel.at(s, map, e.x, e.y);
        if (l && l.st === 2) g.damageEnemy(e, dps * dt, { type: 'fire', quiet: true, noShroud: true });
      }
    },
    draw(ctx, g, pr, x, y, time) {
      const k = runnelClock(pr.line, time), W = g.map.w, hz = pr.line.horiz;
      for (const t of pr.seg) {
        const px = (t % W) * TILE, py = Math.floor(t / W) * TILE;
        // an iron-lined groove
        ctx.fillStyle = '#17110f';
        if (hz) ctx.fillRect(px, py + 8, TILE, 16); else ctx.fillRect(px + 8, py, 16, TILE);
        ctx.fillStyle = '#4a3a34';
        if (hz) { ctx.fillRect(px, py + 7, TILE, 2); ctx.fillRect(px, py + 23, TILE, 2); } else { ctx.fillRect(px + 7, py, 2, TILE); ctx.fillRect(px + 23, py, 2, TILE); }
        // what runs in it: a dull red crust most of the time, brighter as it comes up, white-gold in the flare
        const h = k.heat, wob = Math.sin(time * 3 + hash(px, py) * 9) * 0.06;
        ctx.fillStyle = `rgb(${Math.round(90 + 165 * h)},${Math.round(28 + 150 * h * h)},${Math.round(10 + 80 * h * h * h)})`;
        if (hz) ctx.fillRect(px, py + 11 - 2 * h, TILE, 10 + 4 * h); else ctx.fillRect(px + 11 - 2 * h, py, 10 + 4 * h, TILE);
        // crust islands that drift along it
        ctx.fillStyle = `rgba(30,14,8,${0.6 * (1 - h) + 0.1})`;
        for (let i = 0; i < 2; i++) {
          const off = ((time * 9 + hash(px + i, py) * TILE) % TILE);
          if (hz) ctx.fillRect(px + off, py + 13 + i * 3 + wob, 5, 2.5); else ctx.fillRect(px + 13 + i * 3 + wob, py + off, 2.5, 5);
        }
      }
    },
    glow(ctx, g, pr, x, y, time) {
      const k = runnelClock(pr.line, time), W = g.map.w;
      for (const t of pr.seg) {
        const cx = (t % W + 0.5) * TILE, cy = (Math.floor(t / W) + 0.5) * TILE;
        glowAt(ctx, '#ff9a3c', cx, cy, 18 + 26 * k.heat, 0.12 + 0.45 * k.heat * k.heat);
        if (k.st === 1 && Math.sin(time * 14) > 0) glowAt(ctx, '#ff5a3a', cx, cy, 16, 0.25 * k.k);
        if (k.st === 2) {
          // the flare: flames standing up out of the groove
          const fall = 1 - Math.max(0, k.k - 0.7) / 0.3;
          for (let i = 0; i < 2; i++) {
            const fx0 = cx + (i ? 7 : -7) + Math.sin(time * 9 + i + t) * 2, hgt = (14 + 10 * Math.abs(Math.sin(time * 11 + i * 2 + t))) * fall;
            ctx.fillStyle = i ? 'rgba(255,214,120,0.75)' : 'rgba(255,120,40,0.7)';
            ctx.beginPath(); ctx.moveTo(fx0 - 5, cy + 4); ctx.quadraticCurveTo(fx0 - 3, cy - hgt * 0.6, fx0 + Math.sin(time * 13 + t) * 3, cy - hgt); ctx.quadraticCurveTo(fx0 + 3, cy - hgt * 0.5, fx0 + 5, cy + 4); ctx.closePath(); ctx.fill();
          }
        }
      }
    },
    light(lc, white, g, pr) {
      const k = runnelClock(pr.line, g.time), W = g.map.w, R = 30 + 34 * k.heat;
      lc.globalAlpha = 0.18 + 0.5 * k.heat;
      for (const t of pr.seg) { const cx = (t % W + 0.5) * TILE, cy = (Math.floor(t / W) + 0.5) * TILE; lc.drawImage(white, cx - R, cy - R, R * 2, R * 2); }
    },
  };

  // ------------------------------------------------------------------ The Wax Galleries
  FE.softwax = {
    populate(map, r, rng) {
      if (!roomOk(r) || !rng.chance(0.6)) return;
      const n = rng.int(1, r.w * r.h > 180 ? 3 : 2);
      for (let i = 0; i < n; i++) for (let tries = 0; tries < 8; tries++) {
        const c = map.randomSpot(r, rng, 2), R = rng.range(34, 56);
        if (nearProp(map, c.x, c.y, R + 30) || nearGate(r, c.x, c.y, 60)) continue;
        // a spill: a few overlapping pools, none of them over a pillar or a wall
        const blobs = [[0, 0, R * 0.62]];
        const nb = rng.int(3, 5);
        for (let j = 0; j < nb; j++) {
          const a = rng.range(0, TAU), d = rng.range(0.25, 0.6) * R, br = rng.range(0.38, 0.6) * R, bx = Math.cos(a) * d, by = Math.sin(a) * d * 0.8;
          if (clearDisc(map, r, c.x + bx, c.y + by, br * 0.8)) blobs.push([bx, by, br]);
        }
        if (!clearDisc(map, r, c.x, c.y, R * 0.5)) continue;
        let ext = 0;
        for (const b of blobs) ext = Math.max(ext, Math.hypot(b[0], b[1]) + b[2]);
        map.props.push({ kind: 'feat', feat: 'softwax', x: c.x, y: c.y, room: r.id, blobs, ext, seed: rng.next() });
        break;
      }
    },
    build(g) { return { pools: featProps(g, 'softwax'), near: [] }; },
    start(g) { state(g, 'softwax', FE.softwax.build); },
    inWax(near, x, y) {
      for (const w of near) {
        if (LF.dist2(w.x, w.y, x, y) > w.ext * w.ext) continue;
        for (const b of w.blobs) { const dx = x - w.x - b[0], dy = y - w.y - b[1]; if (dx * dx + dy * dy < b[2] * b[2]) return true; }
      }
      return false;
    },
    update(g, dt) {
      const s = state(g, 'softwax', FE.softwax.build), map = g.map, p = g.player, near = s.near;
      near.length = 0;
      for (const w of s.pools) if (nearPlayer(g, w.x, w.y, 1000)) near.push(w);
      const K = 0.6;
      if (!p.dead) { if (near.length && p.dashing <= 0 && !p.stats.hover && FE.softwax.inWax(near, p.x, p.y)) drag(map, p, K); note(p); }
      for (const e of g.enemies) {
        if (!floorMover(e)) continue;
        if (near.length && FE.softwax.inWax(near, e.x, e.y)) {
          drag(map, e, K);
          // it counts as waxed while it stands in the wax, and a little after
          g.waxEnemy(e, 0.6); e.pooled = g.time;
        }
        note(e);
      }
    },
    floor(ctx, g, time, inView) {
      const s = state(g, 'softwax', FE.softwax.build);
      for (const w of s.pools) {
        if (!inView(w.x, w.y, w.ext + 10)) continue;
        const fill = (style, sc, pad, ox, oy) => {
          ctx.fillStyle = style; ctx.beginPath();
          for (const b of w.blobs) { const bx = w.x + b[0] * sc + ox, by = w.y + b[1] * sc + oy, br = b[2] * sc + pad; ctx.moveTo(bx + br, by); ctx.ellipse(bx, by, br, br * 0.86, 0, 0, TAU); }
          ctx.fill();
        };
        fill('rgba(18,13,8,0.4)', 1, 4, 1, 3);        // the shadow its edge throws
        fill('rgba(98,80,48,0.92)', 1, 2, 0, 0);       // the old, darker lip
        fill('rgba(166,146,100,0.88)', 1, 0, 0, 0);    // the body of it, gone yellow with age
        fill('rgba(204,186,138,0.55)', 0.62, 0, -1, -2); // softer and paler toward the middle
        // pits where something has stepped, and a dull sheen
        ctx.fillStyle = 'rgba(80,64,38,0.45)';
        for (let i = 0; i < 5; i++) {
          const h = frac(w.seed * 97 * (i + 1)), b = w.blobs[i % w.blobs.length], a = h * TAU, d = b[2] * 0.5 * frac(h * 13);
          ctx.beginPath(); ctx.ellipse(w.x + b[0] + Math.cos(a) * d, w.y + b[1] + Math.sin(a) * d, 3.2, 2.2, a, 0, TAU); ctx.fill();
        }
        const b0 = w.blobs[0];
        ctx.strokeStyle = `rgba(255,236,190,${0.22 + 0.08 * Math.sin(time * 0.8 + w.seed * 9)})`; ctx.lineWidth = 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.ellipse(w.x + b0[0] - b0[2] * 0.25, w.y + b0[1] - b0[2] * 0.3, b0[2] * 0.4, b0[2] * 0.18, -0.4, Math.PI * 1.05, Math.PI * 1.7); ctx.stroke();
      }
    },
  };

  // ------------------------------------------------------------------ The Founders' Pit
  // A mould's clock: still (its last pour cooling), tipping over a marked circle (the warning), pouring, the pool burning.
  const SG_WARN = 1.4, SG_BURN = 3.2, POOL = 42;
  function slagClock(c, t) {
    const P = c.period, ph = (t + c.phase) % P, left = P - ph;
    if (left > SG_WARN + SG_BURN) return { st: 0, k: 0, cool: Math.max(0, 1 - ph / 2.2), tip: Math.max(0, 1 - ph / 0.8) };
    if (left > SG_BURN) { const k = 1 - (left - SG_BURN) / SG_WARN; return { st: 1, k, cool: 0, tip: k }; }
    return { st: 2, k: 1 - left / SG_BURN, cool: 0, tip: 1 };
  }
  FE.slag = {
    populate(map, r, rng) {
      if (!roomOk(r) || r.w < 8 || r.h < 8 || !rng.chance(0.5)) return;
      const n = r.w * r.h > 200 && rng.chance(0.45) ? 2 : 1;
      for (let i = 0; i < n; i++) for (let tries = 0; tries < 14; tries++) {
        const m = map.randomSpot(r, rng, 2);
        if (!clearDisc(map, r, m.x, m.y, 22) || nearGate(r, m.x, m.y, 100) || nearProp(map, m.x, m.y, 80)) continue;
        const a = rng.range(0, TAU), d = rng.range(72, 96), tx = m.x + Math.cos(a) * d, ty = m.y + Math.sin(a) * d;
        if (!clearDisc(map, r, tx, ty, POOL + 4) || nearGate(r, tx, ty, POOL + 64) || nearProp(map, tx, ty, POOL + 36)) continue;
        const cyc = { phase: rng.range(0, 9), period: rng.range(7.6, 9.2), st: 0, hitT: 0 };
        map.props.push({ kind: 'feat', feat: 'slag', part: 'mould', x: m.x, y: m.y, room: r.id, tx, ty, cyc });
        map.props.push({ kind: 'feat', feat: 'slag', part: 'pool', x: tx, y: ty, room: r.id, mx: m.x, my: m.y, cyc, seed: rng.next() });
        break;
      }
    },
    build(g) { return { pools: featProps(g, 'slag').filter(pr => pr.part === 'pool') }; },
    start(g) { state(g, 'slag', FE.slag.build); },
    update(g, dt) {
      const s = state(g, 'slag', FE.slag.build), p = g.player;
      for (const pr of s.pools) {
        const c = pr.cyc, k = slagClock(c, g.time);
        if (k.st !== c.st && k.st === 2 && nearPlayer(g, pr.x, pr.y, 560)) {
          play('burn'); play('sizzle');
          fx.burst(pr.x, pr.y, 14, { color: ['#ff6a3a', '#ffb347', '#ffe0a0'], speed1: 160, life: 0.5, grav: 200, size: 2.2 });
        }
        c.st = k.st;
        if (!k.st) continue;
        if (!pr.hz) pr.hz = { x: pr.x, y: pr.y, r: POOL + 4 };
        if (nearPlayer(g, pr.x, pr.y, 700)) g.hazards.push(pr.hz);
        if (k.st !== 2) continue;
        if (!p.dead && p.dashing <= 0 && !p.stats.trapProof && g.time > c.hitT && LF.dist2(p.x, p.y, pr.x, pr.y) < (POOL + p.r * 0.3) * (POOL + p.r * 0.3)) {
          c.hitT = g.time + 0.8;
          g.hurtPlayer(2.5 * g.enemyDmgMul, { name: 'pouring slag' });
        }
        const dps = 9 * g.enemyHpMul;
        for (const e of g.enemies) {
          if (e.dead || e.spawnT > 0 || e.intangible || e.def.flies || e.def.ghost) continue;
          if (LF.dist2(e.x, e.y, pr.x, pr.y) < (POOL + e.r * 0.5) * (POOL + e.r * 0.5)) g.damageEnemy(e, dps * dt, { type: 'fire', quiet: true, noShroud: true });
        }
      }
    },
    draw(ctx, g, pr, x, y, time) {
      const k = slagClock(pr.cyc, time);
      if (pr.part === 'pool') {
        const sd = pr.seed * 50;
        // where it lands: a scorched crust with old cracks, glowing for a while after each pour
        ctx.fillStyle = 'rgba(14,6,4,0.55)'; ctx.beginPath(); ctx.ellipse(x, y, POOL + 4, (POOL + 4) * 0.86, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = k.cool > 0 ? `rgba(255,${80 + 60 * k.cool},40,${0.25 + 0.6 * k.cool})` : 'rgba(70,30,20,0.6)'; ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let i = 0; i < 7; i++) { const a = i * TAU / 7 + sd, l = POOL * (0.5 + 0.4 * frac(sd * (i + 1))); ctx.moveTo(x + Math.cos(a) * 6, y + Math.sin(a) * 5); ctx.lineTo(x + Math.cos(a + 0.2) * l * 0.6, y + Math.sin(a + 0.2) * l * 0.5); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l * 0.86); }
        ctx.stroke();
        if (k.st === 1) warnRing(ctx, x, y, POOL, k.k, time);
        if (k.st === 2) {
          // the pool: spreading fast as it lands, then a crust closing over it as it cools
          const spread = Math.min(1, k.k * 6), R = POOL * (0.3 + 0.7 * spread), crust = Math.max(0, (k.k - 0.55) / 0.45);
          ctx.fillStyle = '#5a1608'; ctx.beginPath(); ctx.ellipse(x, y, R, R * 0.86, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = `rgb(255,${Math.round(110 - 40 * crust)},${Math.round(40 - 20 * crust)})`; ctx.beginPath(); ctx.ellipse(x, y, R * 0.84, R * 0.72, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = `rgba(255,220,140,${0.8 - 0.6 * crust})`; ctx.beginPath(); ctx.ellipse(x - 3, y - 2, R * 0.45, R * 0.34, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = `rgba(40,14,8,${0.25 + 0.55 * crust})`;
          for (let i = 0; i < 6; i++) { const a = sd + i * 1.1 + time * 0.3, d = R * (0.3 + 0.45 * frac(sd * (i + 3))); ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.85, 4 + 5 * crust, 3 + 3 * crust, a, 0, TAU); ctx.fill(); }
        }
        return;
      }
      // the mould: a crucible slung between two iron posts, tipped toward its circle as it pours
      const dir = Math.atan2(pr.ty - y, pr.tx - x), side = Math.cos(dir) >= 0 ? 1 : -1, tilt = k.tip * 1.05 * side;
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(x, y + 12, 24, 8, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#2a1e1a'; ctx.fillRect(x - 21, y - 16, 5, 28); ctx.fillRect(x + 16, y - 16, 5, 28);
      ctx.save(); ctx.translate(x, y - 8); ctx.rotate(tilt);
      ctx.fillStyle = '#3d2c26'; ctx.beginPath(); ctx.moveTo(-13, -10); ctx.lineTo(13, -10); ctx.lineTo(10, 12); ctx.quadraticCurveTo(0, 16, -10, 12); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#70483a'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#211613'; ctx.beginPath(); ctx.ellipse(0, -10, 13, 4.5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = k.st === 2 && k.k > 0.5 ? '#3a1a10' : '#ff7a3a'; ctx.beginPath(); ctx.ellipse(0, -10, 10, 3.2, 0, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#4a3530'; ctx.fillRect(x - 21, y - 10, 42, 3);
    },
    glow(ctx, g, pr, x, y, time) {
      const k = slagClock(pr.cyc, time);
      if (pr.part === 'pool') {
        if (k.st === 2) glowAt(ctx, '#ff6a3a', x, y, POOL * 1.7, 0.55 * (1 - 0.5 * Math.max(0, (k.k - 0.55) / 0.45)));
        else if (k.st === 1) glowAt(ctx, '#ff4a3a', x, y, POOL * 1.2, 0.12 + 0.2 * k.k);
        else if (k.cool > 0) glowAt(ctx, '#ff6a3a', x, y, POOL * 1.2, 0.25 * k.cool);
        return;
      }
      glowAt(ctx, '#ff7a3a', x, y - 16, 18, 0.35 + 0.2 * k.tip);
      // the pour: a bright rope of slag from the lip down to the circle
      if (k.st === 2 && k.k < 0.4) {
        const dir = Math.atan2(pr.ty - y, pr.tx - x), lx = x + Math.cos(dir) * 14, ly = y - 18, fade = 1 - k.k / 0.4;
        ctx.strokeStyle = `rgba(255,170,80,${0.85 * fade})`; ctx.lineWidth = 7 * fade + 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.quadraticCurveTo((lx + pr.tx) / 2, ly - 18, pr.tx, pr.ty); ctx.stroke();
        ctx.strokeStyle = `rgba(255,240,190,${0.8 * fade})`; ctx.lineWidth = 2.5 * fade + 0.5;
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.quadraticCurveTo((lx + pr.tx) / 2, ly - 18, pr.tx, pr.ty); ctx.stroke();
      }
    },
    light(lc, white, g, pr) {
      const k = slagClock(pr.cyc, g.time);
      if (pr.part === 'mould') { lc.globalAlpha = 0.3 + 0.2 * k.tip; lc.drawImage(white, pr.x - 44, pr.y - 56, 88, 88); return; }
      const a = k.st === 2 ? 0.75 : k.st === 1 ? 0.3 + 0.2 * k.k : 0.35 * k.cool;
      if (a <= 0.02) return;
      lc.globalAlpha = a; lc.drawImage(white, pr.x - POOL * 2.2, pr.y - POOL * 2.2, POOL * 4.4, POOL * 4.4);
    },
  };
})();
