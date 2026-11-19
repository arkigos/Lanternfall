'use strict';
// Each section's one thing of its own (see js/sections.js). Depth I's three are the floor hazards in js/map.js and
// js/game.js. A feature may define any of:
//   populate(map, room, rng, floor)   lay out props for one room while the Level is made (props of kind 'feat', with pr.feat = key)
//   start(g)                          once the Level is loaded
//   update(g, dt)                     every frame of play
//   floor(ctx, g, time, inView)       drawn once on the floor, under props and creatures
//   draw(ctx, g, pr, x, y, time)      a 'feat' prop's body;  glow(ctx, g, pr, x, y, time): its glow;  light(lc, white, g, pr): its light
(function () {
  const LF = window.LF;
  LF.FEATURES = LF.FEATURES || {};
})();
