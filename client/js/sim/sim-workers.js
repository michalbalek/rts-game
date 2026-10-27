import { dist } from './sim-geometry.js';
import { RESOURCE_TYPES } from './constants.js';
import { findPath } from './pathfinding.js';
import { NAV_MAX_NODES } from './sim-navigation.js';

export class SimulationWorkers {
  assignDirectGatherers(playerId, units, x, y) {
    if (!Number.isInteger(x) || !Number.isInteger(y) || !this.isExplored(playerId, x, y)) {
      return { ok: false, reason: 'Neplatný cíl.' };
    }
    const resource = this.map.getResource(x, y);
    const produce = resource === RESOURCE_TYPES.TREE ? 'wood'
      : resource === RESOURCE_TYPES.STONE ? 'stone'
        : resource === RESOURCE_TYPES.IRON ? 'iron' : null;
    const deposit = produce && produce !== 'wood' ? this.map.getDepositAt(x, y) : null;
    if (!produce || (produce !== 'wood' && !deposit)) return { ok: false, reason: 'Neplatný cíl.' };
    let assigned = 0;
    let carrying = 0;
    for (const u of units) {
      if (!u.isVillager || u.hp <= 0 || u.fleeing) continue;
      if (u.work && u.work.carry > 0) {
        carrying++;
        continue;
      }
      const approach = this.findTreeApproach(x, y, this.unitRegions(u));
      const path = approach && findPath(this.map, this.blockGrid, u.x, u.y,
        approach.x + 0.5, approach.y + 0.5, NAV_MAX_NODES);
      if (!path) continue;
      if (u.work) this.releaseWorker(u, false);
      this.releaseBuilder(u, false);
      this.releaseRepair(u);
      u.clearOrders();
      u.autoAttack = false;
      u.workPaused = false;
      u.work = {
        buildingId: null, direct: true, targetX: x, targetY: y,
        depositId: deposit ? deposit.id : null, produce, phase: 'toSource',
        carry: 0, timer: 0, source: { sx: x, sy: y, px: approach.x, py: approach.y,
          depositId: deposit ? deposit.id : null },
        storageId: null, waitTimer: 0, roamWait: 0, arrived: true,
        depleted: false, fullStorage: false
      };
      u.setPath(path);
      assigned++;
    }
    if (!assigned) {
      return { ok: false, reason: carrying
        ? 'Vybraní poddaní nejdřív odevzdají náklad do skladu.'
        : 'Cesta k cíli neexistuje.' };
    }
    if (carrying) this.noticeCarrying(playerId);
    return { ok: true, assigned };
  }

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
}
