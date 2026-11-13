'use strict';
// Creatures that attack the light economy itself: the ember thief and the lamp-breaker.
(function () {
  const fx = LF.fx, TAU = LF.TAU, DEFS = LF.ENEMY_DEFS, H = LF.EH;
  const tmp = { x: 0, y: 0 };

  // Ember Thief: eats embers off the floor and runs. Kill it to get them back.
  DEFS.thief = {
    name: 'Ember Thief', hp: 24, speed: 148, r: 9, dmg: 5, embers: 1, glass: 1.2,
    eyes: [[4, -2.5, 1.3], [4, 2.5, 1.3]], eyeColor: '255,110,170',
    init(e) { e.loot = 0; e.dartT = LF.rand(1.5, 3); e.fleeT = -99; },
    update(e, g, dt) {
      const p = g.player;
      // nearest ember within reach
      let best = null, bd = 420 * 420;
      if (e.loot < 8) for (const pk of g.pickups) {
        if (pk.dead || pk.kind !== 'ember') continue;
        const d = LF.dist2(e.x, e.y, pk.x, pk.y);
        if (d < bd) { bd = d; best = pk; }
      }
      const toP = Math.atan2(p.y - e.y, p.x - e.x), dP = LF.dist(e.x, e.y, p.x, p.y);
      let dx, dy, sp = e.speed * (1 - 0.055 * e.loot); // the heavier the sack, the slower it runs
      if (best) {
        const l = Math.sqrt(bd) || 1;
        dx = (best.x - e.x) / l; dy = (best.y - e.y) / l;
        if (l < 13) {
          best.dead = true; e.loot++; e.flash = 0.5;
          fx.burst(best.x, best.y, 5, { color: '#ffb36b', speed1: 70, life: 0.3, size: 1.6 });
          LF.audio.play('steal');
        }
      } else if ((e.loot >= 3 || e.hp < e.maxHp * 0.5) && !g.rush) {
        // carrying enough: run from the light for a few seconds, then stop to catch its breath
        e.fleeT -= dt;
        if (e.fleeT <= -2.5) e.fleeT = 3.5;
        if (e.fleeT <= 0) { e.vx *= 0.8; e.vy *= 0.8; e.x += e.vx * dt; e.y += e.vy * dt; g.map.resolveCircle(e, e.r); e.face = LF.turnToward(e.face, toP, 4 * dt); return; }
        dx = -Math.cos(toP) + Math.sin(toP) * e.dir * 0.5; dy = -Math.sin(toP) - Math.cos(toP) * e.dir * 0.5;
        const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
        if (dP > 520) sp *= 0.3;
      } else {
        // nothing to steal yet: circle at a distance and dart in now and then
        e.dartT -= dt;
        const c = H.chaseDir(e, g, tmp);
        if (e.dartT < 0.5) { dx = c.x; dy = c.y; sp *= 1.2; if (e.dartT <= 0) e.dartT = LF.rand(2, 3.5); }
        else if (c.los && c.d < 150) { dx = -c.x; dy = -c.y; }
        else if (c.los && c.d < 260) { dx = -c.y * e.dir; dy = c.x * e.dir; sp *= 0.7; }
        else { dx = c.x; dy = c.y; }
      }
      if (H.move(e, g, dt, dx, dy, sp, 7) && Math.random() < dt * 5) e.dir *= -1;
      e.face = LF.turnToward(e.face, Math.atan2(e.vy, e.vx), 12 * dt);
    },
    onDeath(e, g) {
      for (let i = 0; i < e.loot; i++) g.pickups.push(new LF.Pickup('ember', e.x, e.y, LF.EMBER));
      if (e.loot) fx.text(e.x, e.y - 18, 'embers returned', '#ffb36b', 10, 0.9);
    },
    draw(e, ctx, g) {
      H.shadow(ctx, e);
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.face);
      H.bodyStyle(ctx, e); ctx.strokeStyle = 'rgba(255,190,110,0.55)';
      ctx.beginPath(); ctx.ellipse(1, 0, e.r * 1.05, e.r * 0.8, 0, 0, TAU); ctx.fill(); if (e.lit) ctx.stroke();
      // the sack on its back swells with what it has taken
      const k = Math.min(1, e.loot / 6);
      ctx.fillStyle = e.flash > 0 ? '#fff' : `rgb(${Math.round(40 + 120 * k)},${Math.round(24 + 60 * k)},${Math.round(30 + 10 * k)})`;
      ctx.beginPath(); ctx.arc(-e.r * 0.8, 0, e.r * (0.5 + 0.45 * k), 0, TAU); ctx.fill();
      ctx.restore();
    },
    drawGlow(e, ctx) {
      if (e.loot <= 0 || e.spawnT > 0) return;
      const x = e.x - Math.cos(e.face) * e.r * 0.8, y = e.y - Math.sin(e.face) * e.r * 0.8;
      LF.drawGlow(ctx, '#ff9a50', x, y, 8 + e.loot * 2.2, Math.min(0.85, 0.3 + e.loot * 0.09));
    },
    light(e, lc, white) { if (e.loot > 0) { lc.globalAlpha = Math.min(0.6, 0.2 + e.loot * 0.06); lc.drawImage(white, e.x - 30, e.y - 30, 60, 60); } },
  };

  // Lamp-breaker: goes for your lit braziers and smothers them, then comes for you.
  DEFS.breaker = {
    name: 'Lamp-breaker', hp: 62, speed: 86, r: 13, dmg: 11, embers: 2.6, glass: 2.6,
    eyes: [[6, -4, 1.6], [6, 4, 1.6]], eyeColor: '160,200,255',
    init(e) { e.state = 'seek'; e.target = null; e.cd = LF.rand(1, 2); },
    update(e, g, dt) {
      const p = g.player;
      e.t -= dt; e.cd -= dt;
      if (e.state === 'smother') {
        e.red = 1; e.vx *= 0.8; e.vy *= 0.8;
        const b = e.target;
        if (!b || !b.lit) { e.state = 'seek'; e.target = null; return; }
        if (Math.random() < dt * 20) fx.spawn({ x: b.x + LF.rand(-8, 8), y: b.y - 8, vx: (e.x - b.x) * 1.2, vy: (e.y - b.y) * 1.2, life: 0.4, size: 2.5, color: '#ffb347' });
        if (e.t <= 0) {
          b.lit = false; b.snuffed = true;
          g.litBraziers = g.props.filter(q => q.kind === 'brazier' && q.lit);
          fx.burst(b.x, b.y - 8, 16, { color: ['#2a2540', '#14101f'], glow: false, speed1: 110, life: 0.8, size: 5 });
          fx.text(b.x, b.y - 30, 'SNUFFED', '#a8c8ff', 11, 1);
          LF.audio.play('steal');
          e.state = 'seek'; e.target = null; e.cd = 1;
        }
        return;
      }
      if (e.state === 'slam') {
        e.red = 1; e.vx *= 0.8; e.vy *= 0.8;
        g.hazards.push({ x: e.x, y: e.y, r: 66 });
        if (e.t <= 0) {
          fx.ring(e.x, e.y, 10, 66, 0.3, '#a8c8ff', 4); g.shake(4); LF.audio.play('gate');
          if (!p.dead && p.dashing <= 0 && p.invuln <= 0 && LF.dist(e.x, e.y, p.x, p.y) < 66 + p.r - 4) g.hurtPlayer(e.dmg * 1.2, { x: e.x, y: e.y, enemy: e });
          e.state = 'seek'; e.cd = 2.2;
        }
        return;
      }
      // pick a lit brazier to smother (never the one in a boss arena fight, and not while one is already claimed)
      if (!e.target || !e.target.lit) {
        e.target = null;
        let bd = 760 * 760;
        for (const b of g.litBraziers) {
          const d = LF.dist2(e.x, e.y, b.x, b.y);
          if (d < bd && g.map.los(e.x, e.y, b.x, b.y)) { bd = d; e.target = b; }
        }
      }
      const dP = LF.dist(e.x, e.y, p.x, p.y);
      if (dP < 58 && e.cd <= 0 && g.map.los(e.x, e.y, p.x, p.y)) { e.state = 'slam'; e.t = 0.55; LF.audio.play('telegraph'); return; }
      if (e.target && dP > 90) {
        const b = e.target, l = LF.dist(e.x, e.y, b.x, b.y) || 1;
        if (l < 30) { e.state = 'smother'; e.t = 1.3; LF.audio.play('telegraph'); return; }
        H.move(e, g, dt, (b.x - e.x) / l, (b.y - e.y) / l, e.speed);
        e.face = LF.turnToward(e.face, Math.atan2(b.y - e.y, b.x - e.x), 6 * dt);
      } else {
        const c = H.chaseDir(e, g, tmp);
        H.move(e, g, dt, c.x, c.y, e.speed);
        H.facePlayer(e, g, dt, 6);
      }
    },
    draw(e, ctx, g) {
      H.shadow(ctx, e, 1.15);
      if (e.state === 'slam') {
        const k = 1 - Math.max(0, e.t) / 0.55;
        ctx.fillStyle = `rgba(255,90,90,${0.08 + 0.14 * k})`; ctx.beginPath(); ctx.arc(e.x, e.y, 66, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,90,90,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, 66, 0, TAU); ctx.stroke();
      }
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.face);
      H.bodyStyle(ctx, e); ctx.strokeStyle = 'rgba(160,200,255,0.55)';
      H.blob(ctx, 0, 0, e.r, g.time * 2.5, 0.05, 4, e.wob); ctx.fill(); if (e.lit) ctx.stroke();
      // a wide snuffer-cap held out in front
      ctx.fillStyle = e.flash > 0 ? '#fff' : (e.lit ? '#39415c' : '#161a28');
      ctx.beginPath(); ctx.moveTo(e.r * 0.7, -e.r * 0.9); ctx.lineTo(e.r * 1.7, -e.r * 0.5); ctx.lineTo(e.r * 1.7, e.r * 0.5); ctx.lineTo(e.r * 0.7, e.r * 0.9); ctx.closePath(); ctx.fill();
      ctx.restore();
    },
  };
})();
