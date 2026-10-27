import { distanceToBuilding, isEnemy } from './sim-geometry.js';
import { findNearestWalkable } from './pathfinding.js';

export class SimulationGarrison {
  assignGarrison(playerId, buildingId, units) {
    const tower = this.buildings.find(b => b.id === buildingId);
    if (!tower || tower.type !== 'tower' || tower.ownerId !== playerId || !tower.complete) {
      return { ok: false, reason: 'Tuto věž nelze obsadit.' };
    }
    let reserved = this.units.filter(u => u.garrison?.towerId === tower.id).length;
    let assigned = 0;
    for (const unit of units) {
      if (unit.type !== 'archer' || unit.ownerId !== playerId || unit.hp <= 0) continue;
      if (unit.garrison?.towerId === tower.id) {
        assigned++;
        continue;
      }
      if (reserved >= tower.config.garrisonCapacity) break;
      const approach = this.findBuildingApproach(unit, tower);
      if (!approach) continue;
      if (unit.garrison && !this.leaveGarrison(unit)) continue;
      unit.clearOrders();
      if (!this.navigateTo(unit, approach.x, approach.y)) continue;
      unit.garrison = { towerId: tower.id, entered: false };
      unit.repathTimer = 1.5;
      assigned++;
      reserved++;
    }
    if (!assigned) return { ok: false, reason: 'Žádný lučištník se nemůže dostat do věže nebo je věž plná.' };
    return { ok: true, assigned };
  }

  leaveGarrison(unit) {
    if (!unit.garrison) return true;
    if (unit.garrison.entered) {
      const spot = findNearestWalkable(this.map, this.blockGrid, unit.x, unit.y, 15);
      if (!spot) return false;
      unit.x = spot.x + 0.5;
      unit.y = spot.y + 0.5;
    }
    unit.garrison = null;
    unit.clearOrders();
    return true;
  }

  releaseGarrison(playerId, buildingId) {
    const tower = this.buildings.find(b => b.id === buildingId);
    if (!tower || tower.type !== 'tower' || tower.ownerId !== playerId) {
      return { ok: false, reason: 'Tuto věž nelze ovládat.' };
    }
    let released = 0;
    for (const unit of this.units) {
      if (unit.garrison?.towerId === tower.id && this.leaveGarrison(unit)) released++;
    }
    if (!released) return { ok: false, reason: 'Z věže nelze nikoho vysadit.' };
    return { ok: true, released };
  }

  updateGarrison(unit) {
    const tower = this.buildings.find(b => b.id === unit.garrison.towerId);
    if (!tower || !tower.complete || tower.ownerId !== unit.ownerId) {
      if (!this.leaveGarrison(unit)) this.removeUnit(unit, { killed: true });
      return;
    }
    if (!unit.garrison.entered) {
      if (distanceToBuilding(unit.x, unit.y, tower) <= 1.1) {
        const occupants = this.units.filter(u => u !== unit && u.garrison?.towerId === tower.id && u.garrison.entered);
        const occupied = new Set(occupants.map(u => u.garrison.slot));
        const slot = [0, 1, 2, 3].find(i => !occupied.has(i));
        if (slot === undefined) return;
        unit.garrison.entered = true;
        unit.garrison.slot = slot;
        unit.x = tower.tileX + (slot % 2 ? 1.35 : 0.65);
        unit.y = tower.tileY + (slot >= 2 ? 1.35 : 0.65);
        unit.setPath([]);
        unit.pathGoal = null;
      } else if (!unit.path.length && unit.repathTimer <= 0) {
        const approach = this.findBuildingApproach(unit, tower);
        if (!approach || !this.navigateTo(unit, approach.x, approach.y)) {
          unit.garrison = null;
          return;
        }
        unit.repathTimer = 1.5;
      }
      return;
    }
    let target = unit.attackTargetId
      ? this.units.find(u => u.id === unit.attackTargetId) || this.buildings.find(b => b.id === unit.attackTargetId)
      : null;
    if (!target || target.hp <= 0 || !isEnemy(unit.ownerId, target.ownerId) ||
        this.targetDistance(unit, target) > unit.config.range + 2.55) {
      target = this.nearestEnemy(unit, unit.config.range + 2.55);
      unit.attackTargetId = target ? target.id : null;
    }
    if (target) {
      unit.angle = Math.atan2((target.y ?? target.centerY) - unit.y, (target.x ?? target.centerX) - unit.x);
      this.attackTarget(unit, target);
    }
  }
}
