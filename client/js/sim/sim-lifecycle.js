import { GAME_MODES } from './constants.js';

export class SimulationLifecycle {
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
}
