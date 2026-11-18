'use strict';
// Relics: every relic is a rank count that modifies the player's stat block. Game code reads the stats.
// Every relic is of one of five themes: light, fire, wax, chain, moth. There are no plain ones.
(function () {
  // Balance knobs in one place. bolt: a bare bolt's damage. grow: how steeply creatures toughen and hit harder from
  // Level to Level (1 is the curve the game had when most lanterns reached two or three attunement tiers).
  // typeStair: how often one of a stair's choices is a type, not a verb.
  // bite, wax, link: what a moth's bite, a second of wax and a blow of a chain do before any relic. A censer's blow (link)
  // lands on everything its ring touches, jars what stands beside, blocks shots and shoves, so it is worth less than a bolt's.
  // melt: how much glass runs together into one rank for a relic already held (there is no shop to spend it in).
  // draw: how strongly each relic of a type already held pulls more of that type into an offer.
  // catchR, catchT: how close a creature must stand to a burning one to catch fire (with Catching Fire), and how often fire tries to leap.
  // wax: what a waxed creature is scalded for a second. It is below burn because every way of waxing (a bolt, a trail,
  // a flood, a gout, a spatter) delivers the whole scald, where a burn lands only where the bolt does. slow: how much
  // wax slows a creature.
  // first: a multiplier on the first great shadow's health (it was 1.2 while a descent opened with two relics in hand).
  // late, deep: how much tougher creatures grow each Level past the third, and again past the sixth. third: a
  // multiplier on the last great shadow's health.
  // second, secondHit, third, thirdHit: multipliers on the health of the great shadows of Levels 6 and 9 and on what
  // hpGrow, dmgGrow: THE CURVE, one figure for each Depth (Levels 1-3, 4-6, 7-9). A creature has that many times the
  // health on each Level that it had on the one before, and hits that many times as hard: 192 times the health and 22
  // times the harm by Level 9. (Earlier trials, kept for the record: Nine Levels at 1.6 and 1.3 is 43 times the health and 8 times the harm (at 2 and 1.5, which is 256 and 26, no bot lantern passed Level 6: they hold about seven ranks by Level 4, not the nine or twelve the ideal build assumes).) Only a lantern
  // that multiplies keeps pace: see what the rank tables below and the three theme multipliers come to.
  // early, earlyHp, pack: how much harder the creatures of Level 1 hit, how much more health they have, and how many
  // more of them a room holds, than the old curve gave (two thirds of each on Level 2, a third on Level 3, none after).
  // early is kept low: the first Levels bite through numbers and toughness, not through blows that take half your light. again: how much likelier a relic already held is to be offered
  // again. rerollStair: rerolls handed over at every stair.
  // src, amp, mark: what a source's own strength, an amplifier and a mark are worth at rank I, II and III. glass: the
  // same for Burning Glass. white: what White Light adds to searing a rank.
  // glassRanks: 1 means glass forges ranks at the stair (the screen is still in game.js); 0, as now, means glass buys
  // rerolls: rerollGlass for the first on an offer, twice that for the next, and so on. draw is 0: an offer is dealt
  // from the whole deck with no lean toward the theme a lantern holds, and seek is 1 for the same reason. again is the
  // one lean left: a relic already held comes round twice as often, because that is the only way it gains a rank.
  // forging: 1 puts the Forge at every stair. forgeII, forgeIII: the glass it takes to forge a relic to rank II, and to rank III.
  // maxRank: how far a three-rank relic can be taken (its card still reads I, II, III: those are its first three). past:
  // what each rank beyond III multiplies by, on a relic that multiplies. forgeMore: what the Forge adds to its price for
  // each rank beyond III.
  // deepen: what a theme's rare multiplier is worth for every rank of that theme the lantern holds (each on the last).
  // swap: when a relic is dealt that needs a power the lantern lacks, how often the relic that gives that power is dealt
  // in its place; the rest of the time another relic is dealt instead (else the same few sources fill every offer).
  // glassYield: how much glass the dark yields, against what it did before the Forge (creatures' drops and the stair's own).
  // formPrice: what the Chandler asks for a form. chandler: the chance a Level past the first (and not a great
  // shadow's) has the Chandler's room on it.
  // forge: 1 means the last rank of a three-rank relic is never offered: only glass at the stair, put where the
  // bearer chooses, takes a relic to rank III.
  // seek: how much likelier a theme's sources are offered to a lantern that holds that theme with nothing to start it.
  // their blows do. They have a great deal of health and hit softer than they did: the fight is long, and what decides
  // it is how fast the lantern kills, which is what a build changes. burn: a burn's damage a second before any relic.
  LF.TUNE = { bolt: 13, grow: 0.65, typeStair: 0.45, first: 2, second: 1, secondHit: 0.8, third: 1, thirdHit: 0.85, late: 0, deep: 0, hpGrow: [1.8, 2.2, 3.5], dmgGrow: [1.12, 1.15, 1.18], bite: 25, wax: 22, link: 50, burn: 30, catchR: 46, catchT: 0.35, slow: 0.3, draw: 0, melt: 45, seek: 1, glassRanks: 0, forging: 1, forgeII: 30, forgeIII: 50, rerollGlass: 10, rerollMore: 5, formPrice: 150, chandler: 0.6, glassYield: 2, swap: 0.35, deepen: 1.08, maxRank: 10, past: 1.5, forgeMore: 30, early: 0.8, earlyHp: 0.8, pack: 0.6, again: 3, rerollStair: 1, forge: 0, surge: [1.8, 2.9, 4.5], still: [2.5, 4, 6.5], focus: [2.25, 3.4, 5.1], src: [1, 1.6, 2.5], amp: [1.5, 2.25, 3.4], mark: [1.5, 2.25, 3.4], glass: [1.8, 2.9, 4.5], white: 2 };
  // how much the dark has multiplied by a Level: the product of each step's growth (`by` is hpGrow or dmgGrow, one figure a Depth)
  LF.curve = (by, floor) => { let m = 1; for (let k = 2; k <= floor; k++) m *= by[Math.min(by.length - 1, Math.floor((k - 1) / 3))]; return m; };
  LF.baseStats = () => ({
    maxLight: 100, damage: LF.TUNE.bolt, fireRate: 4.6, boltSpeed: 560, boltSize: 4, boltLife: 0.72,
    speed: 168, dashCd: 0.85, dashCost: 3,
    flareCost: 8, flareCd: 6, flareDmg: 0, flareRadius: 165, flareStun: 1.5,
    radiusMul: 1, drainMul: 1, emberMul: 1, emberBonus: 0, pickup: 70, glassMul: LF.TUNE.glassYield,
    pierce: 0, bounce: 0, multishot: 1, chain: 0, ignite: 0, split: 0, homing: 0,
    crit: 0.05, critMul: 2, dmgTaken: 1, shroudMul: 0.4,
    lowLightDmg: 0, brightDmg: 0, vigil: 0, killHeal: 0, noEmbers: false,
    afterglow: 0, cinderSkin: 0, familiars: 0, novaEvery: 0, reveal: false, flareFree: false,
    eclipseMask: 0, beacon: 0, wildfire: 0, hearth: 0, storm: 0, phoenix: 0, lastLight: 0, overburn: 0,
    brazierBonus: 0, brazierBurn: 0, restRate: 1, restTo: 0.5, thorns: 0, extraChoice: 0, orbit: 0, frost: 0, echo: 0, lifeline: 0,
    spread: 0.14, boltColor: '#ffe9b8',
    kindleMul: 1, lampHeal: 0, trapProof: false, hover: false, emberKeep: false, eliteDmg: 0, sear: 1.5, ward: 1,
    melee: 0, kiln: 0, lance: 0, blink: 0, implode: 0, comet: 0, fireMul: 1, markBonus: 0, markTime: 0,
    buckler: 0, waxSkin: 0, chainGuard: 0, wardRegen: 1, shadeStep: 0, mantle: 0, stealth: 1, ambush: 0, shadowLash: 0, lowDef: 1, noDrainLow: false,
    // the five types. The bolt starts plain; one relic at a time can make it a type (boltType).
    // Every type deals damage of its own, and relics raise each type's damage and no other's.
    // fire: burnBase is a burn's damage a second for each stack of ignite, and fire catches from one creature to the
    // next. light: searing (the lantern's light smouldering whatever stands in it), on from the start; searFlat is
    // added to its 4 a second. wax: how deep and how long a slow is, and what it scalds for a second (waxDmg).
    // chain: how far the chains round you swing and what a blow does (chainDmg). moth: what a bite does (mothBite).
    boltType: '', burnBase: LF.TUNE.burn, burnTime: 3, searOn: 1, tar: 0, flareWax: 0, linger: 1, glowKeep: 0,
    stoke: 0, brittle: 0, taut: 0, harry: 0, stunCrit: 0, glean: 0, counterweight: 0, burnHeal: 0, drip: 0,
    conflag: 0, catching: 0, catchFast: 1, undying: 0, melt: 0, wakeful: 0, peal: 0, gyre: 0, cloud: 0, mothStay: 0, waxWalk: 0,
    flareGlow: 0, flareHeal: 0, keen: 0, slowBurn: 0, cure: 0,
    // forms: what the bolt is (ray, gout, thrown, wing; kiln above) and what the flare is (haul, candle; lance above)
    ray: 0, gout: 0, thrown: 0, wing: 0, haul: 0, haulTime: 0, candle: 0, farFlare: 0,
    bladeMul: 1, ringFire: 0, noonFor: 0, mothCloud: 0, cast: 0,
    // paths: fire laid on the ground and fire worn (fireMul is the burn's alone); wax in pools; moths loosed; the wax shell
    groundMul: 1, mantleMul: 1, flareAmp: 1, markAll: 1, haloWide: 0, poolMul: 1, swarmMul: 1, skinExtra: 0, shed: 0,
    // what multiplies everything a theme does: every one of these multiplies the others and every amplifier on a path
    fireAll: 1, lightAll: 1, waxAll: 1, chainAll: 1, mothAll: 1, surge: {}, fireLeech: 0, coatMax: 0, coatMul: 1, cwThrow: 1, cwWide: 1, lightSoft: 0, tallowFire: 0, firelight: 0, poolLight: 0, softLight: 0, censerLamps: 0, censerMoths: 0, mothLamps: 0, censerDrip: 0, cinderMoth: 0, lensFocus: 0, solarCrown: 0, leashOn: 0, sunstruck: 0, waxFoot: 0, longSwing: 0, incense: 0, decoy: 0,
    // what each theme defends with beside the ward: Heartwood (fire) multiplies the embers held; the Slow Dusk (light)
    // stretches the second over which a blow burns through, and lets the flare burn away what is left of it
    maxMul: 1, hurtTime: 1, flareMend: 0,
    flareBurn: 0, boltWax: 0, boltShackle: 0, boltLight: 0, boltMoth: 0, pyre: 0, glare: 0, broodKill: 0, noon: 0, chainWax: 0,
    searFlat: 0, waxDmg: LF.TUNE.wax, waxMul: 1, chainDmg: LF.TUNE.link, mothBite: LF.TUNE.bite,
    waxSlow: LF.TUNE.slow, waxTime: 2.5, spatter: 0, waxTrail: 0, waxFlood: 0, waxSoft: 0, waxSet: 0, waxGlow: 0, waxBurn: 0,
    shackleTime: 3, leash: 46, chainReach: 0, chainMul: 0, flail: 0, hook: 0, drag: 0, flareFling: 0, chainLight: 0, chainBurn: 0,
    dashLen: 1, dashLight: 0, dashMoth: 0, flareMoth: 0,
    mothMul: 1, mothLife: 0, hatch: 0, mothWax: 0, mothChain: 0, mothLight: 0, mothFire: 0,
    stormCd: 3, secondWind: 0, shopMul: 1, knock: 1, emberSpark: 0, critEmber: 0, overflow: 0, brazierMax: 0, flareBolts: 0, lodestar: 0, reflect: 0, noMap: false,
  });

  // Starting lanterns: one for each theme. A lantern is the theme you set out in: it carries that theme's first
  // relic from the first step, and nothing else. Every relic and form of every theme can still be dealt to it.
  // (`carries` is read in startRun; the stats here are only the bolt's colour.)
  LF.LANTERNS = [
    { id: 'fire', name: 'The Fire Lantern', glyph: 'flame', color: '#ff7b3d', carries: 'kindle', desc: 'Sets out burning: it carries the Kindled Bolt. What burns keeps burning, and fire built to catch runs through a whole pack.', unlockText: '', unlocked: () => true, stats() {} },
    { id: 'wax', name: 'The Wax Lantern', glyph: 'candle', color: '#f0e2c0', carries: 'tallowbolt', desc: 'Sets out dripping: it carries the Tallow Bolt. Wax slows, scalds, spreads over the floor and sets hard over you.', unlockText: '', unlocked: () => true, stats() {} },
    { id: 'light', name: 'The Light Lantern', glyph: 'sun', color: '#fff0b8', carries: 'burningglass', desc: 'Sets out searing: it carries the Burning Glass. Its light burns what stands in it, and its flare is a weapon.', unlockText: '', unlocked: () => true, stats() {} },
    { id: 'chain', name: 'The Chain Lantern', glyph: 'chain', color: '#d9b070', carries: 'censer', desc: 'Sets out swinging: it carries a Censer on its chain. Censers strike what comes near, and links bind what they catch.', unlockText: '', unlocked: () => true, stats() {} },
    { id: 'moth', name: 'The Moth Lantern', glyph: 'moth', color: '#e4d4ff', carries: 'lampmoth', desc: 'Sets out with company: it carries a Lamp Moth. Moths gather to it, fight for it, and swarm what it marks.', unlockText: '', unlocked: () => true, stats() {} },
  ];
  LF.LANTERN = {}; for (const l of LF.LANTERNS) LF.LANTERN[l.id] = l;
  // Mastery: depths descended with a lantern, over all runs, make it a little stronger (three levels).
  LF.masteryLevel = (meta, id) => { const d = ((meta && meta.mastery) || {})[id] || 0; return d >= 60 ? 3 : d >= 25 ? 2 : d >= 8 ? 1 : 0; };

  // Omens: a floor may carry one twist.
  LF.OMENS = [
    { id: 'starless', name: 'Sootfall', desc: 'Soot hangs in the air and the dark is thicker, but glass glitters in it.', radius: 0.84, glass: 1.7 },
    { id: 'hungry', name: 'Hungry Dark', desc: 'Your embers burn down much faster. Each one you gather counts double.', drain: 1.6, ember: 2 },
    { id: 'swarm', name: 'The Swarm', desc: 'Many small hungers stir.' },
    { id: 'flooded', name: 'Burst Cistern', desc: 'The cisterns above have emptied onto this floor.' },
    { id: 'gilded', name: 'Gilded Dark', desc: 'More reliquaries lie unclaimed, and more elites guard them.' },
    { id: 'hunt', name: 'The Hunt', desc: 'Something has your scent.' },
    { id: 'still', name: 'Stillwater', desc: 'A quiet floor. Rest while you can.' },
    { id: 'tide', name: 'Failing Sluice', desc: 'A sluice above opens and shuts. When the water is in, wading is slow and fire dies in it.' },
  ];

  const R = (id, name, rarity, max, glyph, color, desc, stats, extra) =>
    Object.assign({ id, name, rarity, max, glyph, color, desc, stats }, extra || {});

  // what a three-rank relic gives at rank I, II and III (the stat function is handed 1, 2 or 4: see LF.rankValue)
  // (n is the rank's value: 1, 2, 4, then 6, 8... so rank IV is 6. Past III the third figure grows by TUNE.past a rank.)
  const RK = (n, t) => n >= 4 ? t[2] * Math.pow(LF.TUNE.past, n / 2 - 2) : n >= 2 ? t[1] : t[0];
  // Card text says what a relic does in a sentence or two, with no figures: the figures live in TUNE and the stat functions.
  const C = 'common', U = 'uncommon', X = 'rare', K = 'cursed', B = 'brand', S = 'shadow', F = 'form';
  // the three relics of every theme that multiply all it does: a common one, an uncommon one, and a rare one of a single rank
  const ALL1 = [1.5, 2.25, 3.4], ALL3 = 2;
  const WHOLE = (id1, nm1, id2, nm2, id3, nm3, glyph, col, what, key, when2) => [
    R(id1, nm1, C, 3, glyph, col, 'All your ' + what + (what === 'moths' ? ' do' : ' does') + ' more' + (key === 'lightAll' ? ': its searing, your flare and your critical strikes' : '') + '. More each rank.', (s, n) => { s[key] *= RK(n, ALL1); }),
    // the uncommon one grows the theme only while its own condition holds, and by more (Player.surge works it out every frame)
    R(id2, nm2, U, 3, glyph, col, 'All your ' + what + (what === 'moths' ? ' do' : ' does') + ' more ' + when2 + '. More each rank.', (s, n) => { s.surge[key] = RK(n, key === 'fireAll' ? LF.TUNE.still : LF.TUNE.surge); }),
    R(id3, nm3, X, 1, glyph, col, 'All your ' + what + (what === 'moths' ? ' do ' : ' does ') + 'more for every rank of ' + key.replace('All', '') + ' you hold.', (s, n, pl) => { const th = key.replace('All', ''); let k = 0; if (pl) for (const id in pl.relics) { const d = LF.RELICS[id]; if (d && d.school === th) k += pl.relics[id]; } s[key] *= Math.pow(LF.TUNE.deepen, k); }),
  ];
  const FI = '#ff7b3d', WA = '#f0e2c0', LI = '#fff0b8', CH = '#d9b070', MO = '#e4d4ff';
  // what a great work needs first: any one of these. (Relics in the deck have no such rule: an amplifier can be
  // offered before the thing it amplifies, and is worth nothing until that thing is held.)
  const FIRE = ['kindle', 'cindertrail', 'burningflash', 'emberhalo', 'cinderskin', 'tar', 'cinderfall', 'burntoffering', 'kiln'], WAX = ['tallowbolt', 'spiltwax', 'candlefall', 'melting', 'gout', 'standingcandle'], CENSER = ['censer', 'ballandchain'], MOTH = ['lampmoth', 'startled', 'flock', 'mothshot', 'feedmoths', 'wingedbolts'];
  const list = [
    // ---- fire: what burns keeps burning, and fire catches from one creature to the next
    R('kindle', 'Kindled Bolt', U, 3, 'flame', FI, 'Your bolts set what they hit burning. Hotter each rank.', (s, n) => { s.ignite += 1; s.burnBase *= RK(n, LF.TUNE.src); s.boltColor = '#ffb070'; }),
    R('cindertrail', 'Cinder Trail', U, 3, 'flame', FI, 'Your dash leaves a trail of fire. Hotter each rank.', (s, n) => { s.afterglow += n; }),
    R('burningflash', 'Burning Flash', U, 3, 'sun', FI, 'Your flare burns what it lights and leaves it burning. Harder each rank.', (s, n) => { s.flareDmg += 90 * n; s.flareBurn += 1; }),
    R('emberhalo', 'Ember Halo', U, 3, 'ring', FI, 'A burning ember circles you and sears what it touches. One more each rank.', (s, n) => { s.orbit += n; }),
    R('cinderskin', 'Cinder Skin', U, 3, 'flame', FI, 'When you are hit you erupt in flame, burning and throwing back whatever is near. Harder each rank.', (s, n) => { s.cinderSkin += n; }),
    R('tar', 'Tar', C, 3, 'drop', FI, 'Whatever you kill leaves a patch of burning tar, and your burns last longer. More each rank.', (s, n) => { s.tar += n; s.burnTime += n; }),
    // Fire does not leap by itself: a Kindled Bolt burns what it hits, one creature at a time. Catching Fire is what
    // turns a burn into a fire that runs through a pack, and the reason the Burn is a path and not a single card.
    R('catching', 'Catching Fire', C, 3, 'flame', FI, 'Fire spreads: whatever burns sets alight what stands beside it. Farther and faster each rank.', (s, n) => { s.catching = RK(n, [1, 1.4, 2]); s.catchFast = RK(n, [1, 1.33, 1.5]); }),
    R('pitch', 'Black Pitch', C, 3, 'drop', FI, 'What you set burning burns hotter. More each rank.', (s, n) => { s.fireMul *= RK(n, LF.TUNE.amp); }),
    R('scorchedearth', 'Scorched Earth', C, 3, 'flame', FI, 'Fire you leave on the ground, call down or throw with your flare burns hotter. More each rank.', (s, n) => { s.groundMul *= RK(n, LF.TUNE.amp); }),
    R('whitecoals', 'White Coals', C, 3, 'ring', FI, 'Your circling embers and your cinder skin burn hotter. More each rank.', (s, n) => { s.mantleMul *= RK(n, LF.TUNE.amp); }),
    R('widehalo', 'Wide Halo', C, 3, 'ring', FI, 'Your circling embers swing wider and faster. More each rank.', (s, n) => { s.haloWide += 0.15 * n; }),
    R('stoke', 'Stoke', C, 3, 'flame', FI, 'Your bolts hit burning creatures harder. More each rank.', (s, n) => { s.stoke = (1 + s.stoke) * RK(n, LF.TUNE.mark) - 1; }),
    R('slowburn', 'Slow Burn', U, 3, 'flame', FI, 'A burn grows hotter the longer it lasts. Faster each rank.', (s, n) => { s.slowBurn += 0.08 * n; }),
    R('hearthstone', 'Hearthstone', C, 3, 'flame', FI, 'Resting by a lit brazier mends you faster. More each rank.', (s, n) => { s.restRate *= RK(n, [2, 3, 5]); }),
    // Legendaries (bridges): a rare relic of one theme that makes it do another theme's work. That work is the other
    // theme's alone: light from wax is light, and only what grows your light grows it.
    R('tallowflames', 'Tallow Flames', X, 1, 'flame', FI, 'Your fire leaves wax.', (s) => { s.tallowFire = 1; }, { bridge: 'wax', legend: true }),
    R('firelight', 'Firelight', X, 1, 'flame', FI, 'Your light burns in its inner half.', (s) => { s.firelight = 1; }, { bridge: 'light', legend: true }),
    R('heartwood', 'Heartwood', U, 3, 'flame', FI, 'The harm your fire does comes back to you as embers. More each rank.', (s, n) => { s.fireLeech = RK(n, [1, 2, 3]) * LF.EMBER; }),
    R('bankedcoals', 'Banked Coals', C, 3, 'flame', FI, 'Whatever dies burning gives back embers. More each rank.', (s, n) => { s.burnHeal += 1.25 * n; }),
    R('fireblade', 'The Blade of Fire', F, 3, 'flame', FI, 'In place of bolts you swing a blade of fire. It sets alight what it hits, cuts shots out of the air and feeds your flame. Harder each rank.', (s, n) => { s.melee = 1; s.ignite += 1; s.bladeMul = RK(n, [1, 1.5, 2]); }, { form: 'bolt' }),
    R('ringfire', 'The Ring of Fire', F, 3, 'flame', FI, 'Your flare leaves a ring of fire at its edge. It burns longer each rank.', (s, n) => { s.ringFire = RK(n, [3, 5, 8]); }, { form: 'flare' }),
    R('kiln', 'The Kiln', F, 3, 'flame', FI, 'In place of bolts, hold to stoke one coal and release to throw it. It bursts and sets alight what it hits. Harder each rank.', (s, n) => { s.kiln = RK(n, [1, 1.35, 2]); s.ignite += 1; s.boltColor = '#ffb347'; }, { form: 'bolt' }),
    R('cinderfall', 'Cinderfall', X, 3, 'star', FI, 'Every few seconds a cinder falls on a creature in your light. Sooner each rank.', (s, n) => { s.storm += 1; s.stormCd -= 0.5 * (n - 1); }),
    R('wildfire', 'Wildfire', X, 1, 'flame', '#ff4d1f', 'Burning creatures burst when they die, and the fire leaps to everything near.', (s) => { s.wildfire += 1; }),
    R('pyre', 'The Pyre', X, 1, 'flame', '#ff4d1f', 'Every creature that dies burning makes your fire a little hotter, for the rest of the descent.', (s) => { s.pyre += 1; }),

    ...WHOLE('drywood', 'Dry Wood', 'draught', 'The Still Flame', 'heartfire', 'Heart of the Fire', 'flame', FI, 'fire', 'fireAll', 'while you stand still'),

    // ---- wax: it slows, it scalds, it spreads, and it sets
    R('tallowbolt', 'Tallow Bolt', U, 3, 'drop', WA, 'Your bolts are tipped with wax: what they hit is slowed and scalded. Harder each rank.', (s, n) => { s.boltWax += 1; s.waxDmg *= RK(n, LF.TUNE.src); s.boltColor = '#f6ecd0'; }),
    R('spiltwax', 'Spilt Wax', U, 3, 'drop', WA, 'Your dash spills a trail of wax that waxes whatever wades through it. Wider each rank.', (s, n) => { s.waxTrail += n; }),
    R('candleglow', 'Candle Glow', X, 1, 'candle', WA, 'Your wax gives off light.', (s) => { s.poolLight = 1; }, { bridge: 'light', legend: true }),
    R('candlefall', 'Candlefall', U, 3, 'candle', WA, 'Your flare waxes all it touches and floods the floor round you with wax. The flood lasts longer each rank.', (s, n) => { s.waxFlood += n; s.flareWax = 1; }),
    R('waxskin', 'Wax Skin', U, 3, 'candle', WA, 'A coat of wax takes blows before your light does, and sets again when you go unhurt. Thicker each rank.', (s, n) => { s.coatMax = RK(n, [8, 14, 24]) * LF.EMBER; }),
    R('lastcoat', 'The Last Coat', U, 1, 'candle', WA, 'Resting by a lit brazier mends you all the way, not just to half.', (s) => { s.restTo = 1; }),
    R('tallow', 'Thick Tallow', C, 3, 'candle', WA, 'Your wax slows more and holds longer. More each rank.', (s, n) => { s.waxSlow += 0.08 * n; s.waxTime += n; }),
    R('scald', 'Scalding Wax', C, 3, 'drop', WA, 'Your wax scalds harder. More each rank.', (s, n) => { s.waxMul *= RK(n, LF.TUNE.amp); }),
    R('brittle', 'Brittle', C, 3, 'shard', WA, 'Your bolts hit waxed creatures harder. More each rank.', (s, n) => { s.brittle = (1 + s.brittle) * RK(n, LF.TUNE.mark) - 1; }),
    R('slowset', 'Slow Set', U, 3, 'drop', WA, 'Wax scalds harder the longer it holds a creature. Faster each rank.', (s, n) => { s.cure += 0.08 * n; }),
    R('drippings', 'Candle Drippings', C, 3, 'candle', WA, 'Creatures that die waxed slowly add to the embers you can hold, for the rest of the descent. More each rank.', (s, n, pl) => { s.drip += n; s.maxLight += Math.min(15 * n, 2.5 * Math.floor(((pl && pl.drips) || 0) / 8)); }),
    R('waxunderfoot', 'Wax Underfoot', U, 3, 'candle', WA, 'While you stand in wax you have laid, blows land softer. Softer each rank.', (s, n) => { s.waxFoot = Math.min(0.8, RK(n, [0.15, 0.3, 0.5])); }),
    R('gout', 'The Gout', F, 3, 'drop', WA, 'In place of bolts you lob slow, heavy gouts of wax. Each lands where you aim, hits everything there and leaves a pool. Harder each rank.', (s, n) => { s.gout = RK(n, [1.4, 1.9, 2.8]); s.boltColor = '#f6ecd0'; }, { form: 'bolt' }),
    R('waxcast', 'The Wax Cast', F, 3, 'candle', WA, 'Your flare casts you in wax. The cast takes the next blow whole, then bursts, waxing and scalding everything near. It takes more blows each rank.', (s, n) => { s.cast = RK(n, [1, 2, 4]); }, { form: 'flare' }),
    R('standingcandle', 'The Standing Candle', F, 3, 'candle', WA, 'Your flare leaves a candle standing in a pool of wax. The candle keeps flaring, more weakly. It stands longer each rank.', (s, n) => { s.candle = RK(n, [3, 5, 8]); }, { form: 'flare' }),
    R('spatter', 'Spatter', U, 3, 'split', WA, 'A bolt that hits a waxed creature spatters its wax onto everything beside it. Farther each rank.', (s, n) => { s.spatter += n; }),
    R('secondskin', 'Second Skin', U, 3, 'candle', WA, 'Your wax coat is thicker. More each rank.', (s, n) => { s.coatMul *= RK(n, [1.5, 2, 3]); }),
    R('shedskin', 'Shed Skin', U, 3, 'candle', WA, 'When your wax coat breaks it bursts, waxing and scalding everything near. Harder each rank.', (s, n) => { s.shed += n; }),
    R('deepwax', 'Deep Wax', C, 3, 'drop', WA, 'Creatures standing in wax you have laid are scalded harder. More each rank.', (s, n) => { s.poolMul *= RK(n, LF.TUNE.amp); }),
    R('softwax', 'Soft Hands', U, 2, 'candle', WA, 'Blows from waxed creatures land softer. Softer each rank.', (s, n) => { s.waxSoft += 0.2 * n; }),
    R('sethard', 'Set Hard', X, 1, 'chain', WA, 'Wax that holds a creature long enough sets hard: it cannot move.', (s) => { s.waxSet += 1; }),

    ...WHOLE('beeswax', 'Beeswax', 'doubleboiler', 'The Double Boiler', 'royalwax', 'Royal Wax', 'candle', WA, 'wax', 'waxAll', 'while waxed creatures are near you'),

    // ---- light: it shows, it sears, and a flash of it stuns
    R('flash', 'Blinding Flash', C, 3, 'sun', LI, 'Your flare stuns longer and reaches farther. More each rank.', (s, n) => { s.flareStun *= 1 + 0.4 * n; s.flareRadius *= 1 + 0.1 * n; }),
    R('quickfuse', 'Quick Fuse', U, 3, 'star', LI, 'Your flare returns sooner and costs fewer embers. More each rank.', (s, n) => { s.flareCd *= Math.pow(0.78, n); s.flareCost *= Math.pow(0.8, n); }),
    R('burningglass', 'Burning Glass', U, 3, 'lens', LI, 'Your light sears what stands in it harder. More each rank.', (s, n) => { s.sear *= RK(n, LF.TUNE.glass); }),
    R('lens', 'The Lens', C, 3, 'lens', LI, 'Your light sears harder the nearer a creature stands to your flame. More each rank.', (s, n) => { s.lensFocus = RK(n, LF.TUNE.focus); }),
    R('whitelight', 'White Light', C, 3, 'sun', LI, 'Your light sears harder, and every light you leave behind sears too. More each rank.', (s, n) => { s.searFlat += LF.TUNE.white * n; }),
    R('shutter', 'Wide Shutter', C, 3, 'sun', LI, 'Your light reaches farther. More each rank.', (s, n) => { s.radiusMul *= 1 + 0.12 * n; }),
    R('afterlight', 'Afterlight', C, 3, 'lens', LI, 'The light your flare leaves behind lasts longer. More each rank.', (s, n) => { s.linger += 0.5 * n; }),
    R('litwick', 'Lit Wick', U, 3, 'sun', LI, 'What your bolts hit stays lit wherever it goes, and each bolt leaves a pool of light. Longer each rank.', (s, n) => { s.boltLight += n; s.boltColor = '#fff6dc'; }),
    R('beacon', 'Beacon', U, 1, 'sun', LI, 'Every flare holds the Hunters back a little longer.', (s) => { s.beacon += 1; }),
    R('brand', 'The Brand', U, 3, 'eye', LI, 'What your flare touches stays branded longer, and everything hurts it more. More each rank.', (s, n) => { s.markBonus += RK(n, [0.2, 0.6, 1.4]); s.markTime += 2 * n; }),
    R('dazzle', 'Dazzle', U, 1, 'eye', LI, 'Your bolts always strike stunned creatures critically.', (s) => { s.stunCrit += 1; }),
    R('gleaning', 'Gleaning Light', U, 1, 'sun', LI, 'Embers and glass lying anywhere in your light drift to you.', (s) => { s.glean += 1; }),
    R('glare', 'Glare', X, 1, 'eye', LI, 'Stunned creatures take more from everything.', (s) => { s.glare += 1; }),
    R('solarcrown', 'Solar Crown', X, 1, 'sun', LI, 'While your lantern is nearly full, your flare costs nothing.', (s) => { s.solarCrown = 1; }),
    R('ray', 'The Ray', F, 3, 'lens', LI, 'A ray in place of bolts. It strikes at once and passes through everything, but reaches only to the edge of your light. Harder each rank.', (s, n) => { s.ray = RK(n, [1.25, 1.6, 2.2]); s.boltColor = '#fff6dc'; }, { form: 'bolt' }),
    R('highnoon', 'High Noon', F, 3, 'sun', LI, 'Your flare does not burst. For a few seconds your light reaches farther and sears far harder. Longer each rank.', (s, n) => { s.noonFor = RK(n, [4, 6, 9]); }, { form: 'flare' }),
    R('lance', 'The Lance', F, 3, 'arrow', LI, 'Your flare is thrown as a lance of light where you aim. It crosses the room, stunning and burning everything in its path. Harder each rank.', (s, n) => { s.lance += 1; s.flareDmg += RK(n, [120, 210, 400]); }, { form: 'flare' }),
    R('longlight', 'Long Light', C, 3, 'eye', LI, 'Your flare burns what it touches, and burns it harder the farther away it stands. More each rank.', (s, n) => { s.farFlare += 0.2 * n; s.flareDmg += 90 * n; }),
    R('whiteflash', 'White Flash', C, 3, 'sun', LI, 'Your flare does more harm. More each rank.', (s, n) => { s.flareAmp *= RK(n, LF.TUNE.amp); }),
    R('glowingflare', 'Glowing Flare', U, 3, 'sun', LI, 'Standing in the light your flare leaves gives embers back. Faster each rank.', (s, n) => { s.flareGlow += 0.625 * n; }),
    R('flarememory', 'Flare of Memory', U, 3, 'heart', LI, 'Your flare gives back embers for every creature it touches. More each rank.', (s, n) => { s.flareHeal += 0.625 * n; }),
    R('softlight', 'Softening Light', X, 1, 'sun', LI, 'Your light lays wax in its inner half.', (s) => { s.softLight = 1; }, { bridge: 'wax', legend: true }),
    R('blindingglow', 'Blinding Glow', U, 3, 'sun', LI, 'Creatures in your light strike softer, the deeper they stand. Softer each rank.', (s, n) => { s.lightSoft = RK(n, [0.2, 0.33, 0.5]); }),
    R('slowdusk', 'The Slow Dusk', U, 3, 'sun', LI, 'Blows drain your light more slowly, and your flare cancels whatever a blow has yet to take. Slower each rank.', (s, n) => { s.hurtTime = Math.max(s.hurtTime, RK(n, [2, 3, 5])); s.flareMend = 1; }),
    R('keenlight', 'Keen Light', C, 3, 'lens', LI, 'Your bolts strike critically more often the deeper a creature stands in your light. More each rank.', (s, n) => { s.keen += 0.2 * n; }),
    R('hardlight', 'Hard Light', U, 3, 'star', LI, 'Your critical strikes hit harder. More each rank.', (s, n) => { s.critMul = RK(n, [2.5, 3.25, 5]); }),

    ...WHOLE('cleanglass', 'Clean Glass', 'trimmedwick', 'The Trimmed Wick', 'seconddawn', 'Second Dawn', 'sun', LI, 'light', 'lightAll', 'the fuller your lantern'),

    // ---- chain: censers swinging round you
    R('censer', 'Censer', U, 3, 'chain', CH, 'A censer swings round you on a chain, striking what it meets and knocking shots out of the air. One more each rank, up to three, then they strike harder.', (s, n) => { s.chainGuard += Math.min(n, 3); if (n > 3) s.chainMul = (1 + s.chainMul) * Math.pow(1.1, n - 3) - 1; }),
    R('flail', 'Flail', U, 3, 'ring', CH, 'For a moment after you dash, your censers swing faster, swell and strike far harder. Harder each rank.', (s, n) => { s.flail += n; }),
    R('castchains', 'Cast Chains', U, 1, 'chain', CH, 'Your flare swells your censers to twice their size for a few seconds.', (s) => { s.flareFling += 1; }),
    R('heavycenser', 'Heavy Censer', C, 3, 'chain', CH, 'Your censers strike harder. More each rank.', (s, n) => { s.chainMul = (1 + s.chainMul) * RK(n, LF.TUNE.amp) - 1; }),
    R('longchain', 'Long Chain', C, 3, 'chain', CH, 'Your censers swing wider. More each rank.', (s, n) => { s.chainReach += 0.08 * n; }),
    R('censerlamps', 'Censer Lamps', X, 1, 'chain', CH, 'Your censers give off light.', (s) => { s.censerLamps = 1; }, { bridge: 'light', legend: true }),
    R('drippingcenser', 'Dripping Censers', X, 1, 'chain', CH, 'Your censers drip wax.', (s) => { s.censerDrip = 3; }, { bridge: 'wax', legend: true }),
    R('counterweight', 'Counterweight', C, 3, 'shield', CH, 'Your censers are heavier: they throw creatures back farther and knock shots out of the air in a wider ring. More each rank.', (s, n) => { s.cwThrow = RK(n, [1.5, 2, 3]); s.cwWide = RK(n, [1.3, 1.6, 2]); }),
    R('tautchain', 'Taut Chain', C, 3, 'chain', CH, 'Your bolts hit harder against a shackled creature, or one a censer has just struck. More each rank.', (s, n) => { s.taut = (1 + s.taut) * RK(n, LF.TUNE.mark) - 1; }),
    R('longswing', 'The Long Swing', U, 3, 'ring', CH, 'The wider your censers swing, the harder they strike. More each rank.', (s, n) => { s.longSwing += 0.05 * n; }),
    R('incense', 'Incense', U, 3, 'ring', CH, 'Every blow of a censer feeds your flame a little. More each rank.', (s, n) => { s.incense += 0.375 * n; }),
    R('throwncenser', 'The Thrown Censer', F, 3, 'chain', CH, 'In place of bolts you throw a censer out on its chain and haul it back. It passes through everything and strikes both ways. Harder each rank.', (s, n) => { s.thrown = RK(n, [1.2, 1.6, 2.3]); }, { form: 'bolt' }),
    // (the Miner's Lamp, kept as a form: a short wide blast)
    R('scattershot', 'The Scattershot', F, 3, 'split', CH, 'In place of single bolts, every shot is a short, wide blast of four weaker ones. Each carries all your bolt carries. Harder each rank.', (s, n) => { s.multishot += 3; s.spread = 0.19; s.boltLife *= 0.42; s.fireRate *= 0.9; s.damage *= RK(n, [0.5, 0.7, 1]); s.boltColor = '#ffd9a0'; }, { form: 'bolt' }),
    R('haul', 'The Haul', F, 3, 'chain', CH, 'Your flare throws chains: everything it touches is shackled and hauled in close. Farther and longer each rank.', (s, n) => { s.haul = RK(n, [1.2, 1.5, 2]); s.haulTime = RK(n, [2, 3, 5]); }, { form: 'flare' }),
    R('hook', 'Hooked Links', U, 1, 'chain', CH, 'Your censers hook what they strike and drag it round with them, in place of shoving it away.', (s) => { s.hook += 1; }),
    R('leash', 'The Long Leash', X, 1, 'chain', CH, 'When a shackled creature dies, its chain leaps to the nearest creature and shackles it.', (s) => { s.leashOn = 1; }),
    R('leapinglink', 'Leaping Link', U, 3, 'chain', CH, 'Your bolts leap on to another creature, more weakly. One more each rank.', (s, n) => { s.chain += n; }),
    R('shackleshot', 'Shackle Shot', U, 1, 'chain', CH, 'Your bolts shove hard and shackle what they hit to the spot for a few seconds.', (s) => { s.boltShackle += 1; s.knock += 0.8; }),

    ...WHOLE('temperedlinks', 'Tempered Links', 'momentum', 'Momentum', 'ironlaw', 'The Iron Law', 'chain', CH, 'chain', 'chainAll', 'while your chain keeps landing blows'),

    // ---- moth: small things that fight for you
    R('lampmoth', 'Lamp Moth', U, 3, 'moth', MO, 'A tame moth circles you and bites what you light. One more each rank.', (s, n) => { s.familiars += n; }),
    R('startled', 'Startled Wings', U, 3, 'wing', MO, 'Every dash looses a moth that fights beside you for a few seconds. One more each rank.', (s, n) => { s.dashMoth += n; }),
    R('flock', 'Flock', U, 3, 'moth', MO, 'Your flare looses moths that fight beside you for a while. More each rank.', (s, n) => { s.flareMoth += 1 + 2 * n; }),
    R('mothshot', 'Moth Shot', U, 1, 'moth', MO, 'Every fifth bolt that lands looses a moth that fights beside you for a few seconds.', (s) => { s.boltMoth += 1; }),
    R('mothdust', 'Moth Dust', C, 3, 'moth', MO, 'Your tame moths bite harder. More each rank.', (s, n) => { s.mothMul *= RK(n, LF.TUNE.amp); }),
    R('frenzy', 'Frenzy', C, 3, 'wing', MO, 'The moths you loose bite harder. More each rank.', (s, n) => { s.swarmMul *= RK(n, LF.TUNE.amp); }),
    R('longwings', 'Long Wings', C, 3, 'wing', MO, 'The moths you loose live longer. More each rank.', (s, n) => { s.mothLife += 3 * n; }),
    R('harry', 'Harry', C, 3, 'moth', MO, 'Your bolts hit harder against whatever a moth has just bitten. More each rank.', (s, n) => { s.harry = (1 + s.harry) * RK(n, LF.TUNE.mark) - 1; }),
    R('flit', 'Flit', C, 3, 'wing', MO, 'Your dash returns sooner and you move faster. More each rank.', (s, n) => { s.dashCd *= Math.pow(0.85, n); s.speed *= 1 + 0.04 * n; }),
    R('mothcloud', 'The Moth Cloud', F, 3, 'moth', MO, 'Your flare leaves a cloud of moths where it burst, biting everything inside again and again. It hangs longer each rank.', (s, n) => { s.mothCloud = RK(n, [4, 6, 9]); }, { form: 'flare' }),
    R('wingedbolts', 'Winged Bolts', F, 3, 'wing', MO, 'Your bolts are moths. They curve toward your aim, hit a little softer than a bolt, and each one bites. The bite is harder each rank.', (s, n) => { s.wing = RK(n, [0.5, 1, 2]); s.damage *= 0.8; s.boltColor = '#e4d4ff'; }, { form: 'bolt' }),
    R('cindermoths', 'Cinder Moths', X, 1, 'moth', MO, 'Your moths burn.', (s) => { s.cinderMoth = 1; s.mothFire += 1; }, { bridge: 'fire', legend: true }),
    R('censermoths', 'Censer Moths', X, 1, 'moth', MO, 'Moths ride your censers.', (s) => { s.censerMoths = 2; }, { bridge: 'chain', legend: true }),
    R('mothlamps', 'Moth Lamps', X, 1, 'moth', MO, 'Your moths give off light.', (s) => { s.mothLamps = 1; }, { bridge: 'light', legend: true }),
    R('decoywings', 'Decoy Wings', U, 3, 'moth', MO, 'When a blow lands, a moth beside you takes it for you. A loosed moth dies of it; a tame one is dazed for a while. More often each rank.', (s, n) => { s.decoy = RK(n, [2, 1.4, 0.9]); }),
    R('hatch', 'Embers Hatch', X, 1, 'moth', MO, 'An ember left on the ground for a few seconds hatches into a moth that fights for you. The ember is gone.', (s) => { s.hatch += 1; }),
    R('brood', 'The Brood', X, 1, 'moth', MO, 'Whatever dies to a moth\'s bite hatches another moth for a few seconds.', (s) => { s.broodKill += 1; }),

    ...WHOLE('hunger', 'Hunger', 'nightbloom', 'Night Bloom', 'greatmoth', 'The Great Moth', 'moth', MO, 'moths', 'mothAll', 'the lower your light'),

    // ---- great works: what a Trial of Embers leaves, and what the Shard remembers. One of each at most.
    R('conflagration', 'Conflagration', B, 1, 'flame', FI, 'Fire spreads, farther and faster, and a creature that has burned can catch again and again.', (s) => { s.conflag += 1; }, { req: FIRE }),
    R('undying', 'Undying Fire', B, 1, 'flame', FI, 'What you set burning burns until it dies.', (s) => { s.undying += 1; }, { req: FIRE }),
    R('themelt', 'The Melt', B, 1, 'drop', WA, 'A waxed creature that dies leaves a pool of wax where it fell.', (s) => { s.melt += 1; }, { req: WAX }),
    R('twicedipped', 'Twice Dipped', B, 1, 'candle', WA, 'Your wax holds twice as long and scalds harder.', (s) => { s.waxTime *= 2; s.waxMul *= 1.5; }, { req: WAX }),
    R('wakeful', 'The Wakeful Lantern', B, 1, 'sun', LI, 'Every few seconds, with a creature near, your lantern flares by itself, more weakly. It costs nothing.', (s) => { s.wakeful += 1; }),
    R('sunstruck', 'Sunstruck', B, 1, 'sun', LI, 'A creature that dies stunned bursts like a small flare and stuns what stands round it.', (s) => { s.sunstruck = 1; }),
    R('peal', 'The Peal', B, 1, 'ring', CH, 'Every blow of a censer rings out: it jars farther and harder.', (s) => { s.peal += 1; }, { req: CENSER }),
    R('gyre', 'The Gyre', B, 1, 'chain', CH, 'Your censers swing twice as fast.', (s) => { s.gyre += 1; }, { req: CENSER }),
    R('cloud', 'A Cloud of Wings', B, 1, 'moth', MO, 'Your moths bite harder for every moth beside you.', (s) => { s.cloud += 1; }, { req: MOTH }),
    R('lampcalls', 'The Lamp Calls', B, 1, 'moth', MO, 'The moths you loose stay twice as long, and more can fly with you at once.', (s) => { s.mothStay += 1; }, { req: MOTH }),

    // ---- bargains: what the Altar of Wax offers. A gift of one theme, and its price.
    R('burntoffering', 'Burnt Offering', K, 1, 'flame', FI, 'Two burning embers circle you and all your fire burns hotter. Your own embers burn down faster.', (s) => { s.orbit += 2; s.fireMul *= 1.4; s.groundMul *= 1.4; s.mantleMul *= 1.4; s.drainMul *= 1.4; }),
    R('melting', 'Melting', K, 1, 'candle', WA, 'Wax runs off you wherever you walk, waxing whatever follows. You hold fewer embers.', (s) => { s.waxWalk += 1; s.maxLight -= 25; }),
    R('nakedflame', 'Naked Flame', K, 1, 'sun', LI, 'Your light reaches farther and sears twice as hard. Every blow takes more from you.', (s) => { s.radiusMul *= 1.25; s.sear *= 2; s.dmgTaken *= 1.3; }),
    R('ballandchain', 'Ball and Chain', K, 1, 'chain', CH, 'Two more censers swing round you. You move slower.', (s) => { s.chainGuard += 2; s.speed *= 0.88; }),
    R('feedmoths', 'Feed the Moths', K, 1, 'moth', MO, 'Three more tame moths circle you. Every ember you gather counts for less.', (s) => { s.familiars += 3; s.emberMul -= 0.33; }),
  ];

  // Kindreds: two named relics, both at rank II, wake a third power that is never offered by itself.
  LF.SYNERGIES = [
    { id: 'wickineach', name: 'A Wick in Each', needs: ['kindle', 'tallowbolt'], desc: 'Every waxed creature is a candle: it burns for as long as the wax holds.', stats: s => { s.waxBurn += 2; } },
    { id: 'thurible', name: 'Thurible', needs: ['censer', 'emberhalo'], desc: 'Your censers smoke with live coals: what they strike burns.', stats: s => { s.chainBurn += 1; } },
    { id: 'noonday', name: 'Noonday', needs: ['burningglass', 'cindertrail'], desc: 'Whatever stands deep in your light catches fire.', stats: s => { s.noon += 1; } },
    { id: 'mothsflame', name: 'Moths to the Flame', needs: ['flock', 'burningflash'], desc: 'Your moths carry fire: what they bite burns.', stats: s => { s.mothFire += 1; } },
    { id: 'waxseal', name: 'Wax Seal', needs: ['censer', 'spiltwax'], desc: 'Your censers leave wax on what they strike, and strike waxed creatures twice as hard.', stats: s => { s.chainWax += 1; } },
    { id: 'votive', name: 'Votive', needs: ['candlefall', 'burningglass'], desc: 'Waxed creatures glow like candles: they are lit wherever they stand, and your light sears them twice as hard.', stats: s => { s.waxGlow += 1; } },
    { id: 'waxmoths', name: 'Wax Moths', needs: ['lampmoth', 'tallowbolt'], desc: 'Your moths leave wax on what they bite.', stats: s => { s.mothWax += 1; } },
    { id: 'hanginglamps', name: 'Hanging Lamps', needs: ['censer', 'litwick'], desc: 'A lamp hangs on each censer: what it strikes stays lit, and so does anything shackled.', stats: s => { s.chainLight += 1; } },
    { id: 'linkbearers', name: 'Link-Bearers', needs: ['startled', 'leapinglink'], desc: 'Your moths carry links: now and then a bite shackles.', stats: s => { s.mothChain += 1; } },
    { id: 'lanternmoths', name: 'Lantern Moths', needs: ['flock', 'litwick'], desc: 'Your moths carry light: they find creatures in the dark, and what they bite stays lit.', stats: s => { s.mothLight += 1; } },
  ];
  for (const sy of LF.SYNERGIES) sy.rank = 2;
  // Kindreds this relic would wake for this player if taken now (shown on offer cards).
  LF.completes = (player, id) => LF.SYNERGIES.filter(sy => sy.needs.includes(id) && !(player.synergies || []).includes(sy) && sy.needs.every(n => (player.relics[n] || 0) + (n === id ? 1 : 0) >= sy.rank));


  LF.RELICS = {};
  for (const r of list) LF.RELICS[r.id] = r;
  // a relic written with three ranks can be taken on past the third
  for (const r of list) if (r.max === 3) { r.base = 3; r.max = LF.TUNE.maxRank; }
  LF.RELIC_LIST = list;

  // Blessings: what the Weeping Lamplighter gives. Plain lasting gains, each one said in full on its card.
  // They live in LF.RELICS so the player carries them like relics, but stay out of the relic pools and the codex count.
  const BN = 'boon';
  LF.BOONS = [
    R('boonwick', 'A Longer Wick', BN, 9, 'candle', '#ffe2a6', '+7 maximum embers.', (s, n) => { s.maxLight += 17.5 * n; }),
    R('boonoil', 'Clean Oil', BN, 9, 'drop', '#ffd28a', 'Your embers burn down 10% slower.', (s, n) => { s.drainMul *= Math.pow(0.9, n); }),
    R('boonspark', 'A Whetted Spark', BN, 9, 'flame', '#ffb347', '+10% damage.', (s, n) => { s.damage *= 1 + 0.1 * n; }),
    R('boonstride', 'Light Feet', BN, 9, 'wing', '#ffe9b8', '+5% move speed.', (s, n) => { s.speed *= 1 + 0.05 * n; }),
    R('boonbreath', 'A Deep Breath', BN, 9, 'star', '#fff2cc', 'Your flare returns 12% sooner.', (s, n) => { s.flareCd *= Math.pow(0.88, n); }),
    R('boonember', 'Banked Embers', BN, 9, 'flame', '#ff9a50', 'Each ember you gather counts for 12% more.', (s, n) => { s.emberMul += 0.12 * n; }),
    R('boonhand', 'An Open Hand', BN, 9, 'eye', '#ffe2a6', 'Two more rerolls, now.', () => {}, { onGain: g => { g.player.rerolls += 2; } }),
    R('boonpurse', 'A Full Purse', BN, 9, 'glass', '#bfe3ff', '60 glass now, and 10% more glass from here on.', (s, n) => { s.glassMul += 0.1 * n; }, { onGain: g => { g.player.glass += 60; g.run.glass += 60; } }),
  ];
  for (const r of LF.BOONS) LF.RELICS[r.id] = r;

  // ---------- themes ----------
  // Every relic belongs to one of five themes (the code calls them schools): light, fire, wax, chain,
  // moth. The stairs deal from the deck; a Trial of Embers leaves a great work; the Altar of Wax offers a bargain. A theme is a flavour and a pull: every rank held of one draws more of it into offers. Nothing else hangs
  // on the count. The snowball is in ranks (take a relic again and it grows) and in kindreds (two named relics wake
  // a third power).
  LF.SCHOOLS = {
    light: { name: 'Light', color: '#fff0b8', glyph: 'sun', tiers: [] },
    fire: { name: 'Fire', color: '#ff7b3d', glyph: 'flame', tiers: [] },
    wax: { name: 'Wax', color: '#f0e2c0', glyph: 'candle', tiers: [] },
    chain: { name: 'Chain', color: '#d9b070', glyph: 'chain', tiers: [] },
    moth: { name: 'Moth', color: '#e4d4ff', glyph: 'moth', tiers: [] },
  };
  const SCHOOL_OF = {
    fire: 'catching kindle cindertrail burningflash emberhalo cinderskin tar pitch scorchedearth whitecoals widehalo stoke slowburn kiln tallowflames firelight fireblade ringfire drywood draught heartfire bankedcoals hearthstone heartwood cinderfall wildfire pyre conflagration undying burntoffering',
    wax: 'tallowbolt spiltwax candlefall waxskin lastcoat tallow scald brittle slowset drippings waxunderfoot gout standingcandle waxcast spatter secondskin shedskin deepwax beeswax doubleboiler royalwax softwax sethard themelt twicedipped melting candleglow',
    light: 'whiteflash lens whitelight flash quickfuse burningglass shutter afterlight litwick beacon brand dazzle gleaning glare solarcrown glowingflare flarememory slowdusk blindingglow softlight keenlight hardlight ray lance highnoon longlight cleanglass trimmedwick seconddawn wakeful sunstruck nakedflame',
    chain: 'censer flail castchains heavycenser longchain counterweight tautchain longswing incense throwncenser haul scattershot drippingcenser censerlamps temperedlinks momentum ironlaw hook leash leapinglink shackleshot peal gyre ballandchain',
    moth: 'lampmoth startled flock mothshot mothdust longwings harry flit frenzy decoywings wingedbolts mothcloud hunger nightbloom greatmoth hatch brood cloud lampcalls feedmoths cindermoths censermoths mothlamps',
  };
  for (const k in SCHOOL_OF) for (const id of SCHOOL_OF[k].split(' ')) { if (LF.RELICS[id]) LF.RELICS[id].school = k; else throw new Error('no relic ' + id); }
  for (const r of list) if (!r.school) throw new Error(r.id + ' has no theme');
  // Paths: the builds inside a theme. Every relic in the deck walks one, and says so on its card.
  LF.PATHS = {
    fire: { burn: ['The Burn', 'kindle catching pitch stoke slowburn bankedcoals wildfire pyre conflagration undying kiln firelight'], ground: ['Scorched Ground', 'cindertrail tar cinderfall burningflash scorchedearth ringfire tallowflames'], mantle: ['The Mantle', 'emberhalo cinderskin whitecoals widehalo burntoffering fireblade hearthstone heartwood'], whole: ['All Fire', 'drywood draught heartfire'] },
    wax: { scald: ['The Scald', 'tallowbolt scald brittle slowset tallow spatter sethard drippings twicedipped'], pool: ['The Pool', 'spiltwax candlefall themelt waxunderfoot gout standingcandle deepwax melting candleglow'], shell: ['The Shell', 'waxskin softwax secondskin shedskin waxcast lastcoat'], whole: ['All Wax', 'beeswax doubleboiler royalwax'] },
    light: { sear: ['The Searing', 'burningglass lens whitelight shutter gleaning litwick nakedflame highnoon blindingglow'], flare: ['The Flare', 'whiteflash flash quickfuse afterlight beacon brand glowingflare flarememory slowdusk softlight solarcrown sunstruck wakeful lance longlight'], eye: ['The Eye', 'dazzle glare keenlight hardlight ray'], whole: ['All Light', 'cleanglass trimmedwick seconddawn'] },
    chain: { censer: ['The Censer', 'censer heavycenser longchain longswing flail castchains counterweight incense hook peal gyre ballandchain throwncenser drippingcenser censerlamps'], shackle: ['The Shackle', 'shackleshot tautchain leash haul leapinglink scattershot'], whole: ['All Chain', 'temperedlinks momentum ironlaw'] },
    moth: { tame: ['The Tame', 'lampmoth mothdust cloud feedmoths cindermoths censermoths'], swarm: ['The Swarm', 'startled flock mothshot longwings brood hatch decoywings lampcalls frenzy mothcloud mothlamps'], wing: ['The Wing', 'flit harry wingedbolts'], whole: ['All Moths', 'hunger nightbloom greatmoth'] },
  };
  for (const k in LF.PATHS) for (const pk in LF.PATHS[k]) { const [nm, ids] = LF.PATHS[k][pk]; for (const id of ids.split(' ')) { const d = LF.RELICS[id]; if (!d || d.school !== k) throw new Error('path ' + pk + ': ' + id + ' is not a relic of ' + k); if (d.path) throw new Error(id + ' walks two paths'); d.path = pk; d.pathName = nm; } }
  for (const r of list) if (!r.path) throw new Error(r.id + ' walks no path');
  // What a relic needs before it does anything: any one of its theme's sources. It can still be offered and taken
  // (that is the price of picking without looking), but the card says it would lie idle, and a lantern that holds
  // relics of a theme with no source for them is shown that theme's sources more often.
  LF.SOURCES = { fire: FIRE, wax: WAX, chain: CENSER, moth: MOTH };
  { const IDLE = { fire: ['catching pitch stoke slowburn bankedcoals wildfire pyre', 'nothing of yours burns yet'], wax: ['tallow scald brittle slowset drippings spatter softwax sethard waxunderfoot', 'you lay no wax yet'], chain: ['flail castchains heavycenser longchain counterweight longswing incense hook', 'you swing no censer yet'], moth: ['mothdust longwings harry decoywings brood', 'you have no moths yet'] };
    for (const k in IDLE) for (const id of IDLE[k][0].split(' ')) { if (!LF.RELICS[id]) throw new Error('no relic ' + id); LF.RELICS[id].src = LF.SOURCES[k]; LF.RELICS[id].srcSay = IDLE[k][1]; }
    LF.RELICS.tautchain.src = CENSER.concat(['shackleshot', 'throwncenser', 'haul']); LF.RELICS.tautchain.srcSay = 'you swing no censer and shackle nothing yet';
    for (const id of ['heavycenser', 'longchain', 'incense']) { LF.RELICS[id].src = CENSER.concat(['throwncenser']); LF.RELICS[id].srcSay = 'you have no censer yet'; }
    const need = (ids, src, say) => { for (const id of ids.split(' ')) { LF.RELICS[id].src = src; LF.RELICS[id].srcSay = say; } };
    need('scorchedearth tallowflames', ['cindertrail', 'tar', 'cinderfall', 'burningflash', 'ringfire'], 'you leave no fire on the ground yet');
    need('whitecoals', ['emberhalo', 'cinderskin', 'burntoffering'], 'you wear no fire yet');
    need('widehalo', ['emberhalo', 'burntoffering'], 'no ember circles you yet');
    need('secondskin shedskin', ['waxskin'], 'no wax coat covers you yet');
    need('candleglow', WAX, 'you have no wax yet');
    need('deepwax', ['spiltwax', 'candlefall', 'gout', 'standingcandle', 'melting', 'themelt'], 'you leave no wax on the ground yet');
    need('cindermoths', MOTH, 'you have no moths yet');
    need('drippingcenser censerlamps censermoths', CENSER, 'you swing no censer yet');
    need('mothlamps', MOTH, 'you have no moths yet');
    need('frenzy', ['startled', 'flock', 'mothshot', 'hatch', 'brood'], 'you loose no moths yet');
    need('mothdust', ['lampmoth', 'feedmoths', 'wingedbolts'], 'you have no tame moths yet');
    need('whiteflash', ['longlight', 'burningflash', 'lance'], 'your flare does no harm yet');
    const of = k => list.filter(r => r.school === k && !['drywood', 'draught', 'heartfire', 'beeswax', 'doubleboiler', 'royalwax', 'cleanglass', 'trimmedwick', 'seconddawn', 'temperedlinks', 'momentum', 'ironlaw', 'hunger', 'nightbloom', 'greatmoth'].includes(r.id)).map(r => r.id);
    need('drywood draught heartfire', of('fire'), 'you have no fire yet'); need('beeswax doubleboiler royalwax', of('wax'), 'you have no wax yet');
    need('temperedlinks momentum ironlaw', of('chain'), 'you have no chain yet'); need('hunger nightbloom greatmoth', of('moth'), 'you have no moths yet'); }
  // What such a relic brings with it: the first rank of the relic its path starts from. Taken with nothing to work
  // on, it comes with that relic; once the lantern has one, it brings nothing more.
  { const BRING = { censer: 'flail castchains heavycenser longchain counterweight longswing incense hook tautchain temperedlinks momentum ironlaw drippingcenser censerlamps censermoths', kindle: 'catching pitch stoke slowburn bankedcoals wildfire pyre drywood draught heartfire', cindertrail: 'scorchedearth tallowflames', emberhalo: 'whitecoals widehalo',
      tallowbolt: 'tallow scald brittle slowset drippings spatter softwax sethard beeswax doubleboiler royalwax', spiltwax: 'deepwax waxunderfoot candleglow', longlight: 'whiteflash', waxskin: 'secondskin shedskin', lampmoth: 'mothdust harry hunger nightbloom greatmoth cindermoths mothlamps', startled: 'frenzy longwings decoywings brood' };
    for (const src in BRING) for (const id of BRING[src].split(' ')) { const d = LF.RELICS[id]; if (!d || !d.src || !LF.RELICS[src]) throw new Error('bring: ' + id + ' / ' + src); d.gives = src; }
    for (const r of list) if (r.src && !r.gives) throw new Error(r.id + ' would lie idle and brings nothing'); }
  LF.brings = (player, id) => { const d = LF.RELICS[id]; return d && d.gives && !player.relics[d.gives] && !d.src.some(s => player.relics[s]) ? LF.RELICS[d.gives] : null; };
  LF.idle = (player, id) => { const d = LF.RELICS[id]; return d && d.src && !d.gives && !d.src.some(s => player.relics[s]) ? d.srcSay : ''; };
  // Abilities that grow with a stat, and the relics that raise that stat. The card names them, and an offer says so
  // when it would feed something the lantern already holds.
  LF.FEEDS = {
    glowingflare: ['afterlight', 'quickfuse'], firelight: ['shutter'], flarememory: ['flash', 'quickfuse', 'sunstruck'], brand: ['flash', 'quickfuse'],
    keenlight: ['shutter'], hardlight: ['keenlight', 'dazzle'], slowburn: ['tar', 'undying'],
    waxunderfoot: ['candlefall', 'spiltwax', 'themelt'], slowset: ['tallow', 'twicedipped'], softwax: ['tallow'], sethard: ['tallow'],
    longswing: ['longchain'], incense: ['censer', 'gyre'], counterweight: ['censer'],
    decoywings: ['lampmoth', 'flock', 'startled', 'longwings'], cloud: ['lampmoth', 'flock'],
    kiln: ['slowburn', 'tar', 'stoke'], fireblade: ['whitecoals', 'emberhalo', 'drywood'], ringfire: ['scorchedearth', 'quickfuse', 'drywood'],
    highnoon: ['burningglass', 'lens', 'quickfuse'], waxcast: ['shedskin', 'secondskin', 'beeswax'], mothcloud: ['frenzy', 'harry', 'hunger'], ray: ['shutter', 'keenlight'], gout: ['slowset', 'waxunderfoot', 'tallow'], throwncenser: ['longchain', 'heavycenser', 'incense'], wingedbolts: ['mothdust', 'harry'],
    lance: ['longlight', 'quickfuse'], haul: ['censer', 'tautchain'], standingcandle: ['afterlight', 'glowingflare', 'candlefall'],
  };
  const AND = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a[0];
  for (const id in LF.FEEDS) { const d = LF.RELICS[id]; if (!d) throw new Error('no relic ' + id); for (const f of LF.FEEDS[id]) if (!LF.RELICS[f]) throw new Error('no relic ' + f + ' to feed ' + id); d.desc += ' Grows with ' + AND(LF.FEEDS[id].map(f => LF.RELICS[f].name)) + '.'; }
  // the line an offer card shows: what this relic would feed, or what already held would feed it
  LF.growsLine = (player, id) => {
    const feeds = Object.keys(LF.FEEDS).filter(a => a !== id && player.relics[a] && LF.FEEDS[a].includes(id)).map(a => LF.RELICS[a].name);
    if (feeds.length) return 'Feeds ' + AND(feeds.slice(0, 2));
    const by = (LF.FEEDS[id] || []).filter(f => player.relics[f]).map(f => LF.RELICS[f].name);
    return by.length && !player.relics[id] ? 'Fed by ' + AND(by.slice(0, 2)) : '';
  };
  // each parent says on its own card what it is kin to
  for (const r of list) { const kin = []; for (const sy of LF.SYNERGIES) if (sy.needs.includes(r.id)) { const o = sy.needs.find(x => x !== r.id); if (!LF.RELICS[o]) throw new Error('no relic for kindred ' + sy.id); kin.push(LF.RELICS[o].name); } if (kin.length) { r.kin = kin; r.desc += ' Kin to ' + (kin.length > 1 ? kin.slice(0, -1).join(', ') + ' and ' + kin[kin.length - 1] : kin[0]) + '.'; } }
  for (const sy of LF.SYNERGIES) for (const id of sy.needs) if (!LF.RELICS[id]) throw new Error('no relic ' + id + ' for kindred ' + sy.id);
  for (const r of list) if (r.req) for (const id of r.req) if (!LF.RELICS[id]) throw new Error('no relic ' + id + ' for ' + r.id);
  LF.schoolCounts = player => { const c = {}; for (const id in player.relics) { const d = LF.RELICS[id]; if (d && d.school) c[d.school] = (c[d.school] || 0) + player.relics[id]; } return c; };
  // A relic's last rank counts double (for relics of three ranks or more): the third Ember Halo brings two embers.
  // What a rank is worth to a relic that adds: 1, 2, then 4 for the third (it has always counted double), and 2 more for
  // every rank after. Relics of one or two ranks, and blessings, count their ranks plainly.
  LF.rankValue = (d, n) => d.base === 3 && n >= 3 ? 2 * n - 2 : n;
  LF.TIERS = [];
  LF.tierOf = () => 0;
  LF.applySchools = () => {};
  LF.BOLT_OF = {};
  // a legendary is a rare card of one rank that carries one theme into another (a bridge): it shows as its own kind
  LF.LEGEND = { name: 'Legendary', color: '#ff9d3a' };
  LF.rar = d => d.legend ? LF.LEGEND : LF.RARITY[d.rarity];
  LF.RARITY = {
    common: { name: 'Common', color: '#c9c2b0', weight: 60, price: 28 },
    uncommon: { name: 'Uncommon', color: '#7fd1ff', weight: 32, price: 50 },
    rare: { name: 'Rare', color: '#ffcf5c', weight: 8, price: 85 },
    cursed: { name: 'Bargain', color: '#c08bff', weight: 0, price: 0 },
    brand: { name: 'Great Work', color: '#ff8a4d', weight: 0, price: 0 },
    form: { name: 'Legendary Form', color: '#8ff0ff', weight: 40, price: 0 }, // (the weight is for a form already held coming round to gain a rank; none is dealt otherwise)
    shadow: { name: 'Shadow', color: '#8f6bff', weight: 0, price: 0 },
    boon: { name: 'Blessing', color: '#ffe2a6', weight: 0, price: 0 },
    kind: { name: 'Choose', color: '#ffe2b0', weight: 0, price: 0 },
  };

  // What this lantern could be offered at all: not a relic at its top rank, and not one that only strengthens
  // something it does not have (`req`: it needs any one of those relics first).
  // the relics that multiply (a path's amplifiers and second multipliers, and a theme's three): what a build is made of
  LF.MULTS = new Set('whiteflash pitch scald heavycenser mothdust lens whitelight slowburn slowset longswing frenzy deepwax scorchedearth whitecoals stoke brittle tautchain harry hardlight drywood draught heartfire beeswax doubleboiler royalwax cleanglass trimmedwick seconddawn temperedlinks momentum ironlaw hunger nightbloom greatmoth'.split(' '));
  for (const id of LF.MULTS) if (!LF.RELICS[id]) throw new Error('no relic ' + id);
  LF.FORMS = list.filter(r => r.form);
  LF.formHeld = (player, slot) => LF.FORMS.find(r => r.form === slot && player.relics[r.id]);
  LF.availRelics = (player) => list.filter(r => (player.relics[r.id] || 0) < r.max - (LF.TUNE.forge && r.max >= 3 ? 1 : 0) && (!r.req || r.req.some(id => player.relics[id])) && (!r.form || !LF.FORMS.some(o => o.form === r.form && o !== r && player.relics[o.id])));
  // Pick `n` distinct relic offers. opts: {minRarity, pool:'cursed', rng, floor}
  LF.rollRelics = function (player, n, opts = {}) {
    const rng = opts.rng || new LF.RNG((Math.random() * 1e9) | 0);
    const floor = opts.floor || 1;
    if (opts.pool === 'boon') {
      const left = LF.BOONS.filter(r => (player.relics[r.id] || 0) < r.max), got = [];
      while (got.length < n && left.length) got.push(left.splice(rng.int(0, left.length - 1), 1)[0]);
      return got;
    }
    const counts = LF.schoolCounts(player);
    // one kind of bolt at a time; and a relic that carries one type into another is only ever offered to a lantern
    // already attuned to the type it starts from
    const avail = LF.availRelics(player);
    const out = [], skip = new Set(); let guard = 0;
    for (let i = 0; i < n; i++) {
      let pool;
      if (opts.pool === 'cursed') pool = avail.filter(r => r.rarity === K && !out.includes(r));
      // rites: never one whose slot (attack, flare, dash) is already taken by another rite
      else if (opts.pool === 'shadow') pool = avail.filter(r => r.rarity === S && !out.includes(r));
      else if (opts.pool === 'brand') pool = avail.filter(r => r.rarity === B && !out.includes(r));
      else {
        // a crossing (a relic that carries one type into another) only turns up where rare things do
        pool = avail.filter(r => r.rarity !== K && r.rarity !== B && r.rarity !== S && (!r.form || player.relics[r.id]) && !out.includes(r) && !skip.has(r) && (!r.needs || opts.minRarity === 'rare') && (!opts.cat || LF.inCat(r, opts.cat)) && (!opts.filter || opts.filter(r)));
        if (opts.minRarity === 'uncommon') pool = pool.filter(r => r.rarity !== C);
        if (opts.minRarity === 'rare' && i === 0) { const rp = pool.filter(r => r.rarity === X); if (rp.length) pool = rp; }
      }
      if (!pool.length) break;
      let pick = rng.weighted(pool, r => {
        let w = LF.RARITY[r.rarity].weight || 10;
        if (r.rarity === X) w += floor * 1.5;
        if (r.rarity === U) w += floor * 1.2;
        if (opts.low) w *= r.rarity === C ? 1.7 : r.rarity === X ? 0.35 : 0.9; // a reliquary holds humbler things than a stair does
        if (player.relics[r.id]) w *= LF.TUNE.again; // a relic already held comes round again: taking it is a rank
        if (counts[r.school] && LF.TUNE.draw) w *= 1.25 + LF.TUNE.draw * Math.min(6, counts[r.school]); // (off: draw is 0) the lantern draws its own kind
        { const src = LF.SOURCES[r.school]; if (src && counts[r.school] && src.includes(r.id) && !src.some(id => player.relics[id])) w *= LF.TUNE.seek; } // and one that holds a theme with nothing to start it is shown a source
        return w;
      });
      // a relic that builds on a power the lantern lacks is not dealt: the relic that gives that power is dealt in its place
      { const src = LF.brings(player, pick.id); if (src) { skip.add(pick); if (out.includes(src) || !rng.chance(LF.TUNE.swap)) { if (guard++ < 60) i--; continue; } pick = src; } }
      out.push(pick);
    }
    return out;
  };

  // ---------- glyph icons (vector, drawn at any size) ----------
  LF.drawIcon = function (ctx, glyph, x, y, s, color) {
    ctx.save();
    ctx.translate(x, y); ctx.scale(s / 24, s / 24);
    ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const P = (pts, close = true) => { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); if (close) ctx.closePath(); };
    switch (glyph) {
      case 'flame':
        ctx.beginPath(); ctx.moveTo(0, -11); ctx.bezierCurveTo(9, -2, 8, 6, 4, 9); ctx.bezierCurveTo(2, 11, -2, 11, -4, 9); ctx.bezierCurveTo(-9, 5, -6, -1, -3, -3); ctx.bezierCurveTo(-2, 0, 0, 0, 0, -11); ctx.fill();
        ctx.globalAlpha = 0.55; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, 5, 2.4, 3.6, 0, 0, LF.TAU); ctx.fill(); break;
      case 'candle':
        ctx.fillRect(-4, -1, 8, 11); ctx.beginPath(); ctx.ellipse(0, -6, 3, 5, 0, 0, LF.TAU); ctx.fill();
        ctx.globalAlpha = 0.5; ctx.fillStyle = '#000'; ctx.fillRect(-4, 2, 8, 1.5); break;
      case 'lens':
        ctx.beginPath(); ctx.arc(-1, -1, 7, 0, LF.TAU); ctx.stroke(); ctx.beginPath(); ctx.moveTo(4, 4); ctx.lineTo(10, 10); ctx.lineWidth = 3.2; ctx.stroke();
        ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(-1, -1, 5, 0, LF.TAU); ctx.fill(); break;
      case 'wing':
        ctx.beginPath(); ctx.moveTo(-9, 6); ctx.quadraticCurveTo(-8, -10, 9, -8); ctx.quadraticCurveTo(5, -3, 6, 0); ctx.quadraticCurveTo(1, 0, 2, 4); ctx.quadraticCurveTo(-3, 3, -9, 6); ctx.fill(); break;
      case 'drop':
        ctx.beginPath(); ctx.moveTo(0, -10); ctx.bezierCurveTo(8, 0, 7, 9, 0, 10); ctx.bezierCurveTo(-7, 9, -8, 0, 0, -10); ctx.fill();
        ctx.globalAlpha = 0.5; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-2, 3, 1.4, 2.6, 0.5, 0, LF.TAU); ctx.fill(); break;
      case 'shard':
        P([-2, -11, 6, -3, 2, 11, -6, 4]); ctx.fill(); ctx.globalAlpha = 0.45; ctx.fillStyle = '#fff'; P([-2, -11, 0, 0, -6, 4]); ctx.fill(); break;
      case 'eye':
        ctx.beginPath(); ctx.moveTo(-11, 0); ctx.quadraticCurveTo(0, -10, 11, 0); ctx.quadraticCurveTo(0, 10, -11, 0); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 3.6, 0, LF.TAU); ctx.fill(); break;
      case 'crown':
        P([-10, 7, -10, -5, -5, 1, 0, -9, 5, 1, 10, -5, 10, 7]); ctx.fill(); break;
      case 'ring':
        ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 8, 0, LF.TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(0, -8, 2.6, 0, LF.TAU); ctx.fill(); break;
      case 'star':
        ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * LF.TAU - Math.PI / 2, r = i % 2 ? 3.6 : 11; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); break;
      case 'bolt':
        P([3, -11, -6, 1, -1, 1, -3, 11, 6, -2, 1, -2]); ctx.fill(); break;
      case 'skull':
        ctx.beginPath(); ctx.arc(0, -2, 8, 0, LF.TAU); ctx.fill(); ctx.fillRect(-4.5, 4, 9, 6);
        ctx.fillStyle = '#0b0a12'; ctx.beginPath(); ctx.arc(-3, -2, 2.2, 0, LF.TAU); ctx.arc(3, -2, 2.2, 0, LF.TAU); ctx.fill(); ctx.fillRect(-0.7, 5, 1.4, 5); break;
      case 'heart':
        ctx.beginPath(); ctx.moveTo(0, 9); ctx.bezierCurveTo(-13, -1, -7, -11, 0, -4); ctx.bezierCurveTo(7, -11, 13, -1, 0, 9); ctx.fill(); break;
      case 'moth':
        ctx.beginPath(); ctx.ellipse(-5, -2, 5.5, 7, -0.4, 0, LF.TAU); ctx.ellipse(5, -2, 5.5, 7, 0.4, 0, LF.TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(-4, 6, 3, 4, 0.3, 0, LF.TAU); ctx.ellipse(4, 6, 3, 4, -0.3, 0, LF.TAU); ctx.fill();
        ctx.fillStyle = '#0b0a12'; ctx.fillRect(-1, -6, 2, 14); break;
      case 'sun':
        ctx.beginPath(); ctx.arc(0, 0, 5, 0, LF.TAU); ctx.fill();
        for (let i = 0; i < 8; i++) { const a = i / 8 * LF.TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 7.5, Math.sin(a) * 7.5); ctx.lineTo(Math.cos(a) * 11, Math.sin(a) * 11); ctx.stroke(); } break;
      case 'moon':
        ctx.beginPath(); ctx.arc(-1, 0, 9.5, -1.15, 1.15, true); ctx.quadraticCurveTo(-2, 0, 2.9, -8.7); ctx.closePath(); ctx.fill(); break;
      case 'feather':
        ctx.beginPath(); ctx.moveTo(-8, 10); ctx.quadraticCurveTo(-6, -8, 8, -11); ctx.quadraticCurveTo(9, 3, -4, 7); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#0b0a12'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-8, 10); ctx.lineTo(6, -8); ctx.stroke(); break;
      case 'arrow':
        ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(-9, 9); ctx.lineTo(7, -7); ctx.stroke(); P([10, -10, 2, -8, 8, -2]); ctx.fill(); break;
      case 'split':
        ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-1, 0); ctx.lineTo(9, -8); ctx.moveTo(-1, 0); ctx.lineTo(9, 8); ctx.stroke();
        ctx.beginPath(); ctx.arc(9, -8, 2.2, 0, LF.TAU); ctx.arc(9, 8, 2.2, 0, LF.TAU); ctx.fill(); break;
      case 'shield':
        ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(9, -6); ctx.quadraticCurveTo(9, 6, 0, 11); ctx.quadraticCurveTo(-9, 6, -9, -6); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 0.35; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, 11); ctx.quadraticCurveTo(-9, 6, -9, -6); ctx.closePath(); ctx.fill(); break;
      case 'chain':
        ctx.lineWidth = 2.8; ctx.beginPath(); ctx.ellipse(-4, -4, 5, 3.4, Math.PI / 4, 0, LF.TAU); ctx.stroke(); ctx.beginPath(); ctx.ellipse(4, 4, 5, 3.4, Math.PI / 4, 0, LF.TAU); ctx.stroke(); break;
      case 'mask':
        ctx.beginPath(); ctx.moveTo(-10, -6); ctx.quadraticCurveTo(0, -11, 10, -6); ctx.quadraticCurveTo(9, 8, 0, 11); ctx.quadraticCurveTo(-9, 8, -10, -6); ctx.fill();
        ctx.fillStyle = '#0b0a12'; ctx.beginPath(); ctx.ellipse(-4, -1, 2.6, 1.8, 0.3, 0, LF.TAU); ctx.ellipse(4, -1, 2.6, 1.8, -0.3, 0, LF.TAU); ctx.fill(); break;
      case 'seed':
        ctx.beginPath(); ctx.ellipse(0, 3, 6, 8, 0, 0, LF.TAU); ctx.fill(); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -5); ctx.quadraticCurveTo(1, -10, 6, -11); ctx.stroke(); break;
      case 'magnet':
        ctx.lineWidth = 5; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.arc(0, 0, 7, Math.PI, 0); ctx.lineTo(7, 8); ctx.moveTo(-7, 0); ctx.lineTo(-7, 8); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.fillRect(-9.5, 6, 5, 3.5); ctx.fillRect(4.5, 6, 5, 3.5); break;
      case 'cloak':
        ctx.beginPath(); ctx.moveTo(0, -11); ctx.quadraticCurveTo(7, -9, 6, -2); ctx.lineTo(10, 10); ctx.quadraticCurveTo(0, 6, -10, 10); ctx.lineTo(-6, -2); ctx.quadraticCurveTo(-7, -9, 0, -11); ctx.fill(); break;
      case 'hourglass':
        P([-7, -10, 7, -10, 1, 0, 7, 10, -7, 10, -1, 0]); ctx.fill(); break;
      case 'glass':
        P([0, -10, 7, 0, 0, 10, -7, 0]); ctx.fill(); ctx.globalAlpha = 0.5; ctx.fillStyle = '#fff'; P([0, -10, 0, 10, -7, 0]); ctx.fill(); break;
      default:
        ctx.beginPath(); ctx.arc(0, 0, 8, 0, LF.TAU); ctx.fill();
    }
    ctx.restore();
  };
})();
