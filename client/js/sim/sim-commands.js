import { isEnemy } from './sim-geometry.js';

export class SimulationCommands {
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
        return { ok: result.valid, reason: result.reason, message: result.message, buildingId: result.building ? result.building.id : null };
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
}
