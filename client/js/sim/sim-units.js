import { START_POSITIONS, UNIT_DEFS } from './constants.js';
import { Building, Unit } from './entities.js';
import { findNearestWalkable } from './pathfinding.js';
import { dist } from './sim-geometry.js';

export class SimulationUnits {
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
      const safe = findNearestWalkable(this.map, this.blockGrid, building.centerX, building.centerY, 15);
      return safe ? { x: safe.x + 0.5, y: safe.y + 0.5 } : { x: building.centerX, y: building.centerY };
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
}
