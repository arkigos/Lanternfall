# Lanternfall

A top-down action roguelite for the browser. Your lantern's light is your health, your sight and your weapon.

Vael was built where no sky reaches, under a light its people made: the Great Lantern, hung on a chain from the roof
of the world. Between one bell and the next, the chain broke. It fell through the city, through the catacombs and on into the deep,
and that is the Lanternfall. It broke as it fell, and it is going out. You are the last of the four born to keep
the Vigil, the one flame held back to relight it, following its shards down to where it lies.

**Five Depths.** Nine Levels make a Depth, and each of the first four ends at a shard of the Lantern. A shard is kept for
every descent after: Morning (+25 light, slower burn), the Rites (start with a rite), the Chain (two more
rerolls and one more choice at every stair), the Heart (one free rekindling per descent). Every descent
begins at the top of the first Depth; the deeper ones are reached by carrying on down in the same run. The fifth
Depth ends at the Great Lantern, and you become the ember that lights it.

Nine Levels to a Depth, three biomes, nine bosses, 70 relics, five starting lanterns, vows, a daily seed,
and an endless wave-survival mode (The Long Vigil).

Play it in the browser: https://arkigos.github.io/Lanternfall/
Or open `Lanternfall-standalone.html` in any browser (one file, no server needed).

## Controls

| Action | Keyboard and mouse | Gamepad | Touch |
| --- | --- | --- | --- |
| Move | WASD or arrows | Left stick | Left thumb |
| Aim and fire | Mouse, hold left click | Right stick | Right thumb |
| Dash | Space or Shift | A | DASH button |
| Flare | Right click, Q or F | B | FLARE button |
| Interact | E | X | USE button |
| Map | Tab or M | Back | Tap the minimap |
| Pause | Esc or P | Start | II button |

Settings has an auto-fire option for trackpads.

## The rules in one minute

- The light bar is your health and your sight. It burns down on its own, fast enough that standing around will
  kill you, and every hit gutters it further; the radius falls away quickly as light is lost. At zero you are
  snuffed.
- Full light is not universal light: a full lantern lights a pool about three fifths of the screen's height, and
  nothing raises it past a hard cap. Everything outside it is black apart from eyes, enemy shots and other fires.
- Lingering is punished: after about 85 seconds on a floor the dark sends a Hunter after you, then another every
  42 seconds, four at most. They drop nothing.
- Beside any fire (a lit brazier or a relit wall lamp) the light stops burning down. A brazier also mends you
  slowly, up to half. The burn does not start until the first kill of a descent.
- Light sears: anything standing in your lantern's glow or a flare's afterlight takes steady damage, more the
  fuller your flame. Braziers and wall lamps unshroud but do not burn, unless you hold the Tinderbox relic. Creatures outside the light are **shrouded** and take 40% damage from bolts.
- Fight to heal: every kill restores a little light, and a kill made below 30% restores much more and drops an
  extra ember. Embers refill light and wait on the ground while you are full. Bosses shed an ember for every
  6% of their health you take.
- Enemy shots are black beads with a red rim and cast no light. Warm glows are always yours: embers, braziers,
  your own bolts.
- Braziers: light one for a refill, and rest beside it to recover up to half your light.
- Each stair down offers a relic. Unmake at least 85% of a floor for one extra choice. You start each descent with
  two rerolls.
- **Schools.** Every relic belongs to one of six schools (Spark, Chain, Pyre, Flare, Ember, Wax), named on its
  card. Three relics of one school attune the lantern to it, five and seven attune it further, and the top tiers
  are large (bolt damage more than doubled, fire five times as hot). Enemy health and damage climb steeply with
  depth, so a lantern that takes a little of everything is outscaled: pick a school and fish for it.
- **Defences.** Wax and chain relics let you build a tougher lantern: the Wax Buckler stops blows and shots that
  come from where you are aiming, Wax Skin takes one hit whole after a quiet spell, and the Whirling Chain circles
  you knocking shots out of the air.
- **Rites.** When a boss falls you are offered a rite, a power that changes how you fight: a blade of fire in
  place of bolts, a charged coal, a flare thrown as a lance, a flare that teleports you, a flare that drags
  enemies in first, a dash that burns. One per slot (attack, flare, dash). The Gauntlet and rehearsals open with
  a rite offer too.
- The flare leaves what it touches **kindled** (+60% damage taken for three seconds), bosses included, and rooms
  hold about a quarter more creatures than they used to: it is meant to be needed.
- Some relic pairs form a named synergy with an extra bonus; offer cards say when a pick would complete one.
- Glass buys relics from the Chandler during a run. Cinders are kept after death and spent at the Hearth.
- Dead wall lamps relight as you pass, so explored routes stay softly lit, and each lamp is a small pool of real light
  that unshrouds whatever stands in it and stops your own light burning down. Some rooms have floor hazards on a visible
  warn-then-strike cycle (burst drains, the grasping dark, flame vents).
- Each lantern gains mastery from Levels descended with it over all runs (three ranks: +4% damage and +5 light each).
- Feats (in the Codex) are one-time goals that pay cinders. Lightless vaults, mimics and trials hide on some floors.
- Levels 3, 6 and 9 are bosses, three per Level. After you fell a Level's first boss, its second can appear;
  after you fell the second, its third can appear. The third bosses:
  - The False Light (Level 3): when it dives, the lure with a shadow beneath it is the real one, and the shadow
    only shows inside your light. Break that lure and the beast is dragged up, stunned.
  - The Sexton (Level 6): his blows knock embers out of you, and he heals from any embers he calls in.
  - The First Bearer (Level 9): fights the way you do, and answers each dash and each flare with its own.
- The Long Vigil is a separate mode: one hall, endless waves, a relic every second wave, a champion every fifth.
- The Gauntlet (opens after three boss kills) is six bosses back to back (two drawn from each boss Level), with five relic picks to start.
- Rehearsal: on the Shadows page of the Codex, pick any great shadow (known or not) to fight it alone with a
  short relic draft. Nothing is won or lost, and it does not unlock anything. It is the quickest way to see a
  particular boss.

## Project layout

```
index.html              development page (loads the scripts below one by one)
js/util.js              namespace, maths, seeded RNG
js/input.js             keyboard, mouse, gamepad, touch
js/audio.js             all sound is synthesised with WebAudio; no assets
js/map.js               floor generation, collision, raycasts, flow field
js/fx.js                particles, floating text, lightning arcs
js/relics.js            relics, lanterns, omens, icon drawing
js/entities.js          player, bolts, enemy bullets, pickups
js/enemies.js           the first ten enemy types and shared behaviours
js/enemies2.js          leech, howler, glass shade
js/enemies3.js          ember thief, lamp-breaker
js/bosses.js            Fallen Bell, Mother of Moths, the Eclipse
js/bosses2.js           Chain Warden, Candle King, Hollow Choir
js/bosses3.js           the False Light, the Sexton, the First Bearer
js/render.js            floor art, darkness and ray-cast light, glow pass
js/ui.js                HUD, minimap, every menu
js/game.js              run flow, combat rules, drops, rooms, saves
js/bot.js               autoplay bot: drives the title's demo mode and the headless tests
js/main.js              boot and main loop
tools/build.js          bundles everything into dist/Lanternfall.html and Lanternfall-standalone.html
tools/serve.py          no-cache static server for development
```

## Developing

```bash
python tools/serve.py 8418
```

Then open http://localhost:8418/ . After changes:

```bash
node tools/build.js
```

## Testing with the bot

The game has never been played by a human hand at the time of writing: it was tuned against an autoplay bot.
From the browser console (the bot ships with the game, so this works on any build):

```js
LF.soak(1000, 20)                 // 20 full descents, seeds 1000..1019, with a stall watchdog
LF.soak(1000, 20, { alt: true })  // same, with alternate bosses allowed
LF.playtest({ seed: 7, depth: 6, boss: 'king', relics: ['lens', 'flint'] })
LF.soak(5000, 8, { mode: 'vigil', human: 'average' })   // the wave-survival mode
LF.soak(9500, 8, { mode: 'rush' })                        // the Gauntlet (boss rush)
```

A full descent simulates in well under a second. By default the bot aims perfectly and reacts instantly.
Pass `human: 'novice' | 'average' | 'good'` for aim wobble, reaction lag and missed dodges:

```js
LF.soak(3000, 10, { human: 'novice', diff: 1 })   // diff: 0 Kindled, 1 Standard, 2 Umbral
```

Two more options shape how the bot plays and chooses:

```js
LF.soak(20000, 8, { human: 'good', build: true, style: 'aggressive' })
// style: 'kite' (default: middling range, backs off) | 'aggressive' (arm's length, gives no ground)
//        | 'careful' (maximum range, retreats from anything that approaches) | 'circle' (orbits, never stops)
// build: true makes it take whichever offered relic feeds the school it already holds most of
```

The result's `agg.deaths` lists every death as depth, boss or floor, and the killing blow; `agg.where` counts
boss deaths against floor deaths.

Measured on Standard with no Hearth upgrades (bots dodge bullet patterns worse than people do, so real players
should fare somewhat better):

| Bot | Typical result |
| --- | --- |
| novice | half fall to the Level 3 boss, the rest to the Level 6 boss |
| average | most reach Level 6, about one in ten finishes the first Depth |
| perfect aim | about a third finish the first Depth |

On Kindled the novice bot finishes the first Depth about a third of the time.

## Balance knobs

- `LF.DIFFS` in `js/game.js`: enemy health, enemy damage and light drain per difficulty.
- `enemyHpMul` / `enemyDmgMul` / `bossHpMul` in `Game.loadFloor`: scaling by depth.
- `LF.applySchools` and `LF.SCHOOLS` in `js/relics.js`: what each attunement tier gives.
- `populateRoom` in `js/map.js`: how many creatures a room gets.
- `LF.EMBER` in `js/game.js`: light restored per ember.
- The drain line in `Player.update` (`js/entities.js`): light lost per second away from a fire.
- `sear` in `LF.baseStats()` (`js/relics.js`): damage per second, as a share of bolt damage, that light deals.
- The rekindle amounts in `Game.killEnemy`, the flinch in `Game.hurtPlayer`, the radius curve in `Player.update`.
- Boss `hp` and `dmg` at the top of each boss definition.
