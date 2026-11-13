// Dev helper (not part of the game): LF_sheet(kind) paints a contact sheet over the page for a screenshot.
//   LF_sheet('bosses')  - the nine great shadows, lit, at 2.4x, on a mid-dark ground
//   LF_sheet('traps')   - each trap in each of its states
//   LF_sheet('off')     - remove it
window.LF_sheet = function (kind, opt) {
  opt = opt || {};
  const old = document.getElementById('sheet'); if (old) old.remove();
  if (kind === 'off') return 'off';
  const g = LF.game, gc = document.getElementById('game');
  const CW = gc.clientWidth, CH = gc.clientHeight;
  const c = document.createElement('canvas'); c.id = 'sheet'; c.width = CW; c.height = CH;
  c.style.cssText = 'position:fixed;left:0;top:0;z-index:99;background:#17151d;width:' + CW + 'px;height:' + CH + 'px';
  document.body.appendChild(c);
  const x = c.getContext('2d');
  const errs = [];
  if (kind === 'bosses') {
    const ids = opt.ids || ['bell', 'warden', 'angler', 'mother', 'king', 'sexton', 'eclipse', 'choir', 'bearer'];
    const cols = opt.cols || 3, rows = Math.ceil(ids.length / cols), cw = CW / cols, ch = CH / rows;
    if (!g.player) g.startRun(3, { mode: 'rush', practice: 'bell' });
    ids.forEach((id, i) => {
      const cx = (i % cols + 0.5) * cw, cy = (Math.floor(i / cols) + 0.5) * ch;
      try {
        const e = new LF.Enemy(g, id, 0, 0, {});
        e.x = 0; e.y = 0; e.lit = opt.unlit ? false : true; e.spawnT = 0; e.eyeOpen = 1; e.flash = 0; e.face = opt.face === undefined ? 0.4 : opt.face;
        if (opt.state) e.state = opt.state;
        if (opt.hp) e.hp = e.maxHp * opt.hp;
        const sc = opt.sc || Math.min(2.6, Math.min(cw, ch) / (e.r * 5.2));
        x.save(); x.translate(cx, cy); x.scale(sc, sc);
        e.def.draw(e, x, g);
        x.globalCompositeOperation = 'lighter';
        e.drawEyes(x, g);
        if (e.def.drawGlow) e.def.drawGlow(e, x, g);
        x.restore(); x.globalCompositeOperation = 'source-over';
      } catch (err) { errs.push(id + ': ' + String(err && err.stack || err).slice(0, 200)); x.restore(); x.globalCompositeOperation = 'source-over'; }
      x.fillStyle = '#ddd'; x.font = '18px sans-serif'; x.fillText(id, (i % cols) * cw + 10, Math.floor(i / cols) * ch + 24);
    });
  }
  if (kind === 'traps') {
    const subs = ['geyser', 'grasp', 'vent'], lefts = [2.6, 1.4, 0.8, 0.55, 0.3, 0.08], names = ['idle', 'warn early', 'warn late', 'strike 1', 'strike 2', 'strike end'];
    const cw = CW / lefts.length, ch = CH / subs.length;
    x.fillStyle = '#34313c'; x.fillRect(0, 0, CW, CH);
    subs.forEach((sub, r) => lefts.forEach((left, k) => {
      const period = sub === 'vent' ? 4.2 : 3.6, time = 100 * period + (period - left);
      const pr = { kind: 'trap', sub, x: 40 + r * 13, y: 30 + k * 7, period, phase: 0, state: left < 0.65 ? 2 : left < 1.55 ? 1 : 0 };
      const sc = Math.min(3, cw / 90);
      x.save(); x.translate((k + 0.5) * cw, (r + 0.62) * ch); x.scale(sc, sc); x.translate(-pr.x, -pr.y);
      try { LF.drawTrap(x, pr, pr.x, pr.y, time); x.globalCompositeOperation = 'lighter'; LF.glowTrap(x, pr, pr.x, pr.y, time); } catch (err) { errs.push(sub + ': ' + String(err && err.stack || err).slice(0, 200)); }
      x.restore(); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
      x.fillStyle = '#ddd'; x.font = '16px sans-serif'; x.fillText(sub + ' ' + names[k], k * cw + 8, r * ch + 22);
    }));
  }
  return errs.length ? errs : 'ok';
};
