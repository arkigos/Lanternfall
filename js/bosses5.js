'use strict';
// Great shadows of Depths IV and V: the Archivist (the Archive of Names), the Tallow Hound (the Hanging Streets)
// and the Unlit (the Unlit Sanctum), with what they call up: names read aloud, and acolytes.
(function () {
  const fx = LF.fx, TAU = LF.TAU, TILE = LF.TILE, DEFS = LF.ENEMY_DEFS, B = LF.BH;

  function hurtIfNear(g, x, y, r, dmg, name) {
    const p = g.player;
    if (p.dead || p.dashing > 0 || p.invuln > 0) return false;
    if (LF.dist(p.x, p.y, x, y) < r + p.r - 3) { g.hurtPlayer(dmg, { x, y, name }); return true; }
    return false;
  }
  // a straight lane from (x, y) along angle a: the bot reads it as a row of circles
  function laneHazard(g, x, y, a, len, w) {
    const c = Math.cos(a), s = Math.sin(a);
    for (let d = 16; d <= len; d += 34) g.hazards.push({ x: x + c * d, y: y + s * d, r: w });
  }
  function inLane(px, py, x, y, a, len, w) {
    const c = Math.cos(a), s = Math.sin(a), rx = px - x, ry = py - y, along = rx * c + ry * s;
    return along > -w * 0.5 && along < len + w * 0.5 && Math.abs(rx * s - ry * c) < w;
  }
  function drawLane(ctx, x, y, a, len, w, k) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(255,90,90,${0.10 + 0.22 * k})`; ctx.lineWidth = w * 2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); ctx.stroke();
    ctx.strokeStyle = `rgba(255,90,90,${0.45 + 0.4 * k})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * len * k, y + Math.sin(a) * len * k); ctx.stroke();
  }
  // the player has just flared (the flare's cooldown jumped back up)
  function flaredNow(e, p) { const f = p.flareT > (e.pFlare || 0) + 1; e.pFlare = p.flareT; return f; }
  const phaseNow = e => e.maxHp > 0 ? B.phaseOf(e) : (e.phase || 1);
  // like the toolkit's pickAttack, but never stuck when every option is the one just used
  function pickSafe(e, list) {
    let n = 0; for (const a of list) if (a !== e.lastAtk) n++;
    let a;
    if (!n) a = list[0]; else { let k = Math.floor(Math.random() * n); for (const x of list) if (x !== e.lastAtk && k-- === 0) { a = x; break; } }
    e.lastAtk = a; return a;
  }

  // =====================================================================================
  // THE ARCHIVIST (Depth IV, Level 9: the Archive of Names)
  // It reads names from the roll, and each name read stands up for a little while to fight for it. Its loose pages
  // swarm and blot out the light; a flare scatters them. Its ledger slams down in a long lane.
  // =====================================================================================
  const ARC = '#c8d38a', ARC_RGB = '200,211,138', PAGE_RGB = '233,226,196';
  const NAMES = ['Annet Coll', 'Bram of the Low Stair', 'Ise Varrow', 'Old Tamsin', 'Hollis Wren', 'Corrin Dale', 'Mave Arden', 'Pell the Younger',
    'Oda Fenwright', 'Sefa Lune', 'Jory Ashlock', 'Wenna Brisk', 'Tobin Hale', 'Ree Callow', 'Marta of the Sluices', 'Edda Moor', 'Lisle Hart', 'Cass Underhill'];

  // A name read aloud: the echo of a bearer on the roll, here for a few breaths, then gone.
  DEFS.remembered = {
    name: 'A Name Read Aloud', hp: 55, speed: 105, r: 11, dmg: 9, embers: 0.3, glass: 0.2, contact: false,
    eyes: [[4, -1.6, 1], [4, 1.6, 1]], eyeColor: '230,236,190',
    init(e) { e.cd = LF.rand(0.9, 1.5); e.life = 9; e.orbit = Math.random() < 0.5 ? 1 : -1; },
    update(e, g, dt) {
      const p = g.player, toP = Math.atan2(p.y - e.y, p.x - e.x), d = LF.dist(e.x, e.y, p.x, p.y);
      e.life -= dt;
      if (e.life <= 0) {
        e.noDrops = true;
        fx.burst(e.x, e.y, 10, { color: [ARC, '#f4f0d8'], speed1: 70, life: 0.6, size: 2 });
        g.killEnemy(e, { type: 'self' });
        return;
      }
      e.face = LF.turnToward(e.face, toP, 6 * dt);
      const want = d > 200 ? toP : d < 120 ? toP + Math.PI : toP + e.orbit * Math.PI / 2;
      if (LF.EH.move(e, g, dt, Math.cos(want), Math.sin(want), e.speed) && Math.random() < dt * 4) e.orbit = -e.orbit;
      e.cd -= dt;
      if (e.cd <= 0.3) e.red = 1;
      if (e.cd <= 0) {
        e.cd = 1.7;
        if (!p.dead && g.map.los(e.x, e.y, p.x, p.y)) {
          g.fireEnemyBullet({ x: e.x + Math.cos(e.face) * 14, y: e.y + Math.sin(e.face) * 14, angle: toP, speed: 210, dmg: e.dmg, color: ARC, size: 4 });
          LF.audio.play('spit');
        }
      }
    },
    draw(e, ctx, g) {
      const time = (g && g.time) || 0, hit = e.flash > 0.6, lit = e.lit, s = (e.r || 11) / 11, fade = Math.min(1, (e.life === undefined ? 9 : e.life) / 1.2);
      ctx.save(); ctx.globalAlpha = 0.85 * fade;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + 8 * s, 10 * s, 4 * s, 0, 0, TAU); ctx.fill();
      ctx.translate(e.x, e.y); ctx.rotate(e.face || 0); ctx.scale(s, s);
      // a narrow cloak, a hood, and a lamp held out on a short pole
      ctx.fillStyle = hit ? '#fff' : (lit ? '#5e6048' : '#1c1d15');
      ctx.beginPath(); ctx.moveTo(-14, 0); ctx.quadraticCurveTo(-8, -10, 3, -7); ctx.lineTo(3, 7); ctx.quadraticCurveTo(-8, 10, -14, 0); ctx.fill();
      ctx.fillStyle = hit ? '#fff' : (lit ? '#3b3d2c' : '#0e0f0a'); ctx.beginPath(); ctx.arc(3, 0, 5, 0, TAU); ctx.fill();
      ctx.strokeStyle = hit ? '#fff' : (lit ? '#77745a' : '#2a2a1f'); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(2, 5); ctx.lineTo(13, 8 + Math.sin(time * 3 + (e.wob || 0)) * 1.5); ctx.stroke();
      ctx.restore();
    },
    drawGlow(e, ctx, g) {
      const time = (g && g.time) || 0, s = (e.r || 11) / 11, fade = Math.min(1, (e.life === undefined ? 9 : e.life) / 1.2);
      const c = Math.cos(e.face || 0), sn = Math.sin(e.face || 0), lx = e.x + (13 * c - 8 * sn) * s, ly = e.y + (13 * sn + 8 * c) * s;
      LF.drawGlow(ctx, ARC, lx, ly, 16 * s, 0.5 * fade * (0.85 + 0.15 * Math.sin(time * 9 + (e.wob || 0))));
      ctx.strokeStyle = `rgba(${ARC_RGB},${0.22 * fade})`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(e.x, e.y, (e.r || 11) * 1.05, 0, TAU); ctx.stroke();
    },
    light(e, lc, white) { lc.globalAlpha = 0.3 * Math.min(1, e.life / 1.2); lc.drawImage(white, e.x - 40, e.y - 40, 80, 80); },
  };

  // the Archivist's own drawing, shared by draw (the body) and drawGlow (what shows in the dark)
  function archivistMantle(ctx) {
    ctx.beginPath(); ctx.moveTo(-36, 0);
    ctx.bezierCurveTo(-24, -32, 4, -30, 12, -19); ctx.lineTo(15, 19); ctx.bezierCurveTo(4, 30, -24, 32, -36, 0); ctx.closePath();
  }

  DEFS.archivist = {
    name: 'The Archivist', title: 'It wrote down everyone in Vael who ever carried a light', boss: true,
    hp: 4000, speed: 40, r: 34, dmg: 13, embers: 0, glass: 0, phases: [0.66, 0.33],
    eyes: [[12, -5, 2], [12, 5, 2]], eyeColor: '220,232,160',
    lore: 'One name on the roll of the born has been struck out. It will not say whose.',
    init(e) { B.bossInit(e); e.clouds = []; e.reads = 0; e.pFlare = 0; e.sa = 0; e.len = 0; e.book = 0; e.side = 0; e.gap = 0; e.wallT = 0; },
    update(e, g, dt) {
      const p = g.player, ph = e.phase;
      e.t -= dt; e.spin += dt; e.book = Math.max(0, e.book - dt * 1.5);
      B.updateTel(e, g, dt);
      if (B.phaseShift(e, g)) { e.state = 'idle'; e.t = 1.1; e.tel.length = 0; }
      const toP = Math.atan2(p.y - e.y, p.x - e.x), d = LF.dist(e.x, e.y, p.x, p.y);
      if (e.state !== 'slam' || e.sub === 0) e.face = LF.turnToward(e.face, toP, 2.6 * dt);

      // the loose pages: they drift after the bearer and blot out its light; a flare scatters them
      const fl = flaredNow(e, p);
      for (const c of e.clouds) {
        c.t -= dt;
        const dc = LF.dist(c.x, c.y, p.x, p.y);
        if ((fl && dc < p.stats.flareRadius + c.r * 0.5) || c.t <= 0) {
          c.dead = true;
          fx.burst(c.x, c.y, 16, { color: ['#e9e2c4', '#8a846a'], speed1: 160, life: 0.7, size: 2.4, glow: false });
          if (fl) fx.text(c.x, c.y - 10, 'SCATTERED', '#e9e2c4', 10, 0.8);
          continue;
        }
        if (dc > 4) { c.x += (p.x - c.x) / dc * c.sp * dt; c.y += (p.y - c.y) / dc * c.sp * dt; }
        g.hazards.push(c);
        if (dc < c.r && !p.dead) {
          g.snuffCount += 2;
          c.cut -= dt;
          if (c.cut <= 0) { c.cut = 0.6; if (p.dashing <= 0 && p.invuln <= 0) g.hurtPlayer(e.dmg * 0.35, { x: c.x, y: c.y, name: 'loose pages' }); }
        }
      }
      LF.compact(e.clouds);

      switch (e.state) {
        case 'intro': if (e.t <= 0) { e.state = 'idle'; e.t = 0.8; } break;
        case 'idle': {
          // a reader, not a brawler: it keeps a little way off
          const sp = e.speed * e.slowMul(g);
          if (d > 260) { e.x += Math.cos(toP) * sp * dt; e.y += Math.sin(toP) * sp * dt; }
          else if (d < 150) { e.x -= Math.cos(toP) * sp * 0.8 * dt; e.y -= Math.sin(toP) * sp * 0.8 * dt; }
          g.map.resolveCircle(e, e.r * 0.7); B.clampToArena(g, e);
          if (e.t <= 0) {
            const opts = ['slam', 'slam'];
            if (B.minions(g) < 1 + ph) opts.push('read', 'read');
            if (e.clouds.length < ph) opts.push('blot');
            if (ph >= 2) opts.push('blot');
            if (ph >= 3) opts.push('leaves', 'leaves');
            e.state = pickSafe(e, opts);
            if (e.state === 'slam') { e.count = ph; e.sub = 0; e.t = 0.15; }
            else if (e.state === 'read') {
              e.reads++;
              e.t = 1.0; e.book = 1;
              // late in the fight, now and then, it reads a line that is not there any more
              if (ph >= 3 && e.reads % 3 === 0) {
                e.state = 'falter'; e.t = 1.9;
                fx.text(e.x, e.y - e.r - 28, '—  —  —  —  —', '#8a8676', 14, 1.9);
                LF.audio.play('whisper');
                break;
              }
              LF.audio.play('whisper');
              const n = ph >= 2 ? 2 : 1;
              for (let i = 0; i < n; i++) {
                const a = e.face + (i === 0 ? 1 : -1) * LF.rand(1.0, 1.7), o = g.map.nearestOpen(e.x + Math.cos(a) * 80, e.y + Math.sin(a) * 80);
                const name = LF.pick(NAMES);
                fx.text(o.x, o.y - 30, name, ARC, 11, 1.6);
                B.telegraph(e, o.x, o.y, 24, 1.0, t => {
                  if (e.dead) return;
                  g.spawnEnemy('remembered', t.x, t.y, { awake: true, spawnT: 0.4, room: 0, noDrops: true });
                  fx.ring(t.x, t.y, 4, 40, 0.4, ARC, 2); LF.audio.play('spawn');
                }, ARC_RGB);
              }
            }
            else if (e.state === 'blot') { e.t = 0.8; e.book = 1; LF.audio.play('flutter'); }
            else if (e.state === 'leaves') { e.count = 2; e.sub = 0; e.side = Math.floor(Math.random() * 4); e.t = 1.0; LF.audio.play('telegraph'); e.gap = Math.random(); }
          }
          break;
        }
        case 'read': e.red = 1; e.book = 1; if (e.t <= 0) { e.state = 'idle'; e.t = 1.0; } break;
        case 'falter': e.book = 0; if (e.t <= 0) { e.state = 'idle'; e.t = 0.6; } break;
        case 'slam':
          if (e.sub === 0) {
            if (e.t <= 0) {
              // the ledger comes down in a long lane through where you stand
              e.sa = Math.atan2(p.y + p.vy * 0.15 - e.y, p.x + p.vx * 0.15 - e.x); e.face = e.sa;
              const ray = g.map.raycast(e.x, e.y, Math.cos(e.sa), Math.sin(e.sa), 460);
              e.len = Math.max(80, Math.min(ray - 6, d + 110, 420));
              e.sub = 1; e.t = ph === 3 ? 0.7 : 0.85; e.max = e.t; LF.audio.play('telegraph');
            }
          } else {
            e.red = 1; e.book = 1;
            laneHazard(g, e.x, e.y, e.sa, e.len, 40);
            if (e.t <= 0) {
              if (!p.dead && p.dashing <= 0 && p.invuln <= 0 && inLane(p.x, p.y, e.x, e.y, e.sa, e.len, 36 + p.r)) g.hurtPlayer(e.dmg * 1.3, { x: e.x, y: e.y, name: 'a falling ledger' });
              const c = Math.cos(e.sa), s = Math.sin(e.sa);
              for (let k = 40; k <= e.len; k += 70) fx.ring(e.x + c * k, e.y + s * k, 6, 40, 0.35, '#e9e2c4', 3);
              fx.burst(e.x + c * e.len, e.y + s * e.len, 14, { color: ['#e9e2c4', '#8a846a'], speed1: 180, life: 0.5, size: 2.2, glow: false });
              g.shake(6); LF.audio.play('gate');
              if (ph >= 2) for (let i = -2; i <= 2; i++) g.fireEnemyBullet({ x: e.x + c * e.len, y: e.y + s * e.len, angle: e.sa + Math.PI + i * 0.32, speed: 150, dmg: e.dmg * 0.6, color: '#e9e2c4', size: 4, life: 2.4 });
              if (--e.count > 0) { e.sub = 0; e.t = 0.3; } else { e.state = 'idle'; e.t = 1.2; }
            }
          }
          break;
        case 'blot':
          e.book = 1;
          if (e.t <= 0) {
            e.clouds.push({ x: e.x + Math.cos(e.face) * 30, y: e.y + Math.sin(e.face) * 30, r: 62 + ph * 6, t: 7.5, sp: 46 + ph * 10, cut: 0.6, seed: Math.random() * 10 });
            LF.audio.play('flutter'); e.state = 'idle'; e.t = 1.0;
          }
          break;
        case 'leaves': {
          // the pages turn: a wall of them crosses the hall from one side, with one gap in it
          if (e.t <= 0) {
            const r = B.arena(g), x0 = r.x * TILE, y0 = r.y * TILE, W = r.w * TILE, H = r.h * TILE, vertical = e.side < 2;
            const span = vertical ? H : W, n = Math.floor(span / 26), gapAt = Math.floor((0.15 + 0.7 * e.gap) * n), gapN = 4;
            const ang = e.side === 0 ? 0 : e.side === 1 ? Math.PI : e.side === 2 ? Math.PI / 2 : -Math.PI / 2;
            for (let i = 0; i < n; i++) {
              if (i >= gapAt && i < gapAt + gapN) continue;
              const along = (i + 0.5) * span / n;
              const x = vertical ? (e.side === 0 ? x0 + 22 : x0 + W - 22) : x0 + along, y = vertical ? y0 + along : (e.side === 2 ? y0 + 22 : y0 + H - 22);
              if (g.map.solidAt(x, y)) continue;
              g.fireEnemyBullet({ x, y, angle: ang, speed: 135, dmg: e.dmg * 0.65, color: '#e9e2c4', size: 5, life: (vertical ? W : H) / 135 + 0.3 });
            }
            LF.audio.play('flutter'); g.shake(3);
            e.gap = (e.gap + 0.35 + Math.random() * 0.3) % 1;
            if (--e.count > 0) e.t = 1.5; else { e.state = 'idle'; e.t = 1.6; }
          }
          break;
        }
      }
    },
    draw(e, ctx, g) {
      if (e.tel) B.drawTel(e, ctx, g);
      const time = (g && g.time) || 0, ph = phaseNow(e), r = e.r || 34, hit = e.flash > 0.6, lit = e.lit, open = 0.6 + 0.4 * (e.book || 0);
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + r * 0.55, r * 1.25, r * 0.5, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.face || 0); ctx.scale(r / 34, r / 34);
      // loose pages wheel around it
      for (let i = 0; i < 12; i++) {
        const a = i * TAU / 12 + time * (0.45 + (i % 3) * 0.12), rad = 48 + 8 * Math.sin(time * 1.3 + i * 2.1);
        ctx.save(); ctx.translate(Math.cos(a) * rad, Math.sin(a) * rad); ctx.rotate(a * 1.7 + time * (i % 2 ? 2 : -1.5));
        ctx.fillStyle = hit ? '#fff' : (lit ? '#8a846a' : '#29271e'); ctx.fillRect(-4, -5, 8, 10);
        ctx.restore();
      }
      // a hunched mantle, ragged at the hem
      ctx.fillStyle = hit ? '#fff' : (lit ? '#2b2920' : '#0d0c09');
      archivistMantle(ctx); ctx.fill();
      ctx.strokeStyle = hit ? '#fff' : (lit ? '#4d4935' : '#1f1d15'); ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = hit ? '#fff' : (lit ? '#2b2920' : '#0d0c09');
      ctx.beginPath(); ctx.moveTo(-30, -16); for (let k = 0; k <= 8; k++) ctx.lineTo(-36 - (k % 2) * 7 - Math.sin(time * 2 + k) * 1.5, -16 + k * 4); ctx.lineTo(-30, 16); ctx.fill();
      // a stole of written strips down the back
      ctx.strokeStyle = hit ? '#fff' : (lit ? '#57533c' : '#1d1b14'); ctx.lineWidth = 3;
      for (const sy of [-9, 9]) { ctx.beginPath(); ctx.moveTo(4, sy * 1.4); ctx.quadraticCurveTo(-12, sy * 1.2, -28 + Math.sin(time * 1.6 + sy) * 2, sy * 0.9); ctx.stroke(); }
      if (ph >= 2) { ctx.strokeStyle = '#060504'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-6, -24); ctx.lineTo(-12, -14); ctx.lineTo(-8, -6); ctx.stroke(); }
      if (ph >= 3) { ctx.beginPath(); ctx.moveTo(-18, 20); ctx.lineTo(-10, 12); ctx.lineTo(-16, 4); ctx.stroke(); }
      // the hood
      ctx.fillStyle = hit ? '#fff' : (lit ? '#1b1a14' : '#050504'); ctx.beginPath(); ctx.arc(9, 0, 11, 0, TAU); ctx.fill();
      ctx.strokeStyle = hit ? '#fff' : (lit ? '#4d4935' : '#1f1d15'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(9, 0, 11, -1.9, 1.9); ctx.stroke();
      // long arms holding the ledger out
      ctx.strokeStyle = hit ? '#fff' : (lit ? '#3c3a2b' : '#151410'); ctx.lineWidth = 4; ctx.lineCap = 'round';
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(6, s * 17); ctx.quadraticCurveTo(18, s * 22, 26, s * 16 * open); ctx.stroke(); }
      // the ledger, open: spine pointing away, pages to either side
      ctx.save(); ctx.translate(31, 0);
      for (const s of [-1, 1]) {
        ctx.fillStyle = hit ? '#fff' : (lit ? '#3d2b1d' : '#120c08');
        ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(16, 0); ctx.lineTo(16, s * 25 * open); ctx.lineTo(-12, s * 23 * open); ctx.closePath(); ctx.fill();
        ctx.fillStyle = hit ? '#fff' : (lit ? '#b3aa86' : '#37342a');
        ctx.beginPath(); ctx.moveTo(-10, s * 1.5); ctx.lineTo(14, s * 1.5); ctx.lineTo(14, s * 22 * open); ctx.lineTo(-10, s * 20 * open); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = lit ? '#4c4636' : '#1c1a14'; ctx.lineWidth = 1;
        for (let j = 0; j < 4; j++) { const yy = s * (5 + j * 4.2) * open; ctx.beginPath(); ctx.moveTo(-7, yy); ctx.lineTo(11 - (j % 2) * 5, yy); ctx.stroke(); }
      }
      ctx.strokeStyle = lit ? '#2a1d13' : '#0a0705'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(16, 0); ctx.stroke();
      ctx.restore();
      ctx.restore();
    },
    drawGlow(e, ctx, g) {
      const time = (g && g.time) || 0, r = e.r || 34, book = e.book || 0, open = 0.6 + 0.4 * book;
      // the ledger's lane, while it is raised
      if (e.state === 'slam' && e.sub === 1) drawLane(ctx, e.x, e.y, e.sa, e.len, 40, 1 - Math.max(0, e.t) / (e.max || 0.85));
      // the edge a wall of pages will come from
      if (e.state === 'leaves' && g && g.map) {
        const ar = g.map.rooms[0], x0 = ar.x * TILE, y0 = ar.y * TILE, W = ar.w * TILE, H = ar.h * TILE, k = 0.4 + 0.3 * Math.sin(time * 14);
        ctx.strokeStyle = `rgba(255,90,90,${k})`; ctx.lineWidth = 4; ctx.beginPath();
        if (e.side === 0) { ctx.moveTo(x0 + 16, y0); ctx.lineTo(x0 + 16, y0 + H); } else if (e.side === 1) { ctx.moveTo(x0 + W - 16, y0); ctx.lineTo(x0 + W - 16, y0 + H); }
        else if (e.side === 2) { ctx.moveTo(x0, y0 + 16); ctx.lineTo(x0 + W, y0 + 16); } else { ctx.moveTo(x0, y0 + H - 16); ctx.lineTo(x0 + W, y0 + H - 16); }
        ctx.stroke();
      }
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.face || 0); ctx.scale(r / 34, r / 34);
      // a pale rim on the mantle and on every loose page, enough to see its shape in the dark
      ctx.strokeStyle = `rgba(${ARC_RGB},0.16)`; ctx.lineWidth = 1.2; archivistMantle(ctx); ctx.stroke();
      ctx.strokeStyle = `rgba(${PAGE_RGB},${0.2 + 0.25 * book})`; ctx.lineWidth = 1;
      for (let i = 0; i < 12; i++) {
        const a = i * TAU / 12 + time * (0.45 + (i % 3) * 0.12), rad = 48 + 8 * Math.sin(time * 1.3 + i * 2.1);
        ctx.save(); ctx.translate(Math.cos(a) * rad, Math.sin(a) * rad); ctx.rotate(a * 1.7 + time * (i % 2 ? 2 : -1.5)); ctx.strokeRect(-4, -5, 8, 10); ctx.restore();
      }
      // the written lines kindle while it reads
      ctx.strokeStyle = `rgba(${ARC_RGB},${0.2 + 0.6 * book})`; ctx.lineWidth = 1.2;
      for (const s of [-1, 1]) for (let j = 0; j < 4; j++) { const yy = s * (5 + j * 4.2) * open; ctx.beginPath(); ctx.moveTo(24, yy); ctx.lineTo(42 - (j % 2) * 5, yy); ctx.stroke(); }
      ctx.restore();
      const c = Math.cos(e.face || 0), s = Math.sin(e.face || 0);
      LF.drawGlow(ctx, ARC, e.x + c * 33 * r / 34, e.y + s * 33 * r / 34, 34 + 20 * book, 0.08 + 0.22 * book);
      // the page swarms: they blot out what is behind them
      for (const cl of (e.clouds || [])) {
        const fade = Math.min(1, cl.t / 1.2);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = `rgba(4,4,3,${0.42 * fade})`; ctx.beginPath(); ctx.arc(cl.x, cl.y, cl.r, 0, TAU); ctx.fill();
        for (let i = 0; i < 18; i++) {
          const a = i * 2.4 + time * (0.7 + (i % 4) * 0.2) + cl.seed, rr = cl.r * (0.25 + 0.7 * ((i * 0.37 + cl.seed) % 1));
          ctx.save(); ctx.translate(cl.x + Math.cos(a) * rr, cl.y + Math.sin(a) * rr * 0.8); ctx.rotate(a * 2.3);
          ctx.fillStyle = `rgba(${PAGE_RGB},${0.45 * fade})`; ctx.fillRect(-3.5, -4.5, 7, 9);
          ctx.restore();
        }
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(255,90,90,${0.35 * fade})`; ctx.lineWidth = 1.5; ctx.setLineDash([5, 7]);
        ctx.beginPath(); ctx.arc(cl.x, cl.y, cl.r, time, time + TAU); ctx.stroke(); ctx.setLineDash([]);
      }
    },
    light(e, lc, white) { lc.globalAlpha = 0.3 + 0.3 * (e.book || 0); lc.drawImage(white, e.x - 70, e.y - 70, 140, 140); },
  };

  // =====================================================================================
  // THE TALLOW HOUND (Depth V, Level 3: the Hanging Streets)
  // It hunts by the smell of your flame. A moving flame leaves a scent trail (shown on the floor); a flame held still,
  // or burning low, leaves none, and the hound loses you and goes nose-down along the trail. The candles on its back
  // burn while it has your scent and gutter when it has lost it. It circles out of the light, crouches, lunges down
  // a marked lane, and runs back out. Late on it sets your own trail alight.
  // =====================================================================================
  const TALLOW = '#ffcf8a', TALLOW_RGB = '255,207,138', SCENT_N = 30;

  function houndBody(ctx, crouch) {
    ctx.beginPath(); ctx.ellipse(-4, 0, 30 - crouch * 3, 10, 0, 0, TAU);
  }

  DEFS.hound = {
    name: 'The Tallow Hound', title: 'It hunts by the smell of a flame', boss: true,
    hp: 2700, speed: 172, r: 26, dmg: 13, embers: 0, glass: 0, phases: [0.66, 0.33], contact: false,
    eyes: [[36, -5, 1.9], [36, 5, 1.9]], eyeColor: '255,236,170',
    lore: 'It was bred to guard the lamps of the old city. It still follows the smell of a flame.',
    hideEyes(e) { return !!e.lost; },
    init(e) {
      B.bossInit(e);
      e.trail = []; for (let i = 0; i < SCENT_N; i++) e.trail.push({ x: 0, y: 0, t: 0, i: 0 });
      e.head = 0; e.seq = 0; e.dropT = 0; e.fresh = 0; e.lost = false; e.told = false; e.heard = 0; e.keep = 0; e.saidT = 0;
      e.orbit = 1; e.trackSeq = 0; e.cx = 0; e.cy = 0; e.castR = 40; e.lx = 0; e.ly = 0; e.k = 0; e.crouch = 0; e.lastMoveX = 0; e.lastMoveY = 0; e.flip = 0;
    },
    // a lost hound turns on whatever hits it
    modDamage(e, dmg, src) { if (e.lost && !src.quiet && !(e.heard > 0)) e.heard = 0.8; return dmg; },
    update(e, g, dt) {
      const p = g.player, ph = e.phase, tr = e.trail;
      e.t -= dt; e.spin += dt; e.flip -= dt;
      B.updateTel(e, g, dt);
      if (B.phaseShift(e, g)) { e.state = 'retreat'; e.t = 0.8; e.tel.length = 0; e.lost = false; }
      const toP = Math.atan2(p.y - e.y, p.x - e.x), d = LF.dist(e.x, e.y, p.x, p.y);
      const run = (ang, sp) => {
        const ox = e.x, oy = e.y;
        e.x += Math.cos(ang) * sp * dt; e.y += Math.sin(ang) * sp * dt;
        g.map.resolveCircle(e, e.r * 0.8); B.clampToArena(g, e);
        if (LF.dist(ox, oy, e.x, e.y) < sp * dt * 0.3 && e.flip <= 0) { e.orbit = -e.orbit; e.flip = 0.8; }
        e.face = LF.turnToward(e.face, ang, 7 * dt);
      };
      const goTo = (x, y, sp) => { const l = LF.dist(e.x, e.y, x, y); if (l > 3) run(Math.atan2(y - e.y, x - e.x), Math.min(sp, l / dt)); return l; };

      // the scent: a moving, well-lit flame leaves a mark every little while; a still or failing one leaves none
      for (const m of tr) if (m.t > 0) m.t -= dt;
      e.dropT -= dt; e.fresh += dt;
      const moving = Math.hypot(p.vx || 0, p.vy || 0) > 40, strong = p.frac() >= 0.25;
      if (!p.dead && moving && strong && e.dropT <= 0) {
        e.dropT = 0.26; e.head = (e.head + 1) % SCENT_N;
        const m = tr[e.head]; m.x = p.x; m.y = p.y; m.t = 7; m.i = ++e.seq; e.fresh = 0;
      }
      // does it know where you are: a fresh scent, close enough to hear, or it has just been struck
      let struck = false;
      if (e.heard > 0) { e.heard -= dt; if (e.heard <= 0) struck = true; }
      const hears = d < 80 + 50 * Math.min(1, p.frac());
      const knows = !p.dead && (e.fresh < 0.9 || hears || struck);
      const huntState = e.state === 'stalk' || e.state === 'retreat';
      if (e.keep > 0) e.keep -= dt;
      if (e.saidT > 0) e.saidT -= dt;
      if (!e.lost && !knows && e.keep <= 0 && huntState) {
        e.lost = true; e.state = 'track'; e.castR = 40;
        // start from the mark nearest the hound
        let best = null, bd = Infinity;
        for (const m of tr) if (m.t > 0) { const dd = LF.dist2(e.x, e.y, m.x, m.y); if (dd < bd) { bd = dd; best = m; } }
        if (best) e.trackSeq = best.i; else { e.state = 'cast'; e.cx = e.x; e.cy = e.y; e.t = 3.5; }
        if (e.saidT <= 0) { e.saidT = 4; fx.text(e.x, e.y - e.r - 14, 'LOST THE SCENT', '#b9ad96', 10, 1.0); LF.audio.play('whisper'); }
        if (!e.told) { e.told = true; g.banner = { text: 'It has lost the scent', sub: 'A still or failing flame leaves no trail', t: 0, dur: 2.8, small: true, boss: true }; }
      } else if (e.lost && knows) {
        e.lost = false; e.heard = 0; e.keep = 2.5;
        fx.text(e.x, e.y - e.r - 14, 'FOUND', TALLOW, 11, 0.9); LF.audio.play('growl'); e.red = 1;
        if (d < 300) { e.state = 'crouch'; e.sub = 0; e.count = 1; } else { e.state = 'stalk'; e.t = 0.6; }
      }

      switch (e.state) {
        case 'intro': if (e.t <= 0) { e.state = 'stalk'; e.t = 1.5; } break;
        case 'stalk': {
          // circle at the edge of the light, just out of it
          const R = LF.clamp(p.lightR + 45, 170, 320), a = Math.atan2(e.y - p.y, e.x - p.x) + e.orbit * 0.7;
          let tx = p.x + Math.cos(a) * R, ty = p.y + Math.sin(a) * R;
          goTo(tx, ty, e.speed * 0.85 * e.slowMul(g));
          if (e.t <= 0) {
            const opts = ['crouch', 'crouch'];
            if (ph >= 2) opts.push('bay');
            let live = 0; for (const m of tr) if (m.t > 1) live++;
            if (ph >= 3 && live >= 6) opts.push('kindle', 'kindle');
            e.state = pickSafe(e, opts);
            if (e.state === 'crouch') { e.sub = 0; e.count = ph >= 2 ? 2 : 1; }
            else if (e.state === 'bay') { e.t = 0.55; e.count = 2; LF.audio.play('growl'); }
            else if (e.state === 'kindle') { e.t = 1.0; LF.audio.play('howl'); g.shake(4); }
          }
          break;
        }
        case 'crouch':
          e.red = 1;
          if (e.sub === 0) {
            // lock the lane once, at the start: what you see is where it goes
            e.sa = Math.atan2(p.y + (p.vy || 0) * 0.12 - e.y, p.x + (p.vx || 0) * 0.12 - e.x); e.face = e.sa;
            const ray = g.map.raycast(e.x, e.y, Math.cos(e.sa), Math.sin(e.sa), 520) - e.r - 4;
            e.len = Math.max(60, Math.min(ray, d + 120, 460));
            e.sub = 1; e.t = e.quick ? 0.45 : (ph === 3 ? 0.55 : ph === 2 ? 0.62 : 0.72); e.max = e.t; e.quick = false;
            LF.audio.play('growl');
          }
          e.crouch = Math.min(1, e.crouch + dt * 4);
          laneHazard(g, e.x, e.y, e.sa, e.len, e.r + 10);
          if (e.t <= 0) { e.state = 'lunge'; e.k = 0; e.sx = e.x; e.sy = e.y; e.lx = Math.cos(e.sa); e.ly = Math.sin(e.sa); e.bit = false; LF.audio.play('lunge'); }
          break;
        case 'lunge':
          e.red = 1; e.crouch = Math.max(0, e.crouch - dt * 6);
          e.k = Math.min(1, e.k + dt * 760 / e.len * e.slowMul(g));
          e.x = e.sx + e.lx * e.len * e.k; e.y = e.sy + e.ly * e.len * e.k;
          if (!e.bit && hurtIfNear(g, e.x, e.y, e.r + 6, e.dmg * 1.35, 'the Tallow Hound')) e.bit = true;
          if (Math.random() < 0.7) fx.spawn({ x: e.x - e.lx * 20, y: e.y - e.ly * 20, vx: LF.rand(-20, 20), vy: LF.rand(-20, 20), life: 0.4, size: 3, color: '#3a3226', glow: false });
          if (e.k >= 1) {
            g.map.resolveCircle(e, e.r * 0.8); B.clampToArena(g, e);
            if (--e.count > 0) { e.state = 'crouch'; e.sub = 0; e.quick = true; } else { e.state = 'retreat'; e.t = 1.0; }
          }
          break;
        case 'retreat': {
          // back out of the light
          const R = LF.clamp(p.lightR + 50, 180, 330);
          if (d < R) run(Math.atan2(e.y - p.y, e.x - p.x) + e.orbit * 0.5, e.speed * 1.05 * e.slowMul(g));
          if (e.t <= 0 || d >= R) { e.state = 'stalk'; e.t = Math.max(0.8, LF.rand(1.5, 2.5) - ph * 0.3); }
          break;
        }
        case 'bay':
          e.red = 1; e.face = LF.turnToward(e.face, toP, 5 * dt);
          if (e.t <= 0) {
            for (let i = -3; i <= 3; i++) g.fireEnemyBullet({ x: e.x + Math.cos(e.face) * 30, y: e.y + Math.sin(e.face) * 30, angle: e.face + i * 0.16, speed: 230 - Math.abs(i) * 10, dmg: e.dmg * 0.6, color: TALLOW, size: 5, life: 2.2 });
            LF.audio.play('howl'); g.shake(3);
            if (--e.count > 0) e.t = 0.35; else { e.state = 'stalk'; e.t = 1.4; }
          }
          break;
        case 'kindle':
          e.red = 1; e.face = LF.turnToward(e.face, toP, 5 * dt);
          if (e.t <= 0) {
            // the trail you left catches, oldest first
            const live = tr.filter(m => m.t > 0).sort((a, b) => a.i - b.i).slice(-14);
            live.forEach((m, k) => {
              B.telegraph(e, m.x, m.y, 38, 0.9 + k * 0.06, t => B.blast(g, t.x, t.y, 40, e.dmg * 0.9, 'burning tallow', TALLOW), TALLOW_RGB);
              m.t = 0;
            });
            e.state = 'stalk'; e.t = 1.8;
          }
          break;
        case 'track': {
          // nose down, along the trail, slowly
          let m = null;
          for (const q of tr) if (q.t > 0 && q.i === e.trackSeq) { m = q; break; }
          if (!m) { let bi = Infinity; for (const q of tr) if (q.t > 0 && q.i > e.trackSeq && q.i < bi) { bi = q.i; m = q; } if (m) e.trackSeq = m.i; }
          if (!m) { e.state = 'cast'; e.t = 3.5; e.castR = 40; let nx = tr[e.head]; e.cx = nx.t > 0 ? nx.x : e.x; e.cy = nx.t > 0 ? nx.y : e.y; break; }
          if (goTo(m.x, m.y, e.speed * 0.5 * e.slowMul(g)) < 14) {
            let nx = null, bi = Infinity;
            for (const q of tr) if (q.t > 0 && q.i > m.i && q.i < bi) { bi = q.i; nx = q; }
            if (nx) e.trackSeq = nx.i; else { e.state = 'cast'; e.t = 3.5; e.castR = 40; e.cx = m.x; e.cy = m.y; }
          }
          if (Math.random() < dt * 2) LF.audio.play('step');
          break;
        }
        case 'cast': {
          // casting about in widening circles; given long enough, it hears you anyway
          e.castR = Math.min(170, e.castR + dt * 45);
          const a = Math.atan2(e.y - e.cy, e.x - e.cx) + e.orbit * 0.6;
          goTo(e.cx + Math.cos(a) * e.castR, e.cy + Math.sin(a) * e.castR, e.speed * 0.55 * e.slowMul(g));
          if (e.t <= 0) { e.lost = false; fx.text(e.x, e.y - e.r - 14, 'FOUND', TALLOW, 11, 0.9); LF.audio.play('growl'); e.state = 'stalk'; e.t = 0.8; }
          break;
        }
      }
      if (e.state !== 'crouch' && e.state !== 'lunge') e.crouch = Math.max(0, e.crouch - dt * 3);
    },
    draw(e, ctx, g) {
      if (e.tel) B.drawTel(e, ctx, g);
      const time = (g && g.time) || 0, ph = phaseNow(e), r = e.r || 26, hit = e.flash > 0.6, lit = e.lit, crouch = e.crouch || 0;
      const fast = e.state === 'lunge' || e.state === 'retreat' || e.state === 'stalk', slow = e.state === 'track' || e.state === 'cast';
      const gait = time * (fast ? 13 : slow ? 6 : 3) + (e.wob || 0), nose = slow ? 4 : 0;
      ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + r * 0.5, r * 1.7, r * 0.45, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.face || 0); ctx.scale(r / 26, r / 26);
      const hide = hit ? '#fff' : (lit ? '#6f6450' : '#1d1912'), dark = hit ? '#fff' : (lit ? '#463e30' : '#100d09');
      // long legs, jointed, moving in a lope
      ctx.strokeStyle = dark; ctx.lineWidth = 3.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const [lx, side, off] of [[16, -1, 0], [16, 1, Math.PI], [-20, -1, Math.PI], [-20, 1, 0]]) {
        const sw = Math.sin(gait + off) * (fast ? 9 : 5);
        ctx.beginPath(); ctx.moveTo(lx, side * 7); ctx.lineTo(lx + sw * 0.5 + 4, side * (16 - crouch * 3)); ctx.lineTo(lx + sw, side * (22 - crouch * 4)); ctx.stroke();
      }
      // a long whip of a tail
      ctx.lineWidth = 3; ctx.strokeStyle = hide;
      ctx.beginPath(); ctx.moveTo(-32, 0); ctx.quadraticCurveTo(-46, Math.sin(time * 4) * 8, -58, Math.sin(time * 4 + 1) * 12); ctx.stroke();
      // lean body: haunch, ribs, deep chest
      ctx.fillStyle = hide; houndBody(ctx, crouch); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-22, 0, 11, 11, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(12, 0, 12 - crouch, 11, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = dark; ctx.lineWidth = 1.2;
      for (let i = 0; i < 6; i++) { const x = -8 + i * 4; ctx.beginPath(); ctx.moveTo(x, -9); ctx.quadraticCurveTo(x + 2, 0, x, 9); ctx.stroke(); }
      // the spine, and three guttered candle stubs set into it
      ctx.strokeStyle = dark; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(18, 0); ctx.stroke();
      ctx.fillStyle = hit ? '#fff' : (lit ? '#d8ccaa' : '#3a352a');
      for (const cx of [-18, -6, 6]) { ctx.beginPath(); ctx.ellipse(cx, 0, 3.4, 3.4, 0, 0, TAU); ctx.fill(); }
      // waxy drips down the flanks
      ctx.fillStyle = hit ? '#fff' : (lit ? '#9c8f6f' : '#2a251b');
      for (const [dx, dy] of [[-16, 7], [-4, -8], [8, 8], [-24, -7]]) { ctx.beginPath(); ctx.ellipse(dx, dy, 1.8, 3.2, 0, 0, TAU); ctx.fill(); }
      // neck and long head, lowered when it is following the ground
      ctx.save(); ctx.translate(22, 0); ctx.scale(1, 1);
      ctx.fillStyle = hide;
      ctx.beginPath(); ctx.moveTo(-4, -6); ctx.lineTo(10 + nose, -6 + crouch); ctx.lineTo(10 + nose, 6 - crouch); ctx.lineTo(-4, 6); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(8 + nose, -7); ctx.lineTo(20 + nose, -4); ctx.lineTo(28 + nose, -1.5); ctx.lineTo(28 + nose, 1.5); ctx.lineTo(20 + nose, 4); ctx.lineTo(8 + nose, 7); ctx.closePath(); ctx.fill();
      // ears laid back, flatter in the crouch
      ctx.fillStyle = dark;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(10 + nose, s * 5); ctx.lineTo(2 + nose - crouch * 3, s * (12 - crouch * 3)); ctx.lineTo(13 + nose, s * 3); ctx.closePath(); ctx.fill(); }
      if (ph >= 2) { ctx.strokeStyle = '#080604'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(20 + nose, -3); ctx.lineTo(16 + nose, 0); ctx.lineTo(21 + nose, 3); ctx.stroke(); }
      ctx.restore();
      if (ph >= 3) { ctx.strokeStyle = '#080604'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-12, -9); ctx.lineTo(-16, -2); ctx.lineTo(-10, 4); ctx.stroke(); }
      ctx.restore();
    },
    drawGlow(e, ctx, g) {
      const time = (g && g.time) || 0, r = e.r || 26, crouch = e.crouch || 0;
      // your scent, a faint smear on the floor
      for (const m of (e.trail || [])) if (m.t > 0) { LF.drawGlow(ctx, TALLOW, m.x, m.y, 9, 0.05 + 0.13 * (m.t / 7)); }
      if (e.state === 'crouch' && e.sub === 1) drawLane(ctx, e.x, e.y, e.sa, e.len, e.r + 10, 1 - Math.max(0, e.t) / (e.max || 0.7));
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.face || 0); ctx.scale(r / 26, r / 26);
      // a waxy rim along the back and head: enough to see it circling out in the dark
      ctx.strokeStyle = `rgba(${TALLOW_RGB},${e.lost ? 0.1 : 0.2})`; ctx.lineWidth = 1.2;
      houndBody(ctx, crouch); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(30, -7); ctx.lineTo(50, -1.5); ctx.lineTo(50, 1.5); ctx.lineTo(30, 7); ctx.stroke();
      // the candles on its back burn while it has your scent, and gutter when it has lost it
      for (const [k, cx] of [[0, -18], [1, -6], [2, 6]]) {
        if (!e.lost) {
          const f = 1 + Math.sin(time * 13 + k * 2) * 0.2, lean = (e.state === 'lunge' ? -4 : -1.5);
          ctx.fillStyle = `rgba(255,170,80,${0.8})`; ctx.beginPath(); ctx.moveTo(cx - 2, -1.5); ctx.quadraticCurveTo(cx + lean, -3, cx + lean * 2, -7 * f); ctx.quadraticCurveTo(cx + 2.5, -3, cx + 2, -1.5); ctx.closePath(); ctx.fill();
        } else {
          ctx.strokeStyle = 'rgba(160,150,130,0.25)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(cx, -2); ctx.quadraticCurveTo(cx - 3 + Math.sin(time * 2 + k), -8, cx + Math.sin(time * 1.5 + k) * 3, -14); ctx.stroke();
        }
      }
      ctx.restore();
      if (!e.lost) LF.drawGlow(ctx, '#ffb060', e.x - Math.cos(e.face || 0) * 6, e.y - Math.sin(e.face || 0) * 6, 34, 0.18 + (e.red > 0 ? 0.1 : 0));
    },
    light(e, lc, white) { if (!e.lost) { lc.globalAlpha = 0.35; lc.drawImage(white, e.x - 55, e.y - 55, 110, 110); } },
  };

  // =====================================================================================
  // THE UNLIT (Depth V, Level 9: the Unlit Sanctum)
  // The high priest of those who prayed to the dark. It comes into a hall whose braziers burn, and sets out to put
  // them out. Near it your light shrinks; its censer crushes the light where you stand. It wraps itself in its own
  // darkness, and while it does it can barely be hurt, unless a brazier's light or a flare's falls on it. Its
  // acolytes go for the braziers. Late on it puts out every flame in the hall at once.
  // =====================================================================================
  const ASH = '#9fe08a', ASH_RGB = '159,224,138', TMP = { x: 0, y: 0 };

  DEFS.acolyte = {
    name: 'Acolyte of the Unlit', hp: 70, speed: 92, r: 12, dmg: 10, embers: 0.5, glass: 0.4,
    eyes: [[5, -2.5, 1.2], [5, 2.5, 1.2]], eyeColor: '170,235,150',
    init(e) { e.state = 'seek'; e.target = null; e.t = 0; },
    update(e, g, dt) {
      const p = g.player;
      e.t -= dt;
      if (e.state === 'smother') {
        e.red = 1; e.vx *= 0.8; e.vy *= 0.8;
        const b = e.target;
        if (!b || !b.lit) { e.state = 'seek'; e.target = null; return; }
        if (Math.random() < dt * 20) fx.spawn({ x: b.x + LF.rand(-8, 8), y: b.y - 8, vx: (e.x - b.x) * 1.2, vy: (e.y - b.y) * 1.2, life: 0.4, size: 2.5, color: '#ffb347' });
        if (e.t <= 0) {
          b.lit = false; b.snuffed = true;
          g.litBraziers = g.props.filter(q => q.kind === 'brazier' && q.lit);
          fx.burst(b.x, b.y - 8, 16, { color: ['#1d2a1c', '#0d140c'], glow: false, speed1: 110, life: 0.8, size: 5 });
          fx.text(b.x, b.y - 30, 'SNUFFED', ASH, 11, 1);
          LF.audio.play('steal');
          e.state = 'seek'; e.target = null;
        }
        return;
      }
      if (!e.target || !e.target.lit) {
        e.target = null;
        let bd = 900 * 900;
        for (const b of g.litBraziers) { const dd = LF.dist2(e.x, e.y, b.x, b.y); if (dd < bd) { bd = dd; e.target = b; } }
      }
      if (e.target) {
        const b = e.target, l = LF.dist(e.x, e.y, b.x, b.y) || 1;
        if (l < 30) { e.state = 'smother'; e.t = 1.4; LF.audio.play('hiss'); return; }
        // with no line to it, it follows the flow toward the bearer and tries again
        if (g.map.los(e.x, e.y, b.x, b.y)) LF.EH.move(e, g, dt, (b.x - e.x) / l, (b.y - e.y) / l, e.speed);
        else { const c = LF.EH.chaseDir(e, g, TMP); LF.EH.move(e, g, dt, c.x, c.y, e.speed); }
        e.face = LF.turnToward(e.face, Math.atan2(b.y - e.y, b.x - e.x), 6 * dt);
      } else {
        const c = LF.EH.chaseDir(e, g, TMP);
        LF.EH.move(e, g, dt, c.x, c.y, e.speed * 1.1);
        LF.EH.facePlayer(e, g, dt, 6);
      }
    },
    draw(e, ctx, g) {
      const time = (g && g.time) || 0, hit = e.flash > 0.6, lit = e.lit, s = (e.r || 12) / 12;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + 8 * s, 11 * s, 4 * s, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.face || 0); ctx.scale(s, s);
      ctx.fillStyle = hit ? '#fff' : (lit ? '#2c3a2a' : '#0c110b');
      ctx.beginPath(); ctx.moveTo(-14, 0); ctx.quadraticCurveTo(-10, -12, 4, -8); ctx.lineTo(4, 8); ctx.quadraticCurveTo(-10, 12, -14, 0); ctx.fill();
      ctx.fillStyle = hit ? '#fff' : (lit ? '#141c13' : '#040604'); ctx.beginPath(); ctx.arc(4, 0, 6, 0, TAU); ctx.fill();
      // the long snuffer it carries: a pole and a little bell-cap
      ctx.strokeStyle = hit ? '#fff' : (lit ? '#5d6a52' : '#1e241b'); ctx.lineWidth = 1.6;
      const sw = Math.sin(time * 2 + (e.wob || 0)) * 0.1 + (e.state === 'smother' ? 0.4 : 0);
      ctx.save(); ctx.rotate(sw); ctx.beginPath(); ctx.moveTo(0, 7); ctx.lineTo(22, 7); ctx.stroke();
      ctx.fillStyle = hit ? '#fff' : (lit ? '#5d6a52' : '#1e241b'); ctx.beginPath(); ctx.moveTo(20, 3); ctx.lineTo(27, 4.5); ctx.lineTo(27, 9.5); ctx.lineTo(20, 11); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.restore();
    },
    drawGlow(e, ctx) {
      ctx.strokeStyle = `rgba(${ASH_RGB},0.16)`; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(e.x, e.y, (e.r || 12) + 1, 0, TAU); ctx.stroke();
    },
  };

  function unlitRobe(ctx) {
    ctx.beginPath(); ctx.moveTo(-38, 0);
    ctx.bezierCurveTo(-30, -26, -4, -30, 10, -20); ctx.lineTo(12, 20); ctx.bezierCurveTo(-4, 30, -30, 26, -38, 0); ctx.closePath();
  }
  // where the censer hangs, relative to the priest, in its own frame
  function censerAt(e, time) {
    const swing = e.state === 'snuff' ? Math.sin(time * 9) * 0.9 : Math.sin(time * 1.8) * 0.45;
    return { x: 22 + Math.cos(swing) * 20, y: 22 + Math.sin(swing) * 14 };
  }
  const VEIL_R = 140;

  DEFS.unlit = {
    name: 'The Unlit', title: 'High priest of those who prayed to the dark', boss: true,
    hp: 4400, speed: 34, r: 32, dmg: 14, embers: 0, glass: 0, phases: [0.66, 0.33],
    eyes: [[12, -4, 1.6], [12, 4, 1.6]], eyeColor: '170,240,150',
    lore: 'We only opened the door. Someone else held the knife.',
    hideEyes(e) { return e.veil > 0 && !e.exposed; },
    init(e) { B.bossInit(e); e.veil = 0; e.veilT = 5; e.crush = 0; e.pFlare = 0; e.started = false; e.kneelT = 6; e.exposed = false; e.told = false; e.hx = 0; e.hy = 0; e.veilMax = 1; },
    // in its own darkness it can barely be hurt, unless some other light falls on it
    modDamage(e, dmg, src) {
      if (!(e.veil > 0) || e.exposed || src.type === 'flare') return dmg;
      if (!src.quiet) { src.blocked = true; if (Math.random() < 0.2) fx.text(e.x, e.y - e.r - 18, 'VEILED', '#8aa883', 9, 0.5); }
      return dmg * (src.noShroud ? 0.5 : 0.25);
    },
    update(e, g, dt) {
      const p = g.player, ph = e.phase;
      e.t -= dt; e.spin += dt; e.veilT -= dt; e.kneelT -= dt;
      B.updateTel(e, g, dt);
      // it comes into a hall where the braziers burn
      if (!e.started) {
        e.started = true;
        for (const pr of g.props) if (pr.kind === 'brazier' && pr.room === 0 && !pr.lit) { g.lightBrazier(pr, true); fx.ring(pr.x, pr.y - 8, 4, 40, 0.5, '#ffb347', 2); }
      }
      if (B.phaseShift(e, g)) { e.state = 'idle'; e.t = 1.1; e.tel.length = 0; }
      const toP = Math.atan2(p.y - e.y, p.x - e.x), d = LF.dist(e.x, e.y, p.x, p.y);
      if (e.state !== 'litany') e.face = LF.turnToward(e.face, toP, 2.4 * dt);

      // near it, your light shrinks; crushed by the censer, it shrinks further
      if (d < 330) g.snuffCount += ph >= 3 ? 2 : 1;
      if (e.crush > 0) { e.crush -= dt; g.snuffCount += 2; p.dim = Math.max(p.dim, 0.6); }

      // is any light but the bearer's own on it: a brazier's, or a flare's afterlight
      e.exposed = false;
      for (const b of g.litBraziers) if (LF.dist2(e.x, e.y, b.x, b.y) < 150 * 150) { e.exposed = true; break; }
      if (!e.exposed) for (const z of g.zones) if ((z.kind === 'light' || z.kind === 'beacon') && !z.dead && LF.dist2(e.x, e.y, z.x, z.y) < (z.r + e.r) * (z.r + e.r)) { e.exposed = true; break; }
      // a flare close by tears the veil outright
      if (flaredNow(e, p) && e.veil > 0 && d < p.stats.flareRadius + e.r + 40) {
        e.veil = 0; fx.text(e.x, e.y - e.r - 20, 'THE VEIL TEARS', '#e8f6d8', 11, 1.0); fx.ring(e.x, e.y, e.r, VEIL_R, 0.5, '#e8f6d8', 3); LF.audio.play('shroud');
      }
      if (e.veil > 0) {
        e.veil -= dt;
        if (!p.dead && d < VEIL_R) g.snuffCount += 1;
        if (e.veil <= 0) { fx.ring(e.x, e.y, VEIL_R, e.r, 0.4, ASH, 2); }
      }

      switch (e.state) {
        case 'intro': if (e.t <= 0) { e.state = 'idle'; e.t = 0.8; } break;
        case 'idle': {
          const sp = e.speed * e.slowMul(g);
          if (e.veil > 0) {
            // veiled, it makes for the darkest part of the hall
            const l = LF.dist(e.x, e.y, e.hx, e.hy);
            if (l > 8) { e.x += (e.hx - e.x) / l * sp * 1.6 * dt; e.y += (e.hy - e.y) / l * sp * 1.6 * dt; }
          } else if (d > 220) { e.x += Math.cos(toP) * sp * dt; e.y += Math.sin(toP) * sp * dt; }
          g.map.resolveCircle(e, e.r * 0.7); B.clampToArena(g, e);
          if (e.t <= 0) {
            if (e.veilT <= 0 && !(e.veil > 0)) { e.state = 'veil'; e.t = 0.8; LF.audio.play('hiss'); break; }
            if (ph >= 3 && e.kneelT <= 0 && g.litBraziers.some(b => b.room === 0)) { e.state = 'kneel'; e.t = 1.6; LF.audio.play('roar'); if (!e.told) { e.told = true; g.banner = { text: 'Kneel', sub: 'Every flame in the hall goes out', t: 0, dur: 2.2, small: true, boss: true }; } break; }
            const opts = ['snuff', 'litany', 'litany'];
            if (B.minions(g) < 1 + ph && g.litBraziers.some(b => b.room === 0)) opts.push('raise', 'raise');
            else if (B.minions(g) < ph) opts.push('raise');
            if (ph >= 2) opts.push('snuff');
            e.state = pickSafe(e, opts);
            if (e.state === 'snuff') { e.t = 0.35; e.count = ph >= 2 ? 2 : 1; LF.audio.play('charge'); }
            else if (e.state === 'litany') { e.count = 4 + ph; e.t = 0.45; e.sub = Math.random() * TAU; LF.audio.play('telegraph'); }
            else if (e.state === 'raise') { e.t = 1.0; LF.audio.play('whisper'); }
          }
          break;
        }
        case 'veil':
          e.red = 1;
          if (e.t <= 0) {
            e.veil = e.veilMax = 4 + ph; e.veilT = e.veil + 9 - ph;
            // the darkest part of the hall: farthest from any lit brazier
            let best = null, bs = -1;
            for (let i = 0; i < 8; i++) {
              const pt = B.arenaPoint(g, 4);
              let m = 1e9; for (const b of g.litBraziers) m = Math.min(m, LF.dist(pt.x, pt.y, b.x, b.y));
              if (m > bs) { bs = m; best = pt; }
            }
            e.hx = best.x; e.hy = best.y;
            fx.ring(e.x, e.y, e.r, VEIL_R, 0.6, '#1a2418', 6); LF.audio.play('steal');
            e.state = 'idle'; e.t = 0.6;
          }
          break;
        case 'snuff':
          if (e.t <= 0) {
            // a ring of smoke settles where you stand; stay in it, and your light is crushed
            const lead = e.count === 1 && ph >= 2 ? 0.45 : 0;
            const o = g.map.nearestOpen(p.x + (p.vx || 0) * lead, p.y + (p.vy || 0) * lead);
            B.telegraph(e, o.x, o.y, 92, ph === 3 ? 1.0 : 1.2, t => {
              fx.ring(t.x, t.y, t.r, 10, 0.5, '#1a2418', 6);
              fx.burst(t.x, t.y, 18, { color: ['#1d2a1c', '#0d140c'], glow: false, speed1: 140, life: 0.8, size: 5 });
              LF.audio.play('steal');
              if (!p.dead && p.dashing <= 0 && LF.dist(t.x, t.y, p.x, p.y) < t.r + p.r - 4) {
                if (p.invuln <= 0) g.hurtPlayer(e.dmg * 0.7, { x: t.x, y: t.y, name: 'the censer', steal: true });
                if (!e.dead) { e.crush = 5; p.dim = 1; fx.text(p.x, p.y - 30, 'SNUFFED', ASH, 12, 1.0); }
              }
              if (!e.dead) g.addZone({ kind: 'gloom', x: t.x, y: t.y, r: 70, life: 4 });
            }, '170,240,150');
            if (--e.count > 0) e.t = 0.45; else { e.state = 'idle'; e.t = 1.4; }
          }
          break;
        case 'litany':
          e.red = 1;
          if (e.t <= 0) {
            // a slow cross of shadow that quickens as it goes, turned a little with each verse
            const arms = ph >= 3 ? 6 : 4;
            for (let k = 0; k < arms; k++) g.fireEnemyBullet({ x: e.x, y: e.y, angle: e.sub + k * TAU / arms, speed: 60, accel: 140, dmg: e.dmg * 0.65, color: ASH, size: 5, life: 4 });
            e.sub += 0.28 * (ph === 2 ? -1 : 1);
            LF.audio.play('spit');
            if (--e.count > 0) e.t = 0.36; else { e.state = 'idle'; e.t = 1.3; }
          }
          break;
        case 'raise':
          e.red = 1;
          if (e.t <= 0) {
            const n = ph >= 2 ? 2 : 1;
            for (let i = 0; i < n; i++) {
              const a = e.face + Math.PI + (i - (n - 1) / 2) * 1.2, o = g.map.nearestOpen(e.x + Math.cos(a) * 60, e.y + Math.sin(a) * 60);
              g.spawnEnemy('acolyte', o.x, o.y, { awake: true, spawnT: 0.8, room: 0, noDrops: i > 0 });
              fx.ring(o.x, o.y, 4, 36, 0.4, ASH, 2);
            }
            LF.audio.play('spawn'); e.state = 'idle'; e.t = 1.2;
          }
          break;
        case 'kneel':
          e.red = 1;
          if (Math.random() < dt * 20) for (const b of g.litBraziers) if (b.room === 0 && Math.random() < 0.3) fx.spawn({ x: b.x + LF.rand(-6, 6), y: b.y - 8, vx: (e.x - b.x) * 0.8, vy: (e.y - b.y) * 0.8, life: 0.5, size: 2.2, color: '#ffb347' });
          if (e.t <= 0) {
            for (const b of g.props) if (b.kind === 'brazier' && b.room === 0 && b.lit) {
              b.lit = false; b.snuffed = true;
              fx.burst(b.x, b.y - 8, 16, { color: ['#1d2a1c', '#0d140c'], glow: false, speed1: 110, life: 0.8, size: 5 });
              fx.arc(b.x, b.y - 8, e.x, e.y, '#3a4a36', 0.5, 4, 'tendril');
            }
            g.litBraziers = g.props.filter(q => q.kind === 'brazier' && q.lit);
            g.shake(9); LF.audio.play('roar');
            e.kneelT = 22; e.veil = e.veilMax = 5; e.veilT = e.veil + 6; e.hx = e.x; e.hy = e.y;
            e.state = 'idle'; e.t = 1.4;
          }
          break;
      }
    },
    draw(e, ctx, g) {
      if (e.tel) B.drawTel(e, ctx, g);
      const time = (g && g.time) || 0, ph = phaseNow(e), r = e.r || 32, hit = e.flash > 0.6, lit = e.lit;
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + r * 0.55, r * 1.3, r * 0.5, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.face || 0); ctx.scale(r / 32, r / 32);
      // a long robe trailing behind
      ctx.fillStyle = hit ? '#fff' : (lit ? '#1c231b' : '#060805'); unlitRobe(ctx); ctx.fill();
      ctx.strokeStyle = hit ? '#fff' : (lit ? '#34422f' : '#121810'); ctx.lineWidth = 2; ctx.stroke();
      // a pale stole of offered wicks, hanging in two strips
      ctx.strokeStyle = hit ? '#fff' : (lit ? '#7f8c74' : '#262c22'); ctx.lineWidth = 3.5;
      for (const sy of [-1, 1]) { ctx.beginPath(); ctx.moveTo(6, sy * 15); ctx.quadraticCurveTo(-10, sy * 13, -26 + Math.sin(time * 1.3 + sy) * 2, sy * (ph >= 3 && sy > 0 ? 4 : 9)); ctx.stroke(); }
      ctx.strokeStyle = hit ? '#fff' : (lit ? '#3c4636' : '#11150f'); ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) { const x = -20 + i * 4.5; for (const sy of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x, sy * 11); ctx.lineTo(x - 1, sy * 15); ctx.stroke(); } }
      // shoulders and the deep hood, a hole where a face would be
      ctx.fillStyle = hit ? '#fff' : (lit ? '#141a13' : '#040503');
      ctx.beginPath(); ctx.ellipse(2, 0, 10, 20, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = hit ? '#fff' : (lit ? '#232c21' : '#090b08'); ctx.beginPath(); ctx.ellipse(10, 0, 12, 11, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(14, 0, 6.5, 6, 0, 0, TAU); ctx.fill();
      if (ph >= 2) { ctx.strokeStyle = '#000'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(4, -9); ctx.lineTo(8, -4); ctx.lineTo(5, 1); ctx.stroke(); }
      // the arm, the chain and the censer
      const c = censerAt(e, time);
      ctx.strokeStyle = hit ? '#fff' : (lit ? '#2e382b' : '#0e120c'); ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(4, 14); ctx.lineTo(18, 20); ctx.stroke();
      ctx.strokeStyle = hit ? '#fff' : (lit ? '#58614f' : '#1d2119'); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(18, 20); ctx.lineTo(c.x, c.y); ctx.stroke();
      ctx.fillStyle = hit ? '#fff' : (lit ? '#3d4637' : '#121510');
      ctx.beginPath(); ctx.moveTo(c.x - 6, c.y - 3); ctx.lineTo(c.x, c.y - 8); ctx.lineTo(c.x + 6, c.y - 3); ctx.lineTo(c.x + 5, c.y + 5); ctx.lineTo(c.x - 5, c.y + 5); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1; for (const ox of [-2.5, 0, 2.5]) { ctx.beginPath(); ctx.moveTo(c.x + ox, c.y - 4); ctx.lineTo(c.x + ox, c.y + 4); ctx.stroke(); }
      ctx.restore();
    },
    drawGlow(e, ctx, g) {
      const time = (g && g.time) || 0, r = e.r || 32, veiled = e.veil > 0, k = veiled ? Math.min(1, e.veil / 0.6, ((e.veilMax || 1) - e.veil) / 0.4 + 0.2) : 0;
      // its own darkness: a pool of black laid over the light, with a pale edge so it can be read
      if (veiled) {
        ctx.globalCompositeOperation = 'source-over';
        const gr = ctx.createRadialGradient(e.x, e.y, r * 0.5, e.x, e.y, VEIL_R);
        gr.addColorStop(0, `rgba(0,0,0,${0.55 * k})`); gr.addColorStop(0.75, `rgba(0,0,0,${0.4 * k})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(e.x, e.y, VEIL_R, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(${ASH_RGB},${(e.exposed ? 0.15 : 0.32) * k})`; ctx.lineWidth = 1.5; ctx.setLineDash([3, 9]);
        ctx.beginPath(); ctx.arc(e.x, e.y, VEIL_R * 0.92, -time * 0.6, -time * 0.6 + TAU); ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.face || 0); ctx.scale(r / 32, r / 32);
      // a faint rim on the robe and the hood: it shows in the dark only as an outline
      ctx.strokeStyle = `rgba(${ASH_RGB},${veiled && !e.exposed ? 0.08 : 0.18})`; ctx.lineWidth = 1.2; unlitRobe(ctx); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(10, 0, 12, 11, 0, 0, TAU); ctx.stroke();
      // the censer gives off smoke, not light: a pale curl over a dark pot
      const c = censerAt(e, time);
      ctx.strokeStyle = `rgba(${ASH_RGB},0.3)`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(c.x - 6, c.y - 3); ctx.lineTo(c.x, c.y - 8); ctx.lineTo(c.x + 6, c.y - 3); ctx.lineTo(c.x + 5, c.y + 5); ctx.lineTo(c.x - 5, c.y + 5); ctx.closePath(); ctx.stroke();
      for (let i = 0; i < 3; i++) {
        const s = (time * 0.6 + i / 3) % 1;
        ctx.strokeStyle = `rgba(190,210,180,${0.22 * (1 - s)})`;
        ctx.beginPath(); ctx.moveTo(c.x, c.y - 6); ctx.quadraticCurveTo(c.x - 8 + Math.sin(time * 2 + i) * 4, c.y - 10 - s * 16, c.x + Math.sin(time * 1.4 + i * 2) * 8 - s * 12, c.y - 12 - s * 30); ctx.stroke();
      }
      ctx.restore();
      if (e.state === 'kneel' || e.state === 'raise' || e.state === 'veil') LF.drawGlow(ctx, ASH, e.x, e.y, r * 2, 0.08 + 0.06 * Math.sin(time * 8));
    },
  };
})();
