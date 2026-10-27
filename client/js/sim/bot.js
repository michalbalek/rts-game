import {
  BOT_BUILD_ORDER, BUILDING_DEFS, UNIT_DEFS, BOT_DIFFICULTIES
} from './constants.js';
import {
  needsMarketFirst, moneyReserve, enemiesNearCastle, gatherMissing, sellSurplus, foodLow, wantsHousing,
  urgentBuilding, employIdle
} from './bot-economy.js';
import { findBuildSpot } from './bot-placement.js';

const BOT_BUILDERS = 3;
const EXTRA_PRODUCTION = { lumberjack: 3, orchard: 2 };

/**
 * Jednoduchý, ale schopný bot podle dokumentace:
 * - staví v daném pořadí a dodržuje volný pruh,
 * - přiřazuje dělníky do hospodářství,
 * - drží třetinu vojska u hradu a zbytek posílá na nejbližší nepřátelskou budovu,
 * - obtížnost ovlivňuje rychlost sběru, práh útoku a dobu prvního útoku.
 */
export function updateBot(sim, player, dt) {
  if (!player.alive || !player.isBot) return;
  const castle = sim.getCastle(player.id);
  if (!castle) return;

  assignBuilders(sim, player);
  assignWorkers(sim, player, castle);
  tryBuild(sim, player, castle);
  tryTrade(sim, player);
  trainArmy(sim, player, castle);
  handleArmy(sim, player, castle);
}

function assignBuilders(sim, player) {
  const sites = sim.buildings.filter(b =>
    b.ownerId === player.id && !b.complete && b.config.buildTime > 0
  );
  if (!sites.length) return;
  const counts = sim.getBuilderCounts();
  // Stavitelé nečerpají ze zálohy pro armádu, jinak by staveniště zůstala bez nich.
  const idle = sim.units.filter(u =>
    u.ownerId === player.id && u.isVillager && !u.work && !u.build && !u.repairBuildingId && !u.fleeing
  );
  // Když volní poddaní nestačí, převezmou stavbu přímí sběrači bez nákladu –
  // stavba (např. obydlí) má přednost před těžbou na prodej.
  const gatherers = sim.units.filter(u =>
    u.ownerId === player.id && u.work?.direct && u.work.carry === 0 && !u.fleeing
  );
  for (const site of sites) {
    const need = BOT_BUILDERS - (counts.get(site.id)?.total || 0);
    if (need <= 0) continue;
    const pool = idle.length ? idle : gatherers;
    if (!pool.length) continue;
    pool.sort((a, c) =>
      Math.hypot(a.x - site.centerX, a.y - site.centerY) - Math.hypot(c.x - site.centerX, c.y - site.centerY)
    );
    const unitIds = pool.splice(0, need).map(u => u.id);
    sim.command(player.id, { op: 'construct', buildingId: site.id, unitIds });
  }
}

function assignWorkers(sim, player, castle) {
  const idle = sim.units.filter(u =>
    u.ownerId === player.id && u.isVillager && !u.work && !u.build && !u.repairBuildingId && !u.fleeing
  );
  // Necháváme část poddaných k dispozici pro armádu.
  const reserve = Math.max(4, Math.ceil(player.capacity * 0.22));
  const production = sim.buildings.filter(b =>
    b.ownerId === player.id && b.complete && (b.config.workers || 0) > 0
  );
  const hasFreeSlot = b => {
    if ((b.assignedWorkerIds ? b.assignedWorkerIds.length : b.workers) >= b.config.workers) return false;
    if (b.type !== 'ironmine' && b.type !== 'quarry') return true;
    const dep = sim.map.deposits.find(d => d.id === b.depositId);
    return !!dep && dep.active;
  };
  if (idle.length <= reserve) {
    // Pracoviště mají přednost před přímým sběrem, který je daleko od skladu.
    // Uvolněný sběrač se hned přiřadí, jinak by ho přímý sběr vzápětí znovu odvedl.
    const workplace = production.find(hasFreeSlot);
    if (!workplace) return;
    const gatherer = sim.units.find(u => u.ownerId === player.id && u.work?.direct && u.work.carry === 0);
    if (gatherer && sim.command(player.id, { op: 'release', unitIds: [gatherer.id] }).ok) {
      sim.command(player.id, { op: 'assign', buildingId: workplace.id, count: 1 });
    }
    return;
  }

  const priority = ['orchard', 'lumberjack', 'quarry', 'ironmine'];
  if (player.resources.food > 120) priority.sort((a, b) => orderIndex(a) - orderIndex(b));

  for (const type of priority) {
    // Na cestě do budovy už dělník zabírá místo, i když se do b.workers
    // započítá až po příchodu.
    const b = production.find(x => x.type === type && hasFreeSlot(x));
    if (!b) continue;
    if (idle.length <= reserve) break;
    const res = sim.command(player.id, { op: 'assign', buildingId: b.id, count: 1 });
    if (res.ok) {
      idle.pop();
    }
  }
  // Pokud je dělníků málo a jídlo dochází, přesuň jednoho z dřeva na sad.
  const orchard = production.find(b => b.type === 'orchard');
  const lumber = production.find(b => b.type === 'lumberjack');
  const orchardWorkers = orchard
    ? (orchard.assignedWorkerIds ? orchard.assignedWorkerIds.length : orchard.workers)
    : 0;
  const lumberWorkers = lumber
    ? (lumber.assignedWorkerIds ? lumber.assignedWorkerIds.length : lumber.workers)
    : 0;
  if (orchard && lumber && orchardWorkers === 0 && player.resources.food < player.population && lumberWorkers > 1) {
    sim.command(player.id, { op: 'unassign', buildingId: lumber.id, count: 1 });
    sim.command(player.id, { op: 'assign', buildingId: orchard.id, count: 1 });
  }
  employIdle(sim, player, castle, reserve);
}

function orderIndex(type) {
  const idx = BOT_BUILD_ORDER.indexOf(type);
  return idx === -1 ? 99 : idx;
}

function tryBuild(sim, player, castle) {
  const bot = player.bot;

  if (needsMarketFirst(sim, player)) {
    const market = BUILDING_DEFS.market;
    if (!sim.canAfford(player.id, market.cost)) {
      gatherMissing(sim, player, castle, market.cost, 6);
      return;
    }
    const spot = findBuildSpot(sim, player, castle, 'market');
    if (spot) sim.command(player.id, { op: 'build', buildingType: 'market', x: spot.x, y: spot.y });
    return;
  }

  const urgent = urgentBuilding(sim, player);
  if (urgent) {
    const def = BUILDING_DEFS[urgent];
    if (!sim.canAfford(player.id, def.cost)) {
      gatherMissing(sim, player, castle, def.cost);
      return;
    }
    const spot = findBuildSpot(sim, player, castle, urgent);
    if (spot) {
      sim.command(player.id, { op: 'build', buildingType: urgent, x: spot.x, y: spot.y });
      return;
    }
  }

  // Po dokončení základního pořadí řeší kapacitu a sklady.
  if (bot.nextBuild >= BOT_BUILD_ORDER.length) {
    maybeExpand(sim, player, castle);
    bot.nextBuild = BOT_BUILD_ORDER.length;
    return;
  }
  if (wantsHousing(sim, player)) buildExtra(sim, player, castle, 'dwelling');

  let guard = 0;
  while (bot.nextBuild < BOT_BUILD_ORDER.length && guard++ < BOT_BUILD_ORDER.length) {
    const type = BOT_BUILD_ORDER[bot.nextBuild];
    const def = BUILDING_DEFS[type];
    const underConstruction = sim.buildings.some(b =>
      b.ownerId === player.id && b.type === type && !b.complete
    );
    if (underConstruction) return;

    const exists = sim.buildings.some(b => b.ownerId === player.id && b.type === type);
    if (exists) {
      bot.nextBuild++;
      continue;
    }

    if (!sim.canAfford(player.id, def.cost)) {
      gatherMissing(sim, player, castle, def.cost);
      return;
    }

    const spot = findBuildSpot(sim, player, castle, type);
    if (!spot) {
      // Zkusit později (např. chybí ložisko).
      if (type === 'ironmine' || type === 'market') bot.nextBuild++;
      return;
    }

    const result = sim.command(player.id, {
      op: 'build', buildingType: type, x: spot.x, y: spot.y
    });
    if (result.ok) {
      bot.nextBuild++;
    } else {
      bot.nextBuild++;
    }
    return;
  }
}

function maybeExpand(sim, player, castle) {
  if (wantsHousing(sim, player)) {
    buildExtra(sim, player, castle, 'dwelling');
    return;
  }
  const caps = sim.getStorageCaps(player.id);
  const stored = sim.getStoredResources(player.id);
  if (caps.resources > 0 && stored / caps.resources > 0.85) {
    const building = sim.buildings.some(b => b.ownerId === player.id && b.type === 'warehouse' && !b.complete);
    if (!building) buildExtra(sim, player, castle, 'warehouse');
    return;
  }
  if (caps.food > 0 && player.resources.food / caps.food > 0.85) {
    const building = sim.buildings.some(b => b.ownerId === player.id && b.type === 'granary' && !b.complete);
    if (!building) buildExtra(sim, player, castle, 'granary');
    return;
  }
  expandProduction(sim, player, castle);
}

// Stojí-li u ohniště mnoho volných poddaných a všechna pracoviště jsou plná,
// postaví bot další dřevorubce nebo sad – víc surovin znamená víc peněz z prodeje.
function expandProduction(sim, player, castle) {
  const own = sim.buildings.filter(b => b.ownerId === player.id);
  if (own.some(b => !b.complete)) return;
  const freeSlots = own.some(b => b.complete && (b.config.workers || 0) > 0 &&
    (b.assignedWorkerIds ? b.assignedWorkerIds.length : b.workers) < b.config.workers);
  if (freeSlots) return;
  const idle = sim.units.filter(u =>
    u.ownerId === player.id && u.isVillager && !u.work && !u.build && !u.repairBuildingId).length;
  if (idle < Math.max(4, Math.ceil(player.capacity * 0.22)) + 4) return;
  const count = type => own.filter(b => b.type === type).length;
  const wantFood = player.resources.food < player.population * 3;
  const order = wantFood ? ['orchard', 'lumberjack'] : ['lumberjack', 'orchard'];
  const type = order.find(t => count(t) < EXTRA_PRODUCTION[t]);
  if (type) buildExtra(sim, player, castle, type);
}

function buildExtra(sim, player, castle, type) {
  const def = BUILDING_DEFS[type];
  if (!sim.canAfford(player.id, def.cost)) return;
  const spot = findBuildSpot(sim, player, castle, type);
  if (spot) {
    sim.command(player.id, { op: 'build', buildingType: type, x: spot.x, y: spot.y });
  }
}

function tryTrade(sim, player) {
  const market = sim.buildings.find(b => b.ownerId === player.id && b.complete && b.type === 'market');
  if (!market) return;
  sellSurplus(sim, player);
  const hungry = foodLow(player);
  if (hungry && player.resources.money >= 40) {
    const caps = sim.getStorageCaps(player.id);
    const free = caps.food - player.resources.food;
    const amount = Math.min(50, Math.floor(player.resources.money / 8), Math.floor(free));
    if (amount >= 5) sim.command(player.id, { op: 'buy', resource: 'food', amount });
  }
  if (!hungry && player.resources.wood < 40 && player.resources.money >= 80) {
    const caps = sim.getStorageCaps(player.id);
    const free = caps.resources - sim.getStoredResources(player.id);
    const amount = Math.min(20, Math.floor(player.resources.money / 10), Math.floor(free));
    if (amount >= 5) sim.command(player.id, { op: 'buy', resource: 'wood', amount });
  }
}

function trainArmy(sim, player, castle) {
  const difficulty = BOT_DIFFICULTIES[player.difficulty] || BOT_DIFFICULTIES.medium;
  const military = sim.units.filter(u => u.ownerId === player.id && u.isMilitary);
  const queued = sim.buildings
    .filter(b => b.ownerId === player.id)
    .reduce((sum, b) => sum + b.queue.length, 0);
  const target = difficulty.attackArmy + 10;
  if (military.length + queued >= target) return;

  const barracks = sim.buildings.find(b =>
    b.ownerId === player.id && b.complete && b.type === 'barracks'
  );
  const producer = barracks || castle;
  if (producer.queue.length >= 2) return;

  const unitType = barracks ? 'archer' : 'swordsman';
  const def = UNIT_DEFS[unitType];
  if (!sim.canAfford(player.id, def.cost)) return;
  const threatened = enemiesNearCastle(sim, player, castle);
  if (!threatened && player.resources.money - def.cost.money < moneyReserve(sim, player)) return;
  if (!sim.findIdleVillager(player.id)) return;
  sim.command(player.id, { op: 'train', buildingId: producer.id, unitType });
}

function handleArmy(sim, player, castle) {
  const difficulty = BOT_DIFFICULTIES[player.difficulty] || BOT_DIFFICULTIES.medium;
  const military = sim.units.filter(u => u.ownerId === player.id && u.isMilitary);
  if (!military.length) return;

  const desiredGuards = Math.ceil(military.length / 3);
  let guards = military.filter(u => u.botGuard);
  if (guards.length < desiredGuards) {
    // Povýšit jednotky, které jsou hradu nejblíž, na strážce.
    const candidates = military.filter(u => !u.botGuard)
      .sort((a, b) =>
        Math.hypot(a.x - castle.centerX, a.y - castle.centerY) -
        Math.hypot(b.x - castle.centerX, b.y - castle.centerY)
      );
    while (guards.length < desiredGuards && candidates.length) {
      const u = candidates.shift();
      u.botGuard = true;
      u.attackTargetId = null;
      const spot = sim.idleSpot(player.id, u.id, 3.2);
      sim.navigateTo(u, spot.x, spot.y);
      guards.push(u);
    }
  }

  for (const g of guards) {
    const d = Math.hypot(g.x - castle.centerX, g.y - castle.centerY);
    if (!g.attackTargetId && g.path.length === 0 && d > 16) {
      const spot = sim.idleSpot(player.id, g.id, 3.2);
      sim.navigateTo(g, spot.x, spot.y);
    }
  }

  const attackers = military.filter(u => !u.botGuard);
  if (player.bot.attackTimer > 0) {
    player.bot.attackTimer -= 1;
    return;
  }
  player.bot.attackTimer = 5;

  if (sim.time < difficulty.attackAfter) return;
  if (military.length < difficulty.attackArmy) return;
  if (attackers.length < 3) return;
  if (sim.time - player.bot.lastAttack < 35) return;

  const target = nearestEnemyBuilding(sim, player, castle);
  if (!target) return;
  sim.command(player.id, {
    op: 'attack',
    unitIds: attackers.map(u => u.id),
    targetId: target.id
  });
  player.bot.lastAttack = sim.time;
}

function nearestEnemyBuilding(sim, player, castle) {
  let best = null;
  let bestD = Infinity;
  for (const b of sim.buildings) {
    if (b.ownerId === 0 || b.ownerId === player.id) continue;
    const owner = sim.getPlayer(b.ownerId);
    if (!owner || !owner.alive) continue;
    const d = Math.hypot(b.centerX - castle.centerX, b.centerY - castle.centerY);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}
