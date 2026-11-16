'use strict';
// Player, bolts, enemy bullets and pickups.
(function () {
  const fx = LF.fx, TAU = LF.TAU;

  // A censer, swung or thrown: a little lantern seen from the side, hanging out along a straight chain from the hand.
  // (x, y) is where it strikes; `col` is the light in its window.
  // The chain is drawn as the Chain Warden's is: open links, face-on and edge-on by turns. It starts a little way out
  // from the bearer, not over them, and when it is swung it hangs in a slight arc behind the censer (`lag`, in radians
  // at the hand; 0 for a thrown censer, whose chain is taut). `big` is the censer's size: 1, or more while it is swollen.
  // A censer's chain is fine work, not a flail's: small thin links, light against the censer they carry.
  function drawCenser(ctx, px, py, x, y, col, lag = 0, big = 1) {
    const ang = Math.atan2(y - py, x - px), far = Math.hypot(x - px, y - py), out = 14, end = Math.max(out, far - 8 * big);
    const n = Math.max(2, Math.round((end - out) / 4.6)), pt = f => { const a = ang + lag * (1 - f) * (1 - f), r = out + (end - out) * f; return [px + Math.cos(a) * r, py + Math.sin(a) * r]; };
    ctx.lineCap = 'round';
    let lx = 0, ly = 0;
    const link = (i, cx, cy, la) => { ctx.beginPath(); if (i % 2) { ctx.moveTo(cx - Math.cos(la) * 2.3, cy - Math.sin(la) * 2.3); ctx.lineTo(cx + Math.cos(la) * 2.3, cy + Math.sin(la) * 2.3); } else ctx.ellipse(cx, cy, 2.7, 1.6, la, 0, TAU); ctx.stroke(); };
    for (let i = 0; i <= n; i++) {
      const [cx, cy] = pt(i / n), [nx, ny] = pt(Math.min(1, (i + 0.5) / n)), la = Math.atan2(ny - cy, nx - cx) || ang;
      ctx.strokeStyle = '#2a2216'; ctx.lineWidth = 2; link(i, cx, cy, la);
      ctx.strokeStyle = '#d2b278'; ctx.lineWidth = 0.9; link(i, cx, cy, la);
      lx = cx; ly = cy;
    }
    // the censer: a little lantern seen from the side, hanging out along the last of the chain
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(y - ly, x - lx)); ctx.scale(0.9 * big, 0.9 * big); ctx.translate(-8, 0);
    ctx.strokeStyle = '#2a2216'; ctx.lineWidth = 1.2; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.arc(-1, 0, 2.3, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#e0bb78'; ctx.beginPath(); ctx.moveTo(1, -1.6); ctx.lineTo(5, -6.5); ctx.lineTo(5, 6.5); ctx.lineTo(1, 1.6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = col; ctx.fillRect(5, -5.5, 9, 11);
    ctx.fillStyle = '#fffbe8'; ctx.beginPath(); ctx.ellipse(9.5, 0, 2.2, 3.4, 0, 0, TAU); ctx.fill();
    ctx.strokeRect(5, -5.5, 9, 11); ctx.beginPath(); ctx.moveTo(8, -5.5); ctx.lineTo(8, 5.5); ctx.moveTo(11, -5.5); ctx.lineTo(11, 5.5); ctx.stroke();
    ctx.fillStyle = '#e0bb78'; ctx.fillRect(14, -6.5, 2.6, 13); ctx.strokeRect(14, -6.5, 2.6, 13);
    ctx.restore();
  }
  LF.CENSER_REACH = 60;   // how far out a swung censer hangs, before chain relics lengthen it
  const censerCol = st => st.chainBurn ? '#ff9a4d' : st.chainLight ? '#fff6dc' : '#ffd98a';

  // ------------------------------------------------------------------ Player
  class Player {
    constructor(game) {
      this.g = game;
      this.x = 0; this.y = 0; this.vx = 0; this.vy = 0; this.r = 10;
      this.aim = 0; this.relics = {}; this.relicOrder = [];
      this.stats = LF.baseStats();
      this.light = 100; this.lightR = 260; this.lightRT = 260; this.dim = 0;
      this.stoke = 0; this.swingT = 0; this.swingA = 0; this.swingHalf = 1; this.swingReach = 80;
      this.ward = 0; this.wardT = 0; this.wardMax = 0; this.waxT = 0; this.shadeCd = 0; this.shadeT = 0; this.lashT = 0; this.guardA = 0;
      this.fireT = 0; this.dashT = 0; this.flareT = 0;
      this.dashing = 0; this.dashDx = 1; this.dashDy = 0; this.dashHit = new Set(); this.trailD = 0;
      this.hurts = []; // blows still burning through: { left, rate, name }
      this.invuln = 0; this.hurtFlash = 0; this.glass = 0; this.kills = 0; this.shots = 0;
      this.still = 0; this.vigilOn = false; this.phoenixUsed = false; this.lifelineUsed = false;
      this.familiars = []; this.swarm = []; this.orbitA = 0; this.stormT = 3; this.bob = 0; this.ghosts = [];
      this.dead = false; this.beatT = 0; this.inWater = false; this.recoil = 0; this.rerolls = 0; this.sacrificed = 0; this.stepT = 0; this.windT = 0; this.charge = 0; this.bonusMax = 0; this.critEmberT = 0;
      this.recalc();
      this.light = this.stats.maxLight;
    }
    recalc() {
      const s = LF.baseStats(), m = this.g.meta ? this.g.meta.up : {};
      s.maxLight += 7.5 * (m.wick || 0);
      s.damage *= 1 + 0.05 * (m.spark || 0);
      s.speed *= 1 + 0.03 * (m.boots || 0);
      s.drainMul *= Math.pow(0.9, m.oil || 0);
      s.flareCd *= Math.pow(0.92, m.flare || 0);
      s.emberMul += 0.08 * (m.ember || 0);
      s.extraChoice += (m.choice || 0);
      s.brazierBonus += (m.tinder || 0) / 6;
      s.glassMul += 0.08 * (m.pockets || 0);
      { const sh = (this.g.meta && this.g.meta.shards) || 0; if (sh >= 1) { s.maxLight += 25; s.drainMul *= 0.85; } if (sh >= 3) s.extraChoice += 1; }
      const lan = LF.LANTERN[this.g.lanternId]; if (lan) lan.stats(s);
      { const lk = LF.LOOK[LF.lookOf(this.g.meta)], sear0 = s.sear; if (lk.stats) lk.stats(s); this.r = lk.r || 10; if (s.sear > sear0) s.searOn = 1; } // light only sears for a bearer whose perk says so, or with a relic
      { const ml = LF.masteryLevel(this.g.meta, this.g.lanternId); s.damage *= 1 + 0.04 * ml; s.maxLight += 5 * ml; }
      for (const id in this.relics) { const d = LF.RELICS[id]; if (d) d.stats(s, LF.rankValue(d, this.relics[id]), this); }
      this.synergies = [];
      for (const sy of LF.SYNERGIES) if (sy.needs.every(n => (this.relics[n] || 0) >= (sy.rank || 1))) { sy.stats(s); this.synergies.push(sy); }
      this.schools = LF.schoolCounts(this);
      LF.applySchools(s, this.schools, this);
      s.waxSlow = Math.min(0.8, s.waxSlow);
      s.flareCd = Math.max(0.8, s.flareCd); s.dashCd = Math.max(0.25, s.dashCd); s.stormCd = Math.max(0.4, s.stormCd); s.flareStun = Math.min(5, s.flareStun);
      // Counterweight: every censer takes its share of a blow, each on top of the last (never more than 85% in all)
      if (s.counterweight && s.chainGuard) s.dmgTaken *= Math.max(0.15, Math.pow(1 - Math.min(0.9, s.counterweight), s.chainGuard));
      if (s.undying) s.burnTime = 999;
      s.flareDmg *= s.flareAmp; // White Flash multiplies whatever harm the flare has been given
      // ward: the strongest theme multiplier the lantern has divides every blow it takes (a lantern is as tough as it is deep)
      s.ward = Math.max(1, s.fireAll, s.lightAll, s.waxAll, s.chainAll, s.mothAll);
      s.allBase = { fireAll: s.fireAll, lightAll: s.lightAll, waxAll: s.waxAll, chainAll: s.chainAll, mothAll: s.mothAll }; // before any surge (see surge())
      if (s.buckler > (this.wardMax || 0)) this.ward = s.buckler; // a new buckler arrives whole
      this.wardMax = s.buckler; this.ward = Math.min(this.ward || 0, s.buckler);
      s.maxLight += this.bonusMax;
      s.maxLight *= s.maxMul; // Heartwood multiplies every ember the lantern can hold, however it came by them
      if (this.g.vows && this.g.vows.glass) s.maxLight *= 0.5;
      s.maxLight = Math.max(25, s.maxLight - this.sacrificed);
      s.crit = Math.min(s.crit, 0.75);
      this.stats = s;
      if (this.light > s.maxLight) this.light = s.maxLight;
      while (this.familiars.length < s.familiars) this.familiars.push({ a: Math.random() * TAU, x: this.x, y: this.y, t: Math.random() });
      this.familiars.length = Math.min(this.familiars.length, s.familiars);
    }
    // The uncommon card of each theme grows all the theme does only while its own condition holds: the Draught while
    // the bearer keeps moving, the Trimmed Wick while the lantern is full, the Double Boiler for every waxed creature
    // near, Momentum while the censers keep striking, Night Bloom while the light is low. The ward follows.
    surge(dt) {
      const s = this.stats, S = s.surge, B = s.allBase;
      if (!B || !(S.fireAll || S.lightAll || S.waxAll || S.chainAll || S.mothAll)) return;
      const g = this.g, f = this.frac();
      const moved = this.lastX === undefined ? 0 : Math.hypot(this.x - this.lastX, this.y - this.lastY) / Math.max(dt, 1e-3);
      this.lastX = this.x; this.lastY = this.y;
      this.heat = LF.clamp((this.heat || 0) + (moved > 40 ? dt : -dt) / 1.5, 0, 1);
      this.mom = Math.max(0, (this.mom || 0) - dt * 0.15);
      let waxed = 0;
      if (S.waxAll) for (const e of g.enemies) if (!e.dead && e.chill > 0 && LF.dist2(e.x, e.y, this.x, this.y) < 500 * 500) waxed++;
      const up = (m, c) => m ? 1 + (m - 1) * LF.clamp(c, 0, 1) : 1;
      s.fireAll = B.fireAll * up(S.fireAll, this.heat);
      s.lightAll = B.lightAll * up(S.lightAll, (f - 0.5) / 0.4);
      s.waxAll = B.waxAll * up(S.waxAll, waxed / 2);
      s.chainAll = B.chainAll * up(S.chainAll, this.mom);
      s.mothAll = B.mothAll * up(S.mothAll, (1 - f) / 0.5);
      s.ward = Math.max(1, s.fireAll, s.lightAll, s.waxAll, s.chainAll, s.mothAll);
    }
    addRelic(id) {
      const d = LF.RELICS[id]; if (!d) return;
      // a bolt carries one type: taking another's lets go of the one it had
      if (d.vt && d.verb === 'bolt') for (const k of Object.keys(this.relics)) { const o = LF.RELICS[k]; if (k !== id && o && o.vt && o.verb === 'bolt') { delete this.relics[k]; this.relicOrder = this.relicOrder.filter(x => x !== k); } }
      this.relics[id] = (this.relics[id] || 0) + 1;
      if (!this.relicOrder.includes(id)) this.relicOrder.push(id);
      const c0 = d.school ? (d.dmg ? 1 : Object.keys(this.relics).filter(k => k !== id && LF.RELICS[k] && LF.RELICS[k].school === d.school && !LF.RELICS[k].dmg).length + (this.relics[id] > 1 ? 1 : 0)) : 0;
      const had = (this.synergies || []).map(sy => sy.id), sch = d.school, t0 = sch ? LF.tierOf((this.schools || {})[sch] || 0) : 0, max0 = this.stats.maxLight;
      this.recalc();
      if (this.stats.maxLight > max0) this.addLight(this.stats.maxLight - max0); // room to hold more embers comes filled
      if (sch) { const t1 = LF.tierOf(this.schools[sch] || 0), S = LF.SCHOOLS[sch]; if (t1 > t0) { this.g.toast('Attuned: ' + S.name + ' ' + ['', 'I', 'II', 'III'][t1], S.tiers[t1 - 1] + (LF.RELIC_LIST.some(r => r.school === sch && r.tier > t0 && r.tier <= t1) ? '. Stronger relics of ' + S.name.toLowerCase() + ' can now be offered' : ''), S.color, S.glyph, S.color, 7); LF.audio.play('rare'); if (this.g.attuned) this.g.attuned(sch, t0, t1); } }
      if (sch && !c0 && LF.SCHOOLS[sch].first) { const S = LF.SCHOOLS[sch]; this.g.toast(S.name, S.first, S.color, S.glyph, S.color, 7); }
      for (const sy of this.synergies) if (!had.includes(sy.id)) { this.g.toast('Kindred: ' + sy.name, sy.desc, '#9dffcf', 'star', '#9dffcf', 6.5); LF.audio.play('rare'); }
      if (d.onGain) d.onGain(this.g);
    }
    swarmMoths(n, life, x, y) {
      for (let i = 0; i < n; i++) this.swarm.push({ a: Math.random() * TAU, x: x === undefined ? this.x : x, y: y === undefined ? this.y : y, t: 0.15 + Math.random() * 0.6, life: (life + (this.stats.mothLife || 0)) * (this.stats.mothStay ? 2 : 1) + Math.random() * 0.8, temp: true });
      { const cap = this.stats.mothStay ? 21 : 14; if (this.swarm.length > cap) this.swarm.splice(0, this.swarm.length - cap); }
      LF.audio.play('spawn');
    }
    addLight(v) { this.light = Math.min(this.stats.maxLight, this.light + v); }
    frac() { return this.light / this.stats.maxLight; }
    damageMul() {
      const s = this.stats; let m = 1;
      const f = this.frac();
      if (this.vigilOn) m *= 1.35;
      if (s.lowLightDmg && f < 0.4) m *= 1 + s.lowLightDmg;
      if (s.brightDmg) m *= 1 + s.brightDmg * f;
      if (f < 0.2) m *= 1.3; // desperation: a guttering lantern burns hot
      return m;
    }

    update(dt, inp) {
      const g = this.g, s = this.stats, map = g.map;
      this.fireT -= dt; this.dashT -= dt; this.flareT -= dt; this.invuln -= dt; this.noonT = (this.noonT || 0) - dt; this.castCd = (this.castCd || 0) - dt;
      this.hurtFlash = Math.max(0, this.hurtFlash - dt * 3); this.recoil = Math.max(0, this.recoil - dt * 8);
      // the Candle sheds wax when it is struck, and when it is nearly burnt down
      if (g.meta.look === 'candle' && (this.hurtFlash > 0.2 || this.frac() < 0.3) && Math.random() < dt * (this.hurtFlash > 0.2 ? 30 : 5)) fx.spawn({ x: this.x + LF.rand(-7, 7), y: this.y + LF.rand(-5, 7), vx: LF.rand(-25, 25), vy: LF.rand(-25, 25), life: 0.9, size: 2.2, color: '#b89f68', drag: 4, glow: false });

      // aim
      if (inp.aimDir !== null && inp.aimDir !== undefined) {
        this.aim = inp.aimDir;
        // sticks are imprecise: bend the aim a little toward the creature nearest the stick direction
        if (!g.bot && LF.input.mode !== 'kbm') {
          let best = null, bd = 0.34;
          for (const e of g.enemies) {
            if (e.dead || e.intangible || !e.awake || e.spawnT > 0) continue;
            const d = LF.dist(this.x, this.y, e.x, e.y);
            if (d > 420) continue;
            const off = Math.abs(LF.angDiff(inp.aimDir, Math.atan2(e.y - this.y, e.x - this.x)));
            if (off < bd) { bd = off; best = e; }
          }
          if (best) this.aim = inp.aimDir + LF.angDiff(inp.aimDir, Math.atan2(best.y - this.y, best.x - this.x)) * 0.7;
        }
      }
      else { const w = g.screenToWorld(inp.aimX, inp.aimY); this.aim = Math.atan2(w.y - this.y, w.x - this.x); }

      // how far off the aim point is (the Gout lands there): the cursor, or with a stick or a bot the creature nearest the line of aim
      if (s.gout) {
        if (inp.aimDir !== null && inp.aimDir !== undefined) { let bd = 150; for (const e of g.enemies) { if (e.dead || e.intangible || e.spawnT > 0) continue; const d = LF.dist(this.x, this.y, e.x, e.y); if (d < Math.max(bd, 260) && Math.abs(LF.angDiff(this.aim, Math.atan2(e.y - this.y, e.x - this.x))) < 0.3 && (bd === 150 || d < bd)) bd = d; } this.aimDist = bd; }
        else { const w = g.screenToWorld(inp.aimX, inp.aimY); this.aimDist = LF.dist(this.x, this.y, w.x, w.y); }
      }
      if (this.thrownOut && !g.bullets.some(b => b.ret && !b.dead)) this.thrownOut = false;
      // movement
      this.inWater = map.waterAt(this.x, this.y);
      this.windT -= dt; this.critEmberT -= dt;
      let speed = s.speed * (this.inWater && !s.hover ? (g.tideHigh ? 0.62 : 0.86) : 1) * (this.windT > 0 ? 1 + 0.35 * s.secondWind : 1);
      if (this.dashing > 0) {
        this.dashing -= dt;
        this.vx = this.dashDx * 640; this.vy = this.dashDy * 640;
        this.trailD += 640 * dt;
        this.ghosts.push({ x: this.x, y: this.y, life: 0.25 });
        if ((s.afterglow || s.waxTrail || s.dashLight) && this.trailD > 16) {
          this.trailD = 0;
          if (s.dashLight && (this.trailN = (this.trailN || 0) + 1) % 2 === 1) g.addZone({ kind: 'light', x: this.x, y: this.y, r: 64, life: 6 * s.linger });
          if (s.afterglow) g.addZone({ kind: 'fire', x: this.x, y: this.y, r: 22, life: 2.4, dps: 70 * s.afterglow });
          if (s.waxTrail) g.addZone({ kind: 'tallow', x: this.x, y: this.y, r: 24, life: 3 + 2 * s.waxTrail });
        }
        if (s.eclipseMask || s.comet) {
          for (const e of g.enemies) {
            if (e.dead || this.dashHit.has(e) || e.intangible) continue;
            if (LF.dist2(this.x, this.y, e.x, e.y) < (e.r + 20) * (e.r + 20)) {
              this.dashHit.add(e); if (s.eclipseMask) e.mark = 5;
              g.damageEnemy(e, (s.eclipseMask ? 15 + s.damage * 1.2 : 0) + (s.comet ? 12 + s.damage * 2.6 * this.damageMul() : 0), { type: 'dash', x: this.x, y: this.y, noShroud: !!s.comet });
              fx.burst(e.x, e.y, 8, { color: s.comet ? '#ff9140' : '#c9a7ff', speed1: 120, life: 0.4 });
            }
          }
        }
        if (Math.random() < 0.7) fx.spawn({ x: this.x, y: this.y, vx: LF.rand(-30, 30), vy: LF.rand(-30, 30), life: 0.35, size: 2.5, color: '#ffd9a0' });
      } else {
        const ax = inp.mx * speed, ay = inp.my * speed;
        const k = Math.min(1, dt * 14);
        this.vx += (ax - this.vx) * k; this.vy += (ay - this.vy) * k;
      }
      this.x += this.vx * dt; this.y += this.vy * dt;
      map.resolveCircle(this, this.r);
      const moving = Math.hypot(this.vx, this.vy) > 20;
      if (moving) {
        this.bob += dt * 11; this.still = 0;
        this.stepT -= dt;
        if (this.stepT <= 0 && this.dashing <= 0) { this.stepT = s.hover ? 0.42 : 0.3; LF.audio.play(s.hover ? 'flutter' : this.inWater ? 'splash' : 'step'); }
        if (this.inWater && !s.hover && Math.random() < dt * 14) fx.ring(this.x + LF.rand(-4, 4), this.y + LF.rand(-4, 4), 2, 12, 0.5, 'rgba(160,210,230,0.5)', 1.2, false);
      } else this.still += dt;
      const vig = s.vigil > 0 && this.still > 0.6;
      if (vig && !this.vigilOn) fx.ring(this.x, this.y, 8, 36, 0.4, '#fff1c1', 2);
      this.vigilOn = vig;
      for (const gh of this.ghosts) gh.life -= dt;
      if (this.ghosts.length && this.ghosts[0].life <= 0) this.ghosts.shift();

      // dash
      if (inp.dash && this.dashT <= 0 && this.dashing <= 0) {
        if (this.light > s.dashCost + 1 || s.dashCost <= 0) {
          this.light -= s.dashCost;
          let dx = inp.mx, dy = inp.my;
          if (!dx && !dy) { dx = Math.cos(this.aim); dy = Math.sin(this.aim); }
          const l = Math.hypot(dx, dy) || 1;
          this.dashDx = dx / l; this.dashDy = dy / l;
          this.dashing = (s.comet ? 0.3 : 0.17) * s.dashLen; this.dashT = s.dashCd;
          if (s.dashMoth) this.swarmMoths(s.dashMoth, 4); this.invuln = Math.max(this.invuln, s.comet ? 0.42 : 0.3);
          this.dashHit.clear(); this.trailD = 99; this.trailN = 0; this.flailT = 1.5;
          if (s.shadeStep && this.shadeCd <= 0) { this.shadeCd = 6; this.shadeT = 1.45; this.invuln = Math.max(this.invuln, 1.45); fx.ring(this.x, this.y, 6, 44, 0.35, '#8f6bff', 3); }
          LF.audio.play('dash'); if (s.comet) LF.audio.play('ignite');
          fx.burst(this.x, this.y, 10, { color: ['#ffd9a0', '#fff'], speed1: 90, life: 0.3, angle: Math.atan2(-dy, -dx), spread: 1.4 });
          g.stat('dashes');
        } else { LF.audio.play('noLight'); g.hint('Too few embers to dash'); }
      }

      // flare
      if (inp.flare && g.vows.silence) { LF.audio.play('noLight'); g.hint('You are vowed to silence'); }
      else if (inp.flare && this.flareT <= 0) {
        const cost = s.flareFree || (s.solarCrown && this.frac() >= 0.75) ? 0 : s.flareCost; // Solar Crown: free while the lantern is three quarters full
        if (cost <= 0 || this.light > cost + 1) {
          this.light -= cost; this.flareT = s.flareCd;
          // the Slow Dusk: a flare burns away whatever a blow has yet to take
          if (s.flareMend && this.hurts.length) { const left = this.hurts.reduce((a, h) => a + h.left, 0); this.hurts.length = 0; g.run.taken -= left; if (left >= 0.5) fx.text(this.x, this.y - 34, 'MENDED ' + Math.round(left / LF.EMBER), '#fff0b8', 12, 0.9); }
          const fd = s.flareDmg * this.damageMul(), p = this, fk = LF.LOOK[LF.lookOf(g.meta)].flare;
          if (s.haul) {
            // the Haul: chains go out past the flare's edge, and whatever they catch is fastened to the bearer and drawn in
            const R2 = s.flareRadius * s.haul;
            fx.ring(this.x, this.y, R2, 16, 0.3, '#d9b070', 3); LF.audio.play('chain');
            for (const e of g.enemies) {
              if (e.dead || e.spawnT > 0 || e.intangible || LF.dist2(this.x, this.y, e.x, e.y) > (R2 + e.r) * (R2 + e.r)) continue;
              fx.arc(this.x, this.y, e.x, e.y, '#d9b070', 0.3, 2.5, 'chain');
              g.shackle(e, s.haulTime);
              if (e.shackle > 0) { e.shackle = Math.max(e.shackle, s.haulTime); if (!e.boss) { e.onLeash = true; e.haulL = 64; } }
            }
          }
          if (s.noonFor) { /* High Noon: the light itself, no burst */ }
          else if (s.lance) g.lanceBurst(this.x, this.y, this.aim, fd * 2.3, s.flareStun, 1);
          else if (s.blink) {
            // one burst where you stood, one where you land; walls still stop you
            const w = g.screenToWorld(inp.aimX, inp.aimY), cx = Math.cos(this.aim), cy = Math.sin(this.aim);
            let far = (inp.aimDir !== null && inp.aimDir !== undefined) ? 230 : LF.clamp(LF.dist(this.x, this.y, w.x, w.y), 60, 300);
            far = Math.min(far, map.raycast(this.x, this.y, cx, cy, far) - this.r - 3);
            g.flareBurst(this.x, this.y, s.flareRadius * 0.75, fd * 0.6, s.flareStun * 0.6, 0.6, fk);
            if (far > 8) {
              for (let i = 0; i < 5; i++) this.ghosts.push({ x: this.x + cx * far * i / 5, y: this.y + cy * far * i / 5, life: 0.25 });
              this.x += cx * far; this.y += cy * far; map.resolveCircle(this, this.r);
            }
            this.invuln = Math.max(this.invuln, 0.45);
            g.flareBurst(this.x, this.y, s.flareRadius, fd, s.flareStun, 1, fk);
          } else if (s.implode) {
            // the pull comes first, the fire a breath later
            const R2 = s.flareRadius * 1.75;
            fx.ring(this.x, this.y, R2, 12, 0.3, '#ffcf5c', 4); LF.audio.play('charge');
            for (const e of g.enemies) {
              if (e.dead || e.spawnT > 0 || e.boss || e.def.speed === 0) continue;
              const d = LF.dist(this.x, this.y, e.x, e.y);
              if (d > R2 || d < 34) continue;
              const k = Math.min(950, d * 6.2);
              e.kx -= (e.x - this.x) / d * k; e.ky -= (e.y - this.y) / d * k;
            }
            g.delay(0.3, () => { if (!p.dead) g.flareBurst(p.x, p.y, s.flareRadius, fd * 1.5, s.flareStun, 1.2, fk); });
          } else g.flareBurst(this.x, this.y, s.flareRadius, fd, s.flareStun, 1, fk);
          if (s.echo) {
            g.delay(0.5, () => {
              if (p.dead) return;
              if (s.lance) g.lanceBurst(p.x, p.y, p.aim, fd * 1.15, s.flareStun * 0.5, 0.6);
              else g.flareBurst(p.x, p.y, s.flareRadius * 0.9, s.flareDmg * 0.5 * p.damageMul(), s.flareStun * 0.5, 0.6, fk);
            });
          }
          if (s.beacon && g.mode === 'descent') g.floorT = Math.max(0, g.floorT - 3 * s.beacon); // Beacon: every flare holds the dark back, and the Hunters come later
          // The Ring of Fire: fire laid round the flare's edge, where the burst throws what it strikes
          if (s.ringFire) { const RR = s.flareRadius * 0.95, k = Math.max(10, Math.round(RR / 22)); for (let i = 0; i < k; i++) { const a = i * TAU / k; g.addZone({ kind: 'fire', x: this.x + Math.cos(a) * RR, y: this.y + Math.sin(a) * RR, r: 24, life: s.ringFire, dps: 90 }); } }
          // High Noon: the bearer's own light becomes noon for a while
          if (s.noonFor) { this.noonT = s.noonFor; fx.ring(this.x, this.y, 10, s.flareRadius * 1.3, 0.5, '#fff6dc', 5); }
          // The Moth Cloud: a cloud of moths hangs where the flare burst
          if (s.mothCloud) g.addZone({ kind: 'mothcloud', x: this.x, y: this.y, r: s.flareRadius * 0.75, life: s.mothCloud, tick: 0 });
          // The Wax Cast: a shell of wax that takes whole blows, once in 6 seconds at most
          if (s.cast && (this.castCd || 0) <= 0) { this.castN = s.cast; this.castCd = 6; fx.ring(this.x, this.y, 30, this.r + 6, 0.35, '#f0e2c0', 4); LF.audio.play('wax'); }
          if (s.candle) { g.addZone({ kind: 'candle', x: this.x, y: this.y, r: 50, life: s.candle, pulse: 2, fk }); g.addZone({ kind: 'tallow', x: this.x, y: this.y, r: 56, life: s.candle }); }
          if (s.flareMoth) this.swarmMoths(s.flareMoth, 8);
          if (s.waxFlood) g.addZone({ kind: 'tallow', x: this.x, y: this.y, r: s.flareRadius * 0.9, life: 4 + 3 * s.waxFlood });
          if (s.flareFling) this.flingT = 3;
          if (s.flareBolts) for (let i = 0; i < s.flareBolts; i++) g.fireBolt({ x: this.x, y: this.y, angle: i * TAU / s.flareBolts, dmg: s.damage * 0.9 * this.damageMul(), minor: true });
          g.stat('flares');
        } else { LF.audio.play('noLight'); g.hint('Too few embers to flare'); }
      } else if (inp.flare && this.flareT > 0) LF.audio.play('noLight');

      // fire
      this.swingT = Math.max(0, this.swingT - dt);
      if (s.kiln && !s.melee) {
        // hold to stoke, release to throw; a full coal throws itself
        if (inp.fire && this.dashing <= 0) {
          if (this.fireT <= 0) { this.stoke = Math.min(1, this.stoke + dt * s.fireRate / 4.6 / 0.85); if (this.stoke >= 1) this.fire(); }
        } else if (this.stoke > 0 && this.dashing <= 0) { if (this.stoke >= 0.15) this.fire(); else this.stoke = 0; }
      } else if (inp.fire && this.fireT <= 0 && this.dashing <= 0) this.fire();

      // familiars (mirror moths), and the flock the Moth's flare looses: those fly wider and do not stay
      for (let i = this.swarm.length - 1; i >= 0; i--) { this.swarm[i].life -= dt; if (this.swarm[i].life <= 0) { fx.burst(this.swarm[i].x, this.swarm[i].y, 3, { color: '#ffe2b0', speed1: 50, life: 0.3, size: 1.5 }); this.swarm.splice(i, 1); } }
      const flock = this.swarm.length ? this.familiars.concat(this.swarm) : this.familiars;
      for (let i = 0; i < flock.length; i++) {
        const f = flock[i];
        f.a += dt * (f.temp ? 2.8 : 2.1); f.t -= dt;
        const tx = this.x + Math.cos(f.a + i * 2.1) * (f.temp ? 52 : 30), ty = this.y + Math.sin(f.a + i * 2.1) * (f.temp ? 38 : 22) - 8;
        f.x += (tx - f.x) * Math.min(1, dt * 9); f.y += (ty - f.y) * Math.min(1, dt * 9);
        if (f.t <= 0) {
          const e = g.nearestEnemy(f.x, f.y, 300, en => (en.lit || s.mothLight) && !en.intangible);
          if (e) {
            f.t = 0.85;
            g.fireBolt({ x: f.x, y: f.y, angle: Math.atan2(e.y - f.y, e.x - f.x), dmg: s.mothBite * (f.temp ? s.swarmMul : s.mothMul) * (s.cloud ? 1 + 0.05 * flock.length : 1), size: 3, color: f.temp ? '#ffe2b0' : '#e4d4ff', minor: true, moth: true });
          } else f.t = 0.2;
        }
      }
      if (s.wakeful && !g.vows.silence) {
        this.wakeT = (this.wakeT === undefined ? 7 : this.wakeT) - dt;
        if (this.wakeT <= 0) {
          if (g.nearestEnemy(this.x, this.y, s.flareRadius * 0.67, en => en.awake && !en.intangible)) {
            this.wakeT = 7;
            g.flareBurst(this.x, this.y, s.flareRadius * 0.67, s.flareDmg * 0.67 * this.damageMul(), s.flareStun * 0.67, 0.6, LF.LOOK[LF.lookOf(g.meta)].flare);
            if (s.flareMoth) this.swarmMoths(Math.ceil(s.flareMoth / 2), 8);
            if (s.waxFlood) g.addZone({ kind: 'tallow', x: this.x, y: this.y, r: s.flareRadius * 0.6, life: 4 + 3 * s.waxFlood });
            if (s.flareFling) this.flingT = 3;
          } else this.wakeT = 0.25;
        }
      }
      if (s.waxWalk && this.dashing <= 0 && LF.dist2(this.x, this.y, this.wwX || 0, this.wwY || 0) > 30 * 30) { this.wwX = this.x; this.wwY = this.y; g.addZone({ kind: 'tallow', x: this.x, y: this.y, r: 22, life: 3 }); }
      // ember halo
      if (s.orbit) {
        this.orbitA += dt * 3.3 * (1 + s.haloWide);
        for (let i = 0; i < s.orbit; i++) {
          const a = this.orbitA + i * TAU / s.orbit, ox = this.x + Math.cos(a) * 46 * (1 + s.haloWide), oy = this.y + Math.sin(a) * 46 * (1 + s.haloWide);
          for (const e of g.enemies) {
            if (e.dead || e.intangible) continue;
            if (LF.dist2(ox, oy, e.x, e.y) < (e.r + 9) * (e.r + 9)) g.damageEnemy(e, 110 * dt, { type: 'burn', of: 'mantle', quiet: true, noShroud: true });
          }
          if (Math.random() < dt * 20) fx.spawn({ x: ox, y: oy, life: 0.3, size: 2, color: '#ff9a50', vx: LF.rand(-10, 10), vy: LF.rand(-10, 10) });
        }
      }
      // wax wards re-harden; wax skin sets after a quiet spell
      this.waxT += dt; this.shadeCd -= dt; this.shadeT -= dt;
      if (s.buckler && this.ward < s.buckler) { this.wardT += dt * s.wardRegen; if (this.wardT >= 5) { this.wardT = 0; this.ward++; } }
      // whirling chain: a positional shield that never stops moving
      if (s.chainGuard) {
        // Chain is whatever swings round the lantern. Each chain is a weight on a length of links: it strikes what it
        // passes, once a pass. A blow shoves hard and wounds little; only chain relics make it reach farther or
        // land harder. A dash (with the Flail) or a flare (with Cast Chains) flings the chains wide for a moment.
        this.flailT = (this.flailT || 0) - dt; this.flingT = (this.flingT || 0) - dt;
        const flail = s.flail && this.flailT > 0;
        const reach = LF.CENSER_REACH * (1 + s.chainReach);
        // (the Flail and Cast Chains swell the censers for a moment: a bigger thing on the same chain, so whatever is leashed to the bearer stays in its path)
        { const big = (this.flingT > 0 ? 2 : 1) * (flail ? 1.5 : 1); this.guardBig = (this.guardBig || 1) + (big - (this.guardBig || 1)) * Math.min(1, dt * 10); }
        const fat = this.guardBig;
        const hard = (1 + s.chainMul) * (flail ? 1 + 2 * s.flail : 1);
        this.guardR = (this.guardR || reach) + (reach - (this.guardR || reach)) * Math.min(1, dt * 12);
        const R = this.guardR;
        // (clockwise, so the chain's arc trails behind the censer it drives)
        this.guardA += dt * 3.3 * (flail ? 1.6 : 1) * (s.gyre ? 2 : 1);
        for (let i = 0; i < s.chainGuard; i++) {
          const a = this.guardA + i * TAU / s.chainGuard, ca = Math.cos(a), sa = Math.sin(a), gx = this.x + ca * R, gy = this.y + sa * R;
          for (const b of g.ebullets) if (!b.dead && LF.dist2(gx, gy, b.x, b.y) < 16 * fat * 16 * fat) { b.dead = true; fx.burst(b.x, b.y, 4, { color: '#d9b070', speed1: 90, life: 0.25 }); }
          for (const e of g.enemies) {
            if (e.dead || e.intangible || e.spawnT > 0 || g.time - (e.chainAt || -9) < 0.35) continue;
            if (LF.dist2(gx, gy, e.x, e.y) < (e.r + 18 * fat) * (e.r + 18 * fat)) {
              e.chainAt = g.time;
              const blow = s.chainDmg * hard * (1 + s.longSwing * 10 * Math.max(0, R / LF.CENSER_REACH - 1)) * (s.chainWax && e.chill > 0 ? 2 : 1);
              g.damageEnemy(e, blow, { type: 'chain', noShroud: true });
              if (s.incense) this.addLight(s.incense);
              if (s.chainWax) g.waxEnemy(e);
              // the Peal: the blow rings out through whatever stands near
              // every blow jars whatever stands beside the creature it struck; with the Peal it rings out twice as far and twice as hard
              { const R = s.peal ? 88 : 44, part = s.peal ? 0.8 : 0.4; if (s.peal) fx.ring(e.x, e.y, 6, R, 0.25, '#d9b070', 2); for (const o of g.enemies) if (o !== e && !o.dead && !o.intangible && o.spawnT <= 0 && LF.dist2(e.x, e.y, o.x, o.y) < (R + o.r) * (R + o.r)) g.damageEnemy(o, blow * part, { type: 'chain', noShroud: true, quiet: true }); }
              if (e.dead) continue;
              if (!e.boss && e.def.speed > 0) {
                // shoved outward; a hooked chain hauls the creature round with it instead
                const k = 300 * Math.sqrt(hard);
                if (s.hook) { e.kx += (-sa * 0.9 - ca * 0.3) * k; e.ky += (ca * 0.9 - sa * 0.3) * k; }
                else { e.kx += ca * k; e.ky += sa * k; }
              }
              if (s.drag) g.shackle(e);
              if (s.chainLight) e.glow = Math.max(e.glow || 0, 3);
              if (s.chainBurn) g.ignite(e, s.burnBase * 2);
            }
          }
        }
      }
      // long shadow: the dark fights for a lantern that is nearly out
      if (s.shadowLash && this.frac() < 0.5) {
        this.lashT -= dt;
        if (this.lashT <= 0) {
          const e = g.nearestEnemy(this.x, this.y, 230, en => !en.intangible && en.awake);
          if (e) { this.lashT = 1.5; fx.arc(this.x, this.y, e.x, e.y, '#7a52d8', 0.3, 7, 'tendril'); g.damageEnemy(e, s.damage * 2.6 * this.damageMul(), { type: 'shadow', noShroud: true }); }
          else this.lashT = 0.3;
        }
      }
      // storm lantern
      if (s.storm) {
        this.stormT -= dt;
        if (this.stormT <= 0) {
          const lit = g.enemies.filter(e => !e.dead && e.lit && !e.intangible && e.spawnT <= 0);
          if (lit.length) {
            const e = LF.pick(lit);
            this.stormT = s.stormCd;
            // a cinder of the Sun, falling from where it used to hang
            for (let k = 0; k < 6; k++) fx.spawn({ x: e.x + LF.rand(-3, 3), y: e.y - 30 - k * 26, vy: 620, life: 0.1 + k * 0.03, size: 4.5 - k * 0.5, color: k < 2 ? '#fff2cc' : '#ffb347', drag: 0 });
            g.damageEnemy(e, 100, { type: 'cinder', of: 'ground', crit: true });
            g.addFlash(e.x, e.y, 120, 0.3, '#ffb347'); fx.ring(e.x, e.y, 4, 36, 0.25, '#ffb347', 3);
            fx.burst(e.x, e.y, 12, { color: ['#ffb347', '#fff2cc'], speed1: 210, life: 0.4 });
            LF.audio.play('cinder'); g.shake(3);
          } else this.stormT = 0.3;
        }
      }
      // hearth
      if (s.hearth && g.threat <= 0) this.addLight(1.7 * dt);
      // Glowing Flare: embers come back while the bearer stands in the light a flare left
      this.inGlow = false;
      if (s.flareGlow) for (const z of g.zones) if (z.flare && !z.dead && LF.dist2(this.x, this.y, z.x, z.y) < z.r * z.r) {
        this.inGlow = true; this.addLight(s.flareGlow * s.linger * dt);
        if (Math.random() < dt * 7) fx.spawn({ x: this.x + LF.rand(-12, 12), y: this.y + LF.rand(-2, 12), vx: LF.rand(-6, 6), vy: -34, life: 0.7, size: 2.2, color: LF.pick(['#ffe9a8', '#fff6dc']), drag: 1 });
        break;
      }

      this.surge(dt);

      // blows burning through: each takes its light over a second (or as long as the Slow Dusk makes it)
      if (this.hurts.length && !this.dead) {
        let last = null;
        for (const h of this.hurts) { const d = Math.min(h.left, h.rate * dt); h.left -= d; this.light -= d; last = h; }
        this.hurts = this.hurts.filter(h => h.left > 1e-6);
        if (this.light <= 0) { this.light = 0; g.run.lastHit = last.name; g.outOfLight({ heartless: last.heartless }); }
      }

      // drain
      if (g.drainActive && !(s.noDrainLow && this.frac() < 0.3)) {
        // The flame burns itself down, quickly, all the way to nothing: away from a fire, standing still is dying.
        // A great shadow's hall is slower, since the only fuel there is what the shadow sheds.
        const drain = (0.9 + 0.05 * g.floor) * s.drainMul * g.diff.drain * g.omenMul('drain') * (g.vows.haste ? 1.5 : 1) * (g.boss && !g.boss.dead ? 0.6 : 1);
        this.light -= drain * dt;
        if (this.light <= 0) { this.light = 0; g.hurtPlayer(0.01, { name: 'the dark', force: true, steal: true }); }
      }

      // light radius
      this.dim = Math.max(0, this.dim - dt * 1.4);
      // Full light is never universal light: even a brimming lantern leaves most of the screen dark.
      // Light above 100 widens the pool only a little, and nothing pushes it past the cap.
      const base = 44 + 140 * Math.pow(Math.min(this.light, 100) / 100, 0.9) + Math.min(20, Math.max(0, this.light - 100) * 0.25);
      this.lightRT = Math.min(s.radiusCap || 250, base * s.radiusMul * (this.vigilOn ? 1.15 : 1) * (g.boss && !g.boss.dead ? 1.4 : 1)) * (this.noonT > 0 ? 1.5 : 1) * g.snuffMul * g.omenMul('radius') * (1 - 0.2 * this.dim) * (1 - 0.16 * (g.dread || 0));
      this.lightR += (this.lightRT - this.lightR) * Math.min(1, dt * 6);

      // low-light heartbeat
      if (this.frac() < 0.25) {
        this.beatT -= dt;
        if (this.beatT <= 0) { this.beatT = 0.9; LF.audio.play('lowLight'); }
      }
    }

    // Rite of the Blade: the main attack as an arc of fire around the aim.
    // Relics that would have shaped bolts lengthen or widen the blade instead, and whatever a bolt does on landing
    // (a link of flame, a bursting coal, kindling a brazier, breaking an urn or a jar) a blow does too.
    swing() {
      const g = this.g, s = this.stats;
      this.fireT = 1.9 / s.fireRate; this.shots++; this.recoil = 1;
      const charged = this.charge, mul = this.damageMul() * (1 + 0.6 * charged);
      if (charged) { this.charge = 0; fx.ring(this.x, this.y, 6, 30, 0.25, '#fff0b8', 3); }
      // A narrow cut, not a wide sweep: it has to be aimed, and it has to be close. In return it hits very hard.
      // what makes bolts carry farther (the Wick, for one) lengthens the blade by as much, within limits
      const reach = (104 + s.boltSize * 3 + 12 * (s.pierce + s.bounce + s.homing) + (s.boltSpeed - 560) * 0.03) * LF.clamp(s.boltLife / 0.72, 0.85, 1.4);
      const half = Math.min(1.25, 0.5 + 0.14 * (s.multishot - 1));
      this.swingT = 0.16; this.swingA = this.aim; this.swingHalf = half; this.swingReach = reach; this.swingDir = -(this.swingDir || 1);
      const dmg = s.damage * 4.4 * mul * s.bladeMul * (s.melee ? s.fireAll : 1);
      let hits = 0, first = null, firstD = 1e9;
      const struck = new Set();
      for (const e of g.enemies) {
        if (e.dead || e.spawnT > 0 || e.intangible) continue;
        const d = LF.dist(this.x, this.y, e.x, e.y);
        if (d > reach + e.r) continue;
        const a = Math.atan2(e.y - this.y, e.x - this.x);
        if (d > e.r + 8 && Math.abs(LF.angDiff(this.aim, a)) > half) continue;
        const crit = Math.random() < s.crit;
        g.damageEnemy(e, dmg * (crit ? s.critMul : 1), { type: 'bolt', crit, angle: a, x: e.x, y: e.y });
        g.boltEffects(e, true);
        hits++; struck.add(e);
        if (d < firstD) { firstD = d; first = e; }
      }
      // Link of Flame and Bursting Coal: once a blow, from the nearest creature it landed on
      if (first && s.chain > 0) {
        let from = first, hops = s.chain;
        while (hops-- > 0) {
          const nx = g.nearestEnemy(from.x, from.y, 140, en => !struck.has(en) && !en.intangible && en.spawnT <= 0);
          if (!nx) break;
          struck.add(nx);
          fx.arc(from.x, from.y, nx.x, nx.y, '#ffb070', 0.3, 3, 'chain'); LF.audio.play('chain');
          g.damageEnemy(nx, dmg * 0.6, { type: 'chain' });
          from = nx;
        }
      }
      if (first && s.split > 0) {
        const a = Math.atan2(first.y - this.y, first.x - this.x);
        for (const off of [-0.5, 0.5]) g.fireBolt({ x: first.x, y: first.y, angle: a + off, dmg: dmg * 0.55, noSplit: true, minor: true, hit: new Set([first]), size: Math.max(2.5, s.boltSize * 0.75) });
      }
      // the blade cuts enemy shots out of the air
      for (const b of g.ebullets) {
        if (b.dead) continue;
        const d = LF.dist(this.x, this.y, b.x, b.y);
        if (d > reach + 6 || Math.abs(LF.angDiff(this.aim, Math.atan2(b.y - this.y, b.x - this.x))) > half) continue;
        b.dead = true; fx.burst(b.x, b.y, 4, { color: '#ffb070', speed1: 90, life: 0.25 });
      }
      // and it does a bolt's work on what stands in the way: it kindles a cold brazier and breaks urns and oil jars
      for (const pr of g.props) {
        if (pr.kind === 'brazier' ? pr.lit : pr.kind === 'urn' || pr.kind === 'oiljar' ? pr.broken : true) continue;
        const d = LF.dist(this.x, this.y, pr.x, pr.y);
        if (d > reach + 8 || (d > 20 && Math.abs(LF.angDiff(this.aim, Math.atan2(pr.y - this.y, pr.x - this.x))) > half)) continue;
        if (pr.kind === 'urn') g.breakUrn(pr);
        else if (pr.kind === 'oiljar') g.delay(0.1, () => g.breakJar(pr));
        else {
          // a blow is worth what the bolts it replaces would have been
          pr.kindle = (pr.kindle || 0) + 1.9 * (s.kindleMul || 1) * 0.95 / Math.max(1.5, s.fireRate); pr.kindleT = 2.5;
          fx.burst(pr.x, pr.y - 8, 5, { color: ['#ffb347', '#ffe9b8'], speed1: 90, life: 0.35, size: 1.8, grav: -60 });
          LF.audio.play('sizzle');
        }
      }
      if (hits) { this.addLight(Math.min(2.4, 0.6 * hits)); g.shake(2); }
      if (s.novaEvery && this.shots % s.novaEvery === 0) {
        for (let i = 0; i < 8; i++) g.fireBolt({ x: this.x, y: this.y, angle: this.aim + i * TAU / 8 + 0.39, dmg: s.damage * mul * 0.7, minor: true });
        fx.ring(this.x, this.y, 6, 40, 0.25, '#ffe08a', 2);
      }
      if (s.overburn) this.light = Math.max(2, this.light - 0.16);
      LF.audio.play('slash');
      fx.burst(this.x + Math.cos(this.aim) * reach * 0.75, this.y + Math.sin(this.aim) * reach * 0.75, hits ? 14 : 7, { color: ['#ff9a40', '#ffd9a0', '#fff'], angle: this.aim, spread: 1.4, speed0: 80, speed1: 260, life: 0.3, size: 2 });
      g.stat('shots');
    }
    fire() {
      const g = this.g, s = this.stats;
      if (s.melee) { this.swing(); return; }
      const mx0 = this.x + Math.cos(this.aim) * 15, my0 = this.y + Math.sin(this.aim) * 15;
      // The Thrown Censer: one censer out on its chain at a time; it comes back before it is thrown again
      if (s.thrown) {
        if (this.thrownOut) return;
        this.thrownOut = true; this.fireT = 0.1; this.shots++; this.recoil = 1;
        g.fireBolt({ x: mx0, y: my0, angle: this.aim, dmg: (s.damage * this.damageMul() * s.thrown + s.chainDmg * 0.6) * (1 + s.chainMul) * s.chainAll, size: 6.5, speed: 400, life: 9, pierce: 99, ret: 150 * (1 + s.chainReach), color: '#d9b070' });
        LF.audio.play('chain'); g.stat('shots'); return;
      }
      // The Gout: wax lobbed to where the bearer aims
      if (s.gout) {
        this.fireT = 1 / (s.fireRate * 0.55); this.shots++; this.recoil = 1;
        const far = LF.clamp(this.aimDist || 150, 50, 200), sp = 380;
        g.fireBolt({ x: mx0, y: my0, angle: this.aim, dmg: s.damage * this.damageMul() * s.gout * s.waxAll, size: 6, speed: sp, life: far / sp, pierce: 99, lob: 46, color: '#f0e2c0' });
        LF.audio.play('heavyShoot'); g.stat('shots'); return;
      }
      // The Kiln: one stoked coal instead of a stream of bolts
      const coal = s.kiln ? Math.max(0.15, this.stoke) : 0;
      this.stoke = 0;
      this.fireT = coal ? 0.14 : 1 / s.fireRate; this.shots++; this.recoil = 1;
      const charged = this.charge;
      const n = s.multishot, mul = this.damageMul() * (1 + 0.6 * charged);
      if (charged) { this.charge = 0; fx.ring(this.x, this.y, 6, 30, 0.25, '#fff0b8', 3); }
      const mx = this.x + Math.cos(this.aim) * 15, my = this.y + Math.sin(this.aim) * 15;
      for (let i = 0; i < n; i++) {
        const a = this.aim + (i - (n - 1) / 2) * s.spread + LF.rand(-0.018, 0.018);
        if (coal) g.fireBolt({ x: mx, y: my, angle: a, dmg: s.damage * mul * (1 + 4 * coal) * s.kiln * s.fireAll, size: s.boltSize * (1.4 + 1.5 * coal), speed: s.boltSpeed * 0.78, coal, color: '#ffb347' });
        // The Ray: at once, through everything, and no farther than the lantern's light
        else if (s.ray) { const sp = s.boltSpeed * 3.2; g.fireBolt({ x: mx, y: my, angle: a, dmg: s.damage * mul * s.ray * s.lightAll, speed: sp, life: Math.max(70, this.lightR * 0.95) / sp, pierce: 99, ray: true, color: '#fff6dc' }); }
        else g.fireBolt({ x: mx, y: my, angle: a, dmg: s.damage * mul, size: charged ? s.boltSize * (1 + 0.18 * charged) : undefined });
      }
      if (s.novaEvery && this.shots % s.novaEvery === 0) {
        for (let i = 0; i < 8; i++) g.fireBolt({ x: this.x, y: this.y, angle: this.aim + i * TAU / 8 + 0.39, dmg: s.damage * mul * 0.7, minor: true });
        fx.ring(this.x, this.y, 6, 40, 0.25, '#ffe08a', 2);
      }
      if (s.overburn) this.light = Math.max(2, this.light - 0.16);
      LF.audio.play(s.boltSize > 5 ? 'heavyShoot' : 'shoot');
      fx.burst(mx, my, 3, { color: '#ffe9b8', angle: this.aim, spread: 0.8, speed0: 60, speed1: 180, life: 0.16, size: 1.6 });
      g.stat('shots');
    }

    draw(ctx) {
      const g = this.g;
      // dash ghosts
      for (const gh of this.ghosts) {
        ctx.globalAlpha = Math.max(0, gh.life / 0.25) * 0.35;
        ctx.fillStyle = '#ffd9a0'; ctx.beginPath(); ctx.arc(gh.x, gh.y, this.r, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (this.invuln > 0 && this.dashing <= 0 && Math.floor(g.time * 24) % 2 === 0) ctx.globalAlpha = 0.45;
      const lp = LF.drawFigure(ctx, LF.lookOf(g.meta), { x: this.x, y: this.y, aim: this.aim, mv: Math.atan2(this.vy, this.vx), sp: Math.hypot(this.vx, this.vy), bob: this.bob, t: g.time, flash: this.hurtFlash > 0, hurt: this.hurtFlash, recoil: this.recoil, dash: this.dashing > 0, frac: this.frac(), st: this.fig || (this.fig = {}) });
      const lx = lp.x, ly = lp.y;
      ctx.globalAlpha = 1;
      const st = this.stats;
      if (st.buckler) {
        // the wax buckler: one pale segment per blow it can still take, across the arc it covers
        const n = st.buckler, a0 = this.aim - 1.0, span = 2.0 / n;
        ctx.lineCap = 'round'; ctx.lineWidth = 3.5;
        for (let i = 0; i < n; i++) {
          ctx.strokeStyle = i < this.ward ? 'rgba(240,226,192,0.95)' : 'rgba(240,226,192,0.16)';
          ctx.beginPath(); ctx.arc(this.x, this.y, this.r + 10, a0 + i * span + 0.06, a0 + (i + 1) * span - 0.06); ctx.stroke();
        }
      }
      if (this.castN > 0) { ctx.fillStyle = 'rgba(240,226,192,0.28)'; ctx.strokeStyle = 'rgba(240,226,192,0.9)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(this.x, this.y, this.r + 7, 0, TAU); ctx.fill(); ctx.stroke(); }
      if (st.waxSkin && this.waxT >= Math.max(2.5, 8 - 2 * st.waxSkin)) { ctx.strokeStyle = 'rgba(240,226,192,0.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(this.x, this.y, this.r + 4, 0, TAU); ctx.stroke(); }
      if (st.chainGuard) {
        for (let i = 0; i < st.chainGuard; i++) {
          const a = this.guardA + i * TAU / st.chainGuard, GR = this.guardR || LF.CENSER_REACH;
          drawCenser(ctx, this.x, this.y, this.x + Math.cos(a) * GR, this.y + Math.sin(a) * GR, censerCol(st), 0.42, this.guardBig || 1);
        }
      }
      if (this.shadeT > 0) { ctx.fillStyle = 'rgba(40,20,80,0.55)'; ctx.beginPath(); ctx.arc(this.x, this.y, this.r + 3, 0, TAU); ctx.fill(); }
      this.lx = lx; this.ly = ly;
    }
    drawGlow(ctx) {
      const g = this.g, f = this.frac();
      // lantern core
      const fl = 1 + Math.sin(g.time * 17) * 0.06 + Math.sin(g.time * 7.3) * 0.05;
      const r = (LF.lookOf(g.meta) === 'candle' ? 4 + 3.5 * f : 9 + 9 * f) * fl;   // a flame on the head must not wash out the body under it
      const gr = ctx.createRadialGradient(this.lx, this.ly, 0, this.lx, this.ly, r);
      gr.addColorStop(0, 'rgba(255,244,214,0.95)'); gr.addColorStop(0.4, 'rgba(255,190,96,0.5)'); gr.addColorStop(1, 'rgba(255,150,60,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(this.lx, this.ly, r, 0, TAU); ctx.fill();
      if (this.swingT > 0) {
        // the blade: a tongue of fire swept across the aim, its after-images trailing behind the edge
        const k = 1 - this.swingT / 0.16, dir = this.swingDir || 1, R = this.swingReach, sweep = this.swingHalf + 0.3;
        const head = this.swingA + dir * (k * 2 - 1) * sweep, X = this.x, Y = this.y;
        for (let j = 5; j >= 0; j--) {
          const a = head - dir * j * 0.15 * (0.4 + k), f = 1 - j / 6, w = 0.2 * f + 0.05;
          ctx.fillStyle = j === 0 ? `rgba(255,236,190,${0.95 - 0.4 * k})` : `rgba(255,${110 + 22 * j},40,${(0.55 - 0.3 * k) * f})`;
          ctx.beginPath();
          ctx.moveTo(X + Math.cos(a - w) * 16, Y + Math.sin(a - w) * 16);
          ctx.quadraticCurveTo(X + Math.cos(a - w * 0.9) * R * 0.62, Y + Math.sin(a - w * 0.9) * R * 0.62, X + Math.cos(a) * R, Y + Math.sin(a) * R);
          ctx.quadraticCurveTo(X + Math.cos(a + w * 0.9) * R * 0.62, Y + Math.sin(a + w * 0.9) * R * 0.62, X + Math.cos(a + w) * 16, Y + Math.sin(a + w) * 16);
          ctx.closePath(); ctx.fill();
        }
        ctx.strokeStyle = `rgba(255,255,255,${0.9 - 0.5 * k})`; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(X + Math.cos(head) * 18, Y + Math.sin(head) * 18); ctx.lineTo(X + Math.cos(head) * R * 0.97, Y + Math.sin(head) * R * 0.97); ctx.stroke();
        LF.drawGlow(ctx, '#ff9a40', X + Math.cos(head) * R * 0.7, Y + Math.sin(head) * R * 0.7, R * 0.5, 0.35 * (1 - k));
      }
      if (this.stoke > 0) {
        const sr = 7 + 15 * this.stoke;
        const sg = ctx.createRadialGradient(this.lx, this.ly, 0, this.lx, this.ly, sr);
        sg.addColorStop(0, `rgba(255,236,190,${0.5 + 0.45 * this.stoke})`); sg.addColorStop(0.5, 'rgba(255,140,50,0.45)'); sg.addColorStop(1, 'rgba(255,90,20,0)');
        ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(this.lx, this.ly, sr, 0, TAU); ctx.fill();
      }
      // each censer burns: a small light of its own
      for (let i = 0; i < this.stats.chainGuard; i++) { const a = this.guardA + i * TAU / this.stats.chainGuard, GR = this.guardR || LF.CENSER_REACH; LF.drawGlow(ctx, censerCol(this.stats), this.x + Math.cos(a) * GR, this.y + Math.sin(a) * GR, 17 * (this.guardBig || 1), 0.6); }
      if (this.vigilOn) { ctx.strokeStyle = 'rgba(255,241,193,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(this.x, this.y, 20 + Math.sin(g.time * 4) * 2, 0, TAU); ctx.stroke(); }
      // familiars, and the Moth's flock (warm, and fading as their time runs out)
      for (const fm of (this.swarm.length ? this.familiars.concat(this.swarm) : this.familiars)) {
        const w = Math.sin(g.time * 30 + fm.a) * 3;
        ctx.fillStyle = fm.temp ? `rgba(255,226,176,${0.9 * Math.min(1, fm.life / 0.8)})` : 'rgba(228,212,255,0.9)';
        ctx.beginPath(); ctx.ellipse(fm.x - 3, fm.y, 3.5, 2 + Math.abs(w) * 0.6, -0.5, 0, TAU); ctx.ellipse(fm.x + 3, fm.y, 3.5, 2 + Math.abs(w) * 0.6, 0.5, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(fm.x, fm.y, 1.4, 0, TAU); ctx.fill();
      }
      // halo embers
      const s = this.stats;
      for (let i = 0; i < s.orbit; i++) {
        const a = this.orbitA + i * TAU / s.orbit, ox = this.x + Math.cos(a) * 46 * (1 + s.haloWide), oy = this.y + Math.sin(a) * 46 * (1 + s.haloWide);
        const g2 = ctx.createRadialGradient(ox, oy, 0, ox, oy, 12);
        g2.addColorStop(0, 'rgba(255,230,180,1)'); g2.addColorStop(0.35, 'rgba(255,140,60,0.7)'); g2.addColorStop(1, 'rgba(255,90,20,0)');
        ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(ox, oy, 12, 0, TAU); ctx.fill();
      }
    }
  }
  LF.Player = Player;

  // ------------------------------------------------------------------ Player bolts
  class Bolt {
    constructor(g, o) {
      const s = g.player.stats;
      this.x = o.x; this.y = o.y;
      const sp = o.speed || s.boltSpeed;
      this.vx = Math.cos(o.angle) * sp; this.vy = Math.sin(o.angle) * sp;
      this.speed = sp;
      this.dmg = o.dmg; this.r = o.size || s.boltSize;
      this.life = o.life || s.boltLife * (s.boltSpeed / 560 > 1 ? 1.1 : 1);
      this.pierce = o.pierce === undefined ? s.pierce : o.pierce;
      this.bounce = o.bounce === undefined ? s.bounce : o.bounce;
      this.chain = o.minor ? 0 : s.chain;
      this.split = o.minor || o.noSplit ? 0 : s.split;
      this.homing = s.homing;
      this.minor = !!o.minor; this.moth = !!o.moth;
      this.color = o.color || s.boltColor;
      this.hit = o.hit || new Set();
      this.px = this.x; this.py = this.y; this.dead = false; this.dist = 0; this.coal = o.coal || 0;
      // forms: a ray, a lobbed gout (lob: the radius it lands with), a thrown censer (ret: how far it goes before it is hauled back), a moth
      this.ray = !!o.ray; this.lob = o.lob || 0; this.ret = o.ret || 0; this.back = false; this.maxLife = this.life; this.own = g.player;
      this.wing = !o.minor && !o.moth && !this.lob && !this.ret ? s.wing : 0;
    }
    // a gout comes down: it strikes everything under it and leaves its wax
    land(g) {
      const R = this.lob;
      fx.ring(this.x, this.y, 6, R, 0.25, '#f0e2c0', 3); fx.burst(this.x, this.y, 10, { color: ['#f0e2c0', '#d8c28a', '#fff'], speed1: 150, life: 0.4, size: 2.4, glow: false }); LF.audio.play('wax');
      for (const e of g.enemies) { if (e.dead || e.intangible || e.spawnT > 0) continue; if (LF.dist2(this.x, this.y, e.x, e.y) < (R + e.r) * (R + e.r)) this.onHit(g, e); }
      g.addZone({ kind: 'tallow', x: this.x, y: this.y, r: R, life: 2.2 });
    }
    update(dt, g) {
      this.life -= dt; this.dist += this.speed * dt;
      if (this.life <= 0) { if (this.lob) this.land(g); this.dead = true; return; }
      if (this.lob) {
        // in the air: it meets nothing until it lands (a wall stops it short)
        this.px = this.x; this.py = this.y;
        const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
        if (g.map.solidAt(nx, ny)) { this.land(g); this.dead = true; return; }
        this.x = nx; this.y = ny; return;
      }
      if (this.ret) {
        const p = g.player;
        if (!this.back && this.dist >= this.ret) { this.back = true; this.hit.clear(); }
        if (this.back) {
          const a = Math.atan2(p.y - this.y, p.x - this.x); this.vx = Math.cos(a) * this.speed * 1.2; this.vy = Math.sin(a) * this.speed * 1.2;
          if (LF.dist2(this.x, this.y, p.x, p.y) < 20 * 20) { this.dead = true; return; }
        }
      }
      if (Math.random() < dt * 14) fx.spawn({ x: this.x, y: this.y, vx: -this.vx * 0.12 + LF.rand(-30, 30), vy: -this.vy * 0.12 + LF.rand(-30, 30) - 12, life: 0.3, size: 1.5, color: this.color === '#d6f6ff' || this.color === '#cfeaff' ? '#a8d4ff' : '#ff9a40', drag: 3 });
      if (this.homing || this.wing) {
        const e = g.nearestEnemy(this.x, this.y, this.wing ? 230 : 170, en => !en.intangible && !this.hit.has(en));
        if (e) {
          const cur = Math.atan2(this.vy, this.vx), want = Math.atan2(e.y - this.y, e.x - this.x);
          if (Math.abs(LF.angDiff(cur, want)) < (this.wing ? 1.6 : 1.2)) {
            const na = LF.turnToward(cur, want, (this.wing ? 6 : 3.4) * dt);
            this.vx = Math.cos(na) * this.speed; this.vy = Math.sin(na) * this.speed;
          }
        }
      }
      this.px = this.x; this.py = this.y;
      const steps = this.ray ? 5 : 2;
      for (let i = 0; i < steps && !this.dead; i++) {
        const ox = this.x, oy = this.y;
        this.x += this.vx * dt / steps; this.y += this.vy * dt / steps;
        if (g.map.solidAt(this.x, this.y) && !(this.ret && this.back)) {
          if (this.ret) { this.back = true; this.hit.clear(); this.x = ox; this.y = oy; break; } // a thrown censer that meets a wall is hauled back from there
          if (this.bounce > 0) {
            this.bounce--;
            const hitX = g.map.solidAt(this.x, oy), hitY = g.map.solidAt(ox, this.y);
            if (hitX || (!hitX && !hitY)) this.vx = -this.vx;
            if (hitY || (!hitX && !hitY)) this.vy = -this.vy;
            this.x = ox; this.y = oy; this.hit.clear();
            fx.burst(this.x, this.y, 3, { color: this.color, speed1: 80, life: 0.2, size: 1.5 });
          } else {
            this.dead = true;
            if (!this.moth && g.player.stats.boltLight) g.lightPool(ox, oy);
            fx.burst(ox, oy, 4, { color: this.color, speed1: 90, life: 0.22, size: 1.5, angle: Math.atan2(-this.vy, -this.vx), spread: 2 });
            return;
          }
        }
        // orbs (shootable enemy projectiles)
        for (const eb of g.ebullets) {
          if (eb.dead || !eb.orb) continue;
          if (LF.dist2(this.x, this.y, eb.x, eb.y) < (eb.r + this.r + 3) * (eb.r + this.r + 3)) {
            eb.dead = true; fx.burst(eb.x, eb.y, 8, { color: eb.color, speed1: 100, life: 0.3, glow: true });
            LF.audio.play('hit');
            if (this.pierce > 0) this.pierce--; else { this.dead = true; return; }
          }
        }
        for (const e of g.enemies) {
          if (e.dead || e.intangible || e.spawnT > 0 || this.hit.has(e)) continue;
          const rr = e.r + this.r + 2;
          if (LF.dist2(this.x, this.y, e.x, e.y) < rr * rr) { this.onHit(g, e); if (this.dead) return; }
        }
      }
      if (Math.random() < 0.5) fx.spawn({ x: this.x, y: this.y, life: 0.18, size: this.r * 0.5, color: this.color, drag: 4 });
    }
    onHit(g, e) {
      const s = g.player.stats;
      const crit = Math.random() < s.crit + s.keen * (e.depth || 0) || !!(s.stunCrit && e.stun > 0 && !this.moth);
      // each mark the lantern has put on a creature multiplies what a bolt does to it, and the marks multiply each other
      let up = 1;
      // (and a mark brings its whole theme to the bolt: what multiplies fire multiplies a bolt on a burning creature, and so on)
      if (s.stoke && e.burn > 0) up *= (1 + s.stoke) * s.fireAll;
      if (s.brittle && e.chill > 0) up *= (1 + s.brittle) * s.waxAll;
      if (s.taut && (e.shackle > 0 || g.time - (e.chainAt || -9) < 2)) up *= (1 + s.taut) * s.chainAll;
      if (s.harry && g.time - (e.bitten || -9) < 2) up *= (1 + s.harry) * s.mothAll;
      const dmg = this.dmg * up * (crit ? s.critMul * s.lightAll : 1) * (s.lodestar ? 1 + Math.min(0.8, this.dist / 420 * 0.8) : 1);
      const ang = Math.atan2(this.vy, this.vx);
      this.hit.add(e);
      // a moth's bite: its own damage, and whatever the moths have been taught to carry
      if (this.moth) { g.damageEnemy(e, this.dmg, { type: 'moth', angle: ang, x: this.x, y: this.y, noShroud: !!s.mothLight }); g.mothBite(e); this.dead = true; return; }
      g.damageEnemy(e, dmg, { type: 'bolt', crit, angle: ang, x: this.x, y: this.y });
      g.boltEffects(e, !this.minor);
      if (this.ret) g.censerStruck(e, dmg);   // a thrown censer's blow is a censer's blow
      if (this.wing && !e.dead) { g.damageEnemy(e, s.mothBite * s.mothMul * this.wing, { type: 'moth', quiet: true, noShroud: !!s.mothLight }); g.mothBite(e); } // a winged bolt bites as a moth does
      if (this.chain > 0) {
        let from = e, hops = this.chain;
        const seen = new Set(this.hit);
        while (hops-- > 0) {
          const nx = g.nearestEnemy(from.x, from.y, 140, en => !seen.has(en) && !en.intangible && en.spawnT <= 0);
          if (!nx) break;
          seen.add(nx);
          fx.arc(from.x, from.y, nx.x, nx.y, '#ffb070', 0.3, 3, 'chain'); LF.audio.play('chain');
          g.damageEnemy(nx, this.dmg * 0.6, { type: 'chain' });
          from = nx;
        }
      }
      if (this.split > 0) {
        this.split = 0;
        for (const off of [-0.5, 0.5]) g.fireBolt({ x: this.x, y: this.y, angle: ang + off, dmg: this.dmg * 0.55, noSplit: true, minor: true, hit: new Set([e]), size: Math.max(2.5, this.r * 0.75) });
      }
      if (this.pierce > 0) { this.pierce--; if (!this.ray && !this.ret && !this.lob) this.dmg *= 0.85; }
      else this.dead = true;
    }
    draw(ctx) {
      if (this.lob) {
        // a gout in the air: its shadow on the floor, and the wax above it
        const t = 1 - this.life / this.maxLife, h = Math.sin(Math.PI * LF.clamp(t, 0, 1)) * 38;
        ctx.fillStyle = 'rgba(240,226,192,0.25)'; ctx.beginPath(); ctx.ellipse(this.x, this.y, 7, 4, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#f6ecd0'; ctx.beginPath(); ctx.ellipse(this.x, this.y - h, 6.5, 7.5, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(this.x - 2, this.y - h - 2, 2, 0, TAU); ctx.fill();
        return;
      }
      if (this.ret) {
        // a thrown censer: the chain back to the hand, and the weight
        const p = this.own;
        if (LF.dist2(p.x, p.y, this.x, this.y) > 14 * 14) drawCenser(ctx, p.x, p.y, this.x, this.y, censerCol(p.stats));
        LF.drawGlow(ctx, censerCol(p.stats), this.x, this.y, 24, 0.6);
        return;
      }
      const a = Math.atan2(this.vy, this.vx), cx = Math.cos(a), cy = Math.sin(a), len = (16 + this.r * 3.2) * (this.ray ? 4 : 1);
      const cool = this.color === '#d6f6ff' || this.color === '#cfeaff';
      ctx.lineCap = 'round';
      // outer flame, licking back along the path
      let gr = ctx.createLinearGradient(this.x, this.y, this.x - cx * len, this.y - cy * len);
      gr.addColorStop(0, cool ? 'rgba(120,190,255,0.85)' : 'rgba(255,128,40,0.9)'); gr.addColorStop(1, cool ? 'rgba(80,140,255,0)' : 'rgba(255,60,16,0)');
      ctx.strokeStyle = gr; ctx.lineWidth = this.r * 2.3;
      ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this.x - cx * len, this.y - cy * len); ctx.stroke();
      // inner flame in the lantern's own colour
      gr = ctx.createLinearGradient(this.x, this.y, this.x - cx * len * 0.65, this.y - cy * len * 0.65);
      gr.addColorStop(0, this.color); gr.addColorStop(1, 'rgba(255,200,110,0)');
      ctx.strokeStyle = gr; ctx.lineWidth = this.r * 1.3;
      ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this.x - cx * len * 0.65, this.y - cy * len * 0.65); ctx.stroke();
      ctx.fillStyle = '#fffbe8'; ctx.beginPath(); ctx.arc(this.x, this.y, this.r * 0.8, 0, TAU); ctx.fill();
    }
  }
  LF.Bolt = Bolt;

  // ------------------------------------------------------------------ Enemy bullets
  class EBullet {
    constructor(o) {
      this.x = o.x; this.y = o.y;
      const sp = o.speed || 180;
      this.vx = Math.cos(o.angle) * sp; this.vy = Math.sin(o.angle) * sp; this.speed = sp;
      this.r = o.size || 5; this.dmg = o.dmg || 8; this.life = o.life || 4; this.max = this.life;
      this.color = o.color || '#b26bff'; this.homing = o.homing || 0; this.orb = !!o.orb;
      this.accel = o.accel || 0; this.ghost = !!o.ghost; this.spin = o.spin || 0; this.steal = !!o.steal;
      this.dead = false; this.t = 0;
    }
    update(dt, g) {
      this.life -= dt; this.t += dt;
      if (this.life <= 0) { this.dead = true; return; }
      const p = g.player;
      if (this.homing) {
        const cur = Math.atan2(this.vy, this.vx), want = Math.atan2(p.y - this.y, p.x - this.x);
        const na = LF.turnToward(cur, want, this.homing * dt);
        this.vx = Math.cos(na) * this.speed; this.vy = Math.sin(na) * this.speed;
      }
      if (this.spin) {
        const cur = Math.atan2(this.vy, this.vx) + this.spin * dt;
        this.vx = Math.cos(cur) * this.speed; this.vy = Math.sin(cur) * this.speed;
      }
      if (this.accel) {
        this.speed = Math.max(20, this.speed + this.accel * dt);
        const a = Math.atan2(this.vy, this.vx);
        this.vx = Math.cos(a) * this.speed; this.vy = Math.sin(a) * this.speed;
      }
      this.x += this.vx * dt; this.y += this.vy * dt;
      if (!this.ghost && g.map.solidAt(this.x, this.y)) {
        this.dead = true;
        fx.burst(this.x, this.y, 4, { color: this.color, speed1: 70, life: 0.25, size: 1.6 });
        return;
      }
      if (!p.dead && LF.dist2(this.x, this.y, p.x, p.y) < (this.r + p.r - 2) * (this.r + p.r - 2)) {
        if (p.dashing > 0) return; // dash straight through
        if (p.invuln <= 0) {
          if (p.stats.reflect && Math.random() < p.stats.reflect) {
            g.fireBolt({ x: this.x, y: this.y, angle: Math.atan2(-this.vy, -this.vx), dmg: p.stats.damage * 2.2, minor: true, color: '#ffe9b8' });
            fx.text(p.x, p.y - 22, 'TURNED', '#ffe9b8', 10, 0.6); LF.audio.play('crit');
          } else g.hurtPlayer(this.dmg, { x: this.x, y: this.y, bullet: true });
        }
        this.dead = true;
        fx.burst(this.x, this.y, 6, { color: this.color, speed1: 90, life: 0.3 });
      }
    }
    // Drawn after the darkness and the glow pass, in plain colour: a black bead with a thin red rim.
    // It casts no light, so it can never be mistaken for an ember.
    draw(ctx, g) {
      const r = this.r * (1 + Math.sin(g.time * 14 + this.x) * 0.08) * 1.15;
      const sp = Math.hypot(this.vx, this.vy) || 1, tx = -this.vx / sp, ty = -this.vy / sp;
      ctx.strokeStyle = 'rgba(8,3,16,0.6)'; ctx.lineWidth = r * 1.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this.x + tx * r * 3.2, this.y + ty * r * 3.2); ctx.stroke();
      ctx.fillStyle = 'rgba(10,4,20,0.5)'; ctx.beginPath(); ctx.arc(this.x, this.y, r * 1.7, 0, TAU); ctx.fill();
      ctx.fillStyle = '#04020a'; ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = this.orb ? 'rgba(235,225,255,0.9)' : 'rgba(255,84,112,0.95)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, TAU); ctx.stroke();
      if (this.orb) { ctx.strokeStyle = 'rgba(235,225,255,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(this.x, this.y, r * 1.6, g.time * 5, g.time * 5 + 4); ctx.stroke(); }
    }
  }
  LF.EBullet = EBullet;

  // ------------------------------------------------------------------ Pickups
  class Pickup {
    constructor(kind, x, y, value, extra) {
      this.kind = kind; this.x = x; this.y = y; this.value = value;
      const a = Math.random() * TAU, s = LF.rand(40, 150);
      this.vx = Math.cos(a) * s; this.vy = Math.sin(a) * s;
      this.life = kind === 'relic' || kind === 'glass' ? 9999 : 22; /* glass is what a lantern is built with: it lies where it fell until it is gathered */ this.t = 0; this.dead = false; this.r = kind === 'relic' ? 12 : 5;
      this.phase = Math.random() * TAU;
      if (extra) Object.assign(this, extra);
    }
    update(dt, g) {
      const p = g.player;
      this.t += dt;
      // Embers Hatch: an ember nobody gathers becomes a moth, and is gone
      if (this.kind === 'ember' && p.stats.hatch && this.t > 3 && !p.dead) {
        p.swarmMoths(1, 9, this.x, this.y); fx.burst(this.x, this.y, 6, { color: ['#ffb36b', '#e4d4ff'], speed1: 90, life: 0.4, size: 1.8 });
        this.dead = true; return;
      }
      if (!(this.kind === 'ember' && p.stats.emberKeep)) this.life -= dt;
      if (this.life <= 0) { this.dead = true; return; }
      this.vx *= Math.max(0, 1 - 4 * dt); this.vy *= Math.max(0, 1 - 4 * dt);
      const d = LF.dist(this.x, this.y, p.x, p.y);
      let want = this.t > 0.35 && !p.dead;
      if (this.kind === 'ember' && p.light >= p.stats.maxLight - 0.5 && !(p.stats.overflow && p.charge < 5)) want = false;
      if (this.kind === 'relic') want = false;
      const reach = p.stats.glean ? Math.max(p.stats.pickup, p.lightR) : p.stats.pickup;
      if (want && d < reach) {
        const pull = 900 * (1 - d / reach) + 220;
        this.vx += (p.x - this.x) / d * pull * dt; this.vy += (p.y - this.y) / d * pull * dt;
      }
      this.x += this.vx * dt; this.y += this.vy * dt;
      g.map.resolveCircle(this, 3);
      if (d < p.r + this.r + 4 && this.t > 0.3 && !p.dead) {
        if (this.kind === 'ember') { if (want) { g.collectEmber(this); this.dead = true; } }
        else if (this.kind === 'glass') { g.collectGlass(this); this.dead = true; }
        else if (this.kind === 'relic' && this.t > 0.7) { g.gainRelic(this.relic, this.x, this.y); this.dead = true; }
      }
    }
    draw(ctx, g) {
      const bobY = Math.sin(g.time * 4 + this.phase) * 2;
      if (this.kind === 'ember') {
        const fade = Math.min(1, this.life / 3);
        const r = 7 + Math.sin(g.time * 9 + this.phase) * 1.5;
        const gr = ctx.createRadialGradient(this.x, this.y + bobY, 0, this.x, this.y + bobY, r);
        gr.addColorStop(0, `rgba(255,240,200,${fade})`); gr.addColorStop(0.4, `rgba(255,150,60,${0.8 * fade})`); gr.addColorStop(1, 'rgba(255,90,20,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(this.x, this.y + bobY, r, 0, TAU); ctx.fill();
      } else if (this.kind === 'glass') {
        ctx.save(); ctx.translate(this.x, this.y + bobY); ctx.rotate(this.phase + g.time * 2);
        ctx.globalAlpha = Math.min(1, this.life / 3);
        ctx.fillStyle = '#8fe6ff'; ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(3.5, 0); ctx.lineTo(0, 5); ctx.lineTo(-3.5, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e8fbff'; ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(0, 5); ctx.lineTo(-3.5, 0); ctx.closePath(); ctx.fill();
        ctx.restore();
      } else if (this.kind === 'relic') {
        const d = LF.RELICS[this.relic], col = LF.RARITY[d.rarity].color;
        const gr = ctx.createRadialGradient(this.x, this.y + bobY, 0, this.x, this.y + bobY, 26);
        gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(this.x, this.y + bobY, 26, 0, TAU); ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(this.x, this.y + bobY, 13, 0, TAU); ctx.stroke();
        LF.drawIcon(ctx, d.glyph, this.x, this.y + bobY, 18, d.color);
      }
    }
  }
  LF.Pickup = Pickup;
})();
