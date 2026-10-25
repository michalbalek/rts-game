import {
  MAP_SIZE, TILE_TYPES, RESOURCE_TYPES, START_POSITIONS,
  PLAYER_COLORS, PLAYER_COLOR_NAMES, CAPITALS, TAX_LEVELS, MARKET_PRICES,
  BOT_DIFFICULTIES, BUILDING_DEFS, UNIT_DEFS, WORK, STORAGE, DEPOSITS,
  FOG_RANGES, GAME_MODES, MILITARY_TYPES, BUILD, buildSpeedFactor, DELIVERY
} from './constants.js';
import { GameMap } from './mapgen.js';
import { Building, Unit } from './entities.js';
import { findPath, findNearestWalkable, isTileWalkable } from './pathfinding.js';
import { validatePlacement } from './placement.js';
import { createRng, randomSeed } from './rng.js';
import { updateBot } from './bot.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
// Mezizastávku stačí zasáhnout v tomto okolí. Přesný střed by se při tlačení davu netrefil
// a jednotky by u něj natrvalo uvízly (tlačení je zase odsouvalo zpět).
const WAYPOINT_REACH = 0.45;
const SIDE_STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Čtvercová vzdálenost k obdélníku budovy. */
export function distanceToBuilding(x, y, b) {
  const cx = clamp(x, b.tileX, b.tileX + b.width);
  const cy = clamp(y, b.tileY, b.tileY + b.height);
  return Math.hypot(x - cx, y - cy);
}

export function isEnemy(a, b) {
  return b !== 0 && a !== b;
}

/**
 * Autoritativní herní simulace. Používá ji klient pro singleplayer
 * a server pro multiplayer – pravidla jsou tak identická.
 */
export class GameSim {
  constructor(opts = {}) {
    this.seed = (opts.seed ?? randomSeed()) >>> 0;
    this.mapType = opts.mapType || 'desert';
    this.mode = opts.mode || GAME_MODES.bots;
    this.rng = createRng((this.seed ^ 0x9e3779b9) >>> 0);
    this.map = opts.map || new GameMap(this.seed, this.mapType);
    this.fogEnabled = !!opts.fog && this.mode === GAME_MODES.multiplayer
      ? true
      : !!opts.fog;

    this.nextId = 1;
    this.time = 0;
    this.tickCount = 0;
    this.ended = false;
    this.winnerId = null;
    this.endTime = 0;

    this.buildings = [];
    this.units = [];
    this.projectiles = [];
    this.effects = [];
    this.players = [];
    this.playerById = new Map();

    this.events = [];
    this.eventSeq = 0;

    this.mapChanges = [];
    this.mapChangeSeq = 0;

    this.blockGrid = new Uint8Array(this.map.size * this.map.size);
    this.regionGrid = new Int32Array(this.map.size * this.map.size);
    this.regionsDirty = true;

    this.fogData = new Map();
    this.fogTimer = 0;
    this.botTimer = 1;
    this.pendingDeposits = [];
    this.slowTimer = 0;
    this.foodWarnTimer = 0;

    this.map.onChange = (idx, res) => {
      this.regionsDirty = true;
      this.mapChanges.push({ seq: ++this.mapChangeSeq, i: idx, r: res });
      if (this.mapChanges.length > 6000) this.mapChanges.splice(0, 1000);
    };

    const capital = CAPITALS[opts.capital] || CAPITALS.medium;
    const rawPlayers = (opts.players && opts.players.length)
      ? opts.players
      : [{ name: 'Království', isBot: false }];

    rawPlayers.slice(0, 4).forEach((p, i) => {
      const id = i + 1;
      const player = {
        id,
        name: p.name || `Hráč ${id}`,
        color: p.color || PLAYER_COLORS[i],
        colorName: PLAYER_COLOR_NAMES[i],
        isBot: !!p.isBot,
        difficulty: p.difficulty || 'medium',
        alive: true,
        resources: { ...capital.resources },
        tax: 'medium',
        popularity: 100,
        population: 0,
        capacity: 20,
        spawnTimer: 5,
        foodShortage: false,
        stats: { destroyed: 0, trained: 0, gathered: 0, lost: 0, damage: 0 },
        bot: { nextBuild: 0, attackTimer: 0, armyTarget: 8, lastAttack: -999, guardSet: false }
      };
      this.players.push(player);
      this.playerById.set(id, player);
      this.fogData.set(id, {
        explored: new Uint8Array(this.map.size * this.map.size),
        visible: new Uint8Array(this.map.size * this.map.size)
      });
    });

    this.humanId = (this.players.find(p => !p.isBot) || this.players[0]).id;
    this.capitalKey = capital.key;
    for (const p of this.players) {
      p.gatherMultiplier = p.isBot
        ? (BOT_DIFFICULTIES[p.difficulty] || BOT_DIFFICULTIES.medium).gather
        : 1;
    }

    this.createStartingPositions();
    this.updateAllCapacities();
    this.rebuildBlockGrid();
    if (this.fogEnabled) this.recomputeFog();
    else this.markAllVisible();
  }

  // ------------------------------------------------------------------
  //  Založení světa
  // ------------------------------------------------------------------

  createStartingPositions() {
    this.players.forEach((player, index) => {
      const pos = START_POSITIONS[index] || START_POSITIONS[0];
      const castle = new Building(this.nextId++, 'castle', player.id, pos.x, pos.y, true);
      castle.hp = castle.maxHp;
      this.buildings.push(castle);
      castle.isCastle = true;

      for (let i = 0; i < 20; i++) {
        this.spawnVillager(player.id, castle, i);
      }
      this.recountPopulation(player.id);
    });
  }

  getCastle(playerId) {
    return this.buildings.find(b => b.type === 'castle' && b.ownerId === playerId && b.complete) || null;
  }

  getPlayer(id) {
    return this.playerById.get(id) || null;
  }

  campfirePosition(playerId) {
    const castle = this.getCastle(playerId);
    if (!castle) return { x: this.map.size / 2, y: this.map.size / 2 };
    return { x: castle.tileX + 1.5, y: castle.tileY + 3.9 };
  }

  idleSpot(playerId, index = 0, radius = 2.4) {
    const base = this.campfirePosition(playerId);
    const angle = (index * 2.399) % (Math.PI * 2);
    const r = 0.4 + ((index * 0.37) % radius);
    let x = base.x + Math.cos(angle) * r;
    let y = base.y + Math.sin(angle) * r * 0.6;
    const near = findNearestWalkable(this.map, this.blockGrid, Math.floor(x), Math.floor(y), 5);
    if (near) {
      x = near.x + 0.5;
      y = near.y + 0.5;
    }
    return { x, y };
  }

  spawnVillager(playerId, castle = null, index = 0) {
    const spot = this.idleSpot(playerId, this.units.filter(u => u.ownerId === playerId).length + index);
    const unit = new Unit(this.nextId++, 'villager', playerId, spot.x, spot.y);
    this.units.push(unit);
    return unit;
  }

  addUnit(type, playerId, x, y) {
    const spot = findNearestWalkable(this.map, this.blockGrid, Math.floor(x), Math.floor(y), 5);
    const unit = new Unit(this.nextId++, type, playerId,
      spot ? spot.x + 0.5 : x, spot ? spot.y + 0.5 : y);
    this.units.push(unit);
    this.recountPopulation(playerId);
    return unit;
  }

  recountPopulation(playerId) {
    const player = this.getPlayer(playerId);
    if (!player) return;
    let pop = 0;
    for (const u of this.units) if (u.ownerId === playerId) pop++;
    for (const b of this.buildings) {
      if (b.ownerId === playerId) pop += b.queue.length;
    }
    player.population = pop;
  }

  updateAllCapacities() {
    for (const player of this.players) {
      let capacity = 20;
      for (const b of this.buildings) {
        if (b.ownerId === player.id && b.complete && b.type === 'dwelling') capacity += 8;
      }
      player.capacity = capacity;
      this.recountPopulation(player.id);
    }
  }

  getStorageCaps(playerId) {
    let warehouses = 0;
    let granaries = 0;
    for (const b of this.buildings) {
      if (b.ownerId !== playerId || !b.complete) continue;
      if (b.type === 'warehouse') warehouses++;
      if (b.type === 'granary') granaries++;
      if (b.type === 'castle') {
        warehouses += 1;
        granaries += 1;
      }
    }
    return {
      resources: warehouses * STORAGE.baseResource,
      food: granaries * STORAGE.baseFood
    };
  }

  getStoredResources(playerId) {
    const p = this.getPlayer(playerId);
    return p ? p.resources.wood + p.resources.stone + p.resources.iron : 0;
  }

  addResource(playerId, type, amount) {
    const p = this.getPlayer(playerId);
    if (!p || amount <= 0) return 0;
    if (type === 'money') {
      p.resources.money += amount;
      return amount;
    }
    const caps = this.getStorageCaps(playerId);
    if (type === 'food') {
      const free = Math.max(0, caps.food - p.resources.food);
      const accepted = Math.min(amount, free);
      p.resources.food += accepted;
      return accepted;
    }
    const free = Math.max(0, caps.resources - this.getStoredResources(playerId));
    const accepted = Math.min(amount, free);
    p.resources[type] += accepted;
    return accepted;
  }

  canAfford(playerId, cost) {
    const p = this.getPlayer(playerId);
    if (!p || !cost) return false;
    for (const key of ['money', 'wood', 'stone', 'food', 'iron']) {
      if ((cost[key] || 0) > p.resources[key] + 1e-6) return false;
    }
    return true;
  }

  spend(playerId, cost) {
    const p = this.getPlayer(playerId);
    if (!p) return false;
    if (!this.canAfford(playerId, cost)) return false;
    for (const key of ['money', 'wood', 'stone', 'food', 'iron']) {
      p.resources[key] = Math.max(0, p.resources[key] - (cost[key] || 0));
    }
    return true;
  }

  grantCost(playerId, cost, ratio = 0.5) {
    const p = this.getPlayer(playerId);
    if (!p) return;
    for (const key of ['money', 'wood', 'stone']) {
      const amount = Math.floor((cost[key] || 0) * ratio);
      if (amount > 0) this.addResource(playerId, key, amount);
    }
  }

  // ------------------------------------------------------------------
  //  Viditelnost a mlha války
  // ------------------------------------------------------------------

  markAllVisible() {
    for (const data of this.fogData.values()) {
      data.explored.fill(1);
      data.visible.fill(1);
    }
  }

  recomputeFog() {
    if (!this.fogEnabled) return;
    const size = this.map.size;
    for (const player of this.players) {
      if (!player.alive) continue;
      const data = this.fogData.get(player.id);
      if (!data) continue;
      data.visible.fill(0);
      const reveal = (cx, cy, radius) => {
        const r = Math.ceil(radius);
        const r2 = radius * radius;
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (dx * dx + dy * dy > r2) continue;
            const x = Math.floor(cx) + dx;
            const y = Math.floor(cy) + dy;
            if (x < 0 || y < 0 || x >= size || y >= size) continue;
            const i = y * size + x;
            data.visible[i] = 1;
            data.explored[i] = 1;
          }
        }
      };
      for (const u of this.units) {
        if (u.ownerId === player.id) reveal(u.x, u.y, FOG_RANGES.unit);
      }
      for (const b of this.buildings) {
        if (b.ownerId === player.id) {
          const range = b.type === 'castle' ? FOG_RANGES.building + 2 : FOG_RANGES.building;
          reveal(b.centerX, b.centerY, range + Math.max(b.width, b.height) * 0.5);
        }
      }
    }
  }

  isVisible(playerId, x, y) {
    if (!this.fogEnabled) return true;
    const data = this.fogData.get(playerId);
    if (!data) return false;
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix < 0 || iy < 0 || ix >= this.map.size || iy >= this.map.size) return false;
    return data.visible[iy * this.map.size + ix] === 1;
  }

  isExplored(playerId, x, y) {
    if (!this.fogEnabled) return true;
    const data = this.fogData.get(playerId);
    if (!data) return false;
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix < 0 || iy < 0 || ix >= this.map.size || iy >= this.map.size) return false;
    return data.explored[iy * this.map.size + ix] === 1;
  }

  // ------------------------------------------------------------------
  //  Kolizní mřížka
  // ------------------------------------------------------------------

  rebuildBlockGrid() {
    this.blockGrid.fill(0);
    this.regionsDirty = true;
    for (const b of this.buildings) {
      // Průchozí budova po dokončení neblokuje chůzi.
      if (b.complete && b.config.passable) continue;
      for (let dy = 0; dy < b.height; dy++) {
        for (let dx = 0; dx < b.width; dx++) {
          const i = this.map.idx(b.tileX + dx, b.tileY + dy);
          if (i !== -1) this.blockGrid[i] = 1;
        }
      }
    }
  }

  isWalkableTile(x, y) {
    return isTileWalkable(this.map, x, y) && !this.blockGrid[y * this.map.size + x];
  }

  // ------------------------------------------------------------------
  //  Stavba
  // ------------------------------------------------------------------

  canPlaceBuilding(playerId, type, x, y) {
    const player = this.getPlayer(playerId);
    const def = BUILDING_DEFS[type];
    return validatePlacement(this.map, this.buildings, playerId, type, x, y, {
      alive: player ? player.alive : false,
      castle: this.getCastle(playerId),
      units: this.units,
      canAfford: player && def ? this.canAfford(playerId, def.cost) : false
    });
  }

  placeBuilding(playerId, type, x, y) {
    const check = this.canPlaceBuilding(playerId, type, x, y);
    if (!check.valid) return check;
    const def = BUILDING_DEFS[type];

    if (!this.spend(playerId, def.cost)) {
      return { valid: false, reason: 'Nedostatek surovin.' };
    }

    for (let dy = 0; dy < def.h; dy++) {
      for (let dx = 0; dx < def.w; dx++) {
        const tx = x + dx;
        const ty = y + dy;
        if (this.map.getResource(tx, ty) === RESOURCE_TYPES.TREE) {
          this.map.setResource(tx, ty, RESOURCE_TYPES.NONE);
        }
      }
    }

    const building = new Building(this.nextId++, type, playerId, x, y, false);
    building.hp = Math.max(1, Math.round(def.hp * 0.05));
    if (def.requires === 'stone' || def.requires === 'iron') {
      const dep = this.map.getDepositAt(x, y);
      building.depositId = dep ? dep.id : null;
    }
    this.buildings.push(building);
    this.rebuildBlockGrid();
    this.emit('toast', {
      playerId,
      text: `Stavba zahájena: ${def.name}`,
      kind: 'info'
    });
    return { valid: true, building };
  }

  startRepair(playerId, buildingId) {
    const player = this.getPlayer(playerId);
    const b = this.buildings.find(x => x.id === buildingId);
    if (!player || !player.alive || !b || b.ownerId !== playerId) {
      return { ok: false, reason: 'Tuto budovu nemůžete opravovat.' };
    }
    if (!b.complete) return { ok: false, reason: 'Budova se teprve staví.' };
    if (b.hp >= b.maxHp) return { ok: false, reason: 'Budova je v plném stavu.' };
    if (b.repair) return { ok: false, reason: 'Na budově už se pracuje.' };
    const repairCost = {};
    let any = false;
    for (const key of ['money', 'wood', 'stone']) {
      const val = Math.floor((b.config.cost[key] || 0) * 0.2);
      repairCost[key] = val;
      if (val > 0) any = true;
    }
    if (any && !this.canAfford(playerId, repairCost)) {
      return { ok: false, reason: 'Na opravu nemáte dost surovin (20 % ceny).' };
    }
    const worker = this.findIdleVillager(playerId);
    if (!worker) return { ok: false, reason: 'U ohniště není žádný volný poddaný.' };
    if (any) this.spend(playerId, repairCost);
    b.repair = { workerId: worker.id };
    worker.work = null;
    worker.repairBuildingId = b.id;
    this.navigateTo(worker, b.centerX, b.centerY);
    this.emit('toast', { playerId, text: `Oprava zahájena: ${b.config.name}`, kind: 'info' });
    return { ok: true };
  }

  demolishBuilding(playerId, buildingId) {
    const b = this.buildings.find(x => x.id === buildingId);
    const player = this.getPlayer(playerId);
    if (!b || !player || b.ownerId !== playerId) {
      return { ok: false, reason: 'Tuto budovu nemůžete zbourat.' };
    }
    if (b.type === 'castle') return { ok: false, reason: 'Královský hrad nelze zbourat!' };
    this.grantCost(playerId, b.config.cost, 0.5);
    this.removeBuilding(b, { refund: false, destroyed: false });
    this.emit('toast', {
      playerId,
      text: `Budova zbořena: ${b.config.name} (vráceno 50 % nákladů)`,
      kind: 'info'
    });
    return { ok: true };
  }

  // ------------------------------------------------------------------
  //  Jednotky a výcvik
  // ------------------------------------------------------------------

  findIdleVillager(playerId) {
    let best = null;
    let bestD = Infinity;
    const base = this.campfirePosition(playerId);
    for (const u of this.units) {
      if (u.ownerId !== playerId || !u.isVillager) continue;
      if (u.work || u.build || u.repairBuildingId || u.fleeing) continue;
      const d = dist(u.x, u.y, base.x, base.y);
      if (d < bestD) { bestD = d; best = u; }
    }
    return best;
  }

  trainUnit(playerId, buildingId, unitType) {
    const player = this.getPlayer(playerId);
    const def = UNIT_DEFS[unitType];
    const b = this.buildings.find(x => x.id === buildingId);
    if (!player || !player.alive) return { ok: false, reason: 'Vaše panství již padlo.' };
    if (!def || !def.cost || !def.trainTime) return { ok: false, reason: 'Neznámá jednotka.' };
    if (!b || b.ownerId !== playerId || !b.complete) {
      return { ok: false, reason: 'Budova není dokončena.' };
    }
    if (!(b.config.trains || []).includes(unitType)) {
      return { ok: false, reason: 'Tato budova tuto jednotku nevyrábí.' };
    }
    if (!this.canAfford(playerId, def.cost)) {
      return { ok: false, reason: 'Nedostatek peněz nebo jídla pro výcvik.' };
    }
    const villager = this.findIdleVillager(playerId);
    if (!villager) {
      return { ok: false, reason: 'U ohniště není žádný volný poddaný k povolání.' };
    }
    this.spend(playerId, def.cost);
    this.removeUnit(villager, { silent: true });
    b.queue.push({ unitType, remaining: def.trainTime, total: def.trainTime });
    this.recountPopulation(playerId);
    this.emit('toast', {
      playerId,
      text: `Výcvik zahájen: ${def.name} (${def.trainTime} s)`,
      kind: 'info'
    });
    return { ok: true };
  }

  findSpawnSpot(building) {
    const candidates = [];
    for (let x = building.tileX - 1; x <= building.tileX + building.width; x++) {
      for (let y = building.tileY - 1; y <= building.tileY + building.height; y++) {
        if (building.containsTile(x, y)) continue;
        if (x < 0 || y < 0 || x >= this.map.size || y >= this.map.size) continue;
        if (!this.isWalkableTile(x, y)) continue;
        candidates.push({ x: x + 0.5, y: y + 0.5 });
      }
    }
    if (!candidates.length) {
      return { x: building.centerX, y: building.centerY };
    }
    return candidates[Math.floor(this.rng() * candidates.length)];
  }

  spawnTrainedUnit(b, unitType) {
    const spot = this.findSpawnSpot(b);
    const unit = new Unit(this.nextId++, unitType, b.ownerId, spot.x, spot.y);
    this.units.push(unit);
    const player = this.getPlayer(b.ownerId);
    if (player) player.stats.trained++;
    this.recountPopulation(b.ownerId);
    this.emit('trained', {
      playerId: b.ownerId,
      unitType,
      x: spot.x,
      y: spot.y
    });
    if (this.fogEnabled) this.recomputeFog();
    return unit;
  }

  // ------------------------------------------------------------------
  //  Pracovníci
  // ------------------------------------------------------------------

  assignWorkers(playerId, buildingId, count = 1) {
    const player = this.getPlayer(playerId);
    const b = this.buildings.find(x => x.id === buildingId);
    if (!player || !b || b.ownerId !== playerId) return { ok: false, reason: 'Neplatná budova.' };
    if (!b.complete) return { ok: false, reason: 'Budova se teprve staví.' };
    if (!b.config.workers) return { ok: false, reason: 'Sem nelze přiřadit pracovníky.' };
    if (b.config.requires && b.config.requires !== 'tree') {
      const dep = this.map.deposits.find(d => d.id === b.depositId);
      if (!dep || !dep.active) return { ok: false, reason: 'Ložisko je vyčerpané.' };
    }
    const free = [];
    for (const u of this.units) {
      if (u.ownerId !== playerId || !u.isVillager) continue;
      if (u.work || u.build || u.repairBuildingId || u.fleeing) continue;
      free.push(u);
    }
    free.sort((a, c) => dist(a.x, a.y, b.centerX, b.centerY) - dist(c.x, c.y, b.centerX, b.centerY));
    let assigned = 0;
    for (const u of free) {
      if (assigned >= count) break;
      // Do kapacity se počítají i dělníci na cestě. Do budovy se započítají
      // až ve chvíli, kdy skutečně dorazí (fáze toBuilding).
      if (b.assignedWorkerIds.length >= b.config.workers) break;
      b.assignedWorkerIds.push(u.id);
      u.work = {
        buildingId: b.id,
        produce: b.config.produce,
        phase: 'toBuilding',
        carry: 0,
        timer: 0,
        source: null,
        storageId: null,
        waitTimer: 0,
        roamWait: 0,
        arrived: false,
        depleted: false,
        fullStorage: false
      };
      u.autoAttack = false;
      u.workPaused = false;
      const approach = this.findBuildingApproach(u, b);
      if (approach) this.navigateTo(u, approach.x, approach.y);
      assigned++;
    }
    if (!assigned) {
      return { ok: false, reason: 'U ohniště nejsou volní poddaní.' };
    }
    this.emit('assign', { playerId, buildingId: b.id, count: assigned });
    return { ok: true, assigned };
  }

  unassignWorkers(playerId, buildingId, count = 1) {
    const b = this.buildings.find(x => x.id === buildingId);
    if (!b || b.ownerId !== playerId) return { ok: false, reason: 'Neplatná budova.' };
    const workers = this.units.filter(u => u.work && u.work.buildingId === b.id);
    let unassigned = 0;
    for (const u of workers) {
      if (unassigned >= count) break;
      this.releaseWorker(u, false);
      unassigned++;
    }
    return { ok: unassigned > 0, unassigned, reason: unassigned ? null : 'Na budově nikdo nepracuje.' };
  }

  releaseWorker(unit, sendHome = true) {
    if (!unit || !unit.work) return;
    const b = this.buildings.find(x => x.id === unit.work.buildingId);
    if (b) {
      const wasAssigned = b.assignedWorkerIds.includes(unit.id);
      b.assignedWorkerIds = b.assignedWorkerIds.filter(id => id !== unit.id);
      // Dělník na cestě do budovy se do jejího stavu ještě nepočítal.
      if (wasAssigned && unit.work.arrived) {
        b.workers = Math.max(0, b.workers - 1);
      }
    }
    unit.work = null;
    unit.workPaused = false;
    if (sendHome && unit.ownerId) {
      const spot = this.idleSpot(unit.ownerId, unit.id, 1.8);
      this.navigateTo(unit, spot.x, spot.y);
    }
  }

  releaseRepair(unit) {
    if (!unit.repairBuildingId) return;
    const b = this.buildings.find(x => x.id === unit.repairBuildingId);
    if (b && b.repair && b.repair.workerId === unit.id) b.repair = null;
    unit.repairBuildingId = null;
  }

  // Stavitelé jsou poddaní poslaní na staveniště. Budova je nepamatuje, drží je
  // jen jednotka (unit.build), takže se stav při uložení a načtení nerozjede.
  isActiveBuilder(unit) {
    return !!unit.build && unit.build.arrived && !unit.workPaused && !unit.fleeing && unit.hp > 0;
  }

  // Počty stavitelů podle budovy: active = skutečně staví, total = i ti na cestě.
  getBuilderCounts() {
    const counts = new Map();
    for (const u of this.units) {
      if (!u.build) continue;
      const entry = counts.get(u.build.buildingId) || { active: 0, total: 0 };
      entry.total++;
      if (this.isActiveBuilder(u)) entry.active++;
      counts.set(u.build.buildingId, entry);
    }
    return counts;
  }

  assignBuilders(playerId, buildingId, units) {
    const player = this.getPlayer(playerId);
    const b = this.buildings.find(x => x.id === buildingId);
    if (!player || !b || b.ownerId !== playerId) return { ok: false, reason: 'Neplatná budova.' };
    if (b.complete || !b.config.buildTime) return { ok: false, reason: 'Tato budova se nestaví.' };
    let assigned = 0;
    let carrying = 0;
    for (const u of units) {
      if (u.ownerId !== playerId || !u.isVillager || u.hp <= 0 || u.fleeing) continue;
      // Opakované kliknutí nesmí stavitele, kteří už jdou nebo staví, vrátit na začátek cesty.
      if (u.build && u.build.buildingId === b.id) {
        assigned++;
        continue;
      }
      // Nosič by při přeřazení přišel o náklad, proto ho nejdřív musí doručit.
      if (u.work && u.work.carry > 0) {
        carrying++;
        continue;
      }
      const approach = this.findBuildingApproach(u, b);
      const path = approach ? findPath(this.map, this.blockGrid, u.x, u.y, approach.x, approach.y, 12000) : null;
      if (!path) continue;
      if (u.work) this.releaseWorker(u, false);
      this.releaseRepair(u);
      u.clearOrders();
      u.autoAttack = false;
      u.workPaused = false;
      u.build = { buildingId: b.id, arrived: false };
      u.setPath(path);
      u.repathTimer = 1.5;
      assigned++;
    }
    if (!assigned) {
      return {
        ok: false,
        reason: carrying ? 'Vybraní poddaní nejdřív odevzdají náklad do skladu.' : 'Žádný z vybraných poddaných nemůže ke stavbě dojít.'
      };
    }
    if (carrying) this.noticeCarrying(playerId);
    return { ok: true, assigned };
  }

  noticeCarrying(playerId) {
    this.emit('toast', {
      playerId,
      text: 'Někteří vybraní poddaní nesou náklad. Nejdřív ho odevzdají do skladu; potom je lze znovu vybrat.',
      kind: 'info'
    });
  }

  releaseBuilder(unit, sendHome = true) {
    if (!unit || !unit.build) return;
    unit.build = null;
    unit.workPaused = false;
    if (sendHome && unit.ownerId && !unit.fleeing) {
      const spot = this.idleSpot(unit.ownerId, unit.id, 1.8);
      this.navigateTo(unit, spot.x, spot.y);
    }
  }

  releaseBuildersOf(buildingId, sendHome = true) {
    for (const u of this.units) {
      if (u.build && u.build.buildingId === buildingId) this.releaseBuilder(u, sendHome);
    }
  }

  updateVillagerBuild(unit) {
    const player = this.getPlayer(unit.ownerId);
    const b = this.buildings.find(x => x.id === unit.build.buildingId);
    if (!player || !b || b.complete || b.ownerId !== unit.ownerId || !b.config.buildTime) {
      this.releaseBuilder(unit, true);
      return;
    }
    if (player.foodShortage) {
      unit.workPaused = true;
      unit.setPath([]);
      return;
    }
    unit.workPaused = false;

    const build = unit.build;
    const d = distanceToBuilding(unit.x, unit.y, b);
    if (!build.arrived && d <= BUILD.reach) {
      build.arrived = true;
    } else if (build.arrived && d > BUILD.leaveReach) {
      build.arrived = false;
    }
    if (build.arrived) {
      unit.setPath([]);
      return;
    }
    if (unit.path.length === 0 && unit.repathTimer <= 0) {
      const approach = this.findBuildingApproach(unit, b);
      if (!approach || !this.navigateTo(unit, approach.x, approach.y)) {
        this.releaseBuilder(unit, true);
        return;
      }
      unit.repathTimer = 1.5;
    }
  }

  // Dělník v keep ještě odváží poslední náklad z vyčerpaného dolu, proto ho nepouštíme.
  // Ostatní dělníci s nákladem ho nejdřív doručí, jinak by se při uvolnění ztratil.
  releaseAllWorkers(building, keep = null) {
    for (const u of this.units) {
      if (u === keep) continue;
      if (u.work && u.work.buildingId === building.id) {
        if (u.work.carry > 0) {
          u.work.depleted = true;
          if (u.work.phase === 'gather' || u.work.phase === 'pick') u.work.phase = 'toSource';
        } else {
          this.releaseWorker(u, true);
        }
      }
      if (u.repairBuildingId === building.id) {
        u.repairBuildingId = null;
        const spot = this.idleSpot(u.ownerId, u.id, 1.8);
        this.navigateTo(u, spot.x, spot.y);
      }
    }
    this.releaseBuildersOf(building.id, true);
    building.repair = null;
    if (!keep) {
      building.workers = 0;
      building.assignedWorkerIds = [];
    }
  }

  findSource(unit, b) {
    const player = this.getPlayer(unit.ownerId);
    if (!player) return null;
    const def = b.config;
    if (def.produce === 'wood') {
      let best = null;
      let bestD = Infinity;
      const r = 9;
      const cx = Math.floor(b.centerX);
      const cy = Math.floor(b.centerY);
      for (let y = Math.max(0, cy - r); y <= Math.min(this.map.size - 1, cy + r); y++) {
        for (let x = Math.max(0, cx - r); x <= Math.min(this.map.size - 1, cx + r); x++) {
          if (this.map.getResource(x, y) !== RESOURCE_TYPES.TREE) continue;
          const approach = findNearestWalkable(this.map, this.blockGrid, x, y, 2);
          if (!approach) continue;
          const d = dist(approach.x, approach.y, unit.x, unit.y) + dist(x, y, b.centerX, b.centerY) * 0.3;
          if (d < bestD) {
            bestD = d;
            best = { sx: x, sy: y, px: approach.x, py: approach.y };
          }
        }
      }
      return best;
    }
    if (def.produce === 'stone' || def.produce === 'iron') {
      const dep = this.map.deposits.find(d => d.id === b.depositId);
      if (!dep || !dep.active) return null;
      const tileIdx = dep.tiles[Math.abs(unit.id * 7 + Math.floor(unit.x)) % dep.tiles.length];
      const tx = tileIdx % this.map.size;
      const ty = Math.floor(tileIdx / this.map.size);
      const approach = findNearestWalkable(this.map, this.blockGrid, tx, ty, 3);
      if (!approach) return null;
      return { sx: tx, sy: ty, px: approach.x, py: approach.y, depositId: dep.id };
    }
    if (def.produce === 'food') {
      // Dělník se toulá mezi stromy sadu, kotvou je proto střed budovy.
      const sx = Math.floor(b.centerX);
      const sy = Math.floor(b.centerY);
      const spot = findNearestWalkable(this.map, this.blockGrid, sx, sy, 2);
      if (!spot) return null;
      return { sx, sy, px: spot.x, py: spot.y };
    }
    return null;
  }

  harvest(unit, b) {
    const def = b.config;
    const source = unit.work.source;
    const player = this.getPlayer(unit.ownerId);
    const mult = player ? (player.gatherMultiplier || 1) : 1;
    const carry = Math.max(1, Math.round(WORK.carry * mult));
    if (def.produce === 'wood') {
      if (this.map.getResource(source.sx, source.sy) !== RESOURCE_TYPES.TREE) return 0;
      this.map.chopTree(source.sx, source.sy);
      return carry;
    }
    if (def.produce === 'stone' || def.produce === 'iron') {
      const dep = this.map.deposits.find(d => d.id === source.depositId);
      if (!dep || !dep.active) {
        this.releaseAllWorkers(b);
        this.emit('depositDepleted', { x: source.sx, y: source.sy, type: dep ? dep.type : 'stone' });
        return 0;
      }
      const taken = this.map.extractDeposit(dep, carry);
      if (!dep.active) {
        this.pendingDeposits.push({
          type: dep.type,
          amount: dep.type === 'stone' ? DEPOSITS.stone.amount : DEPOSITS.iron.amount,
          timer: DEPOSITS.stone.respawn
        });
        this.emit('depositDepleted', { x: source.sx, y: source.sy, type: dep.type, playerId: unit.ownerId });
        unit.work.depleted = true;
        this.releaseAllWorkers(b, unit);
      }
      return taken;
    }
    if (def.produce === 'food') return carry;
    return 0;
  }

  findStorage(playerId, resource, unit) {
    const castle = this.getCastle(playerId);
    const type = DELIVERY[resource];
    if (!type || type === 'castle') return castle;
    let best = null;
    let bestD = Infinity;
    for (const b of this.buildings) {
      if (b.ownerId !== playerId || !b.complete || b.type !== type) continue;
      const d = dist(unit.x, unit.y, b.centerX, b.centerY);
      // Sklad, do kterého dělník nedojde (jiná oblast), nevybírat.
      if (d < bestD && this.findBuildingApproach(unit, b)) {
        bestD = d;
        best = b;
      }
    }
    // Když cílová budova chybí, náklad jde do hradu.
    return best || castle;
  }

  // Oblasti souvislé průchozí plochy počítané čtyřsměrně. A* s diagonálami dosáhne
  // stejných dlaždic, protože šikmý krok vyžaduje obě sousední dlaždice průchozí.
  ensureRegions() {
    if (!this.regionsDirty) return;
    const size = this.map.size;
    const labels = this.regionGrid;
    labels.fill(0);
    let label = 0;
    const stack = [];
    for (let start = 0; start < size * size; start++) {
      if (labels[start] !== 0) continue;
      const sx = start % size;
      if (!this.isWalkableTile(sx, (start - sx) / size)) continue;
      label++;
      labels[start] = label;
      stack.push(start);
      while (stack.length > 0) {
        const cur = stack.pop();
        const cx = cur % size;
        const cy = (cur - cx) / size;
        for (const [dx, dy] of SIDE_STEPS) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
          const ni = ny * size + nx;
          if (labels[ni] !== 0 || !this.isWalkableTile(nx, ny)) continue;
          labels[ni] = label;
          stack.push(ni);
        }
      }
    }
    this.regionsDirty = false;
  }

  // Oblasti, do kterých jednotka dojde. Stojí-li na neprůchozí dlaždici,
  // může odejít jen přes sousední průchozí dlaždice.
  unitRegions(unit) {
    this.ensureRegions();
    const size = this.map.size;
    const x = clamp(Math.floor(unit.x), 0, size - 1);
    const y = clamp(Math.floor(unit.y), 0, size - 1);
    const own = this.regionGrid[y * size + x];
    if (own) return [own];
    const found = [];
    for (const [dx, dy] of SIDE_STEPS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const label = this.regionGrid[ny * size + nx];
      if (label && !found.includes(label)) found.push(label);
    }
    return found;
  }

  findBuildingApproach(unit, b) {
    const regions = this.unitRegions(unit);
    if (regions.length === 0) return null;
    const size = this.map.size;
    let best = null;
    let bestD = Infinity;
    for (let x = b.tileX - 1; x <= b.tileX + b.width; x++) {
      for (let y = b.tileY - 1; y <= b.tileY + b.height; y++) {
        if (b.containsTile(x, y)) continue;
        if (!this.isWalkableTile(x, y)) continue;
        if (!regions.includes(this.regionGrid[y * size + x])) continue;
        const d = dist(unit.x, unit.y, x + 0.5, y + 0.5);
        if (d < bestD) {
          bestD = d;
          best = { x: x + 0.5, y: y + 0.5 };
        }
      }
    }
    return best;
  }

  navigateTo(unit, tx, ty, maxNodes = 12000) {
    const path = findPath(this.map, this.blockGrid, unit.x, unit.y, tx, ty, maxNodes);
    if (!path) {
      unit.setPath([]);
      unit.pathGoal = null;
      return false;
    }
    unit.setPath(path);
    unit.pathGoal = { x: tx, y: ty };
    return true;
  }

  // Dělník s nákladem vyrazí do skladu. Když žádný není, náklad si drží a zkusí to později.
  beginDelivery(unit, work) {
    const storage = this.findStorage(unit.ownerId, work.produce, unit);
    const approach = storage ? this.findBuildingApproach(unit, storage) : null;
    if (!storage || !approach) {
      work.storageId = null;
      work.phase = 'waitStorage';
      work.waitTimer = 3;
      return;
    }
    work.storageId = storage.id;
    work.phase = 'toStorage';
    this.navigateTo(unit, approach.x, approach.y);
  }

  // Při sběru dělník obchází okolí zdroje a mezi kroky chvíli postojí.
  roam(unit, work) {
    const cx = work.source.px + 0.5;
    const cy = work.source.py + 0.5;
    for (let i = 0; i < 12; i++) {
      const angle = this.rng() * Math.PI * 2;
      const d = Math.sqrt(this.rng()) * WORK.roamRadius;
      const tx = Math.floor(cx + Math.cos(angle) * d);
      const ty = Math.floor(cy + Math.sin(angle) * d);
      if (!this.isWalkableTile(tx, ty)) continue;
      this.navigateTo(unit, tx + 0.5, ty + 0.5, 400);
      break;
    }
    const [minPause, maxPause] = WORK.roamPause;
    work.roamWait = minPause + (maxPause - minPause) * this.rng();
  }

  updateVillagerWork(unit, dt) {
    const player = this.getPlayer(unit.ownerId);
    if (!player || !unit.work) return;
    const work = unit.work;
    const b = this.buildings.find(x => x.id === work.buildingId);
    if (!b || !b.complete || b.ownerId !== unit.ownerId) {
      // Zdrojová budova zanikla: dělník s nákladem ho ještě doručí, ostatní odejdou.
      if (work.carry <= 0) {
        this.releaseWorker(unit, true);
        return;
      }
      work.depleted = true;
      if (work.phase !== 'toStorage' && work.phase !== 'waitStorage') work.phase = 'toSource';
    }
    if (player.foodShortage) {
      unit.workPaused = true;
      unit.setPath([]);
      return;
    }
    unit.workPaused = false;

    switch (work.phase) {
      case 'toBuilding': {
        // Dělník nejprve dojde k přiřazené hospodářské budově. Teprve tam
        // se započítá mezi její pracovníky a začne hledat zdroj surovin.
        const approach = this.findBuildingApproach(unit, b);
        if (!approach) {
          work.phase = 'wait';
          work.waitTimer = 2;
          return;
        }
        if (this.unitAt(unit, approach.x, approach.y, 1.2)) {
          unit.setPath([]);
          if (!work.arrived) {
            work.arrived = true;
            b.workers = Math.min(b.config.workers, b.workers + 1);
          }
          work.phase = 'toSource';
          return;
        }
        if (unit.path.length === 0 && !this.navigateTo(unit, approach.x, approach.y)) {
          work.phase = 'wait';
          work.waitTimer = 2;
        }
        break;
      }
      case 'toSource': {
        // Dělník s nákladem ho nejdřív doručí, sbírat smí až s prázdnými rukama.
        if (work.carry > 0) {
          this.beginDelivery(unit, work);
          break;
        }
        if (work.depleted) {
          this.releaseWorker(unit, true);
          break;
        }
        if (!work.source) {
          work.source = this.findSource(unit, b);
          if (!work.source) {
            work.phase = 'wait';
            work.waitTimer = 3;
            return;
          }
          this.navigateTo(unit, work.source.px + 0.5, work.source.py + 0.5);
        }
        if (this.unitAt(unit, work.source.px + 0.5, work.source.py + 0.5, 1.0) || unit.path.length === 0) {
          if (this.unitAt(unit, work.source.px + 0.5, work.source.py + 0.5, 2.2)) {
            work.phase = 'gather';
            work.timer = WORK.gatherTime;
            work.roamWait = 0;
            unit.setPath([]);
          } else {
            // Cesta selhala – zkusit jiné místo.
            work.source = null;
            work.phase = 'wait';
            work.waitTimer = 2;
          }
        }
        break;
      }
      case 'gather': {
        work.timer -= dt;
        if (work.timer <= 0) {
          unit.setPath([]);
          work.phase = 'pick';
          break;
        }
        if (unit.path.length > 0) break;
        if (work.roamWait > 0) {
          work.roamWait -= dt;
          break;
        }
        this.roam(unit, work);
        break;
      }
      case 'pick': {
        if (!work.source) {
          work.phase = 'toSource';
          break;
        }
        const ax = work.source.px + 0.5;
        const ay = work.source.py + 0.5;
        if (!this.unitAt(unit, ax, ay, 2.2)) {
          if (unit.path.length === 0 && !this.navigateTo(unit, ax, ay)) {
            work.source = null;
            work.phase = 'wait';
            work.waitTimer = 2;
          }
          break;
        }
        unit.setPath([]);
        const got = this.harvest(unit, b);
        if (unit.work !== work) break;
        if (got <= 0) {
          work.source = null;
          work.phase = 'toSource';
          break;
        }
        work.carry += got;
        this.beginDelivery(unit, work);
        break;
      }
      case 'toStorage': {
        const storage = this.buildings.find(x => x.id === work.storageId && x.ownerId === unit.ownerId && x.complete);
        if (!storage) {
          this.beginDelivery(unit, work);
          break;
        }
        const approach = this.findBuildingApproach(unit, storage);
        if (!approach) {
          work.phase = 'waitStorage';
          work.waitTimer = 3;
          break;
        }
        if (this.unitAt(unit, approach.x, approach.y, 0.9)) {
          const accepted = this.addResource(unit.ownerId, work.produce, work.carry);
          if (accepted > 0) {
            work.carry -= accepted;
            player.stats.gathered += accepted;
            this.emit('gather', {
              playerId: unit.ownerId,
              resource: work.produce,
              amount: accepted,
              x: storage.centerX,
              y: storage.centerY
            });
          }
          if (work.carry <= 0) {
            work.carry = 0;
            work.source = null;
            work.fullStorage = false;
            work.phase = 'toSource';
          } else {
            // Sklad je plný, dělník drží náklad a zkusí to za chvíli znovu.
            work.phase = 'waitStorage';
            work.waitTimer = 3;
            if (!work.fullStorage && this.slowTimer <= 0) {
              work.fullStorage = true;
              const text = work.produce === 'food'
                ? 'Sýpky jsou plné, dělníci čekají.'
                : 'Sklady jsou plné, dělníci čekají.';
              this.emit('toast', { playerId: unit.ownerId, text, kind: 'error' });
            }
          }
        } else if (unit.path.length === 0 && !this.unitAt(unit, approach.x, approach.y, 2.0)) {
          if (!this.navigateTo(unit, approach.x, approach.y)) {
            work.phase = 'waitStorage';
            work.waitTimer = 3;
          }
        }
        break;
      }
      case 'waitStorage': {
        work.waitTimer -= dt;
        if (work.waitTimer <= 0) this.beginDelivery(unit, work);
        break;
      }
      case 'wait': {
        work.waitTimer -= dt;
        if (work.waitTimer <= 0) {
          work.source = null;
          work.phase = work.arrived ? 'toSource' : 'toBuilding';
        }
        break;
      }
      default:
        work.phase = work.arrived ? 'toSource' : 'toBuilding';
    }
  }

  updateVillagerRepair(unit, dt) {
    const b = this.buildings.find(x => x.id === unit.repairBuildingId);
    if (!b || !b.complete || b.ownerId !== unit.ownerId) {
      unit.repairBuildingId = null;
      return;
    }
    if (b.hp >= b.maxHp) {
      b.repair = null;
      unit.repairBuildingId = null;
      this.emit('toast', { playerId: b.ownerId, text: `Oprava dokončena: ${b.config.name}`, kind: 'success' });
      return;
    }
    if (!this.unitAt(unit, b.centerX, b.centerY, Math.max(b.width, b.height) / 2 + 1.6)) {
      if (unit.path.length === 0) {
        this.navigateTo(unit, b.centerX, b.centerY);
      }
      return;
    }
    b.hp = Math.min(b.maxHp, b.hp + 10 * dt);
    if (b.hp >= b.maxHp) {
      b.repair = null;
      unit.repairBuildingId = null;
      this.emit('toast', { playerId: b.ownerId, text: `Oprava dokončena: ${b.config.name}`, kind: 'success' });
    }
  }

  unitAt(unit, x, y, radius = 0.9) {
    return dist(unit.x, unit.y, x, y) <= radius;
  }

  // ------------------------------------------------------------------
  //  Souboj
  // ------------------------------------------------------------------

  nearestEnemy(unit, radius) {
    let best = null;
    let bestD = Infinity;
    for (const other of this.units) {
      if (!isEnemy(unit.ownerId, other.ownerId)) continue;
      const owner = this.getPlayer(other.ownerId);
      if (!owner || !owner.alive) continue;
      const d = dist(unit.x, unit.y, other.x, other.y);
      if (d < bestD && d <= radius) {
        bestD = d;
        best = other;
      }
    }
    if (best) return best;
    for (const b of this.buildings) {
      if (!isEnemy(unit.ownerId, b.ownerId)) continue;
      const d = distanceToBuilding(unit.x, unit.y, b);
      if (d < bestD && d <= radius) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  targetDistance(unit, target) {
    if (!target) return Infinity;
    if (target.width !== undefined) return distanceToBuilding(unit.x, unit.y, target);
    return dist(unit.x, unit.y, target.x, target.y);
  }

  attackTarget(unit, target) {
    if (unit.cooldown > 0) return;
    const def = unit.config;
    unit.cooldown = def.cooldown;
    const player = this.getPlayer(unit.ownerId);
    if (def.projectile) {
      const tx = target.width !== undefined ? target.centerX : target.x;
      const ty = target.width !== undefined ? target.centerY : target.y;
      const d = dist(unit.x, unit.y, tx, ty);
      this.projectiles.push({
        id: this.nextId++,
        ownerId: unit.ownerId,
        sx: unit.x,
        sy: unit.y,
        tx,
        ty,
        x: unit.x,
        y: unit.y,
        t: 0,
        duration: Math.max(0.18, d / 14),
        damage: def.damage,
        targetId: target.id,
        targetIsBuilding: target.width !== undefined,
        missed: false
      });
      this.emit('arrow', { x: unit.x, y: unit.y });
    } else {
      this.dealDamage(target, def.damage, unit.ownerId);
      this.emit('hit', { x: target.x !== undefined ? target.x : target.centerX, y: target.y !== undefined ? target.y : target.centerY });
    }
  }

  dealDamage(target, amount, attackerOwnerId) {
    if (!target) return;
    const attacker = this.getPlayer(attackerOwnerId);
    if (target.width !== undefined) {
      // Budova – obrana 0, poškození přímo.
      target.hp -= amount;
      if (attacker) attacker.stats.damage += amount;
      if (target.hp <= 0) this.removeBuilding(target, { destroyed: true, byPlayerId: attackerOwnerId });
    } else {
      const defense = target.config.armor || 0;
      const dmg = Math.max(1, amount - defense);
      target.hp -= dmg;
      if (attacker) attacker.stats.damage += dmg;
      target.lastDamageTime = this.time;
      if (target.isVillager) {
        target.fleeing = true;
        target.workPaused = true;
      } else if (!target.attackTargetId && target.autoAttack) {
        target.attackTargetId = this.findAttackerId(target, attackerOwnerId);
      }
      if (target.hp <= 0) {
        this.removeUnit(target, { killed: true, byPlayerId: attackerOwnerId });
      }
    }
  }

  findAttackerId(target, attackerOwnerId) {
    // Vyber nejbližší nepřátelskou jednotku jako odvetu.
    let best = null;
    let bestD = Infinity;
    for (const u of this.units) {
      if (u.ownerId !== attackerOwnerId) continue;
      const d = dist(target.x, target.y, u.x, u.y);
      if (d < bestD) { bestD = d; best = u; }
    }
    return best ? best.id : null;
  }

  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const a = this.projectiles[i];
      a.t += dt;
      const t = Math.min(1, a.t / a.duration);
      // Lehký oblouk.
      const arc = Math.sin(t * Math.PI) * Math.min(56, dist(a.sx, a.sy, a.tx, a.ty) * 8);
      a.x = a.sx + (a.tx - a.sx) * t;
      a.y = a.sy + (a.ty - a.sy) * t;
      a.arc = arc;
      if (t >= 1) {
        let hit = null;
        if (a.targetIsBuilding) {
          const b = this.buildings.find(x => x.id === a.targetId);
          if (b && dist(a.tx, a.ty, b.centerX, b.centerY) < Math.max(b.width, b.height)) hit = b;
        } else {
          const u = this.units.find(x => x.id === a.targetId);
          // Šíp může minout pohybující se cíl.
          if (u && dist(a.tx, a.ty, u.x, u.y) < 0.65) hit = u;
        }
        if (hit) {
          this.dealDamage(hit, a.damage, a.ownerId);
          this.emit('hit', { x: a.tx, y: a.ty, ranged: true });
        } else {
          this.emit('miss', { x: a.tx, y: a.ty });
        }
        this.projectiles.splice(i, 1);
      }
    }
  }

  updateUnits(dt) {
    for (const unit of this.units) {
      if (unit.hp <= 0) continue;
      unit.cooldown = Math.max(0, unit.cooldown - dt);
      unit.aggroTimer -= dt;
      unit.repathTimer -= dt;
      this.ejectFromBlockedTile(unit);

      if (unit.isVillager) {
        this.updateVillager(unit, dt);
      } else {
        this.updateMilitary(unit, dt);
      }
      this.moveUnit(unit, dt);
    }
    this.separateUnits();
  }

  updateVillager(unit, dt) {
    if (unit.fleeing) {
      const castle = this.getCastle(unit.ownerId);
      if (!castle) return;
      if (this.unitAt(unit, castle.centerX, castle.centerY, Math.max(castle.width, castle.height) + 1)) {
        unit.fleeing = false;
        if (unit.work) {
          unit.work.phase = unit.work.arrived ? 'toSource' : 'toBuilding';
        }
        unit.workPaused = false;
      } else if (unit.path.length === 0 && unit.repathTimer <= 0) {
        this.navigateTo(unit, castle.centerX, castle.tileY + castle.height + 1.5);
        unit.repathTimer = 1.5;
      }
      return;
    }
    if (unit.build) {
      this.updateVillagerBuild(unit);
      return;
    }
    if (unit.repairBuildingId) {
      this.updateVillagerRepair(unit, dt);
      return;
    }
    if (unit.work) {
      this.updateVillagerWork(unit, dt);
    }
  }

  updateMilitary(unit, dt) {
    const def = unit.config;

    // Cíl souboje
    let target = null;
    if (unit.attackTargetId) {
      target = this.units.find(u => u.id === unit.attackTargetId) ||
               this.buildings.find(b => b.id === unit.attackTargetId) || null;
      if (target) {
        const owner = target.ownerId !== undefined ? this.getPlayer(target.ownerId) : null;
        if (target.hp <= 0 || (target.ownerId !== undefined && !isEnemy(unit.ownerId, target.ownerId)) ||
            (target.ownerId !== undefined && owner && !owner.alive)) {
          target = null;
          unit.attackTargetId = null;
        }
      } else {
        unit.attackTargetId = null;
      }
    }

    // Ručně zadaný přesun má přednost před automatickým útokem. Bez toho
    // jednotka u nepřítele okamžitě zrušila povel a rozběhla se za ním,
    // takže se hráči zdálo, že vojáci nereagují na kliknutí.
    const moving = !!unit.moveTarget;

    if (!target && !moving && unit.autoAttack && unit.aggroTimer <= 0) {
      unit.aggroTimer = 0.5;
      const found = this.nearestEnemy(unit, def.aggro);
      if (found) {
        target = found;
        unit.attackTargetId = found.id;
      }
    }

    if (target) {
      unit.moveTarget = null;
      const d = this.targetDistance(unit, target);
      const reach = def.range + 0.55;
      if (d <= reach) {
        unit.setPath([]);
        unit.angle = Math.atan2(
          (target.y !== undefined ? target.y : target.centerY) - unit.y,
          (target.x !== undefined ? target.x : target.centerX) - unit.x
        );
        this.attackTarget(unit, target);
      } else {
        if (unit.path.length === 0 || unit.repathTimer <= 0) {
          unit.repathTimer = 1.0;
          if (target.width !== undefined) {
            const approach = this.findBuildingApproach(unit, target);
            if (approach) this.navigateTo(unit, approach.x, approach.y);
          } else {
            this.navigateTo(unit, target.x, target.y);
          }
        }
      }
      return;
    }

    // Běžný přesun – dokud jednotka nedorazí, nevyhledává cíle sama.
    if (moving) {
      if (unit.path.length === 0) {
        unit.moveTarget = null;
        unit.autoAttack = true;
      }
      return;
    }

    // Volná jednotka hlídá okolí.
    if (unit.autoAttack && unit.aggroTimer <= 0) {
      unit.aggroTimer = 0.6;
      const found = this.nearestEnemy(unit, def.aggro);
      if (found) unit.attackTargetId = found.id;
    }
  }

  // Jednotka překrytá budovou nebo stromem (nebo vytlačená davem) se přesune
  // na nejbližší volné místo. Voják s rozkazem k přesunu pokračuje dál.
  ejectFromBlockedTile(unit) {
    const size = this.map.size;
    const tx = clamp(Math.floor(unit.x), 0, size - 1);
    const ty = clamp(Math.floor(unit.y), 0, size - 1);
    if (this.isWalkableTile(tx, ty)) return;
    const spot = findNearestWalkable(this.map, this.blockGrid, tx, ty, 6);
    if (!spot) return;
    unit.x = spot.x + 0.5;
    unit.y = spot.y + 0.5;
    if (unit.moveTarget) this.navigateTo(unit, unit.moveTarget.x, unit.moveTarget.y);
    else unit.setPath([]);
  }

  moveUnit(unit, dt) {
    if (!unit.path.length) return;
    let remaining = unit.speed * dt;
    let guard = 0;
    while (remaining > 0 && unit.pathIndex < unit.path.length && guard++ < 20) {
      const wp = unit.path[unit.pathIndex];
      const tx = wp.x + 0.5;
      const ty = wp.y + 0.5;
      const dx = tx - unit.x;
      const dy = ty - unit.y;
      const d = Math.hypot(dx, dy);
      const reach = unit.pathIndex < unit.path.length - 1 ? WAYPOINT_REACH : 0.08;
      if (d < reach) {
        unit.pathIndex++;
        continue;
      }
      const step = Math.min(remaining, d);
      unit.x += (dx / d) * step;
      unit.y += (dy / d) * step;
      unit.angle = Math.atan2(dy, dx);
      remaining -= step;
      if (step >= d - 0.001) unit.pathIndex++;
    }
    if (unit.pathIndex >= unit.path.length) {
      unit.setPath([]);
      unit.stuckTimer = 0;
    }
  }

  separateUnits() {
    const list = this.units;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d <= 0.001 || d >= 0.55) continue;

        const overlap = 0.55 - d;
        const nx = dx / d;
        const ny = dy / d;

        // Jednotka, která dostala povel k přesunu, má přednost. Necháme ji
        // projít davem a uhnout spíš tomu, kdo stojí na místě – jinak se
        // vojáci u hradu navzájem vytlačovali a sotva se hnuli z místa.
        const aMoving = a.path.length > 0 || !!a.moveTarget;
        const bMoving = b.path.length > 0 || !!b.moveTarget;
        let aShare = 0.5;
        if (aMoving !== bMoving) aShare = aMoving ? 0.15 : 0.85;

        // Tlačení nesmí vystrčit jednotku na neprůchozí dlaždici (budova, strom).
        const aX = a.x - nx * overlap * aShare;
        const aY = a.y - ny * overlap * aShare;
        if (this.isWalkableTile(Math.floor(aX), Math.floor(aY))) {
          a.x = aX;
          a.y = aY;
        }
        const bX = b.x + nx * overlap * (1 - aShare);
        const bY = b.y + ny * overlap * (1 - aShare);
        if (this.isWalkableTile(Math.floor(bX), Math.floor(bY))) {
          b.x = bX;
          b.y = bY;
        }
      }
    }
  }

  // ------------------------------------------------------------------
  //  Budovy – postup, výcvik, opravy
  // ------------------------------------------------------------------

  updateBuildings(dt) {
    const builderCounts = this.getBuilderCounts();
    for (const b of this.buildings.slice()) {
      if (!b.complete) {
        const def = b.config;
        if (def.buildTime > 0) {
          const counts = builderCounts.get(b.id);
          const active = counts ? counts.active : 0;
          if (active > 0) {
            b.progress = Math.min(1, b.progress + (dt * buildSpeedFactor(active)) / def.buildTime);
            b.hp = Math.max(1, Math.round(b.maxHp * b.progress));
          }
          if (b.progress >= 1) {
            b.complete = true;
            b.progress = 1;
            b.hp = b.maxHp;
            this.rebuildBlockGrid();
            this.releaseBuildersOf(b.id, true);
            this.emit('buildingComplete', {
              playerId: b.ownerId,
              x: b.centerX,
              y: b.centerY,
              name: def.name
            });
            this.emit('toast', {
              playerId: b.ownerId,
              text: `Stavba dokončena: ${def.name}`,
              kind: 'success'
            });
            this.updateAllCapacities();
          }
        } else {
          b.complete = true;
          b.progress = 1;
          b.hp = b.maxHp;
        }
        continue;
      }

      if (b.repair) {
        const worker = this.units.find(u => u.id === b.repair.workerId);
        if (!worker || worker.hp <= 0) b.repair = null;
      }

      if (b.queue.length > 0) {
        const item = b.queue[0];
        item.remaining -= dt;
        if (item.remaining <= 0) {
          b.queue.shift();
          this.spawnTrainedUnit(b, item.unitType);
          this.recountPopulation(b.ownerId);
        }
      }
    }
  }

  updateDeposits(dt) {
    for (let i = this.pendingDeposits.length - 1; i >= 0; i--) {
      const pending = this.pendingDeposits[i];
      pending.timer -= dt;
      if (pending.timer > 0) continue;
      const castles = this.buildings
        .filter(b => b.type === 'castle' && b.ownerId !== 0)
        .map(b => ({ x: b.centerX, y: b.centerY }));
      const w = pending.type === 'stone' ? 5 : 4;
      const h = w;
      const spot = this.map.findDepositSpot(
        this.map.size / 2, this.map.size / 2, w, h, castles, this.rng
      );
      if (!spot) {
        pending.timer = 20;
        continue;
      }
      const deposit = this.map.spawnDeposit(pending.type, spot.x, spot.y, w, h, pending.amount);
      this.pendingDeposits.splice(i, 1);
      this.emit('depositFound', { x: spot.x + w / 2, y: spot.y + h / 2, type: pending.type });
    }
  }

  // ------------------------------------------------------------------
  //  Ekonomika
  // ------------------------------------------------------------------

  updateEconomy(dt) {
    for (const player of this.players) {
      if (!player.alive) continue;
      const p = player.resources;

      // Daně
      const tax = TAX_LEVELS[player.tax] || TAX_LEVELS.medium;
      p.money += (tax.rate * player.population / 60) * dt;

      // Spotřeba jídla
      let workers = 0;
      let soldiers = 0;
      for (const u of this.units) {
        if (u.ownerId !== player.id) continue;
        if (u.isVillager) {
          if ((u.work || u.build) && !u.workPaused) workers++;
        } else if (u.isMilitary) soldiers++;
      }
      const needPerSec = (workers * WORK.foodPerWorkerMinute + soldiers * WORK.foodPerSoldierMinute) / 60;
      const need = needPerSec * dt;
      if (need > 0) {
        if (p.food >= need) {
          p.food -= need;
          player.foodShortage = false;
        } else {
          p.food = 0;
          player.foodShortage = true;
          if (this.foodWarnTimer <= 0 && player.id === this.humanId) {
            this.emit('toast', { playerId: player.id, text: 'Sýpka je prázdná! Dělníci přestali pracovat.', kind: 'error' });
            this.foodWarnTimer = 12;
          }
        }
      } else {
        player.foodShortage = false;
      }

      // Spokojenost
      let target = 100 + tax.popularity;
      if (p.food <= 0.01) target -= 40;
      else if (p.food < player.population * 0.4) target -= 15;
      target = clamp(target, 0, 100);
      const diff = target - player.popularity;
      const step = Math.sign(diff) * Math.min(Math.abs(diff), 2 * dt);
      player.popularity = clamp(player.popularity + step, 0, 100);

      // Přírůstek poddaných
      if (player.population < player.capacity && this.getCastle(player.id)) {
        player.spawnTimer -= dt;
        if (player.spawnTimer <= 0) {
          player.spawnTimer = 5;
          this.spawnVillager(player.id, this.getCastle(player.id));
          this.recountPopulation(player.id);
          this.emit('citizen', { playerId: player.id });
        }
      } else {
        player.spawnTimer = 5;
      }

      if (!this.fogEnabled) continue;
    }
    this.foodWarnTimer = Math.max(0, this.foodWarnTimer - dt);
    this.slowTimer = Math.max(0, this.slowTimer - dt);
  }

  // ------------------------------------------------------------------
  //  Odebírání entit
  // ------------------------------------------------------------------

  removeUnit(unit, opts = {}) {
    const idx = this.units.indexOf(unit);
    if (idx === -1) return;
    this.units.splice(idx, 1);
    if (unit.work) this.releaseWorker(unit, false);
    if (unit.repairBuildingId) {
      const b = this.buildings.find(x => x.id === unit.repairBuildingId);
      if (b) b.repair = null;
    }
    if (opts.killed) {
      const owner = this.getPlayer(unit.ownerId);
      if (owner) owner.stats.lost++;
      this.emit('unitDied', {
        playerId: unit.ownerId,
        x: unit.x,
        y: unit.y,
        unitType: unit.type
      });
    }
    this.recountPopulation(unit.ownerId);
  }

  removeBuilding(b, opts = {}) {
    const idx = this.buildings.indexOf(b);
    if (idx === -1) return;
    const ownerId = b.ownerId;
    const def = b.config;

    this.releaseAllWorkers(b);
    this.buildings.splice(idx, 1);

    if (opts.destroyed) {
      const owner = this.getPlayer(ownerId);
      if (owner) {
        owner.stats.lost++;
        if (opts.byPlayerId) {
          const attacker = this.getPlayer(opts.byPlayerId);
          if (attacker) attacker.stats.destroyed++;
        }
        this.grantCost(ownerId, def.cost, 0.5);
      }
      this.emit('buildingDestroyed', {
        playerId: ownerId,
        x: b.centerX,
        y: b.centerY,
        name: def.name,
        byPlayerId: opts.byPlayerId || null
      });
      if (ownerId === this.humanId) {
        this.emit('toast', { playerId: ownerId, text: `Budova zničena: ${def.name}`, kind: 'error' });
      }
    }

    // Kapacita obyvatel.
    if (def.population) {
      this.updateAllCapacities();
      const player = this.getPlayer(ownerId);
      if (player) {
        let over = player.population - player.capacity;
        if (over > 0) {
          for (const u of this.units.slice()) {
            if (over <= 0) break;
            if (u.ownerId === ownerId && u.isVillager && !u.work && !u.build) {
              this.removeUnit(u, { silent: true });
              over--;
            }
          }
          this.recountPopulation(ownerId);
        }
      }
    }
    if (def.storage || def.foodStorage) {
      this.enforceStorageCaps(ownerId);
    }

    if (b.type === 'castle') {
      this.defeatPlayer(ownerId);
    }

    this.rebuildBlockGrid();
    this.updateAllCapacities();
  }

  enforceStorageCaps(playerId) {
    const player = this.getPlayer(playerId);
    if (!player) return;
    const caps = this.getStorageCaps(playerId);
    let total = this.getStoredResources(playerId);
    if (total > caps.resources) {
      let excess = total - caps.resources;
      for (const key of ['iron', 'stone', 'wood']) {
        if (excess <= 0) break;
        const take = Math.min(player.resources[key], excess);
        player.resources[key] -= take;
        excess -= take;
      }
    }
    if (player.resources.food > caps.food) {
      player.resources.food = caps.food;
    }
  }

  defeatPlayer(playerId) {
    const player = this.getPlayer(playerId);
    if (!player || !player.alive) return;
    player.alive = false;
    player.defeated = true;
    player.population = 0;

    for (const b of this.buildings) {
      if (b.ownerId !== playerId) continue;
      b.ownerId = 0;
      b.workers = 0;
      b.queue = [];
      b.repair = null;
    }
    for (const u of this.units.slice()) {
      if (u.ownerId === playerId) {
        this.units.splice(this.units.indexOf(u), 1);
      }
    }
    this.rebuildBlockGrid();
    this.emit('defeat', { playerId });
    this.emit('toast', {
      playerId: this.humanId,
      text: playerId === this.humanId
        ? 'Váš Královský hrad padl! Panství je ztraceno.'
        : `Panství hráče ${player.name} padlo.`,
      kind: playerId === this.humanId ? 'error' : 'info'
    });
    this.checkVictory();
  }

  /** Vyřazení odpojeného hráče v multiplayeru. */
  eliminatePlayer(playerId) {
    const player = this.getPlayer(playerId);
    if (!player || !player.alive) return;
    this.defeatPlayer(playerId);
  }

  checkVictory() {
    if (this.ended || this.mode === GAME_MODES.sandbox) return;
    const alive = this.players.filter(p => p.alive && this.getCastle(p.id));
    const human = this.getPlayer(this.humanId);

    if (this.mode !== GAME_MODES.multiplayer) {
      if (!human || !human.alive) {
        this.endGame(alive.length === 1 ? alive[0].id : null);
        return;
      }
    }
    if (alive.length <= 1) {
      this.endGame(alive.length === 1 ? alive[0].id : 0);
    }
  }

  endGame(winnerId) {
    if (this.ended) return;
    this.ended = true;
    this.winnerId = winnerId;
    this.endTime = this.time;
    this.emit('gameEnd', {
      winnerId,
      time: this.time,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        alive: p.alive,
        stats: { ...p.stats }
      }))
    });
  }

  // ------------------------------------------------------------------
  //  Příkazy hráčů
  // ------------------------------------------------------------------

  command(playerId, cmd) {
    if (!cmd || typeof cmd !== 'object') return { ok: false, reason: 'Neplatný příkaz.' };
    const player = this.getPlayer(playerId);
    if (!player || !player.alive) return { ok: false, reason: 'Vaše panství již padlo.' };

    switch (cmd.op) {
      case 'move': {
        const units = this.getOwnedUnits(playerId, cmd.unitIds);
        if (!units.length) return { ok: false, reason: 'Nejsou vybrány žádné jednotky.' };
        const tx = Number(cmd.x);
        const ty = Number(cmd.y);
        if (!Number.isFinite(tx) || !Number.isFinite(ty)) return { ok: false, reason: 'Neplatný cíl.' };
        let moving = 0;
        for (const u of units) {
          if (u.work) this.releaseWorker(u, false);
          this.releaseRepair(u);
          this.releaseBuilder(u, false);
          u.clearOrders();
          u.autoAttack = !u.isVillager;
          u.moveTarget = { x: tx, y: ty };
          if (this.navigateTo(u, tx, ty)) {
            moving++;
          } else {
            u.moveTarget = null;
          }
        }
        if (!moving) return { ok: false, reason: 'Cesta k cíli neexistuje.' };
        return { ok: true, moving };
      }
      case 'attack': {
        const units = this.getOwnedUnits(playerId, cmd.unitIds);
        const target = this.units.find(u => u.id === cmd.targetId) ||
                       this.buildings.find(b => b.id === cmd.targetId);
        if (!units.length) return { ok: false, reason: 'Nejsou vybrány žádné jednotky.' };
        if (!target || !isEnemy(playerId, target.ownerId)) {
          return { ok: false, reason: 'Neplatný cíl útoku.' };
        }
        for (const u of units) {
          if (!u.isMilitary) continue;
          if (u.work) this.releaseWorker(u, false);
          u.clearOrders();
          u.attackTargetId = target.id;
          u.autoAttack = true;
        }
        return { ok: true };
      }
      case 'build': {
        const result = this.placeBuilding(playerId, cmd.buildingType, cmd.x, cmd.y);
        return { ok: result.valid, reason: result.reason, buildingId: result.building ? result.building.id : null };
      }
      case 'train':
        return this.trainUnit(playerId, cmd.buildingId, cmd.unitType);
      case 'assign':
        return this.assignWorkers(playerId, cmd.buildingId, Math.max(1, Number(cmd.count) || 1));
      case 'unassign':
        return this.unassignWorkers(playerId, cmd.buildingId, Math.max(1, Number(cmd.count) || 1));
      case 'repair':
        return this.startRepair(playerId, cmd.buildingId);
      case 'construct': {
        const units = this.getOwnedUnits(playerId, cmd.unitIds);
        if (!units.length) return { ok: false, reason: 'Nejsou vybráni žádní poddaní.' };
        return this.assignBuilders(playerId, cmd.buildingId, units);
      }
      case 'release': {
        const units = this.getOwnedUnits(playerId, cmd.unitIds);
        let released = 0;
        let carrying = 0;
        for (const u of units) {
          if (!u.work && !u.build) continue;
          if (u.work && u.work.carry > 0) {
            carrying++;
            continue;
          }
          this.releaseWorker(u, false);
          this.releaseBuilder(u, false);
          u.clearOrders();
          u.autoAttack = !u.isVillager;
          released++;
        }
        if (!released) {
          return {
            ok: false,
            reason: carrying ? 'Vybraní poddaní nejdřív odevzdají náklad do skladu.' : 'Žádný z vybraných poddaných nepracuje ani nestaví.'
          };
        }
        if (carrying) this.noticeCarrying(playerId);
        return { ok: true, released };
      }
      case 'demolish':
        return this.demolishBuilding(playerId, cmd.buildingId);
      case 'buy':
      case 'sell':
        return this.marketTrade(playerId, cmd.resource, Number(cmd.amount) || 0, cmd.op);
      case 'tax': {
        if (!TAX_LEVELS[cmd.level]) return { ok: false, reason: 'Neplatná daň.' };
        player.tax = cmd.level;
        return { ok: true };
      }
      case 'ping':
        return { ok: true };
      default:
        return { ok: false, reason: 'Neznámý příkaz.' };
    }
  }

  getOwnedUnits(playerId, ids) {
    if (!Array.isArray(ids)) return [];
    return this.units.filter(u => u.ownerId === playerId && ids.includes(u.id));
  }

  marketTrade(playerId, resource, amount, mode) {
    const price = MARKET_PRICES[resource];
    const player = this.getPlayer(playerId);
    if (!player || !player.alive) return { ok: false, reason: 'Vaše panství již padlo.' };
    if (!price) return { ok: false, reason: 'Neplatná surovina.' };
    amount = Math.floor(amount);
    if (amount <= 0 || amount > 5000) return { ok: false, reason: 'Neplatné množství.' };
    const hasMarket = this.buildings.some(b => b.ownerId === playerId && b.complete && b.type === 'market');
    if (!hasMarket) return { ok: false, reason: 'Nejprve postavte Obchod.' };

    if (mode === 'buy') {
      const total = price.buy * amount;
      if (player.resources.money < total) return { ok: false, reason: 'Nedostatek peněz.' };
      const caps = this.getStorageCaps(playerId);
      const free = resource === 'food'
        ? caps.food - player.resources.food
        : caps.resources - this.getStoredResources(playerId);
      if (free < amount) {
        const where = resource === 'food' ? 'V sýpkách' : 'Ve skladech';
        return { ok: false, reason: `${where} není dost místa.` };
      }
      player.resources.money -= total;
      player.resources[resource] += amount;
      return { ok: true, spent: total };
    }
    if (player.resources[resource] < amount) return { ok: false, reason: 'Nemáte dost surovin k prodeji.' };
    player.resources[resource] -= amount;
    player.resources.money += price.sell * amount;
    return { ok: true, earned: price.sell * amount };
  }

  // ------------------------------------------------------------------
  //  Hlavní smyčka
  // ------------------------------------------------------------------

  tick(dt = 1 / 20) {
    if (this.ended) return;
    this.time += dt;
    this.tickCount++;

    this.updateBuildings(dt);
    this.updateUnits(dt);
    this.updateProjectiles(dt);
    this.updateEconomy(dt);
    this.updateDeposits(dt);

    // Efekty (zásahy, šípy).
    for (let i = this.effects.length - 1; i >= 0; i--) {
      this.effects[i].life -= dt;
      if (this.effects[i].life <= 0) this.effects.splice(i, 1);
    }

    this.map.update(dt, this.blockGrid);

    if (this.fogEnabled) {
      this.fogTimer -= dt;
      if (this.fogTimer <= 0) {
        this.fogTimer = 0.5;
        this.recomputeFog();
      }
    }

    this.botTimer -= dt;
    if (this.botTimer <= 0) {
      this.botTimer = 1;
      for (const p of this.players) {
        if (p.isBot && p.alive) {
          try {
            updateBot(this, p, 1);
          } catch (err) {
            console.error('Chyba bota', err);
          }
        }
      }
    }

    this.checkVictory();
  }

  emit(type, data = {}) {
    const ev = { seq: ++this.eventSeq, type, ...data };
    this.events.push(ev);
    if (this.events.length > 400) this.events.splice(0, 100);
    return ev;
  }

  // ------------------------------------------------------------------
  //  Serializace (multiplayer)
  // ------------------------------------------------------------------

  serialize(playerId) {
    const viewer = this.getPlayer(playerId) || this.players[0];
    const fog = this.fogEnabled;
    const vis = (x, y) => !fog || this.isVisible(playerId, x, y);

    const builderCounts = this.getBuilderCounts();
    const buildings = [];
    for (const b of this.buildings) {
      if (fog && b.ownerId !== playerId && !vis(b.centerX, b.centerY)) continue;
      buildings.push({
        id: b.id,
        type: b.type,
        ownerId: b.ownerId,
        tileX: b.tileX,
        tileY: b.tileY,
        hp: Math.round(b.hp),
        maxHp: b.maxHp,
        progress: b.progress,
        complete: b.complete,
        workers: b.workers,
        builders: builderCounts.get(b.id) || { active: 0, total: 0 },
        depositId: b.depositId,
        repair: !!b.repair,
        queue: b.queue.map(q => ({
          unitType: q.unitType,
          remaining: Math.round(q.remaining * 10) / 10,
          total: q.total
        }))
      });
    }

    const units = [];
    for (const u of this.units) {
      if (fog && u.ownerId !== playerId && !vis(u.x, u.y)) continue;
      units.push({
        id: u.id,
        type: u.type,
        ownerId: u.ownerId,
        x: Math.round(u.x * 100) / 100,
        y: Math.round(u.y * 100) / 100,
        hp: Math.round(u.hp),
        maxHp: u.maxHp,
        work: !!u.work,
        build: !!u.build,
        carry: u.work ? u.work.carry : 0,
        fleeing: u.fleeing,
        moving: u.path.length > 0
      });
    }

    const projectiles = [];
    for (const a of this.projectiles) {
      if (fog && a.ownerId !== playerId && !vis(a.x, a.y)) continue;
      projectiles.push({
        id: a.id,
        x: Math.round(a.x * 100) / 100,
        y: Math.round(a.y * 100) / 100,
        arc: Math.round(a.arc || 0),
        tx: a.tx,
        ty: a.ty
      });
    }

    return {
      time: Math.round(this.time * 10) / 10,
      tick: this.tickCount,
      ended: this.ended,
      winnerId: this.winnerId,
      fog: this.fogEnabled,
      mode: this.mode,
      capital: this.capitalKey,
      seed: this.seed,
      mapType: this.mapType,
      selfId: viewer.id,
      self: {
        resources: {
          money: Math.floor(viewer.resources.money),
          wood: Math.floor(viewer.resources.wood),
          stone: Math.floor(viewer.resources.stone),
          food: Math.floor(viewer.resources.food),
          iron: Math.floor(viewer.resources.iron)
        },
        tax: viewer.tax,
        popularity: Math.round(viewer.popularity),
        population: viewer.population,
        capacity: viewer.capacity,
        foodShortage: viewer.foodShortage,
        stats: { ...viewer.stats }
      },
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        color: p.color,
        colorName: p.colorName,
        isBot: p.isBot,
        alive: p.alive,
        popularity: Math.round(p.popularity),
        population: p.population,
        capacity: p.capacity,
        stats: { ...p.stats }
      })),
      buildings,
      units,
      projectiles,
      deposits: this.map.deposits.map(d => ({
        id: d.id,
        type: d.type,
        amount: Math.round(d.amount),
        maxAmount: d.maxAmount,
        active: d.active,
        tiles: d.tiles
      })),
      mapChangesSince: this.mapChangeSeq
    };
  }

  getMapChangesSince(seq) {
    const changes = this.mapChanges.filter(c => c.seq > seq);
    return { changes, seq: this.mapChangeSeq };
  }

  // ------------------------------------------------------------------
  //  Ukládání a načtení místní hry
  // ------------------------------------------------------------------

  /** Kompletní stav simulace pro localStorage (na rozdíl od síťového snímku). */
  toSaveState(meta = {}) {
    const savedAt = meta.savedAt || new Date().toISOString();
    return {
      version: 1,
      meta: {
        startedAt: meta.startedAt || savedAt,
        savedAt,
        options: meta.options ? { ...meta.options } : null
      },
      sim: {
        seed: this.seed,
        mapType: this.mapType,
        mode: this.mode,
        fogEnabled: this.fogEnabled,
        capitalKey: this.capitalKey,
        humanId: this.humanId,
        nextId: this.nextId,
        time: this.time,
        tickCount: this.tickCount,
        ended: this.ended,
        winnerId: this.winnerId,
        endTime: this.endTime,
        fogTimer: this.fogTimer,
        botTimer: this.botTimer,
        slowTimer: this.slowTimer,
        foodWarnTimer: this.foodWarnTimer,
        eventSeq: this.eventSeq,
        mapChangeSeq: this.mapChangeSeq,
        pendingDeposits: this.pendingDeposits.map(p => ({ ...p })),
        players: this.players.map(p => ({
          ...p,
          resources: { ...p.resources },
          stats: { ...p.stats },
          bot: { ...p.bot }
        })),
        buildings: this.buildings.map(b => ({
          ...b,
          queue: b.queue.map(q => ({ ...q })),
          repair: b.repair ? { ...b.repair } : null,
          assignedWorkerIds: (b.assignedWorkerIds || []).slice()
        })),
        units: this.units.map(u => ({
          ...u,
          path: (u.path || []).map(p => ({ x: p.x, y: p.y })),
          moveTarget: u.moveTarget ? { ...u.moveTarget } : null,
          work: u.work
            ? { ...u.work, source: u.work.source ? { ...u.work.source } : null }
            : null,
          build: u.build ? { ...u.build } : null
        })),
        projectiles: this.projectiles.map(p => ({ ...p })),
        fogData: [...this.fogData.entries()].map(([id, data]) => ({
          id,
          explored: Array.from(data.explored),
          visible: Array.from(data.visible)
        })),
        map: this.map.toSaveState()
      }
    };
  }

  static fromSaveState(saved) {
    const state = saved && saved.sim ? saved.sim : saved;
    if (!state || !Array.isArray(state.players) || !state.map) {
      throw new Error('Uložená hra je poškozená.');
    }
    const map = GameMap.fromSaveState(state.map);
    const sim = new GameSim({
      seed: state.seed,
      mapType: state.mapType,
      mode: state.mode,
      capital: state.capitalKey,
      fog: !!state.fogEnabled,
      map,
      players: state.players
    });
    sim.restoreSaveState(state);
    return sim;
  }

  restoreSaveState(state) {
    this.seed = (state.seed >>> 0) || 1;
    this.mapType = state.mapType || this.mapType;
    this.mode = state.mode || this.mode;
    this.fogEnabled = !!state.fogEnabled;
    this.capitalKey = state.capitalKey || this.capitalKey;
    this.humanId = state.humanId || this.humanId;
    this.nextId = state.nextId || 1;
    this.time = Number(state.time) || 0;
    this.tickCount = state.tickCount || 0;
    this.ended = !!state.ended;
    this.winnerId = state.winnerId ?? null;
    this.endTime = Number(state.endTime) || 0;
    this.fogTimer = Number(state.fogTimer) || 0;
    this.botTimer = Number(state.botTimer) || 1;
    this.slowTimer = Number(state.slowTimer) || 0;
    this.foodWarnTimer = Number(state.foodWarnTimer) || 0;
    this.eventSeq = state.eventSeq || 0;
    this.mapChangeSeq = state.mapChangeSeq || 0;
    this.pendingDeposits = (state.pendingDeposits || []).map(p => ({ ...p }));

    this.rng = createRng((this.seed ^ 0x9e3779b9) >>> 0);
    this.events = [];
    this.mapChanges = [];
    this.map.onChange = (idx, res) => {
      this.regionsDirty = true;
      this.mapChanges.push({ seq: ++this.mapChangeSeq, i: idx, r: res });
      if (this.mapChanges.length > 6000) this.mapChanges.splice(0, 1000);
    };

    this.players = (state.players || []).map(p => ({
      ...p,
      resources: { ...(p.resources || {}) },
      stats: { ...(p.stats || {}) },
      bot: { ...(p.bot || {}) },
      alive: p.alive !== false
    }));
    this.playerById = new Map(this.players.map(p => [p.id, p]));

    // Jednotky obnovíme první – podle jejich práce se dopočítají dělníci budov.
    this.units = (state.units || []).map(raw => {
      const unit = new Unit(raw.id, raw.type, raw.ownerId, raw.x, raw.y);
      Object.assign(unit, raw);
      unit.path = Array.isArray(raw.path)
        ? raw.path.map(p => ({ x: p.x, y: p.y }))
        : [];
      unit.pathIndex = raw.pathIndex || 0;
      unit.moveTarget = raw.moveTarget ? { ...raw.moveTarget } : null;
      unit.work = raw.work
        ? { ...raw.work, source: raw.work.source ? { ...raw.work.source } : null }
        : null;
      unit.build = raw.build ? { ...raw.build } : null;
      return unit;
    });

    const assignedByBuilding = new Map();
    for (const u of this.units) {
      if (!u.work) continue;
      if (!assignedByBuilding.has(u.work.buildingId)) assignedByBuilding.set(u.work.buildingId, []);
      assignedByBuilding.get(u.work.buildingId).push(u.id);
    }

    this.buildings = (state.buildings || []).map(raw => {
      const building = new Building(
        raw.id, raw.type, raw.ownerId || 0, raw.tileX, raw.tileY, raw.complete !== false
      );
      Object.assign(building, raw);
      building.width = building.config.w;
      building.height = building.config.h;
      building.queue = (raw.queue || []).map(q => ({ ...q }));
      building.repair = raw.repair ? { ...raw.repair } : null;
      building.depositId = raw.depositId ?? null;
      building.assignedWorkerIds = assignedByBuilding.get(building.id) || [];
      building.workers = this.units.filter(u =>
        u.work && u.work.buildingId === building.id && u.work.arrived
      ).length;
      if (raw.isCastle) building.isCastle = true;
      return building;
    });
    // Starší uložené hry neukládají surovinu, kterou dělník odnáší.
    for (const u of this.units) {
      if (!u.work || u.work.produce) continue;
      const b = this.buildings.find(x => x.id === u.work.buildingId);
      if (b) u.work.produce = b.config.produce;
      else u.work = null;
    }

    // Stavitel musí stát u rozestavěné budovy stejného hráče, jinak jeho stav zrušíme.
    for (const u of this.units) {
      if (!u.build) continue;
      const site = this.buildings.find(b => b.id === u.build.buildingId);
      if (site && !site.complete && site.ownerId === u.ownerId) continue;
      u.build = null;
      u.workPaused = false;
    }

    this.projectiles = (state.projectiles || []).map(p => ({ ...p }));

    const size = this.map.size * this.map.size;
    const savedFog = new Map((state.fogData || []).map(f => [f.id, f]));
    this.fogData = new Map();
    for (const p of this.players) {
      const fog = savedFog.get(p.id);
      const explored = fog && fog.explored && fog.explored.length === size
        ? Uint8Array.from(fog.explored)
        : new Uint8Array(size);
      const visible = fog && fog.visible && fog.visible.length === size
        ? Uint8Array.from(fog.visible)
        : new Uint8Array(size);
      this.fogData.set(p.id, { explored, visible });
    }

    this.blockGrid = new Uint8Array(size);
    this.rebuildBlockGrid();
    this.updateAllCapacities();
    if (this.fogEnabled) this.recomputeFog();
    else this.markAllVisible();

    return this;
  }
}
