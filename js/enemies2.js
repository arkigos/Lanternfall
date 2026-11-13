'use strict';
// More shadow creatures: the leech, the howler and the glass shade.
(function () {
  const fx = LF.fx, TAU = LF.TAU, DEFS = LF.ENEMY_DEFS, H = LF.EH;
  const tmp = { x: 0, y: 0 };

  // Leech: fast and frail. Latches on and drinks your light until you dash or flare it off.
  DEFS.leech = {
    name: 'Leech', hp: 11, speed: 172, r: 7, dmg: 4, embers: 0.6, glass: 0.4,
    eyes: [[3, 0, 1.6]], eyeColor: '255,90,110',
    init(e) { e.latched = false; e.la = 0; },
    update(e, g, dt) {
      const p = g.player;
      if (e.latched) {
        if (p.dead) { e.latched = false; return; }
        // ride the player
        e.la += dt * 3;
        e.x = p.x + Math.cos(e.la) * 9; e.y = p.y + Math.sin(e.la) * 9; e.vx = 0; e.vy = 0;
        e.face = Math.atan2(p.y - e.y, p.x - e.x); e.red = 1;
        const drain = e.dmg * dt;
        p.light = Math.max(1, p.light - drain); g.run.taken += drain; g.run.lastHit = e.name;
        g.leeched = (g.leeched || 0) + 1;
        if (Math.random() < dt * 14) fx.spawn({ x: p.x, y: p.y, vx: LF.rand(-40, 40), vy: LF.rand(-60, -10), life: 0.5, size: 2, color: '#ff8a70' });
        if (p.dashing > 0) {
          // shaken off
          e.latched = false; e.stun = 1.1; e.contactCd = 1.6;
          e.kx = -p.dashDx * 320 + LF.rand(-80, 80); e.ky = -p.dashDy * 320 + LF.rand(-80, 80);
          g.damageEnemy(e, 8, { type: 'dash', noShroud: true });
          fx.burst(p.x, p.y, 6, { color: '#ff8a70', speed1: 120, life: 0.3 });
        }
        return;
      }
      const c = H.chaseDir(e, g, tmp);
      const w = Math.sin(g.time * 11 + e.wob) * 0.4;
      H.move(e, g, dt, c.x - c.y * w, c.y + c.x * w, e.speed, 6);
      e.face = LF.turnToward(e.face, Math.atan2(e.vy, e.vx), 14 * dt);
    },
    onStun(e) { e.latched = false; },
    onTouch(e, g) {
      const p = g.player;
      if (e.latched || p.invuln > 0 || p.dashing > 0) return;
      let n = 0; for (const o of g.enemies) if (o.latched && !o.dead) n++;
      if (n >= 3) return;
      e.latched = true; e.la = Math.atan2(e.y - p.y, e.x - p.x);
      LF.audio.play('steal');
      if (!g.meta.seen.leechHint) { g.meta.seen.leechHint = 1; g.save(); }
      g.hint(LF.input.usingPad() ? 'Leech! Dash or flare to shake it off' : 'Leech! DASH or FLARE to shake it off');
    },
    draw(e, ctx, g) {
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.face);
      const sq = 1 + Math.sin(g.time * 16 + e.wob) * 0.18;
      ctx.fillStyle = e.flash > 0 ? '#fff' : (e.lit || e.latched ? '#2a1420' : '#12090e');
      ctx.beginPath(); ctx.ellipse(-2, 0, e.r * 1.35 * sq, e.r * 0.7 / sq, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = e.latched ? '#ff5d6e' : '#5a1c2a';
      ctx.beginPath(); ctx.arc(e.r * 0.9, 0, 2.4, 0, TAU); ctx.fill();
      ctx.restore();
    },
  };

  // Howler: keeps its distance and screams. The scream wakes the floor and whips nearby creatures into a frenzy.
  DEFS.howler = {
    name: 'Howler', hp: 46, speed: 66, r: 13, dmg: 8, embers: 2.4, glass: 2.4,
    eyes: [[4, -4.5, 1.5], [4, 4.5, 1.5]], eyeColor: '255,96,96',
    init(e) { e.cd = LF.rand(2.5, 4); e.state = 'roam'; },
    update(e, g, dt) {
      const p = g.player;
      e.cd -= dt;
      if (e.state === 'howl') {
        e.t -= dt; e.red = 1; e.vx *= 0.85; e.vy *= 0.85; H.facePlayer(e, g, dt, 6);
        if (e.t <= 0) {
          e.state = 'roam'; e.cd = LF.rand(5.5, 7.5);
          LF.audio.play('howl'); g.shake(4);
          fx.ring(e.x, e.y, e.r, 280, 0.6, '#ffaa5a', 4); fx.ring(e.x, e.y, e.r, 180, 0.45, '#ff7b3d', 3);
          for (const o of g.enemies) {
            if (o === e || o.dead || o.boss) continue;
            const d = LF.dist(e.x, e.y, o.x, o.y);
            if (d < 620 && !o.awake && o.spawnT <= 0) o.wake(g);
            if (d < 280) o.frenzy = 4.5;
          }
        }
        return;
      }
      const c = H.kite(e, g, dt, 200, 330, e.speed);
      H.facePlayer(e, g, dt);
      if (e.cd <= 0 && c.d < 520) { e.state = 'howl'; e.t = 0.75; LF.audio.play('telegraph'); }
    },
    draw(e, ctx, g) {
      H.shadow(ctx, e);
      const howl = e.state === 'howl' ? 1 - e.t / 0.75 : 0;
      if (howl > 0) { ctx.strokeStyle = `rgba(255,150,80,${0.5 * howl})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 6 + howl * 26, 0, TAU); ctx.stroke(); }
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.face);
      H.bodyStyle(ctx, e); ctx.strokeStyle = 'rgba(255,170,90,0.5)';
      // hunched body with a tall crest
      ctx.beginPath(); ctx.moveTo(e.r, 0);
      ctx.quadraticCurveTo(e.r * 0.4, -e.r * 1.2, -e.r * 0.9, -e.r * 0.8);
      ctx.lineTo(-e.r * 1.7, -e.r * 0.3 + Math.sin(g.time * 6 + e.wob) * 2); ctx.lineTo(-e.r * 1.0, 0); ctx.lineTo(-e.r * 1.7, e.r * 0.3 - Math.sin(g.time * 6 + e.wob) * 2);
      ctx.lineTo(-e.r * 0.9, e.r * 0.8); ctx.quadraticCurveTo(e.r * 0.4, e.r * 1.2, e.r, 0);
      ctx.fill(); if (e.lit) ctx.stroke();
      // maw opens wide when howling
      ctx.fillStyle = howl > 0 ? '#ff9a50' : '#2a1608';
      ctx.beginPath(); ctx.ellipse(e.r * 0.55, 0, 2.5 + howl * 3, 2.5 + howl * 5, 0, 0, TAU); ctx.fill();
      ctx.restore();
    },
  };

  // Glass shade: while shrouded it throws your bolts back at you. Only light makes it brittle.
  DEFS.glass = {
    name: 'Glass Shade', hp: 58, speed: 88, r: 12, dmg: 10, embers: 2.4, glass: 3,
    eyes: [[4, 0, 2]], eyeColor: '190,240,255',
    modDamage(e, dmg, src, g) {
      if (!e.lit && src.type === 'bolt') {
        const p = g.player;
        const a = Math.atan2(p.y - e.y, p.x - e.x) + LF.rand(-0.12, 0.12);
        g.fireEnemyBullet({ x: e.x + Math.cos(a) * e.r, y: e.y + Math.sin(a) * e.r, angle: a, speed: 270, dmg: e.dmg * 0.8, color: '#bfeaff', size: 4, life: 2.5 });
        LF.audio.play('shroud'); e.glint = 1;
        fx.burst(src.x || e.x, src.y || e.y, 4, { color: '#dff6ff', speed1: 140, life: 0.2, size: 1.4 });
        if (Math.random() < 0.35) fx.text(e.x, e.y - e.r - 8, 'REFLECTED', '#bfeaff', 9, 0.6);
        return 0;
      }
      return e.lit ? dmg * 1.25 : dmg;
    },
    update(e, g, dt) {
      const c = H.chaseDir(e, g, tmp);
      e.glint = Math.max(0, (e.glint || 0) - dt * 3);
      // prefers to hang at the edge of the light, where it is safe
      const p = g.player;
      let dx = c.x, dy = c.y;
      if (c.los && c.d < p.lightR + 30 && c.d > 70 && !e.lit) { dx = -c.y * e.dir; dy = c.x * e.dir; }
      if (H.move(e, g, dt, dx, dy, e.speed) && Math.random() < dt * 3) e.dir *= -1;
      H.facePlayer(e, g, dt, 5);
    },
    draw(e, ctx, g) {
      H.shadow(ctx, e);
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.face + Math.sin(g.time * 1.3 + e.wob) * 0.15);
      const r = e.r;
      ctx.fillStyle = e.flash > 0 ? '#fff' : (e.lit ? '#1b2a38' : '#0a1119');
      ctx.strokeStyle = e.lit ? 'rgba(190,240,255,0.75)' : `rgba(190,240,255,${0.18 + (e.glint || 0) * 0.7})`; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(r * 1.2, 0); ctx.lineTo(r * 0.3, -r); ctx.lineTo(-r * 0.9, -r * 0.7); ctx.lineTo(-r * 1.2, 0); ctx.lineTo(-r * 0.9, r * 0.7); ctx.lineTo(r * 0.3, r); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r * 1.2, 0); ctx.lineTo(-r * 0.2, 0); ctx.lineTo(r * 0.3, -r); ctx.moveTo(-r * 0.2, 0); ctx.lineTo(r * 0.3, r); ctx.moveTo(-r * 0.2, 0); ctx.lineTo(-r * 1.2, 0); ctx.stroke();
      ctx.restore();
    },
  };
})();
