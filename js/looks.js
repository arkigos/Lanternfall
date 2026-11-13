// Lanternfall: the Lamplighter's looks.
// One figure routine, shared by the player, the look picker and the First Bearer (which wears
// whatever you wear, in its own cold colours). Everything is drawn from above in units where
// the body is about ten across the radius, then scaled.
(function () {
  'use strict';
  const LF = window.LF, TAU = Math.PI * 2;

  LF.LOOKS = [
    { id: 'wick', name: 'The Wick', perk: 'The lamplighter. Braziers catch twice as fast, and bolts carry 15% farther. Flare: the plain blinding flash.',
      stats(s) { s.kindleMul *= 2; s.boltLife *= 1.15; } },
    { id: 'keeper', name: 'The Keeper', perk: 'Heavy. Takes 15% less harm and holds 20 more light, but walks 7% slower. Flare: smaller, and leaves a ring of light that burns and stops shots for a moment.', flare: 'ward',
      stats(s) { s.dmgTaken *= 0.85; s.maxLight += 20; s.speed *= 0.93; } },
    { id: 'candle', name: 'The Candle', perk: 'Small and hard to hit. Holds 15 less light. Flare: returns 25% sooner and hits softer, but wax slows all it touches and the light lingers.', r: 8, flare: 'wax',
      stats(s) { s.flareCd *= 0.75; s.maxLight -= 15; } },
    { id: 'moth', name: 'The Moth', perk: 'Quick. 8% faster, the dash returns 20% sooner and embers come from farther. Takes 10% more harm. Flare: does no harm, and looses a flock of moths that fight for you.', flare: 'moths',
      stats(s) { s.speed *= 1.08; s.dashCd *= 0.8; s.pickup *= 1.4; s.dmgTaken *= 1.1; } },
  ];
  LF.LOOK = {};
  for (const l of LF.LOOKS) LF.LOOK[l.id] = l;
  LF.lookOf = meta => (meta && LF.LOOK[meta.look]) ? meta.look : 'wick';
  LF.nextLook = id => LF.LOOKS[(LF.LOOKS.findIndex(l => l.id === id) + 1) % LF.LOOKS.length].id;

  const PAL = {
    wick: { coat: '#22344a', coatHi: '#34506e', deep: '#16202e', hat: '#1c2b3e', hatTop: '#48698c', rim: '#2f4763', trim: '#6e4a26', metal: '#6b5433', core: '#ffe2a6', pole: '#7a6242', boot: '#0a0f16', dark: '#0a1018' },
    keeper: { coat: '#151a1d', coatHi: '#222b2f', deep: '#0b0e10', hat: '#0f1315', hatTop: '#1b2226', rim: '#252f36', trim: '#8a7a5c', eye: '#ffb04a', metal: '#5a4c36', core: '#ffe2a6', pole: '#6b5a40', boot: '#050707', dark: '#000000' },
    candle: { coat: '#b89f68', coatHi: '#d9c48c', deep: '#7d6a44', hat: '#b89f68', hatTop: '#d9c48c', rim: '#7d6a44', trim: '#7d6a44', metal: '#3a2c1c', core: '#fff0c8', pole: '#3a2c1c', boot: '#7d6a44', dark: '#20160c' },
    moth: { coat: '#4d4234', coatHi: '#7d6c54', deep: '#2f281f', wing: '#9c8866', vein: '#5c4d38', hat: '#3a3127', hatTop: '#5c4f3d', rim: '#5c4f3d', trim: '#e6d6ae', metal: '#6b5433', core: '#ffe2a6', pole: '#6b5433', boot: '#120e0a', dark: '#120e0a' },
  };
  LF.LOOK_PAL = PAL;
  // struck: the whole figure flashes white for a moment
  function struck(p) {
    return p._w || (p._w = Object.assign({}, p, { coat: '#ffffff', coatHi: '#ffffff', deep: '#ffffff', hat: '#ffffff', hatTop: '#ffffff', rim: '#ffffff', trim: '#ffffff', boot: '#ffffff' }));
  }
  // whatever hangs (a lantern on a hook, a lantern on a chain) lags behind the aim and swings back
  function swing(st, t, target, stiff, damp) {
    if (st.la === undefined || !isFinite(st.la)) { st.la = target; st.lv = 0; st.t = t; }
    let dt = t - st.t; st.t = t;
    if (dt < 0 || dt > 0.25) { dt = 0; st.la = target; st.lv = 0; }
    dt = Math.min(dt, 0.05);
    st.lv += (LF.angDiff(st.la, target) * stiff - st.lv * damp) * dt;
    st.la += st.lv * dt;
    return st.la;
  }

  // o: { x, y, sc, aim, mv, sp, bob, t, flash, hurt, recoil, dash, frac, st, pal, noShadow }
  // Returns where the light is carried, in the caller's coordinates.
  LF.drawFigure = function (ctx, look, o) {
    const pal0 = o.pal || PAL[look] || PAL.wick, pal = o.flash ? struck(pal0) : pal0;
    const st = o.st || {}, sc = o.sc || 1, aim = o.aim || 0, t = o.t || 0;
    const sp = o.sp || 0, dash = o.dash ? 1 : 0, moving = sp > 20;
    const mv = moving ? o.mv : aim, ta = mv + Math.PI;
    const hurt = o.hurt || 0, rec = o.recoil || 0;
    const step = moving ? Math.sin(o.bob || 0) : 0;
    const C = Math.cos, S = Math.sin;
    const px = (a, d) => C(a) * d, py = (a, d) => S(a) * d;
    let lx = 0, ly = 0;

    ctx.save();
    ctx.translate(o.x, o.y); ctx.scale(sc, sc);
    if (!o.noShadow) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0, 8, 9.5, 4, 0, 0, TAU); ctx.fill(); }
    // the walk bobs twice a stride; a blow knocks the figure back from where it is aiming; a dash stretches it
    const ox = -C(aim) * 2.4 * hurt, oy = -S(aim) * 2.4 * hurt + (moving ? Math.sin((o.bob || 0) * 2) * 0.9 : Math.sin(t * 2.2) * 0.35);
    let kx = 1, ky = 1, rot = 0;
    if (dash) { kx = 1.24; ky = 0.82; rot = mv; } else if (hurt > 0) { kx = ky = 1 - 0.1 * hurt; }
    ctx.translate(ox, oy);
    if (rot) ctx.rotate(rot);
    ctx.scale(kx, ky);
    if (rot) ctx.rotate(-rot);
    ctx.lineCap = 'round';

    const feet = (w, stride) => {
      if (!moving || dash) return;
      ctx.fillStyle = pal.boot;
      for (let i = -1; i <= 1; i += 2) {
        const f = step * i * stride;
        ctx.beginPath(); ctx.ellipse(C(mv) * f - S(mv) * i * w, S(mv) * f + C(mv) * i * w + 3, 3.4, 2.3, mv, 0, TAU); ctx.fill();
      }
    };
    const lamp = (x, y, r) => {
      ctx.fillStyle = pal.metal; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.fillStyle = pal.core; ctx.beginPath(); ctx.arc(x, y, r * 0.65, 0, TAU); ctx.fill();
    };

    if (look === 'keeper') {
      // ---------------------------------------------------------------- hooded, heavy, dark: two embers for eyes, the lantern on a chain
      feet(4.2, 8);
      // a long cloak with a torn hem
      const len = 19 + S(t * 5) + Math.min(7, sp * 0.025) + dash * 4;
      ctx.fillStyle = pal.deep; ctx.beginPath();
      ctx.moveTo(px(ta + 1.55, 11), py(ta + 1.55, 11));
      for (let i = 0; i <= 6; i++) {
        const a = ta + 0.62 - i * (1.24 / 6), d = len * (i % 2 ? 0.74 : 1) + S(t * 6 + i * 1.9) * 1.2;
        ctx.lineTo(px(a, d), py(a, d));
      }
      ctx.lineTo(px(ta - 1.55, 11), py(ta - 1.55, 11));
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = pal.coat; ctx.beginPath(); ctx.ellipse(0, 0, 7.8, 12.4, aim, 0, TAU); ctx.fill();
      ctx.strokeStyle = pal.rim; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = pal.coatHi;
      ctx.beginPath(); ctx.ellipse(px(aim + 1.5, 7.8), py(aim + 1.5, 7.8), 4.4, 4, aim, 0, TAU); ctx.fill();
      // the arm, wound with chain
      const sx = px(aim + 1.35, 8.5), sy = py(aim + 1.35, 8.5), hx = px(aim + 0.32, 12.5 - rec * 2), hy = py(aim + 0.32, 12.5 - rec * 2);
      ctx.strokeStyle = pal.coatHi; ctx.lineWidth = 4.6; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx, hy); ctx.stroke();
      const ad = Math.atan2(hy - sy, hx - sx) + 1.2;
      ctx.strokeStyle = pal.trim; ctx.lineWidth = 1.3;
      for (let i = 1; i <= 3; i++) {
        const k = i / 4 + 0.08, ax = sx + (hx - sx) * k, ay = sy + (hy - sy) * k;
        ctx.beginPath(); ctx.moveTo(ax + px(ad, 2.5), ay + py(ad, 2.5)); ctx.lineTo(ax - px(ad, 2.5), ay - py(ad, 2.5)); ctx.stroke();
      }
      // the lantern hangs off the hand; it swings when you turn and drags when you dash
      const la = swing(st, t, dash ? ta : aim, 70, 6.5);
      lx = hx + px(la, 10.5); ly = hy + py(la, 10.5);
      for (let i = 1; i <= 3; i++) {
        const k = i / 4;
        ctx.fillStyle = i % 2 ? pal.trim : pal.metal;
        ctx.beginPath(); ctx.ellipse(hx + (lx - hx) * k, hy + (ly - hy) * k, 2, 1.25, la + (i % 2 ? 0 : 1.57), 0, TAU); ctx.fill();
      }
      lamp(lx, ly, 5.2);
      ctx.strokeStyle = pal.metal; ctx.lineWidth = 1.2; ctx.beginPath();
      ctx.moveTo(lx + px(la, 5.2), ly + py(la, 5.2)); ctx.lineTo(lx - px(la, 5.2), ly - py(la, 5.2));
      ctx.moveTo(lx + px(la + 1.57, 5.2), ly + py(la + 1.57, 5.2)); ctx.lineTo(lx - px(la + 1.57, 5.2), ly - py(la + 1.57, 5.2)); ctx.stroke();
      // a deep hood, hunched forward, its long peak trailing behind
      const cx = px(aim, 2.6), cy = py(aim, 2.6) - 1.5;
      ctx.fillStyle = pal.hat; ctx.beginPath();
      ctx.moveTo(cx + px(aim + 2.1, 7.8), cy + py(aim + 2.1, 7.8));
      ctx.quadraticCurveTo(cx - px(aim, 9), cy - py(aim, 9), cx - px(aim + S(t * 3) * 0.12, 15.5), cy - py(aim + S(t * 3) * 0.12, 15.5));
      ctx.quadraticCurveTo(cx - px(aim, 9), cy - py(aim, 9), cx + px(aim - 2.1, 7.8), cy + py(aim - 2.1, 7.8));
      ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy, 7.8, 0, TAU); ctx.fill();
      ctx.strokeStyle = pal.rim; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, 7.3, aim + 1.2, aim - 1.2 + TAU); ctx.stroke();
      ctx.fillStyle = pal.hatTop; ctx.beginPath(); ctx.arc(cx - 1.2 - C(aim) * 1.6, cy - 1.6 - S(aim) * 1.6, 3.6, 0, TAU); ctx.fill();
      ctx.fillStyle = pal.dark; ctx.beginPath(); ctx.ellipse(cx + px(aim, 3.6), cy + py(aim, 3.6), 4, 5.6, aim, 0, TAU); ctx.fill();
      // nothing in the hood but two embers
      ctx.fillStyle = o.flash ? '#ffffff' : (pal.eye || '#ffb04a');
      for (let i = -1; i <= 1; i += 2) { ctx.beginPath(); ctx.arc(cx + px(aim + i * 0.5, 4.6), cy + py(aim + i * 0.5, 4.6), 0.95, 0, TAU); ctx.fill(); }
    } else if (look === 'candle') {
      // ---------------------------------------------------------------- small, made of wax, the flame on the head
      const f = o.frac === undefined ? 1 : LF.clamp(o.frac, 0, 1);
      const br = 7.2 + 1.4 * f, pool = 9.2 + 2.4 * (1 - f);   // it burns down: the body shrinks and the pool spreads
      ctx.fillStyle = pal.deep;
      if (moving) for (let i = 1; i <= 2; i++) { const d = pool + i * 3.8 + S(t * 8 + i) * 0.8; ctx.beginPath(); ctx.arc(px(ta, d), py(ta, d) + 2.5, 3.5 - i * 0.9, 0, TAU); ctx.fill(); }
      ctx.beginPath(); ctx.ellipse(0, 2.5, pool, pool * 0.86, 0, 0, TAU); ctx.fill();
      for (let i = 0; i < 7; i++) { const a = i * TAU / 7 + 0.4, d = pool - 0.6 + (S(i * 2.3) + 1) * 0.9; ctx.beginPath(); ctx.arc(C(a) * d, S(a) * d * 0.86 + 2.5, 2.3, 0, TAU); ctx.fill(); }
      ctx.fillStyle = pal.coatHi;
      for (let i = -1; i <= 1; i += 2) { const d = br + 1.7 + step * i * 1.6 + rec * 1.5; ctx.beginPath(); ctx.arc(px(aim + i * 0.95, d), py(aim + i * 0.95, d), 2.4, 0, TAU); ctx.fill(); }
      ctx.fillStyle = pal.coat; ctx.beginPath(); ctx.arc(0, 0, br, 0, TAU); ctx.fill();
      ctx.fillStyle = pal.coatHi; ctx.beginPath(); ctx.arc(-0.8, -1.4, br * 0.7, 0, TAU); ctx.fill();
      ctx.fillStyle = pal.dark;
      for (let i = -1; i <= 1; i += 2) { ctx.beginPath(); ctx.ellipse(px(aim + i * 0.5, br * 0.76), py(aim + i * 0.5, br * 0.76), 1.5, 2.1, aim, 0, TAU); ctx.fill(); }
      // the flame leans away from the way you are going
      const lean = moving ? Math.min(3.4, sp * 0.013) + dash * 2 : 0, fa = moving ? ta : -Math.PI / 2;
      const wx = -0.4, wy = -2.4;
      lx = wx + C(ta) * lean; ly = wy + S(ta) * lean - 1.4;
      ctx.strokeStyle = pal.metal; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(wx, wy + 1.2); ctx.lineTo((wx + lx) / 2, (wy + ly) / 2); ctx.stroke();
      const fr = 2.9 + rec * 1.2 + S(t * 19) * 0.25, tip = fr * (2 + (moving ? 0.5 : 0));
      ctx.fillStyle = pal.core; ctx.beginPath();
      ctx.moveTo(lx + px(fa + 1.45, fr), ly + py(fa + 1.45, fr)); ctx.lineTo(lx + px(fa, tip), ly + py(fa, tip)); ctx.lineTo(lx + px(fa - 1.45, fr), ly + py(fa - 1.45, fr));
      ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(lx, ly, fr, 0, TAU); ctx.fill();
    } else if (look === 'moth') {
      // ---------------------------------------------------------------- a small body under a great pale cloak like wings
      feet(2.8, 6.5);
      const spread = dash ? 0.3 : moving ? 0.98 + S(t * 13) * 0.16 : 0.6 + S(t * 2.4) * 0.05;
      const len = 26 + Math.min(6, sp * 0.02) + dash * 6;
      const wingCol = pal.wing || pal.deep, vein = pal.vein || pal.dark;
      for (let i = -1; i <= 1; i += 2) {
        const a = ta + i * spread;
        const edge = [[a, len], [a - i * 0.2, len * 0.8], [a - i * 0.32, len * 0.92], [a - i * 0.5, len * 0.68], [a - i * 0.64, len * 0.8], [a - i * 0.82, len * 0.52]];
        ctx.fillStyle = wingCol; ctx.beginPath();
        ctx.moveTo(px(ta + i * 1.5, 6.5), py(ta + i * 1.5, 6.5));
        ctx.quadraticCurveTo(px(a + i * 0.62, len * 0.9), py(a + i * 0.62, len * 0.9), px(a, len), py(a, len));
        for (let k = 1; k < edge.length; k++) ctx.lineTo(px(edge[k][0], edge[k][1]), py(edge[k][0], edge[k][1]));
        ctx.lineTo(px(ta, 4), py(ta, 4));
        ctx.closePath(); ctx.fill();
        // veins from the shoulder out to the torn edge
        ctx.strokeStyle = vein; ctx.lineWidth = 0.9; ctx.beginPath();
        for (const k of [0, 2, 4]) { ctx.moveTo(px(ta + i * 0.9, 5), py(ta + i * 0.9, 5)); ctx.lineTo(px(edge[k][0], edge[k][1] * 0.94), py(edge[k][0], edge[k][1] * 0.94)); }
        ctx.stroke();
        // a pale band and an eyespot
        ctx.strokeStyle = pal.trim; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, len * 0.44, Math.min(a + i * 0.3, a - i * 0.5), Math.max(a + i * 0.3, a - i * 0.5)); ctx.stroke();
        const ex = px(a + i * 0.04, len * 0.66), ey = py(a + i * 0.04, len * 0.66);
        ctx.fillStyle = pal.trim; ctx.beginPath(); ctx.arc(ex, ey, 3.5, 0, TAU); ctx.fill();
        ctx.fillStyle = pal.dark; ctx.beginPath(); ctx.arc(ex, ey, 2.2, 0, TAU); ctx.fill();
        ctx.fillStyle = pal.trim; ctx.beginPath(); ctx.arc(ex - 0.5, ey - 0.6, 0.8, 0, TAU); ctx.fill();
      }
      // a ruff of fur at the shoulders
      ctx.fillStyle = pal.coat; ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.fill();
      ctx.fillStyle = pal.coatHi;
      for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + 0.2; ctx.beginPath(); ctx.arc(C(a) * 5.3, S(a) * 5.3 - 0.4, 2.1, 0, TAU); ctx.fill(); }
      ctx.fillStyle = pal.coat; ctx.beginPath(); ctx.arc(0, -0.4, 4.2, 0, TAU); ctx.fill();
      lx = px(aim, 8.6 - rec * 2); ly = py(aim, 8.6 - rec * 2);
      ctx.strokeStyle = pal.coatHi; ctx.lineWidth = 2.4;
      for (let i = -1; i <= 1; i += 2) { ctx.beginPath(); ctx.moveTo(px(aim + i * 1.15, 5.6), py(aim + i * 1.15, 5.6)); ctx.lineTo(lx + px(aim + i * 1.57, 3), ly + py(aim + i * 1.57, 3)); ctx.stroke(); }
      lamp(lx, ly, 3.6);
      const hx = px(aim, 1.8), hy = py(aim, 1.8) - 1.2;
      ctx.strokeStyle = pal.trim; ctx.lineWidth = 1.2;
      for (let i = -1; i <= 1; i += 2) {
        const w = S(t * 3 + i) * 0.08;
        ctx.beginPath(); ctx.moveTo(hx + px(aim + i * 0.7, 3.2), hy + py(aim + i * 0.7, 3.2));
        ctx.quadraticCurveTo(hx + px(aim + i * (1 + w), 8), hy + py(aim + i * (1 + w), 8), hx + px(aim + i * (1.55 + w), 10.5), hy + py(aim + i * (1.55 + w), 10.5)); ctx.stroke();
      }
      ctx.fillStyle = pal.hat; ctx.beginPath(); ctx.arc(hx, hy, 4.1, 0, TAU); ctx.fill();
      ctx.fillStyle = pal.hatTop; ctx.beginPath(); ctx.arc(hx - 0.7, hy - 1, 2.4, 0, TAU); ctx.fill();
      ctx.fillStyle = pal.trim;
      for (let i = -1; i <= 1; i += 2) { ctx.beginPath(); ctx.arc(hx + px(aim + i * 0.62, 3), hy + py(aim + i * 0.62, 3), 0.9, 0, TAU); ctx.fill(); }
    } else {
      // ---------------------------------------------------------------- the Wick: wide hat, long coat, the lantern on a lighting pole
      feet(3.4, 8);
      const len = 17.5 + S(t * 9) * 1.5 + Math.min(10, sp * 0.03) + dash * 4, fl = S(t * 7) * 0.08 * (moving ? 1.6 : 0.6);
      ctx.fillStyle = pal.deep; ctx.beginPath();
      ctx.moveTo(px(ta + 1.45, 9), py(ta + 1.45, 9));
      ctx.quadraticCurveTo(px(ta + 0.78, len * 0.8), py(ta + 0.78, len * 0.8), px(ta + 0.32 + fl, len), py(ta + 0.32 + fl, len));
      ctx.lineTo(px(ta + fl * 0.5, len * 0.5), py(ta + fl * 0.5, len * 0.5));
      ctx.lineTo(px(ta - 0.32 + fl, len), py(ta - 0.32 + fl, len));
      ctx.quadraticCurveTo(px(ta - 0.78, len * 0.8), py(ta - 0.78, len * 0.8), px(ta - 1.45, 9), py(ta - 1.45, 9));
      ctx.closePath(); ctx.fill();
      // the pole runs from behind the hip to the hook, and the lantern swings from the hook
      const L = 22 - rec * 3, tx = px(aim, L), ty = py(aim, L);
      ctx.strokeStyle = pal.pole; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(px(aim + 2.3, 8.5), py(aim + 2.3, 8.5)); ctx.lineTo(tx, ty); ctx.stroke();
      const la = swing(st, t, aim, 140, 9), d = LF.clamp(LF.angDiff(aim, la) * 3.5, -1.4, 1.4);
      lx = tx + px(aim + d, 4.6); ly = ty + py(aim + d, 4.6);
      ctx.strokeStyle = pal.metal; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(lx, ly); ctx.stroke();
      lamp(lx, ly, 4.3);
      ctx.fillStyle = pal.coat; ctx.beginPath(); ctx.ellipse(0, 0, 6, 10.8, aim, 0, TAU); ctx.fill();
      ctx.strokeStyle = pal.coatHi; ctx.lineWidth = 3.2;
      ctx.beginPath(); ctx.moveTo(px(aim + 1.5, 8), py(aim + 1.5, 8)); ctx.lineTo(px(aim + 0.36, 8.9), py(aim + 0.36, 8.9)); ctx.stroke();
      // the hat: the brim hides the face and runs long toward the aim
      const hx = px(aim, 1.6) + (moving ? C(mv) : 0), hy = py(aim, 1.6) + (moving ? S(mv) : 0) - 1.5;
      ctx.fillStyle = pal.hat; ctx.beginPath(); ctx.ellipse(hx, hy, 9.8, 8.4, aim, 0, TAU); ctx.fill();
      ctx.strokeStyle = pal.rim; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(hx, hy, 9.2, 7.8, aim, 0, TAU); ctx.stroke();
      ctx.fillStyle = pal.coatHi; ctx.beginPath(); ctx.arc(hx - 0.6, hy - 1.2, 4.9, 0, TAU); ctx.fill();
      ctx.strokeStyle = pal.trim; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(hx - 0.6, hy - 1.2, 5.1, 0, TAU); ctx.stroke();
      ctx.fillStyle = pal.hatTop; ctx.beginPath(); ctx.arc(hx - 1.3, hy - 2.1, 2.6, 0, TAU); ctx.fill();
    }
    ctx.restore();
    // where the light is, back in the caller's space
    const c = C(rot), s = S(rot), ax = (lx * c + ly * s) * kx, ay = (-lx * s + ly * c) * ky;
    return { x: o.x + (ax * c - ay * s + ox) * sc, y: o.y + (ax * s + ay * c + oy) * sc };
  };
})();
