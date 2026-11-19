'use strict';
// HUD, minimap and every menu screen. Immediate-mode: buttons are drawn and hit-tested in one call.
(function () {
  const TAU = LF.TAU, T = LF.T;
  let ctx, W, H, u, inp, G, NAR = false;
  const motes = [];
  for (let i = 0; i < 70; i++) motes.push({ x: Math.random(), y: Math.random(), s: 0.4 + Math.random() * 1.6, v: 0.01 + Math.random() * 0.04, p: Math.random() * TAU });

  const ui = LF.ui = {
    focus: 0, t: 0, count: 0, mini: null, miniT: 0, hoverRelic: null, lastLight: 100, ghost: 100,
    enter(g, screen) { ui.focus = 0; ui.t = 0; ui.screen = screen; },
    update(g, input, dt) { ui.t += dt; },

    draw(g) {
      G = g; ctx = g.ctx; W = g.canvas.width; H = g.canvas.height; inp = g.inp || {};
      // Wide windows use the desktop layout. Tall or narrow ones get a list layout scaled to their width.
      { const land = Math.min(H / 720, W / 1180), port = Math.min(W / 640, H / 900); u = W < H * 1.05 ? Math.max(land, port) : land; NAR = W / u < 980; }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ui.count = 0; ui.hoverRelic = null; LF.input.buttons = [];
      const stateAtStart = g.state;
      switch (g.state) {
        case 'title': title(g); break;
        case 'hearth': hearth(g); break;
        case 'help': help(g); break;
        case 'lantern': lanternSelect(g); break;
        case 'bearer': bearerSelect(g); break;
        case 'codex': codex(g); break;
        case 'descents': descents(g); break;
        case 'shadows': shadows(g); break;
        case 'feats': feats(g); break;
        case 'settings': settings(g); break;
        case 'intro': intro(g); break;
        case 'play': hud(g); break;
        case 'pause': hud(g); pause(g); break;
        case 'relic': hud(g); offer(g); break;
        case 'dead': dead(g); break;
        case 'win': win(g); break;
      }
      // keyboard / pad focus movement
      if (ui.count > 0 && g.state !== 'play' && g.state === stateAtStart) {
        const prev = inp.uiLeft || inp.uiUp, next = inp.uiRight || inp.uiDown;
        if (prev) { ui.focus = (ui.focus - 1 + ui.count) % ui.count; LF.audio.play('uiMove'); }
        if (next) { ui.focus = (ui.focus + 1) % ui.count; LF.audio.play('uiMove'); }
        if (ui.focus >= ui.count) ui.focus = 0;
      }
      if (g.demo) {
        const w = Math.min(430 * u, W - 24 * u);
        panel((W - w) / 2, H - 48 * u, w, 32 * u, 8, 'rgba(8,8,14,0.82)', 'rgba(157,255,207,0.4)');
        txt('Demo  ·  press any key or click to return to the title', W / 2, H - 32 * u, 12.5, '#9dffcf', 'center', LF.FONT_UI, 'bold');
      }
      if (g.fade) {
        const k = LF.clamp(g.fade.t / g.fade.dur, 0, 1);
        ctx.fillStyle = `rgba(0,0,0,${g.fade.dir > 0 ? 1 - k : k})`; ctx.fillRect(0, 0, W, H);
      }
    },
  };

  // ---------- primitives ----------
  function txt(s, x, y, size, color = '#f3e9d6', align = 'left', font = LF.FONT_UI, weight = '') {
    ctx.font = `${weight} ${Math.round(size * u)}px ${font}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.fillText(s, x, y);
  }
  function panel(x, y, w, h, r = 10, fill = 'rgba(10,10,18,0.88)', stroke = 'rgba(255,217,160,0.22)') {
    LF.roundRect(ctx, x, y, w, h, r * u); ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = Math.max(1, 1.2 * u); ctx.stroke(); }
  }
  // Wrapped, centred text. Returns the y just below the last line.
  function wtxt(s, x, y, size, color, maxW, lineH, weight = '', align = 'center') {
    ctx.font = `${weight} ${Math.round(size * u)}px ${LF.FONT_UI}`;
    const lines = LF.wrapText(ctx, s, maxW);
    lines.forEach((l, i) => txt(l, x, y + i * lineH * u, size, color, align, LF.FONT_UI, weight));
    return y + (lines.length - 1) * lineH * u + size * u * 0.7;
  }
  // The three codex tabs share one footer.
  function feats(g) {
    backdrop('#12100c');
    bigTitle('Feats', 62 * u, NAR ? 36 : 44);
    const F = LF.FEATS, done = g.meta.feats || {}, n = F.filter(f => done[f.id]).length;
    txt(n + ' of ' + F.length + ' accomplished. Each pays its cinders once.', W / 2, 100 * u, 14, '#c9bfae', 'center', LF.FONT_UI, 'italic');
    const cols = NAR ? 1 : 2, gap = 7 * u, rows = Math.ceil(F.length / cols);
    const cw = Math.min(460 * u, (W - 32 * u - (cols - 1) * gap) / cols), y0 = 124 * u;
    const ch = Math.min(56 * u, (H - y0 - 76 * u) / rows - gap);
    const x0 = (W - cols * cw - (cols - 1) * gap) / 2;
    F.forEach((f, i) => {
      const x = x0 + (i % cols) * (cw + gap), y = y0 + Math.floor(i / cols) * (ch + gap), ok = !!done[f.id];
      panel(x, y, cw, ch, 7, ok ? 'rgba(40,30,12,0.9)' : 'rgba(12,12,20,0.9)', ok ? 'rgba(255,207,92,0.55)' : 'rgba(255,217,160,0.14)');
      LF.drawIcon(ctx, ok ? 'star' : 'ring', x + 24 * u, y + ch / 2, Math.min(22 * u, ch * 0.5), ok ? '#ffcf5c' : '#55525c');
      const two = ch > 40 * u;
      txt(f.name, x + 48 * u, y + (two ? ch * 0.32 : ch / 2), 14, ok ? '#ffe9b8' : '#d8cdb8', 'left', LF.FONT_UI, 'bold');
      if (two) txt(f.desc, x + 48 * u, y + ch * 0.68, 11.5, ok ? '#c9b98a' : '#9a948a');
      else { ctx.font = `bold ${Math.round(14 * u)}px ${LF.FONT_UI}`; txt(f.desc, x + 60 * u + ctx.measureText(f.name).width, y + ch / 2, 11, '#9a948a'); }
      txt(ok ? 'done' : '+' + f.reward, x + cw - 14 * u, y + ch / 2, 12.5, ok ? '#ffcf5c' : '#ff9a50', 'right', LF.FONT_UI, 'bold');
    });
    tabs(g, 'feats');
  }
  function tabs(g, cur) {
    const all = [['codex', 'Relics'], ['shadows', 'Shadows'], ['feats', 'Feats'], ['descents', 'Descents']].filter(t => t[0] !== cur);
    const gap = 8 * u, bw = Math.min(170 * u, (W - 28 * u - gap * 3) / 4), by = H - 62 * u, x0 = (W - bw * 4 - gap * 3) / 2;
    let moved = false;
    all.forEach((t, i) => { if (!moved && button(t[1], x0 + i * (bw + gap), by, bw, 44 * u, { size: NAR ? 13 : 15 })) { g.state = t[0]; ui.enter(g, t[0]); moved = true; } });
    if (moved) return;
    if (button('Back', x0 + 3 * (bw + gap), by, bw, 44 * u, { back: true, size: NAR ? 13 : 15 }) || inp.back) { g.state = 'title'; ui.enter(g, 'title'); }
  }
  function hit(x, y, w, h) { return inp.aimX >= x && inp.aimX <= x + w && inp.aimY >= y && inp.aimY <= y + h; }
  // Returns true when activated. Registers itself for keyboard focus.
  function button(label, x, y, w, h, o = {}) {
    const i = ui.count++;
    const over = hit(x, y, w, h);
    if (over && inp.mouseMoved && ui.focus !== i) { ui.focus = i; LF.audio.play('uiMove'); }
    const foc = ui.focus === i;
    const dis = !!o.disabled;
    const k = foc ? 1 : 0;
    LF.roundRect(ctx, x, y, w, h, 8 * u);
    ctx.fillStyle = dis ? 'rgba(20,20,28,0.8)' : foc ? 'rgba(70,46,22,0.95)' : 'rgba(18,18,28,0.9)'; ctx.fill();
    ctx.strokeStyle = dis ? 'rgba(120,120,130,0.3)' : foc ? '#ffd28a' : 'rgba(255,217,160,0.3)'; ctx.lineWidth = (foc ? 2 : 1.2) * u; ctx.stroke();
    if (foc && !dis) { ctx.fillStyle = 'rgba(255,190,96,0.08)'; ctx.fill(); }
    txt(label, x + w / 2, y + h / 2 + 1 * u, o.size || 17, dis ? '#6f6c78' : foc ? '#fff2d6' : '#d8cdb8', 'center', o.font || LF.FONT_UI, o.weight || 'bold');
    if (o.sub) txt(o.sub, x + w - 12 * u, y + h / 2, 12, dis ? '#6f6c78' : '#b9ad96', 'right');
    const act = !G.fade && ((over && inp.click) || (foc && inp.confirm));
    if (act) {
      if (dis) { LF.audio.play('deny'); return false; }
      LF.audio.play(o.back ? 'uiBack' : 'uiSelect');
      return true;
    }
    return false + k * 0;
  }
  // The menus look down the fall: Vael's roofs on either side of the hole the Sun tore through the city,
  // its glow far below, and (where `chain` is given) the broken chain it hung from.
  function backdrop(tint, chain) {
    const t = G.realTime, sx = W / 2, pulse = 0.5 + 0.5 * Math.sin(t * 0.9);
    const rnd = i => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
    const gr = ctx.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#04050a'); gr.addColorStop(0.5, tint || '#0a0d18'); gr.addColorStop(1, '#020204');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    // one layer of the city: towers stand whole at the edges, and lean and snap toward the hole in the middle
    const city = (base, scale, col, seed, gap) => {
      ctx.fillStyle = col;
      const n = 14;
      for (const side of [-1, 1]) for (let i = 0; i < n; i++) {
        const o = seed + i * 3 + (side > 0 ? 500 : 0), r1 = rnd(o), r2 = rnd(o + 1), r3 = rnd(o + 2);
        const k = i / (n - 1);
        const bw = (0.03 + 0.03 * r1) * W * scale;
        const cx = sx + side * (gap + k * (0.56 - gap)) * W;
        const bh = (0.08 + 0.26 * r2) * H * scale * (0.5 + 0.65 * k);
        ctx.save(); ctx.translate(cx, base); ctx.rotate(-side * (1 - k) * (1 - k) * 0.3 * (0.4 + r3));
        ctx.fillRect(-bw / 2, -bh, bw, bh + H * 0.4);
        ctx.beginPath();
        const kind = Math.floor(r3 * 4);
        if (k < 0.2) { ctx.moveTo(-bw / 2, -bh); ctx.lineTo(-bw * 0.2, -bh - bw * 0.4); ctx.lineTo(0, -bh - bw * 0.05); ctx.lineTo(bw * 0.25, -bh - bw * 0.55); ctx.lineTo(bw / 2, -bh); }
        else if (kind === 0) { ctx.moveTo(-bw / 2, -bh); ctx.lineTo(0, -bh - bw * 1.7); ctx.lineTo(bw / 2, -bh); }
        else if (kind === 1) { ctx.arc(0, -bh, bw / 2, Math.PI, 0); }
        else if (kind === 2) { ctx.moveTo(-bw * 0.62, -bh); ctx.lineTo(0, -bh - bw * 0.6); ctx.lineTo(bw * 0.62, -bh); }
        else { ctx.rect(-bw * 0.3, -bh - bw * 0.5, bw * 0.6, bw * 0.5); ctx.rect(-bw * 0.04, -bh - bw * 1.3, bw * 0.08, bw * 0.8); }
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    };
    city(H * 0.8, 0.8, 'rgba(17,23,38,0.9)', 11, 0.1);
    // the Sun, far below, and its light climbing the shaft it fell down
    ctx.globalCompositeOperation = 'lighter';
    const sg = ctx.createRadialGradient(sx, H * 1.06, 0, sx, H * 1.06, H * 0.8);
    sg.addColorStop(0, `rgba(255,190,100,${0.5 + 0.08 * pulse})`); sg.addColorStop(0.22, 'rgba(255,140,60,0.2)'); sg.addColorStop(0.6, 'rgba(255,110,40,0.05)'); sg.addColorStop(1, 'rgba(255,110,40,0)');
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
    const sh = ctx.createLinearGradient(0, H, 0, H * 0.3);
    sh.addColorStop(0, `rgba(255,200,120,${0.17 + 0.05 * pulse})`); sh.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = sh; ctx.beginPath(); ctx.moveTo(sx - W * 0.1, H); ctx.lineTo(sx - W * 0.028, H * 0.3); ctx.lineTo(sx + W * 0.028, H * 0.3); ctx.lineTo(sx + W * 0.1, H); ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    city(H * 0.92, 1.15, 'rgba(6,8,15,0.97)', 71, 0.14);
    // the roof of the cavern
    ctx.fillStyle = '#030408';
    for (let i = 0; i < 22; i++) {
      const x = (i + rnd(i + 900) * 0.8) / 22 * W, w = (0.012 + 0.03 * rnd(i + 930)) * W, edge = Math.abs(x - sx) / (W / 2);
      const l = (0.03 + 0.13 * rnd(i + 960)) * H * (0.35 + 0.65 * edge);
      ctx.beginPath(); ctx.moveTo(x - w, 0); ctx.lineTo(x + w * 0.2, l); ctx.lineTo(x + w, 0); ctx.closePath(); ctx.fill();
    }
    // the chain the Great Lantern hung from, and the link that gave way
    if (chain > 0) {
      const lh = 26 * u, n = Math.max(2, Math.floor(chain / (lh * 0.72)));
      ctx.save(); ctx.translate(sx, -4 * u); ctx.rotate(Math.sin(t * 0.55) * 0.025);
      ctx.lineCap = 'round';
      for (let i = 0; i < n; i++) {
        const y = i * lh * 0.72 + lh * 0.5, last = i === n - 1;
        ctx.strokeStyle = '#211d18'; ctx.lineWidth = 5.5 * u;
        ctx.beginPath();
        if (last) ctx.ellipse(0, y, 8 * u, lh * 0.5, 0, Math.PI * 0.72, Math.PI * 2.2); // torn open
        else if (i % 2) { ctx.moveTo(0, y - lh * 0.42); ctx.lineTo(0, y + lh * 0.42); }
        else ctx.ellipse(0, y, 8 * u, lh * 0.5, 0, 0, TAU);
        ctx.stroke();
        // a little of the Sun's light still reaches the undersides
        ctx.strokeStyle = `rgba(255,170,90,${0.1 + 0.16 * i / n})`; ctx.lineWidth = 1.6 * u;
        ctx.beginPath();
        if (last) ctx.ellipse(0, y, 8 * u, lh * 0.5, 0, Math.PI * 0.72, Math.PI * 1.05);
        else if (i % 2) { ctx.moveTo(1.5 * u, y); ctx.lineTo(1.5 * u, y + lh * 0.42); }
        else ctx.ellipse(0, y, 8 * u, lh * 0.5, 0, 0.25, Math.PI - 0.25);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const m of motes) {
      const y = ((m.y - t * m.v) % 1 + 1) % 1, x = m.x + Math.sin(t * 0.5 + m.p) * 0.02;
      const a = 0.15 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2 + m.p));
      ctx.fillStyle = `rgba(255,${160 + m.s * 40},90,${a})`;
      ctx.beginPath(); ctx.arc(x * W, y * H, m.s * 1.6 * u, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  function bigTitle(s, y, size = 78, color = '#ffe2b0') {
    ctx.save();
    ctx.shadowColor = 'rgba(255,150,60,0.75)'; ctx.shadowBlur = 34 * u;
    txt(s, W / 2, y, size, color, 'center', LF.FONT_TITLE, '700');
    ctx.restore();
  }
  function relicBadge(id, x, y, size, n) {
    const d = LF.RELICS[id], col = LF.rar(d).color;
    ctx.fillStyle = 'rgba(10,10,18,0.85)'; ctx.beginPath(); ctx.arc(x, y, size * 0.62, 0, TAU); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 1.4 * u; ctx.stroke();
    LF.drawIcon(ctx, d.glyph, x, y, size * 0.82, d.color);
    if (n > 1) {
      ctx.fillStyle = '#0b0a12'; ctx.beginPath(); ctx.arc(x + size * 0.46, y + size * 0.44, size * 0.27, 0, TAU); ctx.fill();
      txt(String(n), x + size * 0.46, y + size * 0.46, size / u * 0.34, '#fff', 'center', LF.FONT_UI, 'bold');
    }
    if (Math.hypot(inp.aimX - x, inp.aimY - y) < size * 0.62) ui.hoverRelic = { d, x, y, n };
  }
  function tooltip() {
    const h = ui.hoverRelic; if (!h) return;
    const w = 300 * u, pad = 12 * u;
    ctx.font = `${Math.round(13 * u)}px ${LF.FONT_UI}`;
    const lines = LF.wrapText(ctx, h.d.desc, w - pad * 2);
    const hh = pad * 2 + 24 * u + lines.length * 18 * u;
    let x = h.x + 20 * u, y = h.y - hh - 10 * u;
    if (x + w > W - 8) x = W - w - 8; if (y < 8) y = h.y + 24 * u;
    panel(x, y, w, hh, 8, 'rgba(8,8,14,0.96)', LF.rar(h.d).color);
    txt(h.d.name + (h.n > 1 ? '  ×' + h.n : ''), x + pad, y + pad + 8 * u, 15, LF.rar(h.d).color, 'left', LF.FONT_UI, 'bold');
    if (h.d.school) txt(LF.SCHOOLS[h.d.school].name.toUpperCase(), x + w - pad, y + pad + 8 * u, 10, LF.SCHOOLS[h.d.school].color, 'right', LF.FONT_UI, 'bold');
    lines.forEach((l, i) => txt(l, x + pad, y + pad + 32 * u + i * 18 * u, 13, '#e6dcc8'));
  }

  // On-screen controls for touch: two floating sticks and three buttons.
  function touchHud(g) {
    const I = LF.input, t = I.touch, p = g.player, s = p.stats;
    const btns = [];
    const reach = Math.max(36, H * 0.09);
    const add = (id, x, y, r, label, color, ready) => {
      btns.push({ id, x, y, r });
      if (!label) return;
      ctx.fillStyle = t.held[id] ? 'rgba(255,217,160,0.25)' : 'rgba(8,8,14,0.45)'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = color; ctx.globalAlpha = ready ? 0.9 : 0.3; ctx.lineWidth = 2 * u; ctx.stroke();
      if (ready < 1 && ready > 0) { ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * ready); ctx.stroke(); }
      ctx.globalAlpha = ready >= 1 ? 1 : 0.5;
      txt(label, x, y + 1 * u, 11, '#f3e9d6', 'center', LF.FONT_UI, 'bold');
      ctx.globalAlpha = 1;
    };
    const bx = W - 62 * u, by = H * 0.6;
    add('dash', bx, by, 36 * u, 'DASH', '#9fe3ff', 1 - LF.clamp(p.dashT / s.dashCd, 0, 1));
    add('flare', bx, by - 88 * u, 36 * u, 'FLARE', '#ffcf5c', 1 - LF.clamp(p.flareT / s.flareCd, 0, 1));
    add('pause', W / 2, 26 * u, 18 * u, 'II', '#c9bfae', 1);
    add('map', W - 110 * u, 90 * u, 74 * u, null);
    if (g.prompt) add('interact', W / 2, H - 120 * u, 38 * u, 'USE', '#ffd9a0', 1);
    I.buttons = btns;
    for (const st of [t.left, t.right]) {
      if (!st) continue;
      const dx = st.x - st.ox, dy = st.y - st.oy, l = Math.hypot(dx, dy) || 1, k = Math.min(1, reach / l);
      ctx.strokeStyle = 'rgba(255,217,160,0.35)'; ctx.lineWidth = 2 * u; ctx.beginPath(); ctx.arc(st.ox, st.oy, reach, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(255,217,160,0.35)'; ctx.beginPath(); ctx.arc(st.ox + dx * k, st.oy + dy * k, reach * 0.42, 0, TAU); ctx.fill();
    }
    if (!t.left && !t.right && g.run.time < 12) {
      ctx.globalAlpha = 0.5;
      txt('left thumb: move', W * 0.22, H * 0.74, 13, '#f3e9d6', 'center'); txt('right thumb: aim and fire', W * 0.74, H * 0.86, 13, '#f3e9d6', 'center');
      ctx.globalAlpha = 1;
    }
  }

  // ---------- HUD ----------
  function hud(g) {
    const p = g.player, s = p.stats;
    if (!p) return;
    const x = 22 * u, y = 20 * u;
    // light gauge
    const frac = LF.clamp(p.light / s.maxLight, 0, 1);
    ui.ghost = Math.max(p.light, ui.ghost - 26 * (1 / 60)); if (ui.ghost > s.maxLight) ui.ghost = s.maxLight;
    const bw = Math.min((190 + Math.min(140, (s.maxLight - 100) * 1.2)) * u, W * 0.2), bh = 16 * u, bx = x + 50 * u, by = y + 10 * u;
    // lantern emblem
    ctx.fillStyle = 'rgba(8,8,14,0.85)'; ctx.beginPath(); ctx.arc(x + 20 * u, y + 20 * u, 22 * u, 0, TAU); ctx.fill();
    ctx.strokeStyle = frac < 0.25 ? '#ff6b5a' : '#c9a36a'; ctx.lineWidth = 2 * u; ctx.stroke();
    const fl = (0.55 + 0.6 * frac) * (1 + Math.sin(g.realTime * 14) * 0.05);
    ctx.globalCompositeOperation = 'lighter';
    LF.drawGlow(ctx, '#ffb347', x + 20 * u, y + 20 * u, 26 * u * fl, 0.7);
    ctx.globalCompositeOperation = 'source-over';
    LF.drawIcon(ctx, 'flame', x + 20 * u, y + 20 * u, 26 * u * fl, frac < 0.25 ? '#ff7b5a' : '#ffd28a');
    // bar
    panel(bx - 2 * u, by - 2 * u, bw + 4 * u, bh + 4 * u, 5, 'rgba(8,8,14,0.85)', 'rgba(201,163,106,0.6)');
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillRect(bx, by, bw * LF.clamp(ui.ghost / s.maxLight, 0, 1), bh);
    const lg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    lg.addColorStop(0, '#ff8a3d'); lg.addColorStop(1, '#ffe08a');
    ctx.fillStyle = frac < 0.25 && Math.floor(g.realTime * 6) % 2 ? '#ff5d4a' : lg; ctx.fillRect(bx, by, bw * frac, bh);
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(bx, by, bw * frac, bh * 0.35);
    // the wax coat (Wax Skin): a pale cover laid over the bar from its start, as long as the coat is thick
    if (p.coat > 0.05) { const cw = bw * Math.min(1, p.coat / s.maxLight); ctx.fillStyle = 'rgba(240,226,192,0.78)'; ctx.fillRect(bx, by, cw, bh * 0.5); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(bx, by, cw, 1.5 * u); }
    // what blows still have to take: a dark band at the end of the bar, eating back toward where it will stop
    { const pend = (p.hurts || []).reduce((a, h) => a + h.left, 0);
      if (pend > 0.05) { const f0 = LF.clamp((p.light - pend) / s.maxLight, 0, 1); ctx.fillStyle = 'rgba(120,20,24,' + (0.72 + 0.18 * Math.sin(g.realTime * 18)) + ')'; ctx.fillRect(bx + bw * f0, by, bw * (frac - f0), bh); } }
    txt(Math.ceil(p.light / LF.EMBER) + ' / ' + Math.round(s.maxLight / LF.EMBER), bx + bw / 2, by + bh / 2 + 1 * u, 11, '#1a1208', 'center', LF.FONT_UI, 'bold');
    // abilities
    const ay = by + bh + 12 * u;
    const md = LF.input.mode;
    ability(bx, ay, 'DASH', md === 'pad' ? 'A' : md === 'touch' ? '' : 'SPACE', 1 - LF.clamp(p.dashT / s.dashCd, 0, 1), p.light > s.dashCost + 1 || s.dashCost <= 0, '#9fe3ff');
    ability(bx + 96 * u, ay, 'FLARE', md === 'pad' ? 'B' : md === 'touch' ? '' : 'RMB', 1 - LF.clamp(p.flareT / s.flareCd, 0, 1), s.flareFree || p.light > s.flareCost + 1, '#ffcf5c');
    if (p.charge > 0) for (let i = 0; i < p.charge; i++) { ctx.fillStyle = '#fff0b8'; ctx.beginPath(); ctx.arc(bx + bw + 14 * u + i * 11 * u, by + bh / 2, 4 * u, 0, TAU); ctx.fill(); }
    // glass
    ctx.save(); LF.drawIcon(ctx, 'glass', bx + 206 * u, ay + 10 * u, 16 * u, '#8fe6ff'); ctx.restore();
    txt(String(Math.floor(p.glass)), bx + 218 * u, ay + 11 * u, 14, '#c9f3ff', 'left', LF.FONT_UI, 'bold');
    if (g.snuffMul < 0.99) txt(g.gloomed ? 'gloom smothers your light' : 'your light is being smothered', bx, ay + 36 * u, 11, '#7dffc0', 'left', LF.FONT_UI, 'italic');
    else if (g.nearFire) txt('resting by the fire', bx, ay + 36 * u, 11, '#ffb347', 'left', LF.FONT_UI, 'italic');
    else if (g.nearLamp) txt('held by the lamplight', bx, ay + 36 * u, 11, '#ffb347', 'left', LF.FONT_UI, 'italic');

    // relics, bottom-left
    let rx = 30 * u; const ry = H - 34 * u;
    for (const id of p.relicOrder) { relicBadge(id, rx, ry, 30 * u, p.relics[id]); rx += 38 * u; if (rx > W * 0.6) break; }

    minimap(g);
    // boss bar
    const b = g.boss;
    if (b && !b.dead && b.spawnT <= 0) {
      const w = NAR ? W - 60 * u : W * 0.44, bx2 = (W - w) / 2, by2 = (NAR ? 196 : 34) * u, k = LF.clamp(b.hp / b.maxHp, 0, 1);
      txt(b.def.name.toUpperCase(), W / 2, by2 - 14 * u, 15, '#f1d9ff', 'center', LF.FONT_TITLE, '700');
      panel(bx2 - 3 * u, by2 - 3 * u, w + 6 * u, 16 * u, 4, 'rgba(8,8,14,0.9)', 'rgba(200,150,255,0.6)');
      const bg = ctx.createLinearGradient(bx2, 0, bx2 + w, 0); bg.addColorStop(0, '#7a3cff'); bg.addColorStop(1, '#ff5d8f');
      ctx.fillStyle = bg; ctx.fillRect(bx2, by2, w * k, 10 * u);
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(bx2, by2, w * k, 3 * u);
      ctx.fillStyle = 'rgba(8,8,14,0.9)';
      for (const ph of (b.def.phases || [])) ctx.fillRect(bx2 + w * ph - 1 * u, by2, 2 * u, 10 * u);
    }
    // vigil wave counter
    if (g.mode === 'vigil' && g.vigil) {
      const v = g.vigil, wy = (NAR ? 196 : 30) * u;
      txt(v.wave ? 'WAVE ' + v.wave : 'THE LONG VIGIL', W / 2, wy, 17, '#ffe2b0', 'center', LF.FONT_TITLE, '700');
      txt(v.state === 'rest' ? (v.wave ? 'next wave in ' : 'first wave in ') + Math.max(1, Math.ceil(v.t)) : v.alive + (v.alive === 1 ? ' remains' : ' remain'), W / 2, wy + 20 * u, 12, v.state === 'rest' ? '#9dffcf' : '#c9bfae', 'center', LF.FONT_UI, 'bold');
    }
    // banner
    if (g.banner) {
      const bn = g.banner, k = bn.t / bn.dur;
      const a = Math.min(1, bn.t * 2.5) * Math.min(1, (bn.dur - bn.t) * 1.6);
      ctx.globalAlpha = Math.max(0, a);
      const yy = H * (bn.small ? 0.24 : 0.3) - (1 - LF.ease.outCubic(Math.min(1, bn.t * 2))) * 14 * u;
      ctx.save(); ctx.shadowColor = bn.boss ? 'rgba(190,110,255,0.8)' : 'rgba(255,150,60,0.6)'; ctx.shadowBlur = 24 * u;
      txt(bn.text, W / 2, yy, bn.small ? 30 : 48, bn.boss ? '#f1d9ff' : '#ffe2b0', 'center', LF.FONT_TITLE, '700');
      ctx.restore();
      if (bn.sub) txt(bn.sub, W / 2, yy + (bn.small ? 30 : 44) * u, bn.small ? 14 : 17, '#c9bfae', 'center', LF.FONT_UI, bn.sub2 ? 'bold' : 'italic');
      if (bn.sub2) { ctx.globalAlpha = Math.max(0, a) * LF.clamp((bn.t - 0.9) * 1.5, 0, 1); txt(bn.sub2, W / 2, yy + 74 * u, 15, '#a89f90', 'center', LF.FONT_UI, 'italic'); }
      ctx.globalAlpha = 1;
      void k;
    }
    // toasts
    let ty = H - 96 * u;
    for (let i = g.toasts.length - 1; i >= 0; i--) {
      const t = g.toasts[i];
      const a = Math.min(1, t.t * 4) * Math.min(1, (t.dur - t.t) * 2);
      const w = Math.min(380 * u, W - 28 * u), hh = 62 * u, tx = (W - w) / 2 + (1 - LF.ease.outCubic(Math.min(1, t.t * 3))) * 30 * u;
      ctx.globalAlpha = Math.max(0, a);
      panel(tx, ty - hh, w, hh, 8, 'rgba(8,8,14,0.92)', t.color);
      if (t.glyph) LF.drawIcon(ctx, t.glyph, tx + 32 * u, ty - hh / 2, 30 * u, t.glyphColor || t.color);
      txt(t.title, tx + 60 * u, ty - hh + 20 * u, 15, t.color, 'left', LF.FONT_UI, 'bold');
      ctx.font = `${Math.round(12 * u)}px ${LF.FONT_UI}`;
      const lines = LF.wrapText(ctx, t.text, w - 74 * u).slice(0, 2);
      lines.forEach((l, j) => txt(l, tx + 60 * u, ty - hh + 38 * u + j * 15 * u, 12, '#e6dcc8'));
      ctx.globalAlpha = 1;
      ty -= hh + 8 * u;
    }
    // first-floor control reminder
    if (g.depth === 1 && g.run.time < 26 && g.state === 'play') {
      const a = Math.min(1, (26 - g.run.time) / 2);
      ctx.globalAlpha = a * 0.92;
      const lines = LF.input.mode === 'touch' ? ['Left thumb moves  ·  Right thumb aims and fires  ·  DASH and FLARE on the right']
        : LF.input.mode === 'pad' ? ['Left stick move · Right stick aim and fire · A dash · B flare · X interact']
        : ['WASD move  ·  Mouse aim  ·  Hold LEFT CLICK to fire  ·  SPACE dash  ·  RIGHT CLICK flare  ·  E interact  ·  TAB map'];
      lines.push('Your embers are your life and your light. Creatures outside that light are shrouded and shrug off your bolts.');
      const w = Math.min(760 * u, W - 20 * u), ph = (NAR ? 96 : 56) * u, py = H - (NAR ? 250 : 150) * u;
      panel((W - w) / 2, py, w, ph, 8, 'rgba(8,8,14,0.75)', 'rgba(255,217,160,0.18)');
      const lb = wtxt(lines[0], W / 2, py + 18 * u, NAR ? 12 : 13, '#f3e9d6', w - 24 * u, 16);
      wtxt(lines[1], W / 2, lb + 12 * u, 12, '#ffcf8a', w - 24 * u, 15, 'italic');
      ctx.globalAlpha = 1;
    }
    if (LF.input.mode === 'touch' && g.state === 'play') touchHud(g);
    if (g.showMap && g.state === 'play' && !g.player.stats.noMap) bigMap(g);
    if (g.state === 'play') tooltip();
    // custom cursor
    if (LF.input.mode === 'kbm' && g.state === 'play' && !g.bot) {
      const mx = inp.aimX, my = inp.aimY;
      ctx.strokeStyle = 'rgba(255,226,166,0.9)'; ctx.lineWidth = 1.6 * u;
      ctx.beginPath(); ctx.arc(mx, my, 7 * u, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(mx, my, 1.6 * u, 0, TAU); ctx.fill();
    }
  }
  function ability(x, y, name, key, ready, usable, color) {
    const r = 11 * u, cx = x + r, cy = y + r;
    ctx.fillStyle = 'rgba(8,8,14,0.85)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.arc(cx, cy, r - 2 * u, 0, TAU); ctx.stroke();
    ctx.strokeStyle = !usable ? '#7a4a4a' : ready >= 1 ? color : 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.arc(cx, cy, r - 2 * u, -Math.PI / 2, -Math.PI / 2 + TAU * ready); ctx.stroke();
    if (ready >= 1 && usable) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(cx, cy, 3.4 * u, 0, TAU); ctx.fill(); }
    txt(name, x + r * 2 + 6 * u, cy - 5 * u, 10, usable ? '#e6dcc8' : '#8a6a6a', 'left', LF.FONT_UI, 'bold');
    txt(key, x + r * 2 + 6 * u, cy + 7 * u, 9, '#8f8a80');
  }

  // ---------- minimap ----------
  function renderMini(g) {
    const map = g.map;
    let c = ui.mini;
    if (!c) c = ui.mini = document.createElement('canvas');
    if (c.width !== map.w * 3 || c.height !== map.h * 3) { c.width = map.w * 3; c.height = map.h * 3; }
    const m = c.getContext('2d');
    m.clearRect(0, 0, c.width, c.height);
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      const i = y * map.w + x;
      if (!map.seen[i]) continue;
      const t = map.tiles[i];
      if (t === T.FLOOR) m.fillStyle = 'rgba(170,190,215,0.62)';
      else if (t === T.WATER) m.fillStyle = 'rgba(90,160,200,0.7)';
      else if (t === T.PILLAR) m.fillStyle = 'rgba(90,100,120,0.7)';
      else if (t === T.WALL) m.fillStyle = 'rgba(60,70,90,0.5)';
      else continue;
      m.fillRect(x * 3, y * 3, 3, 3);
      if (map.gate[i]) { m.fillStyle = '#a060ff'; m.fillRect(x * 3, y * 3, 3, 3); }
    }
  }
  function mapIcons(g, ox, oy, sc) {
    const map = g.map, TILE = LF.TILE, t = g.realTime;
    const seen = (px, py) => { const x = Math.floor(px / TILE), y = Math.floor(py / TILE); return map.inb(x, y) && map.seen[y * map.w + x]; };
    for (const pr of g.props) {
      if (!seen(pr.x, pr.y)) continue;
      const x = ox + pr.x / TILE * sc, y = oy + pr.y / TILE * sc;
      let col = null, r = 2.2;
      if (pr.kind === 'exit' && !pr.hidden) { col = '#5fd0ff'; r = 3.4 + Math.sin(t * 4) * 0.8; }
      else if (pr.kind === 'chest' && !pr.opened) col = '#ffd34d';
      else if (pr.kind === 'shrine' && !pr.used) col = '#c08bff';
      else if (pr.kind === 'shopkeeper') { col = '#7fffd4'; r = 3; }
      else if (pr.kind === 'brazier') { col = pr.lit ? '#ff9a3d' : '#6a5a4a'; r = 1.8; }
      else if (pr.kind === 'font' && !pr.used) col = '#ffe2a6';
      else if (pr.kind === 'statue' && !pr.used) col = '#9fc7ff';
      else if (pr.kind === 'trial' && !pr.used) { col = '#b070ff'; r = 2.8; }
      if (!col) continue;
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r * u * (sc / 3), 0, TAU); ctx.fill();
    }
    const p = g.player;
    const px = ox + p.x / TILE * sc, py = oy + p.y / TILE * sc;
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(px, py, 2.6 * u * Math.max(1, sc / 4), 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,200,120,0.8)'; ctx.lineWidth = 1 * u; ctx.beginPath(); ctx.arc(px, py, (4.5 + Math.sin(t * 5)) * u * Math.max(1, sc / 4), 0, TAU); ctx.stroke();
  }
  function minimap(g) {
    const map = g.map;
    if (g.player.stats.noMap) {
      const w0 = 150 * u, x0 = W - w0 - 20 * u, y0 = 20 * u;
      panel(x0 - 6 * u, y0 - 6 * u, w0 + 12 * u, 60 * u, 8, 'rgba(8,8,14,0.72)', 'rgba(255,217,160,0.2)');
      txt(g.mode === 'rush' ? (g.practice ? 'REHEARSAL' : 'SHADOW ' + g.depth + '/' + g.rushLen()) : LF.place(g.depth).toUpperCase(), x0, y0 + 12 * u, 11, '#ffd28a', 'left', LF.FONT_UI, 'bold');
      txt('The map is moth-eaten.', x0, y0 + 34 * u, 11, '#8f8a80', 'left', LF.FONT_UI, 'italic');
      return;
    }
    ui.miniT -= 1 / 60;
    if (ui.miniT <= 0 || ui.miniMap !== map) { ui.miniT = 0.2; ui.miniMap = map; renderMini(g); }
    const boxW = (NAR ? 128 : 178) * u, sc = Math.min(boxW / map.w, (NAR ? 96 : 130) * u / map.h);
    const w = map.w * sc, h = map.h * sc, x = W - w - 20 * u, y = 20 * u;
    panel(x - 6 * u, y - 6 * u, w + 12 * u, h + 30 * u, 8, 'rgba(8,8,14,0.72)', 'rgba(255,217,160,0.2)');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(ui.mini, x, y, w, h);
    ctx.imageSmoothingEnabled = true;
    mapIcons(g, x, y, sc);
    txt(g.mode === 'rush' ? (g.practice ? 'REHEARSAL' : 'SHADOW ' + g.depth + '/' + g.rushLen()) : g.mode === 'vigil' ? 'VIGIL' : LF.place(g.depth).toUpperCase(), x, y + h + 12 * u, 11, '#ffd28a', 'left', LF.FONT_UI, 'bold');
    if (w > 150 * u) txt(g.biome.name, x + w, y + h + 12 * u, 10, '#9a948a', 'right');
    if (g.omen) txt('Omen: ' + g.omen.name, x + w + 6 * u, y + h + 38 * u, 11, '#c9a7ff', 'right', LF.FONT_UI, 'bold');
    if (g.totalSpawns > 0) txt('Unmade ' + Math.min(g.floorKills, g.totalSpawns) + '/' + g.totalSpawns, x + w + 6 * u, y + h + (g.omen ? 54 : 38) * u, 11, g.floorKills >= g.totalSpawns * 0.85 ? '#ffd28a' : '#8f8a80', 'right');
  }
  function bigMap(g) {
    const map = g.map;
    const sc = Math.min(W * 0.8 / map.w, H * 0.76 / map.h);
    const w = map.w * sc, h = map.h * sc, x = (W - w) / 2, y = (H - h) / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
    panel(x - 14 * u, y - 14 * u, w + 28 * u, h + 28 * u, 10, 'rgba(8,8,14,0.9)');
    ctx.imageSmoothingEnabled = false; ctx.drawImage(ui.mini, x, y, w, h); ctx.imageSmoothingEnabled = true;
    mapIcons(g, x, y, sc);
    const lx = x, ly = y + h + 30 * u;
    const leg = [['#5fd0ff', 'Stair'], ['#ffd34d', 'Reliquary'], ['#7fffd4', 'Chandler'], ['#c08bff', 'Altar'], ['#9fc7ff', 'Statue'], ['#b070ff', 'Trial'], ['#ff9a3d', 'Brazier']];
    const lsp = Math.min(104 * u, (w - 90 * u) / leg.length);
    leg.forEach(([c, n], i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(lx + i * lsp + 6 * u, ly, 4 * u, 0, TAU); ctx.fill(); txt(n, lx + i * lsp + 15 * u, ly, 11, '#c9bfae'); });
    txt('TAB to close', x + w, ly, 12, '#8f8a80', 'right');
  }

  // ---------- screens ----------
  function goDescend(g) {
    if (!g.meta.seenFall) { g.state = 'intro'; ui.enter(g, 'intro'); return; }
    g.state = 'lantern'; ui.enter(g, 'lantern');
    ui.focus = Math.max(0, LF.LANTERNS.findIndex(l => l.id === g.meta.lantern && l.unlocked(g.meta)));
  }
  function title(g) {
    backdrop(undefined, H * 0.25 - (NAR ? 46 : 62) * u);
    bigTitle('LANTERNFALL', H * 0.25, NAR ? 60 : 86);
    const bw = 300 * u, bh = 50 * u, x = (W - bw) / 2; let y = H * 0.47;
    if (button('Descend', x, y, bw, bh, { size: 20 })) { ui.daily = null; ui.practice = null; ui.mode = 'descent'; goDescend(g); return; }
    y += bh + 10 * u;
    const hw = (bw - 10 * u) / 2, tw = (bw - 16 * u) / 3, sh = 40 * u;
    const rushOpen = (g.meta.bosses || 0) >= 3;
    if (button('Daily', x, y, tw, sh, { size: 13.5 })) { ui.daily = LF.todayKey(); ui.practice = null; ui.mode = 'descent'; goDescend(g); return; }
    if (button('Vigil', x + tw + 8 * u, y, tw, sh, { size: 13.5 })) { ui.daily = null; ui.practice = null; ui.mode = 'vigil'; goDescend(g); return; }
    if (button('Gauntlet', x + (tw + 8 * u) * 2, y, tw, sh, { size: 13.5, disabled: !rushOpen })) { ui.daily = null; ui.practice = null; ui.mode = 'rush'; goDescend(g); return; }
    y += sh + 10 * u;
    if (button('The Hearth', x, y, bw, bh - 4 * u, { sub: g.meta.cinders + ' cinders' })) { g.state = 'hearth'; ui.enter(g, 'hearth'); return; }
    y += bh + 6 * u;
    if (button('Codex', x, y, tw, sh, { size: 13.5 })) { g.state = 'codex'; ui.enter(g, 'codex'); return; }
    if (button('Help', x + tw + 8 * u, y, tw, sh, { size: 13.5 })) { g.state = 'help'; ui.enter(g, 'help'); return; }
    if (button('Settings', x + (tw + 8 * u) * 2, y, tw, sh, { size: 13.5 })) { ui.settingsFrom = 'title'; g.state = 'settings'; ui.enter(g, 'settings'); return; }
    const dd = g.meta.daily && g.meta.daily.date === LF.todayKey() ? g.meta.daily : null;
    const dline = (dd ? 'Today\'s descent: ' + LF.placeIn(dd.best) + (dd.won ? ', shard reached' : '') + ' in ' + dd.tries + (dd.tries === 1 ? ' try' : ' tries') : 'Daily: one seed a day') + (g.meta.vigilBest ? '   ·   Longest vigil: wave ' + g.meta.vigilBest : '   ·   Vigil: endless waves') + (rushOpen ? (g.meta.rushWins ? '   ·   Gauntlets run: ' + g.meta.rushWins : '') : '   ·   Gauntlet: fell 3 shadows to open');
    txt(dline, W / 2, y + sh + 16 * u, 12, dd ? '#9dffcf' : '#77747e', 'center', LF.FONT_UI, 'italic');
    if (LF.makeBot && button('Watch a descent', x + bw * 0.2, y + sh + 32 * u, bw * 0.6, 30 * u, { size: 12 })) { g.startDemo(); return; }
    const st = `Deepest: ${g.meta.best ? LF.placeIn(g.meta.best) : 'none'}   ·   Descents: ${g.meta.runs}   ·   Shards: ${Math.min(LF.SHARDS.length, g.meta.shards || 0)} of ${LF.SHARDS.length}`;
    txt(st, W / 2, H - 34 * u, 13, '#7d786f', 'center');
    txt('Made in one night by Claude', W / 2, H - 14 * u, 10.5, '#55524c', 'center', LF.FONT_UI, 'italic');
  }
  function intro(g) {
    backdrop('#08090f', H * 0.2);
    const lines = [
      'Vael was built where no sky reaches, under a light its people made: the Great Lantern.',
      'Between one bell and the next, its chain broke. It fell through the city, through the dead, and on into the dark.',
      'You are the last of the four born to keep the Vigil: the one flame held back to relight it. No one thought that would mean going down.',
      'It broke as it fell, and it is going out. Follow the shards down to where it lies.',
    ];
    ctx.font = `${Math.round(21 * u)}px ${LF.FONT_TITLE}`;
    let y = H * 0.26;
    lines.forEach((l, i) => {
      const a = LF.clamp((ui.t - i * 1.3) / 1.2, 0, 1);
      ctx.globalAlpha = a;
      ctx.font = `${Math.round(21 * u)}px ${LF.FONT_TITLE}`;
      for (const w of LF.wrapText(ctx, l, Math.min(W - 60 * u, 820 * u))) { txt(w, W / 2, y, 21, i === 3 ? '#ffd9a0' : '#e6dcc8', 'center', LF.FONT_TITLE, '500'); y += 32 * u; }
      y += 22 * u;
      ctx.globalAlpha = 1;
    });
    const ready = ui.t > 1.2;
    if (ready && (button(ui.t > lines.length * 1.3 ? 'Take up the lantern' : 'Skip', (W - 260 * u) / 2, H - 96 * u, 260 * u, 48 * u) || inp.back)) {
      g.meta.seenIntro = true; g.meta.seenFall = true; g.save(); goDescend(g);
    }
  }
  function settings(g) {
    backdrop('#0e1016');
    bigTitle('Settings', 78 * u, 44);
    const inRun = ui.settingsFrom === 'pause';
    const bw = Math.min(460 * u, W - 40), bh = 48 * u, x = (W - bw) / 2; let y = 140 * u;
    const row = (label, value, fn, o) => { if (button(label, x, y, bw, bh, Object.assign({ sub: value, size: 15 }, o || {}))) fn(); y += bh + 10 * u; };
    const step = v => v >= 0.99 ? 0 : Math.min(1, v + 0.25);
    row('Sound', Math.round(g.meta.vol * 100) + '%', () => { g.meta.vol = step(g.meta.vol); LF.audio.setVolume(g.meta.vol); g.save(); });
    row('Music', Math.round(g.meta.mus * 100) + '%', () => { g.meta.mus = step(g.meta.mus); LF.audio.setMusic(g.meta.mus); g.save(); });
    row('Screen shake', g.meta.shake ? 'On' : 'Off', () => { g.meta.shake = g.meta.shake ? 0 : 1; g.save(); });
    row('Flashes', g.meta.flash === 0 ? 'Reduced' : 'Full', () => { g.meta.flash = g.meta.flash === 0 ? 1 : 0; g.save(); });
    row('Auto-fire', g.meta.autofire ? 'On' : 'Off', () => { g.meta.autofire = !g.meta.autofire; g.save(); });
    txt('Auto-fire shoots for you whenever a creature is near. You still aim.', W / 2, y - 2 * u, 12, '#8f8a80', 'center', LF.FONT_UI, 'italic'); y += 22 * u;
    row('Difficulty', LF.DIFFS[g.meta.diff].name, () => { g.meta.diff = (g.meta.diff + 1) % LF.DIFFS.length; g.save(); }, { disabled: inRun });
    txt(inRun ? 'Difficulty is fixed for a descent in progress.' : LF.DIFFS[g.meta.diff].desc, W / 2, y - 2 * u, 12, '#8f8a80', 'center', LF.FONT_UI, 'italic'); y += 22 * u;
    row('Fullscreen', document.fullscreenElement ? 'On' : 'Off', () => {
      try {
        if (document.fullscreenElement) document.exitFullscreen();
        else { const r = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); if (r && r.catch) r.catch(() => {}); }
      } catch (e) { /* not available here */ }
    });
    if (button('Back', (W - 220 * u) / 2, Math.min(H - 62 * u, y + 14 * u), 220 * u, 44 * u, { back: true }) || inp.back) {
      if (inRun) { g.state = 'pause'; ui.enter(g, 'pause'); inp.pause = false; } else { g.state = 'title'; ui.enter(g, 'title'); }
    }
  }
  function hearth(g) {
    backdrop('#120d10');
    bigTitle('The Hearth', 66 * u, NAR ? 36 : 44);
    wtxt('Cinders carried back from the dark kindle lasting gifts.', W / 2, 104 * u, 14, '#c9bfae', W - 40 * u, 17, 'italic');
    LF.drawIcon(ctx, 'flame', W / 2 - 46 * u, 138 * u, 22 * u, '#ff9a50');
    txt(String(g.meta.cinders) + ' cinders', W / 2 - 30 * u, 139 * u, 18, '#ffcf8a', 'left', LF.FONT_UI, 'bold');
    const cols = NAR ? 1 : 2, gap = (NAR ? 7 : 10) * u, rows = Math.ceil(LF.UPGRADES.length / cols);
    const cw = Math.min(440 * u, W - 32 * u), y0 = 164 * u;
    const ch = Math.min(76 * u, (H - y0 - 80 * u) / rows - gap);
    const x0 = (W - cols * cw - (cols - 1) * gap) / 2;
    LF.UPGRADES.forEach((up, i) => {
      const cx = x0 + (i % cols) * (cw + gap), cy = y0 + Math.floor(i / cols) * (ch + gap);
      const lvl = g.meta.up[up.id] || 0, maxed = lvl >= up.max, cost = maxed ? 0 : up.cost[lvl];
      panel(cx, cy, cw, ch, 8, 'rgba(12,12,20,0.9)', maxed ? 'rgba(255,207,92,0.5)' : 'rgba(255,217,160,0.18)');
      LF.drawIcon(ctx, up.glyph, cx + 32 * u, cy + ch / 2, Math.min(30 * u, ch * 0.5), up.color);
      txt(up.name, cx + 62 * u, cy + ch * 0.27, 15, '#f3e9d6', 'left', LF.FONT_UI, 'bold');
      txt(up.desc, cx + 62 * u, cy + ch * 0.54, 12, '#b9ad96');
      for (let k = 0; k < up.max; k++) { ctx.fillStyle = k < lvl ? '#ffb347' : 'rgba(255,255,255,0.14)'; ctx.fillRect(cx + 62 * u + k * 16 * u, cy + ch * 0.76, 12 * u, 4 * u); }
      const lab = maxed ? 'Kindled' : '◆ ' + cost, bh = Math.min(40 * u, ch - 14 * u);
      if (button(lab, cx + cw - 112 * u, cy + (ch - bh) / 2, 100 * u, bh, { size: 14, disabled: maxed || g.meta.cinders < cost })) {
        g.meta.cinders -= cost; g.meta.up[up.id] = lvl + 1; g.save(); LF.audio.play('buy');
      }
    });
    if (button('Back', (W - 220 * u) / 2, H - 62 * u, 220 * u, 44 * u, { back: true }) || inp.back) { g.state = 'title'; ui.enter(g, 'title'); }
  }
  function help(g) {
    backdrop();
    bigTitle('How to Play', 66 * u, NAR ? 36 : 44);
    const w = Math.min(860 * u, W - 32 * u), x = (W - w) / 2, y = 104 * u;
    const touch = LF.input.mode === 'touch';
    const rows = ui.helpPage ? [
      ['Omens', 'Some floors carry an omen that bends the rules there: thicker dark, embers that burn faster, a hunter on your trail. The banner and the pause screen say which.'],
      ['Vows', 'Once you have felled a great shadow you can swear handicaps on the lantern screen. Each pays extra cinders when the descent ends.'],
      ['Ranks and kin', 'A relic you already hold can be taken again: it gains a rank, and most have three. Ranks do not stop at III: a relic can be taken or forged on to rank X, and what multiplies grows by half again with each. A form changes how your bolt or your flare works; a lantern holds one of each, and only the Chandler sells them. A relic that builds on a power you do not have is never offered: the relic that gives that power is offered in its place. Three relics in every theme multiply all that theme does, and multiply each other: a lantern that pours itself into one theme leaves a lantern of mixed themes far behind. Inside a theme there are paths, named on the card: a relic feeds its own path, and an amplifier of one does nothing for another. Every relic is of a theme (light, fire, wax, chain, moth), and every rank you hold of a theme draws more of it. Some relics name another as kin: hold both at rank II and a third power wakes that is never offered. Some grow with others, and say which: a longer flare light feeds a relic that pays you for standing in it.'],
      ['Trials, vaults, statues, altars', 'A trial is three sealed waves for a great work. A vault halves your light until its braziers burn. A statue of the Weeping Lamplighter gives one lasting blessing, freely. An altar offers a bargain: a gift, and its price.'],
      ['The Long Vigil and the Gauntlet', 'The Vigil is one hall and endless waves, with a relic every second wave. The Gauntlet is six great shadows back to back, and opens once you have felled three. Any great shadow can be rehearsed alone from the Shadows page of the Codex.'],
      ['Daily Descent', 'One seed each day: the same floors, omens and bosses on every try.'],
      ['Great works, lanterns, feats', 'Stand through a Trial of Embers and you are offered a great work, the largest power a theme has: fire that never goes out, a lantern that flares of its own accord. New lanterns unlock as you go deeper, and feats in the Codex pay cinders.'],
      ['Controls', touch ? 'Left thumb moves, right thumb aims and fires. DASH, FLARE and USE are buttons. Tap the minimap for the full map.' : 'WASD move, mouse aim, hold left click to fire, Space dash, right click or Q flare, E interact, Tab map, Esc pause. Gamepad and touch also work.'],
    ] : [
      ['Your embers are your life', 'The bar counts the embers in your lantern. They are your health, and the fewer you hold the less far you see. They burn down on their own, and every hit knocks some out. At none, you are snuffed: the dark alone can do it.'],
      ['Light burns them', 'Anything standing in the light of your lantern smoulders: faintly at the rim, fiercely close to the flame, and hotter the brighter you burn. Creatures outside the light shrug off most of a bolt.'],
      ['Fight to rekindle', 'Every kill feeds the flame, and kills made while it gutters feed it most. Slain creatures also drop embers, which wait on the ground while you are full.'],
      [touch ? 'Flare' : 'Flare (right click, or Q)', 'A burst of light that throws back everything near you and stuns the small ones, shatters enemy shots and lights braziers. It does no harm by itself, but what it touches stays kindled for a few seconds and takes far more damage. When the crowd closes in, this is the way out.'],
      [touch ? 'Dash' : 'Dash (space)', 'A short burst of speed that passes through attacks. Costs about an ember.'],
      ['Fires hold the dark off', 'Beside a lit brazier or a relit wall lamp your embers stop burning down. A brazier also refills you when lit, and, with nothing near, mends you up to half while you rest there.'],
      ['Relics', 'Your lantern carries the first relic of its theme from the first step. Every stair offers three, and you may reroll them for glass. Unmake nearly everything on a floor for one more to choose from. A reliquary holds three humbler things; a statue gives a blessing; a Trial of Embers leaves a great work; an altar offers a bargain.'],
      ['Glass and cinders', 'Glass has two uses at a stair, and each takes from the other. After the card, the Forge ranks up a relic you carry: ' + LF.TUNE.forgeII + ' glass for rank II, and dearer with every rank it already holds. A reroll shows you new cards: the first is cheap, and each after it on the same offer costs more. Offers are dealt from the whole deck, so some will hold nothing for you. Glass also buys forms from the Chandler, and a form is dear. Cinders are earned at the end and spent at the Hearth.'],
    ];
    ctx.font = `${Math.round(13 * u)}px ${LF.FONT_UI}`;
    const wrapped = rows.map(r => LF.wrapText(ctx, r[1], w - 44 * u).slice(0, 4));
    const total = wrapped.reduce((s, l) => s + 30 * u + l.length * 16 * u, 0) + 24 * u;
    const k = Math.min(1, (H - y - 84 * u) / total); // squeeze line spacing slightly if the window is short
    panel(x, y, w, total * k, 10);
    let yy = y + 26 * u * k;
    rows.forEach((r, i) => {
      txt(r[0], x + 22 * u, yy, 15, '#ffd28a', 'left', LF.FONT_UI, 'bold');
      wrapped[i].forEach((l, j) => txt(l, x + 22 * u, yy + (19 + j * 16) * u * k, 13, '#d8cdb8'));
      yy += (30 + wrapped[i].length * 16) * u * k;
    });
    const hbw = Math.min(220 * u, (W - 44 * u) / 2);
    if (button(ui.helpPage ? 'The basics' : 'Deeper rules', W / 2 - hbw - 6 * u, H - 62 * u, hbw, 44 * u)) { ui.helpPage = ui.helpPage ? 0 : 1; return; }
    if (button('Back', W / 2 + 6 * u, H - 62 * u, hbw, 44 * u, { back: true }) || inp.back) { ui.helpPage = 0; g.state = 'title'; ui.enter(g, 'title'); }
  }
  // Live portrait of a creature for the bestiary: a detached Enemy drawn with its own draw code.
  function portrait(g, type, cx, cy, size) {
    if (!ui.portraits) ui.portraits = {};
    const drawType = type === 'choir' ? 'choirhead' : type;
    let e = ui.portraits[drawType];
    if (!e) {
      try { e = ui.portraits[drawType] = new LF.Enemy(g, drawType, 0, 0, { awake: true }); } catch (err) { return; }
      e.lit = true; e.solid = 1; e.fade = 1; e.eyeOpen = 1; e.sing = 0; e.face = -0.5;
    }
    const fake = { time: g.realTime, realTime: g.realTime, player: { x: 400, y: -300, lightR: 200, dead: false }, map: null, hazards: [], meta: g.meta };
    const sc = size / (e.def.r * 3.1);
    e.x = 0; e.y = 0; e.flash = 0; e.lit = true;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, size * 0.56, 0, TAU); ctx.clip();
    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.56);
    bg.addColorStop(0, '#4a4350'); bg.addColorStop(1, '#17151d');
    ctx.fillStyle = bg; ctx.fillRect(cx - size, cy - size, size * 2, size * 2);
    ctx.translate(cx, cy); ctx.scale(sc, sc);
    try {
      e.def.draw(e, ctx, fake);
      ctx.globalCompositeOperation = 'lighter';
      e.drawEyes(ctx, fake);
      if (e.def.drawGlow) e.def.drawGlow(e, ctx, fake);
    } catch (err) { /* a portrait must never break the menu */ }
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,217,160,0.35)'; ctx.lineWidth = 1.2 * u; ctx.beginPath(); ctx.arc(cx, cy, size * 0.56, 0, TAU); ctx.stroke();
  }
  function shadows(g) {
    backdrop('#12101a');
    bigTitle('Shadows', 60 * u, 44);
    const B = LF.BESTIARY, met = g.meta.met || {}, felled = g.meta.felled || {};
    const known = t => !!(met[t] || felled[t]);
    txt('Unmade: ' + B.filter(b => known(b[0])).length + ' of ' + B.length + '   ·   pick a great shadow to rehearse it', W / 2, 98 * u, NAR ? 12 : 14, '#c9bfae', 'center', LF.FONT_UI, 'italic');
    const bossCards = [];
    const cols = NAR ? 2 : W > 900 * u ? 4 : 3, gap = (NAR ? 7 : 10) * u;
    const cw = Math.min(NAR ? 330 * u : 280 * u, (W - 28 * u - (cols - 1) * gap) / cols);
    const ch = Math.min(88 * u, (H - 122 * u - 74 * u) / Math.ceil(B.length / cols) - gap * 0.8);
    const x0 = (W - cols * cw - (cols - 1) * gap) / 2, y0 = 122 * u;
    B.forEach((b, i) => {
      const x = x0 + (i % cols) * (cw + gap), y = y0 + Math.floor(i / cols) * (ch + gap * 0.8);
      if (y + ch > H - 76 * u) return;
      const k = known(b[0]), def = LF.ENEMY_DEFS[b[0]];
      if (b[2]) bossCards.push([b[0], x, y]);
      panel(x, y, cw, ch, 8, 'rgba(12,12,20,0.9)', b[2] ? 'rgba(200,150,255,0.35)' : 'rgba(255,217,160,0.16)');
      const ps = Math.min(60 * u, ch * 0.74), pcx = x + 12 * u + ps * 0.56, tx = x + 20 * u + ps * 1.12;
      if (k) portrait(g, b[0], pcx, y + ch / 2, ps);
      else { ctx.fillStyle = 'rgba(10,10,18,0.8)'; ctx.beginPath(); ctx.arc(pcx, y + ch / 2, ps * 0.55, 0, TAU); ctx.fill(); txt('?', pcx, y + ch / 2 + 1 * u, 20, '#4a4852', 'center', LF.FONT_TITLE, '700'); }
      const fs = NAR ? 10.5 : 11.5, lh = NAR ? 13 : 15, maxL = Math.max(1, Math.floor((ch - 26 * u) / (lh * u)));
      txt(k ? def.name : (b[2] ? 'A great shadow  ·  ' + LF.bossPlace(b[0]) : 'Not yet met'), tx, y + 16 * u, NAR ? 12.5 : 14, k ? (b[2] ? '#e2c9ff' : '#f3e9d6') : '#6f6c78', 'left', LF.FONT_UI, 'bold');
      if (k) { ctx.font = `${Math.round(fs * u)}px ${LF.FONT_UI}`; LF.wrapText(ctx, b[1], cw - (tx - x) - 8 * u).slice(0, maxL).forEach((l, j) => txt(l, tx, y + (NAR ? 31 : 38) * u + j * lh * u, fs, '#b9ad96')); }
    });
    tabs(g, 'shadows');
    if (g.state !== 'shadows') return;
    // great shadows are focusable: choosing one starts a rehearsal against it
    for (const [type, x, y] of bossCards) {
      const i = ui.count++, over = hit(x, y, cw, ch);
      if (over && inp.mouseMoved && ui.focus !== i) { ui.focus = i; LF.audio.play('uiMove'); }
      if (ui.focus === i) { LF.roundRect(ctx, x, y, cw, ch, 8 * u); ctx.strokeStyle = '#ffd28a'; ctx.lineWidth = 2 * u; ctx.stroke(); ctx.fillStyle = 'rgba(255,190,96,0.06)'; ctx.fill(); }
      if (!G.fade && ui.t > 0.3 && ((over && inp.click) || (ui.focus === i && inp.confirm))) {
        LF.audio.play('uiSelect'); ui.daily = null; ui.mode = 'rush'; ui.practice = type; goDescend(g); return;
      }
    }
  }
  function descents(g) {
    backdrop('#10121c');
    bigTitle('Descents', 62 * u, NAR ? 36 : 44);
    const H0 = Array.isArray(g.meta.history) ? g.meta.history : [];
    const sb = wtxt(`Descents: ${g.meta.runs}   ·   Deepest: ${g.meta.best ? LF.placeIn(g.meta.best) : 'none'}   ·   Depths cleared: ${g.meta.wins}   ·   Creatures unmade: ${g.meta.kills || 0}   ·   Great shadows felled: ${g.meta.bosses || 0}`, W / 2, 102 * u, 13, '#c9bfae', W - 36 * u, 17);
    const w = Math.min(900 * u, W - 32 * u), x = (W - w) / 2; let y = sb + 14 * u;
    const rh = Math.min((NAR ? 48 : 34) * u, (H - y - 150 * u) / Math.max(1, H0.length));
    panel(x, y, w, 20 * u + Math.max(1, H0.length) * rh, 10);
    y += 10 * u + rh / 2;
    if (!H0.length) txt('No descents recorded yet.', W / 2, y, 13, '#8f8a80', 'center');
    H0.forEach(h => {
      const lan = LF.LANTERN[h.lantern] || LF.LANTERNS[0];
      const detail = lan.name + '  ·  ' + (LF.DIFFS[h.diff] || LF.DIFFS[1]).name + (h.vows ? '  ·  ' + h.vows + (h.vows > 1 ? ' vows' : ' vow') : '') + (h.daily ? '  ·  daily ' + h.daily : '');
      const result = h.won ? (h.lit ? 'Kept the Vigil' : 'Reached the shard') : h.cause === 'abandoned' ? 'Abandoned' : 'Snuffed by ' + h.cause;
      LF.drawIcon(ctx, lan.glyph, x + 24 * u, y, 18 * u, lan.color);
      if (NAR) {
        txt(h.mode === 'vigil' ? 'Vigil ' + h.wave : h.mode === 'rush' ? 'Gauntlet ' + h.depth : LF.place(h.depth, ', '), x + 44 * u, y - 9 * u, 14, h.won ? '#ffe08a' : '#f3e9d6', 'left', LF.FONT_UI, 'bold');
        txt(result + '  ·  ' + LF.fmtTime(h.time), x + w - 14 * u, y - 9 * u, 11.5, h.won ? '#ffe08a' : '#c9a0a0', 'right');
        txt(detail, x + 44 * u, y + 9 * u, 11, '#b9ad96');
      } else {
        txt(h.mode === 'vigil' ? 'Vigil ' + h.wave : h.mode === 'rush' ? 'Gauntlet ' + h.depth : LF.place(h.depth, ', '), x + 48 * u, y, 14, h.won ? '#ffe08a' : '#f3e9d6', 'left', LF.FONT_UI, 'bold');
        txt(detail, x + 190 * u, y, 12, '#b9ad96');
        txt(result, x + w - 90 * u, y, 12, h.won ? '#ffe08a' : '#c9a0a0', 'right');
        txt(LF.fmtTime(h.time), x + w - 20 * u, y, 12, '#9a948a', 'right');
      }
      y += rh;
    });
    const fe = g.meta.felled || {}, names = Object.keys(fe).map(k => (LF.ENEMY_DEFS[k] ? LF.ENEMY_DEFS[k].name : k) + ' ×' + fe[k]);
    if (names.length) wtxt('Felled: ' + names.join('   ·   '), W / 2, y + 16 * u, 12, '#b89cff', W - 40 * u, 16);
    tabs(g, 'descents');
  }
  function codex(g) {
    backdrop('#10121c');
    bigTitle('Codex', 64 * u, 44);
    const all = LF.RELIC_LIST, seen = all.filter(r => g.meta.seen[r.id]).length;
    txt('Relics carried at least once: ' + seen + ' of ' + all.length, W / 2, 104 * u, 15, '#c9bfae', 'center', LF.FONT_UI, 'italic');
    const order = ['common', 'uncommon', 'rare', 'brand', 'cursed'];
    if (all.some(r => r.rarity === 'shadow' && g.meta.seen[r.id])) order.push('shadow'); // the shadow relics stay unlisted until one has been carried
    const counts = order.map(rar => all.filter(r => r.rarity === rar).length);
    const avail = H - 130 * u - 104 * u - order.length * 30 * u;
    let cell = 62 * u, cols = 12;
    for (let cs = 62; cs >= 30; cs -= 2) {
      cell = cs * u; cols = Math.max(4, Math.min(16, Math.floor((W - 36 * u) / cell)));
      if (counts.reduce((s, c) => s + Math.ceil(c / cols), 0) * cell <= avail) break;
    }
    const bs = Math.min(40 * u, cell * 0.66);
    let y = 130 * u;
    for (const rar of order) {
      const list = all.filter(r => r.rarity === rar);
      txt(LF.RARITY[rar].name.toUpperCase(), (W - cols * cell) / 2, y, 11, LF.RARITY[rar].color, 'left', LF.FONT_UI, 'bold');
      y += 14 * u + cell * 0.5;
      list.forEach((d, i) => {
        const x = (W - cols * cell) / 2 + (i % cols) * cell + cell / 2, yy = y + Math.floor(i / cols) * cell;
        if (g.meta.seen[d.id]) relicBadge(d.id, x, yy, bs, 1);
        else {
          ctx.fillStyle = 'rgba(10,10,18,0.7)'; ctx.beginPath(); ctx.arc(x, yy, bs * 0.6, 0, TAU); ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1.2 * u; ctx.stroke();
          txt('?', x, yy + 1 * u, 18, '#4a4852', 'center', LF.FONT_TITLE, '700');
        }
      });
      y += Math.ceil(list.length / cols) * cell - cell * 0.5 + 16 * u;
    }
    const lan = LF.LANTERNS.filter(l => l.unlocked(g.meta)).length;
    txt(`Lanterns kindled: ${lan} of ${LF.LANTERNS.length}   ·   Creatures unmade: ${g.meta.kills || 0}   ·   Great shadows felled: ${g.meta.bosses || 0}`, W / 2, H - 84 * u, 12, '#9a948a', 'center');
    tabs(g, 'codex');
    tooltip();
  }
  // the Lamplighter as you have chosen to look, walking on the spot
  function figurePreview(g, x, y, sc) {
    const t = g.realTime, a = Math.sin(t * 0.6) * 1.1 + 0.5;
    const lp = LF.drawFigure(ctx, LF.lookOf(g.meta), { x, y, sc, aim: a, mv: a, sp: 150, bob: t * 11, t, frac: 1, st: ui.figSt || (ui.figSt = {}) });
    ctx.globalCompositeOperation = 'lighter'; LF.drawGlow(ctx, '#ffb347', lp.x, lp.y, 13 * sc, 0.8); ctx.globalCompositeOperation = 'source-over';
  }
  function lookButton(g, x, y, w, h, size) {
    const lk = LF.lookOf(g.meta);
    if (button('Lightbearer: ' + LF.LOOK[lk].name, x, y, w, h, { size })) { g.state = 'bearer'; ui.enter(g, 'bearer'); ui.focus = Math.max(0, LF.LOOKS.findIndex(l => l.id === lk)); return true; }
    return false;
  }
  // ---- Lightbearers: who carries the light down. One is free; the rest are earned from the shadows that mirror them.
  function toLantern(g) {
    g.state = 'lantern'; ui.enter(g, 'lantern');
    ui.focus = Math.max(0, LF.LANTERNS.findIndex(l => l.id === g.meta.lantern && l.unlocked(g.meta)));
  }
  function bearerSelect(g) {
    backdrop('#12101a');
    const L = LF.LOOKS, n = L.length, cur = LF.lookOf(g.meta);
    bigTitle('Choose Your Lightbearer', NAR ? 58 * u : H * 0.13, NAR ? 28 : 44);
    txt('Each carries the light differently, and flares differently.', W / 2, NAR ? 90 * u : H * 0.13 + 44 * u, NAR ? 13 : 15, '#c9bfae', 'center', LF.FONT_UI, 'italic');
    const gap = (NAR ? 8 : 14) * u;
    const cw = NAR ? W - 32 * u : Math.min(262 * u, (W - 40 * u - (n - 1) * gap) / n);
    const y0 = NAR ? 112 * u : H * 0.25;
    const ch = NAR ? Math.min(128 * u, (H - y0 - 74 * u) / n - gap) : 372 * u;
    const x0 = NAR ? 16 * u : (W - n * cw - (n - 1) * gap) / 2;
    if (!ui.figs) ui.figs = {};
    let pick = null;
    L.forEach((d, i) => {
      const idx = ui.count++;
      const bx = NAR ? x0 : x0 + i * (cw + gap), by0 = NAR ? y0 + i * (ch + gap) : y0, open = LF.lookOpen(d, g.meta);
      const over = hit(bx, by0, cw, ch);
      if (over && inp.mouseMoved && ui.focus !== idx) { ui.focus = idx; LF.audio.play('uiMove'); }
      const foc = ui.focus === idx, chosen = cur === d.id;
      const x = bx, y = by0 + (foc && open && !NAR ? -8 * u : 0);
      LF.roundRect(ctx, x, y, cw, ch, 12 * u);
      const cg = ctx.createLinearGradient(0, y, 0, y + ch);
      cg.addColorStop(0, foc && open ? 'rgba(46,34,22,0.98)' : 'rgba(18,18,28,0.96)'); cg.addColorStop(1, 'rgba(8,8,14,0.98)');
      ctx.fillStyle = cg; ctx.fill();
      ctx.strokeStyle = !open ? 'rgba(120,120,130,0.35)' : foc ? '#ffd28a' : chosen ? '#ffb347' : 'rgba(255,217,160,0.3)'; ctx.lineWidth = (foc ? 2.6 : 1.3) * u; ctx.stroke();
      // the figure itself, walking on the spot; a locked one is only a shape in the dark
      const fx0 = NAR ? x + 52 * u : x + cw / 2, fy0 = NAR ? y + ch / 2 : y + 84 * u, fsc = (NAR ? 1.7 : 2.6) * u, t = g.realTime;
      const a = Math.sin(t * 0.6 + i * 1.3) * 1.0 + 0.5;
      ctx.globalAlpha = open ? 1 : 0.22;
      const lp = LF.drawFigure(ctx, d.id, { x: fx0, y: fy0, sc: fsc, aim: a, mv: a, sp: open && foc ? 150 : 0, bob: t * 11, t, frac: 1, st: ui.figs[d.id] || (ui.figs[d.id] = {}) });
      ctx.globalAlpha = 1;
      if (open) { ctx.globalCompositeOperation = 'lighter'; LF.drawGlow(ctx, '#ffb347', lp.x, lp.y, (foc ? 15 : 12) * fsc, foc ? 0.85 : 0.6); ctx.globalCompositeOperation = 'source-over'; }
      if (!NAR) {
        txt(d.name, x + cw / 2, y + 198 * u, 18, open ? '#fff2d6' : '#77747e', 'center', LF.FONT_TITLE, '700');
        ctx.font = `${Math.round(12.5 * u)}px ${LF.FONT_UI}`;
        if (open) LF.wrapText(ctx, d.perk, cw - 28 * u).forEach((l, j) => txt(l, x + cw / 2, y + 226 * u + j * 17 * u, 12.5, '#d8cdb8', 'center'));
        else {
          LF.drawIcon(ctx, 'shield', x + cw / 2, y + 238 * u, 22 * u, '#5d5a66');
          txt('NOT YET ANSWERED', x + cw / 2, y + 266 * u, 11, '#8f8a80', 'center', LF.FONT_UI, 'bold');
          LF.wrapText(ctx, d.unlockText, cw - 28 * u).forEach((l, j) => txt(l, x + cw / 2, y + 284 * u + j * 16 * u, 12.5, '#c9a36a', 'center'));
        }
        if (chosen && open) txt('CARRYING THE LIGHT', x + cw / 2, y + ch - 18 * u, 10, '#ffb347', 'center', LF.FONT_UI, 'bold');
      } else {
        const tx = x + 104 * u;
        txt(d.name, tx, y + 22 * u, 16, open ? '#fff2d6' : '#77747e', 'left', LF.FONT_TITLE, '700');
        if (chosen && open) txt('CHOSEN', x + cw - 14 * u, y + 22 * u, 9.5, '#ffb347', 'right', LF.FONT_UI, 'bold');
        ctx.font = `${Math.round(11.5 * u)}px ${LF.FONT_UI}`;
        const maxLines = Math.max(1, Math.floor((ch - 38 * u) / (14 * u)));
        LF.wrapText(ctx, open ? d.perk : 'Not yet answered. ' + d.unlockText + '.', cw - 118 * u).slice(0, maxLines).forEach((l, j) => txt(l, tx, y + 42 * u + j * 14 * u, 11.5, open ? '#d8cdb8' : '#c9a36a'));
      }
      if (ui.t > 0.25 && !g.fade && ((over && inp.click) || (foc && inp.confirm))) { if (open) pick = d; else LF.audio.play('deny'); }
    });
    if (pick) { g.meta.look = pick.id; g.save(); LF.audio.play('uiSelect'); toLantern(g); return; }
    const bw = 240 * u, by = NAR ? y0 + n * (ch + gap) + 4 * u : y0 + ch + 26 * u;
    if (button('Back', (W - bw) / 2, by, bw, 42 * u, { back: true }) || inp.back) { toLantern(g); return; }
    tooltip();
  }
  function lanternSelect(g) {
    backdrop('#12101a');
    const L = LF.LANTERNS, n = L.length;
    let start = null, bby, bw2, bx2;
    if (!NAR) {
      bigTitle('Choose Your Lantern', H * 0.13, 44);
      txt('Each burns differently. The dark does not care which.', W / 2, H * 0.13 + 44 * u, 15, '#c9bfae', 'center', LF.FONT_UI, 'italic');
    } else {
      bigTitle('Choose Your Lantern', 58 * u, 30);
      txt('Each burns differently. The dark does not care which.', W / 2, 90 * u, 13, '#c9bfae', 'center', LF.FONT_UI, 'italic');
    }
    const gap = (NAR ? 8 : 12) * u;
    const cw = NAR ? W - 32 * u : Math.min(214 * u, (W - 40 * u - (n - 1) * gap) / n);
    const y0 = NAR ? 126 * u : H * 0.27;
    const ch = NAR ? Math.min(104 * u, (H - y0 - 250 * u) / n - gap) : 320 * u;
    const x0 = NAR ? 16 * u : (W - n * cw - (n - 1) * gap) / 2;
    if (ui.mode === 'rush' && !ui.daily && ui.practice) wtxt('Rehearsal  ·  ' + ((g.meta.met || {})[ui.practice] || (g.meta.felled || {})[ui.practice] ? LF.ENEMY_DEFS[ui.practice].name : 'a great shadow') + ', alone  ·  nothing is won or lost', W / 2, y0 - (NAR ? 14 : 22) * u, NAR ? 11.5 : 13, '#e2c9ff', W - 30 * u, 15, 'bold');
    else if (ui.mode === 'rush' && !ui.daily) wtxt('The Gauntlet  ·  six great shadows, back to back  ·  five relics to start', W / 2, y0 - (NAR ? 14 : 22) * u, NAR ? 11.5 : 13, '#e2c9ff', W - 30 * u, 15, 'bold');
    if (ui.mode === 'vigil' && !ui.daily) wtxt('The Long Vigil  ·  endless waves in one hall  ·  a relic every second wave', W / 2, y0 - (NAR ? 14 : 22) * u, NAR ? 11.5 : 13, '#ffcf8a', W - 30 * u, 15, 'bold');
    if (ui.daily) wtxt('Daily Descent  ·  ' + ui.daily + '  ·  the same dark on every try today', W / 2, y0 - (NAR ? 14 : 22) * u, NAR ? 11.5 : 13, '#9dffcf', W - 30 * u, 15, 'bold');
    L.forEach((d, i) => {
      const idx = ui.count++;
      const bx = NAR ? x0 : x0 + i * (cw + gap), by0 = NAR ? y0 + i * (ch + gap) : y0, open = d.unlocked(g.meta);
      const over = hit(bx, by0, cw, ch);
      if (over && inp.mouseMoved && ui.focus !== idx) { ui.focus = idx; LF.audio.play('uiMove'); }
      const foc = ui.focus === idx, cur = g.meta.lantern === d.id;
      const x = bx, y = by0 + (foc && open && !NAR ? -8 * u : 0);
      LF.roundRect(ctx, x, y, cw, ch, 12 * u);
      const cg = ctx.createLinearGradient(0, y, 0, y + ch);
      cg.addColorStop(0, foc && open ? 'rgba(46,34,22,0.98)' : 'rgba(18,18,28,0.96)'); cg.addColorStop(1, 'rgba(8,8,14,0.98)');
      ctx.fillStyle = cg; ctx.fill();
      ctx.strokeStyle = !open ? 'rgba(120,120,130,0.35)' : foc ? '#ffd28a' : cur ? d.color : 'rgba(255,217,160,0.3)'; ctx.lineWidth = (foc ? 2.6 : 1.3) * u; ctx.stroke();
      const ix = NAR ? x + 48 * u : x + cw / 2, iy = NAR ? y + ch / 2 : y + 84 * u, isz = NAR ? Math.min(46 * u, ch * 0.5) : 60 * u;
      if (open) {
        ctx.globalCompositeOperation = 'lighter';
        LF.drawGlow(ctx, d.color, ix, iy, isz * (foc ? 1.35 : 1), foc ? 0.42 : 0.24);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.globalAlpha = open ? 1 : 0.3;
      LF.drawIcon(ctx, d.glyph, ix, iy + (open ? Math.sin(g.realTime * 2 + i) * 3 * u : 0), isz, open ? d.color : '#8a8a94');
      ctx.globalAlpha = 1;
      if (!NAR) {
        txt(d.name, x + cw / 2, y + 160 * u, 17, open ? '#fff2d6' : '#77747e', 'center', LF.FONT_TITLE, '700');
        ctx.font = `${Math.round(12.5 * u)}px ${LF.FONT_UI}`;
        if (open) LF.wrapText(ctx, d.desc, cw - 26 * u).forEach((l, j) => txt(l, x + cw / 2, y + 190 * u + j * 17 * u, 12.5, '#d8cdb8', 'center'));
        else {
          LF.drawIcon(ctx, 'shield', x + cw / 2, y + 206 * u, 22 * u, '#5d5a66');
          txt('LOCKED', x + cw / 2, y + 236 * u, 11, '#8f8a80', 'center', LF.FONT_UI, 'bold');
          LF.wrapText(ctx, d.unlockText, cw - 26 * u).forEach((l, j) => txt(l, x + cw / 2, y + 256 * u + j * 16 * u, 12.5, '#c9a36a', 'center'));
        }
        if (cur && open) txt('LAST CARRIED', x + cw / 2, y + ch - 18 * u, 10, d.color, 'center', LF.FONT_UI, 'bold');
        { const md = (g.meta.mastery || {})[d.id] || 0, ml = LF.masteryLevel(g.meta, d.id); if (open && md > 0) txt((ml ? 'Mastery ' + ['', 'I', 'II', 'III'][ml] : 'No mastery yet') + '  ·  ' + md + (md === 1 ? ' level' : ' levels'), x + cw / 2, y + ch - 36 * u, 10, '#c9a36a', 'center'); }
      } else {
        const tx = x + 92 * u;
        txt(d.name, tx, y + 22 * u, 16, open ? '#fff2d6' : '#77747e', 'left', LF.FONT_TITLE, '700');
        if (cur && open) txt('LAST CARRIED', x + cw - 14 * u, y + 22 * u, 9.5, d.color, 'right', LF.FONT_UI, 'bold');
        ctx.font = `${Math.round(12 * u)}px ${LF.FONT_UI}`;
        const maxLines = Math.max(1, Math.floor((ch - 40 * u) / (15 * u)));
        if (open) LF.wrapText(ctx, d.desc, cw - 108 * u).slice(0, maxLines).forEach((l, j) => txt(l, tx, y + 42 * u + j * 15 * u, 12, '#d8cdb8'));
        else txt('Locked: ' + d.unlockText, tx, y + 44 * u, 12.5, '#c9a36a');
      }
      if (ui.t > 0.25 && !g.fade && ((over && inp.click) || (foc && inp.confirm))) { if (open) start = d; else LF.audio.play('deny'); }
    });
    if (start) {
      g.meta.lantern = start.id; g.save(); LF.audio.play('uiSelect');
      if (ui.daily) { const key = ui.daily; ui.daily = null; g.startRun(parseInt(key.replace(/-/g, ''), 10), { daily: key }); }
      else if (ui.mode === 'vigil' || ui.mode === 'rush') g.startRun(undefined, { mode: ui.mode, practice: ui.mode === 'rush' ? ui.practice : null });
      else g.startRun();
      return;
    }
    if (NAR) { bby = y0 + n * (ch + gap) + 4 * u; bw2 = (W - 32 * u - 10 * u) / 2; bx2 = 16 * u; }
    else { bby = y0 + ch + 26 * u; bw2 = 240 * u; bx2 = W / 2 - 250 * u; }
    if (button((NAR ? '' : 'Difficulty: ') + LF.DIFFS[g.meta.diff].name, bx2, bby, bw2, 42 * u, { size: 14 })) { g.meta.diff = (g.meta.diff + 1) % LF.DIFFS.length; g.save(); }
    { const lw = (NAR ? 168 : 230) * u; if (lookButton(g, 16 * u, 16 * u, lw, 36 * u, 13)) return; figurePreview(g, 16 * u + lw + (NAR ? 26 : 52) * u, (NAR ? 36 : 44) * u, (NAR ? 1.3 : 2.4) * u);
      if (!NAR) wtxt(LF.LOOK[LF.lookOf(g.meta)].perk, 16 * u, 72 * u, 12, '#c9bfae', 250 * u, 15, 'italic', 'left'); }
    if (button('Back', bx2 + bw2 + (NAR ? 10 : 20) * u, bby, bw2, 42 * u, { back: true }) || inp.back) { ui.daily = null; g.state = 'title'; ui.enter(g, 'title'); return; }
    // vows
    const vy = bby + 54 * u;
    if ((g.meta.bosses || 0) < 1) wtxt('Vows, sworn handicaps that pay extra cinders, open once you fell a great shadow.', W / 2, vy + 16 * u, 12, '#77747e', W - 40 * u, 15, 'italic');
    else {
      if (!g.meta.vows) g.meta.vows = {};
      const V = LF.VOWS, per = NAR ? 3 : V.length, vg = 8 * u;
      const vw = Math.min(188 * u, (W - 32 * u - (per - 1) * vg) / per), vh = (NAR ? 32 : 36) * u;
      let hover = null, bonus = 0;
      V.forEach((v, i) => {
        const row = Math.floor(i / per), inRow = Math.min(per, V.length - row * per), col = i % per;
        const x = (W - inRow * vw - (inRow - 1) * vg) / 2 + col * (vw + vg), yv = vy + row * (vh + 6 * u);
        const on = !!g.meta.vows[v.id], idx = ui.count;
        if (button(v.name.replace('Vow of ', ''), x, yv, vw, vh, { size: 12.5 })) { g.meta.vows[v.id] = !on; g.save(); }
        if (g.meta.vows[v.id]) { bonus += v.bonus; ctx.strokeStyle = '#ffcf5c'; ctx.lineWidth = 2 * u; LF.roundRect(ctx, x + 2 * u, yv + 2 * u, vw - 4 * u, vh - 4 * u, 6 * u); ctx.stroke(); ctx.fillStyle = '#ffcf5c'; ctx.beginPath(); ctx.arc(x + 12 * u, yv + vh / 2, 3.5 * u, 0, TAU); ctx.fill(); }
        if (ui.focus === idx) hover = v;
      });
      const rowsV = Math.ceil(V.length / per);
      const line = hover ? hover.name + ': ' + hover.desc + '  (+' + Math.round(hover.bonus * 100) + '% cinders)' : bonus > 0 ? 'Sworn vows pay +' + Math.round(bonus * 100) + '% cinders this descent.' : 'Vows: swear a handicap for extra cinders.';
      wtxt(line, W / 2, vy + rowsV * (vh + 6 * u) + 12 * u, 12, hover || bonus > 0 ? '#ffcf8a' : '#8f8a80', W - 30 * u, 15, 'italic');
    }
  }
  function pause(g) {
    ctx.fillStyle = 'rgba(2,3,8,0.8)'; ctx.fillRect(0, 0, W, H);
    bigTitle('Paused', NAR ? 70 * u : H * 0.16, NAR ? 36 : 44);
    const p = g.player, s = p.stats;
    const bw = NAR ? Math.min(320 * u, W - 40 * u) : 280 * u, bh = (NAR ? 44 : 48) * u;
    const x = NAR ? (W - bw) / 2 : W * 0.5 - bw - 20 * u; let y = NAR ? 110 * u : H * 0.3;
    if (button('Resume', x, y, bw, bh) || inp.pause) { g.state = 'play'; return; }
    y += bh + 10 * u;
    if (button('Settings', x, y, bw, bh, { size: 15 })) { ui.settingsFrom = 'pause'; g.state = 'settings'; ui.enter(g, 'settings'); return; }
    y += bh + 10 * u;
    const armed = ui.abandonAt && g.realTime - ui.abandonAt < 3;
    if (button(armed ? 'Press again to abandon' : 'Abandon this descent', x, y, bw, bh, { size: 14, back: true })) {
      if (armed) { ui.abandonAt = 0; g.endRun(false); g.state = 'title'; ui.enter(g, 'title'); LF.audio.intensity = 0; return; }
      ui.abandonAt = g.realTime;
    }
    y += bh + 20 * u;
    const nv = Object.keys(g.vows).length;
    const head = LF.LOOK[LF.lookOf(g.meta)].name + '  ·  ' + (g.mode === 'vigil' ? 'Vigil  ·  ' : g.mode === 'rush' ? (g.practice ? 'Rehearsal  ·  ' : 'Gauntlet  ·  ') : '') + LF.LANTERN[g.lanternId].name + '  ·  ' + g.diff.name + (nv ? '  ·  ' + nv + (nv > 1 ? ' vows' : ' vow') : '') + (g.daily ? '  ·  Daily' : '') + (g.omen ? '  ·  Omen: ' + g.omen.name : '');
    txt(head, NAR ? W / 2 : x, y, 12, '#c9a36a', NAR ? 'center' : 'left', LF.FONT_UI, 'bold');
    if (g.omen) { y += 17 * u; txt(g.omen.desc, NAR ? W / 2 : x, y, 11, '#b9a7d8', NAR ? 'center' : 'left', LF.FONT_UI, 'italic'); }
    const info = [`Damage ${s.damage.toFixed(1)}`, `Fire rate ${s.fireRate.toFixed(1)}/s`, `Crit ${Math.round(s.crit * 100)}%`, `Speed ${Math.round(s.speed)}`, `Kills ${g.run.kills}`, `Time ${LF.fmtTime(g.run.time)}`];
    y += 24 * u;
    if (NAR) { txt(info.slice(0, 3).join('   ·   '), W / 2, y, 11.5, '#9a948a', 'center'); txt(info.slice(3).join('   ·   '), W / 2, y + 17 * u, 11.5, '#9a948a', 'center'); y += 36 * u; }
    else info.forEach((t, i) => txt(t, x + (i % 2) * bw / 2, y + Math.floor(i / 2) * 20 * u, 12, '#9a948a'));
    // relic list
    const lw = NAR ? W - 32 * u : Math.min(520 * u, W * 0.46), lx = NAR ? 16 * u : W * 0.5 + 20 * u, ly = NAR ? y + 8 * u : H * 0.26;
    const lh = NAR ? Math.max(80 * u, H - ly - 16 * u) : H * 0.6;
    panel(lx, ly, lw, lh, 10);
    txt('Relics', lx + 20 * u, ly + 22 * u, 15, '#ffd28a', 'left', LF.FONT_UI, 'bold');
    if (p.synergies && p.synergies.length) txt('Kindred: ' + p.synergies.map(sy => sy.name).join(', '), lx + lw - 16 * u, ly + 22 * u, 11, '#9dffcf', 'right', LF.FONT_UI, 'bold');
    if (!p.relicOrder.length) txt('None yet. The first stair will offer one.', lx + 20 * u, ly + 50 * u, 13, '#8f8a80');
    {
      // schools held, strongest first: three of a school attunes the lantern, five and seven attune it further
      const sc = p.schools || {}, ks = Object.keys(sc).sort((a, b) => sc[b] - sc[a]);
      let sx = lx + 20 * u; const sy = ly + lh - 14 * u;
      for (const k of ks) {
        const S = LF.SCHOOLS[k], t = LF.tierOf(sc[k]), label = S.name + ' ' + sc[k] + (t ? ' ' + ['', 'I', 'II', 'III'][t] : '');
        txt(label, sx, sy, 11.5, t ? S.color : '#8f8a80', 'left', LF.FONT_UI, t ? 'bold' : 'normal');
        ctx.font = `${t ? 'bold ' : ''}${Math.round(11.5 * u)}px ${LF.FONT_UI}`; sx += ctx.measureText(label).width + 14 * u;
        if (sx > lx + lw - 60 * u) break;
      }
    }
    const rowH = Math.min(40 * u, (lh - 68 * u) / Math.max(1, p.relicOrder.length));
    p.relicOrder.forEach((id, i) => {
      const d = LF.RELICS[id], yy = ly + 50 * u + i * rowH;
      if (yy > ly + lh - 30 * u) return;
      LF.drawIcon(ctx, d.glyph, lx + 30 * u, yy, Math.min(22 * u, rowH * 0.7), d.color);
      txt(d.name + (p.relics[id] > 1 ? ' ×' + p.relics[id] : ''), lx + 52 * u, yy - (rowH > 30 * u ? 7 * u : 0), 13, LF.rar(d).color, 'left', LF.FONT_UI, 'bold');
      if (rowH > 30 * u) { ctx.font = `${Math.round(11 * u)}px ${LF.FONT_UI}`; txt(LF.wrapText(ctx, d.desc, lw - 70 * u)[0], lx + 52 * u, yy + 9 * u, 11, '#b9ad96'); }
    });
  }
  // The Forge: small tiles, one for each relic that can still grow, with its rank and its price; what the one under
  // the hand does is written out below them.
  function forgeScreen(g, o) {
    const p = g.player, ROM = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
    ctx.fillStyle = 'rgba(2,3,8,0.94)'; ctx.fillRect(0, 0, W, H);
    const ty = NAR ? 50 * u : H * 0.11;
    bigTitle(o.title, ty, NAR ? 26 : 38, '#ffe2b0');
    txt('Glass forges a rank into a relic you carry. The higher its rank, the dearer the next.', W / 2, ty + (NAR ? 30 : 40) * u, NAR ? 12 : 14, '#c9bfae', 'center', LF.FONT_UI, 'italic');
    txt('\u25c6 ' + Math.floor(p.glass) + ' glass', W / 2, ty + (NAR ? 50 : 64) * u, NAR ? 14 : 17, '#8fe6ff', 'center', LF.FONT_UI, 'bold');
    const n = o.relics.length, cols = NAR ? 1 : n > 14 ? 4 : n > 6 ? 3 : 2, rows = Math.ceil(n / cols);
    const y0 = ty + (NAR ? 70 : 92) * u, room = H - y0 - (NAR ? 150 : 170) * u, gap = 8 * u;
    const th = Math.max(30 * u, Math.min(54 * u, room / rows - gap)), tw = Math.min(250 * u, (W - 40 * u - (cols - 1) * gap) / cols);
    const x0 = (W - cols * tw - (cols - 1) * gap) / 2;
    let chosen = -2, shown = null;
    o.relics.forEach((d, i) => {
      const idx = ui.count++, x = x0 + (i % cols) * (tw + gap), y = y0 + Math.floor(i / cols) * (th + gap);
      const over = hit(x, y, tw, th);
      if (over && inp.mouseMoved && ui.focus !== idx) { ui.focus = idx; LF.audio.play('uiMove'); }
      const foc = ui.focus === idx, have = p.relics[d.id] || 0, cost = g.forgeCost(d), can = p.glass >= cost, S = LF.SCHOOLS[d.school];
      if (foc) shown = d;
      LF.roundRect(ctx, x, y, tw, th, 8 * u);
      ctx.fillStyle = foc ? 'rgba(46,34,22,0.98)' : 'rgba(18,18,28,0.96)'; ctx.fill();
      ctx.strokeStyle = foc ? '#ffe2b0' : can ? (S ? S.color : '#c9c2b0') : 'rgba(140,134,120,0.35)'; ctx.lineWidth = (foc ? 2.2 : 1) * u; ctx.stroke();
      ctx.globalAlpha = can ? 1 : 0.5;
      LF.drawIcon(ctx, d.glyph, x + th * 0.5, y + th / 2, Math.min(30 * u, th * 0.62), d.color);
      const tx = x + th + 2 * u, small = th < 44 * u;
      txt(d.name, tx, y + (small ? th / 2 - 5 * u : 17 * u), small ? 12 : 13.5, '#fff2d6', 'left', LF.FONT_UI, 'bold');
      txt('RANK ' + ROM[have] + '  \u2192  ' + ROM[have + 1], tx, y + (small ? th / 2 + 8 * u : 35 * u), small ? 9 : 10, S ? S.color : '#ffd9a0', 'left', LF.FONT_UI, 'bold');
      ctx.globalAlpha = 1;
      txt('\u25c6 ' + cost, x + tw - 12 * u, y + th / 2, 13, can ? '#8fe6ff' : '#ff8a8a', 'right', LF.FONT_UI, 'bold');
      if (o.t > 0.25 && !g.fade && ((over && inp.click) || (foc && inp.confirm))) chosen = i;
    });
    // what the relic under the hand does
    const py = y0 + rows * (th + gap) + 6 * u;
    if (shown) {
      const S = LF.SCHOOLS[shown.school];
      txt(shown.name + (S ? '   \u00b7   ' + S.name + (shown.pathName ? ', ' + shown.pathName : '') : ''), W / 2, py + 8 * u, 12, S ? S.color : '#ffd9a0', 'center', LF.FONT_UI, 'bold');
      wtxt(shown.desc, W / 2, py + 26 * u, NAR ? 11.5 : 12.5, '#d8cdb8', Math.min(W - 40 * u, 640 * u), 16, '');
    }
    const bw = Math.min(240 * u, W - 40 * u);
    if ((button(o.forged ? 'Done' : 'Back to the cards', (W - bw) / 2, H - 62 * u, bw, 44 * u, { back: true }) || inp.back) && o.t > 0.25) chosen = -1;
    if (chosen > -2) { if (chosen >= 0) g.pickOffer(chosen); else { LF.audio.play('uiSelect'); g.pickOffer(-1); } }
  }
  function offer(g) {
    const o = g.offer; if (!o) return;
    o.t += 1 / 60;
    if (o.forge) { forgeScreen(g, o); return; }
    ctx.fillStyle = o.dim ? 'rgba(2,3,8,0.94)' : 'rgba(2,3,8,0.82)'; ctx.fillRect(0, 0, W, H);
    const ty = NAR ? 62 * u : H * 0.15;
    bigTitle(o.title, ty, NAR ? 28 : 42, o.cursed ? '#e2c9ff' : '#ffe2b0');
    const subBottom = wtxt(o.sub || '', W / 2, ty + (NAR ? 34 : 44) * u, NAR ? 13 : 15, '#c9bfae', W - 36 * u, 17, 'italic');
    const n = o.relics.length, gap = (NAR ? 8 : 16) * u;
    const y0 = NAR ? subBottom + 14 * u : H * 0.29;
    const cw = NAR ? W - 32 * u : Math.min(250 * u, (W - 60 * u) / n - 14 * u);
    const ch = NAR ? Math.min(122 * u, (H - y0 - 78 * u) / n - gap) : 356 * u;
    const x0 = NAR ? 16 * u : (W - n * cw - (n - 1) * gap) / 2;
    let chosen = -2;
    const schoolLine = d => {
      // a relic already held is a rank; and a pick that would wake a kindred says so
      const S = d.school && LF.SCHOOLS[d.school], have = g.player.relics[d.id] || 0, ROM = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
      if (have && d.max > 1 && d.rarity !== 'boon') return { text: 'RANK ' + ROM[have] + ' \u2192 ' + ROM[have + 1], color: S ? S.color : '#ffd9a0', up: true };
      // a legendary names the theme it carries yours into, in place of its path
      if (S && d.bridge && LF.SCHOOLS[d.bridge]) return { text: S.name.toUpperCase() + '  \u2192  ' + LF.SCHOOLS[d.bridge].name.toUpperCase(), color: S.color };
      return S ? { text: S.name.toUpperCase() + (d.pathName ? '  ·  ' + d.pathName.toUpperCase() : '') + (d.form ? '  ·  ' + (d.form === 'bolt' ? 'BOLT' : 'FLARE') + ' FORM' : ''), color: S.color } : null;
    };
    o.relics.forEach((d, i) => {
      const idx = ui.count++;
      const appear = LF.ease.outBack(LF.clamp((o.t - i * 0.08) * 3, 0, 1));
      const bx = NAR ? x0 : x0 + i * (cw + gap), by0 = NAR ? y0 + i * (ch + gap) : y0;
      const over = hit(bx, by0, cw, ch);
      if (over && inp.mouseMoved && ui.focus !== idx) { ui.focus = idx; LF.audio.play('uiMove'); }
      const foc = ui.focus === idx, col = LF.rar(d).color;
      const x = bx + (NAR ? (1 - appear) * 30 * u : 0), y = by0 + (NAR ? 0 : (1 - appear) * 40 * u + (foc ? -8 * u : 0));
      ctx.globalAlpha = LF.clamp(appear, 0, 1);
      LF.roundRect(ctx, x, y, cw, ch, 12 * u);
      const cg = ctx.createLinearGradient(0, y, 0, y + ch);
      cg.addColorStop(0, foc ? 'rgba(46,34,22,0.98)' : 'rgba(18,18,28,0.96)'); cg.addColorStop(1, 'rgba(8,8,14,0.98)');
      ctx.fillStyle = cg; ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = (foc ? 2.6 : 1.3) * u; ctx.stroke();
      if (d.legend) { LF.roundRect(ctx, x + 4 * u, y + 4 * u, cw - 8 * u, ch - 8 * u, 9 * u); ctx.lineWidth = 1 * u; ctx.stroke(); } // (a legendary's edge is doubled)
      const have = g.player.relics[d.id] || 0;
      if (!NAR) {
        ctx.globalCompositeOperation = 'lighter';
        LF.drawGlow(ctx, col, x + cw / 2, y + 86 * u, (foc ? 78 : 60) * u, foc ? 0.4 : 0.22);
        ctx.globalCompositeOperation = 'source-over';
        LF.drawIcon(ctx, d.glyph, x + cw / 2, y + 86 * u + Math.sin(g.realTime * 2 + i) * 3 * u, 64 * u, d.color);
        txt(LF.rar(d).name.toUpperCase(), x + cw / 2, y + 156 * u, 10, col, 'center', LF.FONT_UI, 'bold');
        txt(d.name, x + cw / 2, y + 180 * u, 18, '#fff2d6', 'center', LF.FONT_TITLE, '700');
        const sl = schoolLine(d);
        if (sl) txt(sl.text, x + cw / 2, y + 200 * u, 10.5, sl.color, 'center', LF.FONT_UI, 'bold');
        ctx.font = `${Math.round(13 * u)}px ${LF.FONT_UI}`;
        { // a long card is set a little smaller, so its last lines do not run into what is written under them
          let fsz = 13, lines = LF.wrapText(ctx, d.desc, cw - 30 * u);
          if (lines.length > 5) { fsz = 11.5; ctx.font = `${Math.round(fsz * u)}px ${LF.FONT_UI}`; lines = LF.wrapText(ctx, d.desc, cw - 24 * u); }
          const lh = fsz === 13 ? 17 : 14.5;
          lines.forEach((l, j) => txt(l, x + cw / 2, y + 222 * u + j * lh * u, fsz, '#d8cdb8', 'center')); }
        if (have) txt(d.base === 3 ? (have >= 3 ? 'Past rank III, each rank is half as much again' : 'You hold rank ' + ['', 'I', 'II'][have]) : 'You hold ' + have + ' of ' + d.max, x + cw / 2, y + ch - 20 * u, 11, '#8f8a80', 'center');
        const cmp = LF.completes(g.player, d.id);
        if (cmp.length) txt('Wakes ' + cmp[0].name, x + cw / 2, y + ch - 38 * u, 11.5, '#9dffcf', 'center', LF.FONT_UI, 'bold');
        else { const gl = o.buy ? '\u25c6 ' + o.buy.price + ' glass   (you hold ' + Math.floor(g.player.glass) + ')' : LF.growsLine(g.player, d.id); if (gl) txt(gl, x + cw / 2, y + ch - 38 * u, o.buy ? 13 : 11.5, o.buy ? (g.player.glass >= o.buy.price ? '#8fe6ff' : '#ff8a8a') : '#ffd9a0', 'center', LF.FONT_UI, 'bold'); }
      } else {
        const ix = x + 46 * u, iy = y + ch / 2, isz = Math.min(48 * u, ch * 0.5);
        ctx.globalCompositeOperation = 'lighter';
        LF.drawGlow(ctx, col, ix, iy, isz * (foc ? 1.3 : 1), foc ? 0.4 : 0.22);
        ctx.globalCompositeOperation = 'source-over';
        LF.drawIcon(ctx, d.glyph, ix, iy, isz, d.color);
        const tx = x + 90 * u;
        txt(d.name, tx, y + 22 * u, 16, '#fff2d6', 'left', LF.FONT_TITLE, '700');
        const cmp = LF.completes(g.player, d.id);
        const sl = schoolLine(d);
        txt(cmp.length ? 'COMPLETES ' + cmp[0].name.toUpperCase() : sl ? sl.text : LF.rar(d).name.toUpperCase() + (have ? '   ·   you hold ' + have + (d.base === 3 ? '' : ' of ' + d.max) : ''), x + cw - 14 * u, y + 22 * u, 9.5, cmp.length ? '#9dffcf' : sl ? sl.color : col, 'right', LF.FONT_UI, 'bold');
        ctx.font = `${Math.round(12.5 * u)}px ${LF.FONT_UI}`;
        const maxLines = Math.max(1, Math.floor((ch - 38 * u) / (16 * u)));
        LF.wrapText(ctx, d.desc, cw - 106 * u).slice(0, maxLines).forEach((l, j) => txt(l, tx, y + 44 * u + j * 16 * u, 12.5, '#d8cdb8'));
      }
      ctx.globalAlpha = 1;
      if (o.t > 0.35 && !g.fade && ((over && inp.click) || (foc && inp.confirm))) chosen = i;
    });
    const by = NAR ? y0 + n * (ch + gap) + 6 * u : y0 + ch + 30 * u;
    if (o.canSkip) {
      const rr = !o.cursed && !o.noReroll, bw1 = Math.min(220 * u, (W - 44 * u) / 2);
      let bx = (W - (rr ? bw1 * 2 + 12 * u : bw1)) / 2;
      if (rr) { if (button(rerollLabel(g, o), bx, by, bw1, 44 * u, { size: 14 }) || inp.reroll) { g.rerollOffer(); return; } bx += bw1 + 12 * u; }
      if (button(o.buy ? 'Leave it on the pedestal' : 'Walk away', bx, by, bw1, 44 * u, o.buy ? { back: true, size: 13 } : { back: true }) && o.t > 0.35) chosen = -1;
    }
    else {
      const rr = !o.noReroll && !o.cursed, alt = o.altGlass > 0, keep = !!o.mend, cnt = (rr ? 1 : 0) + (alt ? 1 : 0) + (keep ? 1 : 0);
      const bw2 = Math.min(250 * u, (W - 32 * u - (cnt - 1) * 12 * u) / Math.max(1, cnt));
      const total = cnt * bw2 + (cnt - 1) * 12 * u; let bx = (W - total) / 2;
      if (rr) { if (button(o.free ? 'Show the others' : rerollLabel(g, o), bx, by, bw2, 44 * u, { size: NAR ? 13 : 14 }) || inp.reroll) { g.rerollOffer(); return; } bx += bw2 + 12 * u; }
      if (alt && button('Leave them: take ' + o.altGlass + ' glass', bx, by, bw2, 44 * u, { size: NAR ? 13 : 14, back: true }) && o.t > 0.35) chosen = -1;
      if (keep && button('Done: keep the glass', bx, by, bw2, 44 * u, { size: NAR ? 13 : 14, back: true }) && o.t > 0.35) chosen = -1;
    }
    if (chosen > -2) { LF.audio.play('uiSelect'); g.pickOffer(chosen); }
  }
  // every reroll is bought with glass, and each costs more than the last on the same offer
  function rerollLabel(g, o) { return 'Reroll  \u00b7  \u25c6 ' + g.rerollPrice(o); }
  function statRows(g, y0) {
    const r = g.run;
    const rows = [g.mode === 'vigil' ? ['Waves survived', String(r.wave || 0)] : g.mode === 'rush' ? ['Shadows faced', (r.depth || g.depth) + ' of ' + g.rushLen()] : ['Reached', LF.place(r.depth || g.depth, ', ')], ['Creatures unmade', String(r.kills)], ['Elites', String(r.elites || 0)], ['Great shadows felled', String(r.bosses)], ['Time in the dark', LF.fmtTime(r.time)], g.mode === 'descent' ? ['Lamps relit', String(r.lamps || 0)] : ['Glass gathered', String(Math.floor(r.glass))]];
    const w = Math.min(420 * u, W - 48 * u), x = (W - w) / 2;
    rows.forEach((row, i) => {
      const y = y0 + i * 26 * u;
      txt(row[0], x, y, 14, '#b9ad96'); txt(row[1], x + w, y, 14, '#f3e9d6', 'right', LF.FONT_UI, 'bold');
      ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(x, y + 12 * u, w, 1);
    });
    const y = y0 + rows.length * 26 * u + 16 * u;
    LF.drawIcon(ctx, 'flame', W / 2 - 96 * u, y, 22 * u, '#ff9a50');
    txt(g.practice ? 'A rehearsal pays nothing' : '+' + (r.cinders || 0) + ' cinders for the Hearth', W / 2 - 78 * u, y + 1 * u, 16, '#ffcf8a', 'left', LF.FONT_UI, 'bold');
    // relics carried
    const p = g.player, cnt = p.relicOrder.length, sp = Math.min(34 * u, (W - 60 * u) / Math.max(1, cnt));
    let rx = W / 2 - (cnt - 1) * sp / 2; const ry = y + 44 * u;
    for (const id of p.relicOrder) { relicBadge(id, rx, ry, Math.min(26 * u, sp * 0.82), p.relics[id]); rx += sp; }
    return ry + 40 * u;
  }
  function dead(g) {
    ctx.fillStyle = 'rgba(2,2,6,0.86)'; ctx.fillRect(0, 0, W, H);
    const a = Math.min(1, ui.t * 1.2);
    ctx.globalAlpha = a;
    const ty = NAR ? 80 * u : H * 0.17;
    bigTitle('Your light went out', ty, NAR ? 34 : 50, '#ffb3a0');
    const sb = wtxt('Snuffed by ' + (g.run.cause || 'the dark') + (g.mode === 'vigil' ? ' during wave ' + (g.vigil ? g.vigil.wave : 0) : g.mode === 'rush' ? (g.practice ? ' in rehearsal' : ', shadow ' + (g.run.depth || g.depth) + ' of the Gauntlet') : ' on ' + LF.placeIn(g.run.depth || g.depth) + (() => { const f = (((g.run.depth || g.depth) - 1) % 9) + 1, what = g.loop >= LF.LAST_DEPTH ? 'The Lantern' : 'The shard'; return f < 9 ? '. ' + what + ' lies ' + (9 - f) + (9 - f === 1 ? ' level' : ' levels') + ' below' : '. ' + what + ' was within reach'; })()), W / 2, ty + (NAR ? 38 : 48) * u, NAR ? 14 : 16, '#c9bfae', W - 40 * u, 18, 'italic');
    const y = statRows(g, NAR ? sb + 24 * u : H * 0.3);
    if (g.run.tip) wtxt('Tip: ' + g.run.tip, W / 2, H - (NAR ? 40 : 26) * u, 13, '#a89f90', W - 40 * u, 16, 'italic');
    ctx.globalAlpha = 1;
    const un = g.run.unlocks || [];
    un.forEach((s, i) => txt(s, W / 2, y + 6 * u + i * 22 * u, NAR ? 12.5 : 14, '#ffe08a', 'center', LF.FONT_UI, 'bold'));
    const gap = (NAR ? 8 : 14) * u, bw = Math.min(230 * u, (W - 32 * u - gap * 2) / 3), bh = 48 * u, x0 = (W - bw * 3 - gap * 2) / 2, by = Math.min(H - (NAR ? 116 : 96) * u, y + 14 * u + un.length * 22 * u);
    if (ui.t > 0.6) {
      if (button(NAR ? 'Again' : g.mode === 'vigil' ? 'Stand again' : g.mode === 'rush' ? 'Run it again' : 'Descend again', x0, by, bw, bh)) { ui.daily = g.daily || null; ui.practice = g.practice || null; ui.mode = g.mode; goDescend(g); return; }
      if (button(NAR ? 'Hearth' : 'The Hearth', x0 + bw + gap, by, bw, bh)) { g.state = 'hearth'; ui.enter(g, 'hearth'); return; }
      if (button('Title', x0 + (bw + gap) * 2, by, bw, bh, { back: true })) { g.state = 'title'; ui.enter(g, 'title'); }
    }
    tooltip();
  }
  function win(g) {
    backdrop('#2a1c14');
    const t = ui.t;
    const sun = ctx.createRadialGradient(W / 2, H * 0.9, 0, W / 2, H * 0.9, H * (0.5 + Math.min(1, t * 0.2) * 0.6));
    sun.addColorStop(0, 'rgba(255,236,190,0.9)'); sun.addColorStop(0.4, 'rgba(255,170,90,0.35)'); sun.addColorStop(1, 'rgba(255,120,60,0)');
    ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);
    const ty = NAR ? 80 * u : H * 0.15;
    bigTitle(g.practice ? 'Rehearsed' : g.mode === 'rush' ? 'The Gauntlet Is Run' : g.loop >= LF.LAST_DEPTH ? 'The Vigil Is Kept' : 'A Shard of the Lantern', ty, g.mode === 'rush' || g.loop < LF.LAST_DEPTH ? (NAR ? 34 : 50) : (NAR ? 36 : 60), '#fff2d6');
    const sb = wtxt(g.practice ? (g.run.finalBoss || 'The shadow') + ' is unmade, for now. Nothing was won or lost; below, it is still waiting.' : g.mode === 'rush' ? 'Six great shadows, one lantern, no rest between. The dark will remember this.' : g.loop >= LF.LAST_DEPTH ? 'You set your lantern down inside the Great Lantern and do not take it up again. You were the ember it was waiting for. Far above, in a city that had forgotten the colour, the windows are turning gold.' : g.run.shard ? LF.SHARDS[g.run.shard - 1].name + ' is yours, for this descent and every one after it. ' + LF.SHARDS[g.run.shard - 1].power + ' ' + ['Four more lie', 'Three more lie', 'Two more lie', 'Only the Lantern itself lies'][g.run.shard - 1] + ' below.' : (g.run.finalBoss || 'The shadow') + ' is unmade again. You carry this shard already; the next one lies deeper.', W / 2, ty + (NAR ? 46 : 56) * u, NAR ? 14 : 16, '#f3e2c6', W - 40 * u, 19, 'italic');
    const y = statRows(g, NAR ? sb + 26 * u : H * 0.3);
    const un = g.run.unlocks || [];
    un.forEach((s, i) => txt(s, W / 2, y + 6 * u + i * 22 * u, NAR ? 12.5 : 14, '#7a4a10', 'center', LF.FONT_UI, 'bold'));
    const gap = 12 * u, bw = Math.min(270 * u, (W - 32 * u - gap) / 2), bh = 48 * u, x0 = (W - bw * 2 - gap) / 2, by = Math.min(H - 70 * u, y + 14 * u + un.length * 22 * u);
    if (ui.t > 1) {
      if (g.mode === 'rush') { if (button(NAR ? 'Again' : g.practice ? 'Face it again' : 'Run it again', x0, by, bw, bh, { size: 15 })) { ui.daily = null; ui.practice = g.practice || null; ui.mode = 'rush'; goDescend(g); return; } }
      else if (g.loop < LF.LAST_DEPTH && button(NAR ? 'Deeper (Depth ' + LF.ROMAN[g.loop + 1] + ')' : 'Descend deeper  (Depth ' + LF.ROMAN[g.loop + 1] + ')', x0, by, bw, bh, { size: NAR ? 13 : 15 })) { g.continueDeeper(); return; }
      if (button(NAR ? 'Return' : g.loop >= LF.LAST_DEPTH && g.mode === 'descent' ? 'Let it burn' : 'Return with the light', x0 + bw + gap, by, bw, bh, { size: 15 })) { g.state = 'title'; ui.enter(g, 'title'); LF.audio.intensity = 0; }
    }
    tooltip();
  }
})();
