'use strict';
// Boot + main loop.
(function () {
  function boot() {
    const cv = document.getElementById('game');
    const resize = () => {
      const cw = cv.clientWidth || window.innerWidth, ch = cv.clientHeight || window.innerHeight;
      // cap the backing store near 1080p worth of pixels so weak GPUs keep 60 fps on large or high-density screens
      let dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      while (cw * dpr * ch * dpr > 2.4e6 && dpr > 0.5) dpr *= 0.92;
      cv.width = Math.max(320, Math.floor(cw * dpr));
      cv.height = Math.max(240, Math.floor(ch * dpr));
    };
    resize();
    window.addEventListener('resize', resize);
    if (window.ResizeObserver) new ResizeObserver(resize).observe(cv);
    LF.input.init(cv);
    const g = LF.game = new LF.Game(cv);
    LF.ui.enter(g, 'title');
    let last = performance.now();
    LF.frame = function (dt) {
      g.update(dt);
      if (g.state === 'play' || g.state === 'pause' || g.state === 'relic' || g.state === 'dead') g.renderer.draw();
      LF.ui.draw(g);
      LF.input.endFrame();
      cv.style.cursor = (g.state === 'play' && !LF.input.usingPad()) ? 'none' : 'default';
    };
    function loop(ts) {
      const dt = Math.min(0.05, Math.max(0.001, (ts - last) / 1000));
      last = ts;
      try { LF.frame(dt); LF.errorCount = 0; }
      catch (e) {
        LF.lastError = e && e.stack ? e.stack : String(e);
        LF.errorCount = (LF.errorCount || 0) + 1;
        console.error(e);
        const c = g.ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
        c.fillStyle = 'rgba(60,0,0,0.85)'; c.fillRect(0, 0, cv.width, 60);
        c.fillStyle = '#fff'; c.font = '13px monospace'; c.textAlign = 'left'; c.textBaseline = 'top';
        c.fillText('Error: ' + String(e).slice(0, 160), 10, 10);
        LF.input.endFrame();
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
    // pause when the tab loses focus mid-run
    document.addEventListener('visibilitychange', () => { if (document.hidden && g.demo) g.endDemo();
      else if (document.hidden && g.state === 'play' && !g.bot) { g.state = 'pause'; LF.ui.enter(g, 'pause'); } });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
