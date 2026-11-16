'use strict';
// Shadow creatures. Each type is a definition (stats + update + draw); Enemy wraps the shared state.
(function () {
  const fx = LF.fx, TAU = LF.TAU;
  const tmp = { x: 0, y: 0 };
  const BODY = '#0c0916', BODY_LIT = '#171026', RIM = 'rgba(160,120,235,0.55)';

  const AFFIXES = ['swift', 'umbral', 'splitting', 'volatile', 'hexed', 'frenzied', 'leeching', 'warded'];
  const AFFIX_NAME = { swift: 'Swift', umbral: 'Umbral', splitting: 'Brooding', volatile: 'Volatile', hexed: 'Hexed', frenzied: 'Frenzied', leeching: 'Leeching', warded: 'Warded' };

  class Enemy {
    constructor(g, type, x, y, opts = {}) {
      const d = DEFS[type];
      this.def = d; this.type = type; this.x = x; this.y = y; this.vx = 0; this.vy = 0;
      this.elite = !!opts.elite; this.boss = !!d.boss;
      this.affix = this.elite ? LF.pick(AFFIXES) : null;
      const hpMul = g.enemyHpMul * (opts.hpMul || 1), dmgMul = g.enemyDmgMul;
      this.r = d.r * (this.elite ? 1.22 : 1);
      this.maxHp = d.hp * (this.boss ? g.bossHpMul : hpMul) * (this.elite ? 2.6 : 1);
      this.hp = this.maxHp;
      this.dmg = d.dmg * (this.boss ? (g.bossDmgMul || dmgMul) : dmgMul) * (this.elite ? 1.25 : 1);
      this.speed = d.speed * (this.affix === 'swift' ? 1.35 : 1) * (this.boss ? 1 : (g.enemySpeedMul || 1));
      this.state = 'idle'; this.t = 0; this.cd = LF.rand(0.6, 1.6);
      this.awake = !!opts.awake; this.lit = false; this.stun = 0; this.burn = 0; this.burnDps = 0;
      this.chill = 0; this.shackle = 0; this.glow = 0; this.waxedT = 0; this.setCd = 0; this.mark = 0; this.flash = 0; this.kx = 0; this.ky = 0; this.contactCd = 0;
      this.spawnT = opts.spawnT || 0; this.spawnMax = this.spawnT || 1;
      this.wob = Math.random() * TAU; this.face = Math.random() * TAU; this.dir = LF.chance(0.5) ? 1 : -1;
      this.room = opts.room === undefined ? null : opts.room; this.wave = opts.wave || 0;
      this.dotAcc = 0; this.dotT = 0; this.intangible = false; this.eyeOpen = this.awake ? 1 : 0;
      this.noDrops = !!opts.noDrops; this.parent = opts.parent || null; this.dead = false; this.age = 0;
      this.red = 0; // eyes flare red while attacking
      this.frenzy = 0; this.counted = !!opts.counted;
      this.name = (this.affix ? AFFIX_NAME[this.affix] + ' ' : '') + d.name;
      if (d.init) d.init(this, g);
    }
    wake(g) {
      if (this.awake) return;
      this.awake = true;
      if (this.def.onWake) this.def.onWake(this, g);
    }
    // slows that apply even to scripted dashes
    slowMul(g) {
      let m = this.chill > 0 ? 1 - g.player.stats.waxSlow * (this.boss ? 0.5 : 1) : 1;
      if (g.player.stats.lastLight && g.player.frac() < 0.25) m *= 0.65;
      return m;
    }
    speedMod(g) {
      let m = this.lit ? 0.9 : 1.1;
      if (this.chill > 0) m *= 1 - g.player.stats.waxSlow * (this.boss ? 0.5 : 1);
      if (this.frenzy > 0) m *= 1.35;
      if (g.player.stats.lastLight && g.player.frac() < 0.25) m *= 0.65;
      return m;
    }
    update(dt, g) {
      const p = g.player, d = this.def;
      this.age += dt;
      if (this.spawnT > 0) { this.spawnT -= dt; return; }
      // lit by the lantern, a fire or a flare; or carrying a light of its own (a bolt of light, a moth's bite, glowing wax, a lamp chain)
      const ps = p.stats;
      let lit = g.isLit(this.x, this.y);
      this.selfGlow = false;
      if (lit) { if (ps.glowKeep) this.glow = Math.max(this.glow, ps.glowKeep); }
      else if (this.glow > 0 || (ps.waxGlow && this.chill > 0) || (ps.chainLight && this.shackle > 0)) { lit = true; this.selfGlow = true; g.litDepth = 0.35; g.litByFire = false; }
      this.lit = !!d.selfLit || lit;
      this.depth = lit ? (g.litDepth || 0) : 0; // how deep in the bearer's light it stands (Keen Light)
      const fireOnly = g.litByFire;
      // Half strength at the rim of the light, about 1.6 times at the flame itself.
      const searDepth = 0.5 + 1.1 * (g.litDepth || 0);
      if (!this.awake) {
        const dist = LF.dist(this.x, this.y, p.x, p.y);
        const hush = p.stats.stealth || 1; // a hooded lantern is noticed from half as far
        if (dist < 330 * hush && (dist < 90 * hush || g.map.los(this.x, this.y, p.x, p.y))) this.wake(g);
        else return;
      }
      this.eyeOpen = Math.min(1, this.eyeOpen + dt * 4);
      // Light sears: anything standing in the lantern's glow or a flare's afterlight smoulders.
      // A brazier or wall lamp on its own only does so with the Tinderbox.
      // The glow is weaker as the flame runs low, so losing light makes every fight slower.
      // (a creature with a light of its own, a votive or a lure, is always seen, but it is seared only where the
      // bearer's light really reaches it, like anything else: its own glow does not burn it)
      if (lit && !this.intangible && p.stats.sear > 0 && !p.dead && (fireOnly ? p.stats.brazierBurn : p.stats.searOn)) {
        g.damageEnemy(this, 10 * p.stats.sear * (ps.lensFocus ? 1 + (ps.lensFocus - 1) * (g.litDepth || 0) : 1) * (p.noonT > 0 ? 3 : 1) * (1 + p.stats.searFlat / 4) * (p.stats.waxGlow && this.chill > 0 ? 2 : 1) * searDepth * (0.4 + 0.6 * Math.min(1, p.frac())) * dt, { type: 'sear', quiet: true, sear: true, noShroud: true });
        if (this.dead) return;
        if (p.stats.noon && searDepth > 0.95 && !(this.burn > 0)) g.ignite(this, p.stats.burnBase);
        if (Math.random() < dt * 1.3) LF.audio.play('sizzle');
        if (Math.random() < dt * 5 * searDepth) fx.spawn({ x: this.x + LF.rand(-this.r, this.r) * 0.7, y: this.y + LF.rand(-this.r, this.r) * 0.7, vx: LF.rand(-10, 10), vy: -34, life: 0.45, size: 1.6, color: '#ff9a40', drag: 1 });
      }
      this.flash = Math.max(0, this.flash - dt * 6); this.mark -= dt; this.chill -= dt; this.glow -= dt; this.setCd -= dt; this.contactCd -= dt;
      // wax scalds while it holds; the rest here are the rare relics that carry wax and chain into chain, and into fire
      if (this.chill > 0) {
        this.waxedT += dt;
        g.damageEnemy(this, ps.waxDmg * ps.waxMul * (ps.cure ? 1 + ps.cure * Math.min(this.waxedT, ps.waxTime, 12) : 1) * (ps.poolMul > 1 && g.time - (this.pooled || -9) < 0.25 ? ps.poolMul : 1) * dt, { type: 'wax', quiet: true, noShroud: true }); // (Slow Set: hotter for every second it has held) if (this.dead) return;
        if (ps.waxBurn) { g.damageEnemy(this, 7 * ps.waxBurn * dt, { type: 'burn', quiet: true, noShroud: true }); if (this.dead) return; if (Math.random() < dt * 8) fx.spawn({ x: this.x + LF.rand(-this.r, this.r) * 0.6, y: this.y - this.r, vy: -36, life: 0.4, size: 2, color: LF.pick(['#ff9a3d', '#ffd28a']) }); }
        if (ps.waxSet && this.waxedT > 2 && this.setCd <= 0) { this.setCd = 7; g.shackle(this, 2.5); }
      } else this.waxedT = 0;
      if (this.shackle > 0) {
        this.shackle -= dt;
        if (ps.chainBurn) { g.damageEnemy(this, 7 * dt, { type: 'burn', quiet: true, noShroud: true }); if (this.dead) return; if (Math.random() < dt * 8) fx.spawn({ x: this.x + LF.rand(-this.r, this.r) * 0.6, y: this.y + LF.rand(-this.r, this.r) * 0.6, vy: -36, life: 0.4, size: 2, color: '#ff7b2e' }); }
      }
      this.red = Math.max(0, this.red - dt * 2); this.frenzy -= dt;
      if (this.affix === 'frenzied') this.frenzy = 1;
      if (this.wardBroken > 0) this.wardBroken -= dt;
      if (this.burn > 0) {
        this.burn -= dt; this.burnAge = (this.burnAge || 0) + dt;
        // Slow Burn: a burn is hotter for every second it has burned, up to as long as the lantern's burns last
        g.damageEnemy(this, this.burnDps * (ps.slowBurn ? 1 + ps.slowBurn * Math.min(this.burnAge, ps.burnTime, 12) : 1) * dt, { type: 'burn', quiet: true, noShroud: true });
        // fire catches (with Catching Fire, or Conflagration): every so often a burning creature sets alight whatever stands close beside it
        this.catchT = (this.catchT || 0) - dt;
        if (this.catchT <= 0 && !this.dead && (ps.catching || ps.conflag)) { this.catchT = LF.TUNE.catchT / (ps.catchFast || 1); g.spreadFire(this); }
        if (Math.random() < dt * 18) fx.spawn({ x: this.x + LF.rand(-this.r, this.r), y: this.y + LF.rand(-this.r, this.r), vy: -40, life: 0.4, size: 2.4, color: LF.pick(['#ff7b2e', '#ffc24d']) });
        if (this.dead) return;
      } else this.burnAge = 0;
      if (this.dotT > 0) { this.dotT -= dt; if (this.dotT <= 0 && this.dotAcc >= 1) { fx.text(this.x + LF.rand(-6, 6), this.y - this.r - 6, String(Math.round(this.dotAcc)), '#ffb36b', 10, 0.6); this.dotAcc = 0; } }
      // knockback
      if (this.kx || this.ky) {
        this.x += this.kx * dt; this.y += this.ky * dt;
        const k = Math.max(0, 1 - 7 * dt); this.kx *= k; this.ky *= k;
        if (Math.abs(this.kx) + Math.abs(this.ky) < 4) { this.kx = 0; this.ky = 0; }
        if (!d.ghost) g.map.resolveCircle(this, this.r);
      }
      if (this.stun > 0 && d.noStun) this.stun = 0; // part of a great shadow: nothing stuns it
      if (this.stun > 0) { this.stun -= dt; this.holdShackle(g); return; }
      d.update(this, g, dt);
      if (this.dead) return;
      this.holdShackle(g);
      // touching the player
      if (d.contact !== false && !this.intangible && !p.dead) {
        const rr = this.r + p.r - 2, d2 = LF.dist2(this.x, this.y, p.x, p.y);
        if (d2 < rr * rr) {
          if (this.contactCd <= 0 && p.dashing <= 0) {
            this.contactCd = 0.75;
            if (d.onTouch) d.onTouch(this, g);
            else if (p.invuln <= 0) {
              g.hurtPlayer(this.dmg, { x: this.x, y: this.y, enemy: this });
              if (this.affix === 'leeching') { this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.2); fx.text(this.x, this.y - this.r - 14, 'LEECHED', '#ff8a8a', 10, 0.8); }
              if (this.affix === 'hexed') { p.flareT = Math.max(p.flareT, 3); p.dashT = Math.max(p.dashT, 1.2); g.hint('Hexed! Your flare gutters'); }
            }
            const th = p.stats.thorns;
            if (th && !this.dead) { g.damageEnemy(this, 40 * th, { type: 'thorns', noShroud: true }); if (!this.boss) this.stun = Math.max(this.stun, 0.8); }
          }
          // never overlap the player
          if (!this.boss && !this.dead) {
            const dd = Math.sqrt(d2) || 1, push = (rr - dd) * 0.5;
            this.x += (this.x - p.x) / dd * push; this.y += (this.y - p.y) / dd * push;
          }
        }
      }
    }
    // A shackled creature cannot go farther than its chain allows: from the stake where it was caught, or from the
    // player when the chains are fastened to the lantern.
    holdShackle(g) {
      if (!(this.shackle > 0) || this.boss || !this.anchor) return;
      const p = g.player, ax = this.onLeash ? p.x : this.anchor.x, ay = this.onLeash ? p.y : this.anchor.y;
      const L = this.onLeash ? (this.haulL || (p.stats.chainGuard && p.guardR) || 110) : p.stats.leash, dx = this.x - ax, dy = this.y - ay, dd = Math.hypot(dx, dy);
      if (dd > L) { this.x = ax + dx / dd * L; this.y = ay + dy / dd * L; if (!this.def.ghost) g.map.resolveCircle(this, this.r); }
    }
    draw(ctx, g) {
      const d = this.def;
      if (this.spawnT > 0) {
        const k = 1 - this.spawnT / this.spawnMax;
        ctx.fillStyle = 'rgba(8,4,16,0.85)';
        ctx.beginPath(); ctx.ellipse(this.x, this.y + 3, this.r * (0.6 + k), this.r * (0.3 + k * 0.4), 0, 0, TAU); ctx.fill();
        ctx.save(); ctx.translate(this.x, this.y); ctx.scale(k, k); ctx.translate(-this.x, -this.y);
        ctx.globalAlpha = k;
        d.draw(this, ctx, g);
        ctx.restore(); ctx.globalAlpha = 1;
        return;
      }
      if (!this.awake && !d.boss) {
        // dormant: a still dark heap
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(this.x, this.y + this.r * 0.6, this.r, this.r * 0.4, 0, 0, TAU); ctx.fill();
      }
      d.draw(this, ctx, g);
      if (this.mark > 0) {
        ctx.strokeStyle = 'rgba(201,167,255,0.8)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.r + 5, g.time * 3, g.time * 3 + 4.4); ctx.stroke();
      }
      if (this.frenzy > 0) {
        ctx.strokeStyle = 'rgba(255,150,80,0.7)'; ctx.lineWidth = 1.5;
        for (let i = 0; i < 3; i++) { const a = g.time * 6 + i * 2.1; ctx.beginPath(); ctx.arc(this.x, this.y, this.r + 4, a, a + 0.7); ctx.stroke(); }
      }
      if (this.chill > 0) { ctx.fillStyle = 'rgba(240,226,192,0.32)'; ctx.beginPath(); ctx.arc(this.x, this.y, this.r + 2, 0, TAU); ctx.fill(); }
      if (this.shackle > 0) {
        ctx.strokeStyle = 'rgba(217,176,112,0.9)'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
        if (!this.boss && this.anchor) {
          const pl = g.player, ax = this.onLeash ? pl.x : this.anchor.x, ay = this.onLeash ? pl.y : this.anchor.y;
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(this.x, this.y); ctx.stroke();
          if (!this.onLeash) { ctx.setLineDash([]); ctx.fillStyle = 'rgba(217,176,112,0.9)'; ctx.fillRect(ax - 2.5, ay - 2.5, 5, 5); ctx.setLineDash([5, 4]); }
        }
        ctx.beginPath(); ctx.arc(this.x, this.y, this.r + 3, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      }
      if (this.elite) {
        ctx.strokeStyle = 'rgba(255,90,90,0.5)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 5]);
        ctx.beginPath(); ctx.arc(this.x, this.y, this.r + 7, -g.time, -g.time + TAU); ctx.stroke(); ctx.setLineDash([]);
      }
      // hp bar
      if (!this.boss && !d.noBar && this.hp < this.maxHp && this.lit && !this.intangible) {
        const w = Math.max(18, this.r * 2), x = this.x - w / 2, y = this.y - this.r - 9;
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - 1, y - 1, w + 2, 5);
        ctx.fillStyle = this.elite ? '#ff6b6b' : '#c9a0ff'; ctx.fillRect(x, y, w * Math.max(0, this.hp / this.maxHp), 3);
      }
    }
    // Eyes glow through the dark: drawn after the darkness pass.
    drawEyes(ctx, g) {
      const d = this.def;
      if (this.spawnT > 0 || this.eyeOpen <= 0 || (d.hideEyes && d.hideEyes(this))) return;
      const eyes = d.eyes; if (!eyes) return;
      const c = Math.cos(this.face), s = Math.sin(this.face), sc = this.r / d.r;
      const blink = (Math.sin(g.time * 0.9 + this.wob * 3) > 0.985) ? 0.15 : 1;
      const open = this.eyeOpen * blink;
      let col = this.elite ? '255,110,90' : (d.eyeColor || '201,160,255');
      if (this.red > 0) col = '255,70,70';
      for (const [ex, ey, er] of eyes) {
        const x = this.x + (ex * c - ey * s) * sc, y = this.y + (ex * s + ey * c) * sc, r = er * sc;
        const gr = ctx.createRadialGradient(x, y, 0, x, y, r * 3.2);
        gr.addColorStop(0, `rgba(${col},${0.9 * open})`); gr.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r * 3.2, 0, TAU); ctx.fill();
        ctx.fillStyle = `rgba(255,255,255,${0.95 * open})`;
        ctx.beginPath(); ctx.ellipse(x, y, r, r * open, this.face, 0, TAU); ctx.fill();
      }
    }
  }
  LF.Enemy = Enemy;

  // ---------- shared behaviour helpers ----------
  // Direction toward the player: straight if visible, otherwise down the flow field.
  function chaseDir(e, g, out) {
    const p = g.player;
    if (g.map.los(e.x, e.y, p.x, p.y)) {
      const dx = p.x - e.x, dy = p.y - e.y, l = Math.hypot(dx, dy) || 1;
      out.x = dx / l; out.y = dy / l; out.los = true; out.d = l;
      return out;
    }
    out.los = false; out.d = LF.dist(e.x, e.y, p.x, p.y);
    if (!g.map.flowDir(e.x, e.y, out)) { const dx = p.x - e.x, dy = p.y - e.y, l = Math.hypot(dx, dy) || 1; out.x = dx / l; out.y = dy / l; }
    return out;
  }
  function move(e, g, dt, dx, dy, speed, accel = 8) {
    const sp = speed * e.speedMod(g) * (g.map.waterAt(e.x, e.y) && !e.def.flies ? 0.88 : 1);
    const k = Math.min(1, dt * accel);
    e.vx += (dx * sp - e.vx) * k; e.vy += (dy * sp - e.vy) * k;
    e.x += e.vx * dt; e.y += e.vy * dt;
    if (!e.def.ghost) return g.map.resolveCircle(e, e.r);
    return false;
  }
  function facePlayer(e, g, dt, rate = 8) {
    const p = g.player;
    e.face = LF.turnToward(e.face, Math.atan2(p.y - e.y, p.x - e.x), rate * dt);
  }
  function blob(ctx, x, y, r, t, amp, lobes, seed) {
    ctx.beginPath();
    const N = 14;
    for (let i = 0; i <= N; i++) {
      const a = i / N * TAU, rr = r * (1 + amp * Math.sin(a * lobes + t + seed) + amp * 0.5 * Math.sin(a * (lobes + 2) - t * 1.3 + seed));
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }
  function bodyStyle(ctx, e) {
    ctx.fillStyle = e.flash > 0 ? '#ffffff' : (e.lit ? BODY_LIT : BODY);
    ctx.strokeStyle = e.elite ? 'rgba(255,100,100,0.6)' : RIM; ctx.lineWidth = 1.4;
  }
  function shadow(ctx, e, k = 1) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * 0.7, e.r * k, e.r * 0.4 * k, 0, 0, TAU); ctx.fill();
  }
  // keep a preferred distance from the player (ranged enemies)
  function kite(e, g, dt, near, far, speed) {
    const c = chaseDir(e, g, tmp);
    let dx = c.x, dy = c.y;
    if (c.los) {
      if (c.d < near) { dx = -c.x; dy = -c.y; }
      else if (c.d < far) { const tx = -c.y * e.dir, ty = c.x * e.dir; dx = tx * 0.55; dy = ty * 0.55; }
    }
    const hit = move(e, g, dt, dx, dy, speed);
    if (hit && c.los && c.d < far && Math.random() < dt * 3) e.dir *= -1;
    return c;
  }

  LF.EH = { chaseDir, move, facePlayer, blob, bodyStyle, shadow, kite };

  // ---------- definitions ----------
  const DEFS = LF.ENEMY_DEFS = {
    skitter: {
      name: 'Skitter', hp: 16, speed: 130, r: 9, dmg: 6, embers: 0.9, glass: 0.5,
      eyes: [[4, -3, 1.5], [4, 3, 1.5]],
      update(e, g, dt) {
        const c = chaseDir(e, g, tmp);
        const w = Math.sin(g.time * 7 + e.wob) * 0.55;
        move(e, g, dt, c.x - c.y * w, c.y + c.x * w, e.speed);
        e.face = LF.turnToward(e.face, Math.atan2(e.vy, e.vx), 12 * dt);
      },
      draw(e, ctx, g) {
        shadow(ctx, e);
        ctx.strokeStyle = e.lit ? '#2a1d45' : '#120c20'; ctx.lineWidth = 1.6;
        for (let i = 0; i < 6; i++) {
          const side = i < 3 ? 1 : -1, k = (i % 3) - 1;
          const a = e.face + side * (1.2 + k * 0.5) + Math.sin(g.time * 22 + i * 2 + e.wob) * 0.25;
          ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(a) * e.r * 1.7, e.y + Math.sin(a) * e.r * 1.7); ctx.stroke();
        }
        bodyStyle(ctx, e); blob(ctx, e.x, e.y, e.r, g.time * 8, 0.09, 3, e.wob); ctx.fill(); if (e.lit) ctx.stroke();
      },
    },

    moth: {
      name: 'Gloom Moth', hp: 7, speed: 150, r: 6, dmg: 4, embers: 0.5, glass: 0.15, flies: true,
      eyes: [[2, 0, 1.3]], eyeColor: '196,120,255',
      update(e, g, dt) {
        const c = chaseDir(e, g, tmp);
        const w = Math.sin(g.time * 9 + e.wob) * 1.1;
        move(e, g, dt, c.x - c.y * w, c.y + c.x * w, e.speed, 5);
        e.face = Math.atan2(e.vy, e.vx);
      },
      onTouch(e, g) {
        const p = g.player;
        if (p.invuln > 0) return;
        g.hurtPlayer(e.dmg, { x: e.x, y: e.y, steal: true, enemy: e });
        LF.audio.play('steal');
        fx.burst(e.x, e.y, 8, { color: '#2a1840', speed1: 90, life: 0.4, glow: false });
        e.noDrops = true; g.killEnemy(e, { type: 'self' });
      },
      draw(e, ctx, g) {
        const flap = Math.sin(g.time * 34 + e.wob);
        ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.face);
        ctx.fillStyle = e.flash > 0 ? '#fff' : (e.lit ? '#2b2140' : '#120c20');
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-5, -9 * (0.4 + 0.6 * Math.abs(flap))); ctx.lineTo(4, -3); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-5, 9 * (0.4 + 0.6 * Math.abs(flap))); ctx.lineTo(4, 3); ctx.closePath(); ctx.fill();
        ctx.fillStyle = e.flash > 0 ? '#fff' : '#0b0814'; ctx.beginPath(); ctx.ellipse(0, 0, 5, 2, 0, 0, TAU); ctx.fill();
        ctx.restore();
      },
    },

    lurker: {
      name: 'Lurker', hp: 38, speed: 96, r: 12, dmg: 12, embers: 1.6, glass: 1.2,
      eyes: [[6, -3.5, 1.7], [6, 3.5, 1.7]],
      init(e) { e.state = 'stalk'; e.t = LF.rand(1.2, 2.6); e.lunges = 0; },
      update(e, g, dt) {
        const p = g.player;
        e.t -= dt;
        if (e.state === 'stalk') {
          const c = chaseDir(e, g, tmp);
          let dx = c.x, dy = c.y;
          if (c.los) {
            const ring = Math.max(p.lightR + 24, 120);
            const err = c.d - ring;
            const radial = LF.clamp(err / 60, -1, 1);
            dx = c.x * radial - c.y * e.dir * 0.8; dy = c.y * radial + c.x * e.dir * 0.8;
            const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
            if (e.t <= 0 && c.d < ring + 110) { e.state = 'windup'; e.t = 0.45; LF.audio.play('telegraph'); }
          }
          if (move(e, g, dt, dx, dy, e.speed) && Math.random() < dt * 4) e.dir *= -1;
          facePlayer(e, g, dt);
        } else if (e.state === 'windup') {
          e.red = 1; facePlayer(e, g, dt, 14);
          e.vx *= 0.8; e.vy *= 0.8;
          if (e.t <= 0) { e.state = 'lunge'; e.t = 0.42; e.lx = Math.cos(e.face); e.ly = Math.sin(e.face); LF.audio.play('lunge'); }
        } else if (e.state === 'lunge') {
          e.red = 1;
          { const sm = e.slowMul(g); e.vx = e.lx * 440 * sm; e.vy = e.ly * 440 * sm; }
          e.x += e.vx * dt; e.y += e.vy * dt;
          const hit = g.map.resolveCircle(e, e.r);
          if (Math.random() < 0.6) fx.spawn({ x: e.x, y: e.y, life: 0.3, size: 5, color: '#1a1030', glow: false, drag: 3 });
          if (e.t <= 0 || hit) {
            e.lunges++;
            if (e.elite && e.lunges % 2 === 1) { e.state = 'windup'; e.t = 0.3; }
            else { e.state = 'recover'; e.t = 0.85; }
          }
        } else {
          e.vx *= 0.85; e.vy *= 0.85; e.x += e.vx * dt; e.y += e.vy * dt; g.map.resolveCircle(e, e.r);
          if (e.t <= 0) { e.state = 'stalk'; e.t = LF.rand(1.3, 2.6); e.dir *= -1; }
        }
      },
      draw(e, ctx, g) {
        shadow(ctx, e, 1.2);
        ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.face);
        const sh = e.state === 'windup' ? LF.rand(-1.2, 1.2) : 0;
        ctx.translate(sh, sh);
        bodyStyle(ctx, e);
        const st = e.state === 'lunge' ? 1.5 : 1;
        ctx.beginPath(); ctx.moveTo(e.r * 1.15 * st, 0);
        ctx.quadraticCurveTo(e.r * 0.2, -e.r * 1.15, -e.r * 1.5 * st, -e.r * 0.25);
        ctx.lineTo(-e.r * 2.1 * st, Math.sin(g.time * 8 + e.wob) * 3);
        ctx.lineTo(-e.r * 1.5 * st, e.r * 0.25);
        ctx.quadraticCurveTo(e.r * 0.2, e.r * 1.15, e.r * 1.15 * st, 0);
        ctx.fill(); if (e.lit) ctx.stroke();
        // claws
        ctx.strokeStyle = e.lit ? '#3a2860' : '#150e24'; ctx.lineWidth = 2;
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(e.r * 0.4, s * e.r * 0.8); ctx.quadraticCurveTo(e.r * 1.3, s * e.r * 1.3, e.r * 1.6, s * e.r * 0.5); ctx.stroke(); }
        ctx.restore();
      },
    },

    spitter: {
      name: 'Spitter', hp: 26, speed: 82, r: 11, dmg: 8, embers: 1.5, glass: 1.2,
      eyes: [[5, -4, 1.4], [6.5, 0, 1.6], [5, 4, 1.4]],
      init(e) { e.cd = LF.rand(0.8, 2); },
      update(e, g, dt) {
        const p = g.player;
        e.cd -= dt;
        if (e.state === 'aim') {
          e.t -= dt; e.red = 1; e.vx *= 0.8; e.vy *= 0.8; facePlayer(e, g, dt, 10);
          if (e.t <= 0) {
            e.state = 'idle'; e.cd = LF.rand(1.8, 2.6);
            const a = Math.atan2(p.y + p.vy * 0.25 - e.y, p.x + p.vx * 0.25 - e.x);
            const shots = e.elite ? [-0.22, 0, 0.22] : [0];
            for (const o of shots) g.fireEnemyBullet({ x: e.x + Math.cos(a) * e.r, y: e.y + Math.sin(a) * e.r, angle: a + o, speed: 205, dmg: e.dmg, size: 5 });
            LF.audio.play('spit'); e.kx = -Math.cos(a) * 60; e.ky = -Math.sin(a) * 60;
          }
          return;
        }
        const c = kite(e, g, dt, 150, 290, e.speed);
        facePlayer(e, g, dt);
        if (c.los && c.d < 430 && e.cd <= 0) { e.state = 'aim'; e.t = 0.4; }
      },
      draw(e, ctx, g) {
        shadow(ctx, e);
        bodyStyle(ctx, e);
        const puff = e.state === 'aim' ? 1 + (0.4 - e.t) * 0.5 : 1;
        blob(ctx, e.x, e.y, e.r * puff, g.time * 4, 0.07, 4, e.wob); ctx.fill(); if (e.lit) ctx.stroke();
        // maw
        ctx.fillStyle = e.state === 'aim' ? '#b26bff' : '#2a1a48';
        ctx.beginPath(); ctx.arc(e.x + Math.cos(e.face) * e.r * 0.75, e.y + Math.sin(e.face) * e.r * 0.75, e.r * 0.34 * puff, 0, TAU); ctx.fill();
      },
    },

    bloat: {
      name: 'Gloom Bloat', hp: 52, speed: 58, r: 15, dmg: 10, embers: 2, glass: 1.5,
      eyes: [[6, -5, 1.8], [8, 2, 2.2]],
      update(e, g, dt) {
        const c = chaseDir(e, g, tmp);
        if (e.state === 'fuse') {
          e.t -= dt; e.red = 1; e.vx *= 0.9; e.vy *= 0.9;
          if (e.t <= 0) { e.noDrops = true; g.killEnemy(e, { type: 'self' }); }
          return;
        }
        move(e, g, dt, c.x, c.y, e.speed);
        facePlayer(e, g, dt, 3);
        if (c.d < 62 && c.los) { e.state = 'fuse'; e.t = 0.6; LF.audio.play('telegraph'); }
      },
      onDeath(e, g) { LF.bloatBurst(g, e.x, e.y, e.dmg, e.elite ? 1.3 : 1); },
      draw(e, ctx, g) {
        shadow(ctx, e, 1.2);
        const pulse = e.state === 'fuse' ? 1 + Math.sin(g.time * 40) * 0.08 + (0.6 - e.t) * 0.4 : 1 + Math.sin(g.time * 2.5 + e.wob) * 0.05;
        bodyStyle(ctx, e);
        if (e.state === 'fuse' && Math.floor(g.time * 20) % 2) ctx.fillStyle = '#5a2a8a';
        blob(ctx, e.x, e.y, e.r * pulse, g.time * 2, 0.08, 3, e.wob); ctx.fill(); if (e.lit) ctx.stroke();
        ctx.fillStyle = e.lit ? '#3b2466' : '#1a1030';
        for (let i = 0; i < 4; i++) { const a = e.wob + i * 1.7; ctx.beginPath(); ctx.arc(e.x + Math.cos(a) * e.r * 0.5, e.y + Math.sin(a) * e.r * 0.5, e.r * 0.22, 0, TAU); ctx.fill(); }
      },
    },

    bulwark: {
      name: 'Bulwark', hp: 125, speed: 60, r: 17, dmg: 14, embers: 3, glass: 3,
      eyes: [[7, -4, 1.6], [7, 4, 1.6]],
      init(e) { e.state = 'walk'; e.cd = LF.rand(1.5, 3); },
      update(e, g, dt) {
        const p = g.player;
        e.t -= dt;
        if (e.state === 'walk') {
          const c = chaseDir(e, g, tmp);
          move(e, g, dt, c.x, c.y, e.speed);
          facePlayer(e, g, dt, 1.35);
          e.cd -= dt;
          if (c.los && c.d < 270 && e.cd <= 0) { e.state = 'windup'; e.t = 0.6; LF.audio.play('telegraph'); }
        } else if (e.state === 'windup') {
          e.red = 1; e.vx *= 0.8; e.vy *= 0.8; facePlayer(e, g, dt, 6);
          if (e.t <= 0) { e.state = 'charge'; e.t = 0.8; e.lx = Math.cos(e.face); e.ly = Math.sin(e.face); LF.audio.play('lunge'); }
        } else if (e.state === 'charge') {
          e.red = 1;
          { const sm = e.slowMul(g); e.vx = e.lx * 345 * sm; e.vy = e.ly * 345 * sm; }
          e.x += e.vx * dt; e.y += e.vy * dt;
          const hit = g.map.resolveCircle(e, e.r);
          if (Math.random() < 0.8) fx.spawn({ x: e.x - e.lx * e.r, y: e.y - e.ly * e.r, life: 0.35, size: 5, color: '#1a1030', glow: false });
          if (hit && (Math.abs(e.hitNx * e.lx + e.hitNy * e.ly) > 0.5)) {
            e.state = 'dazed'; e.t = 1.3; g.shake(5); LF.audio.play('gate');
            fx.burst(e.x + e.lx * e.r, e.y + e.ly * e.r, 12, { color: '#9a8fb0', speed1: 140, life: 0.4, glow: false });
            fx.text(e.x, e.y - e.r - 8, 'DAZED', '#ffe08a', 10);
          } else if (e.t <= 0) { e.state = 'walk'; e.cd = LF.rand(2.4, 3.8); }
        } else {
          e.vx = 0; e.vy = 0;
          if (e.t <= 0) { e.state = 'walk'; e.cd = LF.rand(2.4, 3.8); }
        }
      },
      // frontal plate turns bolts unless dazed
      modDamage(e, dmg, src) {
        if (e.state === 'dazed') return dmg * 1.5;
        if (src.angle !== undefined && (src.type === 'bolt')) {
          const incoming = src.angle + Math.PI;
          if (Math.abs(LF.angDiff(e.face, incoming)) < 1.15) {
            LF.audio.play('shroud');
            fx.burst(src.x || e.x, src.y || e.y, 3, { color: '#b9b3c9', speed1: 110, life: 0.2, size: 1.4 });
            src.blocked = true;
            return dmg * 0.25;
          }
        }
        return dmg;
      },
      draw(e, ctx, g) {
        shadow(ctx, e, 1.25);
        bodyStyle(ctx, e);
        const dz = e.state === 'dazed' ? Math.sin(g.time * 20) * 1.5 : 0;
        blob(ctx, e.x + dz, e.y, e.r, g.time * 2, 0.04, 5, e.wob); ctx.fill(); if (e.lit) ctx.stroke();
        // plate
        ctx.strokeStyle = e.flash > 0 ? '#fff' : (e.lit ? '#8d86a8' : '#2c2740'); ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(e.x + dz, e.y, e.r + 2, e.face - 1.05, e.face + 1.05); ctx.stroke();
        ctx.strokeStyle = e.lit ? '#c9c3df' : '#3a3550'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(e.x + dz, e.y, e.r + 4, e.face - 0.9, e.face + 0.9); ctx.stroke();
        if (e.state === 'dazed') {
          ctx.fillStyle = '#ffe08a';
          for (let i = 0; i < 3; i++) { const a = g.time * 5 + i * 2.1; ctx.beginPath(); ctx.arc(e.x + Math.cos(a) * 12, e.y - e.r - 6 + Math.sin(a) * 3, 1.6, 0, TAU); ctx.fill(); }
        }
      },
    },

    brood: {
      name: 'Brood Nest', hp: 95, speed: 0, r: 18, dmg: 0, embers: 3.5, glass: 3.5, contact: false,
      eyes: [[-6, -6, 1.3], [5, -7, 1.5], [8, 2, 1.2], [-3, 6, 1.6], [-9, 1, 1.1], [2, 0, 1.8]],
      init(e) { e.kids = []; e.cd = 1.2; e.face = 0; },
      update(e, g, dt) {
        e.cd -= dt;
        e.kids = e.kids.filter(k => !k.dead);
        if ((e.spawned || 0) >= 9) {
          if (!e.withered) { e.withered = true; fx.text(e.x, e.y - e.r - 10, 'WITHERS', '#b89cff', 10, 1); }
          g.damageEnemy(e, e.maxHp * 0.14 * dt, { type: 'burn', quiet: true, noShroud: true });
          return;
        }
        if (e.cd <= 0 && e.kids.length < (e.elite ? 6 : 4) && g.enemies.length < 70) {
          e.cd = 3.1; e.spawned = (e.spawned || 0) + 1;
          const a = Math.random() * TAU;
          const pos = g.map.nearestOpen(e.x + Math.cos(a) * 30, e.y + Math.sin(a) * 30);
          const k = g.spawnEnemy('skitter', pos.x, pos.y, { awake: true, spawnT: 0.5, hpMul: 0.6, noDrops: e.spawned > 4 || Math.random() < 0.6, room: e.room, parent: e });
          e.kids.push(k);
          LF.audio.play('spawn'); e.flash = 0.4;
          fx.burst(e.x, e.y, 6, { color: '#2a1a48', glow: false, speed1: 70, life: 0.5, size: 4 });
        }
      },
      draw(e, ctx, g) {
        const pulse = 1 + Math.sin(g.time * 3 + e.wob) * 0.05 + Math.max(0, 0.3 - e.cd) * 0.5;
        ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + 6, e.r * 1.3, e.r * 0.7, 0, 0, TAU); ctx.fill();
        bodyStyle(ctx, e);
        for (let i = 0; i < 5; i++) {
          const a = e.wob + i * TAU / 5;
          ctx.beginPath(); ctx.arc(e.x + Math.cos(a) * e.r * 0.5, e.y + Math.sin(a) * e.r * 0.5, e.r * 0.62 * pulse, 0, TAU); ctx.fill(); if (e.lit) ctx.stroke();
        }
        ctx.fillStyle = e.flash > 0 ? '#fff' : (e.lit ? BODY_LIT : BODY);
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 0.75 * pulse, 0, TAU); ctx.fill();
      },
    },

    wraith: {
      name: 'Wraith', hp: 40, speed: 80, r: 12, dmg: 10, embers: 2.2, glass: 2, ghost: true, flies: true,
      eyes: [[4, -3, 1.5], [4, 3, 1.5]], eyeColor: '150,230,255',
      hideEyes(e) { return e.solid < 0.25; },
      init(e) { e.solid = 0; e.intangible = true; e.wh = LF.rand(1, 3); },
      onWake() { LF.audio.play('whisper'); },
      update(e, g, dt) {
        const p = g.player;
        e.solid = LF.approach(e.solid, e.lit ? 1 : 0, dt * (e.lit ? 3.2 : 1.6));
        e.intangible = e.solid < 0.5;
        const dx = p.x - e.x, dy = p.y - e.y, l = Math.hypot(dx, dy) || 1;
        move(e, g, dt, dx / l, dy / l, e.speed * (e.lit ? 0.8 : 1.25), 3);
        facePlayer(e, g, dt, 6);
        e.wh -= dt;
        if (e.wh <= 0 && l < 320) { e.wh = LF.rand(2.5, 5); if (e.intangible) LF.audio.play('whisper'); }
        // it only bites once it has taken shape: the shared contact check skips intangible enemies
      },
      onTouch(e, g) {
        const p = g.player;
        if (p.invuln > 0) return;
        g.hurtPlayer(e.dmg, { x: e.x, y: e.y, enemy: e });
        fx.burst(e.x, e.y, 10, { color: '#7fd8ff', speed1: 110, life: 0.4 });
        const a = Math.random() * TAU, d = LF.rand(230, 300);
        e.x = p.x + Math.cos(a) * d; e.y = p.y + Math.sin(a) * d; e.solid = 0; e.intangible = true; e.vx = 0; e.vy = 0;
      },
      draw(e, ctx, g) {
        if (e.solid <= 0.02) return;
        ctx.globalAlpha = e.solid * 0.92;
        ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.face);
        ctx.fillStyle = e.flash > 0 ? '#fff' : '#131a2e'; ctx.strokeStyle = 'rgba(127,216,255,0.6)'; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(e.r, 0);
        ctx.quadraticCurveTo(e.r * 0.5, -e.r * 1.1, -e.r * 0.6, -e.r * 0.9);
        for (let i = 0; i < 4; i++) { const y = -e.r * 0.9 + (i + 0.5) * e.r * 0.45; ctx.lineTo(-e.r * (1.5 + (i % 2) * 0.6) + Math.sin(g.time * 7 + i + e.wob) * 3, y); ctx.lineTo(-e.r * 0.9, y + e.r * 0.22); }
        ctx.quadraticCurveTo(e.r * 0.5, e.r * 1.1, e.r, 0);
        ctx.fill(); ctx.stroke();
        ctx.restore(); ctx.globalAlpha = 1;
      },
    },

    snuffer: {
      name: 'Snuffer', hp: 55, speed: 74, r: 13, dmg: 9, embers: 2.5, glass: 2.5,
      eyes: [[5, 0, 2.4]], eyeColor: '120,255,190',
      init(e) { e.cd = LF.rand(2, 3); },
      update(e, g, dt) {
        const p = g.player;
        const c = kite(e, g, dt, 190, 300, e.speed);
        facePlayer(e, g, dt);
        e.snuffing = c.los && c.d < 330;
        if (e.snuffing) {
          g.snuffCount++;
          if (Math.random() < dt * 26) {
            const t = Math.random();
            fx.spawn({ x: LF.lerp(p.x, e.x, t), y: LF.lerp(p.y, e.y, t), vx: (e.x - p.x) * 0.5, vy: (e.y - p.y) * 0.5, life: 0.5, size: 3, color: '#0a1a14', glow: false, drag: 0.5 });
          }
        }
        if (e.elite) {
          e.cd -= dt;
          if (c.los && e.cd <= 0) { e.cd = 2.6; g.fireEnemyBullet({ x: e.x, y: e.y, angle: Math.atan2(p.y - e.y, p.x - e.x), speed: 170, dmg: e.dmg, color: '#5dffb0' }); LF.audio.play('spit'); }
        }
      },
      draw(e, ctx, g) {
        shadow(ctx, e);
        const p = g.player;
        if (e.snuffing && e.awake) {
          ctx.strokeStyle = 'rgba(40,120,90,0.35)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(e.x, e.y);
          const mx = (e.x + p.x) / 2 + Math.sin(g.time * 3 + e.wob) * 24, my = (e.y + p.y) / 2 + Math.cos(g.time * 2.3 + e.wob) * 24;
          ctx.quadraticCurveTo(mx, my, p.x, p.y); ctx.stroke();
        }
        bodyStyle(ctx, e); ctx.strokeStyle = 'rgba(110,235,180,0.5)';
        ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.face);
        ctx.beginPath(); ctx.moveTo(e.r * 1.1, 0); ctx.quadraticCurveTo(0, -e.r * 1.3, -e.r * 1.2, -e.r * 0.7); ctx.lineTo(-e.r * 0.8, 0); ctx.lineTo(-e.r * 1.2, e.r * 0.7); ctx.quadraticCurveTo(0, e.r * 1.3, e.r * 1.1, 0);
        ctx.fill(); if (e.lit) ctx.stroke();
        ctx.restore();
        ctx.fillStyle = '#020403'; ctx.beginPath(); ctx.arc(e.x + Math.cos(e.face) * 5, e.y + Math.sin(e.face) * 5, 4.2, 0, TAU); ctx.fill();
      },
    },

    weaver: {
      name: 'Weaver', hp: 44, speed: 60, r: 12, dmg: 7, embers: 2.5, glass: 2.5,
      eyes: [[5, -4, 1.2], [6, -1.4, 1.4], [6, 1.4, 1.4], [5, 4, 1.2]], eyeColor: '255,120,220',
      hideEyes(e) { return e.fade < 0.3; },
      init(e) { e.state = 'drift'; e.t = LF.rand(1.2, 2.4); e.fade = 1; },
      update(e, g, dt) {
        const p = g.player;
        e.t -= dt;
        if (e.state === 'drift') {
          kite(e, g, dt, 130, 260, e.speed); facePlayer(e, g, dt);
          if (e.t <= 0) { e.state = 'fade'; e.t = 0.4; }
        } else if (e.state === 'fade') {
          e.fade = Math.max(0, e.t / 0.4); e.intangible = e.fade < 0.5;
          if (e.t <= 0) {
            for (let i = 0; i < 14; i++) {
              const a = Math.random() * TAU, d = LF.rand(160, 280), nx = p.x + Math.cos(a) * d, ny = p.y + Math.sin(a) * d;
              if (!g.map.solidAt(nx, ny) && !g.map.solidAt(nx + e.r, ny) && !g.map.solidAt(nx - e.r, ny) && !g.map.solidAt(nx, ny + e.r) && !g.map.solidAt(nx, ny - e.r) && g.map.los(nx, ny, p.x, p.y)) { e.x = nx; e.y = ny; break; }
            }
            e.state = 'appear'; e.t = 0.45; e.vx = 0; e.vy = 0;
            fx.ring(e.x, e.y, 30, 6, 0.4, '#ff78dc', 2);
          }
        } else if (e.state === 'appear') {
          e.fade = 1 - Math.max(0, e.t / 0.45); e.intangible = e.fade < 0.5; e.red = 1; facePlayer(e, g, dt, 20);
          if (e.t <= 0) {
            e.intangible = false; e.fade = 1;
            const base = Math.atan2(p.y - e.y, p.x - e.x), n = e.elite ? 5 : 3;
            for (let i = 0; i < n; i++) g.fireEnemyBullet({ x: e.x, y: e.y, angle: base + (i - (n - 1) / 2) * 0.7, speed: 118, dmg: e.dmg, size: 6, color: '#ff78dc', homing: 1.5, orb: true, life: 5 });
            LF.audio.play('spit');
            e.state = 'drift'; e.t = LF.rand(2.6, 3.8);
          }
        }
      },
      draw(e, ctx, g) {
        if (e.fade <= 0.02) return;
        ctx.globalAlpha = e.fade;
        shadow(ctx, e);
        ctx.strokeStyle = e.lit ? '#3a2456' : '#150e24'; ctx.lineWidth = 1.5;
        for (let i = 0; i < 8; i++) {
          const a = e.face + (i < 4 ? 1 : -1) * (0.5 + (i % 4) * 0.55), k = Math.sin(g.time * 5 + i + e.wob) * 3;
          const mx = e.x + Math.cos(a) * e.r * 1.5, my = e.y + Math.sin(a) * e.r * 1.5;
          ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(mx, my); ctx.lineTo(mx + Math.cos(a + 0.9) * (9 + k), my + Math.sin(a + 0.9) * (9 + k)); ctx.stroke();
        }
        bodyStyle(ctx, e); ctx.strokeStyle = 'rgba(255,120,220,0.5)';
        blob(ctx, e.x, e.y, e.r * 0.85, g.time * 3, 0.05, 4, e.wob); ctx.fill(); if (e.lit) ctx.stroke();
        ctx.globalAlpha = 1;
      },
    },
  };

  // A bloat bursting: gloom cloud + a hit if you are standing in it.
  LF.bloatBurst = function (g, x, y, dmg, scale = 1) {
    const p = g.player, r = 84 * scale;
    LF.audio.play('explode'); g.shake(6);
    fx.burst(x, y, 26, { color: ['#1a0f2e', '#2a1648', '#0d0818'], glow: false, speed1: 190, life: 0.9, size: 8, drag: 3 });
    fx.ring(x, y, 10, r, 0.4, '#6a3aa8', 4);
    g.addZone({ kind: 'gloom', x, y, r, life: 5.5 });
    if (!p.dead && LF.dist(x, y, p.x, p.y) < r * 0.9 && p.invuln <= 0 && p.dashing <= 0) g.hurtPlayer(dmg, { x, y });
  };
})();
