import { RESOURCE_TYPES, WORK, DEPOSITS, DELIVERY } from './constants.js';
import { findPath, findNearestWalkable } from './pathfinding.js';
import { dist } from './sim-geometry.js';
import { NAV_MAX_NODES } from './sim-navigation.js';

export class SimulationGathering {
  findSource(unit, b) {
    const player = this.getPlayer(unit.ownerId);
    if (!player) return null;
    const def = b.config;
    if (def.produce === 'wood') return this.findTreeSource(unit, b);
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

  // Nejbližší strom od budovy, ne od dělníka: jinak by po každém doručení k hradu kácel
  // stromy u hradu. Hledá se po celé mapě, stromy v jiné oblasti (za vodou, skálou nebo
  // budovou) se přeskočí. Nejlepší kandidáty se ještě ověří A*.
  findTreeSource(unit, b) {
    const regions = this.unitRegions(unit);
    if (regions.length === 0) return null;
    const size = this.map.size;
    const candidates = [];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (this.map.getResource(x, y) !== RESOURCE_TYPES.TREE) continue;
        const approach = this.findTreeApproach(x, y, regions);
        if (!approach) continue;
        candidates.push({
          toBuilding: dist(x, y, b.centerX, b.centerY),
          toUnit: dist(approach.x, approach.y, unit.x, unit.y),
          sx: x,
          sy: y,
          px: approach.x,
          py: approach.y
        });
      }
    }
    candidates.sort((p, q) => p.toBuilding - q.toBuilding || p.toUnit - q.toUnit);
    for (const c of candidates.slice(0, 8)) {
      if (findPath(this.map, this.blockGrid, unit.x, unit.y, c.px, c.py, NAV_MAX_NODES)) {
        return { sx: c.sx, sy: c.sy, px: c.px, py: c.py };
      }
    }
    return null;
  }

  findTreeApproach(x, y, regions) {
    const size = this.map.size;
    let best = null;
    let bestD = Infinity;
    for (let ty = Math.max(0, y - 2); ty <= Math.min(size - 1, y + 2); ty++) {
      for (let tx = Math.max(0, x - 2); tx <= Math.min(size - 1, x + 2); tx++) {
        if (!this.isWalkableTile(tx, ty)) continue;
        if (!regions.includes(this.regionGrid[ty * size + tx])) continue;
        const d = dist(tx, ty, x, y);
        if (d < bestD) {
          bestD = d;
          best = { x: tx, y: ty };
        }
      }
    }
    return best;
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
    const types = DELIVERY[resource];
    if (!types) return castle;
    let best = null;
    let bestD = Infinity;
    for (const b of this.buildings) {
      if (b.ownerId !== playerId || !b.complete || !types.includes(b.type)) continue;
      const d = dist(unit.x, unit.y, b.centerX, b.centerY);
      // Sklad, do kterého dělník nedojde (jiná oblast), nevybírat.
      if (d < bestD && this.findBuildingApproach(unit, b)) {
        bestD = d;
        best = b;
      }
    }
    // Když žádná cílová budova není dosažitelná, náklad jde do hradu.
    return best || castle;
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
}
