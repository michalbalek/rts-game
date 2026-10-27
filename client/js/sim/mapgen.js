import {
  MAP_SIZE, TILE_TYPES, RESOURCE_TYPES, START_POSITIONS, DEPOSITS
} from './constants.js';
import { createRng, rngInt } from './rng.js';

/**
 * Herní mapa. Terén, přírodní zdroje a ložiska.
 * Mapa se generuje deterministicky ze seedu – klient i server tak mají stejný svět.
 */
export class GameMap {
  constructor(seed = 1, type = 'desert', size = MAP_SIZE) {
    this.seed = seed >>> 0;
    this.type = type;
    this.size = size;
    this.tiles = new Uint8Array(size * size);
    this.resources = new Uint8Array(size * size);
    this.depositAt = new Uint16Array(size * size);
    this.deposits = [];
    this.nextDepositId = 1;
    this.treeTimers = [];
    this.treeHarvested = new Map();
    this.onChange = null;
    this.generate();
  }

  idx(x, y) {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return -1;
    return y * this.size + x;
  }

  getTile(x, y) {
    const i = this.idx(x, y);
    return i === -1 ? null : this.tiles[i];
  }

  getResource(x, y) {
    const i = this.idx(x, y);
    return i === -1 ? RESOURCE_TYPES.NONE : this.resources[i];
  }

  getDepositAt(x, y) {
    const i = this.idx(x, y);
    if (i === -1) return null;
    const id = this.depositAt[i];
    return id ? this.deposits.find(d => d.id === id && d.active) : null;
  }

  setResource(x, y, res) {
    const i = this.idx(x, y);
    if (i === -1) return;
    if (res !== RESOURCE_TYPES.TREE) this.treeHarvested.delete(i);
    this.resources[i] = res;
    if (this.onChange) this.onChange(i, res, null);
  }

  addTree(x, y) {
    if (this.getTile(x, y) === TILE_TYPES.WATER_DEEP) return false;
    if (this.getResource(x, y) !== RESOURCE_TYPES.NONE) return false;
    this.setResource(x, y, RESOURCE_TYPES.TREE);
    return true;
  }

  /** Pokácí strom. Vrací true, pokud na dlaždici strom byl. */
  chopTree(x, y) {
    if (this.getResource(x, y) !== RESOURCE_TYPES.TREE) return false;
    this.setResource(x, y, RESOURCE_TYPES.NONE);
    // Nový strom vyroste za 30–90 s.
    this.treeTimers.push({ x, y, timer: 30 + Math.random() * 60 });
    return true;
  }

  update(dt, buildingBlock = null) {
    for (let i = this.treeTimers.length - 1; i >= 0; i--) {
      const t = this.treeTimers[i];
      t.timer -= dt;
      if (t.timer <= 0) {
        const idx = this.idx(t.x, t.y);
        if (idx !== -1 && this.resources[idx] === RESOURCE_TYPES.NONE &&
            !(buildingBlock && buildingBlock[idx])) {
          this.setResource(t.x, t.y, RESOURCE_TYPES.TREE);
          this.treeTimers.splice(i, 1);
        } else {
          t.timer = 20; // zkusit jindy
        }
      }
    }
  }

  createDeposit(type, tiles, amount) {
    const id = this.nextDepositId++;
    const resource = type === 'stone' ? RESOURCE_TYPES.STONE : RESOURCE_TYPES.IRON;
    for (const { x, y } of tiles) {
      const i = this.idx(x, y);
      if (i === -1) continue;
      this.resources[i] = resource;
      this.depositAt[i] = id;
      if (this.onChange) this.onChange(i, resource, id);
    }
    const deposit = { id, type, amount, maxAmount: amount, tiles: tiles.map(t => this.idx(t.x, t.y)), active: true };
    this.deposits.push(deposit);
    return deposit;
  }

  removeDeposit(deposit) {
    deposit.active = false;
    for (const i of deposit.tiles) {
      if (this.depositAt[i] === deposit.id) {
        this.depositAt[i] = 0;
        this.resources[i] = RESOURCE_TYPES.NONE;
        if (this.onChange) this.onChange(i, RESOURCE_TYPES.NONE, null);
      }
    }
  }

  extractDeposit(deposit, amount) {
    if (!deposit || !deposit.active) return 0;
    const taken = Math.min(amount, deposit.amount);
    deposit.amount -= taken;
    if (deposit.amount <= 0.001) {
      deposit.amount = 0;
      this.removeDeposit(deposit);
    }
    return taken;
  }

  /** Najde volné místo pro nové ložisko. */
  findDepositSpot(cx, cy, w, h, castles, rng) {
    const size = this.size;
    for (let attempt = 0; attempt < 220; attempt++) {
      const x = clamp(cx + rngInt(rng, -16, 16), 3, size - w - 3);
      const y = clamp(cy + rngInt(rng, -16, 16), 3, size - h - 3);
      if (this.areaFreeForDeposit(x, y, w, h, castles)) return { x, y };
    }
    for (let attempt = 0; attempt < 400; attempt++) {
      const x = rngInt(rng, 3, size - w - 3);
      const y = rngInt(rng, 3, size - h - 3);
      if (this.areaFreeForDeposit(x, y, w, h, castles)) return { x, y };
    }
    return null;
  }

  areaFreeForDeposit(x, y, w, h, castles = []) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const tx = x + dx;
        const ty = y + dy;
        const tile = this.getTile(tx, ty);
        if (tile === null || tile === TILE_TYPES.WATER_DEEP || tile === TILE_TYPES.WATER_SHALLOW) return false;
        if (this.getResource(tx, ty) !== RESOURCE_TYPES.NONE) return false;
        if (this.getDepositAt(tx, ty)) return false;
        for (const c of castles) {
          if (Math.hypot(tx - c.x, ty - c.y) < DEPOSITS.minCastleDistance) return false;
        }
      }
    }
    return true;
  }

  spawnDeposit(type, x, y, w, h, amount) {
    const tiles = [];
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) tiles.push({ x: x + dx, y: y + dy });
    }
    return this.createDeposit(type, tiles, amount);
  }

  generate() {
    const rng = createRng(this.seed);
    const noise = makeNoise(rng, this.size, 9);
    const noise2 = makeNoise(rng, this.size, 17);
    const size = this.size;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        let tile = TILE_TYPES.SAND;
        if (this.type === 'desert') {
          const riverCenter = 100 + Math.sin(y * 0.05) * 9 + Math.sin(y * 0.014) * 7;
          const riverHalf = 3.5 + Math.sin(y * 0.09) * 1.2;
          const distRiver = Math.abs(x - riverCenter);
          if (distRiver < riverHalf) tile = TILE_TYPES.WATER_DEEP;
          else if (distRiver < riverHalf + 2.2) tile = TILE_TYPES.WATER_SHALLOW;
          else if (distRiver < riverHalf + 4.5) tile = rng() > 0.45 ? TILE_TYPES.GRASS : TILE_TYPES.SAND;
          else {
            const n = noise(x, y);
            if (n > 0.63) tile = TILE_TYPES.DUNE;
            else if (n < 0.28) tile = TILE_TYPES.CLAY;
            else tile = TILE_TYPES.SAND;
            if (noise2(x, y) > 0.8) tile = TILE_TYPES.ROCK;
          }
          // Dva brody v řece.
          if (Math.abs(y - 70) < 4 || Math.abs(y - 132) < 4) {
            if (distRiver < riverHalf + 2.6) tile = TILE_TYPES.WATER_SHALLOW;
          }
        } else if (this.type === 'oasis') {
          const lakeDist = Math.hypot(x - 100, y - 100);
          if (lakeDist < 28) tile = TILE_TYPES.WATER_DEEP;
          else if (lakeDist < 31.5) tile = TILE_TYPES.WATER_SHALLOW;
          else if (lakeDist < 46) tile = TILE_TYPES.GRASS;
          else {
            const n = noise(x, y);
            tile = n > 0.68 ? TILE_TYPES.DUNE : (n < 0.3 ? TILE_TYPES.CLAY : TILE_TYPES.SAND);
          }
          // Potok na východ.
          const streamY = 100 + Math.sin(x * 0.08) * 4;
          if (x > 118 && Math.abs(y - streamY) < 2.6) {
            tile = Math.abs(y - streamY) < 1.4 ? TILE_TYPES.WATER_DEEP : TILE_TYPES.WATER_SHALLOW;
            if (Math.abs(x - 148) < 4) tile = TILE_TYPES.WATER_SHALLOW; // brod
          }
          // Severní přítok s jedním brodem.
          const northX = 100 + Math.sin(y * 0.08) * 3;
          if (y < 73 && y > 20 && Math.abs(x - northX) < 2.4) {
            tile = Math.abs(x - northX) < 1.2 ? TILE_TYPES.WATER_DEEP : TILE_TYPES.WATER_SHALLOW;
            if (Math.abs(y - 62) < 4) tile = TILE_TYPES.WATER_SHALLOW;
          }
          // Vegetace.
          if (tile === TILE_TYPES.GRASS && rng() > 0.72) this.resources[i] = RESOURCE_TYPES.TREE;
        } else {
          // Skalní rokle.
          const canyon = 100 + Math.sin(y * 0.035) * 17 + Math.sin(y * 0.011) * 8;
          const d = Math.abs(x - canyon);
          if (d < 2.6) tile = TILE_TYPES.WATER_DEEP;
          else if (d < 4) tile = TILE_TYPES.WATER_SHALLOW;
          else if (d < 13) tile = TILE_TYPES.ROCK;
          else {
            const n = noise(x, y);
            tile = n > 0.55 ? TILE_TYPES.DUNE : (n < 0.25 ? TILE_TYPES.CLAY : TILE_TYPES.SAND);
            if (noise2(x, y) > 0.74) tile = TILE_TYPES.ROCK;
          }
          if (Math.abs(y - 62) < 4 || Math.abs(y - 138) < 4) {
            if (d < 4.5) tile = TILE_TYPES.WATER_SHALLOW; // dva brody
          }
        }
        this.tiles[i] = tile;
      }
    }

    // Vyčištění a výbava startovních pozic – přesně symetricky otočená.
    this.buildStartAreas(rng);

    // Doplňkové zdroje po mapě.
    this.scatterTrees(rng, this.type === 'canyon' ? 40 : 120);
    this.scatterDeposits(rng);
  }

  buildStartAreas(rng) {
    const S = this.size;
    const rotate = (x, y, turns) => {
      let nx = x, ny = y;
      for (let t = 0; t < turns; t++) {
        const tmp = nx;
        nx = S - 1 - ny;
        ny = tmp;
      }
      return { x: nx, y: ny };
    };

    const canonicalTrees = [];
    const grove = { x: 66, y: 42 };
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2;
      const r = 1.2 + (i % 3) * 1.1;
      canonicalTrees.push({
        x: Math.round(grove.x + Math.cos(angle) * r),
        y: Math.round(grove.y + Math.sin(angle) * r * 0.8)
      });
    }

    const features = [];
    // 5×5 ložisko kamene (střed 78, 68).
    features.push({ kind: 'deposit', type: 'stone', x: 76, y: 66, w: 5, h: 5 });
    // 4×4 ložisko železa (střed 44, 72).
    features.push({ kind: 'deposit', type: 'iron', x: 42, y: 70, w: 4, h: 4 });
    // Háj stromů.
    for (const t of canonicalTrees) features.push({ kind: 'tree', x: t.x, y: t.y });

    for (let turn = 0; turn < 4; turn++) {
      const start = START_POSITIONS[turn];
      // Vyčistit okolí hradu.
      for (let dy = -8; dy < 11; dy++) {
        for (let dx = -8; dx < 11; dx++) {
          const x = start.x + dx;
          const y = start.y + dy;
          const i = this.idx(x, y);
          if (i === -1) continue;
          const tile = this.tiles[i];
          if (tile === TILE_TYPES.WATER_DEEP || tile === TILE_TYPES.WATER_SHALLOW) {
            this.tiles[i] = TILE_TYPES.SAND;
          }
          this.resources[i] = RESOURCE_TYPES.NONE;
          const d = Math.hypot(dx - 1.5, dy - 1.5);
          if (d < 5) this.tiles[i] = TILE_TYPES.GRASS;
        }
      }

      for (const f of features) {
        const p = rotate(f.x, f.y, turn);
        if (f.kind === 'tree') {
          const i = this.idx(p.x, p.y);
          if (i === -1) continue;
          if (this.tiles[i] === TILE_TYPES.WATER_DEEP || this.tiles[i] === TILE_TYPES.WATER_SHALLOW) {
            this.tiles[i] = TILE_TYPES.GRASS;
          }
          this.resources[i] = RESOURCE_TYPES.TREE;
        } else {
          const tiles = [];
          for (let dy = 0; dy < f.h; dy++) {
            for (let dx = 0; dx < f.w; dx++) {
              const t = rotate(f.x + dx, f.y + dy, turn);
              tiles.push(t);
            }
          }
          for (const t of tiles) {
            const i = this.idx(t.x, t.y);
            if (i === -1) continue;
            if (this.tiles[i] === TILE_TYPES.WATER_DEEP || this.tiles[i] === TILE_TYPES.WATER_SHALLOW) {
              this.tiles[i] = TILE_TYPES.SAND;
            }
          }
          const amount = f.type === 'stone' ? DEPOSITS.stone.amount : DEPOSITS.iron.amount;
          this.createDeposit(f.type, tiles, amount);
        }
      }
    }
  }

  scatterTrees(rng, count) {
    const size = this.size;
    let placed = 0;
    let attempts = 0;
    while (placed < count && attempts < count * 12) {
      attempts++;
      const x = rngInt(rng, 4, size - 5);
      const y = rngInt(rng, 4, size - 5);
      if (this.getResource(x, y) !== RESOURCE_TYPES.NONE) continue;
      if (this.getDepositAt(x, y)) continue;
      if (this.getTile(x, y) !== TILE_TYPES.GRASS && this.getTile(x, y) !== TILE_TYPES.SAND) continue;
      if (nearAnyStart(x, y, 12)) continue;
      this.resources[y * size + x] = RESOURCE_TYPES.TREE;
      placed++;
    }
  }

  scatterDeposits(rng) {
    const castles = START_POSITIONS.map(p => ({ x: p.x + 1, y: p.y + 1 }));
    const plans = [
      { type: 'stone', w: 5, h: 5, count: 3 },
      { type: 'iron', w: 4, h: 4, count: 3 }
    ];
    for (const plan of plans) {
      for (let i = 0; i < plan.count; i++) {
        let spot = null;
        for (let attempt = 0; attempt < 80 && !spot; attempt++) {
          const x = rngInt(rng, 8, this.size - plan.w - 8);
          const y = rngInt(rng, 8, this.size - plan.h - 8);
          if (this.areaFreeForDeposit(x, y, plan.w, plan.h, castles) && !nearAnyStart(x, y, 18)) spot = { x, y };
        }
        if (spot) {
          const amount = plan.type === 'stone' ? DEPOSITS.stone.amount : DEPOSITS.iron.amount;
          this.spawnDeposit(plan.type, spot.x, spot.y, plan.w, plan.h, amount);
        }
      }
    }
  }

  // ------------------------------------------------------------------
  //  Ukládání místního světa
  // ------------------------------------------------------------------

  toSaveState() {
    return {
      seed: this.seed,
      type: this.type,
      size: this.size,
      tiles: Array.from(this.tiles),
      resources: Array.from(this.resources),
      depositAt: Array.from(this.depositAt),
      deposits: this.deposits.map(d => ({ ...d, tiles: d.tiles.slice() })),
      nextDepositId: this.nextDepositId,
      treeTimers: this.treeTimers.map(t => ({ ...t })),
      treeHarvested: Array.from(this.treeHarvested)
    };
  }

  static fromSaveState(data) {
    if (!data) throw new Error('Chybí uložená mapa.');
    const size = data.size || MAP_SIZE;
    const expected = size * size;
    if (!Array.isArray(data.tiles) || data.tiles.length !== expected ||
        !Array.isArray(data.resources) || data.resources.length !== expected ||
        !Array.isArray(data.depositAt) || data.depositAt.length !== expected) {
      throw new Error('Uložená mapa má neplatná data.');
    }
    const map = new GameMap(data.seed, data.type, size);
    map.tiles = Uint8Array.from(data.tiles);
    map.resources = Uint8Array.from(data.resources);
    map.depositAt = Uint16Array.from(data.depositAt);
    map.deposits = (data.deposits || []).map(d => ({
      ...d,
      tiles: Array.isArray(d.tiles) ? d.tiles.slice() : []
    }));
    map.nextDepositId = data.nextDepositId || (map.deposits.length + 1);
    map.treeTimers = (data.treeTimers || []).map(t => ({ ...t }));
    map.treeHarvested = new Map(data.treeHarvested || []);
    map.onChange = null;
    return map;
  }
}

function nearAnyStart(x, y, radius) {
  return START_POSITIONS.some(p => Math.hypot(x - (p.x + 1), y - (p.y + 1)) < radius);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/** Hladký hodnotový šum pro duny a skály. */
function makeNoise(rng, size, scale) {
  const cells = Math.ceil(size / scale) + 2;
  const grid = new Float32Array(cells * cells);
  for (let i = 0; i < grid.length; i++) grid[i] = rng();
  return (x, y) => {
    const fx = x / scale;
    const fy = y / scale;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = smooth(fx - x0);
    const ty = smooth(fy - y0);
    const v00 = grid[(y0 % cells) * cells + (x0 % cells)];
    const v10 = grid[(y0 % cells) * cells + ((x0 + 1) % cells)];
    const v01 = grid[((y0 + 1) % cells) * cells + (x0 % cells)];
    const v11 = grid[((y0 + 1) % cells) * cells + ((x0 + 1) % cells)];
    const a = v00 + (v10 - v00) * tx;
    const b = v01 + (v11 - v01) * tx;
    return a + (b - a) * ty;
  };
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}
