import { RESOURCE_TYPES, BUILDING_DEFS, buildSpeedFactor } from './constants.js';
import { Building } from './entities.js';
import { findNearestWalkable } from './pathfinding.js';
import { validatePlacement } from './placement.js';
import { notice } from './messages.js';
import { validateWallLine } from './wall-line.js';
import { distanceToBuilding, isEnemy } from './sim-geometry.js';
import { rotatedBuildingSize } from './building-orientation.js';

const GATE_ENEMY_DISTANCE = 6;

export class SimulationBuildings {
  updateGate(gate) {
    const enemyNearby = this.units.some(unit => unit.hp > 0 && isEnemy(gate.ownerId, unit.ownerId) &&
      distanceToBuilding(unit.x, unit.y, gate) <= GATE_ENEMY_DISTANCE);
    const open = gate.complete && gate.gateDesiredOpen && !enemyNearby;
    if (gate.gateOpen !== open) {
      gate.gateOpen = open;
      this.rebuildBlockGrid();
      if (!open) {
        for (const unit of this.units) {
          const entry = unit.gateEntry;
          if (!entry || entry.gateId !== gate.id ||
              !gate.containsTile(Math.floor(unit.x), Math.floor(unit.y))) continue;
          unit.gateEntry = null;
          if (!this.isWalkableTile(Math.floor(entry.x), Math.floor(entry.y))) continue;
          unit.x = entry.x;
          unit.y = entry.y;
          const goal = unit.moveTarget || unit.pathGoal;
          if (goal) this.navigateTo(unit, goal.x, goal.y);
          else unit.setPath([]);
        }
      }
    }
  }

  setGate(playerId, buildingId, open) {
    const gate = this.buildings.find(b => b.id === buildingId);
    if (!gate || !gate.config.gate || gate.ownerId !== playerId || !gate.complete || typeof open !== 'boolean') {
      return { ok: false, reason: 'Tuto bránu nelze ovládat.' };
    }
    gate.gateDesiredOpen = open;
    this.updateGate(gate);
    return { ok: true };
  }

  placeWallLine(playerId, x1, y1, x2, y2) {
    const check = validateWallLine(this.map, this.buildings, playerId, this.getPlayer(playerId),
      this.getCastle(playerId), this.units, x1, y1, x2, y2);
    if (!check.valid) return { ok: false, reason: check.reason, message: check.message };
    for (const tile of check.tiles) {
      const result = this.placeBuilding(playerId, 'wall', tile.x, tile.y, { notify: false });
      if (!result.valid) throw new Error(`Wall placement failed after validation: ${result.reason}`);
    }
    this.emit('toast', {
      playerId,
      ...notice('Stavba hradeb zahájena: {0} dílů', { 0: check.tiles.length }),
      kind: 'info'
    });
    return { ok: true, count: check.tiles.length };
  }

  canPlaceBuilding(playerId, type, x, y, rotation = 0) {
    const player = this.getPlayer(playerId);
    const def = BUILDING_DEFS[type];
    return validatePlacement(this.map, this.buildings, playerId, type, x, y, {
      alive: player ? player.alive : false,
      castle: this.getCastle(playerId),
      units: this.units,
      rotation,
      canAfford: player && def ? this.canAfford(playerId, def.cost) : false
    });
  }

  placeBuilding(playerId, type, x, y, opts = {}) {
    const rotation = opts.rotation === undefined ? 0 : opts.rotation;
    const check = this.canPlaceBuilding(playerId, type, x, y, rotation);
    if (!check.valid) return check;
    const def = BUILDING_DEFS[type];
    const { width, height } = rotatedBuildingSize(def, rotation);

    if (!this.spend(playerId, def.cost)) {
      return { valid: false, reason: 'Nedostatek surovin.' };
    }

    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const tx = x + dx;
        const ty = y + dy;
        if (this.map.getResource(tx, ty) === RESOURCE_TYPES.TREE) {
          this.map.setResource(tx, ty, RESOURCE_TYPES.NONE);
        }
      }
    }

    const building = new Building(this.nextId++, type, playerId, x, y, false, rotation);
    building.hp = Math.max(1, Math.round(def.hp * 0.05));
    if (def.requires === 'stone' || def.requires === 'iron') {
      const dep = this.map.getDepositAt(x, y);
      building.depositId = dep ? dep.id : null;
    }
    this.buildings.push(building);
    this.rebuildBlockGrid();

    // Žádná jednotka nesmí uvíznout pod staveništěm ani uvnitř uzavřené budovy.
    for (const u of this.units) {
      if (building.containsTile(Math.floor(u.x), Math.floor(u.y)) ||
          (u.x >= x - 0.2 && u.x <= x + width + 0.2 && u.y >= y - 0.2 && u.y <= y + height + 0.2)) {
        const safe = findNearestWalkable(this.map, this.blockGrid, u.x, u.y, 10);
        if (safe) {
          u.x = safe.x + 0.5;
          u.y = safe.y + 0.5;
          u.setPath([]);
          u.moveTarget = null;
        }
      }
    }

    if (opts.notify !== false) {
      this.emit('toast', {
        playerId,
        ...notice('Stavba zahájena: {0}', { 0: { key: def.name } }),
        kind: 'info'
      });
    }
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
    const approach = this.findBuildingApproach(worker, b);
    if (approach) this.navigateTo(worker, approach.x, approach.y);
    this.emit('toast', { playerId, ...notice('Oprava zahájena: {0}', { 0: { key: b.config.name } }), kind: 'info' });
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
      ...notice('Budova zbořena: {0} (vráceno 50 % nákladů)', { 0: { key: b.config.name } }),
      kind: 'info'
    });
    return { ok: true };
  }

  releaseRepair(unit) {
    if (!unit.repairBuildingId) return;
    const b = this.buildings.find(x => x.id === unit.repairBuildingId);
    if (b && b.repair && b.repair.workerId === unit.id) b.repair = null;
    unit.repairBuildingId = null;
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
      this.emit('toast', { playerId: b.ownerId, ...notice('Oprava dokončena: {0}', { 0: { key: b.config.name } }), kind: 'success' });
      return;
    }
    const approach = this.findBuildingApproach(unit, b);
    const inReach = approach
      ? this.unitAt(unit, approach.x, approach.y, 1.2)
      : this.unitAt(unit, b.centerX, b.centerY, Math.max(b.width, b.height) / 2 + 1.6);
    if (!inReach) {
      if (unit.path.length === 0 && approach) {
        this.navigateTo(unit, approach.x, approach.y);
      }
      return;
    }
    b.hp = Math.min(b.maxHp, b.hp + 10 * dt);
    if (b.hp >= b.maxHp) {
      b.repair = null;
      unit.repairBuildingId = null;
      this.emit('toast', { playerId: b.ownerId, ...notice('Oprava dokončena: {0}', { 0: { key: b.config.name } }), kind: 'success' });
    }
  }

  updateBuildings(dt) {
    const builderCounts = this.getBuilderCounts();
    for (const b of this.buildings.slice()) {
      if (b.config.gate) this.updateGate(b);
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
            if (b.config.gate) this.updateGate(b);
            this.rebuildBlockGrid();
            // Po dokončení uzavřené budovy ověříme, že uvnitř nezůstala žádná jednotka.
            if (!def.passable && !(def.gate && b.gateOpen)) {
              for (const u of this.units) {
                if (b.containsTile(Math.floor(u.x), Math.floor(u.y))) {
                  const safe = findNearestWalkable(this.map, this.blockGrid, u.x, u.y, 10);
                  if (safe) {
                    u.x = safe.x + 0.5;
                    u.y = safe.y + 0.5;
                    u.setPath([]);
                    u.moveTarget = null;
                  }
                }
              }
            }
            this.continueBuildersAfter(b.id);
            this.emit('buildingComplete', {
              playerId: b.ownerId,
              x: b.centerX,
              y: b.centerY,
              name: def.name
            });
            this.emit('toast', {
              playerId: b.ownerId,
              ...notice('Stavba dokončena: {0}', { 0: { key: def.name } }),
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
}
