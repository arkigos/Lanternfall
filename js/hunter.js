'use strict';
// The Hunter: what the dark sends after a lamplighter who lingers, or who is marked.
// It is faster than you on foot, it puts out the fires it passes, and it lunges three times
// before it has to rest. You hear your own heart before you see it.
(function () {
  const fx = LF.fx, TAU = LF.TAU, DEFS = LF.ENEMY_DEFS, H = LF.EH;
  const tmp = { x: 0, y: 0 };

  DEFS.hunter = {
    name: 'Hunter', hp: 150, speed: 168, r: 17, dmg: 16, embers: 3, glass: 2,
    eyes: [[11, -4.5, 2], [11, 4.5, 2], [6, -8.5, 1.3], [6, 8.5, 1.3], [14.5, 0, 1.2]], eyeColor: '255,70,70',
    init(e) { e.state = 'stalk'; e.t = LF.rand(0.9, 1.6); e.lunges = 0; e.snuffT = 0; e.dir = Math.random() < 0.5 ? 1 : -1; },
    update(e, g, dt) {
      const p = g.player, d = LF.dist(e.x, e.y, p.x, p.y);
      e.t -= dt;
      // dread: the nearer it is, the faster the heart goes and the closer the dark presses in
      if (!p.dead) { const k = LF.clamp(1 - d / 620, 0, 1); if (k > (g.dread || 0)) g.dread = k; }
      // it puts out fires as it passes
      e.snuffT -= dt;
      if (e.snuffT <= 0) {
        e.snuffT = 0.2;
        let any = false;
        for (const b of g.litBraziers) if (LF.dist2(e.x, e.y, b.x, b.y) < 84 * 84) {
          b.lit = false; b.snuffed = true; b.kindle = 0; b.casting = false; any = true;
          fx.burst(b.x, b.y - 8, 16, { color: ['#2a2540', '#14101f'], glow: false, speed1: 110, life: 0.8, size: 5 });
          fx.text(b.x, b.y - 30, 'SNUFFED', '#ff8a8a', 11, 1);
        }
        if (any) { g.litBraziers = g.props.filter(q => q.kind === 'brazier' && q.lit); LF.audio.play('steal'); }
        let lamps = false;
        for (const l of g.litLamps) if (LF.dist2(e.x, e.y, l.x, l.y) < 96 * 96) {
          l.lit = false; lamps = true;
          fx.burst(l.x, l.y - 8, 6, { color: ['#2a2540', '#14101f'], glow: false, speed1: 70, life: 0.6, size: 3.5 });
        }
        if (lamps) g.litLamps = g.litLamps.filter(q => q.lit);
      }
      if (Math.random() < dt * 16) fx.spawn({ x: e.x + LF.rand(-10, 10), y: e.y + LF.rand(-10, 10), vx: LF.rand(-14, 14), vy: LF.rand(-26, -6), life: 0.7, size: 6, color: '#0c0716', glow: false, drag: 1.5 });

      if (e.state === 'stalk') {
        const c = H.chaseDir(e, g, tmp);
        let dx = c.x, dy = c.y;
        if (c.los) {
          // it paces the very rim of your light, where you can only just see it
          const ring = Math.max(p.lightR + 4, 96), radial = LF.clamp((c.d - ring) / 50, -1, 1);
          dx = c.x * radial - c.y * e.dir * 0.75; dy = c.y * radial + c.x * e.dir * 0.75;
          const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
          if (e.t <= 0 && c.d < ring + 130) { e.state = 'windup'; e.t = 0.42; e.lunges = 0; LF.audio.play('telegraph'); LF.audio.play('growl'); }
        }
        if (H.move(e, g, dt, dx, dy, e.speed) && Math.random() < dt * 4) e.dir *= -1;
        H.facePlayer(e, g, dt);
      } else if (e.state === 'windup') {
        e.red = 1; H.facePlayer(e, g, dt, 16);
        e.vx *= 0.8; e.vy *= 0.8;
        if (e.t <= 0) { e.state = 'lunge'; e.t = 0.4; e.lx = Math.cos(e.face); e.ly = Math.sin(e.face); LF.audio.play('lunge'); }
      } else if (e.state === 'lunge') {
        e.red = 1;
        { const sm = e.slowMul(g); e.vx = e.lx * 520 * sm; e.vy = e.ly * 520 * sm; }
        e.x += e.vx * dt; e.y += e.vy * dt;
        const hit = g.map.resolveCircle(e, e.r);
        fx.spawn({ x: e.x - e.lx * e.r, y: e.y - e.ly * e.r, life: 0.4, size: 8, color: '#12081e', glow: false, drag: 3 });
        if (e.t <= 0 || hit) {
          e.lunges++;
          if (e.lunges < 3) { e.state = 'windup'; e.t = 0.24; }
          else { e.state = 'recover'; e.t = 1.0; }
        }
      } else {
        // spent: this is when to hurt it
        e.vx *= 0.85; e.vy *= 0.85; e.x += e.vx * dt; e.y += e.vy * dt; g.map.resolveCircle(e, e.r);
        if (e.t <= 0) { e.state = 'stalk'; e.t = LF.rand(0.8, 1.5); e.dir *= -1; }
      }
    },
    draw(e, ctx, g) {
      H.shadow(ctx, e, 1.5);
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.face);
      const sh = e.state === 'windup' ? LF.rand(-1.6, 1.6) : 0;
      ctx.translate(sh, sh);
      const r = e.r, st = e.state === 'lunge' ? 1.45 : 1, white = e.flash > 0;
      // tatters of dark streaming behind it
      ctx.fillStyle = white ? '#ffffff' : 'rgba(8,5,16,0.88)';
      for (let i = -2; i <= 2; i++) {
        const y0 = i * r * 0.3, tip = -r * (2.7 + (i % 2 ? 0.6 : 0)) * st;
        ctx.beginPath(); ctx.moveTo(-r * 0.8, y0 - r * 0.16);
        ctx.quadraticCurveTo(-r * 1.9 * st, y0 + Math.sin(g.time * 7 + e.wob + i) * 3, tip, i * r * 0.5 + Math.sin(g.time * 9 + i * 1.7 + e.wob) * 5);
        ctx.lineTo(-r * 0.8, y0 + r * 0.16); ctx.closePath(); ctx.fill();
      }
      // spines down the back, raised before it comes
      const up = e.state === 'windup' || e.state === 'lunge' ? 1.5 : 1;
      ctx.fillStyle = white ? '#ffffff' : '#0a0612';
      for (let i = 0; i < 4; i++) {
        const bx = r * (0.45 - i * 0.4);
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(bx + r * 0.18, s * r * 0.68); ctx.lineTo(bx - r * 0.5 * up, s * r * (1.2 + 0.3 * up)); ctx.lineTo(bx - r * 0.24, s * r * 0.64); ctx.closePath(); ctx.fill(); }
      }
      // long body, red at the edge
      H.bodyStyle(ctx, e);
      ctx.beginPath(); ctx.moveTo(r * 1.4 * st, 0);
      ctx.quadraticCurveTo(r * 0.5, -r * 1.05, -r * 0.9, -r * 0.78);
      ctx.quadraticCurveTo(-r * 1.6 * st, 0, -r * 0.9, r * 0.78);
      ctx.quadraticCurveTo(r * 0.5, r * 1.05, r * 1.4 * st, 0);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,60,60,0.6)'; ctx.lineWidth = 1.6; ctx.stroke();
      // horns sweeping forward round the head
      ctx.strokeStyle = white ? '#ffffff' : (e.lit ? '#4a2038' : '#1c0c1a'); ctx.lineWidth = 2.8; ctx.lineCap = 'round';
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(r * 0.45, s * r * 0.78); ctx.quadraticCurveTo(r * 1.55, s * r * 1.55, r * 2.05 * st, s * r * 0.42); ctx.stroke(); }
      ctx.restore();
    },
  };
})();
