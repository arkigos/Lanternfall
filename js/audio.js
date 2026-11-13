'use strict';
// Procedural audio: every sound is synthesized with WebAudio, no assets.
(function () {
  let ctx = null, master = null, sfxBus = null, musBus = null, delay = null, noiseBuf = null;
  let ambient = null;
  const last = {};
  const A = LF.audio = {
    volume: 0.7, music: 0.6, ready: false, intensity: 0, boss: false,

    unlock() {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) { return; }
      master = ctx.createGain(); master.gain.value = A.volume;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.2;
      master.connect(comp); comp.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
      musBus = ctx.createGain(); musBus.gain.value = A.music; musBus.connect(master);
      // feedback delay used as a cheap cavernous reverb
      delay = ctx.createDelay(1.0); delay.delayTime.value = 0.31;
      const fb = ctx.createGain(); fb.gain.value = 0.38;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
      delay.connect(lp); lp.connect(fb); fb.connect(delay);
      const wet = ctx.createGain(); wet.gain.value = 0.5; lp.connect(wet); wet.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      A.ready = true;
      startAmbient();
    },
    setVolume(v) { A.volume = v; if (master) master.gain.value = v; },
    setMusic(v) { A.music = v; if (musBus) musBus.gain.value = v; },

    tone(o) {
      if (!A.ready) return;
      const t = ctx.currentTime + (o.at || 0);
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(o.f0, t);
      if (o.f1 !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t + o.dur);
      const vol = o.vol === undefined ? 0.2 : o.vol, a = o.attack || 0.004;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
      let node = osc;
      if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; node.connect(f); node = f; }
      node.connect(g);
      g.connect(o.bus || sfxBus);
      if (o.echo) { const e = ctx.createGain(); e.gain.value = o.echo * (o.bus === musBus ? A.music : 1); g.connect(e); e.connect(delay); }
      osc.start(t); osc.stop(t + o.dur + 0.05);
    },
    noise(o) {
      if (!A.ready) return;
      const t = ctx.currentTime + (o.at || 0);
      const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = o.type || 'lowpass';
      f.frequency.setValueAtTime(o.f0 || 1000, t);
      if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur);
      f.Q.value = o.q || 0.7;
      const g = ctx.createGain(), vol = o.vol === undefined ? 0.2 : o.vol;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + (o.attack || 0.004));
      g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
      src.connect(f); f.connect(g); g.connect(o.bus || sfxBus);
      if (o.echo) { const e = ctx.createGain(); e.gain.value = o.echo * (o.bus === musBus ? A.music : 1); g.connect(e); e.connect(delay); }
      src.start(t, Math.random()); src.stop(t + o.dur + 0.05);
    },

    // Named sound effects. `v` = optional variation value (pitch step, strength).
    play(name, v) {
      if (!A.ready) return;
      const now = ctx.currentTime;
      const min = MIN_GAP[name] || 0.02;
      if (last[name] && now - last[name] < min) return;
      last[name] = now;
      const fn = SFX[name];
      if (fn) fn(v || 0);
    },
  };

  const MIN_GAP = { splash: 0.2, howl: 0.3, hit: 0.04, shoot: 0.045, ember: 0.03, kill: 0.05, glass: 0.03, step: 0.2, burn: 0.12, shroud: 0.08, spit: 0.06, explode: 0.08, sizzle: 0.09, crackle: 0.1, chain: 0.05, cinder: 0.08, slash: 0.05, hiss: 0.25, ignite: 0.1 };
  const r = (a, b) => a + Math.random() * (b - a);
  const SFX = {
    // a spat flame: a soft chime under a short breath of fire
    // a bolt is a gout of flame: the puff of it catching, a soft thump of air under it, a spit of sparks on top
    shoot() { const p = r(0.88, 1.12); A.noise({ type: 'bandpass', f0: 380 * p, f1: 2300 * p, q: 0.7, dur: 0.12, vol: 0.085, attack: 0.012 }); A.tone({ type: 'sine', f0: 190 * p, f1: 85, dur: 0.08, vol: 0.05 }); A.noise({ type: 'highpass', f0: r(4600, 6000), dur: 0.05, vol: 0.018 }); },
    heavyShoot() { A.noise({ type: 'bandpass', f0: 240, f1: 1700, q: 0.7, dur: 0.24, vol: 0.14, attack: 0.02 }); A.tone({ type: 'sine', f0: 130, f1: 52, dur: 0.2, vol: 0.12 }); A.noise({ type: 'highpass', f0: 4400, dur: 0.09, vol: 0.03 }); },
    heart(k) { const v = 0.1 + 0.16 * (k || 0); A.tone({ type: 'sine', f0: 62, f1: 38, dur: 0.16, vol: v }); A.tone({ type: 'sine', f0: 54, f1: 34, dur: 0.18, vol: v * 0.7, at: 0.15 }); },
    growl() { A.tone({ type: 'sawtooth', f0: 70, f1: 48, dur: 0.5, vol: 0.2, lp: 420 }); A.tone({ type: 'sawtooth', f0: 73, f1: 45, dur: 0.5, vol: 0.14, lp: 600 }); A.noise({ type: 'bandpass', f0: 240, f1: 520, q: 2, dur: 0.45, vol: 0.08, attack: 0.08 }); },
    hit() { A.noise({ type: 'bandpass', f0: r(1500, 2400), q: 1.5, dur: 0.05, vol: 0.09 }); A.tone({ type: 'square', f0: 240, f1: 120, dur: 0.04, vol: 0.04 }); },
    shroud() { A.noise({ type: 'bandpass', f0: 500, q: 3, dur: 0.07, vol: 0.06 }); },
    crit() { A.tone({ type: 'square', f0: 1400, f1: 700, dur: 0.09, vol: 0.07 }); A.noise({ type: 'highpass', f0: 2500, dur: 0.06, vol: 0.08 }); },
    kill() { A.tone({ type: 'sine', f0: r(280, 340), f1: 50, dur: 0.28, vol: 0.16 }); A.noise({ type: 'lowpass', f0: 1400, f1: 200, dur: 0.22, vol: 0.1, echo: 0.3 }); },
    bigKill() { A.tone({ type: 'sawtooth', f0: 200, f1: 30, dur: 0.7, vol: 0.2, lp: 900 }); A.noise({ type: 'lowpass', f0: 2000, f1: 100, dur: 0.8, vol: 0.2, echo: 0.5 }); },
    ember(v) { const f = 880 * Math.pow(2, Math.min(v, 14) / 12); A.tone({ type: 'sine', f0: f, f1: f * 1.5, dur: 0.1, vol: 0.07, echo: 0.25 }); },
    glass(v) { const f = 1560 * Math.pow(2, Math.min(v, 10) / 12); A.tone({ type: 'triangle', f0: f, dur: 0.12, vol: 0.05, echo: 0.3 }); A.tone({ type: 'sine', f0: f * 2.01, dur: 0.08, vol: 0.025 }); },
    hurt() { A.tone({ type: 'sawtooth', f0: 220, f1: 70, dur: 0.3, vol: 0.2, lp: 1200 }); A.noise({ type: 'lowpass', f0: 900, dur: 0.2, vol: 0.18 }); },
    dash() { A.noise({ type: 'bandpass', f0: 700, f1: 3200, q: 1.2, dur: 0.16, vol: 0.12 }); },
    flare() {
      A.noise({ type: 'lowpass', f0: 5000, f1: 300, dur: 0.6, vol: 0.25, echo: 0.5 });
      A.noise({ type: 'bandpass', f0: 400, f1: 3000, q: 0.8, dur: 0.5, vol: 0.15, attack: 0.04 }); // the roar of it catching
      A.tone({ type: 'sine', f0: 180, f1: 900, dur: 0.35, vol: 0.16 });
      A.tone({ type: 'triangle', f0: 1320, f1: 660, dur: 0.5, vol: 0.06, echo: 0.6 });
    },
    noLight() { A.tone({ type: 'square', f0: 140, f1: 110, dur: 0.12, vol: 0.07, lp: 600 }); },
    relic() { [0, 4, 7, 12, 16].forEach((n, i) => A.tone({ type: 'triangle', f0: 440 * Math.pow(2, n / 12), dur: 0.5, vol: 0.09, at: i * 0.07, echo: 0.5 })); },
    rare() { [0, 3, 7, 10, 14, 19].forEach((n, i) => A.tone({ type: 'sine', f0: 330 * Math.pow(2, n / 12), dur: 0.9, vol: 0.09, at: i * 0.09, echo: 0.7 })); },
    uiMove() { A.tone({ type: 'sine', f0: 660, dur: 0.04, vol: 0.05 }); },
    uiSelect() { A.tone({ type: 'triangle', f0: 520, dur: 0.07, vol: 0.08 }); A.tone({ type: 'triangle', f0: 780, dur: 0.12, vol: 0.08, at: 0.06, echo: 0.3 }); },
    uiBack() { A.tone({ type: 'triangle', f0: 520, f1: 300, dur: 0.1, vol: 0.07 }); },
    deny() { A.tone({ type: 'square', f0: 160, dur: 0.09, vol: 0.06, lp: 700 }); A.tone({ type: 'square', f0: 120, dur: 0.12, vol: 0.06, at: 0.09, lp: 700 }); },
    brazier() { A.noise({ type: 'bandpass', f0: 300, f1: 2400, q: 0.8, dur: 0.7, vol: 0.2, attack: 0.1, echo: 0.4 }); A.tone({ type: 'sine', f0: 110, f1: 220, dur: 0.8, vol: 0.14 }); A.tone({ type: 'sine', f0: 660, dur: 1.0, vol: 0.05, at: 0.2, echo: 0.6 }); },
    gate() { A.tone({ type: 'sine', f0: 90, f1: 40, dur: 0.5, vol: 0.3 }); A.noise({ type: 'lowpass', f0: 500, f1: 80, dur: 0.5, vol: 0.2, echo: 0.4 }); },
    gateOpen() { A.tone({ type: 'sine', f0: 60, f1: 130, dur: 0.5, vol: 0.2 }); A.tone({ type: 'triangle', f0: 392, dur: 0.7, vol: 0.06, at: 0.1, echo: 0.6 }); A.tone({ type: 'triangle', f0: 587, dur: 0.9, vol: 0.06, at: 0.25, echo: 0.6 }); },
    bell() { [1, 2.0, 2.76, 5.4, 8.93].forEach((m, i) => A.tone({ type: 'sine', f0: 98 * m, dur: 2.6 - i * 0.35, vol: 0.2 / (i + 1), echo: 0.5 })); A.noise({ type: 'bandpass', f0: 900, q: 2, dur: 0.08, vol: 0.2 }); },
    descend() { [12, 7, 3, 0, -5, -12].forEach((n, i) => A.tone({ type: 'sine', f0: 392 * Math.pow(2, n / 12), dur: 0.7, vol: 0.09, at: i * 0.11, echo: 0.6 })); A.noise({ type: 'lowpass', f0: 1500, f1: 80, dur: 1.4, vol: 0.14 }); },
    death() { [0, -3, -7, -12, -15].forEach((n, i) => A.tone({ type: 'sawtooth', f0: 220 * Math.pow(2, n / 12), dur: 1.4, vol: 0.08, at: i * 0.22, lp: 800, echo: 0.6 })); A.noise({ type: 'lowpass', f0: 900, f1: 60, dur: 2.2, vol: 0.2 }); },
    win() { [0, 4, 7, 12, 7, 12, 16, 19, 24].forEach((n, i) => A.tone({ type: 'triangle', f0: 294 * Math.pow(2, n / 12), dur: 1.1, vol: 0.09, at: i * 0.13, echo: 0.7 })); },
    lunge() { A.tone({ type: 'sawtooth', f0: 80, f1: 190, dur: 0.22, vol: 0.14, lp: 700 }); },
    telegraph() { A.tone({ type: 'sine', f0: 500, f1: 900, dur: 0.18, vol: 0.05 }); },
    spit() { A.tone({ type: 'square', f0: 330, f1: 130, dur: 0.14, vol: 0.06, lp: 1400 }); },
    explode() { A.noise({ type: 'lowpass', f0: 2600, f1: 90, dur: 0.6, vol: 0.3, echo: 0.5 }); A.tone({ type: 'sine', f0: 110, f1: 28, dur: 0.5, vol: 0.3 }); },
    thunder() { A.noise({ type: 'highpass', f0: 1800, dur: 0.07, vol: 0.25 }); A.noise({ type: 'lowpass', f0: 800, f1: 60, dur: 0.9, vol: 0.25, at: 0.03, echo: 0.6 }); },
    roar() { A.tone({ type: 'sawtooth', f0: 62, f1: 44, dur: 1.5, vol: 0.28, lp: 500, echo: 0.5 }); A.tone({ type: 'sawtooth', f0: 65.5, f1: 41, dur: 1.5, vol: 0.22, lp: 700 }); A.noise({ type: 'bandpass', f0: 300, f1: 900, q: 2, dur: 1.3, vol: 0.14, attack: 0.3 }); },
    whisper() { A.noise({ type: 'bandpass', f0: r(900, 1600), f1: r(2000, 3000), q: 6, dur: 0.6, vol: 0.06, attack: 0.2, echo: 0.6 }); },
    spawn() { A.tone({ type: 'sine', f0: 60, f1: 240, dur: 0.3, vol: 0.1 }); A.noise({ type: 'bandpass', f0: 400, q: 3, dur: 0.25, vol: 0.06 }); },
    steal() { A.tone({ type: 'sine', f0: 1200, f1: 300, dur: 0.2, vol: 0.1 }); },
    burn() { A.noise({ type: 'bandpass', f0: r(2000, 3200), q: 2, dur: 0.08, vol: 0.04 }); },
    chest() { A.noise({ type: 'lowpass', f0: 700, dur: 0.12, vol: 0.15 }); A.tone({ type: 'triangle', f0: 523, dur: 0.5, vol: 0.08, at: 0.1, echo: 0.5 }); A.tone({ type: 'triangle', f0: 784, dur: 0.7, vol: 0.08, at: 0.2, echo: 0.5 }); },
    buy() { A.tone({ type: 'triangle', f0: 1046, dur: 0.1, vol: 0.08 }); A.tone({ type: 'triangle', f0: 1568, dur: 0.25, vol: 0.08, at: 0.08, echo: 0.4 }); },
    revive() { A.noise({ type: 'lowpass', f0: 200, f1: 6000, dur: 1.0, vol: 0.2, attack: 0.5 }); [0, 7, 12, 19].forEach((n, i) => A.tone({ type: 'sine', f0: 262 * Math.pow(2, n / 12), dur: 1.2, vol: 0.1, at: 0.3 + i * 0.1, echo: 0.7 })); },
    lowLight() { A.tone({ type: 'sine', f0: 70, f1: 50, dur: 0.22, vol: 0.22 }); A.tone({ type: 'sine', f0: 70, f1: 50, dur: 0.22, vol: 0.14, at: 0.26 }); },
    beam() { A.tone({ type: 'sawtooth', f0: 110, f1: 440, dur: 0.5, vol: 0.12, lp: 2000, echo: 0.4 }); },
    howl() { A.tone({ type: 'sawtooth', f0: 260, f1: 620, dur: 0.5, vol: 0.14, lp: 1800, echo: 0.6 }); A.tone({ type: 'sawtooth', f0: 268, f1: 470, dur: 0.7, vol: 0.1, lp: 1400, echo: 0.6 }); A.noise({ type: 'bandpass', f0: 700, f1: 1600, q: 3, dur: 0.6, vol: 0.08, attack: 0.1 }); },
    step() { A.noise({ type: 'lowpass', f0: r(260, 420), dur: 0.05, vol: 0.035 }); },
    splash() { A.noise({ type: 'bandpass', f0: r(900, 1500), q: 1.2, dur: 0.1, vol: 0.05, attack: 0.01 }); },
    drip() { const f = r(900, 1700); A.tone({ type: 'sine', f0: f, f1: f * 1.6, dur: 0.07, vol: 0.035, echo: 0.7 }); },
    charge() { A.tone({ type: 'sine', f0: 200, f1: 1200, dur: 0.7, vol: 0.07, attack: 0.4 }); },
    // fire, wax and chain
    sizzle() { A.noise({ type: 'highpass', f0: r(3800, 5200), dur: r(0.12, 0.22), vol: 0.035, attack: 0.02 }); },
    crackle() { for (let i = 0; i < 3; i++) A.noise({ type: 'bandpass', f0: r(1800, 4200), q: 6, dur: 0.03, vol: 0.07, at: i * r(0.03, 0.08) }); },
    ignite() { A.noise({ type: 'bandpass', f0: 500, f1: 2600, q: 0.9, dur: 0.32, vol: 0.14, attack: 0.05 }); A.tone({ type: 'sine', f0: 140, f1: 260, dur: 0.25, vol: 0.06 }); },
    hiss() { A.noise({ type: 'highpass', f0: 2400, f1: 6000, dur: 0.45, vol: 0.06, attack: 0.03 }); },
    slash() { A.noise({ type: 'bandpass', f0: 900, f1: 4200, q: 1.1, dur: 0.14, vol: 0.16 }); A.noise({ type: 'lowpass', f0: 1600, f1: 300, dur: 0.22, vol: 0.08, at: 0.03 }); },
    cinder() { A.noise({ type: 'highpass', f0: 2600, dur: 0.05, vol: 0.12 }); A.noise({ type: 'lowpass', f0: 1800, f1: 200, dur: 0.35, vol: 0.18, at: 0.02, echo: 0.3 }); A.tone({ type: 'sine', f0: 160, f1: 60, dur: 0.25, vol: 0.14 }); },
    wax() { A.tone({ type: 'sine', f0: 190, f1: 110, dur: 0.12, vol: 0.16 }); A.noise({ type: 'lowpass', f0: 600, dur: 0.08, vol: 0.12 }); },
    chain() { const p = r(0.9, 1.1); A.tone({ type: 'square', f0: 2100 * p, dur: 0.05, vol: 0.03, lp: 5000 }); A.tone({ type: 'triangle', f0: 3150 * p, dur: 0.09, vol: 0.03, at: 0.03, echo: 0.3 }); },
  };

  // --- ambient bed: drone + water noise + sparse melodic drips; reacts to A.intensity ---
  const SCALE = [0, 2, 3, 7, 8, 12, 14, 15, 19];
  function startAmbient() {
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), o3 = ctx.createOscillator();
    o1.type = 'sine'; o2.type = 'sine'; o3.type = 'triangle';
    o1.frequency.value = 55; o2.frequency.value = 82.6; o3.frequency.value = 110.4;
    const dg = ctx.createGain(); dg.gain.value = 0.085;
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 0.07; lg.gain.value = 0.035; lfo.connect(lg); lg.connect(dg.gain);
    const g3 = ctx.createGain(); g3.gain.value = 0.25;
    o1.connect(dg); o2.connect(dg); o3.connect(g3); g3.connect(dg); dg.connect(musBus);
    const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 260;
    const ng = ctx.createGain(); ng.gain.value = 0.11;
    const l2 = ctx.createOscillator(), l2g = ctx.createGain(); l2.frequency.value = 0.13; l2g.gain.value = 0.05; l2.connect(l2g); l2g.connect(ng.gain);
    n.connect(nf); nf.connect(ng); ng.connect(musBus);
    const po = ctx.createOscillator(); po.type = 'sawtooth'; po.frequency.value = 36.7;
    const pf = ctx.createBiquadFilter(); pf.type = 'lowpass'; pf.frequency.value = 180;
    const pg = ctx.createGain(); pg.gain.value = 0;
    po.connect(pf); pf.connect(pg); pg.connect(musBus);
    [o1, o2, o3, lfo, n, l2, po].forEach(x => x.start());
    ambient = { pg, pf, nextNote: ctx.currentTime + 2, nextPulse: ctx.currentTime, step: 0 };
    setInterval(tickAmbient, 60);
  }
  // Boss fights get a driving pattern instead of the sparse ambience.
  const BOSS_ROOT = [0, 0, -4, -2], BOSS_ARP = [12, 15, 19, 15, 22, 19, 15, 19];
  function tickBoss(now) {
    const stepLen = 0.118;
    if (ambient.bossStep === undefined || ambient.bossStep < 0 || ambient.bossNext < now - 0.3) { ambient.bossStep = 0; ambient.bossNext = now + 0.05; }
    while (ambient.bossNext < now + 0.14) {
      const st = ambient.bossStep, at = Math.max(0, ambient.bossNext - now), bar = Math.floor(st / 16) % 4, s16 = st % 16;
      const root = 73.42 * Math.pow(2, BOSS_ROOT[bar] / 12);
      if (s16 % 4 === 0) A.tone({ type: 'sine', f0: 130, f1: 42, dur: 0.16, vol: 0.3, at, bus: musBus });
      if (s16 % 2 === 1) A.noise({ type: 'highpass', f0: 7000, dur: 0.03, vol: 0.035, at, bus: musBus });
      if (s16 === 0 || s16 === 3 || s16 === 6 || s16 === 8 || s16 === 11 || s16 === 14) A.tone({ type: 'sawtooth', f0: root, dur: 0.2, vol: 0.16, lp: 420, at, bus: musBus });
      if (s16 % 2 === 0) A.tone({ type: 'square', f0: root * Math.pow(2, BOSS_ARP[(s16 / 2) % 8] / 12), dur: 0.12, vol: 0.035, lp: 2200, at, echo: 0.4, bus: musBus });
      if (s16 === 12 && bar === 3) A.noise({ type: 'bandpass', f0: 400, f1: 4000, q: 1, dur: 0.45, vol: 0.06, at, attack: 0.4, bus: musBus });
      ambient.bossStep++; ambient.bossNext += stepLen;
    }
  }
  function tickAmbient() {
    if (!ambient || ctx.state !== 'running') return;
    if (A.boss) { tickBoss(ctx.currentTime); return; }
    ambient.bossStep = -1;
    const now = ctx.currentTime, I = A.intensity;
    if (now >= ambient.nextNote) {
      const n = SCALE[Math.floor(Math.random() * SCALE.length)];
      const base = I > 0.5 ? 146.83 : 293.66;
      const f = base * Math.pow(2, n / 12);
      A.tone({ type: I > 0.5 ? 'triangle' : 'sine', f0: f, dur: r(1.2, 2.4), vol: 0.05, attack: 0.08, echo: 0.8, bus: musBus });
      if (Math.random() < 0.3) A.tone({ type: 'sine', f0: f * 1.5, dur: 1.4, vol: 0.03, attack: 0.1, echo: 0.8, bus: musBus, at: 0.33 });
      ambient.nextNote = now + (I > 0.5 ? r(0.6, 1.6) : r(2.2, 6));
    }
    if (I > 0.15 && now >= ambient.nextPulse) {
      const period = LF.lerp(0.62, 0.3, I);
      const t = now + 0.02;
      const acc = ambient.step % 4 === 0 ? 1 : 0.55;
      ambient.pg.gain.cancelScheduledValues(t);
      ambient.pg.gain.setValueAtTime(0.0001, t);
      ambient.pg.gain.linearRampToValueAtTime(0.2 * I * acc, t + 0.02);
      ambient.pg.gain.exponentialRampToValueAtTime(0.0001, t + period * 0.8);
      ambient.pf.frequency.setValueAtTime(140 + 500 * I, t);
      ambient.pf.frequency.exponentialRampToValueAtTime(90, t + period * 0.8);
      if (I > 0.6 && ambient.step % 2 === 1) A.noise({ type: 'highpass', f0: 6000, dur: 0.04, vol: 0.02 * I, bus: musBus });
      ambient.step++;
      ambient.nextPulse = now + period;
    }
  }
})();
