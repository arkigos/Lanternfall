'use strict';
// Relics: every relic is a stack count that modifies the player's stat block. Game code reads the stats.
(function () {
  LF.baseStats = () => ({
    maxLight: 100, damage: 10, fireRate: 4.6, boltSpeed: 560, boltSize: 4, boltLife: 0.72,
    speed: 168, dashCd: 0.85, dashCost: 3,
    flareCost: 12, flareCd: 6, flareDmg: 34, flareRadius: 165, flareStun: 1.5,
    radiusMul: 1, drainMul: 1, emberMul: 1, emberBonus: 0, pickup: 70, glassMul: 1,
    pierce: 0, bounce: 0, multishot: 1, chain: 0, ignite: 0, split: 0, homing: 0,
    crit: 0.05, critMul: 2, dmgTaken: 1, shroudMul: 0.4,
    lowLightDmg: 0, brightDmg: 0, vigil: 0, killHeal: 0, noEmbers: false,
    afterglow: 0, cinderSkin: 0, familiars: 0, novaEvery: 0, reveal: false, flareFree: false,
    eclipseMask: 0, beacon: 0, wildfire: 0, hearth: 0, storm: 0, phoenix: 0, lastLight: 0, overburn: 0,
    brazierBonus: 0, brazierBurn: 0, thorns: 0, extraChoice: 0, orbit: 0, frost: 0, echo: 0, lifeline: 0,
    spread: 0.14, boltColor: '#ffe9b8',
    kindleMul: 1, lampHeal: 0, trapProof: false, emberKeep: false, eliteDmg: 0, sear: 0.4,
    melee: 0, kiln: 0, lance: 0, blink: 0, implode: 0, comet: 0, fireMul: 1, markBonus: 0, markTime: 0,
    buckler: 0, waxSkin: 0, chainGuard: 0, wardRegen: 1, shadeStep: 0, mantle: 0, stealth: 1, ambush: 0, shadowLash: 0, lowDef: 1, noDrainLow: false,
    stormCd: 3, secondWind: 0, shopMul: 1, knock: 1, emberSpark: 0, critEmber: 0, overflow: 0, brazierMax: 0, flareBolts: 0, lodestar: 0, reflect: 0, noMap: false,
  });

  // Starting lanterns: each reshapes the base stats before relics apply.
  LF.LANTERNS = [
    { id: 'tin', name: 'Tin Lantern', glyph: 'candle', color: '#ffd28a', desc: 'A steady, honest flame. No tricks, no weaknesses.', unlockText: '', unlocked: () => true, stats() {} },
    { id: 'hunter', name: "Hunter's Lamp", glyph: 'arrow', color: '#fff2cc', desc: 'Slow, heavy bolts that pierce. Half the fire rate, more than double the damage.', unlockText: 'Reach Level 4', unlocked: m => m.best >= 4,
      stats(s) { s.fireRate *= 0.5; s.damage *= 2.3; s.pierce += 1; s.boltSpeed *= 1.3; s.boltSize *= 1.35; s.boltColor = '#fff6dc'; } },
    { id: 'votive', name: 'Votive Candle', glyph: 'flame', color: '#ffb36b', desc: 'A small bright flame. Quick hands, quick feet and a fast flare, but only 70 light.', unlockText: 'Fell a great shadow', unlocked: m => (m.bosses || 0) >= 1,
      stats(s) { s.maxLight -= 30; s.fireRate *= 1.3; s.speed *= 1.14; s.flareCd *= 0.6; s.dashCd *= 0.8; s.boltColor = '#ffd0a0'; } },
    { id: 'miner', name: "Miner's Lamp", glyph: 'split', color: '#ffc98a', desc: 'A wide, short blast of four bolts. Burns bright and close, with 130 light.', unlockText: 'Unmake 300 creatures in total', unlocked: m => (m.kills || 0) >= 300,
      stats(s) { s.multishot += 3; s.damage *= 0.5; s.boltLife *= 0.42; s.maxLight += 30; s.spread = 0.19; s.fireRate *= 0.9; s.boltColor = '#ffd9a0'; } },
    { id: 'storm', name: 'Chain Lantern', glyph: 'chain', color: '#ffb070', desc: 'Its fire leaps from creature to creature along links of flame, and cinders of the Lantern fall where its light rests. Weaker single hits.', unlockText: 'Finish a Depth', unlocked: m => (m.wins || 0) >= 1,
      stats(s) { s.chain += 2; s.damage *= 0.78; s.storm += 1; s.flareDmg *= 1.4; s.boltColor = '#ffcf9a'; } },
  ];
  LF.LANTERN = {}; for (const l of LF.LANTERNS) LF.LANTERN[l.id] = l;
  // Mastery: depths descended with a lantern, over all runs, make it a little stronger (three levels).
  LF.masteryLevel = (meta, id) => { const d = ((meta && meta.mastery) || {})[id] || 0; return d >= 60 ? 3 : d >= 25 ? 2 : d >= 8 ? 1 : 0; };

  // Omens: a floor may carry one twist.
  LF.OMENS = [
    { id: 'starless', name: 'Sootfall', desc: 'Soot hangs in the air and the dark is thicker, but glass glitters in it.', radius: 0.84, glass: 1.7 },
    { id: 'hungry', name: 'Hungry Dark', desc: 'Your light drains much faster. Embers burn twice as bright.', drain: 1.6, ember: 2 },
    { id: 'swarm', name: 'The Swarm', desc: 'Many small hungers stir.' },
    { id: 'flooded', name: 'Burst Cistern', desc: 'The cisterns above have emptied onto this floor.' },
    { id: 'gilded', name: 'Gilded Dark', desc: 'More reliquaries lie unclaimed, and more elites guard them.' },
    { id: 'hunt', name: 'The Hunt', desc: 'Something has your scent.' },
    { id: 'still', name: 'Stillwater', desc: 'A quiet floor. Rest while you can.' },
    { id: 'tide', name: 'Failing Sluice', desc: 'A sluice above opens and shuts. When the water is in, wading is slow and fire dies in it.' },
  ];

  const R = (id, name, rarity, max, glyph, color, desc, stats, extra) =>
    Object.assign({ id, name, rarity, max, glyph, color, desc, stats }, extra || {});

  const C = 'common', U = 'uncommon', X = 'rare', K = 'cursed', B = 'brand', S = 'shadow';
  const list = [
    // ---- common ----
    R('wick', 'Tallow Wick', C, 5, 'candle', '#ffd28a', '+20 maximum light. Restores 20 light.', (s, n) => { s.maxLight += 20 * n; }, { onGain: g => g.player.addLight(20) }),
    R('flint', 'Flint Heart', C, 5, 'bolt', '#ffb347', '+14% fire rate.', (s, n) => { s.fireRate *= 1 + 0.14 * n; }),
    R('lens', 'Hot Coal', C, 5, 'flame', '#ff9d5c', '+18% bolt damage.', (s, n) => { s.damage *= 1 + 0.18 * n; }),
    R('wing', 'Moth Wing', C, 3, 'wing', '#d9c9ff', '+9% move speed.', (s, n) => { s.speed *= 1 + 0.09 * n; }),
    R('cloak', 'Oiled Cloak', C, 3, 'cloak', '#7fd1b9', 'Dash recharges 22% faster and costs 1 less light.', (s, n) => { s.dashCd *= Math.pow(0.78, n); s.dashCost = Math.max(0, s.dashCost - n); }),
    R('pouch', 'Ember Pouch', C, 3, 'drop', '#ff9d5c', 'Embers restore 35% more light.', (s, n) => { s.emberMul += 0.35 * n; }),
    R('shutter', 'Wide Shutter', C, 3, 'sun', '#ffe9a8', '+12% light radius.', (s, n) => { s.radiusMul *= 1 + 0.12 * n; }),
    R('oil', 'Slow Oil', C, 2, 'drop', '#c8b56a', 'Your light drains 35% slower.', (s, n) => { s.drainMul *= Math.pow(0.65, n); }),
    R('lodestone', "Lamplighter's Hook", C, 2, 'chain', '#d9b070', '+80% pickup range. +15% glass.', (s, n) => { s.pickup *= 1 + 0.8 * n; s.glassMul += 0.15 * n; }),
    R('needle', 'Long Needle', C, 3, 'arrow', '#e8f6ff', 'Bolts fly 22% faster and farther. +8% damage.', (s, n) => { s.boltSpeed *= 1 + 0.22 * n; s.damage *= 1 + 0.08 * n; }),
    R('keen', 'Keen Spark', C, 4, 'star', '#fff3b0', '+8% critical chance.', (s, n) => { s.crit += 0.08 * n; }),
    R('thimble', 'Iron Thimble', C, 3, 'shield', '#a9b4c2', 'Take 10% less damage.', (s, n) => { s.dmgTaken *= Math.pow(0.9, n); }),

    R('secondwind', 'Second Wind', C, 2, 'wing', '#bfe9ff', 'After taking a hit, move 35% faster for a few seconds.', (s, n) => { s.secondWind += n; }),
    R('gildedwick', 'Gilded Wick', C, 2, 'glass', '#ffe08a', 'The Chandler charges 20% less. +10% glass.', (s, n) => { s.shopMul *= Math.pow(0.8, n); s.glassMul += 0.1 * n; }),
    R('heavyoil', 'Heavy Oil', C, 3, 'drop', '#b98a5c', '+10% damage. Bolts shove enemies much harder.', (s, n) => { s.damage *= 1 + 0.1 * n; s.knock += 0.8 * n; }),

    R('flashpowder', 'Flash Powder', C, 3, 'sun', '#fff0b8', 'Flare stuns 40% longer and reaches 10% farther.', (s, n) => { s.flareStun *= 1 + 0.4 * n; s.flareRadius *= 1 + 0.1 * n; }),
    R('pitch', 'Black Pitch', C, 3, 'drop', '#ff7b3d', 'Light sears 40% harder.', (s, n) => { s.sear *= 1 + 0.4 * n; }),

    // ---- uncommon ----
    R('brandiron', 'Branding Iron', U, 2, 'star', '#ffcf5c', 'Creatures kindled by your flare take 25% more damage, for 2 seconds longer.', (s, n) => { s.markBonus += 0.25 * n; s.markTime += 2 * n; }),
    R('emberstorm', 'Spitting Embers', U, 2, 'flame', '#ffb36b', 'Each ember you gather throws a spark at the nearest creature.', (s, n) => { s.emberSpark += n; }),
    R('shadowglass', 'Shadowglass Edge', U, 1, 'shard', '#d7b3ff', 'Critical hits knock an ember loose.', (s) => { s.critEmber += 1; }),
    R('brimming', 'Brimming Wick', U, 1, 'candle', '#fff0b8', 'Embers gathered at full light charge your next volley instead: +60% damage each, up to five.', (s) => { s.overflow += 1; }),
    R('oath', "Lamplighter's Oath", U, 1, 'flame', '#ffe2a6', 'Every brazier you light adds 4 to your maximum light for the rest of the descent.', (s) => { s.brazierMax += 4; }),
    R('flask', "Lamplighter's Flask", U, 2, 'drop', '#ffd28a', 'Each wall lamp you relight restores 1.5 light.', (s, n) => { s.lampHeal += 1.5 * n; }),
    R('surefeet', 'Sure Feet', U, 1, 'wing', '#9dffcf', 'Burst drains, grasping shadows and flame vents cannot hurt you. +5% move speed.', (s) => { s.trapProof = true; s.speed *= 1.05; }),
    R('sack', "Thief's Sack", U, 1, 'drop', '#ffb36b', 'Embers on the floor never fade, and you gather everything from 60% farther away.', (s) => { s.emberKeep = true; s.pickup *= 1.6; }),
    R('elitebane', 'Wardbreaker', U, 2, 'bolt', '#ff8a8a', '+30% damage to elites and champions.', (s, n) => { s.eliteDmg += 0.3 * n; }),
    R('prism', 'Forked Wick', U, 2, 'split', '#ffc98a', '+1 bolt per shot. Bolts deal 22% less damage.', (s, n) => { s.multishot += n; s.damage *= Math.pow(0.78, n); }),
    R('ricochet', 'Rebounding Spark', U, 2, 'bolt', '#ffc98a', 'Bolts bounce off walls once more.', (s, n) => { s.bounce += n; }),
    R('ray', 'Piercing Ray', U, 2, 'arrow', '#ffe08a', 'Bolts pierce one more enemy.', (s, n) => { s.pierce += n; }),
    R('afterglow', 'Afterglow', U, 2, 'flame', '#ff8a3d', 'Dashing leaves a trail of fire that burns enemies.', (s, n) => { s.afterglow += n; }),
    R('sunshard', 'Lantern Shard', U, 2, 'sun', '#ffcf5c', 'Flare deals 60% more damage in a 20% larger area.', (s, n) => { s.flareDmg *= 1 + 0.6 * n; s.flareRadius *= 1 + 0.2 * n; }),
    R('cinderskin', 'Cinder Skin', U, 2, 'shield', '#ff7b54', 'When hit, erupt in flame: damages and repels nearby enemies.', (s, n) => { s.cinderSkin += n; }),
    R('hungry', 'Hungry Flame', U, 2, 'skull', '#ff5d5d', 'Kills restore 1.2 light. -10 maximum light.', (s, n) => { s.killHeal += 1.2 * n; s.maxLight -= 10 * n; }),
    R('vigil', 'Candle of Vigil', U, 1, 'candle', '#fff1c1', 'Stand still for a moment: +35% damage and +15% light radius.', (s, n) => { s.vigil += n; }),
    R('chain', 'Link of Flame', U, 2, 'chain', '#ffb070', 'Bolts leap along a link of flame to one more nearby enemy for 60% damage.', (s, n) => { s.chain += n; }),
    R('scorch', 'Scorch', U, 2, 'flame', '#ff6a2b', 'Bolts ignite enemies, burning for 3 seconds.', (s, n) => { s.ignite += n; }),
    R('lighthouse', 'Lighthouse Lamp', U, 1, 'lens', '#ffe9a8', 'Bolts are 60% larger and deal +55% damage, but fire 25% slower.', (s) => { s.damage *= 1.55; s.boltSize *= 1.6; s.fireRate *= 0.75; }),
    R('gloomglass', 'Gloomglass', S, 1, 'moon', '#b28dff', '+40% damage while your light is below 40%.', (s) => { s.lowLightDmg += 0.4; }),
    R('brightsoul', 'Bright Soul', U, 1, 'sun', '#fff7d6', 'Deal up to +30% damage, scaling with how full your light is.', (s) => { s.brightDmg += 0.3; }),
    R('mirrormoth', 'Mirror Moth', U, 3, 'moth', '#e4d4ff', 'A tame moth circles you and shoots at what you light.', (s, n) => { s.familiars += n; }),
    R('kindling', 'Kindling', U, 3, 'flame', '#ffb36b', 'Kills have a 22% chance to drop an extra ember.', (s, n) => { s.emberBonus += 0.22 * n; }),
    R('trueflame', 'True Flame', U, 1, 'eye', '#ffd9a0', 'Shrouded enemies take 70% damage instead of 40%.', (s) => { s.shroudMul = Math.max(s.shroudMul, 0.7); }),
    R('trigger', 'Hair Trigger', U, 2, 'hourglass', '#ffd28a', 'Flare recharges 30% faster.', (s, n) => { s.flareCd *= Math.pow(0.7, n); }),
    R('tinderbox', 'Tinderbox', U, 1, 'flame', '#ffcb7d', 'Braziers restore 15 more light, and the light of braziers and wall lamps burns enemies.', (s) => { s.brazierBonus += 1; s.brazierBurn += 1; }),
    R('wisp', "Will-o'-Wisp", U, 1, 'eye', '#9dffcf', 'Bolts curve gently toward enemies.', (s) => { s.homing += 1; }),
    R('halo', 'Ember Halo', U, 3, 'ring', '#ffa860', 'A burning ember orbits you, searing what it touches.', (s, n) => { s.orbit += n; }),
    R('thorns', 'Brand of Thorns', U, 2, 'star', '#ff9a76', 'Enemies that touch you take 40 damage and are stunned.', (s, n) => { s.thorns += n; }),
    R('rime', 'Tallow Drip', U, 1, 'drop', '#f0e2c0', 'Bolts spatter hot wax: enemies hit are slowed 30% for 2 seconds.', (s) => { s.frost += 1; }),
    R('lifeline', 'Lifeline', U, 1, 'heart', '#ff8fa3', 'Taking a hit that would snuff you instead leaves you at 1 light, once per room.', (s) => { s.lifeline += 1; }),

    R('waxbuckler', 'Wax Buckler', U, 2, 'shield', '#f0e2c0', 'A shield of hard wax on your lantern arm stops blows and shots that come from where you are aiming. It holds two, and re-hardens in time.', (s, n) => { s.buckler += 2 * n; }),
    R('waxskin', 'Wax Skin', U, 2, 'candle', '#f0e2c0', 'Go six seconds without being hit and a coat of wax sets over you. It takes the next hit whole.', (s, n) => { s.waxSkin += n; }),
    R('chainguard', 'Whirling Chain', U, 2, 'chain', '#d9b070', 'A length of the great chain circles you, knocking enemy shots out of the air and battering what it touches.', (s, n) => { s.chainGuard += n; }),

    // ---- shadow: never in an ordinary offer. The dark leaves one at the stair when you arrive with your flame nearly out. ----
    R('shadestep', 'Shade Step', S, 1, 'cloak', '#8f6bff', 'Once every six seconds, your dash leaves you a shade for a moment after. Nothing can touch a shade.', (s) => { s.shadeStep += 1; }),
    R('mantle', 'Dark Mantle', S, 2, 'moon', '#8f6bff', 'Below 40% light, one blow in three passes through you.', (s, n) => { s.mantle += 0.33 * n; }),
    R('hooded', 'Hooded Lantern', S, 1, 'eye', '#8f6bff', 'Your light reaches a fifth less far. Creatures notice you from half as far, and one that has not noticed you takes double damage.', (s) => { s.radiusMul *= 0.8; s.stealth = 0.5; s.ambush += 1; }),
    R('longshadow', 'Long Shadow', S, 1, 'moon', '#8f6bff', 'Below half light, your shadow lashes the nearest creature every second and a half.', (s) => { s.shadowLash += 1; }),

    // ---- rare ----
    R('twinwick', 'Twin Wick', X, 1, 'star', '#ffe08a', 'Every 5th shot also releases a ring of 8 bolts.', (s) => { s.novaEvery = 5; }),
    R('starchart', "Lamplighter's Rounds", X, 1, 'eye', '#ffd9a0', 'Each floor is revealed on the map. +25% glass.', (s) => { s.reveal = true; s.glassMul += 0.25; }),
    R('solarcrown', 'Solar Crown', X, 1, 'crown', '#ffd34d', 'Flare costs no light.', (s) => { s.flareFree = true; }),
    R('eclipsemask', 'Eclipse Mask', S, 1, 'mask', '#c9a7ff', 'Dashing through enemies wounds and marks them: marked enemies take +60% damage.', (s) => { s.eclipseMask += 1; }),
    R('beaconseed', 'Beacon Seed', X, 1, 'seed', '#fff0a8', 'Flare leaves a blazing beacon for 9 seconds that burns enemies in its light.', (s) => { s.beacon += 1; }),
    R('wildfire', 'Wildfire', X, 1, 'flame', '#ff4d1f', 'Bolts ignite. Burning enemies explode when they die, spreading the fire.', (s) => { s.wildfire += 1; s.ignite += 1; }),
    R('prismcore', 'Bursting Coal', X, 1, 'split', '#ffb070', 'Bolts split in two on their first hit.', (s) => { s.split += 1; }),
    R('hearth', 'Heart of the Hearth', X, 1, 'heart', '#ffb07a', 'Slowly regain light whenever no enemy is hunting you.', (s) => { s.hearth += 1; }),
    R('storm', 'Cinderfall', X, 1, 'flame', '#ffb347', 'Every 3 seconds a cinder of the Lantern falls on an enemy inside your light.', (s) => { s.storm += 1; }),
    R('phoenix', 'Phoenix Feather', X, 1, 'feather', '#ff9140', 'Once per floor, when your light dies it rekindles at 35%.', (s) => { s.phoenix += 1; }),
    R('lastlight', 'Last Light', S, 1, 'hourglass', '#e6dcff', 'Below 25% light, enemies move 35% slower and you take 25% less damage.', (s) => { s.lastLight += 1; }),
    R('overburn', 'Overburn', X, 1, 'flame', '#fff0d0', '+70% damage, but every shot burns a little of your light.', (s) => { s.overburn += 1; s.damage *= 1.7; }),
    R('echo', 'Echo Bell', X, 1, 'ring', '#c3f0ff', 'Flare rings a second time a moment later at half strength.', (s) => { s.echo += 1; }),

    R('bellhammer', "Bellfounder's Hammer", X, 1, 'ring', '#9fe3ff', 'Your flare also throws a ring of twelve bolts.', (s) => { s.flareBolts += 12; }),
    R('lodestar', 'Long Throw', X, 1, 'arrow', '#ffd9a0', 'Bolts hit harder the farther they fly: up to +80% at long range.', (s) => { s.lodestar += 1; }),
    R('mirrorshard', 'Polished Shutter', X, 1, 'shield', '#ffe9b8', 'One in four enemy bolts that would strike you is turned back instead.', (s) => { s.reflect += 0.25; }),

    // ---- rites: offered when a great shadow falls. Each one changes how you fight; one per slot. ----
    R('riteblade', 'Rite of the Blade', B, 1, 'shard', '#ffb070', 'Your lantern throws no bolts. You swing a blade of fire in a wide arc instead: heavy blows that cut enemy shots out of the air, and every blow that lands feeds your flame.', (s) => { s.melee += 1; }, { slot: 'attack' }),
    R('ritekiln', 'Rite of the Kiln', B, 1, 'flame', '#ff8a3d', 'Hold fire to stoke a coal, release to throw it. A full coal hits like six bolts and bursts where it lands.', (s) => { s.kiln += 1; }, { slot: 'attack' }),
    R('ritelance', 'Rite of the Lance', B, 1, 'arrow', '#fff0b8', 'Your flare becomes a lance of light thrown where you aim. It crosses the room, pierces everything and hits more than twice as hard.', (s) => { s.lance += 1; }, { slot: 'flare' }),
    R('ritestep', 'Rite of the Step', B, 1, 'wing', '#cfe3ff', 'Your flare carries you. You vanish in one burst and arrive, where you aim, in another.', (s) => { s.blink += 1; }, { slot: 'flare' }),
    R('ritestar', 'Rite of the Bellows', B, 1, 'ring', '#ffcf5c', 'Your flare first draws every nearby creature in to you, the way a bellows draws breath, then bursts half again as hard.', (s) => { s.implode += 1; }, { slot: 'flare' }),
    R('ritecomet', 'Rite of the Comet', B, 1, 'feather', '#ff9140', 'Your dash is a comet: nearly twice as far, it burns whatever it passes through and leaves fire behind. It costs much more light.', (s) => { s.comet += 1; s.afterglow += 1; s.dashCost = s.dashCost * 2 + 2; }, { slot: 'dash' }),

    // ---- cursed (shrine bargains) ----
    R('motheaten', 'Moth-Eaten Map', K, 1, 'eye', '#b9a27a', 'You have no map. +40% glass, and the stair offers one more relic.', (s) => { s.noMap = true; s.glassMul += 0.4; s.extraChoice += 1; }),
    R('debt', "Chandler's Debt", K, 1, 'glass', '#ff9a9a', 'Gain 150 glass now. The Chandler charges double from here on.', (s) => { s.shopMul *= 2; }, { onGain: g => { g.player.glass += 150; g.run.glass += 150; } }),
    R('glasscannon', 'Glass Cannon', K, 1, 'skull', '#ff6b6b', '+60% damage. -30 maximum light.', (s) => { s.damage *= 1.6; s.maxLight -= 30; }),
    R('blackcandle', 'Black Candle', K, 1, 'candle', '#a48cff', '+45% fire rate. -25% light radius.', (s) => { s.fireRate *= 1.45; s.radiusMul *= 0.75; }),
    R('hollowoil', 'Hollow Oil', K, 1, 'drop', '#8affc1', 'Embers restore twice as much, but your light drains 1.8x faster.', (s) => { s.emberMul += 1; s.drainMul *= 1.8; }),
    R('umbralpact', 'Umbral Pact', K, 1, 'moon', '#9a7bff', 'Shrouded enemies take full damage and you deal +25%. -20% light radius.', (s) => { s.shroudMul = 1; s.damage *= 1.25; s.radiusMul *= 0.8; }),
    R('starving', 'Starving Wick', K, 1, 'skull', '#ffa94d', 'Kills restore 3 light. Embers no longer drop.', (s) => { s.killHeal += 3; s.noEmbers = true; }),
    R('paperskin', 'Paper Lantern', K, 1, 'wing', '#ffe3c2', '+25% move speed and +30% fire rate. Take 40% more damage.', (s) => { s.speed *= 1.25; s.fireRate *= 1.3; s.dmgTaken *= 1.4; }),
  ];

  // Synergies: holding every relic in `needs` grants a named bonus.
  LF.SYNERGIES = [
    { id: 'kaleidoscope', name: 'Scattershot', needs: ['prism', 'ricochet'], desc: 'Bolts bounce once more.', stats: s => { s.bounce += 1; } },
    { id: 'wildlight', name: 'Wildlight', needs: ['scorch', 'afterglow'], desc: 'Your fire trail burns twice as hot, and bolts ignite harder.', stats: s => { s.afterglow += 1; s.ignite += 1; } },
    { id: 'stormfront', name: 'Cinder Rain', needs: ['chain', 'storm'], desc: 'Cinders fall every 2 seconds instead of 3.', stats: s => { s.stormCd = 2; } },
    { id: 'hearthbound', name: 'Hearthbound', needs: ['tinderbox', 'oath'], desc: 'Braziers restore 10 more light.', stats: s => { s.brazierBonus += 0.67; } },
    { id: 'razorglass', name: 'Razor Glass', needs: ['glasscannon', 'keen'], desc: 'Critical hits deal 250% damage instead of 200%.', stats: s => { s.critMul += 0.5; } },
    { id: 'mothkeeper', name: 'Moth-keeper', needs: ['mirrormoth', 'kindling'], desc: 'One more tame moth joins you.', stats: s => { s.familiars += 1; } },
    { id: 'sunburst', name: 'Sunburst', needs: ['sunshard', 'bellhammer'], desc: 'Your flare throws six more bolts.', stats: s => { s.flareBolts += 6; } },
    { id: 'secondskin', name: 'Second Skin', needs: ['thimble', 'cinderskin'], desc: 'Take 10% less damage.', stats: s => { s.dmgTaken *= 0.9; } },
    { id: 'emberheart', name: 'Ember Heart', needs: ['pouch', 'emberstorm'], desc: 'Ember sparks hit twice as hard.', stats: s => { s.emberSpark += 1; } },
    { id: 'deadeye', name: 'Deadeye', needs: ['lodestar', 'needle'], desc: 'Bolts pierce one more creature.', stats: s => { s.pierce += 1; } },
  ];
  // Synergies a relic would complete for this player (used on offer cards).
  LF.completes = (player, id) => LF.SYNERGIES.filter(sy => sy.needs.includes(id) && !player.relics[id] && sy.needs.every(n => n === id || player.relics[n]));

  LF.RELICS = {};
  for (const r of list) LF.RELICS[r.id] = r;
  LF.RELIC_LIST = list;

  // Blessings: what the Weeping Lamplighter gives. Plain lasting gains, each one said in full on its card.
  // They live in LF.RELICS so the player carries them like relics, but stay out of the relic pools and the codex count.
  const BN = 'boon';
  LF.BOONS = [
    R('boonwick', 'A Longer Wick', BN, 9, 'candle', '#ffe2a6', '+18 maximum light.', (s, n) => { s.maxLight += 18 * n; }),
    R('boonoil', 'Clean Oil', BN, 9, 'drop', '#ffd28a', 'Your light burns down 10% slower.', (s, n) => { s.drainMul *= Math.pow(0.9, n); }),
    R('boonspark', 'A Whetted Spark', BN, 9, 'flame', '#ffb347', '+10% damage.', (s, n) => { s.damage *= 1 + 0.1 * n; }),
    R('boonstride', 'Light Feet', BN, 9, 'wing', '#ffe9b8', '+5% move speed.', (s, n) => { s.speed *= 1 + 0.05 * n; }),
    R('boonbreath', 'A Deep Breath', BN, 9, 'star', '#fff2cc', 'Your flare returns 12% sooner.', (s, n) => { s.flareCd *= Math.pow(0.88, n); }),
    R('boonember', 'Banked Embers', BN, 9, 'flame', '#ff9a50', 'Embers restore 12% more light.', (s, n) => { s.emberMul += 0.12 * n; }),
    R('boonhand', 'An Open Hand', BN, 9, 'eye', '#ffe2a6', 'Two more rerolls, now.', () => {}, { onGain: g => { g.player.rerolls += 2; } }),
    R('boonpurse', 'A Full Purse', BN, 9, 'glass', '#bfe3ff', '60 glass now, and 10% more glass from here on.', (s, n) => { s.glassMul += 0.1 * n; }, { onGain: g => { g.player.glass += 60; g.run.glass += 60; } }),
  ];
  for (const r of LF.BOONS) LF.RELICS[r.id] = r;

  // ---------- schools ----------
  // Every relic belongs to a school. Holding 3, 5 and 7 relics of one school (stacks count) attunes the lantern
  // to it, and the bonuses are large on purpose: the deep outscales a lantern that takes a little of everything.
  LF.SCHOOLS = {
    spark: { name: 'Spark', color: '#ffd34d', glyph: 'bolt', tiers: ['+15% bolt damage', '+50% bolt damage', '+120% bolt damage, +10% critical chance'] },
    prism: { name: 'Chain', color: '#e0b070', glyph: 'chain', tiers: ['Bolts pierce one more creature', '+1 bolt per shot, each a fifth weaker', '+2 bolts per shot, and bolts arc to another creature'] },
    pyre: { name: 'Pyre', color: '#ff7b3d', glyph: 'flame', tiers: ['Fire and searing light burn 50% hotter', 'Fire and searing light burn 150% hotter', 'Fire and searing light burn five times as hot'] },
    flare: { name: 'Flare', color: '#fff0b8', glyph: 'sun', tiers: ['Flare: +40% damage, recharges 10% faster', 'Flare: +120% damage, recharges 30% faster', 'Flare: +250% damage, recharges 45% faster, costs half'] },
    ember: { name: 'Ember', color: '#ff9d5c', glyph: 'drop', tiers: ['+15 maximum light, kills restore a little more', '+45 maximum light, and it burns down 25% slower', '+90 maximum light, and up to +50% damage while it is full'] },
    dusk: { name: 'Wax', color: '#f0e2c0', glyph: 'shield', tiers: ['Take 8% less damage, +5% speed', 'Take 25% less damage, dash recharges 25% faster', 'Take 42% less damage, and your wax wards mend twice as fast'] },
    shadow: { name: 'Shadow', color: '#8f6bff', glyph: 'moon', tiers: ['Below half light, take 20% less damage', 'Below 40% light, deal 50% more damage', 'Below 30% light, your flame no longer burns down'] },
  };
  const SCHOOL_OF = {
    spark: 'flint lens needle keen heavyoil shadowglass elitebane vigil lighthouse overburn lodestar trueflame riteblade glasscannon blackcandle',
    prism: 'prism ricochet ray chain mirrormoth wisp twinwick prismcore storm emberstorm chainguard',
    pyre: 'afterglow cinderskin scorch tinderbox halo thorns wildfire pitch ritekiln ritecomet',
    flare: 'sunshard trigger solarcrown beaconseed echo bellhammer flashpowder brandiron ritelance ritestep ritestar',
    ember: 'wick pouch shutter oil lodestone gildedwick brimming oath flask sack hungry brightsoul kindling hearth phoenix starchart motheaten debt hollowoil starving',
    dusk: 'wing cloak thimble secondwind surefeet rime lifeline mirrorshard waxbuckler waxskin paperskin',
    shadow: 'gloomglass lastlight eclipsemask shadestep mantle hooded longshadow umbralpact',
  };
  for (const k in SCHOOL_OF) for (const id of SCHOOL_OF[k].split(' ')) if (LF.RELICS[id]) LF.RELICS[id].school = k;
  LF.schoolCounts = player => { const c = {}; for (const id in player.relics) { const d = LF.RELICS[id]; if (d && d.school) c[d.school] = (c[d.school] || 0) + player.relics[id]; } return c; };
  LF.tierOf = n => n >= 7 ? 3 : n >= 5 ? 2 : n >= 3 ? 1 : 0;
  LF.applySchools = (s, c) => {
    let t;
    if ((t = LF.tierOf(c.spark || 0))) { s.damage *= [1, 1.15, 1.5, 2.2][t]; if (t === 3) s.crit += 0.1; }
    if ((t = LF.tierOf(c.prism || 0))) { s.pierce += 1; if (t >= 2) { s.multishot += 1; s.damage *= 0.8; } if (t >= 3) { s.multishot += 1; s.chain += 1; s.damage *= 0.85; } }
    if ((t = LF.tierOf(c.pyre || 0))) s.fireMul *= [1, 1.5, 2.5, 5][t];
    if ((t = LF.tierOf(c.flare || 0))) { s.flareDmg *= [1, 1.4, 2.2, 3.5][t]; s.flareCd *= [1, 0.9, 0.7, 0.55][t]; if (t === 3) s.flareCost *= 0.5; }
    if ((t = LF.tierOf(c.ember || 0))) { s.maxLight += [0, 15, 45, 90][t]; s.killHeal += [0, 0.3, 0.8, 1.5][t]; if (t >= 2) s.drainMul *= 0.75; if (t === 3) s.brightDmg += 0.5; }
    if ((t = LF.tierOf(c.dusk || 0))) { s.dmgTaken *= [1, 0.92, 0.75, 0.58][t]; s.speed *= [1, 1.05, 1.05, 1.05][t]; if (t >= 2) s.dashCd *= 0.75; if (t === 3) s.wardRegen *= 2; }
    if ((t = LF.tierOf(c.shadow || 0))) { s.lowDef *= 0.8; if (t >= 2) s.lowLightDmg += 0.5; if (t === 3) s.noDrainLow = true; }
  };
  LF.RARITY = {
    common: { name: 'Common', color: '#c9c2b0', weight: 60, price: 28 },
    uncommon: { name: 'Uncommon', color: '#7fd1ff', weight: 32, price: 50 },
    rare: { name: 'Rare', color: '#ffcf5c', weight: 8, price: 85 },
    cursed: { name: 'Cursed', color: '#c08bff', weight: 0, price: 0 },
    brand: { name: 'Rite', color: '#ff8a4d', weight: 0, price: 0 },
    shadow: { name: 'Shadow', color: '#8f6bff', weight: 0, price: 0 },
    boon: { name: 'Blessing', color: '#ffe2a6', weight: 0, price: 0 },
  };

  // Pick `n` distinct relic offers. opts: {minRarity, pool:'cursed', rng, floor}
  LF.rollRelics = function (player, n, opts = {}) {
    const rng = opts.rng || new LF.RNG((Math.random() * 1e9) | 0);
    const floor = opts.floor || 1;
    if (opts.pool === 'boon') {
      const left = LF.BOONS.filter(r => (player.relics[r.id] || 0) < r.max), got = [];
      while (got.length < n && left.length) got.push(left.splice(rng.int(0, left.length - 1), 1)[0]);
      return got;
    }
    const avail = list.filter(r => (player.relics[r.id] || 0) < r.max);
    const counts = LF.schoolCounts(player);
    const out = [];
    for (let i = 0; i < n; i++) {
      let pool;
      if (opts.pool === 'cursed') pool = avail.filter(r => r.rarity === K && !out.includes(r));
      // rites: never one whose slot (attack, flare, dash) is already taken by another rite
      else if (opts.pool === 'shadow') pool = avail.filter(r => r.rarity === S && !out.includes(r));
      else if (opts.pool === 'brand') pool = avail.filter(r => r.rarity === B && !out.includes(r) && !list.some(o => o.rarity === B && o.slot === r.slot && player.relics[o.id]));
      else {
        pool = avail.filter(r => r.rarity !== K && r.rarity !== B && r.rarity !== S && !out.includes(r));
        if (opts.minRarity === 'uncommon') pool = pool.filter(r => r.rarity !== C);
        if (opts.minRarity === 'rare' && i === 0) { const rp = pool.filter(r => r.rarity === X); if (rp.length) pool = rp; }
      }
      if (!pool.length) break;
      const pick = rng.weighted(pool, r => {
        let w = LF.RARITY[r.rarity].weight || 10;
        if (r.rarity === X) w += floor * 1.5;
        if (r.rarity === U) w += floor * 1.2;
        if (opts.low) w *= r.rarity === C ? 1.7 : r.rarity === X ? 0.35 : 0.9; // a reliquary holds humbler things than a stair does
        if (player.relics[r.id]) w *= 0.85;
        if (r.school && counts[r.school]) w *= 1.15 + 0.05 * Math.min(5, counts[r.school]); // the lantern draws its own kind, a little
        return w;
      });
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
