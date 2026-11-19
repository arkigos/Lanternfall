// Lanternfall - the six Depths: eighteen sections of three Levels each, and the great shadow at the end of each.
// A section is what the player walks through on Levels 1-3, 4-6 or 7-9 of a Depth. Each has its own name, colours,
// epigraphs and one thing of its own (its `feature`, worked in js/features.js), and ends at its own great shadow,
// always the same one (LF.BOSS_SLOTS). Depth I keeps the three places the descent began with.
(function () {
  const LF = window.LF;

  // the last Depth, counted from 0 (`loop` in code): the Great Lantern lies at the bottom of it
  LF.LAST_DEPTH = 5;

  // what was the whole of the descent: the first three sections reuse these as they were
  const B = LF.BIOMES;
  const S = (key, name, sub, pal, deco, feature, epi) => Object.assign({ key, name, sub, deco, feature, epi }, pal);
  LF.SECTIONS = [
    // Depth I
    Object.assign(B[0], { key: 'quarter', deco: 0, feature: 'geyser', epi: LF.EPIGRAPHS[0] }),
    Object.assign(B[1], { key: 'catacombs', deco: 1, feature: 'grasp', epi: LF.EPIGRAPHS[1] }),
    Object.assign(B[2], { key: 'deep', deco: 2, feature: 'vent', epi: LF.EPIGRAPHS[2] }),
    // Depth II
    S('sluice', 'The Sluice Works', 'Where the cisterns broke as it passed',
      { floor: [30, 44, 46], wallFace: [40, 62, 64], wallTop: [12, 20, 22], water: [24, 92, 96], accent: '#5fd6c4', ambient: [4, 10, 12], dark: 0.975 }, 0, 'sluice',
      ['The sluices still open and shut on the hour, for no one.', 'Water found the Lantern before anyone else did, and carried word of it down.', 'Every drain in Vael runs one way now: down, after it.']),
    S('ossuary', 'The Ossuary Stair', 'The dead were stacked here to make room for the living',
      { floor: [52, 46, 38], wallFace: [76, 66, 52], wallTop: [24, 20, 15], water: [70, 60, 40], accent: '#e6d3a8', ambient: [10, 8, 5], dark: 0.98 }, 1, 'ossuary',
      ['They stacked their dead into a stair, and the stair goes down.', 'Every skull here faces the same way: toward the fall.', 'The moths nest in the eyes. They like to be near what once looked at light.']),
    S('pendulum', 'The Pendulum Hall', 'Where the great weight swung to keep the chain taut',
      { floor: [44, 34, 28], wallFace: [68, 48, 36], wallTop: [20, 14, 11], water: [80, 44, 30], accent: '#d98a52', ambient: [10, 6, 4], dark: 0.982 }, 2, 'pendulum',
      ['For as long as Vael kept time, the weight swung here, and the Lantern held.', 'The weight should have stopped when the chain went slack. It did not.', 'Fresh grease on the pivots, from the day it fell.']),
    // Depth III
    S('chainworks', 'The Chainworks', 'Where the links of the great chain were forged',
      { floor: [34, 30, 30], wallFace: [52, 44, 42], wallTop: [14, 12, 12], water: [120, 50, 20], accent: '#ff9a3c', ambient: [12, 5, 2], dark: 0.978 }, 0, 'runnel',
      ['Each link was struck and tested by hand. None was ever found wanting.', 'The forges have been cold for an age, but the runnels still run.', 'A spare link lies here, the size of a house. It was never needed.']),
    S('galleries', 'The Wax Galleries', "The chandlers' cellars, where the Lantern's wax was kept",
      { floor: [58, 50, 36], wallFace: [84, 72, 50], wallTop: [26, 22, 14], water: [110, 92, 50], accent: '#ffd98a', ambient: [11, 9, 4], dark: 0.976 }, 1, 'softwax',
      ['Enough wax to feed the Lantern for a hundred years, and no Lantern to feed.', 'The floors are soft. Something warm walks here.', 'Every candle was poured around a name. Some of the names have been scraped out.']),
    S('founders', "The Founders' Pit", 'Where the chain was cast, and where its end came down',
      { floor: [46, 28, 24], wallFace: [70, 40, 32], wallTop: [22, 11, 9], water: [140, 50, 24], accent: '#ff6a3a', ambient: [13, 3, 2], dark: 0.985 }, 2, 'slag',
      ['The moulds are still warm. Someone has been casting.', 'The founders signed every link they made.', 'Slag runs through the dark like slow light.']),
    // Depth IV
    S('lamphall', "The Lamplighters' Hall", 'The hall of the order that tended every light in Vael',
      { floor: [44, 36, 26], wallFace: [70, 56, 38], wallTop: [20, 16, 10], water: [90, 70, 40], accent: '#ffc46b', ambient: [7, 5, 2], dark: 0.99 }, 0, 'lamphall',
      ['A hook by the door for every lamplighter. Most still hold a lamp.', 'Their oath is cut over the hearth: no flame is ever let go.', 'Every lamp here was put out by hand, carefully, one at a time.']),
    S('vaults', 'The Choir Vaults', 'Where the lighting hours were sung',
      { floor: [30, 36, 50], wallFace: [44, 52, 74], wallTop: [12, 15, 24], water: [40, 60, 110], accent: '#8fb4ff', ambient: [4, 6, 14], dark: 0.98 }, 1, 'choir',
      ['Sing softly. Everything down here listens.', 'Echoes arrive before the voice that made them.', 'The hymn of the Vigil names its keepers. There is a verse no one remembers how to sing.']),
    S('archive', 'The Archive of Names', 'Where Vael wrote down everyone who ever carried a light',
      { floor: [42, 40, 30], wallFace: [62, 58, 40], wallTop: [18, 17, 11], water: [60, 70, 50], accent: '#c8d38a', ambient: [7, 7, 4], dark: 0.983 }, 2, 'pages',
      ['Every name in Vael is written here, and the light each one carried.', 'Whole shelves have been emptied, one page at a time.', 'The dust is thinnest on one ledger. Someone still reads it.']),
    // Depth V
    S('hanging', 'The Hanging Streets', 'A city older than Vael, hung upside down beneath it',
      { floor: [40, 34, 48], wallFace: [60, 50, 72], wallTop: [17, 14, 22], water: [70, 50, 100], accent: '#c49cff', ambient: [7, 4, 11], dark: 0.983 }, 0, 'falling',
      ['There was a city here before Vael, and a light before the Lantern.', 'The streets hang from the roof of the cavern. Their lamps point down.', 'Whatever lit this place went out too. No one wrote down why.']),
    S('road', "The Bearers' Road", 'The road the First Bearer took down, long ago',
      { floor: [52, 44, 30], wallFace: [76, 64, 42], wallTop: [22, 18, 11], water: [100, 80, 40], accent: '#ffcf6b', ambient: [9, 7, 3], dark: 0.98 }, 1, 'roadlamps',
      ['Someone lit these lamps on the way down and never came back to put them out.', 'Every milestone counts down to the Lantern.', 'Footprints in the dust, all going one way.']),
    S('sanctum', 'The Unlit Sanctum', 'Where they prayed to the dark',
      { floor: [24, 30, 26], wallFace: [36, 46, 38], wallTop: [9, 12, 10], water: [40, 80, 50], accent: '#8fe08a', ambient: [3, 7, 4], dark: 0.99 }, 2, 'shrine',
      ['Not everyone in Vael loved the light.', 'The shrines are heaped with snuffed wicks, offered one by one.', 'They say they only opened the door.']),
    // Depth VI
    S('glass', 'The Fallen Glass', "The Lantern's lens, broken across a mile of stone",
      { floor: [30, 42, 50], wallFace: [46, 66, 78], wallTop: [12, 18, 24], water: [60, 130, 150], accent: '#bff3ff', ambient: [5, 9, 12], dark: 0.975 }, 0, 'prism',
      ["The Lantern's lens lies here in pieces wider than streets.", 'Light that comes into this place does not leave the way it came.', 'In every shard, your reflection. In some, it is not alone.']),
    S('cinders', 'The Cinder Fields', "Where the Lantern's oil burned out",
      { floor: [40, 36, 36], wallFace: [58, 52, 52], wallTop: [16, 14, 14], water: [90, 40, 30], accent: '#ff7f5a', ambient: [8, 5, 5], dark: 0.986 }, 2, 'ash',
      ['Ash to the knee. It was oil once, and before that, light.', 'The fire here went out slowly, and the dark watched it go.', 'A path has been swept through the ash by someone who carried no light.']),
    S('rest', "The Lantern's Rest", 'Where the Great Lantern came to rest',
      { floor: [42, 34, 22], wallFace: [64, 52, 30], wallTop: [18, 14, 8], water: [130, 100, 40], accent: '#ffe08a', ambient: [9, 7, 2], dark: 0.988 }, 2, 'rest',
      ['It is larger than you thought, and colder than you feared.', 'The last of its light has pooled on the floor like water.', 'Your shadow is waiting for you here.']),
  ];
  // the section of a Level: Depth `loop` (from 0), Level `floor` (1-9)
  LF.sectionAt = (loop, floor) => LF.SECTIONS[Math.min(LF.LAST_DEPTH, Math.max(0, loop | 0)) * 3 + Math.floor((Math.max(1, floor) - 1) / 3)];

  // The great shadow at the end of each section, always the same one. Until a new shadow is built, the one in
  // LF.BOSS_STANDIN stands in its place.
  LF.BOSS_SLOTS = [
    'bell', 'sexton', 'eclipse',
    'angler', 'mother', 'weight',
    'warden', 'king', 'founder',
    'lampeater', 'choir', 'archivist',
    'hound', 'bearer', 'unlit',
    'weeping', 'lastkeeper', 'fifth',
  ];
  LF.BOSS_STANDIN = { weight: 'eclipse', founder: 'choir', lampeater: 'bell', archivist: 'bearer', hound: 'warden', unlit: 'eclipse', weeping: 'angler', lastkeeper: 'king', fifth: 'bearer' };
  LF.bossBuilt = id => !!(LF.ENEMY_DEFS[id] && LF.ENEMY_DEFS[id].boss);
  LF.bossAt = slot => { const id = LF.BOSS_SLOTS[slot]; return LF.bossBuilt(id) ? id : LF.BOSS_STANDIN[id] || 'bell'; };
  // which slot a great shadow keeps (-1 if none), and where that is, for the bestiary
  LF.bossSlot = id => LF.BOSS_SLOTS.indexOf(id);
  LF.bossPlace = id => { const s = LF.bossSlot(id); return s < 0 ? '' : 'Depth ' + LF.ROMAN[Math.floor(s / 3)] + '  ·  Level ' + (s % 3 + 1) * 3; };

  // What each of the first nine shadows knew, said once it falls (Game shows `lore` after the banner). Read in order
  // down the Depths, they lead toward the last one: the chain was cut, and there was a fifth born to the Vigil.
  // The new shadows carry their own lines in js/bosses4-6.js.
  const LORE = {
    bell: 'It rang an hour that was not on any clock, and then it fell.',
    sexton: 'He buried a lamp that no one had carried, under a stone with no name.',
    eclipse: 'It closed around the Lantern as it fell, as if it had been waiting.',
    angler: 'It learned the shape of the Lantern from watching it fall. It never learned why it fell.',
    mother: 'The Moth answers: "Someone climbed the chain that night. They carried no light."',
    warden: 'The Keeper answers: "The chain did not break. Look at the ends."',
    king: 'The Candle answers: "When I was small there were five candles on the altar of the Vigil. Then there were four, and no one would say why."',
    choir: 'Their hymn names the keepers of the Vigil. There is one verse they will not sing.',
    bearer: '"I did not cut it. I only would not give it back."',
  };
  for (const id in LORE) if (LF.ENEMY_DEFS[id] && !LF.ENEMY_DEFS[id].lore) LF.ENEMY_DEFS[id].lore = LORE[id];

  // Each section's one thing of its own. js/features.js fills this in: { populate(map, room, rng, floor),
  // start(g), update(g, dt), draw(ctx, g, pr, x, y, time), glow(ctx, g, pr, x, y, time) } (all optional).
  LF.FEATURES = LF.FEATURES || {};
})();
