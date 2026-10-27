import { Building, Unit } from './entities.js';
import { createRng } from './rng.js';
import { legacyGateRotation, rotatedBuildingSize } from './building-orientation.js';
import { AUTO_MARKET_INTERVAL } from './constants.js';

export class SimulationSave {
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
        marketTimer: this.marketTimer,
        eventSeq: this.eventSeq,
        mapChangeSeq: this.mapChangeSeq,
        pendingDeposits: this.pendingDeposits.map(p => ({ ...p })),
        players: this.players.map(p => ({
          ...p,
          resources: { ...p.resources },
          marketRules: Object.fromEntries(Object.entries(p.marketRules).map(([key, rule]) => [key, { ...rule }])),
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
          build: u.build ? { ...u.build } : null,
          garrison: u.garrison ? { ...u.garrison } : null
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
    this.marketTimer = Number.isFinite(state.marketTimer) && state.marketTimer > 0
      ? state.marketTimer : AUTO_MARKET_INTERVAL;
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

    this.players = (state.players || []).map(p => {
      const player = {
        ...p,
        resources: { ...(p.resources || {}) },
        marketRules: Object.fromEntries(Object.entries(p.marketRules || {}).map(([key, rule]) => [key, { ...rule }])),
        stats: { ...(p.stats || {}) },
        bot: { ...(p.bot || {}) },
        alive: p.alive !== false,
        foodDebt: Number(p.foodDebt) || 0
      };
      delete player.tax;
      delete player.popularity;
      return player;
    });
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
      unit.garrison = raw.garrison ? { ...raw.garrison } : null;
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
        raw.id, raw.type, raw.ownerId || 0, raw.tileX, raw.tileY, raw.complete !== false,
        raw.rotation === undefined ? 0 : raw.rotation
      );
      Object.assign(building, raw);
      const size = rotatedBuildingSize(building.config, building.rotation);
      building.width = size.width;
      building.height = size.height;
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
    for (let i = 0; i < this.buildings.length; i++) {
      if (this.buildings[i].type === 'gate' && state.buildings[i].rotation === undefined) {
        this.buildings[i].rotation = legacyGateRotation(this.buildings[i], this.buildings);
      }
    }
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
