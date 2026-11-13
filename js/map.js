'use strict';
// Dungeon generation, tile queries, collision, raycasts and the flow-field used by enemies.
(function () {
  const TILE = LF.TILE;
  const T = LF.T = { VOID: 0, FLOOR: 1, WATER: 2, WALL: 3, PILLAR: 4 };

  class GameMap {
    constructor(w, h) {
      this.w = w; this.h = h;
      this.tiles = new Uint8Array(w * h);
      this.solid = new Uint8Array(w * h);
      this.gate = new Uint8Array(w * h);      // 1 = closed shadow gate
      this.roomAt = new Int16Array(w * h).fill(-1);
      this.seen = new Uint8Array(w * h);
      this.flow = new Uint16Array(w * h);
      this.variant = new Uint8Array(w * h);   // cosmetic noise per tile
      this.rooms = [];
      this.props = [];
      this.spawns = [];
      this.start = { x: 0, y: 0 };
      this.exit = null;
      this.boss = null;
      this._queue = new Int32Array(w * h);
    }
    idx(x, y) { return y * this.w + x; }
    inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
    get(x, y) { return this.inb(x, y) ? this.tiles[y * this.w + x] : T.VOID; }
    set(x, y, v) { if (this.inb(x, y)) this.tiles[y * this.w + x] = v; }
    solidT(x, y) { return !this.inb(x, y) || this.solid[y * this.w + x] === 1; }
    solidAt(px, py) { return this.solidT(Math.floor(px / TILE), Math.floor(py / TILE)); }
    tileAt(px, py) { return this.get(Math.floor(px / TILE), Math.floor(py / TILE)); }
    waterAt(px, py) { return this.tileAt(px, py) === T.WATER; }
    roomOf(px, py) {
      const x = Math.floor(px / TILE), y = Math.floor(py / TILE);
      if (!this.inb(x, y)) return null;
      const id = this.roomAt[y * this.w + x];
      return id >= 0 ? this.rooms[id] : null;
    }
    rebuildSolid() {
      for (let i = 0; i < this.tiles.length; i++) {
        const t = this.tiles[i];
        this.solid[i] = (t === T.VOID || t === T.WALL || t === T.PILLAR || this.gate[i]) ? 1 : 0;
      }
    }
    sealRoom(room, closed) {
      for (const g of room.gates) {
        const i = this.idx(g.x, g.y);
        this.gate[i] = closed ? 1 : 0;
        this.solid[i] = closed ? 1 : 0;
      }
      room.sealed = closed;
    }

    // DDA raycast against solid tiles; returns distance travelled (<= maxD). dx,dy must be normalized.
    raycast(ox, oy, dx, dy, maxD) {
      let tx = Math.floor(ox / TILE), ty = Math.floor(oy / TILE);
      const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1;
      const tDeltaX = dx !== 0 ? Math.abs(TILE / dx) : Infinity;
      const tDeltaY = dy !== 0 ? Math.abs(TILE / dy) : Infinity;
      let tMaxX = dx !== 0 ? (dx > 0 ? (tx + 1) * TILE - ox : ox - tx * TILE) / Math.abs(dx) : Infinity;
      let tMaxY = dy !== 0 ? (dy > 0 ? (ty + 1) * TILE - oy : oy - ty * TILE) / Math.abs(dy) : Infinity;
      let t = 0;
      for (let guard = 0; guard < 256; guard++) {
        if (tMaxX < tMaxY) { t = tMaxX; tMaxX += tDeltaX; tx += stepX; }
        else { t = tMaxY; tMaxY += tDeltaY; ty += stepY; }
        if (t >= maxD) return maxD;
        if (this.solidT(tx, ty)) return t;
      }
      return maxD;
    }
    los(x0, y0, x1, y1) {
      const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy);
      if (d < 1) return true;
      return this.raycast(x0, y0, dx / d, dy / d, d) >= d - 0.01;
    }
    // Visibility polygon around a point: array of [x,y] pairs flattened. `over` lets light spill onto wall faces.
    visPoly(ox, oy, radius, rays, over) {
      const out = new Float32Array(rays * 2);
      for (let i = 0; i < rays; i++) {
        const a = i / rays * LF.TAU, dx = Math.cos(a), dy = Math.sin(a);
        let d = this.raycast(ox, oy, dx, dy, radius);
        if (d < radius) d = Math.min(radius, d + over);
        out[i * 2] = ox + dx * d; out[i * 2 + 1] = oy + dy * d;
      }
      return out;
    }

    // Push a circle out of solid tiles. Returns true if it touched anything.
    resolveCircle(e, r) {
      let hit = false;
      for (let iter = 0; iter < 2; iter++) {
        const x0 = Math.floor((e.x - r) / TILE), x1 = Math.floor((e.x + r) / TILE);
        const y0 = Math.floor((e.y - r) / TILE), y1 = Math.floor((e.y + r) / TILE);
        for (let ty = y0; ty <= y1; ty++) {
          for (let tx = x0; tx <= x1; tx++) {
            if (!this.solidT(tx, ty)) continue;
            const cx = LF.clamp(e.x, tx * TILE, tx * TILE + TILE), cy = LF.clamp(e.y, ty * TILE, ty * TILE + TILE);
            let dx = e.x - cx, dy = e.y - cy;
            const d2 = dx * dx + dy * dy;
            if (d2 >= r * r) continue;
            hit = true;
            if (d2 > 0.0001) {
              const d = Math.sqrt(d2), push = r - d;
              e.x += dx / d * push; e.y += dy / d * push;
              e.hitNx = dx / d; e.hitNy = dy / d;
            } else {
              // centre is inside the tile: push out along the shallowest axis
              const BIG = 1e9;
              const l = this.solidT(tx - 1, ty) ? BIG : e.x - tx * TILE, rr = this.solidT(tx + 1, ty) ? BIG : tx * TILE + TILE - e.x;
              const u = this.solidT(tx, ty - 1) ? BIG : e.y - ty * TILE, dn = this.solidT(tx, ty + 1) ? BIG : ty * TILE + TILE - e.y;
              const m = Math.min(l, rr, u, dn);
              if (m >= BIG) continue; // buried on every side: the rescue pass will move it
              if (m === l) { e.x = tx * TILE - r; e.hitNx = -1; e.hitNy = 0; }
              else if (m === rr) { e.x = tx * TILE + TILE + r; e.hitNx = 1; e.hitNy = 0; }
              else if (m === u) { e.y = ty * TILE - r; e.hitNx = 0; e.hitNy = -1; }
              else { e.y = ty * TILE + TILE + r; e.hitNx = 0; e.hitNy = 1; }
            }
          }
        }
      }
      return hit;
    }

    // BFS distance field from a pixel position (the player). 65535 = unreachable.
    computeFlow(px, py) {
      const w = this.w, h = this.h, flow = this.flow, q = this._queue, solid = this.solid;
      flow.fill(65535);
      const sx = Math.floor(px / TILE), sy = Math.floor(py / TILE);
      if (!this.inb(sx, sy)) return;
      let head = 0, tail = 0;
      const s = sy * w + sx;
      flow[s] = 0; q[tail++] = s;
      while (head < tail) {
        const i = q[head++], d = flow[i] + 1, x = i % w, y = (i - x) / w;
        if (x > 0 && !solid[i - 1] && flow[i - 1] === 65535) { flow[i - 1] = d; q[tail++] = i - 1; }
        if (x < w - 1 && !solid[i + 1] && flow[i + 1] === 65535) { flow[i + 1] = d; q[tail++] = i + 1; }
        if (y > 0 && !solid[i - w] && flow[i - w] === 65535) { flow[i - w] = d; q[tail++] = i - w; }
        if (y < h - 1 && !solid[i + w] && flow[i + w] === 65535) { flow[i + w] = d; q[tail++] = i + w; }
      }
    }
    flowDist(px, py) {
      const x = Math.floor(px / TILE), y = Math.floor(py / TILE);
      return this.inb(x, y) ? this.flow[y * this.w + x] : 65535;
    }
    // Unit direction that walks down the distance field from a pixel position, or null.
    flowDir(px, py, out) {
      const x = Math.floor(px / TILE), y = Math.floor(py / TILE);
      if (!this.inb(x, y)) return null;
      const w = this.w, flow = this.flow;
      let best = flow[y * w + x], bx = 0, by = 0;
      if (best === 65535) best = 65534;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          if (!ox && !oy) continue;
          const nx = x + ox, ny = y + oy;
          if (!this.inb(nx, ny)) continue;
          if (ox && oy && (this.solid[y * w + nx] || this.solid[ny * w + x])) continue; // no corner cutting
          const d = flow[ny * w + nx];
          if (d < best) { best = d; bx = ox; by = oy; }
        }
      }
      if (!bx && !by) return null;
      const tx = (x + bx + 0.5) * TILE - px, ty = (y + by + 0.5) * TILE - py, l = Math.hypot(tx, ty) || 1;
      out.x = tx / l; out.y = ty / l;
      return out;
    }

    // Find a walkable pixel position in a room, away from pillars and (optionally) from a point.
    randomSpot(room, rng, margin = 1, avoid, avoidDist = 0) {
      for (let tries = 0; tries < 60; tries++) {
        const tx = rng.int(room.x + margin, room.x + room.w - 1 - margin);
        const ty = rng.int(room.y + margin, room.y + room.h - 1 - margin);
        if (this.solidT(tx, ty)) continue;
        const px = (tx + 0.5) * TILE, py = (ty + 0.5) * TILE;
        if (avoid && LF.dist(px, py, avoid.x, avoid.y) < avoidDist) continue;
        return { x: px, y: py };
      }
      return { x: room.cx * TILE, y: room.cy * TILE };
    }
    // Put an entity whose centre is inside solid ground (or outside the map) back on the nearest open floor.
    rescue(e) {
      if (!this.solidAt(e.x, e.y)) return false;
      const cx = LF.clamp(e.x, TILE * 1.5, (this.w - 1.5) * TILE), cy = LF.clamp(e.y, TILE * 1.5, (this.h - 1.5) * TILE);
      const x = Math.floor(cx / TILE), y = Math.floor(cy / TILE);
      for (let r = 0; r < Math.max(this.w, this.h); r++) {
        for (let oy = -r; oy <= r; oy++) for (let ox = -r; ox <= r; ox++) {
          if (Math.max(Math.abs(ox), Math.abs(oy)) !== r) continue;
          if (!this.solidT(x + ox, y + oy)) { e.x = (x + ox + 0.5) * TILE; e.y = (y + oy + 0.5) * TILE; return true; }
        }
      }
      return false;
    }
    // Nearest walkable pixel position to a point (spiral search).
    nearestOpen(px, py) {
      const x = Math.floor(px / TILE), y = Math.floor(py / TILE);
      for (let r = 0; r < 12; r++) {
        for (let oy = -r; oy <= r; oy++) for (let ox = -r; ox <= r; ox++) {
          if (Math.max(Math.abs(ox), Math.abs(oy)) !== r) continue;
          if (!this.solidT(x + ox, y + oy)) return { x: (x + ox + 0.5) * TILE, y: (y + oy + 0.5) * TILE };
        }
      }
      return { x: px, y: py };
    }
    markSeen(px, py, radius) {
      const x0 = Math.max(0, Math.floor((px - radius) / TILE)), x1 = Math.min(this.w - 1, Math.floor((px + radius) / TILE));
      const y0 = Math.max(0, Math.floor((py - radius) / TILE)), y1 = Math.min(this.h - 1, Math.floor((py + radius) / TILE));
      const r2 = radius * radius;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const cx = (x + 0.5) * TILE - px, cy = (y + 0.5) * TILE - py;
        if (cx * cx + cy * cy <= r2) this.seen[y * this.w + x] = 1;
      }
    }
    revealAll() { for (let i = 0; i < this.tiles.length; i++) if (this.tiles[i] !== T.VOID) this.seen[i] = 1; }
  }
  LF.GameMap = GameMap;

  // ---------- generation ----------
  function carveRoom(map, room) {
    for (let y = room.y; y < room.y + room.h; y++) for (let x = room.x; x < room.x + room.w; x++) {
      map.set(x, y, T.FLOOR);
      map.roomAt[map.idx(x, y)] = room.id;
    }
  }
  function carveCorridor(map, ax, ay, bx, by, rng, width) {
    const half = Math.floor(width / 2);
    const dig = (x, y) => {
      for (let oy = -half; oy <= half; oy++) for (let ox = -half; ox <= half; ox++) {
        const nx = x + ox, ny = y + oy;
        if (nx < 1 || ny < 1 || nx >= map.w - 1 || ny >= map.h - 1) continue;
        if (map.get(nx, ny) === T.VOID) map.set(nx, ny, T.FLOOR);
      }
    };
    let x = ax, y = ay;
    const horizFirst = rng.chance(0.5);
    const walkX = () => { while (x !== bx) { dig(x, y); x += Math.sign(bx - x); } };
    const walkY = () => { while (y !== by) { dig(x, y); y += Math.sign(by - y); } };
    if (horizFirst) { walkX(); walkY(); } else { walkY(); walkX(); }
    dig(x, y);
  }

  function decorateRoom(map, room, rng, floor) {
    const { x, y, w, h } = room;
    const P = (tx, ty) => { if (tx >= x + 2 && ty >= y + 2 && tx < x + w - 2 && ty < y + h - 2) map.set(tx, ty, T.PILLAR); };
    const W = (tx, ty) => { if (tx >= x && ty >= y && tx < x + w && ty < y + h && map.get(tx, ty) === T.FLOOR) map.set(tx, ty, T.WATER); };
    const cx = Math.floor(x + w / 2), cy = Math.floor(y + h / 2);
    const pool = (px, py, rx, ry) => {
      for (let ty = Math.floor(py - ry); ty <= py + ry; ty++) for (let tx = Math.floor(px - rx); tx <= px + rx; tx++) {
        const nx = (tx - px) / rx, ny = (ty - py) / ry;
        if (nx * nx + ny * ny <= 1 + rng.range(-0.15, 0.15)) W(tx, ty);
      }
    };
    let pats;
    if (room.type === 'start' || room.type === 'shop' || room.type === 'shrine' || room.type === 'statue' || room.type === 'trial' || room.type === 'vault') pats = ['none', 'corners'];
    else if (room.type === 'treasure') pats = ['corners', 'none', 'ring'];
    else if (room.type === 'exit') pats = ['corners', 'rows', 'none'];
    else pats = ['none', 'corners', 'center', 'rows', 'pool', 'scatter', 'flooded', 'cross', 'pool', 'scatter'];
    const pat = rng.pick(pats);
    room.pattern = pat;
    switch (pat) {
      case 'corners':
        P(x + 2, y + 2); P(x + w - 3, y + 2); P(x + 2, y + h - 3); P(x + w - 3, y + h - 3); break;
      case 'center':
        if (w >= 9 && h >= 8) { P(cx, cy); P(cx - 1, cy); P(cx, cy - 1); P(cx - 1, cy - 1); } break;
      case 'rows':
        for (let tx = x + 2; tx < x + w - 2; tx += 3) { P(tx, y + 2); P(tx, y + h - 3); } break;
      case 'pool':
        pool(cx + rng.range(-1, 1), cy + rng.range(-1, 1), w * rng.range(0.2, 0.32), h * rng.range(0.2, 0.32)); break;
      case 'scatter': {
        const n = rng.int(3, 6);
        for (let i = 0; i < n; i++) P(rng.int(x + 2, x + w - 3), rng.int(y + 2, y + h - 3));
        break;
      }
      case 'flooded': {
        const n = rng.int(2, 4);
        for (let i = 0; i < n; i++) pool(rng.int(x + 1, x + w - 2), rng.int(y + 1, y + h - 2), rng.range(2, 4), rng.range(1.5, 3));
        break;
      }
      case 'cross':
        if (w >= 11 && h >= 9) { for (let i = -1; i <= 1; i++) { if (i !== 0) { P(cx + i * 2, cy); P(cx, cy + i * 2); } } P(cx, cy); }
        break;
      case 'ring':
        if (w >= 9 && h >= 9) { P(cx - 2, cy - 2); P(cx + 2, cy - 2); P(cx - 2, cy + 2); P(cx + 2, cy + 2); }
        break;
    }
  }

  function finishWalls(map, rng) {
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      map.variant[map.idx(x, y)] = rng.int(0, 255);
      if (map.get(x, y) !== T.VOID) continue;
      let near = false;
      for (let oy = -1; oy <= 1 && !near; oy++) for (let ox = -1; ox <= 1; ox++) {
        const t = map.get(x + ox, y + oy);
        if (t === T.FLOOR || t === T.WATER) { near = true; break; }
      }
      if (near) map.set(x, y, T.WALL);
    }
  }
  function findGates(map, room) {
    room.gates = [];
    const add = (x, y) => { const t = map.get(x, y); if (t === T.FLOOR || t === T.WATER) room.gates.push({ x, y }); };
    for (let x = room.x - 1; x <= room.x + room.w; x++) { add(x, room.y - 1); add(x, room.y + room.h); }
    for (let y = room.y; y < room.y + room.h; y++) { add(room.x - 1, y); add(room.x + room.w, y); }
  }

  // Which enemies can appear on which floor, and what they cost from the room budget.
  const ROSTER = [
    { type: 'skitter', min: 1, cost: 1, w: 10 },
    { type: 'moth', min: 1, cost: 0.55, w: 5, pack: [3, 5] },
    { type: 'lurker', min: 1, cost: 2, w: 5 },
    { type: 'spitter', min: 2, cost: 2, w: 6 },
    { type: 'bloat', min: 2, cost: 2.4, w: 3 },
    { type: 'bulwark', min: 4, cost: 4, w: 4 },
    { type: 'brood', min: 4, cost: 4, w: 2.5 },
    { type: 'wraith', min: 5, cost: 3, w: 4 },
    { type: 'snuffer', min: 7, cost: 3.5, w: 3 },
    { type: 'weaver', min: 7, cost: 3.5, w: 3 },
    { type: 'leech', min: 2, cost: 0.8, w: 4, pack: [2, 3] },
    { type: 'howler', min: 4, cost: 3, w: 2.5 },
    { type: 'glass', min: 7, cost: 3, w: 3.5 },
    { type: 'thief', min: 3, cost: 1.5, w: 3 },
    { type: 'breaker', min: 5, cost: 3, w: 2.5 },
  ];
  LF.ROSTER = ROSTER;

  let GEN = {};
  function populateRoom(map, room, rng, floor, mult, loop) {
    const area = room.w * room.h, om = GEN.omen;
    // rooms hold enough that a crowd can close around you: the flare is how you break out
    let budget = 1.34 * (3.1 + floor * 1.2 + loop * 6) * (area / 100) * rng.range(0.85, 1.2) * mult;
    if (om === 'swarm') budget *= 1.35; else if (om === 'still') budget *= 0.4;
    budget = Math.max(budget, om === 'still' ? 1 : 2);
    let options = ROSTER.filter(r => r.min <= floor + loop * 9);
    if (om === 'swarm') options = options.filter(r => r.cost <= 2);
    const avoid = { x: map.start.x, y: map.start.y };
    let guard = 0, heavy = 0;
    while (budget > 0.5 && guard++ < 60) {
      const affordable = options.filter(r => r.cost <= budget + 0.5);
      if (!affordable.length) break;
      const pickR = rng.weighted(affordable, r => r.w * (r.min >= floor - 1 ? 1.4 : 1));
      if (pickR.type === 'brood' && heavy >= 1) continue;
      if ((pickR.type === 'howler' || pickR.type === 'snuffer' || pickR.type === 'breaker') && heavy >= 1) continue;
      if (pickR.type === 'brood' || pickR.type === 'snuffer' || pickR.type === 'howler' || pickR.type === 'breaker') heavy++;
      const n = pickR.pack ? rng.int(pickR.pack[0], pickR.pack[1]) : 1;
      const base = map.randomSpot(room, rng, 1, avoid, 200);
      const eliteChance = floor >= 2 ? Math.min(0.03 + floor * 0.012 + loop * 0.08 + (om === 'gilded' ? 0.1 : 0), 0.3) : 0;
      for (let i = 0; i < n; i++) {
        const sp = n > 1 ? { x: base.x + rng.range(-24, 24), y: base.y + rng.range(-24, 24) } : base;
        const open = map.solidAt(sp.x, sp.y) ? map.nearestOpen(sp.x, sp.y) : sp;
        const elite = !pickR.pack && pickR.type !== 'brood' && rng.chance(eliteChance);
        map.spawns.push({ type: pickR.type, x: open.x, y: open.y, room: room.id, elite, wave: 0 });
        budget -= pickR.cost * (elite ? 2 : 1);
      }
    }
  }

  LF.generateFloor = function (floor, seed, opts = {}) {
    const rng = new LF.RNG(seed);
    const loop = opts.loop || 0;
    GEN = { omen: opts.omen || null };
    if (floor % 3 === 0) return generateBossFloor(floor, rng, loop, opts);

    const W = Math.min(60 + floor * 3, 84), H = Math.min(44 + floor * 2, 60);
    const map = new GameMap(W, H);
    map.floor = floor; map.seed = seed;
    const target = Math.min(7 + floor, 14);

    // 1. rooms
    for (let attempt = 0; attempt < 400 && map.rooms.length < target; attempt++) {
      const w = rng.int(9, 15), h = rng.int(8, 12);
      const x = rng.int(3, W - w - 4), y = rng.int(3, H - h - 4);
      let ok = true;
      for (const r of map.rooms) {
        if (x < r.x + r.w + 4 && x + w + 4 > r.x && y < r.y + r.h + 4 && y + h + 4 > r.y) { ok = false; break; }
      }
      if (!ok) continue;
      const room = { id: map.rooms.length, x, y, w, h, cx: x + w / 2, cy: y + h / 2, type: 'normal', links: [], gates: [], sealed: false, cleared: false, visited: false, alive: 0 };
      map.rooms.push(room);
      carveRoom(map, room);
    }
    const rooms = map.rooms, n = rooms.length;

    // 2. connect: MST (Prim) + a few loops
    const inTree = new Array(n).fill(false); inTree[0] = true;
    const edges = [];
    for (let k = 1; k < n; k++) {
      let best = null, bd = Infinity;
      for (let a = 0; a < n; a++) if (inTree[a]) for (let b = 0; b < n; b++) if (!inTree[b]) {
        const d = LF.dist(rooms[a].cx, rooms[a].cy, rooms[b].cx, rooms[b].cy);
        if (d < bd) { bd = d; best = [a, b]; }
      }
      inTree[best[1]] = true; edges.push(best);
    }
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
      if (edges.some(e => (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a))) continue;
      const d = LF.dist(rooms[a].cx, rooms[a].cy, rooms[b].cx, rooms[b].cy);
      if (d < 24 && rng.chance(0.3)) edges.push([a, b]);
    }
    for (const [a, b] of edges) {
      rooms[a].links.push(b); rooms[b].links.push(a);
      carveCorridor(map, Math.floor(rooms[a].cx), Math.floor(rooms[a].cy), Math.floor(rooms[b].cx), Math.floor(rooms[b].cy), rng, 3);
    }

    // 3. roles: start = a leaf if possible, exit = farthest by graph distance
    const leaves = rooms.filter(r => r.links.length === 1);
    const startRoom = leaves.length ? rng.pick(leaves) : rooms[0];
    const gd = new Array(n).fill(-1); gd[startRoom.id] = 0;
    const q = [startRoom.id];
    while (q.length) { const a = q.shift(); for (const b of rooms[a].links) if (gd[b] < 0) { gd[b] = gd[a] + 1; q.push(b); } }
    rooms.forEach(r => r.depth = gd[r.id]);
    let exitRoom = rooms[0], far = -1;
    for (const r of rooms) {
      const score = gd[r.id] * 100 + LF.dist(r.cx, r.cy, startRoom.cx, startRoom.cy);
      if (r !== startRoom && score > far) { far = score; exitRoom = r; }
    }
    startRoom.type = 'start'; exitRoom.type = 'exit';
    const free = rng.shuffle(rooms.filter(r => r.type === 'normal'));
    free.sort((a, b) => a.links.length - b.links.length); // dead ends first for special rooms
    const take = () => free.shift();
    if (free.length) take().type = 'treasure';
    if (floor !== 1 && free.length) take().type = 'shop';
    if (free.length > 3 && rng.chance(0.75)) take().type = 'shrine';
    if (floor >= 2 && free.length > 4 && rng.chance(0.5)) take().type = 'trial';
    if (floor >= 2 && free.length > 4 && rng.chance(0.38)) take().type = 'statue';
    if (free.length > 5 && floor >= 4) take().type = 'treasure';
    if (GEN.omen === 'gilded' && free.length > 2) take().type = 'treasure';
    if (floor >= 2 && free.length > 4 && rng.chance(0.4)) take().type = 'vault';
    for (const r of free) if (rng.chance(0.38)) r.type = 'ambush';

    map.start = { x: startRoom.cx * TILE, y: startRoom.cy * TILE };

    // 4. decoration, walls, gates
    for (const r of rooms) decorateRoom(map, r, rng, floor);
    if (GEN.omen === 'flooded' || GEN.omen === 'tide') {
      for (let i = 0; i < 46; i++) {
        const cx = rng.int(3, W - 4), cy = rng.int(3, H - 4), rx = rng.range(1.5, 4), ry = rng.range(1.5, 3.2);
        for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
          const nx = (x - cx) / rx, ny = (y - cy) / ry;
          if (nx * nx + ny * ny <= 1 && map.get(x, y) === T.FLOOR) map.set(x, y, T.WATER);
        }
      }
    }
    // stray puddles in corridors
    for (let i = 0; i < 26; i++) {
      const x = rng.int(2, W - 3), y = rng.int(2, H - 3);
      if (map.get(x, y) === T.FLOOR && map.roomAt[map.idx(x, y)] < 0) {
        map.set(x, y, T.WATER);
        if (rng.chance(0.6) && map.get(x + 1, y) === T.FLOOR && map.roomAt[map.idx(x + 1, y)] < 0) map.set(x + 1, y, T.WATER);
        if (rng.chance(0.6) && map.get(x, y + 1) === T.FLOOR && map.roomAt[map.idx(x, y + 1)] < 0) map.set(x, y + 1, T.WATER);
      }
    }
    finishWalls(map, rng);
    map.rebuildSolid();
    // Decoration can wall off a tile or two with pillars. Anything the start cannot reach becomes solid,
    // so nothing can spawn, hide or get stranded there (a stranded creature would keep an ambush sealed forever).
    map.computeFlow(map.start.x, map.start.y);
    let filled = 0;
    for (let i = 0; i < map.tiles.length; i++) if (!map.solid[i] && map.flow[i] === 65535) { map.tiles[i] = T.PILLAR; filled++; }
    if (filled) map.rebuildSolid();
    for (const r of rooms) {
      let open = 0;
      for (let y = r.y; y < r.y + r.h && !open; y++) for (let x = r.x; x < r.x + r.w; x++) if (!map.solid[map.idx(x, y)]) { open = 1; break; }
      if (!open && (opts._try || 0) < 6) return LF.generateFloor(floor, seed + 7717, Object.assign({}, opts, { _try: (opts._try || 0) + 1 }));
    }
    for (const r of rooms) findGates(map, r);

    // 5. props + spawns
    const centre = r => { const p = map.nearestOpen(r.cx * TILE, r.cy * TILE); return p; };
    map.props.push({ kind: 'brazier', x: map.start.x + 64, y: map.start.y - 40, lit: true, room: startRoom.id });
    for (const r of rooms) {
      const c = centre(r);
      if (r.type === 'exit') {
        map.exit = { x: c.x, y: c.y };
        map.props.push({ kind: 'exit', x: c.x, y: c.y, room: r.id, open: true });
        populateRoom(map, r, rng, floor, 1.5, loop);
        // a guaranteed elite guards the way down from floor 2
        if (floor >= 2) {
          const opts2 = ROSTER.filter(o => o.min <= floor && !o.pack && o.type !== 'brood');
          const sp = map.randomSpot(r, rng, 2, c, 60);
          map.spawns.push({ type: rng.pick(opts2).type, x: sp.x, y: sp.y, room: r.id, elite: true, wave: 0 });
        }
      } else if (r.type === 'vault') {
        map.props.push({ kind: 'chest', x: c.x, y: c.y, room: r.id, opened: false, locked: true, rare: floor >= 6 });
        for (const side of [-1, 1]) {
          const bp = map.nearestOpen(c.x + side * 3 * TILE, c.y);
          map.props.push({ kind: 'brazier', x: bp.x, y: bp.y, lit: false, room: r.id, vault: true });
        }
        populateRoom(map, r, rng, floor, 0.9, loop);
      } else if (r.type === 'treasure') {
        map.props.push({ kind: 'chest', x: c.x, y: c.y, room: r.id, opened: false, mimic: floor >= 2 && rng.chance(0.15) });
        if (rng.chance(0.6)) populateRoom(map, r, rng, floor, 0.8, loop);
      } else if (r.type === 'shop') {
        map.props.push({ kind: 'shopkeeper', x: c.x, y: c.y - 56, room: r.id });
        for (let i = 0; i < 3; i++) map.props.push({ kind: 'pedestal', x: c.x + (i - 1) * 72, y: c.y + 24, room: r.id, slot: i, sold: false });
        map.props.push({ kind: 'brazier', x: c.x - 110, y: c.y - 56, lit: true, room: r.id });
        map.props.push({ kind: 'brazier', x: c.x + 110, y: c.y - 56, lit: true, room: r.id });
      } else if (r.type === 'shrine') {
        map.props.push({ kind: 'shrine', x: c.x, y: c.y, room: r.id, used: false });
      } else if (r.type === 'statue') {
        map.props.push({ kind: 'statue', x: c.x, y: c.y, room: r.id, used: false });
      } else if (r.type === 'trial') {
        map.props.push({ kind: 'trial', x: c.x, y: c.y, room: r.id, used: false });
        for (let w = 0; w < 3; w++) {
          const before = map.spawns.length;
          populateRoom(map, r, rng, floor, 0.8 + w * 0.2, loop);
          for (let i = before; i < map.spawns.length; i++) { map.spawns[i].wave = w; map.spawns[i].optional = true; }
        }
        const eo = ROSTER.filter(o => o.min <= floor && !o.pack && o.type !== 'brood');
        const esp = map.randomSpot(r, rng, 2, c, 70);
        map.spawns.push({ type: rng.pick(eo).type, x: esp.x, y: esp.y, room: r.id, elite: true, wave: 2, optional: true });
      } else if (r.type === 'normal' || r.type === 'ambush') {
        populateRoom(map, r, rng, floor, r.type === 'ambush' ? 1.0 : 1, loop);
        if (r.type === 'ambush') {
          // second wave appears when the first is dead
          const before = map.spawns.length;
          populateRoom(map, r, rng, floor, 0.8, loop);
          for (let i = before; i < map.spawns.length; i++) map.spawns[i].wave = 1;
        }
        if (rng.chance(GEN.omen === 'still' ? 0.9 : 0.45)) {
          const sp = map.randomSpot(r, rng, 2);
          map.props.push({ kind: 'brazier', x: sp.x, y: sp.y, lit: false, room: r.id });
        }
        if (floor >= 2 && rng.chance(0.3)) {
          // floor hazards on a visible cycle, by biome: burst drains, the grasping dark, ruptured lamp-oil mains
          const sub = floor <= 3 ? 'geyser' : floor <= 6 ? 'grasp' : 'vent', nt = rng.int(2, 4);
          for (let j = 0; j < nt; j++) {
            const sp = map.randomSpot(r, rng, 2, { x: r.cx * TILE, y: r.cy * TILE }, 40);
            map.props.push({ kind: 'trap', sub, x: sp.x, y: sp.y, room: r.id, phase: rng.range(0, 4), period: sub === 'vent' ? 4.2 : 3.6 });
          }
        }
        if (rng.chance(0.34)) {
          const nj = rng.int(1, 3), base = map.randomSpot(r, rng, 2);
          for (let j = 0; j < nj; j++) {
            const jx = base.x + (j ? rng.range(-34, 34) : 0), jy = base.y + (j ? rng.range(-34, 34) : 0);
            if (!map.solidAt(jx, jy)) map.props.push({ kind: 'oiljar', x: jx, y: jy, room: r.id });
          }
        }
        if (rng.chance(0.3)) {
          const sp = map.randomSpot(r, rng, 1);
          map.props.push({ kind: 'urn', x: sp.x, y: sp.y, room: r.id });
          if (rng.chance(0.5)) { const s2 = map.randomSpot(r, rng, 1); map.props.push({ kind: 'urn', x: s2.x, y: s2.y, room: r.id }); }
        }
      }
    }
    // props must not sit inside pillars
    for (const p of map.props) if (map.solidAt(p.x, p.y)) { const o = map.nearestOpen(p.x, p.y); p.x = o.x; p.y = o.y; }
    // Wall lamps: dead sconces on north walls. The lamplighter relights them just by passing,
    // so the explored route stays softly lit.
    const lamps = [];
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
      const t = map.get(x, y);
      if ((t !== T.FLOOR && t !== T.WATER) || map.get(x, y - 1) !== T.WALL) continue;
      if (!rng.chance(0.3)) continue;
      const lx = (x + 0.5) * TILE, ly = y * TILE + 3;
      let near = false;
      for (const l of lamps) if (LF.dist2(l.x, l.y, lx, ly) < 170 * 170) { near = true; break; }
      if (!near) lamps.push({ kind: 'lamp', x: lx, y: ly, lit: false, room: map.roomAt[map.idx(x, y)] });
    }
    for (const l of lamps) map.props.push(l);
    return map;
  };

  // One large hall for the endless Vigil mode.
  LF.generateArena = function (seed) {
    const rng = new LF.RNG(seed);
    const W = 44, H = 34;
    const map = new GameMap(W, H);
    map.floor = 1; map.seed = seed;
    const room = { id: 0, x: 6, y: 5, w: 32, h: 24, type: 'vigil', links: [], gates: [], sealed: false, cleared: false, visited: true, alive: 0 };
    room.cx = room.x + room.w / 2; room.cy = room.y + room.h / 2;
    map.rooms.push(room); carveRoom(map, room);
    for (const [px, py] of [[7, 6], [24, 6], [7, 17], [24, 17], [15, 3], [16, 20], [3, 11], [28, 12]]) map.set(room.x + px, room.y + py, T.PILLAR);
    for (const [cx, cy, rx, ry] of [[room.x + 6, room.y + 19, 3.5, 2.4], [room.x + 26, room.y + 4, 3.2, 2.2]]) {
      for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const nx = (x - cx) / rx, ny = (y - cy) / ry;
        if (nx * nx + ny * ny <= 1 + rng.range(-0.12, 0.12) && map.get(x, y) === T.FLOOR) map.set(x, y, T.WATER);
      }
    }
    finishWalls(map, rng);
    map.rebuildSolid();
    findGates(map, room);
    const cx = room.cx * TILE, cy = room.cy * TILE;
    map.start = { x: cx, y: cy + 3 * TILE };
    map.exit = { x: cx, y: cy };
    map.props.push({ kind: 'brazier', x: cx, y: cy, lit: true, room: 0 });
    for (const [ox, oy] of [[4, 4], [room.w - 5, 4], [4, room.h - 5], [room.w - 5, room.h - 5]]) map.props.push({ kind: 'brazier', x: (room.x + ox + 0.5) * TILE, y: (room.y + oy + 0.5) * TILE, lit: false, room: 0 });
    for (let i = 0; i < 5; i++) { const sp = map.randomSpot(room, rng, 2, map.start, 120); map.props.push({ kind: i < 3 ? 'oiljar' : 'urn', x: sp.x, y: sp.y, room: 0 }); }
    return map;
  };

  function generateBossFloor(floor, rng, loop, opts) {
    const W = 46, H = 50;
    const map = new GameMap(W, H);
    map.floor = floor;
    const arena = { id: 0, x: 9, y: 5, w: 28, h: 22, type: 'boss', links: [1], gates: [], sealed: false, cleared: false, visited: false, alive: 0 };
    const ante = { id: 1, x: 17, y: 36, w: 12, h: 9, type: 'start', links: [0], gates: [], sealed: false, cleared: true, visited: false, alive: 0 };
    for (const r of [arena, ante]) { r.cx = r.x + r.w / 2; r.cy = r.y + r.h / 2; map.rooms.push(r); carveRoom(map, r); }
    carveCorridor(map, Math.floor(ante.cx), Math.floor(ante.cy), Math.floor(arena.cx), Math.floor(arena.cy), rng, 3);
    // arena pillars (symmetric)
    const tier = floor / 3;
    const pil = tier === 1 ? [[5, 5], [5, 16], [22, 5], [22, 16]] : tier === 2 ? [[6, 6], [21, 6], [6, 15], [21, 15], [13, 4], [14, 17]] : [[4, 4], [23, 4], [4, 17], [23, 17], [9, 10], [18, 10]];
    for (const [px, py] of pil) { map.set(arena.x + px, arena.y + py, T.PILLAR); if (tier !== 2) map.set(arena.x + px + (px < 14 ? 0 : 0), arena.y + py + 1, T.PILLAR); }
    if (tier === 1) {
      // the Fallen Bell's hall lies under a burst cistern
      for (let y = arena.y; y < arena.y + arena.h; y++) for (let x = arena.x; x < arena.x + arena.w; x++) {
        const nx = (x - arena.cx) / 9, ny = (y - arena.cy) / 6;
        if (nx * nx + ny * ny < 1 + rng.range(-0.1, 0.1) && map.get(x, y) === T.FLOOR) map.set(x, y, T.WATER);
      }
    }
    finishWalls(map, rng);
    map.rebuildSolid();
    findGates(map, arena); findGates(map, ante);
    map.start = { x: ante.cx * TILE, y: (ante.cy + 1) * TILE };
    map.boss = { x: arena.cx * TILE, y: (arena.cy - 2) * TILE, type: (opts && opts.bossType) || (tier === 1 ? 'bell' : tier === 2 ? 'mother' : 'eclipse'), loop };
    map.props.push({ kind: 'brazier', x: map.start.x - 96, y: map.start.y - 64, lit: true, room: 1 });
    map.props.push({ kind: 'brazier', x: map.start.x + 96, y: map.start.y - 64, lit: true, room: 1 });
    map.props.push({ kind: 'font', x: map.start.x, y: map.start.y - 80, room: 1, used: false });
    const bx = [3, arena.w - 4], by = [3, arena.h - 4];
    for (const ox of bx) for (const oy of by) map.props.push({ kind: 'brazier', x: (arena.x + ox + 0.5) * TILE, y: (arena.y + oy + 0.5) * TILE, lit: false, room: 0 });
    map.props.push({ kind: 'exit', x: arena.cx * TILE, y: arena.cy * TILE, room: 0, open: false, hidden: true });
    map.exit = { x: arena.cx * TILE, y: arena.cy * TILE };
    return map;
  }
})();
