'use strict';
// Particles, floating text and expanding rings.
(function () {
  const MAX = 1400;
  const fx = LF.fx = {
    parts: [], texts: [], rings: [], arcs: [],
    clear() { fx.parts.length = 0; fx.texts.length = 0; fx.rings.length = 0; fx.arcs.length = 0; },

    // glow:true particles are drawn additively on top of the darkness (sparks, embers);
    // glow:false particles are drawn in the world and get swallowed by the dark (smoke, shadow bits).
    spawn(o) {
      if (fx.parts.length >= MAX) fx.parts.shift();
      fx.parts.push({
        x: o.x, y: o.y, vx: o.vx || 0, vy: o.vy || 0, life: o.life || 0.5, max: o.life || 0.5,
        size: o.size || 2, color: o.color || '#ffd9a0', drag: o.drag === undefined ? 2 : o.drag,
        grav: o.grav || 0, glow: o.glow !== false, shrink: o.shrink !== false, alpha: o.alpha === undefined ? 1 : o.alpha,
      });
    },
    burst(x, y, n, o = {}) {
      const sp0 = o.speed0 === undefined ? 30 : o.speed0, sp1 = o.speed1 === undefined ? 160 : o.speed1;
      for (let i = 0; i < n; i++) {
        const a = o.angle === undefined ? Math.random() * LF.TAU : o.angle + (Math.random() - 0.5) * (o.spread || 1);
        const s = sp0 + Math.random() * (sp1 - sp0);
        fx.spawn({
          x: x + (Math.random() - 0.5) * (o.jitter || 0), y: y + (Math.random() - 0.5) * (o.jitter || 0),
          vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          life: (o.life || 0.5) * (0.6 + Math.random() * 0.8), size: (o.size || 2) * (0.6 + Math.random() * 0.8),
          color: Array.isArray(o.color) ? LF.pick(o.color) : o.color, drag: o.drag, grav: o.grav, glow: o.glow, alpha: o.alpha,
        });
      }
    },
    text(x, y, str, color = '#fff', size = 12, life = 0.8) {
      fx.texts.push({ x, y, str, color, size, life, max: life, vy: -34, vx: (Math.random() - 0.5) * 20 });
      if (fx.texts.length > 80) fx.texts.shift();
    },
    ring(x, y, r0, r1, life, color = '#ffd9a0', width = 3, glow = true) {
      fx.rings.push({ x, y, r0, r1, life, max: life, color, width, glow });
    },
    // jagged lightning arc between two points (drawn in the glow pass)
    // A brief line between two points. style: 'chain' draws links of a chain, 'beam' a straight ray,
    // 'tendril' a smooth dark curve; anything else is the old jagged crackle (no longer used by any power).
    arc(x0, y0, x1, y1, color = '#ffb070', life = 0.2, width = 3, style) {
      if (style === 'chain' || style === 'beam') { fx.arcs.push({ pts: [x0, y0, x1, y1], color, life, max: life, width, style }); return; }
      if (style === 'tendril') {
        const mx = (x0 + x1) / 2 - (y1 - y0) * 0.22, my = (y0 + y1) / 2 + (x1 - x0) * 0.22;
        fx.arcs.push({ pts: [x0, y0, mx, my, x1, y1], color, life, max: life, width, style }); return;
      }
      const pts = [x0, y0], n = Math.max(3, Math.floor(LF.dist(x0, y0, x1, y1) / 18));
      const nx = -(y1 - y0), ny = x1 - x0, l = Math.hypot(nx, ny) || 1;
      for (let i = 1; i < n; i++) {
        const t = i / n, j = (Math.random() - 0.5) * 22;
        pts.push(x0 + (x1 - x0) * t + nx / l * j, y0 + (y1 - y0) * t + ny / l * j);
      }
      pts.push(x1, y1);
      fx.arcs.push({ pts, color, life, max: life, width });
    },
    drawArcs(ctx) {
      for (const a of fx.arcs) {
        const k = a.life / a.max;
        if (a.style === 'chain') {
          // links of flame: alternating face-on and edge-on links, strung taut between the two creatures
          const x0 = a.pts[0], y0 = a.pts[1], x1 = a.pts[2], y1 = a.pts[3], d = Math.hypot(x1 - x0, y1 - y0) || 1, ang = Math.atan2(y1 - y0, x1 - x0);
          const n = Math.max(2, Math.round(d / 9)), reach = Math.min(1, (1 - k) * 3.5); // the chain is thrown, then fades
          ctx.globalAlpha = Math.min(1, k * 1.6); ctx.strokeStyle = a.color; ctx.lineWidth = 2; ctx.lineCap = 'round';
          for (let i = 0; i <= n * reach; i++) {
            const cx = x0 + (x1 - x0) * i / n, cy = y0 + (y1 - y0) * i / n;
            ctx.beginPath();
            if (i % 2) { ctx.moveTo(cx - Math.cos(ang) * 4, cy - Math.sin(ang) * 4); ctx.lineTo(cx + Math.cos(ang) * 4, cy + Math.sin(ang) * 4); }
            else ctx.ellipse(cx, cy, 5, 3, ang, 0, LF.TAU);
            ctx.stroke();
          }
          continue;
        }
        if (a.style === 'tendril') {
          ctx.globalAlpha = k; ctx.strokeStyle = a.color; ctx.lineWidth = a.width * (0.4 + 0.6 * k); ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(a.pts[0], a.pts[1]); ctx.quadraticCurveTo(a.pts[2], a.pts[3], a.pts[4], a.pts[5]); ctx.stroke();
          continue;
        }
        ctx.globalAlpha = k; ctx.strokeStyle = a.color; ctx.lineWidth = a.width * k + 0.5; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(a.pts[0], a.pts[1]);
        for (let i = 2; i < a.pts.length; i += 2) ctx.lineTo(a.pts[i], a.pts[i + 1]);
        ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(0.5, a.width * k * 0.35); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },
    update(dt) {
      { let w2 = 0; for (let i = 0; i < fx.arcs.length; i++) { const a = fx.arcs[i]; a.life -= dt; if (a.life > 0) fx.arcs[w2++] = a; } fx.arcs.length = w2; }
      const P = fx.parts;
      let w = 0;
      for (let i = 0; i < P.length; i++) {
        const p = P[i];
        p.life -= dt;
        if (p.life <= 0) continue;
        const k = Math.max(0, 1 - p.drag * dt);
        p.vx *= k; p.vy = p.vy * k + p.grav * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        P[w++] = p;
      }
      P.length = w;
      w = 0;
      for (let i = 0; i < fx.texts.length; i++) {
        const t = fx.texts[i];
        t.life -= dt; if (t.life <= 0) continue;
        t.y += t.vy * dt; t.x += t.vx * dt; t.vy *= (1 - 2.5 * dt); t.vx *= (1 - 3 * dt);
        fx.texts[w++] = t;
      }
      fx.texts.length = w;
      w = 0;
      for (let i = 0; i < fx.rings.length; i++) { const r = fx.rings[i]; r.life -= dt; if (r.life > 0) fx.rings[w++] = r; }
      fx.rings.length = w;
    },
    draw(ctx, glow) {
      for (const p of fx.parts) {
        if (p.glow !== glow) continue;
        const t = p.life / p.max;
        ctx.globalAlpha = Math.min(1, t * 2) * p.alpha;
        ctx.fillStyle = p.color;
        const s = p.shrink ? p.size * (0.3 + 0.7 * t) : p.size * (1.6 - 0.6 * t);
        ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, LF.TAU); ctx.fill();
      }
      for (const r of fx.rings) {
        if (r.glow !== glow) continue;
        const t = 1 - r.life / r.max, e = LF.ease.outCubic(t);
        ctx.globalAlpha = (1 - t) * 0.9;
        ctx.strokeStyle = r.color; ctx.lineWidth = r.width * (1 - t * 0.6);
        ctx.beginPath(); ctx.arc(r.x, r.y, LF.lerp(r.r0, r.r1, e), 0, LF.TAU); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },
    drawTexts(ctx) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const t of fx.texts) {
        const k = t.life / t.max;
        const pop = 1 + Math.max(0, (k - 0.8) * 3);
        ctx.globalAlpha = Math.min(1, k * 2.5);
        ctx.font = `bold ${Math.round(t.size * pop)}px ${LF.FONT_UI}`;
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.75)';
        ctx.strokeText(t.str, t.x, t.y);
        ctx.fillStyle = t.color; ctx.fillText(t.str, t.x, t.y);
      }
      ctx.globalAlpha = 1;
    },
  };
  LF.FONT_UI = '"Trebuchet MS", "Segoe UI", sans-serif';
  LF.FONT_TITLE = '"Cinzel", "Palatino Linotype", Georgia, serif';
})();
