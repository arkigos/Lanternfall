'use strict';
// Input: keyboard + mouse, gamepad, and touch (twin virtual sticks), flattened into one per-frame state object.
(function () {
  const keys = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, rdown: false, pressed: false, rpressed: false, moved: false, wheel: 0 };
  let padPrev = {};
  let canvasRef = null;
  let lastTouch = -1e9; // ms timestamp of the last touch event; mouse events right after it are synthetic

  const BIND = {
    up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
    dash: ['Space', 'ShiftLeft', 'ShiftRight'], flare: ['KeyQ', 'KeyF'], interact: ['KeyE'],
    pause: ['Escape', 'KeyP'], map: ['Tab', 'KeyM'], back: ['Escape', 'Backspace'],
  };
  const anyDown = list => list.some(k => keys.has(k));
  const anyPressed = list => list.some(k => pressed.has(k));

  // touch state: two floating sticks plus on-screen buttons the HUD registers each frame
  const touch = { left: null, right: null, pressed: {}, held: {}, ids: {} };

  const input = LF.input = {
    mouse, keys, pressed, touch,
    mode: 'kbm',            // 'kbm' | 'pad' | 'touch'
    buttons: [],            // [{id, x, y, r}] in canvas pixels, set by the HUD while in touch mode
    init(canvas) {
      canvasRef = canvas;
      window.addEventListener('keydown', e => {
        if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
        if (!e.repeat) pressed.add(e.code);
        keys.add(e.code);
        input.mode = 'kbm';
        if (LF.audio) LF.audio.unlock();
      });
      window.addEventListener('keyup', e => keys.delete(e.code));
      window.addEventListener('blur', () => { keys.clear(); mouse.down = false; mouse.rdown = false; touch.left = null; touch.right = null; });
      const pos = e => {
        const r = canvas.getBoundingClientRect();
        return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
      };
      const synthetic = () => performance.now() - lastTouch < 900;
      canvas.addEventListener('mousemove', e => { if (synthetic()) return; const p = pos(e); mouse.x = p.x; mouse.y = p.y; mouse.moved = true; input.mode = 'kbm'; });
      canvas.addEventListener('mousedown', e => {
        if (synthetic()) return; // synthetic mouse events after a touch
        const p = pos(e); mouse.x = p.x; mouse.y = p.y;
        if (e.button === 0) { mouse.down = true; mouse.pressed = true; }
        if (e.button === 2) { mouse.rdown = true; mouse.rpressed = true; }
        input.mode = 'kbm';
        if (LF.audio) LF.audio.unlock();
        e.preventDefault();
        window.focus();
      });
      window.addEventListener('mouseup', e => {
        if (e.button === 0) mouse.down = false;
        if (e.button === 2) mouse.rdown = false;
      });
      canvas.addEventListener('contextmenu', e => e.preventDefault());
      canvas.addEventListener('wheel', e => { mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });

      // ---- touch ----
      const hitButton = (x, y) => {
        for (const b of input.buttons) if (Math.hypot(x - b.x, y - b.y) <= b.r * 1.25) return b.id;
        return null;
      };
      canvas.addEventListener('touchstart', e => {
        e.preventDefault();
        input.mode = 'touch'; lastTouch = performance.now();
        if (LF.audio) LF.audio.unlock();
        for (const t of e.changedTouches) {
          const p = pos(t);
          mouse.x = p.x; mouse.y = p.y; mouse.pressed = true; mouse.moved = true;
          const b = hitButton(p.x, p.y);
          if (b) { touch.pressed[b] = true; touch.held[b] = true; touch.ids[t.identifier] = b; continue; }
          const stick = { id: t.identifier, ox: p.x, oy: p.y, x: p.x, y: p.y };
          if (p.x < canvas.width * 0.5) { if (!touch.left) touch.left = stick; }
          else if (!touch.right) touch.right = stick;
        }
      }, { passive: false });
      canvas.addEventListener('touchmove', e => {
        e.preventDefault();
        for (const t of e.changedTouches) {
          const p = pos(t);
          if (touch.left && touch.left.id === t.identifier) { touch.left.x = p.x; touch.left.y = p.y; }
          if (touch.right && touch.right.id === t.identifier) { touch.right.x = p.x; touch.right.y = p.y; }
        }
      }, { passive: false });
      const end = e => {
        e.preventDefault(); lastTouch = performance.now();
        for (const t of e.changedTouches) {
          if (touch.left && touch.left.id === t.identifier) touch.left = null;
          if (touch.right && touch.right.id === t.identifier) touch.right = null;
          const b = touch.ids[t.identifier];
          if (b) { delete touch.ids[t.identifier]; touch.held[b] = false; }
        }
      };
      canvas.addEventListener('touchend', end, { passive: false });
      canvas.addEventListener('touchcancel', end, { passive: false });
    },
    isDown: name => anyDown(BIND[name]),
    wasPressed: name => anyPressed(BIND[name]),
    keyPressed: code => pressed.has(code),
    usingPad: () => input.mode !== 'kbm',

    // Build the frame state. Aim is in screen pixels unless a stick gives a direction.
    poll() {
      const s = {
        mx: 0, my: 0, aimX: mouse.x, aimY: mouse.y, aimDir: null,
        fire: mouse.down, flare: mouse.rpressed || anyPressed(BIND.flare), dash: anyPressed(BIND.dash),
        interact: anyPressed(BIND.interact), pause: anyPressed(BIND.pause), map: anyPressed(BIND.map),
        click: mouse.pressed, rclick: mouse.rpressed,
        uiUp: pressed.has('ArrowUp') || pressed.has('KeyW'), uiDown: pressed.has('ArrowDown') || pressed.has('KeyS'),
        uiLeft: pressed.has('ArrowLeft') || pressed.has('KeyA'), uiRight: pressed.has('ArrowRight') || pressed.has('KeyD'),
        confirm: pressed.has('Enter') || pressed.has('Space') || pressed.has('KeyE'), back: anyPressed(BIND.back),
        mouseMoved: mouse.moved, wheel: mouse.wheel, reroll: pressed.has('KeyR'),
      };
      if (anyDown(BIND.left)) s.mx -= 1;
      if (anyDown(BIND.right)) s.mx += 1;
      if (anyDown(BIND.up)) s.my -= 1;
      if (anyDown(BIND.down)) s.my += 1;

      // gamepad
      // a sandboxed frame may forbid the gamepad API outright; never let that break the frame
      let pads = [];
      if (!input.noPads) { try { pads = navigator.getGamepads ? navigator.getGamepads() : []; } catch (e) { input.noPads = true; } }
      const gp = pads && Array.from(pads).find(p => p && p.connected);
      if (gp) {
        const dz = v => Math.abs(v) < 0.22 ? 0 : v;
        const lx = dz(gp.axes[0] || 0), ly = dz(gp.axes[1] || 0), rx = dz(gp.axes[2] || 0), ry = dz(gp.axes[3] || 0);
        const b = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
        const bp = i => b(i) && !padPrev[i];
        if (lx || ly || rx || ry || gp.buttons.some(x => x.pressed)) input.mode = 'pad';
        if (input.mode === 'pad') {
          if (lx || ly) { s.mx = lx; s.my = ly; }
          if (rx || ry) { s.aimDir = Math.atan2(ry, rx); s.fire = true; input.lastPadAim = s.aimDir; }
          else if (lx || ly) { s.aimDir = input.lastPadAim = Math.atan2(ly, lx); }
          else if (input.lastPadAim !== undefined) s.aimDir = input.lastPadAim;
          else s.aimDir = 0;
          if (b(7)) s.fire = true;
          if (bp(0) || bp(5)) s.dash = true;
          if (bp(1) || bp(6) || bp(4)) s.flare = true;
          if (bp(2)) s.interact = true;
          if (bp(9)) s.pause = true;
          if (bp(8)) s.map = true;
          if (bp(0)) s.confirm = true;
          if (bp(1)) s.back = true;
          if (bp(3)) s.reroll = true;
          if (bp(12)) s.uiUp = true;
          if (bp(13)) s.uiDown = true;
          if (bp(14)) s.uiLeft = true;
          if (bp(15)) s.uiRight = true;
          const ny = ly > 0.6 ? 1 : ly < -0.6 ? -1 : 0, nx = lx > 0.6 ? 1 : lx < -0.6 ? -1 : 0;
          if (ny !== (padPrev.ny || 0)) { if (ny > 0) s.uiDown = true; if (ny < 0) s.uiUp = true; }
          if (nx !== (padPrev.nx || 0)) { if (nx > 0) s.uiRight = true; if (nx < 0) s.uiLeft = true; }
          padPrev.ny = ny; padPrev.nx = nx;
        }
        for (let i = 0; i < gp.buttons.length; i++) padPrev[i] = b(i);
      }

      // touch sticks
      if (input.mode === 'touch') {
        s.fire = false;
        const reach = Math.max(36, (canvasRef ? canvasRef.height : 600) * 0.09);
        if (touch.left) {
          const dx = touch.left.x - touch.left.ox, dy = touch.left.y - touch.left.oy, l = Math.hypot(dx, dy);
          if (l > reach * 0.15) { const k = Math.min(1, l / reach) / l; s.mx = dx * k; s.my = dy * k; }
          // let the stick origin follow a thumb that drags far
          if (l > reach * 1.4) { touch.left.ox += dx / l * (l - reach * 1.4); touch.left.oy += dy / l * (l - reach * 1.4); }
        }
        if (touch.right) {
          const dx = touch.right.x - touch.right.ox, dy = touch.right.y - touch.right.oy, l = Math.hypot(dx, dy);
          if (l > reach * 0.2) { s.aimDir = Math.atan2(dy, dx); s.fire = true; input.lastAim = s.aimDir; }
          else if (input.lastAim !== undefined) s.aimDir = input.lastAim;
        } else if (input.lastAim !== undefined) s.aimDir = input.lastAim;
        else s.aimDir = 0;
        if (touch.pressed.dash) s.dash = true;
        if (touch.pressed.flare) s.flare = true;
        if (touch.pressed.interact) s.interact = true;
        if (touch.pressed.pause) s.pause = true;
        if (touch.pressed.map) s.map = true;
      }
      const l = Math.hypot(s.mx, s.my);
      if (l > 1) { s.mx /= l; s.my /= l; }
      return s;
    },
    endFrame() {
      pressed.clear();
      mouse.pressed = false; mouse.rpressed = false; mouse.moved = false; mouse.wheel = 0;
      touch.pressed = {};
    },
  };
})();
