'use strict';
// Autoplay bot: used for smoke tests and rough balance checks, and as an attract-mode demo.
// It plays like a cautious human: kites, flares when swarmed, lights braziers, shops, then takes the stair.
(function () {
  const TILE = LF.TILE;

  function makeBot(opts = {}) {
    const st = { nav: null, navKey: '', goal: null, strafe: 1, strafeT: 0, stuckT: 0, lastX: 0, lastY: 0, think: 0, offerT: 0, skill: opts.skill === undefined ? 1 : opts.skill, log: [] };

    function buildNav(map, tx, ty) {
      const w = map.w, h = map.h, d = new Uint16Array(w * h).fill(65535), q = new Int32Array(w * h);
      let head = 0, tail = 0;
      const s = ty * w + tx; d[s] = 0; q[tail++] = s;
      while (head < tail) {
        const i = q[head++], nd = d[i] + 1, x = i % w, y = (i - x) / w;
        if (x > 0 && !map.solid[i - 1] && d[i - 1] === 65535) { d[i - 1] = nd; q[tail++] = i - 1; }
        if (x < w - 1 && !map.solid[i + 1] && d[i + 1] === 65535) { d[i + 1] = nd; q[tail++] = i + 1; }
        if (y > 0 && !map.solid[i - w] && d[i - w] === 65535) { d[i - w] = nd; q[tail++] = i - w; }
        if (y < h - 1 && !map.solid[i + w] && d[i + w] === 65535) { d[i + w] = nd; q[tail++] = i + w; }
      }
      return d;
    }
    function navDir(g, gx, gy, out) {
      const map = g.map, p = g.player;
      const tx = Math.floor(gx / TILE), ty = Math.floor(gy / TILE);
      const key = map.seed + ':' + tx + ',' + ty + ':' + map.rooms.filter(r => r.sealed).length;
      if (st.navKey !== key) { st.nav = buildNav(map, tx, ty); st.navKey = key; }
      const x = Math.floor(p.x / TILE), y = Math.floor(p.y / TILE), w = map.w;
      let best = st.nav[y * w + x], bx = 0, by = 0;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        if (!ox && !oy) continue;
        const nx = x + ox, ny = y + oy;
        if (!map.inb(nx, ny)) continue;
        if (ox && oy && (map.solid[y * w + nx] || map.solid[ny * w + x])) continue;
        const d = st.nav[ny * w + nx];
        if (d < best) { best = d; bx = ox; by = oy; }
      }
      if (!bx && !by) { const dx = gx - p.x, dy = gy - p.y, l = Math.hypot(dx, dy) || 1; out.x = dx / l; out.y = dy / l; return best === 0; }
      const dx = (x + bx + 0.5) * TILE - p.x, dy = (y + by + 0.5) * TILE - p.y, l = Math.hypot(dx, dy) || 1;
      out.x = dx / l; out.y = dy / l;
      return false;
    }

    function pickGoal(g) {
      const p = g.player, map = g.map;
      // impatience: after a long time on one floor, stop exploring and take the stair
      if (st.floorT > 170 && g.mode === 'descent') {
        const ex0 = g.props.find(pr => pr.kind === 'exit' && pr.open && !pr.hidden);
        if (ex0) return { x: ex0.x, y: ex0.y, kind: 'exit' };
      }
      // unlit braziers / chests / fonts we know about and can reach
      if (p.frac() < 0.38 && g.threat <= 0 && g.litBraziers.length) {
        let rb = null, rd = Infinity;
        for (const b of g.litBraziers) { const d = LF.dist(p.x, p.y, b.x, b.y); if (d < rd) { rd = d; rb = b; } }
        if (rb && rd < 1400) return { x: rb.x, y: rb.y + 30, kind: 'rest' };
      }
      let best = null, bd = Infinity;
      if (st.avoid) { st.avoid.t -= 0.5; if (st.avoid.t <= 0) st.avoid = null; }
      const consider = (x, y, kind, bias = 0) => { if (st.avoid && LF.dist(x, y, st.avoid.x, st.avoid.y) < 24) return; const d = LF.dist(p.x, p.y, x, y) + bias; if (d < bd) { bd = d; best = { x, y, kind }; } };
      for (const pr of g.props) {
        const room = map.rooms[pr.room];
        if (!room || !room.visited) continue;
        if (pr.kind === 'brazier' && !pr.lit) consider(pr.x, pr.y, 'prop');
        if (pr.kind === 'chest' && !pr.opened && !pr.locked) consider(pr.x, pr.y, 'prop');
        if (pr.kind === 'font' && !pr.used && p.frac() < 0.8) consider(pr.x, pr.y, 'prop');
        if (pr.kind === 'pedestal' && !pr.sold && p.glass >= g.price(pr) && (pr.item.type === 'relic' || p.frac() < 0.6)) consider(pr.x, pr.y, 'prop');
        if (pr.kind === 'shrine' && !pr.used && opts.cursed) consider(pr.x, pr.y, 'prop');
      }
      for (const pk of g.pickups) {
        if (pk.kind === 'ember' && p.light >= p.stats.maxLight - 1) continue;
        if (LF.dist(p.x, p.y, pk.x, pk.y) < 260) consider(pk.x, pk.y, 'pickup', -40);
      }
      if (best) return best;
      // explore unvisited rooms (nearest first), boss arena included
      for (const r of map.rooms) {
        if (r.visited && !(r.type === 'boss' && !g.bossStarted)) continue;
        if (r.type === 'exit' && map.rooms.some(o => !o.visited && o !== r && o.type !== 'exit') && !opts.rush) continue;
        const c = map.nearestOpen(r.cx * TILE, r.cy * TILE);
        consider(c.x, c.y, 'room');
      }
      if (best) return best;
      const ex = g.props.find(pr => pr.kind === 'exit' && pr.open && !pr.hidden);
      if (ex) return { x: ex.x, y: ex.y, kind: 'exit' };
      const a = map.rooms[0];
      return { x: a.cx * TILE, y: a.cy * TILE, kind: 'wait' };
    }

    // opts.human: 'novice' | 'average' | undefined (perfect aim, instant reactions)
    const H = opts.human === 'novice' ? { aimErr: 0.26, track: 5, lag: 0.34, dodge: 0.35 }
      : opts.human === 'average' ? { aimErr: 0.14, track: 8, lag: 0.2, dodge: 0.65 }
      : opts.human === 'good' ? { aimErr: 0.07, track: 12, lag: 0.12, dodge: 0.85 }
      : { aimErr: 0, track: 99, lag: 0, dodge: 1 };
    const out = { x: 0, y: 0 };
    const fn = function bot(g) {
      const s = { mx: 0, my: 0, aimX: 0, aimY: 0, aimDir: 0, fire: false, flare: false, dash: false, interact: false, pause: false, map: false, click: false, confirm: false, back: false };
      if (g.state === 'relic') {
        st.offerT += 1 / 60;
        if (st.offerT > (opts.offerDelay || 0.2)) { st.offerT = 0; const o = g.offer; let pick = Math.floor(Math.random() * o.relics.length);
          // a 'build' bot fishes: it takes whatever feeds the school it already holds most of
          if (opts.build) { const sc = g.player.schools || {}; let best = -1; o.relics.forEach((d, i) => { const v = (d.school ? (sc[d.school] || 0) : -1) + Math.random() * 0.5; if (v > best) { best = v; pick = i; } }); }
          // the bot cannot path well enough to fight with a blade, so it never takes that rite
          if (o.relics[pick] && o.relics[pick].id === 'riteblade') pick = o.relics.length > 1 ? (pick + 1) % o.relics.length : -1;
          g.pickOffer(o.cursed && !opts.cursed ? -1 : pick); }
        return s;
      }
      if (g.state !== 'play') return s;
      const p = g.player, map = g.map;
      if (p.dead) return s;
      if (st.floorKey !== g.map) { st.floorKey = g.map; st.floorT = 0; }
      st.floorT += 1 / 60;
      const hurry = st.floorT > 170 && st.goal && st.goal.kind === 'exit';
      st.strafeT -= 1 / 60;
      // Playstyles (opts.style): 'kite' (the default) holds a middling range and backs off; 'aggressive' fights at
      // arm's length and does not give ground; 'careful' fights from as far as its bolts reach and retreats from
      // anything that approaches; 'circle' orbits its target one way and never stops moving.
      const style = opts.style || 'kite';
      if (st.strafeT <= 0) { if (style !== 'circle') st.strafe = Math.random() < 0.5 ? 1 : -1; st.strafeT = 0.6 + Math.random() * 1.4; }

      // threats
      let target = null, td = Infinity, close = 0, hug = 0, nearest = Infinity, cx = 0, cy = 0;
      const closeR = style === 'careful' ? 250 : 150;
      for (const e of g.enemies) {
        if (e.dead || e.spawnT > 0) continue;
        const d = LF.dist(p.x, p.y, e.x, e.y);
        if (!e.awake && d > 300) continue;
        if (d < closeR && !e.intangible && e.awake) { close++; cx += (p.x - e.x) / (d + 1); cy += (p.y - e.y) / (d + 1); if (d < 150) hug++; }
        if (!e.intangible && d < nearest && e.def.contact !== false) nearest = d;
        if (e.intangible) continue;
        if (d < 460 && map.los(p.x, p.y, e.x, e.y)) {
          // prefer lit, low-hp, dangerous targets
          let score = d * (e.lit ? 1 : 1.5) - (e.type === 'snuffer' || e.type === 'brood' ? 120 : 0) - (e.boss ? 60 : 0);
          if (e.type === 'bulwark' && e.state !== 'dazed' && Math.abs(LF.angDiff(e.face, Math.atan2(p.y - e.y, p.x - e.x))) < 1.1) score += 140;
          if (e.type === 'choirhead' && e.sing > 0) score -= 320;
          if (e.type === 'candle') score -= 220;
          if (e.type === 'lure') score -= 160;
          if (score < td) { td = score; target = e; }
        }
      }
      // orbs are worth shooting
      if (!target) for (const b of g.ebullets) if (b.orb && LF.dist(p.x, p.y, b.x, b.y) < 200) { target = b; break; }

      let mvx = 0, mvy = 0;
      if (target) {
        const d = LF.dist(p.x, p.y, target.x, target.y);
        const lead = d / p.stats.boltSpeed;
        const ideal = Math.atan2(target.y + (target.vy || 0) * lead * 0.7 - p.y, target.x + (target.vx || 0) * lead * 0.7 - p.x);
        if (H.aimErr) {
          st.noiseT = (st.noiseT || 0) - 1 / 60;
          if (st.noiseT <= 0) { st.noiseT = 0.25 + Math.random() * 0.3; st.noise = (Math.random() + Math.random() + Math.random() - 1.5) * H.aimErr * 1.4; }
          if (st.aim === undefined) st.aim = ideal;
          st.aim = LF.turnToward(st.aim, ideal + (st.noise || 0), H.track / 60);
          s.aimDir = st.aim;
          s.fire = Math.abs(LF.angDiff(st.aim, ideal)) < 0.6;
        } else { s.aimDir = ideal; s.fire = true; }
        let want = p.stats.melee ? 46 : Math.min(190, p.lightR * 0.8), sw = 0.7, rw = 1;
        if (!p.stats.melee) {
          if (style === 'aggressive') { want = 62; sw = 0.45; }
          else if (style === 'careful') { want = Math.min(300, p.stats.boltSpeed * p.stats.boltLife * 0.72); sw = 0.35; }
          else if (style === 'circle') { want = Math.min(140, p.lightR * 0.72); sw = 1.5; rw = 0.6; }
        }
        const dx = (target.x - p.x) / (d || 1), dy = (target.y - p.y) / (d || 1);
        const radial = d > want + 30 ? 1 : d < want - 30 ? -1 : 0;
        mvx = dx * radial * rw - dy * st.strafe * sw; mvy = dy * radial * rw + dx * st.strafe * sw;
      } else {
        st.think -= 1 / 60;
        if (!st.goal || st.think <= 0) { st.goal = pickGoal(g); st.think = 0.5; }
        const gl = st.goal;
        const arrived = navDir(g, gl.x, gl.y, out);
        mvx = out.x; mvy = out.y;
        s.aimDir = Math.atan2(mvy, mvx);
        if (LF.dist(p.x, p.y, gl.x, gl.y) < 30 || arrived) { st.think = 0; if (gl.kind === 'wait') { mvx = 0; mvy = 0; } }
        if (gl.kind === 'rest' && LF.dist(p.x, p.y, gl.x, gl.y) < 60) { mvx = 0; mvy = 0; st.think = p.frac() < 0.5 ? 0.5 : 0; }
      }
      // back away from anything close
      if (close > 0 && !(style === 'aggressive' && p.frac() > 0.25)) { const l = Math.hypot(cx, cy) || 1, k = style === 'careful' ? 1.6 : style === 'circle' ? 0.5 : 1.1; mvx = mvx * 0.35 + cx / l * k; mvy = mvy * 0.35 + cy / l * k; }
      // dodge bullets
      let danger = null;
      for (const b of g.ebullets) {
        const d = LF.dist(p.x, p.y, b.x, b.y);
        if (d > 110) continue;
        if (H.dodge < 1) { if (b._seen === undefined) b._seen = Math.random() < H.dodge; if (!b._seen) continue; }
        const rvx = b.vx, rvy = b.vy, rx = p.x - b.x, ry = p.y - b.y;
        const along = (rx * rvx + ry * rvy) / (Math.hypot(rvx, rvy) || 1);
        if (along < 0) continue;
        const perp = Math.abs(rx * rvy - ry * rvx) / (Math.hypot(rvx, rvy) || 1);
        if (perp < 22) { danger = b; const side = (rx * rvy - ry * rvx) > 0 ? 1 : -1; const l = Math.hypot(rvx, rvy) || 1; mvx += rvy / l * side * 1.6; mvy += -rvx / l * side * 1.6; }
      }
      // avoid gloom
      for (const z of g.zones) if (z.kind === 'gloom' || z.kind === 'wax' || (z.kind === 'fire' && z.r > 40)) { const d = LF.dist(p.x, p.y, z.x, z.y); if (d < z.r + 30) { mvx += (p.x - z.x) / (d + 1) * 2; mvy += (p.y - z.y) / (d + 1) * 2; } }
      // boss telegraphs expose "avoid" circles
      if (g.hazards && !hurry) for (const hz of g.hazards) { const d = LF.dist(p.x, p.y, hz.x, hz.y); if (d < hz.r + 26) { mvx += (p.x - hz.x) / (d + 1) * 2.4; mvy += (p.y - hz.y) / (d + 1) * 2.4; } }
      // steer away from walls a little
      const l = Math.hypot(mvx, mvy);
      if (l > 0.01) { mvx /= l; mvy /= l; if (target && map.solidAt(p.x + mvx * 22, p.y + mvy * 22)) { const t = mvx; mvx = -mvy * st.strafe; mvy = t * st.strafe; } }
      if (H.lag) {
        // hold each movement decision for a reaction time
        st.lagT = (st.lagT || 0) - 1 / 60;
        if (st.lagT <= 0 || st.hx === undefined) { st.lagT = H.lag * (0.6 + Math.random() * 0.8); st.hx = mvx; st.hy = mvy; }
        mvx = st.hx; mvy = st.hy;
      }
      s.mx = mvx; s.my = mvy;

      // stuck detection
      st.stuckT += 1 / 60;
      if (st.stuckT > 1) {
        if (LF.dist(p.x, p.y, st.lastX, st.lastY) < 6 && !target && st.goal && st.goal.kind !== 'wait' && st.goal.kind !== 'rest') { st.strafe *= -1; st.think = 0; st.navKey = ''; st.stuck = (st.stuck || 0) + 1; if (st.stuck > 3) st.avoid = { x: st.goal.x, y: st.goal.y, t: 20 }; if (p.light > 40) s.dash = true; } else st.stuck = 0;
        st.lastX = p.x; st.lastY = p.y; st.stuckT = 0;
      }

      const sk = st.skill * (H.dodge < 1 ? H.dodge : 1);
      if (sk > 0) {
        if (p.flareT <= 0 && p.light > 30 && (hug >= (style === 'aggressive' ? 2 : 3) || (hug >= 2 && p.frac() < 0.5) || (g.boss && !g.boss.dead && LF.dist(p.x, p.y, g.boss.x, g.boss.y) < 150 && p.frac() > 0.75))) s.flare = true;
        if (p.dashT <= 0 && p.light > 12 && (danger && LF.dist(p.x, p.y, danger.x, danger.y) < 46 || nearest < 26)) s.dash = Math.random() < sk;
        for (const e of g.enemies) if (!e.dead && (e.state === 'lunge' || e.state === 'charge') && LF.dist(p.x, p.y, e.x, e.y) < 90 && p.dashT <= 0) { s.dash = true; s.mx = -(e.ly || 0); s.my = (e.lx || 0); }
      }
      if (g.prompt) {
        const k = g.prompt.prop.kind;
        if (k === 'exit') { if (st.goal && st.goal.kind === 'exit') s.interact = true; }
        else if (k === 'shrine') { if (opts.cursed) s.interact = true; }
        else s.interact = true;
      }
      return s;
    };
    fn.st = st;
    return fn;
  }
  LF.makeBot = makeBot;

  // Soak test: many headless runs with a stall watchdog. Returns per-run lines plus state dumps for stalls.
  LF.soak = function (from, count, opts = {}) {
    const g = LF.game, metaSnap = JSON.stringify(g.meta), realSave = g.save;
    g.save = () => {};
    const lines = [], dumps = [], agg = { runs: 0, wins: 0, depthSum: 0, errors: 0, stalls: 0, causes: {} };
    const dt = 1 / 60;
    for (let seed = from; seed < from + count; seed++) {
      if (opts.lantern) { g.meta.lantern = opts.lantern; g.meta.best = 99; g.meta.bosses = 9; g.meta.kills = 9999; g.meta.wins = 9; }
      if (opts.diff !== undefined) g.meta.diff = opts.diff;
      if (opts.alt) g.meta.felled = { bell: 1, warden: 1, mother: 1, king: 1, eclipse: 1, choir: 1 };
      g.meta.shards = opts.shards || 0; g.meta.cycle = -1; // every soak run starts from the same shard count (a win would otherwise carry into the next)
      g.bot = makeBot(opts); g.startRun(seed, { mode: opts.mode }); g.fade = null;
      let t = 0, last = 0, lastDepth = 1, err = null, stalled = false;
      try {
        while (t < (opts.maxTime || 1500)) {
          if (g.fade) { const f = g.fade; g.fade = null; if (f.cb) f.cb(); }
          g.update(dt); t += dt;
          { const prog = g.mode === 'vigil' ? 100 + g.vigil.wave : g.depth; if (prog !== lastDepth) { lastDepth = prog; last = t; } }
          if (g.player.dead || g.run.won) break;
          if (t - last > (opts.stall || 330)) {
            stalled = true;
            const p = g.player, m = g.map, st = g.bot.st;
            dumps.push({
              seed, t: t | 0, depth: g.depth, state: g.state, omen: g.omen && g.omen.id, p: [p.x | 0, p.y | 0], light: p.light | 0,
              goal: st.goal && `${st.goal.kind}@${st.goal.x | 0},${st.goal.y | 0}`, avoid: !!st.avoid,
              room: g.room && (g.room.type + '#' + g.room.id),
              rooms: m.rooms.map(r => `${r.id}:${r.type}${r.visited ? 'v' : ''}${r.sealed ? 'S' : ''}${r.cleared ? 'c' : ''}`).join(' '),
              enemies: g.enemies.filter(e => e.awake).slice(0, 10).map(e => `${e.type}${e.elite ? '*' : ''}@${e.x | 0},${e.y | 0} r${e.room} sp${e.spawnT > 0 ? 1 : 0} solid${m.solidAt(e.x, e.y) ? 1 : 0} int${e.intangible ? 1 : 0} st:${e.state} hp${e.hp | 0}`).join(' | '),
              pickups: g.pickups.slice(0, 6).map(k => `${k.kind}@${k.x | 0},${k.y | 0} solid${m.solidAt(k.x, k.y) ? 1 : 0}`).join(' '),
              prompt: g.prompt && g.prompt.text, boss: g.boss && { st: g.boss.state, hp: g.boss.hp | 0, int: g.boss.intangible, dead: g.boss.dead }, bossStarted: g.bossStarted,
            });
            break;
          }
        }
      } catch (e) { err = e && e.stack ? e.stack.slice(0, 500) : String(e); }
      agg.runs++; agg.depthSum += g.depth; if (g.run.won) agg.wins++; if (err) agg.errors++; if (stalled) agg.stalls++;
      const cause = g.player.dead ? (g.run.lastHit || 'dark') : g.run.won ? 'WON' : stalled ? 'STALL' : 'timeout';
      agg.causes[cause] = (agg.causes[cause] || 0) + 1;
      if (g.player.dead) {
        const inBoss = !!(g.boss && !g.boss.dead);
        if (!agg.where) agg.where = { boss: 0, floor: 0 };
        agg.where[inBoss ? 'boss' : 'floor']++;
        (agg.deaths = agg.deaths || []).push('d' + g.depth + (inBoss ? ' vs ' + g.boss.def.name : ' floor') + ': ' + cause + ' (light ' + Math.round(g.run.taken) + ' lost to hits)');
      }
      lines.push(`${seed}: ${g.mode === 'vigil' ? 'w' + g.vigil.wave + ' ' : ''}d${g.depth} ${t | 0}s k${g.run.kills} taken${Math.round(g.run.taken)} ${cause}${err ? ' ERR ' + err : ''}`);
    }
    g.bot = null; g.fade = null; g.delays = []; g.meta = JSON.parse(metaSnap); g.save = realSave; g.state = 'title'; LF.ui.enter(g, 'title'); LF.audio.intensity = 0;
    agg.avgDepth = +(agg.depthSum / agg.runs).toFixed(2);
    return { agg, lines: opts.quiet ? undefined : lines, dumps };
  };

  // Monkey test: random clicks, keys and stick input across every screen. Returns the first error, if any.
  LF.monkey = function (frames = 20000, seed = 1, mo = {}) {
    const g = LF.game, rng = new LF.RNG(seed), metaSnap = JSON.stringify(g.meta), realSave = g.save;
    g.save = () => {};
    const visited = {}, log = [];
    let err = null, f = 0, held = { mx: 0, my: 0, fire: false, aim: 0 }, lastState = g.state, sameFor = 0;
    const mk = g.bot = function () {
      const W = g.canvas.width, H = g.canvas.height;
      if (rng.chance(0.03)) { held.mx = rng.pick([-1, 0, 1]); held.my = rng.pick([-1, 0, 1]); held.fire = rng.chance(0.7); held.aim = rng.range(0, 6.28); }
      const s = { mx: held.mx, my: held.my, aimX: rng.range(0, W), aimY: rng.range(0, H), aimDir: g.state === 'play' ? held.aim : null,
        fire: held.fire, flare: rng.chance(0.01), dash: rng.chance(0.02), interact: rng.chance(0.08), pause: rng.chance(0.002), map: rng.chance(0.003),
        click: rng.chance(g.state === 'play' ? 0 : 0.25), rclick: false, uiUp: rng.chance(0.03), uiDown: rng.chance(0.03), uiLeft: rng.chance(0.03), uiRight: rng.chance(0.03),
        confirm: rng.chance(g.state === 'play' ? 0 : 0.06), back: rng.chance(g.state === 'play' ? 0 : 0.03), mouseMoved: true, wheel: 0, reroll: rng.chance(0.01) };
      return s;
    };
    try {
      for (f = 0; f < frames; f++) {
        // the title has no bot hook of its own: g.bot is only consulted by update(), which every state goes through
        if (!g.demo && g.bot !== mk) g.bot = mk; // a demo borrows the bot slot; take it back afterwards
        LF.frame(1 / 60);
        visited[g.state] = (visited[g.state] || 0) + 1;
        if (LF.lastError) { err = LF.lastError; break; }
        if (g.state === lastState) sameFor++; else { sameFor = 0; lastState = g.state; }
        if (g.fade && rng.chance(0.2)) { const fd = g.fade; g.fade = null; if (fd.cb) fd.cb(); }
        // keep the monkey alive long enough to see deep content now and then
        if (!mo.mortal && g.state === 'play' && g.player && !g.player.dead && rng.chance(0.004)) g.player.addLight(40);
        if (g.state === 'play' && !g.fade && g.player && !g.player.dead && g.mode !== 'vigil' && rng.chance(0.0015)) { g.descend(); log.push('descend from d' + g.depth); }
        if (g.state === 'play' && g.boss && !g.boss.dead && g.boss.spawnT <= 0 && rng.chance(0.004)) { g.damageEnemy(g.boss, g.boss.maxHp, { type: 'blast', noShroud: true, force: true }); if (g.boss.type === 'choir' && g.boss.heads) for (const h of g.boss.heads) if (!h.dead) g.killEnemy(h, {}); log.push('boss slain d' + g.depth); }
        if (g.state === 'title' && rng.chance(0.02)) { g.state = rng.pick(['codex', 'shadows', 'descents', 'feats', 'intro']); LF.ui.enter(g, g.state); }
        if (g.state === 'play' && rng.chance(0.0006) && g.mode !== 'vigil' && !g.fade) { g.depth = rng.int(1, 9); g.loadFloor(); log.push('jump d' + g.depth + (g.map.boss ? ' ' + g.map.boss.type : '')); }
        if (g.demo && rng.chance(0.01)) g.endDemo();
      }
    } catch (e) { err = e && e.stack ? e.stack : String(e); }
    g.bot = null; g.demo = false; g.fade = null; g.delays = []; g.meta = JSON.parse(metaSnap); g.save = realSave; g.state = 'title'; LF.ui.enter(g, 'title');
    LF.lastError = null;
    return { frames: f, err: err ? String(err).slice(0, 700) : null, visited, log: log.slice(-12) };
  };

  // Headless playtest: runs whole descents at full speed and returns a summary.
  LF.playtest = function (opts = {}) {
    const g = LF.game;
    const res = { depth: 0, time: 0, kills: 0, won: false, cause: '', relics: [], log: [], error: null };
    const maxTime = opts.maxTime || 1500;
    const metaSnap = JSON.stringify(g.meta), realSave = g.save;
    g.save = () => {}; // playtests never touch the real save
    if (opts.lantern) { g.meta.lantern = opts.lantern; g.meta.best = 99; g.meta.bosses = 9; g.meta.kills = 9999; g.meta.wins = 9; }
    if (opts.diff !== undefined) g.meta.diff = opts.diff;
    g.forceBoss = opts.boss || null;
    g.bot = makeBot(opts);
    g.startRun(opts.seed);
    g.fade = null;
    if (opts.relics) for (const id of opts.relics) g.player.addRelic(id);
    if (opts.depth) { g.depth = opts.depth; g.loadFloor(); }
    let t = 0, lastDepth = g.depth, depthStart = 0;
    const dt = 1 / 60;
    try {
      while (t < maxTime) {
        if (g.fade) { const f = g.fade; g.fade = null; if (f.cb) f.cb(); }
        g.update(dt); t += dt;
        if (g.depth !== lastDepth) { res.log.push(`d${lastDepth}: ${(t - depthStart).toFixed(0)}s light ${Math.round(g.player.light)}/${Math.round(g.player.stats.maxLight)}`); lastDepth = g.depth; depthStart = t; }
        if (g.player.dead) break;
        if (g.state === 'win' || g.run.won) { res.won = true; break; }
        if (opts.stopDepth && g.depth >= opts.stopDepth) break;
      }
    } catch (e) { res.error = e && e.stack ? e.stack : String(e); }
    res.depth = g.depth; res.time = Math.round(t); res.kills = g.run.kills; res.cause = g.player.dead ? (g.run.lastHit || 'dark') : ''; res.taken = Math.round(g.run.taken);
    res.relics = g.player.relicOrder.map(id => id + (g.player.relics[id] > 1 ? 'x' + g.player.relics[id] : ''));
    res.light = Math.round(g.player.light);
    res.lantern = g.lanternId; g.forceBoss = null;
    g.bot = null; g.fade = null; g.delays = []; g.meta = JSON.parse(metaSnap); g.save = realSave; g.state = 'title'; LF.ui.enter(g, 'title'); LF.audio.intensity = 0;
    return res;
  };
})();
