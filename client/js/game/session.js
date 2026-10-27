import { t } from '../i18n/index.js';
import { GameSim, distanceToBuilding } from '../sim/sim.js';
import { GameMap } from '../sim/mapgen.js';
import { validatePlacement } from '../sim/placement.js';
import { validateWallLine } from '../sim/wall-line.js';
import { rotatedBuildingSize } from '../sim/building-orientation.js';
import { stepSimulation } from './game-speed.js';
import {
  BUILDING_DEFS, UNIT_DEFS, FOG_RANGES, GAME_MODES
} from '../sim/constants.js';

/**
 * Společné rozhraní pro singleplayer (autoritativní lokální simulace)
 * a multiplayer (snímky ze serveru).
 */
class BaseSession {
  constructor() {
    this.selection = [];
    this.selectedBuilding = null;
    this.eventCursor = 0;
    this.pendingEvents = [];
    this.lastAlert = null;
  }

  get player() {
    return this.state.players.find(p => p.id === this.selfId) || null;
  }

  canPlaceWall(x1, y1, x2, y2) {
    return validateWallLine(this.state.map, this.state.buildings, this.selfId, this.player,
      this.castle, this.state.units, x1, y1, x2, y2);
  }

  get castle() {
    return this.state.buildings.find(b =>
      b.type === 'castle' && b.ownerId === this.selfId && b.complete
    ) || null;
  }

  get selectedUnits() {
    return this.selection;
  }

  selectUnits(units) {
    this.selection = units.slice(0, 60);
    this.selectedBuilding = null;
  }

  selectBuilding(building) {
    this.selectedBuilding = building;
    this.selection = [];
  }

  clearSelection() {
    this.selection = [];
    this.selectedBuilding = null;
  }

  pruneSelection() {
    const unitIds = new Set(this.state.units.map(u => u.id));
    const buildingIds = new Set(this.state.buildings.map(b => b.id));
    this.selection = this.selection.filter(u => unitIds.has(u.id));
    if (this.selectedBuilding && !buildingIds.has(this.selectedBuilding.id)) {
      this.selectedBuilding = null;
    }
  }

  getBuilderInfo(building) {
    return building.builders || { active: 0, total: 0 };
  }

  isEntityVisible(entity) {
    if (!this.state.fogEnabled) return true;
    if (entity.ownerId === this.selfId) return true;
    const fog = this.getFog();
    if (!fog) return true;
    const x = entity.width !== undefined ? entity.centerX : entity.x;
    const y = entity.width !== undefined ? entity.centerY : entity.y;
    return this.isVisibleAt(x, y);
  }

  getFog() {
    return null;
  }

  isVisibleAt() {
    return true;
  }

  isExploredAt() {
    return true;
  }

  command(cmd) {
    return { ok: false, reason: t("Příkazy nejsou dostupné.") };
  }

  drainEvents() {
    const events = this.pendingEvents;
    this.pendingEvents = [];
    return events;
  }
}

export class LocalSession extends BaseSession {
  constructor(opts = {}) {
    super();
    this.local = true;
    this.sim = opts.sim || new GameSim(opts);
    this.state = this.sim;
    this.selfId = this.sim.humanId;
    this.playerId = this.selfId;
    this.mode = this.sim.mode;
    this.fogEnabled = this.sim.fogEnabled;
    this.lastEvent = 0;
    this.startedAt = opts.startedAt || new Date().toISOString();
    this.startOptions = opts.startOptions ? { ...opts.startOptions } : null;
    this.speed = 1;
  }

  tick(dt) {
    stepSimulation(this.sim, dt, this.speed);
    this.pruneSelection();
  }

  command(cmd) {
    const result = this.sim.command(this.selfId, cmd);
    return result;
  }

  // Lokální stav je přímo simulace, která pole builders nemá, takže počty bereme z ní.
  getBuilderInfo(building) {
    return this.sim.getBuilderCounts().get(building.id) || { active: 0, total: 0 };
  }

  canPlace(type, x, y, rotation = 0) {
    return this.sim.canPlaceBuilding(this.selfId, type, x, y, rotation);
  }

  getFog() {
    if (!this.sim.fogEnabled) return null;
    return this.sim.fogData.get(this.selfId) || null;
  }

  isVisibleAt(x, y) {
    return this.sim.isVisible(this.selfId, x, y);
  }

  isExploredAt(x, y) {
    return this.sim.isExplored(this.selfId, x, y);
  }

  drainEvents() {
    const events = this.sim.events.filter(e => e.seq > this.lastEvent);
    if (events.length) this.lastEvent = events[events.length - 1].seq;
    return events;
  }
}

/**
 * Klientský stav v multiplayeru. Server posílá autoritativní snímky;
 * pozice jednotek se mezi snímky interpolují.
 */
export class RemoteSession extends BaseSession {
  constructor(config, net) {
    super();
    this.local = false;
    this.net = net;
    this.selfId = config.selfId;
    this.mode = GAME_MODES.multiplayer;
    this.map = new GameMap(config.seed, config.mapType);
    this.state = {
      map: this.map,
      buildings: [],
      units: [],
      projectiles: [],
      players: (config.players || []).map(p => ({ ...p })),
      time: 0,
      ended: false,
      winnerId: null,
      fogEnabled: !!config.fog,
      mode: GAME_MODES.multiplayer,
      selfId: config.selfId,
      capital: config.capital || 'medium',
      seed: config.seed,
      mapType: config.mapType,
      effects: []
    };
    this.selfId = config.selfId;
    this.unitById = new Map();
    this.buildingById = new Map();
    this.mapCursor = config.mapChangeSeq || 0;
    this.net = net;
    this.visibilityTimer = 0;
    this.fogData = this.state.fogEnabled ? {
      explored: new Uint8Array(this.map.size * this.map.size),
      visible: new Uint8Array(this.map.size * this.map.size)
    } : null;
    this.lastSnapshotAt = performance.now();
    this.connectionLost = false;
    if (this.fogData) this.recomputeVisibility();
    this.applyMapChanges(config.mapChanges || [], config.mapChangeSeq || 0);
  }

  applyMapChanges(changes, seq) {
    if (!changes || !changes.length) {
      if (seq !== undefined) this.mapCursor = Math.max(this.mapCursor, seq);
      return;
    }
    for (const change of changes) {
      const x = change.i % this.map.size;
      const y = Math.floor(change.i / this.map.size);
      this.map.resources[change.i] = change.r;
      if (change.r === 0) this.map.depositAt[change.i] = 0;
    }
    this.mapCursor = Math.max(this.mapCursor, seq || 0);
  }

  applyDeposits(deposits) {
    if (!deposits) return;
    for (const d of deposits) {
      const local = this.map.deposits.find(x => x.id === d.id);
      if (local) {
        local.amount = d.amount;
        local.active = d.active;
        local.maxAmount = d.maxAmount || local.maxAmount;
      } else if (d.active) {
        // Ložisko vzniklé během hry – dlaždice přijdou ze serveru.
        const entry = { ...d, tiles: d.tiles ? d.tiles.slice() : [] };
        this.map.deposits.push(entry);
        for (const i of entry.tiles) {
          if (i >= 0 && i < this.map.depositAt.length) this.map.depositAt[i] = entry.id;
        }
      }
    }
  }

  applySnapshot(snap) {
    this.lastSnapshotAt = performance.now();
    this.connectionLost = false;
    this.state.time = snap.time;
    this.state.ended = snap.ended;
    this.state.winnerId = snap.winnerId;
    this.state.players = snap.players.map(p => {
      const existing = this.state.players.find(x => x.id === p.id);
      return existing ? Object.assign(existing, p) : { ...p };
    });
    const self = this.state.players.find(p => p.id === this.selfId);
    if (self && snap.self) {
      self.resources = snap.self.resources;
      self.population = snap.self.population;
      self.capacity = snap.self.capacity;
      self.foodShortage = snap.self.foodShortage;
      self.marketRules = snap.self.marketRules || {};
      self.stats = snap.self.stats;
    }
    this.applyDeposits(snap.deposits);

    const seenBuildings = new Set();
    for (const raw of snap.buildings) {
      seenBuildings.add(raw.id);
      let b = this.buildingById.get(raw.id);
      if (!b) {
        b = { id: raw.id };
        this.buildingById.set(raw.id, b);
      }
      Object.assign(b, raw);
      const def = BUILDING_DEFS[raw.type];
      b.config = def;
      const size = rotatedBuildingSize(def, raw.rotation || 0);
      b.width = size.width;
      b.height = size.height;
      b.centerX = b.tileX + b.width / 2;
      b.centerY = b.tileY + b.height / 2;
      b.containsTile = (x, y) =>
        x >= b.tileX && x < b.tileX + b.width && y >= b.tileY && y < b.tileY + b.height;
    }
    for (const [id, b] of this.buildingById) {
      if (!seenBuildings.has(id)) this.buildingById.delete(id);
    }
    this.state.buildings = [...this.buildingById.values()];

    const seenUnits = new Set();
    for (const raw of snap.units) {
      seenUnits.add(raw.id);
      let u = this.unitById.get(raw.id);
      if (!u) {
        u = { id: raw.id, x: raw.x, y: raw.y };
        this.unitById.set(raw.id, u);
      }
      const prevX = u.x;
      const prevY = u.y;
      const wasGarrisoned = !!u.garrison?.entered;
      Object.assign(u, raw);
      const garrisonChanged = wasGarrisoned !== !!u.garrison?.entered;
      u.x = garrisonChanged ? raw.x : prevX;
      u.y = garrisonChanged ? raw.y : prevY;
      u.targetX = raw.x;
      u.targetY = raw.y;
      u.config = UNIT_DEFS[raw.type];
      u.isMilitary = u.config.kind === 'military';
      u.isVillager = u.config.kind === 'villager';
    }
    for (const [id, u] of this.unitById) {
      if (!seenUnits.has(id)) this.unitById.delete(id);
    }
    this.state.units = [...this.unitById.values()];

    this.state.projectiles = snap.projectiles || [];
    this.state.deposits = snap.deposits;

    if (snap.mapChanges && snap.mapChanges.length) {
      this.applyMapChanges(snap.mapChanges, snap.mapChangesSince);
    }

    this.pruneSelection();
    this.visibilityTimer = 0;
    if (this.fogData) this.recomputeVisibility();
    else {
      this.state.fogEnabled = false;
    }
  }

  tick(dt) {
    // Plynulé dolaďování pozic mezi snímky.
    const k = Math.min(1, dt * 12);
    for (const u of this.state.units) {
      u.cooldown = Math.max(0, (u.cooldown || 0) - dt);
      if (u.targetX === undefined) continue;
      const dx = u.targetX - u.x;
      const dy = u.targetY - u.y;
      if (Math.abs(dx) < 0.02 && Math.abs(dy) < 0.02) {
        u.x = u.targetX;
        u.y = u.targetY;
      } else {
        u.x += dx * k;
        u.y += dy * k;
      }
    }
    for (let i = this.state.projectiles.length - 1; i >= 0; i--) {
      // Šípy jsou jen vizuální; server rozhoduje o zásahu.
    }
    if (this.state.fogEnabled) {
      this.visibilityTimer -= dt;
      if (this.visibilityTimer <= 0) {
        this.visibilityTimer = 0.35;
        this.recomputeVisibility();
      }
    }
    this.pruneSelection();
  }

  recomputeVisibility() {
    if (!this.fogData) return;
    const size = this.map.size;
    const { visible, explored } = this.fogData;
    visible.fill(0);
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
          visible[i] = 1;
          explored[i] = 1;
        }
      }
    };
    for (const u of this.state.units) {
      if (u.ownerId === this.selfId) reveal(u.x, u.y, FOG_RANGES.unit);
    }
    for (const b of this.state.buildings) {
      if (b.ownerId !== this.selfId) continue;
      const range = b.type === 'castle' ? FOG_RANGES.building + 2 : FOG_RANGES.building;
      reveal(b.centerX, b.centerY, range + Math.max(b.width, b.height) * 0.5);
    }
  }

  getFog() {
    return this.fogData;
  }

  isVisibleAt(x, y) {
    if (!this.fogData) return true;
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix < 0 || iy < 0 || ix >= this.map.size || iy >= this.map.size) return false;
    return this.fogData.visible[iy * this.map.size + ix] === 1;
  }

  isExploredAt(x, y) {
    if (!this.fogData) return true;
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix < 0 || iy < 0 || ix >= this.map.size || iy >= this.map.size) return false;
    return this.fogData.explored[iy * this.map.size + ix] === 1;
  }

  canPlace(type, x, y, rotation = 0) {
    const player = this.player;
    const def = BUILDING_DEFS[type];
    const canAfford = !!(player && def && player.resources && Object.keys(def.cost).every(
      key => (player.resources[key] || 0) >= (def.cost[key] || 0)
    ));
    return validatePlacement(this.map, this.state.buildings, this.selfId, type, x, y, {
      alive: player ? player.alive : true,
      castle: this.castle,
      units: this.state.units,
      rotation,
      canAfford
    });
  }

  command(cmd) {
    if (this.net) this.net.send({ type: 'command', cmd });
    return { ok: true, pending: true };
  }

  enqueueEvents(events) {
    if (Array.isArray(events)) this.pendingEvents.push(...events);
  }

  drainEvents() {
    const events = this.pendingEvents;
    this.pendingEvents = [];
    return events;
  }

  dispose() {
    if (this.net) this.net.close();
  }
}

export { distanceToBuilding };
