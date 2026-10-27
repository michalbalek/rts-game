import { BUILD } from './constants.js';
import { findPath } from './pathfinding.js';
import { distanceToBuilding } from './sim-geometry.js';

export class SimulationBuilders {
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

  continueBuildersAfter(buildingId) {
    for (const unit of this.units) {
      if (!unit.build || unit.build.buildingId !== buildingId) continue;
      if (unit.isVillager && unit.hp > 0 && !unit.fleeing) {
        const sites = this.buildings
          .filter(b => b.ownerId === unit.ownerId && !b.complete && b.config.buildTime > 0)
          .map(b => ({ building: b, distance: distanceToBuilding(unit.x, unit.y, b) }))
          .filter(site => site.distance <= BUILD.autoSearchRadius)
          .sort((a, b) => a.distance - b.distance || a.building.id - b.building.id);
        if (sites.some(site => this.assignBuilders(unit.ownerId, site.building.id, [unit]).ok)) continue;
      }
      this.releaseBuilder(unit, true);
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
}
