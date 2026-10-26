import { MARKET_PRICES, WORK, STORAGE } from './constants.js';

export class SimulationEconomy {
  getStorageCaps(playerId) {
    let warehouses = 0;
    let granaries = 0;
    for (const b of this.buildings) {
      if (b.ownerId !== playerId || !b.complete) continue;
      if (b.type === 'warehouse') warehouses++;
      if (b.type === 'granary') granaries++;
      if (b.type === 'castle') {
        warehouses += 1;
        granaries += 1;
      }
    }
    return {
      resources: warehouses * STORAGE.baseResource,
      food: granaries * STORAGE.baseFood
    };
  }

  getStoredResources(playerId) {
    const p = this.getPlayer(playerId);
    return p ? p.resources.wood + p.resources.stone + p.resources.iron : 0;
  }

  // Volné místo ve skladech po celých jednotkách.
  freeStorage(playerId, type) {
    const p = this.getPlayer(playerId);
    if (!p) return 0;
    const caps = this.getStorageCaps(playerId);
    if (type === 'food') return Math.floor(Math.max(0, caps.food - p.resources.food));
    return Math.floor(Math.max(0, caps.resources - this.getStoredResources(playerId)));
  }

  addResource(playerId, type, amount) {
    const p = this.getPlayer(playerId);
    if (!p || amount <= 0) return 0;
    if (type === 'money') {
      p.resources.money += amount;
      return amount;
    }
    const accepted = Math.min(amount, this.freeStorage(playerId, type));
    p.resources[type] += accepted;
    return accepted;
  }

  canAfford(playerId, cost) {
    const p = this.getPlayer(playerId);
    if (!p || !cost) return false;
    for (const key of ['money', 'wood', 'stone', 'food', 'iron']) {
      if ((cost[key] || 0) > p.resources[key] + 1e-6) return false;
    }
    return true;
  }

  spend(playerId, cost) {
    const p = this.getPlayer(playerId);
    if (!p) return false;
    if (!this.canAfford(playerId, cost)) return false;
    for (const key of ['money', 'wood', 'stone', 'food', 'iron']) {
      p.resources[key] = Math.max(0, p.resources[key] - (cost[key] || 0));
    }
    return true;
  }

  grantCost(playerId, cost, ratio = 0.5) {
    const p = this.getPlayer(playerId);
    if (!p) return;
    for (const key of ['money', 'wood', 'stone']) {
      const amount = Math.floor((cost[key] || 0) * ratio);
      if (amount > 0) this.addResource(playerId, key, amount);
    }
  }

  updateEconomy(dt) {
    for (const player of this.players) {
      if (!player.alive) continue;
      const p = player.resources;

      // Spotřeba jídla
      let workers = 0;
      let soldiers = 0;
      for (const u of this.units) {
        if (u.ownerId !== player.id) continue;
        if (u.isVillager) {
          // Při nedostatku se počítají i dělníci s pozastavenou prací, jinak by stav každý tik kmital.
          if ((u.work || u.build) && (!u.workPaused || player.foodShortage)) workers++;
        } else if (u.isMilitary) soldiers++;
      }
      const needPerSec = (workers * WORK.foodPerWorkerMinute + soldiers * WORK.foodPerSoldierMinute) / 60;
      const need = needPerSec * dt;
      if (need > 0) {
        // Spotřeba se počítá průběžně, ze zásob se ale odečítají jen celé jednotky.
        player.foodDebt += need;
        const due = Math.floor(player.foodDebt);
        if (due > 0) {
          player.foodDebt -= due;
          p.food = Math.max(0, p.food - due);
        }
        // Stav se počítá v každém tiku, jinak by pozastavení trvalo i po doplnění jídla.
        player.foodShortage = p.food < 1;
        if (player.foodShortage && this.foodWarnTimer <= 0 && player.id === this.humanId) {
          this.emit('toast', { playerId: player.id, text: 'Sýpka je prázdná! Dělníci přestali pracovat, kromě sadu.', kind: 'error' });
          this.foodWarnTimer = 12;
        }
      } else {
        player.foodShortage = false;
      }

      // Přírůstek poddaných
      if (player.population < player.capacity && this.getCastle(player.id)) {
        player.spawnTimer -= dt;
        if (player.spawnTimer <= 0) {
          player.spawnTimer = 5;
          this.spawnVillager(player.id, this.getCastle(player.id));
          this.recountPopulation(player.id);
          this.emit('citizen', { playerId: player.id });
        }
      } else {
        player.spawnTimer = 5;
      }

      if (!this.fogEnabled) continue;
    }
    this.foodWarnTimer = Math.max(0, this.foodWarnTimer - dt);
    this.slowTimer = Math.max(0, this.slowTimer - dt);
  }

  enforceStorageCaps(playerId) {
    const player = this.getPlayer(playerId);
    if (!player) return;
    const caps = this.getStorageCaps(playerId);
    let total = this.getStoredResources(playerId);
    if (total > caps.resources) {
      let excess = total - caps.resources;
      for (const key of ['iron', 'stone', 'wood']) {
        if (excess <= 0) break;
        const take = Math.min(player.resources[key], excess);
        player.resources[key] -= take;
        excess -= take;
      }
    }
    if (player.resources.food > caps.food) {
      player.resources.food = caps.food;
    }
  }

  marketTrade(playerId, resource, amount, mode) {
    const price = MARKET_PRICES[resource];
    const player = this.getPlayer(playerId);
    if (!player || !player.alive) return { ok: false, reason: 'Vaše panství již padlo.' };
    if (!price) return { ok: false, reason: 'Neplatná surovina.' };
    amount = Math.floor(amount);
    if (amount <= 0 || amount > 5000) return { ok: false, reason: 'Neplatné množství.' };
    const hasMarket = this.buildings.some(b => b.ownerId === playerId && b.complete && b.type === 'market');
    if (!hasMarket) return { ok: false, reason: 'Nejprve postavte Obchod.' };

    if (mode === 'buy') {
      const total = price.buy * amount;
      if (player.resources.money < total) return { ok: false, reason: 'Nedostatek peněz.' };
      const caps = this.getStorageCaps(playerId);
      const free = resource === 'food'
        ? caps.food - player.resources.food
        : caps.resources - this.getStoredResources(playerId);
      if (free < amount) {
        const where = resource === 'food' ? 'V sýpkách' : 'Ve skladech';
        return { ok: false, reason: `${where} není dost místa.` };
      }
      player.resources.money -= total;
      player.resources[resource] += amount;
      return { ok: true, spent: total };
    }
    if (player.resources[resource] < amount) return { ok: false, reason: 'Nemáte dost surovin k prodeji.' };
    player.resources[resource] -= amount;
    player.resources.money += price.sell * amount;
    return { ok: true, earned: price.sell * amount };
  }
}
