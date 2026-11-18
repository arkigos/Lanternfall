'use strict';
// Game: run state, floor flow, combat rules, drops, interactions.
(function () {
  const fx = LF.fx, TILE = LF.TILE, TAU = LF.TAU;

  LF.EMBER = 2.5; // one ember, in the units the lantern's stats are kept in: the health bar and every card count in embers
  LF.embers = v => { const n = Math.round(v / LF.EMBER * 2) / 2; return n || 0.5; };
  // Vows: handicaps sworn before a descent, each paying extra cinders.
  LF.VOWS = [
    { id: 'glass', name: 'Vow of Glass', desc: 'Your lantern holds half as many embers.', bonus: 0.4 },
    { id: 'haste', name: 'Vow of Haste', desc: 'Your embers burn down half again as fast.', bonus: 0.25 },
    { id: 'silence', name: 'Vow of Silence', desc: 'You cannot flare.', bonus: 0.25 },
    { id: 'hunted', name: 'Vow of the Hunted', desc: 'A Hunter stalks you on every floor.', bonus: 0.3 },
    { id: 'thrift', name: 'Vow of Thrift', desc: 'The stair offers one relic fewer.', bonus: 0.2 },
  ];
  LF.todayKey = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  // Bestiary: shown in the codex once a creature has been unmade at least once.
  LF.BESTIARY = [
    ['skitter', 'Quick, weak and never alone. They zigzag in from the dark.'],
    ['moth', 'Drawn to flame. Each one that reaches you takes an ember or two and dies.'],
    ['lurker', 'Circles at the edge of your light, then lunges. The eyes turn red first.'],
    ['hunter', 'Sent after those who linger, or who are marked. Faster than you. It puts out the fires it passes and lunges three times before it rests.'],
    ['spitter', 'Keeps its distance and spits. Its bolts can be dashed through.'],
    ['leech', 'Latches on and drinks. Dash or flare to shake it off.'],
    ['bloat', 'Bursts into a cloud of gloom that smothers your light. Pop it from afar.'],
    ['bulwark', 'Its plate turns bolts aside. Bait the charge into a wall, then strike.'],
    ['brood', 'A nest that keeps hatching skitters until it is unmade.'],
    ['howler', 'Its scream wakes the whole floor and whips nearby creatures into a frenzy.'],
    ['wraith', 'Walks through walls. Cannot be touched until your light gives it shape.'],
    ['snuffer', 'Shrinks your light from across the room. Hunt it first.'],
    ['weaver', 'Steps between shadows and looses seeking orbs. The orbs can be shot down.'],
    ['glass', 'Throws your bolts back while shrouded. Light makes it brittle.'],
    ['thief', 'Eats embers off the floor and runs with them. Unmake it to get them back.'],
    ['breaker', 'Goes for your lit braziers and smothers them. Stop it, or relight them after.'],
    ['bell', 'It rang the hours of the Lantern, and fell with it. Read the gaps in its rings.', true],
    ['warden', 'He kept the great chain. Stay outside what is left of it, and out of the whirlpool.', true],
    ['angler', 'Not every glow down here is a piece of the Lantern. When it dives, find the lure with a shadow beneath it.', true],
    ['mother', 'Every flame is hers to drink. She is only truly hurt while something lights her.', true],
    ['king', 'Crowned in wax. Snuff his votives or your bolts will barely mark him.', true],
    ['sexton', 'His blows knock embers out of you. Take them back before he calls them in and mends.', true],
    ['eclipse', 'The dark that closed around the fallen Lantern. Totality passes. Outlast it.', true],
    ['choir', 'Three masks, one song. Only the mask that is singing can truly be hurt.', true],
    ['bearer', 'The first Lamplighter to reach the Lantern. It answers each dash and each flare with its own.', true],
  ];
  // Feats: one-time goals, checked when a run ends. Each pays cinders once.
  LF.FEATS = [
    { id: 'd3', name: 'First Light', desc: 'Reach Level 3.', reward: 15, test: g => g.mode === 'descent' && g.depth >= 3 },
    { id: 'boss1', name: 'Giantslayer', desc: 'Fell a great shadow.', reward: 25, test: (g, r) => r.bosses >= 1 },
    { id: 'd6', name: 'Into the Catacombs', desc: 'Reach Level 6.', reward: 30, test: g => g.mode === 'descent' && g.depth >= 6 },
    { id: 'dawn', name: 'Dawnbringer', desc: 'Finish a Depth.', reward: 80, test: (g, r) => g.mode === 'descent' && !!r.everWon },
    { id: 'trial', name: 'Tried by Fire', desc: 'Complete a Trial of Embers.', reward: 20, test: (g, r) => (r.trials || 0) >= 1 },
    { id: 'mimic', name: 'Not a Reliquary', desc: 'Unmake a mimic.', reward: 20, test: (g, r) => (r.mimics || 0) >= 1 },
    { id: 'clean', name: 'Thorough', desc: 'Unmake everything on three floors in one descent.', reward: 35, test: (g, r) => (r.fullClears || 0) >= 3 },
    { id: 'relics12', name: 'Collector', desc: 'Carry twelve different relics at once.', reward: 40, test: g => g.player.relicOrder.length >= 12 },
    { id: 'syn2', name: 'Resonance', desc: 'Hold two synergies at once.', reward: 40, test: g => (g.player.synergies || []).length >= 2 },
    { id: 'daily', name: 'Regular', desc: 'Reach Level 4 on a Daily Descent.', reward: 30, test: g => !!g.daily && g.depth >= 4 },
    { id: 'vigil10', name: 'Night Watch', desc: 'Break wave 10 of the Long Vigil.', reward: 40, test: g => g.mode === 'vigil' && (g.vigil.cleared || 0) >= 10 },
    { id: 'vigil20', name: 'The Longest Night', desc: 'Break wave 20 of the Long Vigil.', reward: 120, test: g => g.mode === 'vigil' && (g.vigil.cleared || 0) >= 20 },
    { id: 'vow3', name: 'Oathbound', desc: 'Reach Level 6 with three vows sworn.', reward: 90, test: g => g.mode === 'descent' && g.depth >= 6 && Object.keys(g.vows).length >= 3 },
    { id: 'lamps', name: "Lamplighter's Work", desc: 'Relight 500 wall lamps in total.', reward: 50, test: g => (g.meta.lamps || 0) >= 500 },
    { id: 'kills1000', name: 'Unmaker', desc: 'Unmake 1,000 creatures in total.', reward: 60, test: g => (g.meta.kills || 0) >= 1000 },
    { id: 'lanterns', name: 'Lamplighter', desc: 'Finish a Depth with three different lanterns.', reward: 120, test: g => Object.keys(g.meta.wonWith || {}).length >= 3 },
    { id: 'allboss', name: 'Nine Shadows', desc: 'Fell all nine great shadows at least once.', reward: 100, test: g => ['bell', 'warden', 'angler', 'mother', 'king', 'sexton', 'bearer', 'eclipse', 'choir'].every(k => (g.meta.felled || {})[k]) },
    { id: 'umbral', name: 'Umbral Dawn', desc: 'Finish a Depth on Umbral.', reward: 150, test: (g, r) => g.mode === 'descent' && !!r.everWon && g.diff === LF.DIFFS[2] },
    { id: 'cycle2', name: 'Deeper Still', desc: 'Reach Level 3 of the second Depth.', reward: 120, test: g => g.mode === 'descent' && g.depth >= 12 },
    { id: 'gauntlet', name: 'Six in a Row', desc: 'Run the Gauntlet: six great shadows, back to back.', reward: 150, test: (g, r) => g.mode === 'rush' && !!r.everWon },
  ];
  LF.TEACH = {
    shroud: ['Shrouded', 'That creature is outside your light, so it shrugs off most of the bolt. Bring it into the glow.'],
    ember: ['Embers', 'Everyone in Vael carried a little of its light. The creatures down here still do. Embers are your life: gather them. They wait on the ground while you are full.'],
    school: ['Ranks and Kin', 'Take a relic you already hold and it gains a rank; most have three, and the last counts double. Relics of a theme you hold come round more often. Some relics are kin to another: hold both at rank II and a third power wakes.'],
    brazier: ['Braziers', 'A brazier takes a moment to catch: stay beside it, or put bolts into it. A flare lights it at once. Lit, it refills you and mends you up to half while you rest there.'],
    low: ['Guttering', 'Your embers are low. Find more, or a brazier. A dying lantern does burn hotter, though.'],
    flare: ['Flare', 'Right click (or Q) to flare: it wounds, stuns and reveals everything near you.'],
    gate: ['Ambush', 'Shadow gates seal the room until everything inside is unmade.'],
    shop: ['The Chandler', 'Forms for your bolt and your flare, and lamp oil. A lantern holds one form of each.'],
    vault: ['Lightless vault', 'Your light is halved here until both braziers burn. The reliquary opens when they do. A flare lights braziers too.'],
    stair: ['The stair', 'Descend when you are ready. Unmake nearly everything first and it offers one more relic.'],
  };
  LF.RUSH = [['bell', 3], ['warden', 3], ['mother', 6], ['king', 6], ['eclipse', 9], ['choir', 9]];
  // The great shadows of each boss depth, in the order they unlock.
  LF.BOSS_SETS = [['bell', 'warden', 'angler'], ['mother', 'king', 'sexton'], ['eclipse', 'choir', 'bearer']];
  // The Great Lantern broke as it fell. Each cycle of nine depths ends at one of its shards, and a shard, once
  // taken up, is kept for every descent after. The fifth cycle ends at the Lantern itself.
  LF.SHARDS = [
    { name: 'The Shard of Morning', power: 'Your lantern holds 10 more embers, and they burn down 15% slower.' },
    { name: 'The Shard of the Works', power: 'Every descent begins with the offer of a great work.' },
    { name: 'The Shard of the Chain', power: 'Two more rerolls each descent, and one more relic to choose from at every stair.' },
    { name: 'The Shard of the Heart', power: 'Once each descent, when your last ember would go out, they blaze back to full instead.' },
    { name: 'The Great Lantern', power: '' },
  ];
  LF.ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  // What the player reads: five Depths of nine Levels each. In code a `depth` is still one floor, counted from 1,
  // and `loop` / `cycle` is which Depth it belongs to.
  LF.depthOf = d => Math.floor((Math.max(1, d | 0) - 1) / 9);
  LF.levelOf = d => ((Math.max(1, d | 0) - 1) % 9) + 1;
  LF.depthName = d => 'Depth ' + (LF.ROMAN[LF.depthOf(d)] || LF.depthOf(d) + 1);
  LF.place = (d, sep) => LF.depthName(d) + (sep || '  ·  ') + 'Level ' + LF.levelOf(d);
  LF.placeIn = d => 'Level ' + LF.levelOf(d) + ' of ' + LF.depthName(d);
  LF.DIFFS = [
    { name: 'Kindled', desc: 'Gentler dark', hp: 0.8, dmg: 0.7, drain: 0.7, cinders: 0.75 },
    { name: 'Standard', desc: 'As intended', hp: 1, dmg: 1, drain: 1, cinders: 1 },
    { name: 'Umbral', desc: 'Crueller dark, richer cinders', hp: 1.3, dmg: 1.35, drain: 1.4, cinders: 1.5 },
  ];
  LF.EPIGRAPHS = [
    ['Every window on this street faces up, toward where it used to hang.', 'The chain came down after it, link by link, for an hour.', 'The cisterns broke when it passed. The streets have run ankle-deep ever since.', 'They kept lighting the lamps for a while. You can see where they stopped.', 'Glass in every gutter, and some of it is still warm.'],
    ['They buried their dead with candles, in case.', 'The moths came first. They always know where a light will fail.', 'It fell through here without slowing. The dead were the last to see it.', 'Wax on every ledge, and not one wick left burning.', 'Something has been gathering the pieces. The shelves are swept clean.'],
    ['The stone is warm, as if something below were breathing.', 'Your shadow has begun to walk a little ahead of you.', 'No one has seen it since the fall. The dark has, every day.', 'The dark down here is not empty. It is full.', 'There is a glow under the last stair. It is not a kind one yet.'],
  ];
  LF.TIPS = [
    'Embers wait for you. If you can hold no more, come back for them later.',
    'A flare lights every brazier it touches.',
    'A flare leaves what it touches kindled: for a few seconds it takes far more damage. Flare first, then fire.',
    'Three relics of one school attune your lantern. Five and seven attune it much further. Reroll for your school.',
    'A lantern that takes a little of everything is outscaled by Level six. Commit to a school.',
    'Rest beside a lit brazier to recover up to half your embers.',
    'Your embers burn down on their own, and they can burn all the way out. Beside any fire, they hold.',
    'Linger on a floor and the dark sends hunters after you, up to four. They carry nothing worth taking.',
    'A Hunter is faster than you and puts out the fires it passes. It lunges three times, then it is spent: that is when to hurt it.',
    'A brazier takes a moment to light by hand. Bolts will kindle it from a distance, and a flare lights it at once.',
    'Even a full lantern lights only a pool around you. What you cannot see can still see you.',
    'Great shadows shed embers as you wear them down. Step in and take them.',
    'Shrouded creatures take less than half damage. Fight inside your light.',
    'Your lantern sears whatever stands in its light, hardest close to the flame. A full flame burns hotter than a guttering one.',
    'Light shows and sears, wax slows and scalds, chain swings round you, and moths fight for you.',
    'Fire that catches (Catching Fire) sets alight whatever stands close beside what burns.',
    'Take a relic you already hold and it gains a rank. Most have three, and the last rank counts double.',
    'Some relics are kin. Hold both at rank II and a third power wakes that no stair will ever offer you.',
    'When your embers are nearly gone, every kill gives some back. Do not run: fight.',
    'Enemy shots are black with a red rim. Anything that glows warm is yours to take.',
    'A dash passes straight through bolts, lunges and falling shards.',
    'Bulwarks shrug off bolts from the front. Bait the charge into a wall.',
    'Wraiths cannot be hurt until your light touches them.',
    'A Glass Shade throws your bolts back unless it is lit. Step closer, or flare.',
    'Unmake the Howler first. Its scream wakes the whole floor.',
    'Leeches come off when you dash.',
    'Unmake nearly everything on a floor and the stair offers one more relic.',
    'The Mother of Moths is only truly hurt while something lights her. Relight the braziers she drinks.',
    'Snuffers shrink your light from a distance. Hunt them down.',
    'Cinders are kept even when you die. Spend them at the Hearth.',
    'A relic that builds on a power you lack is never offered. The relic that gives that power comes in its place.',
    'At each stair the Forge will rank up a relic you carry, for glass: ' + LF.TUNE.forgeII + ' for rank II, ' + LF.TUNE.forgeIII + ' for rank III, and ' + LF.TUNE.forgeMore + ' more for each rank after that. Taking the same relic again from an offer ranks it too, for nothing.',
    'Ranks do not stop at III. A relic that keeps coming round keeps growing, and what multiplies grows by half again each time.',
    'What multiplies, multiplies everything else: three relics in each theme make all of that theme do more, and stack on each other. One theme pumped high beats five held low.',
    'Glass buys rerolls. When an offer holds nothing you need, pay to see another: ' + LF.TUNE.rerollGlass + ' glass, and ' + LF.TUNE.rerollMore + ' more each time after on the same offer.',
    'Forms are not found. The Chandler sells them, when the Chandler is there and has the one you want: a form changes how your bolt or your flare works. Glass spent on rerolls is glass not saved for one.',
  ];
  // A tip that fits what actually killed you, when there is one.
  LF.CAUSE_TIPS = [
    ['Fallen Bell', "The Bell's rings always leave gaps. Hold still, find the gap, then step through it."],
    ['Chain Warden', "Stay outside the Warden's chain while it spins, and dash out of the whirlpool's pull."],
    ['whirlpool', "A dash breaks the whirlpool's pull. Its centre is the only part that hurts."],
    ['False Light', 'When the False Light dives, walk your lantern past each lure. Break the one with a shadow beneath it and the beast is dragged up, stunned.'],
    ['Mother of Moths', 'The Mother of Moths is only truly hurt while something lights her. Relight the braziers she drinks.'],
    ['wax', 'Wax pools burn for six seconds. Keep moving, and snuff the votives that ward the King.'],
    ['Candle King', "The King's breath turns slowly. Circle behind it rather than backing away."],
    ['Votive', 'Votives are frail. Break them first: the King barely feels your bolts while they burn.'],
    ['Sexton', "The Sexton's shovel knocks embers out of you. Dash through the wedge, and grab what you dropped before he calls it in."],
    ['grasping bones', 'Graves open in a row, nearest first. Step sideways out of the row rather than backing away along it.'],
    ['falling shard', 'Falling shards and lances are always marked a moment before they land. Watch the floor.'],
    ['Eclipse', 'During Totality your light shrinks for a few seconds. Stay near a lit brazier until it passes.'],
    ['Hollow Choir', 'Only the singing mask can truly be hurt. Shoot the homing orbs down before they reach you.'],
    ['First Bearer', 'The First Bearer answers each dash and each flare with its own. Dash only when you must, and be ready to sidestep the reply.'],
    ['bolt of shadow', 'A dash passes straight through bolts. Dash into a ring, through it, and out the far side.'],
    ['the dark', 'Your embers burned out on their own. Keep killing to feed them, and stop at braziers and wall lamps: beside a fire they do not burn down.'],
    ['Hunter', 'A Hunter lunges three times, then it is spent for a second: hurt it then. A flare stops it dead, and you cannot outrun it.'],
    ['Champion', 'A champion carries more than twice the health of an elite. Kite it around the pillars.'],
    ['Lamp-breaker', "A Lamp-breaker's slam is marked by a red circle. Step out of it, then strike."],
    ['Ember Thief', 'An Ember Thief hits softly. The real cost is the embers it carries off.'],
    ['Lurker', "A Lurker's eyes turn red just before it lunges. Sidestep, or dash across its path."],
    ['Bulwark', 'Bait the charge into a wall: a dazed Bulwark takes extra damage from every side. Up close you can also circle behind its plate.'],
    ['Leech', 'Leeches come off when you dash. Three at once will drain you fast.'],
    ['Moth', 'Moths are frail. Shoot them on the way in, or flare when they swarm.'],
    ['gloom', 'Pop Gloom Bloats from a distance and stay out of the cloud they leave behind.'],
    ['Bloat', 'Pop Gloom Bloats from a distance and stay out of the cloud they leave behind.'],
    ['Wraith', 'A Wraith must be lit before it can be hurt. Keep your light up, or flare to give it shape.'],
    ['Spitter', 'Spitters lead their shots a little. Change direction as they fire.'],
    ['Weaver', "A Weaver's orbs can be shot down, and they turn slowly. Cut across them."],
    ['Glass Shade', 'A Glass Shade throws your bolts back unless it is lit. Step closer, or flare.'],
    ['Howler', 'Unmake the Howler first. Its scream wakes the whole floor.'],
    ['Snuffer', 'Snuffers shrink your light from a distance. Hunt them down before anything else.'],
    ['Skitter', 'Skitters are weak alone. Back through a doorway so they come at you in a line.'],
    ['oil', 'Oil jars burn you too. Shoot them from a few steps away.'],
    ['geyser', 'The drains burst when the Lantern came down. They bubble for a second before they blow: step around them.'],
    ['grasp', 'The dark reaches up through split floors on a steady rhythm. Cross just after it sinks back, or flare: it shrinks from the burst for a while.'],
    ['vent', 'These mains fed oil to every lamp in the city. A broken one glows before it fires, and it burns shadows as readily as you: lure them across it.'],
  ];
  LF.tipFor = cause => { const c = String(cause || ''); for (const [k, t] of LF.CAUSE_TIPS) if (c.indexOf(k) >= 0) return t; return LF.pick(LF.TIPS); };
  LF.BIOMES = [
    { name: 'The Shattered Quarter', sub: 'Where the Lantern came through the streets', floor: [34, 46, 58], wallFace: [44, 60, 78], wallTop: [13, 19, 27], water: [26, 78, 98], accent: '#6fc3d8', ambient: [5, 9, 18], dark: 0.975 },
    { name: 'The Moth Catacombs', sub: 'It fell through the dead without slowing', floor: [46, 39, 54], wallFace: [62, 50, 74], wallTop: [20, 15, 26], water: [58, 44, 92], accent: '#b89cff', ambient: [9, 5, 17], dark: 0.98 },
    { name: 'The Umbral Deep', sub: 'Where the Lantern came to rest', floor: [48, 34, 38], wallFace: [70, 44, 48], wallTop: [22, 13, 15], water: [84, 30, 44], accent: '#ff7b7b', ambient: [11, 3, 6], dark: 0.985 },
  ];

  // ---------- persistent save ----------
  const SAVE_KEY = 'lanternfall_save_v1';
  LF.UPGRADES = [
    { id: 'wick', name: 'Thicker Wick', desc: '+3 maximum embers', max: 5, cost: [20, 35, 55, 80, 110], glyph: 'candle', color: '#ffd28a' },
    { id: 'spark', name: 'Hotter Spark', desc: '+5% damage', max: 5, cost: [25, 40, 60, 90, 130], glyph: 'bolt', color: '#ffb347' },
    { id: 'boots', name: 'Dry Boots', desc: '+3% move speed', max: 3, cost: [20, 40, 70], glyph: 'wing', color: '#d9c9ff' },
    { id: 'oil', name: 'Refined Oil', desc: 'Embers burn down 10% slower', max: 3, cost: [25, 45, 75], glyph: 'drop', color: '#c8b56a' },
    { id: 'ember', name: 'Ember Sense', desc: 'Embers restore 8% more', max: 3, cost: [25, 45, 75], glyph: 'flame', color: '#ff9d5c' },
    { id: 'flare', name: 'Dry Powder', desc: 'Flare recharges 8% faster', max: 3, cost: [20, 40, 70], glyph: 'sun', color: '#ffcf5c' },
    { id: 'purse', name: 'Sewn Purse', desc: 'Start each run with 15 glass', max: 3, cost: [15, 30, 50], glyph: 'glass', color: '#8fe6ff' },
    { id: 'reroll', name: 'Second Glance', desc: '+1 relic reroll per run', max: 3, cost: [30, 60, 100], glyph: 'eye', color: '#9dffcf' },
    { id: 'gift', name: 'Parting Gift', desc: 'Start with a random common relic', max: 1, cost: [90], glyph: 'heart', color: '#ff8fa3' },
    { id: 'choice', name: 'Open Hand', desc: 'One more relic to choose from', max: 1, cost: [160], glyph: 'star', color: '#fff3b0' },
    { id: 'tinder', name: 'Brazier Lore', desc: 'Braziers restore 1 more ember', max: 3, cost: [20, 40, 65], glyph: 'flame', color: '#ffb347' },
    { id: 'pockets', name: 'Deep Pockets', desc: '+8% glass', max: 3, cost: [20, 40, 65], glyph: 'glass', color: '#8fe6ff' },
    { id: 'banked', name: 'Banked Embers', desc: 'Once per run, survive a fatal blow with 6 embers', max: 1, cost: [200], glyph: 'heart', color: '#ff8fa3' },
  ];
  function loadMeta() {
    const def = { cinders: 0, up: {}, mastery: {}, lamps: 0, rushWins: 0, feats: {}, wonWith: {}, felled: {}, met: {}, vigilBest: 0, vows: {}, history: [], daily: null, flash: 1, best: 0, runs: 0, wins: 0, kills: 0, bosses: 0, vol: 0.7, mus: 0.6, shake: 1, diff: 1, lantern: 'fire', autofire: false, seenIntro: false, seenFall: false, shards: 0, cycle: -1, look: 'wick', seen: {} };
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) Object.assign(def, JSON.parse(raw));
    } catch (e) { /* storage unavailable: play without saving */ }
    return def;
  }
  function saveMeta(m) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(m)); } catch (e) { /* ignore */ } }

  class Game {
    constructor(canvas) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d');
      this.meta = loadMeta();
      this.state = 'title'; this.time = 0; this.realTime = 0;
      this.cam = { x: 0, y: 0, zoom: 1, sx: 0, sy: 0 }; this.shakeAmt = 0;
      this.enemies = []; this.bullets = []; this.ebullets = []; this.pickups = []; this.zones = []; this.flashes = []; this.delays = [];
      this.props = []; this.map = null; this.player = null; this.boss = null;
      this.depth = 0; this.floor = 1; this.loop = 0;
      this.fade = null; this.banner = null; this.toasts = []; this.hintT = 0; this.hintText = '';
      this.snuffMul = 1; this.snuffCount = 0; this.threat = 0; this.drainActive = false; this.hitstopT = 0;
      this.enemyHpMul = 1; this.enemyDmgMul = 1; this.bossHpMul = 1; this.hurtVig = 0; this.prompt = null;
      this.diff = LF.DIFFS[1]; this.vows = {}; this.daily = null; this.mode = 'descent'; this.vigil = null; this.run = null; this.offer = null; this.bot = null; this.speed = 1; this.showMap = false; this.combo = 0; this.comboT = 0;
      this.renderer = new LF.Renderer(this);
      LF.audio.volume = this.meta.vol; LF.audio.music = this.meta.mus;
    }
    save() { if (this.demo) return; saveMeta(this.meta); }
    // Demo: the bot plays a descent on the title's behalf. Nothing it does touches the save.
    startDemo() {
      if (!LF.makeBot) return;
      this.demoMeta = JSON.stringify(this.meta);
      this.demo = true; this.demoT = 0;
      this.bot = LF.makeBot({ human: 'good', offerDelay: 1.6 });
      this.startRun(undefined, { noVows: true });
    }
    endDemo() {
      if (!this.demo) return;
      this.bot = null; this.fade = null; this.delays = [];
      if (this.demoMeta) this.meta = JSON.parse(this.demoMeta);
      this.demo = false; this.demoMeta = null;
      this.state = 'title'; LF.ui.enter(this, 'title'); LF.audio.intensity = 0; LF.audio.boss = false;
    }

    // ---------------------------------------------------------- run / floor setup
    startRun(seed, opts = {}) {
      this.seed = seed || ((Math.random() * 2147483647) | 0);
      this.diff = LF.DIFFS[this.meta.diff] || LF.DIFFS[1];
      const lan = LF.LANTERN[this.meta.lantern];
      this.lanternId = lan && lan.unlocked(this.meta) ? lan.id : 'fire';
      this.omen = null;
      this.daily = opts.daily || null;
      this.mode = opts.mode === 'vigil' ? 'vigil' : opts.mode === 'rush' ? 'rush' : 'descent';
      // a rehearsal is a one-shadow Gauntlet that records nothing: no cinders, no feats, no history, no unlocks
      const pd = opts.practice && LF.ENEMY_DEFS[opts.practice];
      this.practice = this.mode === 'rush' && pd && pd.boss ? opts.practice : null;
      this.vigil = this.mode === 'vigil' ? { wave: 0, t: 5, state: 'rest', alive: 0, cleared: 0 } : null;
      this.vows = {};
      if ((this.meta.bosses || 0) >= 1 && !opts.noVows && !this.practice) for (const v of LF.VOWS) if (this.meta.vows && this.meta.vows[v.id]) this.vows[v.id] = true;
      this.unlockedAtStart = LF.LANTERNS.filter(l => l.unlocked(this.meta)).map(l => l.id);
      this.looksAtStart = LF.LOOKS.filter(l => LF.lookOpen(l, this.meta)).map(l => l.id);
      this.felledAtStart = Object.assign({}, this.meta.felled || {});
      this.vowsWereOpen = (this.meta.bosses || 0) >= 1;
      this.rng = new LF.RNG(this.seed);
      // the Gauntlet takes two shadows from each depth: the first two always, the third once it has been unlocked
      this.rushOrder = null;
      if (this.mode === 'rush') {
        const felled = this.meta.felled || {}, rr = new LF.RNG((this.seed ^ 0x5eed5) >>> 0);
        this.rushOrder = [];
        if (this.practice) this.rushOrder.push(this.practice);
        else for (const set of LF.BOSS_SETS) { const pool = set.filter((b, i) => i < 2 || felled[set[i - 1]]); rr.shuffle(pool); this.rushOrder.push(pool[0], pool[1]); }
      }
      this.player = new LF.Player(this);
      const up = this.meta.up;
      this.player.glass = 15 * (up.purse || 0);
      this.player.rerolls = 2 + (up.reroll || 0) + ((this.meta.shards || 0) >= 3 ? 2 : 0); // enough to fish for the school a build needs
      this.run = { kills: 0, shots: 0, dmg: 0, taken: 0, time: 0, bosses: 0, glass: 0, dashes: 0, flares: 0, braziers: 0, elites: 0, won: false, cause: '' };
      // Every descent begins at the top, in Depth I. The deeper Depths are reached only by carrying on down in the same run.
      this.startCycle = 0;
      this.depth = 1 + 9 * this.startCycle; this.startDepth = this.depth; this.carry = 0; this.run.masteryPaid = this.depth - 1;
      if (up.gift) {
        const commons = LF.availRelics(this.player).filter(r => r.rarity === 'common');
        if (commons.length) this.player.addRelic(this.rng.pick(commons).id);
      }
      // The lantern carries its theme's first relic from the first step.
      { const bolt = LF.LANTERN[this.lanternId].carries, pl = this.player; if (bolt && !pl.relics[bolt]) { pl.relics[bolt] = 1; pl.relicOrder.push(bolt); pl.recalc(); this.meta.seen[bolt] = 1; } }
      // At one tier of each type, chosen afresh each descent, the bolt may be turned to that type.
      this.boltTier = {}; for (const k in LF.BOLT_OF) this.boltTier[k] = this.rng.int(1, 3);
      this.pendingBolt = null;
      if (!this.practice) { this.meta.runs++; this.save(); }
      this.loadFloor();
      this.state = 'play';
      this.startFade(1, 0.8);
      if (this.mode === 'rush') { this.rushDraftMax = this.practice ? [2, 5, 8][this.rushFloor(0) / 3 - 1] : 5; this.rushDraft = this.rushDraftMax;
        // the Gauntlet and rehearsals open with a great work, so the largest powers can be tried there
        const rites = LF.rollRelics(this.player, 3, { rng: this.rng, floor: 6, pool: 'brand' });
        if (rites.length) this.openOffer({ title: 'A Great Work', sub: 'One of each is all a lantern can hold. Take one, or walk on.', relics: rites, canSkip: true, dim: true, noReroll: true, onDone: () => this.openRushDraft() });
        else this.openRushDraft();
      } else if (this.mode === 'descent') {
        const rites = (this.meta.shards || 0) >= 2 ? LF.rollRelics(this.player, 3, { rng: this.rng, floor: 3, pool: 'brand' }) : [];
        if (rites.length) this.openOffer({ title: 'The Shard of the Works', sub: 'It remembers what the Lamplighters made. Take a great work, or walk on.', relics: rites, canSkip: true, dim: true, noReroll: true });
      }
    }
    // Reaching the tier of a type that holds the bolt this descent: the bolt may be turned to it (asked once the
    // lantern is next free to answer, in step()).
    attuned(type, t0, t1) {
      const want = LF.BOLT_OF[type], bt = (this.boltTier || {})[type];
      if (want && bt && t0 < bt && bt <= t1 && !this.player.relics[want]) this.pendingBolt = want;
    }
    // The Gauntlet opens with three relic picks, so there is a build to fight with.
    openRushDraft() {
      const p = this.player, max = this.rushDraftMax || 5, n = max + 1 - this.rushDraft;
      const relics = LF.rollRelics(p, 4 + p.stats.extraChoice, { rng: this.rng, floor: this.practice ? this.rushFloor(0) : 6, minRarity: 'uncommon' });
      if (!relics.length) { this.rushDraft = 0; return; }
      this.openOffer({ title: 'Arm Yourself', sub: 'Pick ' + n + ' of ' + max + (this.practice ? ' before the shadow.' : ' before the first shadow.'), relics, canSkip: false, dim: true, onDone: () => { if (--this.rushDraft > 0) this.openRushDraft(); } });
    }
    vowBonus() { let b = 0; for (const v of LF.VOWS) if (this.vows[v.id]) b += v.bonus; return b; }
    // Gauntlet bookkeeping: how many shadows this run holds, and which boss depth each one belongs to.
    rushLen() { return this.rushOrder ? this.rushOrder.length : LF.RUSH.length; }
    rushFloor(i) {
      const b = this.rushOrder ? this.rushOrder[i] : LF.RUSH[i][0];
      for (let t = 0; t < LF.BOSS_SETS.length; t++) if (LF.BOSS_SETS[t].includes(b)) return (t + 1) * 3;
      return 3;
    }
    // One-time teaching toasts.
    teach(id) {
      if (this.bot || this.meta.seen['t_' + id]) return;
      const t = LF.TEACH[id]; if (!t) return;
      this.meta.seen['t_' + id] = 1; this.save();
      this.toast(t[0], t[1], '#ffd9a0', 'eye', '#ffd9a0', 7.5);
    }
    loadFloor() {
      const p = this.player;
      this.floor = ((this.depth - 1) % 9) + 1; this.loop = Math.floor((this.depth - 1) / 9);
      if (this.mode === 'rush') { this.floor = this.rushFloor(Math.min(this.rushLen(), this.depth) - 1); this.loop = 0; }
      this.biome = LF.BIOMES[Math.floor((this.floor - 1) / 3)];
      const df = this.diff;
      this.enemySpeedMul = 1.06; this.floorT = 0; this.lingerN = 0;
      const grow = LF.TUNE.grow;
      // The dark deepens by multiplying: hpGrow times the health and dmgGrow times the harm on each Level over the last.
      this.enemyHpMul = 1.2 * LF.curve(LF.TUNE.hpGrow, this.floor) * (1 + this.loop * 0.25) * (1 + (this.carry || 0) * 0.8) * df.hp;
      // hits bite a little harder now that light sears and kills rekindle: losing light has to matter
      this.enemyDmgMul = 1.24 * LF.curve(LF.TUNE.dmgGrow, this.floor) * (1 + this.loop * 0.12) * (1 + (this.carry || 0) * 0.45) * df.dmg;
      this.bossDmgMul = this.enemyDmgMul * 1.14 / 1.24 * (this.floor === 6 ? LF.TUNE.secondHit : this.floor === 9 ? LF.TUNE.thirdHit : 1); // the great shadows are hard enough: they did not get the latest increase
      this.bossHpMul = 1.7 * (this.floor === 3 ? LF.TUNE.first : this.floor === 6 ? LF.TUNE.second : this.floor === 9 ? LF.TUNE.third : 1) * LF.curve(LF.TUNE.hpGrow, this.floor) / LF.curve(LF.TUNE.hpGrow, 3) * (1 + this.loop * 0.2) * (1 + (this.carry || 0) * 0.75) * df.hp;
      { const k = Math.max(0, 4 - this.floor) / 3; this.enemyHpMul *= 1 + LF.TUNE.earlyHp * k; this.enemyDmgMul *= 1 + LF.TUNE.early * k; } // the first Levels bite (the great shadow of Level 3 is left as it was)
      if (this.mode === 'rush' && !this.practice) { this.enemyDmgMul *= 0.8; this.bossDmgMul *= 0.8; this.bossHpMul *= 0.62; } // no floors between fights to build on
      this.omen = null;
      this.floorRng = new LF.RNG((this.seed + this.depth * 104729) >>> 0);
      // in a second cycle and beyond, every floor bears an omen
      if (this.floor % 3 !== 0 && this.depth >= 2 && (this.floorRng.chance(0.42) || this.loop >= 1)) this.omen = this.floorRng.pick(LF.OMENS);
      if (this.mode === 'vigil') { this.omen = null; this.biome = LF.BIOMES[Math.abs(this.seed) % 3]; }
      const map = this.map = this.mode === 'vigil' ? LF.generateArena(this.seed)
        : LF.generateFloor(this.floor, this.seed + this.depth * 7919, { loop: (this.carry || 0) + (this.loop - (this.carry || 0)) * 0.3, omen: this.omen ? this.omen.id : null, bossType: this.pickBoss() });
      this.enemies = []; this.bullets = []; this.ebullets = []; this.pickups = []; this.zones = []; this.flashes = []; this.delays = [];
      fx.clear();
      this.bufDash = 0; this.bufFlare = 0; this.bufInteract = 0; this.hitDir = null; this.rush = false; this.tideHigh = false;
      this.litBraziers = []; this.litLamps = []; this.emberT = 0; this.glassT = 0; this.emberCombo = 0; this.glassCombo = 0;
      this.props = map.props; this.boss = null; this.bossStarted = false; this.bossDead = false; this.victoryReady = false;
      p.x = map.start.x; p.y = map.start.y; p.vx = p.vy = 0; p.phoenixUsed = false; p.lifelineUsed = false; p.dashing = 0; p.invuln = 1;
      this.cam.x = p.x; this.cam.y = p.y;
      this.totalSpawns = 0;
      for (const r of map.rooms) r.pending = [];
      for (const s of map.spawns) {
        this.totalSpawns++;
        const room = map.rooms[s.room];
        if (s.optional) this.totalSpawns--;
        if (room && (room.type === 'ambush' || room.type === 'trial')) room.pending.push(s);
        else this.spawnEnemy(s.type, s.x, s.y, { elite: s.elite, room: s.room, counted: true });
      }
      this.floorKills = 0;
      // stock the shop
      const peds = this.props.filter(pr => pr.kind === 'pedestal');
      if (peds.length) {
        // two forms at random, from those for a slot the lantern has not filled, and lamp oil
        const offers = this.rng.shuffle(LF.FORMS.filter(d => !LF.formHeld(p, d.form))).slice(0, 2);
        peds.forEach((pd, i) => {
          if (i < offers.length) { pd.item = { type: 'relic', relic: offers[i].id }; pd.price = LF.TUNE.formPrice; }
          else { pd.item = { type: 'oil' }; pd.price = 16 + this.depth * 2; }
        });
      }
      for (const pr of this.props) if (pr.kind === 'brazier' && pr.lit) this.lightBrazier(pr, true);
      if (p.stats.reveal) map.revealAll();
      map.computeFlow(p.x, p.y);
      this.renderer.buildMap(map, this.biome);
      this.room = null; this.flowT = 0; this.seenT = 0;
      const isBoss = !!map.boss;
      this.banner = { text: this.mode === 'rush' ? (this.practice ? 'Rehearsal' : 'Shadow ' + this.depth + ' of ' + this.rushLen()) : isBoss ? LF.place(this.depth) : this.biome.name, sub: isBoss ? (this.floor === 9 && this.mode === 'descent' ? (this.loop >= 4 ? 'The Great Lantern is below. Something stands in front of it' : 'A shard of the Lantern is below. Something stands in front of it') : 'Something vast is waiting') : LF.place(this.depth) + (this.omen ? '  ·  Omen: ' + this.omen.name : ''), sub2: isBoss ? '' : LF.pick(LF.EPIGRAPHS[Math.floor((this.floor - 1) / 3)]), t: 0, dur: 4.6 };
      if (this.mode === 'vigil') this.banner = { text: 'The Long Vigil', sub: 'Hold the light for as long as you can', sub2: 'The first wave comes in a moment.', t: 0, dur: 4.2 };
      if (this.omen) this.toast('Omen: ' + this.omen.name, this.omen.desc, '#c9a7ff', 'eye', '#c9a7ff');
      if ((this.omen && this.omen.id === 'hunt') || (this.vows.hunted && !isBoss)) {
        this.delay(16, () => {
          const far = map.rooms.filter(r => r.type !== 'start').sort((a, b) => LF.dist(b.cx, b.cy, p.x / TILE, p.y / TILE) - LF.dist(a.cx, a.cy, p.x / TILE, p.y / TILE))[0];
          if (!far || p.dead) return;
          const pos = map.nearestOpen(far.cx * TILE, far.cy * TILE);
          const h = this.spawnEnemy('hunter', pos.x, pos.y, { elite: true, awake: true, hpMul: 1.2, spawnT: 1 });
          h.name = 'The Hunter'; h.hunter = true;
          this.banner = { text: 'You are being hunted', sub: 'It puts out fires. It does not stop', t: 0, dur: 2.8, small: true, boss: true };
          LF.audio.play('roar'); LF.audio.play('howl');
        });
      }
      LF.audio.intensity = 0;
    }

    // ---------------------------------------------------------- helpers used by entities
    stat(name, n = 1) { if (this.run) this.run[name] = (this.run[name] || 0) + n; }
    omenMul(key) { return this.omen && this.omen[key] ? this.omen[key] : 1; }
    // Each boss depth has an original and one or two alternates; each alternate can appear once the shadow before it has been felled.
    pickBoss() {
      if (this.mode === 'rush') { const i = Math.min(this.rushLen(), this.depth) - 1; return this.rushOrder ? this.rushOrder[i] : LF.RUSH[i][0]; }
      if (this.floor % 3 !== 0) return null;
      const set = LF.BOSS_SETS[this.floor / 3 - 1];
      const felled = this.meta.felled || {};
      if (this.forceBoss) return this.forceBoss;
      // a daily descent draws from every shadow, so it is the same for everyone and for every try
      const pool = set.filter((b, i) => i === 0 || this.daily || felled[set[i - 1]]);
      return pool[Math.min(pool.length - 1, Math.floor(this.floorRng.next() * pool.length))];
    }
    hint(text) { this.hintText = text; this.hintT = 1.4; }
    delay(t, fn) { this.delays.push({ t, fn }); }
    shake(a) { this.shakeAmt = Math.min(18, Math.max(this.shakeAmt, a * this.meta.shake)); }
    hitstop(t) { this.hitstopT = Math.max(this.hitstopT, t); }
    addFlash(x, y, r, life, color) { const k = this.meta.flash === 0 ? 0.6 : 1; this.flashes.push({ x, y, r: r * k, life: life * k, max: life * k, color: color || '#ffe9b8' }); }
    addZone(z) { z.max = z.life; z.t = 0; this.zones.push(z); return z; }
    toast(title, text, color, glyph, glyphColor, dur) { this.toasts.push({ title, text, color, glyph, glyphColor, t: 0, dur: dur || 4.2 }); if (this.toasts.length > 3) this.toasts.shift(); }
    screenToWorld(sx, sy) {
      const c = this.cam;
      return { x: (sx - this.canvas.width / 2) / c.zoom + c.x + c.sx, y: (sy - this.canvas.height / 2) / c.zoom + c.y + c.sy };
    }
    worldToScreen(x, y) {
      const c = this.cam;
      return { x: (x - c.x - c.sx) * c.zoom + this.canvas.width / 2, y: (y - c.y - c.sy) * c.zoom + this.canvas.height / 2 };
    }
    spawnEnemy(type, x, y, opts) {
      const e = new LF.Enemy(this, type, x, y, opts);
      this.enemies.push(e);
      return e;
    }
    fireBolt(o) { const b = new LF.Bolt(this, o); this.bullets.push(b); return b; }
    // ---- the five types: what each does to a creature. Fire harms; the rest set a creature up. ----
    ignite(e, dps, t) { if (e.dead) return; e.burn = Math.max(e.burn, t || this.player.stats.burnTime); e.burnDps = Math.max(e.burnDps || 0, dps); }
    // Fire catches. A creature that caught fire this way cannot catch again until a little after that fire is out,
    // so a pack burns through once and the fire dies unless the lantern lights it again.
    spreadFire(e) {
      const cf = this.player.stats.conflag, R = LF.TUNE.catchR * (this.player.stats.catching || 1) * (cf ? 1.5 : 1), t = this.player.stats.burnTime;
      for (const o of this.enemies) {
        if (o === e || o.dead || o.intangible || o.spawnT > 0 || o.burn > 0 || (o.noCatch || 0) > this.time) continue;
        const d = R + e.r + o.r;
        if (LF.dist2(e.x, e.y, o.x, o.y) > d * d) continue;
        this.ignite(o, e.burnDps, t); o.noCatch = cf ? 0 : this.time + t + 1; o.catchT = LF.TUNE.catchT * (cf ? 0.5 : 1);
        // a lick of flame crossing the gap, and a flash where it takes
        for (let i = 0; i < 4; i++) fx.spawn({ x: e.x + (o.x - e.x) * i / 4, y: e.y + (o.y - e.y) * i / 4, vx: (o.x - e.x) * 2.2, vy: (o.y - e.y) * 2.2 - 20, life: 0.28, size: 2.6, color: LF.pick(['#ff7b2e', '#ffc24d']), drag: 1 });
        fx.burst(o.x, o.y, 6, { color: ['#ff7b2e', '#ffc24d'], speed1: 90, life: 0.3, size: 2 });
        if (this.time - (this.catchSnd || 0) > 0.25) { this.catchSnd = this.time; LF.audio.play('ignite'); }
      }
    }
    waxEnemy(e, t) { if (e.dead) return; e.chill = Math.max(e.chill, (t || this.player.stats.waxTime) * (e.boss ? 0.6 : 1)); }
    // A shackle fastens a creature to the spot where it was caught (or to the player, with the Long Leash). It can
    // still move and strike inside the chain's reach; it cannot leave. A great shadow is too heavy to hold: the
    // shackle marks it, for whatever else the chains do, but does not stop it.
    shackle(e, t) {
      const s = this.player.stats;
      if (e.dead || e.spawnT > 0 || e.def.speed === 0) return;
      const fresh = !(e.shackle > 0);
      e.shackle = Math.max(e.shackle || 0, t || s.shackleTime);
      if (!fresh) return;
      e.anchor = { x: e.x, y: e.y }; e.onLeash = !!s.drag; e.haulL = 0;
      fx.ring(e.x, e.y, e.r + 16, e.r + 2, 0.25, '#d9b070', 2); LF.audio.play('chain');
    }
    // Dripping Censers: a censer's blow leaves a pool of wax where it lands (one pool to a spot)
    censerDrip(e) {
      const s = this.player.stats;
      if (this.zones.some(z => z.drip && !z.dead && LF.dist2(z.x, z.y, e.x, e.y) < 30 * 30)) return;
      this.addZone({ kind: 'tallow', x: e.x, y: e.y, r: 30, life: s.censerDrip, drip: true });
    }
    // What a censer's blow does beyond its harm, for a censer that was thrown (the swinging ones do the same in Player.update).
    censerStruck(e, blow) {
      const p = this.player, s = p.stats;
      e.chainAt = this.time;
      if (s.incense) p.addLight(s.incense);
      if (s.chainWax) this.waxEnemy(e);
      if (s.censerDrip) this.censerDrip(e);
      if (s.peal) { fx.ring(e.x, e.y, 6, 64, 0.25, '#d9b070', 2); for (const o of this.enemies) if (o !== e && !o.dead && !o.intangible && o.spawnT <= 0 && LF.dist2(e.x, e.y, o.x, o.y) < (64 + o.r) * (64 + o.r)) this.damageEnemy(o, blow * 0.5, { type: 'chain', noShroud: true, quiet: true }); }
      if (e.dead) return;
      if (s.drag) this.shackle(e);
      if (s.chainLight) e.glow = Math.max(e.glow || 0, 3);
      if (s.chainBurn) this.ignite(e, s.burnBase * 2);
    }
    lightPool(x, y) {
      if (this.time - (this.poolT || 0) < 0.3) return;
      this.poolT = this.time; this.addZone({ kind: 'light', x, y, r: 62, life: 3 * this.player.stats.linger });
    }
    // What a bolt (or a blow of the blade) does on landing, beyond its damage. `main` is false for the small bolts
    // a ring or a split throws.
    boltEffects(e, main) {
      const p = this.player, s = p.stats;
      if (e.dead) return;
      if (s.spatter && e.chill > 0) {
        const R = 46 + 22 * s.spatter;
        for (const o of this.enemies) if (o !== e && !o.dead && o.spawnT <= 0 && !o.intangible && LF.dist2(e.x, e.y, o.x, o.y) < (R + o.r) * (R + o.r)) this.waxEnemy(o, s.waxTime * 0.7);
        if (Math.random() < 0.5) fx.burst(e.x, e.y, 6, { color: ['#f0e2c0', '#d8c28a'], speed1: 150, life: 0.35, size: 2.2, glow: false });
      }
      // a bolt carries everything the lantern has given it, all at once
      if (s.ignite) this.ignite(e, s.burnBase);
      if (s.boltWax) this.waxEnemy(e);
      if (s.boltShackle) this.shackle(e);
      if (s.boltLight) { e.glow = Math.max(e.glow || 0, 2 + 2 * s.boltLight); this.lightPool(e.x, e.y); }
      if (s.boltMoth && main && (p.mothShots = (p.mothShots || 0) + 1) % 5 === 0) p.swarmMoths(1, 5, e.x, e.y);
    }
    mothBite(e) {
      const s = this.player.stats;
      if (e.dead) return;
      if (s.mothWax) this.waxEnemy(e, s.waxTime * 0.6);
      if (s.mothChain && Math.random() < 0.25) this.shackle(e, s.shackleTime * 0.6);
      if (s.mothLight) e.glow = Math.max(e.glow || 0, 4);
      if (s.mothFire) this.ignite(e, s.burnBase);
      e.bitten = this.time;
    }
    // nothing fires once the floor's great shadow is unmade (a boss can die halfway through its own attack)
    fireEnemyBullet(o) { if (this.ebullets.length > 420 || this.bossDead) return null; const b = new LF.EBullet(o); this.ebullets.push(b); return b; }
    nearestEnemy(x, y, maxD, filter) {
      let best = null, bd = maxD * maxD;
      for (const e of this.enemies) {
        if (e.dead || e.spawnT > 0) continue;
        const d = LF.dist2(x, y, e.x, e.y);
        if (d < bd && (!filter || filter(e))) { bd = d; best = e; }
      }
      return best;
    }
    // Is this point lit by the lantern, a brazier, or a lingering flare?
    isLit(x, y) {
      const p = this.player, map = this.map;
      const pr = p.lightR * 0.94;
      this.litByFire = false; // set when the only light on this spot is a brazier's or a wall lamp's
      this.litByWax = false; // set when the deepest light here is a pool of wax (Candle Glow)
      // litDepth: how deep in the light this spot stands, 0 at the rim and 1 at the flame. Searing scales with it.
      let depth = -1, d2 = LF.dist2(x, y, p.x, p.y);
      if (d2 < pr * pr && map.los(p.x, p.y, x, y)) depth = 1 - Math.sqrt(d2) / pr;
      for (const z of this.zones) {
        if ((z.kind === 'light' || z.kind === 'beacon') && (d2 = LF.dist2(x, y, z.x, z.y)) < z.r * z.r) depth = Math.max(depth, 1 - Math.sqrt(d2) / z.r);
        else if (z.kind === 'tallow' && p.stats.poolLight && (d2 = LF.dist2(x, y, z.x, z.y)) < z.r * z.r) { const dd = 1 - Math.sqrt(d2) / z.r; if (dd > depth) { depth = dd; this.litByWax = true; } }
      }
      for (const c of p.carried || []) if ((d2 = LF.dist2(x, y, c.x, c.y)) < c.r * c.r) { const dd = 1 - Math.sqrt(d2) / c.r; if (dd > depth) { depth = dd; this.litByWax = false; } } // a carried lamp unshrouds (it sears on its own: see update)
      if (depth >= 0) { this.litDepth = depth; return true; }
      // Fires unshroud what stands in them, but they do not burn it unless the Tinderbox is held.
      for (const b of this.litBraziers) {
        if ((d2 = LF.dist2(x, y, b.x, b.y)) < 150 * 150 && map.los(b.x, b.y, x, y)) depth = Math.max(depth, 1 - Math.sqrt(d2) / 150);
      }
      for (const l of this.litLamps) if ((d2 = LF.dist2(x, y, l.x, l.y)) < 80 * 80) depth = Math.max(depth, 1 - Math.sqrt(d2) / 80);
      this.litDepth = Math.max(0, depth);
      this.litByFire = depth >= 0;
      return depth >= 0;
    }

    // ---------------------------------------------------------- combat
    damageEnemy(e, dmg, src = {}) {
      if (e.dead || e.spawnT > 0) return;
      if (e.intangible && !src.force) return;
      if (!e.awake) { const amb = this.player.stats.ambush; if (amb) dmg *= 1 + amb; e.wake(this); }
      const s = this.player.stats;
      let shrouded = false;
      if (!e.lit && !src.noShroud && !e.boss) {
        shrouded = s.shroudMul < 1;
        if (shrouded && src.type === 'bolt') this.teach('shroud');
        dmg *= s.shroudMul * (e.affix === 'umbral' ? 0.5 : 1);
      }
      if (e.mark > 0) dmg *= 1.6 + s.markBonus;
      // each type's relics raise that type's damage and nothing else. A flare that burns is fire; searing is light's.
      // (within fire, each path has its own amplifier: the burn, the fire left on the ground or thrown, and the fire worn)
      if (src.type === 'burn' || src.type === 'cinder' || src.type === 'thorns' || src.type === 'flare') dmg *= (src.of === 'ground' || src.type === 'flare' ? s.groundMul : src.of === 'mantle' || src.type === 'thorns' ? s.mantleMul : s.fireMul) * (s.pyre ? 1 + 0.01 * (this.player.pyre || 0) : 1);
      // what multiplies a whole theme: fire, light (searing and the flare), wax, chain, moths
      if (src.type === 'chain' && s.surge.chainAll) this.player.mom = Math.min(1, (this.player.mom || 0) + 0.25); // Momentum builds with every censer's blow
      { const ty = src.type; dmg *= ty === 'sear' || ty === 'flare' ? s.lightAll : ty === 'wax' ? s.waxAll : ty === 'chain' ? s.chainAll : ty === 'moth' ? s.mothAll : ty === 'burn' || ty === 'cinder' || ty === 'thorns' || ty === 'fire' ? s.fireAll : 1; }
      if (s.glare && e.stun > 0) dmg *= 1.5;
      if (e.elite && s.eliteDmg) dmg *= 1 + s.eliteDmg;
      if (e.affix === 'warded' && src.type === 'bolt' && !(e.wardBroken > 0)) { dmg *= 0.45; if (Math.random() < 0.15) fx.text(e.x, e.y - e.r - 16, 'WARDED: flare to break', '#9fc7ff', 9, 0.8); }
      if (e.def.modDamage) dmg = e.def.modDamage(e, dmg, src, this);
      if (dmg <= 0) return;
      if (s.fireLeech && (src.type === 'burn' || src.type === 'cinder' || src.type === 'fire' || src.type === 'thorns') && !this.player.dead) this.player.addLight(Math.min(dmg, Math.max(0, e.hp)) / (e.maxHp || 1) * s.fireLeech * (e.boss ? 20 : 1)); // Heartwood
      e.hp -= dmg; this.run.dmg += dmg;
      if ((e.boss || e.type === 'choirhead') && !s.noEmbers) {
        e.shedAcc = (e.shedAcc || 0) + dmg;
        const step = e.maxHp * 0.06, pl = this.player;
        while (e.shedAcc >= step) {
          e.shedAcc -= step;
          const a = Math.atan2(pl.y - e.y, pl.x - e.x) + LF.rand(-0.9, 0.9), v = LF.rand(300, 440);
          this.pickups.push(new LF.Pickup('ember', e.x, e.y, LF.EMBER, { vx: Math.cos(a) * v, vy: Math.sin(a) * v }));
        }
      }
      if (src.sear) {
        // searing light is constant: no numbers, just smoke
      } else if (src.quiet) {
        e.dotAcc += dmg; if (e.dotT <= 0) e.dotT = 0.4;
      } else {
        e.flash = 1;
        const col = src.blocked ? '#9a94ad' : src.crit ? '#ffe45c' : shrouded ? '#8d86a8' : '#ffffff';
        fx.text(e.x + LF.rand(-8, 8), e.y - e.r - 6, String(Math.max(1, Math.round(dmg))), col, src.crit ? 15 : 11, src.crit ? 0.9 : 0.6);
        LF.audio.play(src.blocked ? 'shroud' : src.crit ? 'crit' : shrouded ? 'shroud' : 'hit');
        if (src.angle !== undefined && !e.boss && e.def.speed > 0) {
          const k = (src.crit ? 150 : 90) * (shrouded ? 0.5 : 1) * s.knock / (1 + e.r / 14);
          e.kx += Math.cos(src.angle) * k; e.ky += Math.sin(src.angle) * k;
        }
        fx.burst(src.x || e.x, src.y || e.y, shrouded ? 2 : 4, { color: shrouded ? '#3a2d55' : ['#ffe9b8', '#b98cff'], speed1: 120, life: 0.25, size: 1.8, glow: !shrouded });
      }
      if (src.crit && s.critEmber && this.player.critEmberT <= 0 && !s.noEmbers) { this.player.critEmberT = 0.7; this.pickups.push(new LF.Pickup('ember', e.x, e.y, LF.EMBER)); }
      if (e.hp <= 0) this.killEnemy(e, src);
    }
    killEnemy(e, src = {}) {
      if (e.dead) return;
      e.dead = true;
      const p = this.player, s = p.stats;
      if (e.def.onDeath) e.def.onDeath(e, this, src);
      // the Long Leash: a shackled creature's chain leaps to the nearest creature when it dies
      if (s.leashOn && e.shackle > 0) {
        let nx = null, nd = 260 * 260;
        for (const o of this.enemies) { if (o === e || o.dead || o.spawnT > 0 || o.intangible || o.def.speed === 0) continue; const d2 = LF.dist2(e.x, e.y, o.x, o.y); if (d2 < nd) { nd = d2; nx = o; } }
        if (nx) { fx.arc(e.x, e.y, nx.x, nx.y, '#d9b070', 0.3, 2.5); this.shackle(nx, Math.max(e.shackle, 2)); }
      }
      // Sunstruck: a creature that dies stunned bursts like a small flare (a few a second at most, so it cannot run away)
      if (s.sunstruck && e.stun > 0 && !e.boss && !(this.sunT > this.time)) {
        this.sunN = (this.sunN || 0) + 1; if (this.sunN >= 4) { this.sunN = 0; this.sunT = this.time + 1; }
        const x = e.x, y = e.y; this.delay(0.12, () => { if (!p.dead) this.flareBurst(x, y, s.flareRadius * 0.55, s.flareDmg * p.damageMul() / 3, s.flareStun * 0.6, 0.35, 'sun'); });
      }
      if (src.type === 'burn' || src.type === 'sear' || src.type === 'cinder') LF.audio.play('crackle');
      const self = src.type === 'self';
      if (e.counted) this.floorKills++;
      if (!self) {
        this.run.kills++; this.meta.kills++;
        if (!this.meta.met) this.meta.met = {};
        if (!this.meta.met[e.type] && !this.bot) { this.meta.met[e.type] = 1; this.save(); }
        if (e.elite) this.run.elites++;
        this.combo++; this.comboT = 2.5;
        if (this.combo % 5 === 0) {
          fx.text(p.x, p.y - 38, 'BLAZE ×' + this.combo, '#ffcf5c', 13 + Math.min(6, this.combo / 5), 1.1);
          fx.ring(p.x, p.y, 10, 60 + this.combo * 2, 0.4, '#ffcf5c', 3);
          if (!s.noEmbers) this.pickups.push(new LF.Pickup('ember', e.x, e.y, LF.EMBER));
          LF.audio.play('relic');
        }
        if (s.killHeal) p.addLight(s.killHeal);
        // every kill feeds the flame a little; a kill made while it gutters feeds it a lot
        if (!p.dead) {
          const low = p.frac() < 0.3;
          p.addLight(low ? 4.5 : 1);
          if (low) {
            fx.ring(p.x, p.y, 8, 70, 0.4, '#ffcf5c', 3); fx.burst(e.x, e.y, 8, { color: ['#ffd9a0', '#ff9a40'], speed1: 150, life: 0.5 });
            if (!(this.rekindleT > 0)) { this.rekindleT = 1.6; fx.text(p.x, p.y - 34, 'REKINDLED', '#ffcf5c', 12, 0.9); LF.audio.play('ember', 4); }
            if (!s.noEmbers && !e.noDrops) this.pickups.push(new LF.Pickup('ember', e.x, e.y, LF.EMBER));
          }
        }
      }
      if (!e.noDrops && !e.boss) {
        const mult = e.elite ? 2.6 : 1;
        if (!s.noEmbers) {
          let n = e.def.embers * mult; n = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0);
          if (Math.random() < s.emberBonus) n++;
          // mercy: more embers when the lantern is guttering
          if (p.frac() < 0.3 && Math.random() < 0.5) n++;
          for (let i = 0; i < n; i++) this.pickups.push(new LF.Pickup('ember', e.x, e.y, LF.EMBER));
        }
        let gl = e.def.glass * mult * s.glassMul * this.omenMul('glass'); gl = Math.floor(gl) + (Math.random() < gl % 1 ? 1 : 0);
        for (let i = 0; i < gl; i++) this.pickups.push(new LF.Pickup('glass', e.x, e.y, 1));
      }
      if (s.pyre && e.burn > 0 && !self) p.pyre = (p.pyre || 0) + 1;
      if (s.burnHeal && e.burn > 0 && !self) p.addLight(s.burnHeal);
      if (s.drip && e.chill > 0 && !self) { p.drips = (p.drips || 0) + 1; if (p.drips % 8 === 0 && p.drips / 8 <= 6 * s.drip) { p.recalc(); p.addLight(2.5); fx.text(p.x, p.y - 30, '+1 ember held', '#f0e2c0', 10, 0.8); } }
      if (s.melt && e.chill > 0 && !self && this.time - (this.meltAt || 0) > 0.12) { this.meltAt = this.time; this.addZone({ kind: 'tallow', x: e.x, y: e.y, r: 34 + e.r, life: 5 }); }
      if (s.broodKill && src.type === 'moth' && !self) p.swarmMoths(1, 6, e.x, e.y);
      if (s.wildfire && e.burn > 0 && !self) {
        const R = 78;
        fx.ring(e.x, e.y, 8, R, 0.35, '#ff7b2e', 4); fx.burst(e.x, e.y, 18, { color: ['#ff7b2e', '#ffc24d', '#fff'], speed1: 220, life: 0.45 });
        this.addFlash(e.x, e.y, 140, 0.3, '#ff9a50'); LF.audio.play('explode');
        const dmg = 14 + (e.burnDps || 0) * 2.5;
        for (const o of this.enemies) {
          if (o === e || o.dead || o.intangible || LF.dist2(e.x, e.y, o.x, o.y) > (R + o.r) * (R + o.r) || !this.map.los(e.x, e.y, o.x, o.y)) continue;
          this.damageEnemy(o, dmg, { type: 'fire', noShroud: true });
          if (!o.dead) this.ignite(o, e.burnDps || 4);
        }
      }
      // Tar: what dies leaves fire where it fell
      if (s.tar && !self) this.addZone({ kind: 'fire', x: e.x, y: e.y, r: 26, life: 1 + s.tar, dps: 40 });
      if (e.affix === 'splitting') {
        for (let i = 0; i < 3; i++) { const pos = this.map.nearestOpen(e.x + LF.rand(-20, 20), e.y + LF.rand(-20, 20)); this.spawnEnemy('skitter', pos.x, pos.y, { awake: true, spawnT: 0.35, room: e.room, noDrops: true }); }
      }
      if (e.affix === 'volatile') {
        for (let i = 0; i < 10; i++) this.fireEnemyBullet({ x: e.x, y: e.y, angle: i * TAU / 10, speed: 150, dmg: e.dmg * 0.7, color: '#ff6b6b' });
      }
      // death burst: shadow tears apart, a few motes of light escape
      const big = e.elite || e.r > 15;
      fx.burst(e.x, e.y, big ? 22 : 12, { color: ['#120a20', '#24153e', '#0a0612'], glow: false, speed1: big ? 220 : 160, life: 0.6, size: big ? 6 : 4, drag: 3 });
      fx.burst(e.x, e.y, big ? 10 : 5, { color: ['#c9a0ff', '#ffe9b8'], speed1: 140, life: 0.4, size: 1.8 });
      fx.ring(e.x, e.y, e.r * 0.5, e.r * 2.4, 0.3, 'rgba(180,140,255,0.7)', 2);
      if (!self) LF.audio.play(big ? 'bigKill' : 'kill');
      this.renderer.splat(e.x, e.y, e.r * (big ? 1.5 : 1.1));
      if (e.elite) { this.hitstop(0.07); this.shake(5); }
      if (e.dropRelic) {
        this.stat('mimics');
        const rel = LF.rollRelics(p, 1, { rng: this.rng, floor: this.floor, minRarity: 'uncommon' })[0];
        if (rel) this.pickups.push(new LF.Pickup('relic', e.x, e.y, 0, { relic: rel.id, vx: 0, vy: 40 }));
        for (let i = 0; i < 8 + this.floor; i++) this.pickups.push(new LF.Pickup('glass', e.x, e.y, 1));
      }
      if (e.boss) this.onBossDeath(e);
    }
    hurtPlayer(amt, src = {}) {
      const p = this.player, s = p.stats;
      if (p.dead || this.state !== 'play') return;
      if (p.invuln > 0 && !src.force) return;
      if (src.enemy && src.enemy.chill > 0 && s.waxSoft) amt *= 1 - s.waxSoft; // a waxed creature's blow lands softer
      if (!src.force && !src.steal) {
        // The Wax Cast takes the blow whole; when it breaks it bursts
        if (p.castN > 0) {
          p.castN--; p.invuln = 0.4; fx.text(p.x, p.y - 22, 'CAST', '#f0e2c0', 10, 0.6); LF.audio.play('wax');
          if (p.castN <= 0) { const R = 110, burst = 80 * s.cast * s.waxMul; fx.ring(p.x, p.y, 10, R, 0.35, '#f0e2c0', 5); fx.burst(p.x, p.y, 18, { color: ['#f0e2c0', '#d8c28a', '#fff'], speed1: 220, life: 0.45, size: 2.6, glow: false }); for (const e of this.enemies) { if (e.dead || e.intangible || e.spawnT > 0 || LF.dist2(p.x, p.y, e.x, e.y) > (R + e.r) * (R + e.r)) continue; this.damageEnemy(e, burst, { type: 'wax', noShroud: true }); if (!e.dead) this.waxEnemy(e); } }
          return;
        }
        // shadow: a blow may simply pass through a lantern that is nearly out
        if (s.mantle && p.frac() < 0.4 && Math.random() < Math.min(0.66, s.mantle)) { p.invuln = 0.3; fx.text(p.x, p.y - 22, 'PASSED THROUGH', '#b9a0ff', 10, 0.6); LF.audio.play('shroud'); return; }
        // wax buckler: stops what comes from where you are aiming, like a Bulwark's plate
        if (s.buckler && p.ward > 0 && src.x !== undefined && LF.dist2(src.x, src.y, p.x, p.y) > 18 * 18 && Math.abs(LF.angDiff(p.aim, Math.atan2(src.y - p.y, src.x - p.x))) < 1.0) {
          p.ward--; p.wardT = 0; p.invuln = 0.35;
          fx.text(p.x, p.y - 22, 'BLOCKED', '#f0e2c0', 10, 0.6); fx.burst(p.x + Math.cos(p.aim) * 16, p.y + Math.sin(p.aim) * 16, 8, { color: ['#f0e2c0', '#fff'], speed1: 130, life: 0.3, angle: p.aim, spread: 1.6 });
          LF.audio.play('wax'); this.shake(3);
          if (src.enemy && !src.enemy.boss) { src.enemy.kx += Math.cos(p.aim) * 260; src.enemy.ky += Math.sin(p.aim) * 260; src.enemy.stun = Math.max(src.enemy.stun, 0.4); }
          return;
        }
      }
      p.waxT = 0; p.skinUsed = 0;
      amt *= s.dmgTaken;
      // (there is no ward: a lantern survives by what its themes give it)
      if (!src.force && !src.steal && src.enemy && !src.bullet && src.enemy.shackle > 0 && !src.enemy.boss) {
        // a shackled creature cannot reach the bearer: its blow spends itself on the chain, and breaks it
        src.enemy.shackle = 0; p.invuln = Math.max(p.invuln, 0.25); fx.text(p.x, p.y - 22, 'THE CHAIN HELD', '#d9b070', 10, 0.6); LF.audio.play('chain'); return;
      }
      if (!src.force && !src.steal && s.lightSoft && src.enemy && src.enemy.lit) {
        // Blinding Glow: a creature deep in the bearer's light strikes softer
        const k = LF.clamp(1 - LF.dist(src.enemy.x, src.enemy.y, p.x, p.y) / Math.max(1, p.lightR), 0, 1);
        amt *= 1 - Math.min(0.85, s.lightSoft) * (0.4 + 0.6 * k);
      }
      if (!src.force && !src.steal) {
        // Wax Underfoot: a bearer standing in wax of their own takes a softer blow
        if (s.waxFoot && this.zones.some(z => z.kind === 'tallow' && !z.dead && LF.dist2(z.x, z.y, p.x, p.y) < z.r * z.r)) amt *= 1 - s.waxFoot;
        // Decoy Wings: every moth beside the bearer, tame or loosed, takes its share (each on top of the last, never
        // more than 85% in all); one loosed moth dies of it
        // Decoy Wings: a moth takes the whole blow (a loosed one dies, a tame one falls dazed), once in a while
        if (s.decoy && !(p.decoyT > 0)) {
          const tame = p.familiars.find(f => !(f.down > 0)), m = p.swarm.length ? p.swarm.shift() : tame;
          if (m) { if (m === tame) m.down = 8; p.decoyT = s.decoy; p.invuln = Math.max(p.invuln, 0.4);
            fx.burst(m.x, m.y, 9, { color: ['#e4d4ff', '#ffe2b0'], speed1: 120, life: 0.4, size: 2 }); fx.text(p.x, p.y - 36, 'A MOTH TOOK IT', '#e4d4ff', 10, 0.8); return; }
        }
        // Wax Skin: the coat takes what it can of the blow before the light does
        if (p.coat > 0) {
          const soak = Math.min(p.coat, amt); p.coat -= soak; amt -= soak; p.coatT = 0;
          fx.burst(p.x, p.y, 6, { color: '#f0e2c0', speed1: 90, life: 0.3 }); LF.audio.play('wax');
          if (p.coat <= 0 && s.shed) { fx.ring(p.x, p.y, 10, 90, 0.3, '#f0e2c0', 4); for (const e of this.enemies) { if (e.dead || e.intangible || e.spawnT > 0 || LF.dist2(p.x, p.y, e.x, e.y) > (90 + e.r) * (90 + e.r)) continue; this.waxEnemy(e); this.damageEnemy(e, 75 * s.shed * s.waxMul, { type: 'wax', noShroud: true }); } }
          if (amt <= 0.01) { p.invuln = 0.45; fx.text(p.x, p.y - 22, 'WAX', '#f0e2c0', 10, 0.6); return; }
        }
      }
      if (s.lowDef < 1 && p.frac() < 0.5) amt *= s.lowDef;
      if (s.lastLight && p.frac() < 0.25) amt *= 0.75;
      // A blow does not take its light at once: it burns through over a second (longer with the Slow Dusk), so no
      // single blow puts the lantern out before the bearer can answer it. A creature's leech and the dark's own
      // drain still take at once.
      if (src.steal) p.light -= amt; else p.hurts.push({ left: amt, rate: amt / (s.hurtTime || 1), name: this.hitName(src), heartless: src.heartless });
      this.run.taken += amt;
      p.dim = 1; p.lightR *= src.steal ? 0.9 : 0.76; // the flame gutters: the dark jumps inward, then eases back to its new edge
      p.invuln = src.steal ? Math.max(p.invuln, 0.2) : 0.75;
      p.hurtFlash = 1; this.hurtVig = 1; if (s.secondWind) p.windT = 2.6; this.shake(src.steal ? 3 : 8); this.hitstop(src.steal ? 0 : 0.05);
      LF.audio.play('hurt'); if (!src.steal) LF.audio.play('hiss');
      fx.burst(p.x, p.y, Math.min(16, 4 + Math.round(amt)), { color: ['#ffd9a0', '#ff9a50'], speed1: 200, life: 0.6, size: 2.4 });
      fx.text(p.x, p.y - 20, '-' + Math.max(1, Math.round(amt)), '#ff7b6b', 13, 0.8);
      if (src.x !== undefined) this.hitDir = { a: Math.atan2(src.y - p.y, src.x - p.x), t: 0.9 };
      if (src.x !== undefined && !src.steal) {
        const a = Math.atan2(p.y - src.y, p.x - src.x);
        p.vx += Math.cos(a) * 220; p.vy += Math.sin(a) * 220;
      }
      this.run.lastHit = this.hitName(src);
      if (s.cinderSkin) {
        const R = 95;
        fx.ring(p.x, p.y, 10, R, 0.3, '#ff7b54', 4); LF.audio.play('explode');
        for (const e of this.enemies) {
          if (e.dead || e.intangible || LF.dist2(p.x, p.y, e.x, e.y) > (R + e.r) * (R + e.r)) continue;
          this.damageEnemy(e, 100 * s.cinderSkin, { type: 'cinder', of: 'mantle', noShroud: true });
          const a = Math.atan2(e.y - p.y, e.x - p.x); if (!e.boss) { e.kx += Math.cos(a) * 320; e.ky += Math.sin(a) * 320; }
        }
      }
      if (p.light <= 0) this.outOfLight(src);
    }
    hitName(src) { return src.enemy ? src.enemy.name : src.name ? src.name : src.bullet ? 'a bolt of shadow' : 'the gloom'; }
    // the lantern has gone out: a heart-shard, a lifeline, banked embers or a phoenix feather may light it again.
    // Whatever blows were still burning through are spent with it.
    outOfLight(src = {}) {
      const p = this.player, s = p.stats;
      if (p.dead) return;
      p.hurts.length = 0;
      {
        if ((this.meta.shards || 0) >= 4 && !p.heartUsed && !this.practice && !src.heartless) {
          p.heartUsed = true; p.light = s.maxLight; p.invuln = 2.2;
          LF.audio.play('revive'); this.flareBurst(p.x, p.y, 260, 140, 2.2, 1.6);
          fx.text(p.x, p.y - 36, 'THE HEART-SHARD BLAZES', '#ffe2a6', 15, 2);
        } else if (s.lifeline && !p.lifelineUsed) {
          p.lifelineUsed = true; p.light = LF.EMBER; p.invuln = 1.2;
          fx.text(p.x, p.y - 34, 'LIFELINE', '#ff8fa3', 14, 1.2);
        } else if (this.meta.up.banked && !p.bankedUsed) {
          p.bankedUsed = true; p.light = 15; p.invuln = 1.6;
          fx.text(p.x, p.y - 34, 'BANKED EMBERS', '#ffb347', 14, 1.4); LF.audio.play('revive');
          fx.ring(p.x, p.y, 10, 120, 0.5, '#ffb347', 4);
        } else if (s.phoenix && !p.phoenixUsed) {
          p.phoenixUsed = true; p.light = s.maxLight * 0.35; p.invuln = 2;
          LF.audio.play('revive');
          this.flareBurst(p.x, p.y, 220, 60, 2, 1.4);
          fx.text(p.x, p.y - 34, 'REKINDLED', '#ff9140', 16, 1.6);
          this.toast('Phoenix Feather', 'Your embers rekindle.', '#ff9140', 'feather', '#ff9140');
        } else this.die();
      }
    }
    die() {
      const p = this.player;
      if (p.dead) return;
      p.dead = true; p.light = 0;
      this.run.cause = this.run.lastHit || 'the dark'; this.run.tip = LF.tipFor(this.run.cause);
      LF.audio.play('death'); this.shake(14); this.hitstop(0.2);
      fx.burst(p.x, p.y, 40, { color: ['#ffd9a0', '#ff9a50', '#fff'], speed1: 260, life: 1.2, size: 3 });
      this.delay(2.2, () => { this.endRun(false); this.state = 'dead'; LF.ui.enter(this, 'dead'); });
    }
    endRun(won) {
      const r = this.run;
      if (r.ended) return;
      r.ended = true; r.won = won; r.depth = this.depth;
      if (this.practice) { r.cinders = 0; r.unlocks = []; if (won) r.everWon = true; return; }
      if (this.mode === 'vigil') r.wave = this.vigil.cleared || 0;
      r.cinders = this.mode === 'vigil' ? Math.round((r.wave * 5 + Math.min(r.kills, 40 + r.wave * 14) * 0.12) * this.diff.cinders * (1 + this.vowBonus()))
        : this.mode === 'rush' ? Math.round((r.bosses * 26 + (won || r.everWon ? 50 : 0)) * this.diff.cinders * (1 + this.vowBonus()))
        : Math.round(((this.depth - (this.startDepth || 1)) * 6 + Math.min(r.kills, (this.depth - (this.startDepth || 1) + 1) * 45) * 0.22 + r.bosses * 22 + (won || r.everWon ? 60 : 0)) * this.diff.cinders * (1 + this.vowBonus()));
      if (won) r.everWon = true;
      if (won && this.mode === 'descent' && this.loop >= 4) r.lit = true; // the fifth Depth: the Great Lantern itself
      // the shard at the bottom of this cycle, if it is the next one unclaimed
      r.shard = 0;
      if (won && this.mode === 'descent' && this.loop < 5 && this.loop === (this.meta.shards || 0)) { this.meta.shards = this.loop + 1; r.shard = this.loop + 1; this.player.recalc(); }
      this.meta.cinders += Math.max(0, r.cinders - (r.paid || 0));
      r.paid = Math.max(r.paid || 0, r.cinders);
      if (this.mode === 'descent') this.meta.best = Math.max(this.meta.best, this.depth);
      if (this.mode === 'descent') {
        if (!this.meta.mastery) this.meta.mastery = {};
        const before = LF.masteryLevel(this.meta, this.lanternId), gained = Math.max(0, (this.depth - 1) - (r.masteryPaid || 0));
        this.meta.mastery[this.lanternId] = (this.meta.mastery[this.lanternId] || 0) + gained; r.masteryPaid = this.depth - 1;
        const after = LF.masteryLevel(this.meta, this.lanternId);
        if (after > before) r.masteryUp = after;
      }
      if (won && this.mode === 'rush') this.meta.rushWins = (this.meta.rushWins || 0) + 1;
      else if (won) { this.meta.wins++; if (!this.meta.wonWith) this.meta.wonWith = {}; this.meta.wonWith[this.lanternId] = 1; }
      // history: one entry per run, refreshed if the run carries on after a victory
      const h = { mode: this.mode, wave: r.wave || 0, depth: this.depth, lantern: this.lanternId, won: !!r.everWon, lit: !!r.lit, time: Math.round(r.time), cause: r.everWon ? '' : (r.cause || 'abandoned'), kills: r.kills, diff: this.meta.diff, daily: this.daily, vows: Object.keys(this.vows).length };
      if (!Array.isArray(this.meta.history)) this.meta.history = [];
      if (r.histSaved) this.meta.history[0] = h; else { this.meta.history.unshift(h); r.histSaved = true; }
      if (this.meta.history.length > 10) this.meta.history.length = 10;
      if (this.daily) {
        const d = this.meta.daily && this.meta.daily.date === this.daily ? this.meta.daily : { date: this.daily, best: 0, won: false, tries: 0 };
        d.best = Math.max(d.best, this.depth); d.won = d.won || !!r.everWon;
        if (!r.dailyCounted) { d.tries++; r.dailyCounted = true; }
        this.meta.daily = d;
      }
      // what this descent unlocked
      r.unlocks = LF.LANTERNS.filter(l => l.unlocked(this.meta) && !this.unlockedAtStart.includes(l.id)).map(l => 'New lantern kindled: ' + l.name);
      for (const l of LF.LOOKS) if (LF.lookOpen(l, this.meta) && !(this.looksAtStart || []).includes(l.id)) r.unlocks.push('A Lightbearer answers: ' + l.name);
      const felled = this.meta.felled || {};
      for (const [a, b] of [['bell', 'warden'], ['warden', 'angler'], ['mother', 'king'], ['king', 'sexton'], ['eclipse', 'choir'], ['choir', 'bearer']]) if (felled[a] && !this.felledAtStart[a]) r.unlocks.push('A new shadow stirs below: ' + LF.ENEMY_DEFS[b].name);
      if ((this.meta.bosses || 0) >= 1 && !this.vowsWereOpen) r.unlocks.push('Vows can now be sworn before a descent');
      if (r.masteryUp) r.unlocks.push(LF.LANTERN[this.lanternId].name + ' mastery ' + ['', 'I', 'II', 'III'][r.masteryUp] + ': +4% damage and +2 embers with it');
      if (!this.meta.feats) this.meta.feats = {};
      for (const f of LF.FEATS) {
        if (this.meta.feats[f.id]) continue;
        let ok = false; try { ok = !!f.test(this, r); } catch (e) { ok = false; }
        if (ok) { this.meta.feats[f.id] = 1; this.meta.cinders += f.reward; r.unlocks.push('Feat: ' + f.name + '  (+' + f.reward + ' cinders)'); }
      }
      if (r.unlocks.length > 6) r.unlocks.length = 6;
      this.save();
    }
    // `kind` is the look's own flare: undefined is the Wick's plain blinding flash; 'ward' (Keeper) is smaller and leaves a
    // standing ring that burns and stops shots; 'wax' (Candle) hits softer, slows everything and leaves light that lingers;
    // 'moths' (Moth) does no harm at all and looses a flock of moths instead.
    flareBurst(x, y, R, dmg, stun, power = 1, kind) {
      const ward = kind === 'ward', wax = kind === 'wax', moths = kind === 'moths';
      if (ward) { R *= 0.7; dmg *= 0.6; stun *= 0.6; } else if (wax) { dmg *= 0.55; stun *= 0.5; } else if (moths) { dmg = 0; stun *= 0.6; }
      const tint = wax ? '#f0e2c0' : moths ? '#ffe2b0' : '#fff2cc';
      LF.audio.play('flare'); if (wax) LF.audio.play('wax'); this.shake((moths ? 4 : 8) * power);
      this.addFlash(x, y, R * 2.4, wax ? 0.9 : 0.55, tint);
      fx.ring(x, y, 10, R, 0.35, tint, 6); fx.ring(x, y, 4, R * 0.7, 0.5, wax ? '#d8c28a' : '#ffb347', 3);
      fx.burst(x, y, 30, { color: wax ? ['#f0e2c0', '#d8c28a', '#fff'] : ['#fff2cc', '#ffb347', '#fff'], speed0: wax ? 60 : 120, speed1: wax ? 260 : 420, life: wax ? 0.8 : 0.5, size: wax ? 3 : 2.4, drag: 4 });
      let touched = 0;
      for (const e of this.enemies) {
        if (e.dead || e.spawnT > 0) continue;
        if (LF.dist2(x, y, e.x, e.y) > (R + e.r) * (R + e.r)) continue;
        touched += e.boss ? 8 : 1;
        if (e.type === 'wraith') { e.solid = 1; e.intangible = false; }
        if (e.affix === 'warded') { e.wardBroken = 7; fx.text(e.x, e.y - e.r - 16, 'WARD BROKEN', '#ffe08a', 10, 0.9); }
        if (e.type === 'weaver') { e.intangible = false; }
        if (dmg > 0) this.damageEnemy(e, dmg * (1 + this.player.stats.farFlare * LF.dist(x, y, e.x, e.y) / this.player.stats.flareRadius), { type: 'flare', noShroud: true, force: true });
        if (e.dead) continue;
        if (wax) e.chill = Math.max(e.chill, e.boss ? 3 : 5.5);
        else if (this.player.stats.flareWax) this.waxEnemy(e);
        if (!kind || this.player.stats.flareBurn) this.ignite(e, this.player.stats.burnBase);
        e.mark = Math.max(e.mark, 3 + this.player.stats.markTime);
        if (!e.boss) {
          e.stun = Math.max(e.stun, stun);
          const a = Math.atan2(e.y - y, e.x - x); e.kx += Math.cos(a) * 280; e.ky += Math.sin(a) * 280;
          if (e.def.onStun) e.def.onStun(e, this);
        }
      }
      for (const b of this.ebullets) {
        if (!b.dead && LF.dist2(x, y, b.x, b.y) < R * R) { b.dead = true; fx.burst(b.x, b.y, 4, { color: b.color, speed1: 80, life: 0.3 }); }
      }
      for (const pr of this.props) {
        if (pr.kind === 'brazier' && !pr.lit && LF.dist2(x, y, pr.x, pr.y) < R * R) this.lightBrazier(pr);
        if (pr.kind === 'urn' && !pr.broken && LF.dist2(x, y, pr.x, pr.y) < R * R) this.breakUrn(pr);
        if (pr.kind === 'oiljar' && !pr.broken && LF.dist2(x, y, pr.x, pr.y) < R * R * 0.6) this.delay(0.1, () => this.breakJar(pr));
        if (pr.kind === 'trap' && pr.sub === 'grasp' && LF.dist2(x, y, pr.x, pr.y) < R * R) { pr.calm = 7; pr.state = 0; fx.burst(pr.x, pr.y, 8, { color: ['#12081e', '#2a2540'], speed1: 90, life: 0.5, size: 4, glow: false }); }
      }
      // Flare of Memory: every creature the flare touched gives a little back
      { const pl = this.player, fh = pl.stats.flareHeal; if (fh && touched && !pl.dead) { pl.addLight(fh * touched); fx.text(pl.x, pl.y - 34, '+' + Math.round(fh * touched / 2.5 * 10) / 10 + ' embers', '#fff0b8', 11, 0.9); fx.ring(pl.x, pl.y, R * 0.5, 12, 0.35, '#fff0b8', 2); } }
      this.addZone({ kind: 'light', x, y, r: R * (wax ? 1.6 : 1.3), life: (wax ? 10 : 4) * this.player.stats.linger, flare: true });
      if (ward) this.addZone({ kind: 'beacon', x, y, r: R, life: 2.8, dps: Math.max(6, dmg * 0.5), ward: true });
      if (moths) this.player.swarmMoths(Math.round(5 * power), 5);
    }
    // Rite of the Lance: the flare thrown as a beam along `ang`, from (x, y) to the first wall.
    lanceBurst(x, y, ang, dmg, stun, power = 1) {
      const cx = Math.cos(ang), cy = Math.sin(ang), W = 32;
      const L = Math.max(40, this.map.raycast(x, y, cx, cy, 640));
      const x2 = x + cx * L, y2 = y + cy * L;
      LF.audio.play('flare'); LF.audio.play('beam'); this.shake(9 * power);
      fx.arc(x, y, x2, y2, '#ffb347', 0.55, 20 * power, 'beam'); fx.arc(x, y, x2, y2, '#fff2cc', 0.4, 9 * power, 'beam');
      const near = (px, py, r) => { const t = LF.clamp((px - x) * cx + (py - y) * cy, 0, L); return LF.dist2(px, py, x + cx * t, y + cy * t) < (W + r) * (W + r); };
      for (let d = 0; d <= L; d += 90) { this.addFlash(x + cx * d, y + cy * d, 150, 0.45, '#fff2cc'); this.addZone({ kind: 'light', x: x + cx * d, y: y + cy * d, r: 95, life: 4 * this.player.stats.linger, flare: true }); }
      let touched = 0; const ps = this.player.stats;
      fx.burst(x2, y2, 16, { color: ['#fff2cc', '#ffb347'], speed1: 260, life: 0.45 });
      for (const e of this.enemies) {
        if (e.dead || e.spawnT > 0 || !near(e.x, e.y, e.r)) continue;
        if (e.type === 'wraith') { e.solid = 1; e.intangible = false; }
        if (e.affix === 'warded') { e.wardBroken = 7; fx.text(e.x, e.y - e.r - 16, 'WARD BROKEN', '#ffe08a', 10, 0.9); }
        if (e.type === 'weaver') { e.intangible = false; }
        touched += e.boss ? 8 : 1;
        this.damageEnemy(e, dmg * (1 + ps.farFlare * LF.dist(x, y, e.x, e.y) / ps.flareRadius), { type: 'flare', noShroud: true, force: true });
        if (e.dead) continue;
        if (ps.flareWax) this.waxEnemy(e);
        if (ps.flareBurn) this.ignite(e, ps.burnBase);
        e.mark = Math.max(e.mark, 3 + this.player.stats.markTime);
        if (!e.boss) { e.stun = Math.max(e.stun, stun); e.kx += cx * 300; e.ky += cy * 300; if (e.def.onStun) e.def.onStun(e, this); }
      }
      if (ps.flareHeal && touched && !this.player.dead) { this.player.addLight(ps.flareHeal * touched); fx.text(this.player.x, this.player.y - 34, '+' + Math.round(ps.flareHeal * touched / 2.5 * 10) / 10 + ' embers', '#fff0b8', 11, 0.9); }
      for (const b of this.ebullets) if (!b.dead && near(b.x, b.y, 6)) { b.dead = true; fx.burst(b.x, b.y, 4, { color: '#ffb347', speed1: 80, life: 0.3 }); }
      for (const pr of this.props) {
        if (!near(pr.x, pr.y, 16)) continue;
        if (pr.kind === 'brazier' && !pr.lit) this.lightBrazier(pr);
        if (pr.kind === 'urn' && !pr.broken) this.breakUrn(pr);
        if (pr.kind === 'oiljar' && !pr.broken) this.delay(0.1, () => this.breakJar(pr));
      }
    }
    explode(x, y, R, dmg, color = '#ff9a50') {
      fx.ring(x, y, 8, R, 0.3, color, 4); fx.burst(x, y, 16, { color: [color, '#fff'], speed1: 220, life: 0.4 });
      this.addFlash(x, y, R * 1.8, 0.3, color); LF.audio.play('explode'); this.shake(4);
      for (const e of this.enemies) {
        if (e.dead || e.intangible || LF.dist2(x, y, e.x, e.y) > (R + e.r) * (R + e.r)) continue;
        this.damageEnemy(e, dmg, { type: 'blast', noShroud: true });
      }
    }

    // ---------------------------------------------------------- pickups & props
    collectEmber(pk) {
      const p = this.player;
      const v = pk.value * p.stats.emberMul * this.omenMul('ember');
      this.teach('ember');
      if (p.stats.overflow && p.light >= p.stats.maxLight - 0.5) { p.charge = Math.min(5, p.charge + 1); fx.text(p.x, p.y - 24, 'charge ' + p.charge, '#fff0b8', 10, 0.5); }
      p.addLight(v);
      if (p.stats.emberSpark) {
        const e = this.nearestEnemy(p.x, p.y, 340, en => !en.intangible && en.awake);
        if (e) this.fireBolt({ x: p.x, y: p.y, angle: Math.atan2(e.y - p.y, e.x - p.x), dmg: p.stats.damage * 0.7 * p.stats.emberSpark, minor: true, color: '#ffb36b' });
      }
      this.emberCombo = (this.emberT > 0 ? this.emberCombo + 1 : 0); this.emberT = 1.2;
      LF.audio.play('ember', this.emberCombo);
      fx.burst(pk.x, pk.y, 4, { color: '#ffb36b', speed1: 60, life: 0.3, size: 1.6 });
    }
    collectGlass(pk) {
      this.player.glass += pk.value; this.run.glass += pk.value;
      this.glassCombo = (this.glassT > 0 ? this.glassCombo + 1 : 0); this.glassT = 1;
      LF.audio.play('glass', this.glassCombo);
    }
    gainRelic(id, x, y) {
      const d = LF.RELICS[id], p = this.player;
      p.addRelic(id);
      if (!this.meta.seen[id]) { this.meta.seen[id] = 1; this.save(); }
      LF.audio.play(d.rarity === 'rare' || d.rarity === 'cursed' || d.rarity === 'brand' || d.rarity === 'shadow' ? 'rare' : 'relic');
      this.toast(d.name, d.desc, LF.rar(d).color, d.glyph, d.color);
      if (x !== undefined) { fx.ring(x, y, 6, 60, 0.5, LF.rar(d).color, 3); fx.burst(x, y, 16, { color: [d.color, '#fff'], speed1: 160, life: 0.6 }); }
      if (p.stats.reveal) this.map.revealAll();
    }
    lightBrazier(pr, silent) {
      pr.lit = true; pr.kindle = 0; pr.casting = false;
      pr.poly = this.map.visPoly(pr.x, pr.y, 170, 120, 12);
      this.litBraziers = this.props.filter(q => q.kind === 'brazier' && q.lit);
      if (silent) return;
      const p = this.player;
      if (p.stats.brazierMax && !pr.oathed) { pr.oathed = true; p.bonusMax += p.stats.brazierMax; p.recalc(); fx.text(pr.x, pr.y - 46, '+' + LF.embers(p.stats.brazierMax) + ' max embers', '#ffe2a6', 11, 1.2); }
      // the first lighting pays in full; a brazier that was smothered pays a little twice more, then nothing
      pr.payouts = (pr.payouts || 0) + 1;
      const first = pr.payouts === 1 && !pr.snuffed;
      const gain = first ? 12 + 15 * p.stats.brazierBonus : pr.payouts <= 3 ? 4 : 0;
      p.addLight(gain);
      LF.audio.play('brazier'); this.stat('braziers');
      fx.burst(pr.x, pr.y - 8, 24, { color: ['#ffb347', '#ffe9b8', '#ff7b2e'], speed1: 180, life: 0.8, grav: -80 });
      fx.ring(pr.x, pr.y, 8, 150, 0.6, '#ffb347', 3);
      this.addFlash(pr.x, pr.y, 260, 0.5, '#ffcf8a');
      fx.text(pr.x, pr.y - 30, gain > 0 ? '+' + LF.embers(gain) + ' embers' : 'relit', '#ffd28a', 12, 1);
    }
    breakUrn(pr) {
      pr.broken = true;
      LF.audio.play('hit');
      fx.burst(pr.x, pr.y, 10, { color: ['#5b5568', '#3c3848'], glow: false, speed1: 140, life: 0.5, size: 3, grav: 200 });
      const n = LF.randInt(1, 3);
      for (let i = 0; i < n; i++) {
        const glass = Math.random() < 0.55;
        this.pickups.push(new LF.Pickup(glass ? 'glass' : 'ember', pr.x, pr.y, glass ? 1 : LF.EMBER));
      }
    }
    breakJar(pr) {
      if (pr.broken) return;
      pr.broken = true;
      const p = this.player, R = 84;
      this.explode(pr.x, pr.y, R, 40 + this.floor * 9, '#ff9a3d');
      this.addZone({ kind: 'fire', x: pr.x, y: pr.y, r: 44, life: 4.5, dps: 26 + this.floor * 3 });
      if (!p.dead && p.dashing <= 0 && p.invuln <= 0 && LF.dist(pr.x, pr.y, p.x, p.y) < 62) this.hurtPlayer(7, { x: pr.x, y: pr.y, name: 'burning oil' });
      for (const o of this.props) if (o.kind === 'oiljar' && !o.broken && LF.dist2(o.x, o.y, pr.x, pr.y) < 110 * 110) this.delay(0.14, () => this.breakJar(o));
      for (const o of this.props) {
        if (o.kind === 'brazier' && !o.lit && LF.dist2(o.x, o.y, pr.x, pr.y) < R * R) this.lightBrazier(o);
        if (o.kind === 'urn' && !o.broken && LF.dist2(o.x, o.y, pr.x, pr.y) < R * R) this.breakUrn(o);
      }
    }
    price(pr) { return Math.max(1, Math.round(pr.price * this.player.stats.shopMul)); }
    interact(pr) {
      const p = this.player;
      switch (pr.kind) {
        case 'brazier': if (!pr.lit && !pr.casting) { pr.casting = true; LF.audio.play('crackle'); } break;
        case 'chest': {
          if (pr.opened) break;
          if (pr.locked) { LF.audio.play('deny'); this.hint('Sealed. Light both braziers'); break; }
          if (pr.mimic) {
            // it was never a reliquary
            pr.opened = true; pr.mimic = false;
            const m = this.spawnEnemy('lurker', pr.x, pr.y, { elite: true, awake: true, spawnT: 0.45, hpMul: 1.3, room: pr.room });
            m.name = 'Mimic'; m.dropRelic = true;
            LF.audio.play('roar'); this.shake(7);
            fx.text(pr.x, pr.y - 30, 'MIMIC!', '#ff7b7b', 16, 1.2);
            fx.burst(pr.x, pr.y, 18, { color: ['#4a3320', '#120a20'], glow: false, speed1: 200, life: 0.6, size: 5 });
            break;
          }
          // Three things, rolled once and kept: walk away and the same three are there when you come back. They can be
          // rerolled. The reliquary a trial leaves holds great works, for as long as there is one the lantern could take.
          // A plain reliquary leans common; a sealed vault's or a trial's still holds something rare.
          const fill = () => LF.rollRelics(p, 3, { rng: this.rng, floor: this.floor, low: !pr.rare && !pr.prize, minRarity: pr.rare ? 'rare' : undefined });
          if (!pr.loot) {
            pr.loot = pr.rite ? LF.rollRelics(p, 3, { rng: this.rng, floor: this.floor, pool: 'brand' }) : [];
            if (!pr.loot.length) { pr.rite = false; pr.loot = fill(); }
            LF.audio.play('chest');
            for (let i = 0; i < 5 + this.floor; i++) this.pickups.push(new LF.Pickup('glass', pr.x, pr.y, 1));
            fx.burst(pr.x, pr.y, 20, { color: ['#ffe08a', '#fff'], speed1: 180, life: 0.6 });
            this.addFlash(pr.x, pr.y, 160, 0.4, '#ffe08a');
          }
          pr.loot = pr.loot.filter(d => (p.relics[d.id] || 0) < d.max);
          if (!pr.loot.length) { pr.opened = true; this.hint('Nothing left in it that you can carry'); break; }
          this.openOffer(pr.rite
            ? { title: 'A Great Work', sub: 'The trial was the making of it. A lantern can hold one of each. Take one, or walk on.', relics: pr.loot, canSkip: true, noReroll: true, onDone: picked => { if (picked) pr.opened = true; } }
            : { title: pr.rare ? 'A Sealed Reliquary' : 'A Reliquary', sub: 'Three things were left in it. Take one; the others stay behind.', relics: pr.loot, canSkip: true, minRarity: pr.rare ? 'rare' : undefined,
              reroll: () => (pr.loot = fill()), onDone: picked => { if (picked) pr.opened = true; } });
          break;
        }
        case 'shrine': {
          if (pr.used) break;
          const offers = LF.rollRelics(p, 2, { rng: this.rng, pool: 'cursed' });
          if (!offers.length) { this.hint('The altar is cold'); pr.used = true; break; }
          this.openOffer({ title: 'Altar of Wax', sub: 'A bargain, freely offered. Take one, or walk away.', relics: offers, canSkip: true, cursed: true, onDone: picked => { if (picked) pr.used = true; } });
          break;
        }
        case 'pedestal': {
          if (pr.sold) break;
          if (pr.item.type === 'relic' && LF.RELICS[pr.item.relic].form && LF.formHeld(p, LF.RELICS[pr.item.relic].form)) { LF.audio.play('deny'); this.hint('Your ' + LF.RELICS[pr.item.relic].form + ' already has a form'); break; }
          if (pr.item.type === 'relic' && LF.RELICS[pr.item.relic].form) {
            // a Legendary Form is shown in full, with its price, and bought or left from there
            const d = LF.RELICS[pr.item.relic];
            this.openOffer({ title: 'A Legendary Form', sub: 'It changes how your ' + d.form + ' works for the rest of this descent. It ranks up like any relic, and you may hold only one form for your ' + d.form + '.', relics: [d], canSkip: true, dim: true, noReroll: true, buy: { pr, price: this.price(pr) } });
            break;
          }
          if (p.glass < this.price(pr)) { LF.audio.play('deny'); this.hint('Not enough glass'); break; }
          p.glass -= this.price(pr); pr.sold = true; LF.audio.play('buy');
          if (pr.item.type === 'relic') this.gainRelic(pr.item.relic, pr.x, pr.y);
          else { p.addLight(45); fx.text(pr.x, pr.y - 24, '+18 embers', '#ffd28a', 12, 1); fx.burst(pr.x, pr.y, 14, { color: '#ffb347', speed1: 120, life: 0.6 }); }
          break;
        }
        case 'font': {
          if (pr.used) break;
          pr.used = true; p.addLight(p.stats.maxLight); LF.audio.play('brazier');
          fx.burst(pr.x, pr.y, 26, { color: ['#fff2cc', '#ffb347'], speed1: 160, life: 0.9, grav: -60 });
          fx.text(pr.x, pr.y - 28, 'Embers restored', '#ffd28a', 12, 1.2);
          break;
        }
        case 'statue': {
          if (pr.used) break;
          // a blessing, not a bargain: three plain lasting gains, each said in full, one to keep
          if (!pr.loot) pr.loot = LF.rollRelics(p, 3, { rng: this.rng, pool: 'boon' });
          const offers = pr.loot;
          if (!offers.length) { this.hint('The statue has nothing left to give'); pr.used = true; break; }
          this.openOffer({ title: 'The Weeping Lamplighter', sub: 'A blessing, kept for the rest of this descent. Choose one.', relics: offers, canSkip: true, noReroll: true,
            onDone: picked => { if (picked) { pr.used = true; fx.ring(pr.x, pr.y, 8, 120, 0.6, '#ffe2a6', 3); } } });
          break;
        }
        case 'trial': {
          if (pr.used) break;
          pr.used = true;
          this.triggerAmbush(this.map.rooms[pr.room], 'Trial of Embers', 'Three waves. Stand your ground');
          fx.ring(pr.x, pr.y, 10, 200, 0.7, '#b070ff', 4);
          break;
        }
        case 'exit': if (pr.open && !pr.hidden) this.descend(); break;
      }
    }
    promptFor(pr) {
      const p = this.player;
      switch (pr.kind) {
        case 'brazier': return pr.lit ? null : pr.casting ? 'Lighting: stay close' : 'Light the brazier';
        case 'chest': return pr.opened ? null : pr.locked ? 'Sealed reliquary: light both braziers' : 'Open the reliquary';
        case 'shrine': return pr.used ? null : 'Kneel at the Altar of Wax';
        case 'pedestal': {
          if (pr.sold) return null;
          const nm = pr.item.type === 'relic' ? LF.RELICS[pr.item.relic].name : 'Lamp Oil (+18 embers)';
          if (pr.item.type === 'relic' && LF.RELICS[pr.item.relic].form) return 'Look at ' + nm + ', a Legendary Form  ·  ' + this.price(pr) + ' glass';
          return 'Buy ' + nm + '  ·  ' + this.price(pr) + ' glass' + (p.glass < this.price(pr) ? '  (too few)' : '');
        }
        case 'font': return pr.used ? null : 'Drink from the Font of Light';
        case 'statue': return pr.used ? null : 'Kneel before the Weeping Lamplighter';
        case 'trial': return pr.used ? null : 'Wake the Brazier of Trials';
        case 'exit': return pr.open && !pr.hidden ? (this.victoryReady ? (this.mode === 'descent' ? (this.loop >= 4 ? 'Give it your flame' : 'Take up the shard') : 'Step into the light') : 'Descend') : null;
      }
      return null;
    }

    // ---------------------------------------------------------- floor flow
    openOffer(o) {
      this.offer = Object.assign({ sel: 0, t: 0 }, o);
      if (!o.cursed && this.depth >= 2) this.teach('school');
      this.bufInteract = 0; this.bufDash = 0; this.bufFlare = 0;
      this.state = 'relic';
      LF.ui.enter(this, 'relic');
    }
    pickOffer(i) {
      const o = this.offer;
      if (!o) return;
      const d = i >= 0 ? o.relics[i] : null;
      // a Legendary Form bought from the Chandler: the glass is taken here, and the form is announced
      if (o.buy && d) {
        if (this.player.glass < o.buy.price) { LF.audio.play('deny'); return; }
        this.player.glass -= o.buy.price; o.buy.pr.sold = true; LF.audio.play('buy'); LF.audio.play('rare');
        this.banner = { text: d.name, sub: 'A Legendary Form: your ' + d.form + ' is changed', t: 0, dur: 3.2 };
      }
      // the Forge stays open: a pick spends the glass, gives the rank, and the screen is still there for the next
      if (o.forge && d) {
        const cost = this.forgeCost(d);
        if (this.player.glass < cost) { LF.audio.play('deny'); return; }
        this.player.glass -= cost; this.gainRelic(d.id, this.player.x, this.player.y); LF.audio.play('buy');
        o.relics = o.held(); o.forged = (o.forged || 0) + 1;
        if (o.relics.length) return;
      }
      this.state = 'play'; this.offer = null; this.bufInteract = 0; this.bufDash = 0; this.bufFlare = 0;
      if (d && !d.pseudo) this.gainRelic(d.id, this.player.x, this.player.y); // a category card is a choice, not a relic
      else LF.audio.play('uiBack');
      if (o.onDone) o.onDone(d);
    }
    // what the Forge asks to give this relic its next rank
    forgeCost(d) { const to = (this.player.relics[d.id] || 0) + 1; return to <= 2 ? LF.TUNE.forgeII : LF.TUNE.forgeIII + LF.TUNE.forgeMore * (to - 3); }
    // what the next reroll of this offer costs in glass, once the lantern's own rerolls are spent: it doubles each time
    rerollPrice(o) { return LF.TUNE.rerollGlass + LF.TUNE.rerollMore * ((o && o.paid) || 0); }
    canReroll(o) { const p = this.player; return !!o && !o.cursed && !o.noReroll && (p.rerolls > 0 || p.glass >= this.rerollPrice(o)); }
    rerollOffer() {
      const o = this.offer, p = this.player;
      // a mend's pages turn for nothing: it is showing what the lantern holds, not rolling anything new
      if (o && o.free && o.reroll && !o.noReroll) { o.relics = o.reroll(); o.t = 0; o.sel = 0; LF.audio.play('uiSelect'); return; }
      if (!this.canReroll(o)) { LF.audio.play('deny'); return; }
      if (p.rerolls > 0) p.rerolls--; else { p.glass -= this.rerollPrice(o); o.paid = (o.paid || 0) + 1; }
      o.relics = o.reroll ? o.reroll() : LF.rollRelics(p, o.relics.length, { rng: this.rng, floor: this.floor, minRarity: o.minRarity });
      o.t = 0; LF.audio.play('uiSelect');
    }
    descend() {
      if (this.fade) return;
      if (this.victoryReady) { this.win(); return; }
      LF.audio.play('descend');
      const cleared = this.totalSpawns > 0 ? this.floorKills / this.totalSpawns : 1;
      if (this.totalSpawns > 0 && this.floorKills >= this.totalSpawns) this.stat('fullClears');
      const boss = !!this.map.boss;
      this.player.invuln = Math.max(this.player.invuln, 3);
      this.startFade(-1, 0.7, () => {
        const p = this.player;
        if (p.dead) return;
        const next = () => { this.depth++; p.rerolls += LF.TUNE.rerollStair; this.loadFloor(); this.state = 'play'; this.startFade(1, 0.8); };
        const cards = Math.max(2, 3 + p.stats.extraChoice - (this.vows.thrift ? 1 : 0));
        if (this.mode === 'descent') {
          const glass = Math.round((16 + this.depth * 4) * LF.TUNE.glassYield), clean = cleared >= 0.85 && !boss;
          const take = () => { p.glass += glass; this.run.glass += glass; next(); };
          const stair = () => {
            // a lantern that arrives nearly out finds something the dark has left among the choices
            // a lantern that arrives nearly out is shown one thing more, and a rare one
            const dusk = !boss && p.frac() < 0.35;
            const roll = () => { const r = LF.rollRelics(p, cards + (clean ? 1 : 0), { rng: this.rng, floor: this.floor }); return dusk ? r.concat(LF.rollRelics(p, 1, { rng: this.rng, floor: this.floor, minRarity: 'rare', filter: d => !r.includes(d) })) : r; };
            const relics = roll(), sh = dusk ? [1] : [];
            if (!relics.length) { take(); return; }
            this.openOffer({
              title: 'The Stair Offers a Gift', relics, canSkip: false, dim: true, reroll: roll, altGlass: glass,
              sub: sh.length ? 'Your flame is nearly out. The stair shows a failing lantern one thing more.' : clean ? 'You left nothing alive behind you: one more to choose from.' : 'Take one with you into the dark below.',
              onDone: picked => { if (!picked) take(); else next(); },
            });
          };
          // after a great shadow the shard is the stair's gift: one offer, with one more to choose from, not two in a row
          const shard = boss ? LF.rollRelics(p, cards + 1, { rng: this.rng, floor: this.floor, minRarity: 'rare' }) : [];
          // Glass runs together at the stair: every sixty held is a rank for one of three relics the lantern already
          // holds, the bearer's choice. The deeper a relic's rank, the likelier it is among the three.
          // One screen for all of it: a pick forges a rank and the screen stays, on the same page, until the glass
          // runs short or the bearer is done (`at0` is the page to stay on; the cards do not fly in again).
          // The Forge: everything the lantern carries that can still grow, on one screen, each with its price in glass.
          const forge = then => {
            const held = () => p.relicOrder.map(id => LF.RELICS[id]).filter(d => d && d.rarity !== 'boon' && p.relics[d.id] < d.max);
            const list = held();
            if (!list.some(d => p.glass >= this.forgeCost(d))) { then(); return; }
            this.openOffer({ title: 'The Forge', sub: 'Glass forges a rank into a relic you carry.', relics: list, held, forge: true, canSkip: true, dim: true, noReroll: true, onDone: () => then() });
          };
          const mend = (then, at0) => {
            if (LF.TUNE.forging) { forge(then); return; }
            const held = p.relicOrder.map(id => LF.RELICS[id]).filter(d => d && d.rarity !== 'boon' && p.relics[d.id] < d.max);
            if (!LF.TUNE.glassRanks || p.glass < LF.TUNE.melt || !held.length) { then(); return; }
            // everything the lantern holds that can still grow, four to a page, in the order it was taken
            const per = 4, pages = Math.ceil(held.length / per); let at = Math.min(at0 || 0, pages - 1);
            const page = () => { at = (at + 1) % pages; return held.slice(at * per, at * per + per); };
            const left = Math.floor(p.glass / LF.TUNE.melt);
            this.openOffer({ title: 'The Glass Runs Together', sub: LF.TUNE.melt + ' glass forges a rank for a relic you hold, and only here is a third rank forged. You hold enough for ' + left + '.', relics: held.slice(at * per, at * per + per), t: at0 === undefined ? 0 : 1, canSkip: false, dim: true, mend: true, free: pages > 1, pages, noReroll: pages <= 1, reroll: page,
              onDone: picked => { if (!picked) { then(); return; } p.glass -= LF.TUNE.melt; mend(then, at); } });
          };
          if (shard.length) this.openOffer({ title: 'A Shard of the Lantern', minRarity: 'rare', sub: 'The shadow had closed around this. It is yours now.', relics: shard, canSkip: false, dim: true, onDone: () => mend(next) });
          else mend(stair);
          return;
        }
        // the Gauntlet and the Vigil keep the plain offer: a handful of relics, take one
        const n = Math.max(2, 3 + p.stats.extraChoice - (this.vows.thrift ? 1 : 0));
        const alt = boss ? 0 : 16 + this.depth * 4;
        const relics = LF.rollRelics(p, n, { rng: this.rng, floor: this.floor, minRarity: boss ? 'rare' : undefined });
        const dusk = false, rites = [];
        const spoils = () => {
        if (!relics.length) { if (alt) { p.glass += alt; this.run.glass += alt; } next(); return; }
        this.openOffer({
          title: boss ? 'A Shard of the Lantern' : 'The Stair Offers a Gift', minRarity: boss ? 'rare' : undefined,
          sub: boss ? 'The shadow had closed around this. It is yours now.' : dusk ? 'Your flame is nearly out. Something in the dark has left a gift among them.' : (cleared >= 0.85 ? 'You left nothing alive behind you: one more to choose from.' : 'Take one with you into the dark below.'),
          relics, canSkip: false, dim: true, altGlass: alt,
          onDone: picked => {
            if (!picked && alt) { p.glass += alt; this.run.glass += alt; }
            if (this.mode === 'rush') {
              const more = LF.rollRelics(p, 3 + p.stats.extraChoice, { rng: this.rng, floor: this.floor, minRarity: 'uncommon' });
              if (more.length) { this.openOffer({ title: 'And One More', sub: 'The Gauntlet is long. Take a second.', relics: more, canSkip: false, dim: true, onDone: next }); return; }
            }
            next();
          },
        });
        };
        if (rites.length) this.openOffer({ title: 'A Rite Is Offered', sub: 'The old Lamplighters tended the Lantern in more ways than one. A rite changes how you fight for the rest of the descent. Take one, or walk on.', relics: rites, canSkip: true, dim: true, noReroll: true, onDone: spoils });
        else spoils();
      });
    }
    win() {
      this.endRun(true);
      LF.audio.play('win');
      this.startFade(-1, 1.6, () => { this.state = 'win'; LF.ui.enter(this, 'win'); this.startFade(1, 1); });
    }
    continueDeeper() {
      // after a victory the player may keep descending into harder cycles
      this.run.ended = false; this.victoryReady = false; this.carry = (this.carry || 0) + 1;
      this.depth++; this.loadFloor(); this.state = 'play'; this.startFade(1, 0.8);
    }
    startFade(dir, dur, cb) { this.fade = { dir, dur, t: 0, cb }; }

    // ---- The Long Vigil: endless waves in one hall ----
    startWave() {
      const v = this.vigil, p = this.player, map = this.map, room = map.rooms[0], df = this.diff;
      v.wave++; v.state = 'fight'; v.waveT = 0; this.rush = false;
      this.floor = Math.min(9, 1 + Math.floor(v.wave / 2));
      this.enemyHpMul = (1 + 0.13 * (v.wave - 1)) * df.hp;
      this.enemyDmgMul = (1 + 0.05 * (v.wave - 1)) * df.dmg;
      let budget = 4.5 + v.wave * 2.3, guard = 0;
      const opts = LF.ROSTER.filter(r => r.min <= 1 + v.wave * 0.75);
      while (budget > 0.4 && guard++ < 80 && this.enemies.length < 60) {
        const aff = opts.filter(r => r.cost <= budget + 0.5);
        if (!aff.length) break;
        const pick = this.rng.weighted(aff, r => r.w);
        const n = pick.pack ? this.rng.int(pick.pack[0], pick.pack[1]) : 1;
        const elite = !pick.pack && pick.type !== 'brood' && v.wave >= 4 && this.rng.chance(Math.min(0.03 * v.wave, 0.28));
        for (let i = 0; i < n; i++) {
          const sp = map.randomSpot(room, this.rng, 1, p, 190);
          this.spawnEnemy(pick.type, sp.x, sp.y, { awake: true, elite, room: 0, spawnT: 0.6 + this.rng.next() * 1.8 });
        }
        budget -= pick.cost * (elite ? 2 : 1);
      }
      const champ = v.wave % 5 === 0;
      if (champ) {
        const heavy = ['lurker', 'bulwark', 'howler', 'weaver', 'glass', 'snuffer'].filter(t => LF.ROSTER.some(r => r.type === t && r.min <= 1 + v.wave * 0.75));
        const sp = map.randomSpot(room, this.rng, 2, p, 220);
        const c = this.spawnEnemy(this.rng.pick(heavy.length ? heavy : ['lurker']), sp.x, sp.y, { awake: true, elite: true, room: 0, spawnT: 1.6, hpMul: 2.2 });
        c.name = 'Champion of the Dark'; c.r *= 1.15;
        LF.audio.play('roar');
      }
      this.banner = { text: 'Wave ' + v.wave, sub: champ ? 'A champion comes' : '', t: 0, dur: 1.8, small: true, boss: champ };
      LF.audio.play('gate');
    }
    vigilStep(dt) {
      const v = this.vigil, p = this.player;
      if (v.state === 'rest') { v.t -= dt; if (v.t <= 0) this.startWave(); return; }
      let alive = 0;
      for (const e of this.enemies) if (!e.dead) alive++;
      v.alive = alive;
      v.waveT = (v.waveT || 0) + dt;
      this.rush = v.waveT > 55;
      if (v.waveT > 90 && Math.floor(v.waveT) !== Math.floor(v.waveT - dt)) {
        const room = this.map.rooms[0];
        for (const e of this.enemies) {
          if (e.dead || e.spawnT > 0) continue;
          if (LF.dist2(e.x, e.y, p.x, p.y) > 900 * 900 || this.map.solidAt(e.x, e.y)) { const sp = this.map.randomSpot(room, this.rng, 1, p, 160); e.x = sp.x; e.y = sp.y; e.kx = 0; e.ky = 0; }
        }
      }
      if (alive > 0) return;
      v.state = 'rest'; v.t = 6; v.cleared = v.wave;
      LF.audio.play('gateOpen');
      for (let i = 0; i < 4 + Math.floor(v.wave / 2); i++) this.pickups.push(new LF.Pickup('ember', p.x + LF.rand(-50, 50), p.y + LF.rand(-50, 50), LF.EMBER));
      if (v.wave > (this.meta.vigilBest || 0)) { this.meta.vigilBest = v.wave; this.save(); }
      fx.text(p.x, p.y - 40, 'Wave ' + v.wave + ' broken', '#ffe08a', 14, 1.4);
      if (v.wave % 2 === 0) {
        const relics = LF.rollRelics(p, Math.max(2, 3 + p.stats.extraChoice - (this.vows.thrift ? 1 : 0)), { rng: this.rng, floor: Math.min(9, v.wave), minRarity: v.wave % 10 === 0 ? 'rare' : undefined });
        if (relics.length) this.delay(1.1, () => { if (!p.dead && this.state === 'play') this.openOffer({ title: 'The Vigil Holds', sub: 'Wave ' + v.wave + ' is broken. Take what the dark left behind.', relics, canSkip: false }); });
      }
    }
    triggerAmbush(room, title, sub) {
      this.map.sealRoom(room, true);
      room.triggered = true; room.wave = 0;
      LF.audio.play('gate'); this.shake(5);
      this.banner = { text: title || 'Ambush', sub: sub || 'The dark closes behind you', t: 0, dur: 1.8, small: true };
      if (!title) this.teach('gate');
      this.spawnWave(room);
    }
    spawnWave(room) {
      const list = room.pending.filter(s => s.wave === room.wave);
      for (const s of list) this.spawnEnemy(s.type, s.x, s.y, { elite: s.elite, room: room.id, awake: true, spawnT: LF.rand(0.5, 1.0), counted: !s.optional });
      LF.audio.play('spawn');
      return list.length;
    }
    roomAlive(room) {
      let n = 0;
      for (const e of this.enemies) if (!e.dead && e.room === room.id && !e.parentless) n++;
      return n;
    }
    startBoss(room) {
      this.bossStarted = true;
      this.map.sealRoom(room, true);
      LF.audio.play('gate'); this.shake(8);
      const b = this.map.boss;
      const e = this.spawnEnemy(b.type, b.x, b.y, { awake: true, spawnT: 1.8, room: room.id });
      this.boss = e;
      this.banner = { text: e.def.name, sub: e.def.title || '', t: 0, dur: 3.2, boss: true };
      this.delay(0.5, () => LF.audio.play('roar'));
    }
    onBossDeath(e) {
      this.bossDead = true; this.run.bosses++; this.run.finalBoss = e.def.name;
      if (!this.practice) {
        this.meta.bosses = (this.meta.bosses || 0) + 1;
        if (!this.meta.felled) this.meta.felled = {};
        this.meta.felled[e.type] = (this.meta.felled[e.type] || 0) + 1; this.save();
        for (const l of LF.LOOKS) if (l.by === e.type && this.meta.felled[e.type] === 1) this.toast('A Lightbearer answers', l.name + ' can carry the light on your next descent.', '#ffe2a6', 'flame', '#ffb347', 7);
      }
      const room = this.map.rooms[0];
      this.map.sealRoom(room, false); room.cleared = true;
      for (const o of this.enemies) if (o !== e && !o.dead) { o.noDrops = true; this.killEnemy(o, { type: 'self' }); }
      for (const b of this.ebullets) b.dead = true;
      this.zones = this.zones.filter(z => z.kind !== 'wax' && z.kind !== 'gloom');
      this.hitstop(0.3); this.shake(18);
      this.addFlash(e.x, e.y, 700, 1.4, '#fff2cc');
      for (let i = 0; i < 26; i++) this.pickups.push(new LF.Pickup('ember', e.x + LF.rand(-30, 30), e.y + LF.rand(-30, 30), LF.EMBER));
      for (let i = 0; i < 30 + this.depth * 2; i++) this.pickups.push(new LF.Pickup('glass', e.x + LF.rand(-30, 30), e.y + LF.rand(-30, 30), 1));
      for (let i = 0; i < 5; i++) this.delay(i * 0.18, () => { fx.ring(e.x + LF.rand(-40, 40), e.y + LF.rand(-40, 40), 10, 160, 0.6, '#fff2cc', 5); LF.audio.play('explode'); });
      for (const pr of this.props) {
        if (pr.kind === 'exit') { pr.hidden = false; pr.open = true; }
        if (pr.kind === 'brazier' && !pr.lit) this.lightBrazier(pr, true);
      }
      if (this.mode === 'rush' ? this.depth >= this.rushLen() : this.floor === 9) this.victoryReady = true;
      if (this.mode === 'rush') { const pl = this.player; pl.bonusMax += 15; pl.recalc(); pl.addLight(pl.stats.maxLight); fx.text(pl.x, pl.y - 44, '+6 max embers', '#ffe2a6', 13, 1.6); }
      this.banner = { text: e.def.name + ' is unmade', sub: this.floor === 9 ? (this.mode === 'descent' ? (this.loop >= 4 ? 'Beneath it, the Great Lantern. It has gone out' : 'Beneath it, a shard of the Lantern') : 'A stair of pale light rises') : 'The way down lies open', t: 0, dur: 4, small: true };
      LF.audio.play('gateOpen');
    }

    // ---------------------------------------------------------- frame update
    update(realDt) {
      this.realTime += realDt;
      LF.audio.boss = this.state === 'play' && !!this.boss && !this.boss.dead && this.boss.spawnT <= 0 && !this.player.dead;
      if (this.demo) {
        const real = LF.input.poll();
        this.demoT += realDt;
        if (this.demoT > 0.5 && (LF.input.pressed.size > 0 || real.click || real.rclick || real.confirm || real.back || real.pause || real.dash || real.interact || real.flare || real.mx || real.my)) { this.endDemo(); this.inp = { aimX: real.aimX, aimY: real.aimY }; return; }
        if (this.state === 'dead' || this.state === 'win') { this.demoEnd = (this.demoEnd || 0) + realDt; if (this.demoEnd > 4) { this.demoEnd = 0; this.bot = LF.makeBot({ human: 'good', offerDelay: 1.6 }); this.startRun(undefined, { noVows: true }); } }
      }
      const inp = this.bot ? this.bot(this) : LF.input.poll();
      this.inp = inp;
      if (this.meta.autofire && !this.bot && this.state === 'play' && this.player && !inp.fire) {
        const p = this.player;
        for (const e of this.enemies) if (e.awake && !e.dead && !e.intangible && e.spawnT <= 0 && LF.dist2(p.x, p.y, e.x, e.y) < 440 * 440) { inp.fire = true; break; }
      }
      if (this.fade) {
        this.fade.t += realDt;
        if (this.fade.t >= this.fade.dur) { const f = this.fade; this.fade = null; if (f.cb) f.cb(); }
      }
      if (this.banner) { this.banner.t += realDt; if (this.banner.t > this.banner.dur) this.banner = null; }
      for (const t of this.toasts) t.t += realDt;
      this.toasts = this.toasts.filter(t => t.t < t.dur);
      this.hurtVig = Math.max(0, this.hurtVig - realDt * 2.2);
      // dread: a hunter near you raises it every frame; your heart keeps time with it
      this.dread = Math.max(0, (this.dread || 0) - realDt * 0.9);
      if (this.dread > 0.05 && this.state === 'play') { this.heartT = (this.heartT || 0) - realDt; if (this.heartT <= 0) { this.heartT = 1.05 - 0.68 * this.dread; this.heartBeat = 1; LF.audio.play('heart', this.dread); } }
      this.heartBeat = Math.max(0, (this.heartBeat || 0) - realDt * 3.5);
      if (this.hitDir) { this.hitDir.t -= realDt; if (this.hitDir.t <= 0) this.hitDir = null; }
      this.shakeAmt = Math.max(0, this.shakeAmt - realDt * 40);

      if (this.state !== 'play') { LF.ui.update(this, inp, realDt); return; }
      if (inp.pause && !this.player.dead && !this.fade) { this.state = 'pause'; LF.ui.enter(this, 'pause'); LF.audio.play('uiBack'); inp.pause = false; inp.back = false; inp.confirm = false; this.bufInteract = 0; this.bufDash = 0; this.bufFlare = 0; return; }
      if (inp.map) this.showMap = !this.showMap;

      // input buffering: a press during hit-stop, or just before an ability is ready, still counts
      const pl = this.player;
      if (inp.dash) this.bufDash = 0.16;
      if (inp.flare && pl.flareT <= 0.25 && !this.vows.silence) this.bufFlare = 0.25;
      if (inp.interact) this.bufInteract = 0.18;
      if (this.hitstopT > 0) { this.hitstopT -= realDt; return; }
      const dt = realDt * this.speed;
      if (this.bufDash > 0) { this.bufDash -= dt; inp.dash = pl.dashT <= 0 && pl.dashing <= 0; if (inp.dash) this.bufDash = 0; }
      if (this.bufFlare > 0) { this.bufFlare -= dt; inp.flare = pl.flareT <= 0; if (inp.flare) this.bufFlare = 0; }
      if (this.bufInteract > 0) { this.bufInteract -= dt; inp.interact = true; }
      this.step(dt, inp);
    }
    step(dt, inp) {
      const p = this.player, map = this.map;
      // with no Chandler to spend it on, glass runs together into rerolls
      if (this.mode !== 'descent' && p.glass >= LF.TUNE.melt && !p.dead && this.state === 'play' && !this.fade) {
        const up = Object.keys(p.relics).filter(id => { const d = LF.RELICS[id]; return d && d.rarity !== 'boon' && p.relics[id] < d.max; });
        if (up.length) { p.glass -= LF.TUNE.melt; const id = up[(Math.random() * up.length) | 0]; this.toast('Glass Runs Together', 'It mends into your lantern, and ' + LF.RELICS[id].name + ' gains a rank.', '#7fffd4', 'glass', '#7fffd4', 5); this.gainRelic(id, p.x, p.y); }
      }
      if (this.pendingBolt && !this.fade && !p.dead && this.state === 'play') {
        const d = LF.RELICS[this.pendingBolt], S = LF.SCHOOLS[d.school]; this.pendingBolt = null;
        if (!p.relics[d.id]) { this.openOffer({ title: 'Your Bolt Could Turn', sub: 'You hold enough of ' + S.name.toLowerCase() + ' that your bolt would carry it. It would let go of what it carries now.', relics: [d], canSkip: true, dim: true, noReroll: true, bolt: true }); return; }
      }
      this.time += dt; this.run.time += p.dead ? 0 : dt;
      // Lingering is not safe: stay too long on a floor and the dark sends hunters, again and again.
      if (this.mode === 'descent' && !this.map.boss && !p.dead && this.run.kills > 0) {
        this.floorT += dt;
        // how long a bearer may take before the first Hunter: longer where the first Levels are fuller and tougher than
        // the old curve made them, and longer on a Level with the Chandler's room to visit
        if (this.lingerAt === undefined || this.lingerFor !== this.map) { this.lingerFor = this.map; this.lingerAt = 85 * (1 + 0.6 * (LF.TUNE.earlyHp + LF.TUNE.pack) * Math.max(0, 4 - this.floor) / 3) + (this.map.rooms.some(r => r.type === 'shop') ? 25 : 0); }
        const due = Math.min(4, Math.floor((this.floorT - this.lingerAt) / 42) + 1); // four at most: a punishment, not a siege
        if (this.floorT > this.lingerAt && due > this.lingerN) {
          this.lingerN = due;
          let alive = 0; for (const e of this.enemies) if (!e.dead && e.hunter) alive++;
          const far = this.map.rooms.filter(r => r.type !== 'shop').sort((a, b) => LF.dist(b.cx, b.cy, p.x / TILE, p.y / TILE) - LF.dist(a.cx, a.cy, p.x / TILE, p.y / TILE))[0];
          if (far && alive < 2) {
            const pos = this.map.nearestOpen(far.cx * TILE, far.cy * TILE);
            const h = this.spawnEnemy('hunter', pos.x, pos.y, { awake: true, spawnT: 1, noDrops: true });
            h.name = 'A Hunter'; h.hunter = true;
            this.banner = { text: due === 1 ? 'The dark has your scent' : 'Another hunter comes', sub: due === 1 ? 'You have lingered too long' : '', t: 0, dur: 2.2, small: true, boss: true };
            LF.audio.play('roar'); LF.audio.play('howl');
          }
        }
      }

      this.flowT -= dt;
      if (this.flowT <= 0) { this.flowT = 0.2; map.computeFlow(p.x, p.y); }
      this.seenT -= dt;
      if (this.seenT <= 0) { this.seenT = 0.15; map.markSeen(p.x, p.y, p.lightR * 0.9); }

      // zones first: they feed snuffMul and isLit this frame
      let gloomed = false;
      for (const z of this.zones) {
        z.life -= dt; z.t += dt;
        if (z.life <= 0) { z.dead = true; continue; }
        if (z.ward) for (const b of this.ebullets) if (!b.dead && LF.dist2(z.x, z.y, b.x, b.y) < z.r * z.r) { b.dead = true; fx.burst(b.x, b.y, 4, { color: '#ffe9a8', speed1: 80, life: 0.3 }); }
        if (z.kind === 'fire' || z.kind === 'beacon') {
          for (const e of this.enemies) {
            if (e.dead || e.intangible || e.spawnT > 0) continue;
            if (LF.dist2(z.x, z.y, e.x, e.y) < (z.r + e.r) * (z.r + e.r)) { if (z.kind === 'fire' && p.stats.tallowFire) this.waxEnemy(e, 1.2); /* Tallow Flames */ this.damageEnemy(e, z.dps * dt, { type: 'burn', of: 'ground', quiet: true, noShroud: true }); if (z.kind === 'fire' && !e.dead && !(e.burn > 0)) this.ignite(e, this.player.stats.burnBase, 1.5); }
          }
          if (z.kind === 'fire' && Math.random() < dt * 9) fx.spawn({ x: z.x + LF.rand(-z.r, z.r) * 0.6, y: z.y + LF.rand(-z.r, z.r) * 0.6, vy: -50, life: 0.5, size: 3, color: LF.pick(['#ff7b2e', '#ffc24d', '#ff4d1f']) });
        } else if (z.kind === 'wax') {
          z.tick = (z.tick || 0) - dt;
          if (!p.dead && z.tick <= 0 && p.dashing <= 0 && LF.dist2(z.x, z.y, p.x, p.y) < z.r * z.r) { z.tick = 0.5; this.hurtPlayer(z.dmg, { steal: true, name: 'burning wax' }); }
          if (Math.random() < dt * 5) fx.spawn({ x: z.x + LF.rand(-z.r, z.r) * 0.6, y: z.y + LF.rand(-z.r, z.r) * 0.6, vy: -40, life: 0.5, size: 2.4, color: LF.pick(['#ff9a3d', '#ffd28a']) });
        } else if (z.kind === 'tallow') {
          // the player's own spilt wax: whatever stands in it is waxed
          for (const e of this.enemies) { if (e.dead || e.intangible || e.spawnT > 0) continue; if (LF.dist2(z.x, z.y, e.x, e.y) < (z.r + e.r) * (z.r + e.r)) { this.waxEnemy(e, 1.2); e.pooled = this.time; } }
          // and it slows their shots: a bolt of shadow that crosses wax loses most of its speed, once
          for (const sh of this.ebullets) if (!sh.dead && !sh.waxed && LF.dist2(z.x, z.y, sh.x, sh.y) < z.r * z.r) { sh.waxed = true; sh.vx *= 0.4; sh.vy *= 0.4; sh.speed *= 0.4; }
        } else if (z.kind === 'mothcloud') {
          z.tick -= dt;
          if (z.tick <= 0) { z.tick = 0.4; const s2 = p.stats, bite = s2.mothBite * s2.swarmMul * 1.5; for (const e of this.enemies) { if (e.dead || e.intangible || e.spawnT > 0 || LF.dist2(z.x, z.y, e.x, e.y) > (z.r + e.r) * (z.r + e.r)) continue; this.damageEnemy(e, bite, { type: 'moth', quiet: true, noShroud: true }); if (!e.dead) this.mothBite(e); } }
          if (Math.random() < dt * 30) { const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * z.r; fx.spawn({ x: z.x + Math.cos(a) * d, y: z.y + Math.sin(a) * d, vx: LF.rand(-40, 40), vy: LF.rand(-40, 40), life: 0.5, size: 2.2, color: LF.pick(['#e4d4ff', '#ffe2b0']), drag: 1 }); }
        } else if (z.kind === 'candle') {
          z.pulse -= dt;
          if (z.pulse <= 0 && !p.dead) { z.pulse = 2; const s2 = p.stats; this.flareBurst(z.x, z.y, s2.flareRadius * 0.6, s2.flareDmg * 0.35 * p.damageMul(), s2.flareStun * 0.35, 0.3, z.fk); }
        } else if (z.kind === 'gloom') {
          if (!p.dead && LF.dist2(z.x, z.y, p.x, p.y) < z.r * z.r) { gloomed = true; p.light = Math.max(1, p.light - 6.5 * dt); }
          if (Math.random() < dt * 16) { const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * z.r; fx.spawn({ x: z.x + Math.cos(a) * d, y: z.y + Math.sin(a) * d, vx: LF.rand(-12, 12), vy: LF.rand(-12, 12), life: 1.2, size: 11, color: LF.pick(['#150a26', '#1d0f33', '#0d0718']), glow: false, shrink: false, alpha: 0.5, drag: 0.5 }); }
        }
      }
      LF.compact(this.zones);
      // lamps carried by censers, moths and waxed creatures (Censer Lamps, Moth Lamps, Candle Glow) sear what is near them, on top of the bearer's own glow
      if (p.carried && p.carried.length && !p.dead) {
        for (const c of p.carried) for (const e of this.enemies) {
          if (e.dead || e.intangible || e.spawnT > 0) continue;
          const d2 = LF.dist2(c.x, c.y, e.x, e.y), rr = c.r + e.r;
          if (d2 < rr * rr) this.damageEnemy(e, 10 * p.stats.sear * (1 - 0.5 * Math.sqrt(d2) / rr) * dt, { type: 'sear', quiet: true, sear: true, noShroud: true });
        }
      }
      this.gloomed = gloomed;
      // High Tide omen: the water rises and falls on a slow cycle
      const high = !!(this.omen && this.omen.id === 'tide') && Math.sin(this.time * 0.42) > 0.25;
      if (high !== !!this.tideHigh) {
        this.tideHigh = high;
        if (!this.banner || this.banner.small) this.banner = { text: high ? 'The sluice opens' : 'The water drains away', sub: high ? 'Keep to dry stone' : '', t: 0, dur: 1.6, small: true };
        LF.audio.play('splash');
      }
      if (high) for (const z of this.zones) if (z.kind === 'fire' && map.waterAt(z.x, z.y)) z.life = Math.min(z.life, 0.2);
      this.snuffMul = (this.snuffCount > 0 ? Math.max(0.5, Math.pow(0.7, this.snuffCount)) : 1) * (gloomed ? 0.72 : 1);
      this.snuffCount = 0; this.leeched = 0;

      // rest by a fire: no drain, slow recovery up to half
      let nearFire = false, nearLamp = false;
      for (const b of this.litBraziers) if (LF.dist2(p.x, p.y, b.x, b.y) < 130 * 130) { nearFire = true; break; }
      if (!nearFire) for (const l of this.litLamps) if (LF.dist2(p.x, p.y, l.x, l.y) < 92 * 92) { nearLamp = true; break; }
      if (!nearFire && !nearLamp && p.stats.poolLight) for (const z of this.zones) if (z.kind === 'tallow' && !z.dead && LF.dist2(p.x, p.y, z.x, z.y) < z.r * z.r) { nearLamp = true; break; } // Candle Glow
      const room = map.roomOf(p.x, p.y);
      // No drain beside any fire (brazier or relit wall lamp), in the Chandler's shop, or before the first kill of a descent.
      this.drainActive = !nearFire && !nearLamp && !(room && (room.type === 'shop')) && !p.dead && !(this.depth === 1 && this.run.kills === 0);
      this.nearLamp = nearLamp;
      // with nothing near, a brazier mends a share of your embers a second (6%, so half in about eight seconds),
      // up to half of them; the Hearthstone mends faster, the Last Coat all the way
      { const to = p.stats.maxLight * p.stats.restTo; if (nearFire && this.threat <= 0 && !p.dead && p.light < to) p.addLight(Math.min(to - p.light, p.stats.maxLight * 0.06 * p.stats.restRate * dt)); }
      this.nearFire = nearFire;
      if (p.stats.brazierBurn) {
        for (const b of this.litBraziers) for (const e of this.enemies) {
          if (!e.dead && !e.intangible && e.spawnT <= 0 && LF.dist2(b.x, b.y, e.x, e.y) < 150 * 150) this.damageEnemy(e, 9 * dt, { type: 'burn', quiet: true, noShroud: true });
        }
      }

      if (!p.dead) p.update(dt, inp);
      if (!p.dead && map.rescue(p)) { p.vx = 0; p.vy = 0; }

      // rooms
      if (!p.dead && p.frac() < 0.3) this.teach('low');
      if (this.depth === 1 && this.run.time > 45 && !this.run.flares && this.threat > 0) this.teach('flare');
      if (room !== this.room) {
        this.room = room;
        if (room && room.type === 'shop') this.teach('shop');
        if (room && room.type === 'vault' && !room.cleared) { this.teach('vault'); this.banner = { text: 'A lightless vault', sub: 'Light both braziers', t: 0, dur: 2, small: true }; }
        if (room) { room.visited = true; p.lifelineUsed = false; }
      }
      if (room && room.type === 'vault' && !room.cleared) {
        // the vault drinks light until both of its braziers burn
        this.snuffCount += 2;
        let lit = 0, all = 0;
        for (const pr of this.props) if (pr.kind === 'brazier' && pr.vault && pr.room === room.id) { all++; if (pr.lit) lit++; }
        if (all > 0 && lit === all) {
          room.cleared = true;
          for (const pr of this.props) if (pr.kind === 'chest' && pr.room === room.id) pr.locked = false;
          LF.audio.play('gateOpen'); this.banner = { text: 'The vault opens', sub: '', t: 0, dur: 1.8, small: true };
        }
      }
      if (room && !p.dead) {
        const tx = p.x / TILE, ty = p.y / TILE, m = 1.6;
        const inside = tx > room.x + m && tx < room.x + room.w - m && ty > room.y + m && ty < room.y + room.h - m;
        if (inside && room.type === 'ambush' && !room.triggered) this.triggerAmbush(room);
        if (inside && room.type === 'boss' && !this.bossStarted && ty < room.y + room.h - 3) this.startBoss(room);
      }
      for (const r of map.rooms) {
        if ((r.type === 'ambush' || r.type === 'trial') && r.sealed) {
          // safety net: a creature that cannot reach the player is moved; a seal never lasts forever
          r.sealT = (r.sealT || 0) + dt;
          if (r.sealT > 40 && Math.floor(r.sealT) !== Math.floor(r.sealT - dt)) {
            for (const e of this.enemies) {
              if (e.dead || e.room !== r.id || e.def.ghost || e.spawnT > 0) continue;
              if (map.flowDist(e.x, e.y) === 65535 || map.solidAt(e.x, e.y)) { const sp = map.randomSpot(r, this.rng, 1, p, 120); e.x = sp.x; e.y = sp.y; }
            }
          }
          if (r.sealT > 200) for (const e of this.enemies) if (!e.dead && e.room === r.id) { e.noDrops = true; this.killEnemy(e, { type: 'self' }); }
          let alive = 0;
          for (const e of this.enemies) if (!e.dead && e.room === r.id) alive++;
          if (alive === 0) {
            r.wave++;
            if (r.pending.some(s => s.wave === r.wave)) { this.spawnWave(r); }
            else {
              map.sealRoom(r, false); r.cleared = true; LF.audio.play('gateOpen');
              const cx = r.cx * TILE, cy = r.cy * TILE, c = map.nearestOpen(cx, cy);
              const trial = r.type === 'trial';
              for (let i = 0; i < (trial ? 12 : 6); i++) this.pickups.push(new LF.Pickup('ember', c.x, c.y, LF.EMBER));
              for (let i = 0; i < (trial ? 14 : 5) + this.floor; i++) this.pickups.push(new LF.Pickup('glass', c.x, c.y, 1));
              fx.ring(c.x, c.y, 10, 120, 0.6, '#ffe08a', 3);
              if (trial) {
                const spot = map.nearestOpen(c.x, c.y + 46);
                this.props.push({ kind: 'chest', x: spot.x, y: spot.y, room: r.id, opened: false, rare: true, rite: true });
                LF.audio.play('rare'); this.stat('trials');
              }
              this.banner = { text: trial ? 'Trial complete' : 'The dark recoils', sub: trial ? 'A reliquary answers' : '', t: 0, dur: trial ? 2.4 : 1.6, small: true };
            }
          }
        }
      }

      // enemies
      this.hazards = [];
      let threat = 0;
      for (const e of this.enemies) {
        if (e.dead) continue;
        e.update(dt, this);
        if (!e.dead && !e.def.ghost && !e.intangible && map.rescue(e)) { e.kx = 0; e.ky = 0; e.vx = 0; e.vy = 0; }
        if (e.awake && !e.dead && LF.dist2(e.x, e.y, p.x, p.y) < 560 * 560) threat += e.boss ? 8 : (e.elite ? 2 : 1);
      }
      this.threat = threat;
      if (this.mode === 'vigil' && !p.dead) this.vigilStep(dt);
      this.separate();
      LF.compact(this.enemies);
      for (const b of this.bullets) {
        if (b.dead) continue;
        b.update(dt, this);
        if (b.dead && b.coal) { const k = b.coal; b.coal = 0; this.explode(b.x, b.y, 44 + 56 * k, b.dmg * 0.4); }
      }
      LF.compact(this.bullets);
      for (const b of this.ebullets) if (!b.dead) b.update(dt, this);
      LF.compact(this.ebullets);
      for (const pk of this.pickups) if (!pk.dead) pk.update(dt, this);
      LF.compact(this.pickups);

      // floor hazards: idle, then a warning, then the strike
      for (const pr of this.props) {
        if (pr.kind !== 'trap') continue;
        if (LF.dist2(p.x, p.y, pr.x, pr.y) > 620 * 620) { pr.state = 0; continue; }
        if (pr.calm > 0) { pr.calm -= dt; pr.state = 0; continue; } // a flare drove the dark back down
        const ph = (this.time + pr.phase) % pr.period, left = pr.period - ph;
        const st = left < 0.65 ? 2 : left < 1.55 ? 1 : 0;
        if (st === 2 && pr.state !== 2) {
          pr.hit = false;
          LF.audio.play(pr.sub === 'vent' ? 'burn' : pr.sub === 'geyser' ? 'splash' : 'lunge');
          if (pr.sub === 'grasp') fx.burst(pr.x, pr.y, 10, { color: ['#12081e', '#1a0c18'], speed1: 110, life: 0.5, size: 5, glow: false });
          if (pr.sub === 'vent') fx.burst(pr.x, pr.y, 10, { color: ['#ff7b2e', '#ffc24d'], speed1: 120, life: 0.5, grav: -120 });
          else if (pr.sub === 'geyser') fx.burst(pr.x, pr.y, 12, { color: ['#9fe3ff', '#e8fbff'], speed1: 160, life: 0.5, glow: false });
        }
        pr.state = st;
        if (st >= 1) this.hazards.push({ x: pr.x, y: pr.y, r: 30 });
        if (st !== 2) continue;
        const R = 28;
        if (!pr.hit && !p.dead && !p.stats.trapProof && p.dashing <= 0 && p.invuln <= 0 && LF.dist2(p.x, p.y, pr.x, pr.y) < (R + p.r - 4) * (R + p.r - 4)) {
          pr.hit = true;
          const base = pr.sub === 'geyser' ? 5 : pr.sub === 'grasp' ? 8 : 9;
          this.hurtPlayer(base * (1 + 0.05 * this.floor) * this.diff.dmg, { x: pr.x, y: pr.y, name: pr.sub === 'geyser' ? 'a burst drain' : pr.sub === 'grasp' ? 'a grasping shadow' : 'a flame vent' });
        }
        if (pr.sub !== 'grasp') for (const e of this.enemies) {
          if (e.dead || e.intangible || e.spawnT > 0 || e.def.flies || LF.dist2(e.x, e.y, pr.x, pr.y) > (R + e.r) * (R + e.r)) continue;
          if (pr.sub === 'vent') this.damageEnemy(e, 40 * dt, { type: 'burn', quiet: true, noShroud: true });
          else if (!e.boss) { const a = Math.atan2(e.y - pr.y, e.x - pr.x); e.kx += Math.cos(a) * 30; e.ky += Math.sin(a) * 30; }
        }
      }
      // A brazier takes a moment to catch. Stay beside one you have started, or put bolts into it from wherever you
      // stand; a flare (or burning oil) lights it at once. Left alone half lit, it dies back.
      for (const pr of this.props) {
        if (pr.kind !== 'brazier' || pr.lit) continue;
        const km = p.stats.kindleMul || 1;
        if (pr.casting) {
          if (p.dead || LF.dist2(p.x, p.y, pr.x, pr.y) > 64 * 64) pr.casting = false;
          else {
            pr.kindle = (pr.kindle || 0) + dt * km / 1.3; pr.kindleT = 1.5;
            if (Math.random() < dt * 26) { const k = Math.random(); fx.spawn({ x: p.lx + (pr.x - p.lx) * k, y: p.ly + (pr.y - 8 - p.ly) * k, vx: (pr.x - p.lx) * 1.4, vy: (pr.y - 8 - p.ly) * 1.4, life: 0.3, size: 1.8, color: '#ffcf8a' }); }
            if (Math.random() < dt * 5) LF.audio.play('sizzle');
          }
        }
        for (const b of this.bullets) {
          if (b.dead || LF.dist2(b.x, b.y, pr.x, pr.y - 4) > 14 * 14) continue;
          b.dead = true;
          pr.kindle = (pr.kindle || 0) + (b.minor ? 0.4 : 1) * (b.coal ? 3 : 1) * km * 0.95 / Math.max(1.5, p.stats.fireRate); pr.kindleT = 2.5;
          fx.burst(pr.x, pr.y - 8, 5, { color: ['#ffb347', '#ffe9b8'], speed1: 90, life: 0.35, size: 1.8, grav: -60 });
          LF.audio.play('sizzle');
        }
        if ((pr.kindle || 0) >= 1) { pr.kindle = 0; pr.casting = false; this.lightBrazier(pr); }
        else if (pr.kindle > 0 && !pr.casting) { pr.kindleT -= dt; if (pr.kindleT <= 0) pr.kindle = Math.max(0, pr.kindle - dt * 0.4); }
      }
      // dead wall lamps catch as the lamplighter passes
      for (const pr of this.props) {
        if (pr.kind !== 'lamp' || pr.lit || p.dead) continue;
        if (LF.dist2(p.x, p.y, pr.x, pr.y) < 58 * 58) {
          pr.lit = true; this.litLamps.push(pr); this.stat('lamps'); if (p.stats.lampHeal) p.addLight(p.stats.lampHeal); this.meta.lamps = (this.meta.lamps || 0) + 1;
          fx.burst(pr.x, pr.y - 10, 6, { color: ['#ffd28a', '#fff'], speed1: 60, life: 0.5, grav: -40, size: 1.6 });
          LF.audio.play('ember', 6 + (this.run.lamps % 6));
        }
      }
      // oil jars burst when shot or dashed through
      for (const pr of this.props) {
        if (pr.kind !== 'oiljar' || pr.broken) continue;
        if (p.dashing > 0 && LF.dist2(p.x, p.y, pr.x, pr.y) < 20 * 20) { this.breakJar(pr); continue; }
        for (const b of this.bullets) if (!b.dead && LF.dist2(b.x, b.y, pr.x, pr.y) < 13 * 13) { b.dead = true; this.breakJar(pr); break; }
      }
      // urns shatter when shot or dashed through
      for (const pr of this.props) {
        if (pr.kind !== 'urn' || pr.broken) continue;
        if (p.dashing > 0 && LF.dist2(p.x, p.y, pr.x, pr.y) < 20 * 20) { this.breakUrn(pr); continue; }
        for (const b of this.bullets) if (LF.dist2(b.x, b.y, pr.x, pr.y) < 12 * 12) { this.breakUrn(pr); b.dead = true; break; }
      }

      // interaction prompt
      this.prompt = null;
      if (!p.dead) {
        let best = null, bd = 46 * 46;
        for (const pr of this.props) {
          const d = LF.dist2(p.x, p.y, pr.x, pr.y);
          if (d < bd && this.promptFor(pr)) { bd = d; best = pr; }
        }
        if (best) {
          if (best.kind === 'brazier') this.teach('brazier'); else if (best.kind === 'exit') this.teach('stair');
          this.prompt = { prop: best, text: this.promptFor(best) };
          if (inp.interact) { this.bufInteract = 0; this.interact(best); }
        }
      }

      // timers
      for (const d of this.delays) { d.t -= dt; if (d.t <= 0) { d.dead = true; d.fn(); } }
      LF.compact(this.delays);
      for (const f of this.flashes) { f.life -= dt; if (f.life <= 0) f.dead = true; }
      LF.compact(this.flashes);
      fx.update(dt);
      this.hintT -= dt; this.emberT -= dt; this.glassT -= dt; this.rekindleT = (this.rekindleT || 0) - dt;
      if (Math.random() < dt * 0.22) LF.audio.play('drip');
      this.comboT -= dt; if (this.comboT <= 0) this.combo = 0;

      // camera
      const c = this.cam, cv = this.canvas;
      c.zoom = Math.max(cv.width / 1100, Math.min(cv.height / 600, cv.width / 600)); // pulled back a little: more dark around the light
      let tx = p.x, ty = p.y;
      if (LF.input.mode === 'kbm' && !this.bot) {
        tx += (inp.aimX - cv.width / 2) / c.zoom * 0.14; ty += (inp.aimY - cv.height / 2) / c.zoom * 0.14;
      } else { tx += Math.cos(p.aim) * 26; ty += Math.sin(p.aim) * 26; }
      const k = Math.min(1, dt * 7);
      c.x += (tx - c.x) * k; c.y += (ty - c.y) * k;
      c.sx = (Math.random() - 0.5) * this.shakeAmt; c.sy = (Math.random() - 0.5) * this.shakeAmt;

      const target = this.boss && !this.boss.dead ? 1 : LF.clamp(threat / 7, 0, 0.9);
      LF.audio.intensity += (target - LF.audio.intensity) * Math.min(1, dt * 1.5);
    }
    separate() {
      const E = this.enemies;
      for (let i = 0; i < E.length; i++) {
        const a = E[i];
        if (a.dead || a.spawnT > 0 || a.def.ghost || a.boss) continue;
        for (let j = i + 1; j < E.length; j++) {
          const b = E[j];
          if (b.dead || b.spawnT > 0 || b.def.ghost || b.boss) continue;
          const rr = a.r + b.r, dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
          if (d2 >= rr * rr || d2 < 0.0001) continue;
          const d = Math.sqrt(d2), push = (rr - d) * 0.5;
          const ax = a.def.speed === 0 ? 0 : 1, bx = b.def.speed === 0 ? 0 : 1;
          const nx = dx / d, ny = dy / d;
          // cap the shove so a crowd can never push anyone through a wall in one frame
          const sh = Math.min(push, 6);
          a.x -= nx * sh * ax; a.y -= ny * sh * ax; b.x += nx * sh * bx; b.y += ny * sh * bx;
        }
      }
    }
    // Run the simulation without rendering (used by the automated playtester).
    simulate(seconds, dt = 1 / 60) {
      let t = 0;
      while (t < seconds && this.state === 'play') { this.update(dt); t += dt; }
      return t;
    }
  }
  LF.Game = Game;
})();
