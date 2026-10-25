import {
  BOT_BUILD_ORDER, BUILDING_DEFS, UNIT_DEFS, BOT_DIFFICULTIES,
  RESOURCE_TYPES
} from './constants.js';

const BOT_BUILDERS = 3;

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

  // Daň: při nespokojenosti bot uleví lidu.
  if (player.popularity < 45 && player.tax !== 'low') player.tax = 'low';
  else if (player.popularity > 72 && player.tax !== 'medium') player.tax = 'medium';

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
  for (const site of sites) {
    const need = BOT_BUILDERS - (counts.get(site.id)?.total || 0);
    if (need <= 0 || !idle.length) continue;
    idle.sort((a, c) =>
      Math.hypot(a.x - site.centerX, a.y - site.centerY) - Math.hypot(c.x - site.centerX, c.y - site.centerY)
    );
    const unitIds = idle.splice(0, need).map(u => u.id);
    sim.command(player.id, { op: 'construct', buildingId: site.id, unitIds });
  }
}

function assignWorkers(sim, player, castle) {
  const workers = sim.units.filter(u => u.ownerId === player.id && u.isVillager && u.work);
  const idle = sim.units.filter(u =>
    u.ownerId === player.id && u.isVillager && !u.work && !u.build && !u.repairBuildingId && !u.fleeing
  );
  // Necháváme část poddaných k dispozici pro armádu.
  const reserve = Math.max(4, Math.ceil(player.capacity * 0.22));
  if (idle.length <= reserve) return;

  const production = sim.buildings.filter(b =>
    b.ownerId === player.id && b.complete && (b.config.workers || 0) > 0
  );
  const priority = ['orchard', 'lumberjack', 'quarry', 'ironmine'];
  if (player.resources.food > 120) priority.sort((a, b) => orderIndex(a) - orderIndex(b));

  for (const type of priority) {
    // Na cestě do budovy už dělník zabírá místo, i když se do b.workers
    // započítá až po příchodu.
    const b = production.find(x =>
      x.type === type &&
      (x.assignedWorkerIds ? x.assignedWorkerIds.length : x.workers) < x.config.workers
    );
    if (!b) continue;
    if (b.type === 'ironmine' || b.type === 'quarry') {
      const dep = sim.map.deposits.find(d => d.id === b.depositId);
      if (!dep || !dep.active) continue;
    }
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
}

function orderIndex(type) {
  const idx = BOT_BUILD_ORDER.indexOf(type);
  return idx === -1 ? 99 : idx;
}

function tryBuild(sim, player, castle) {
  const bot = player.bot;

  // Po dokončení základního pořadí řeší kapacitu a sklady.
  if (bot.nextBuild >= BOT_BUILD_ORDER.length) {
    maybeExpand(sim, player, castle);
    bot.nextBuild = BOT_BUILD_ORDER.length;
    return;
  }

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

    if (!sim.canAfford(player.id, def.cost)) return;

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
  const hasDwellingBuilding = sim.buildings.some(b => b.ownerId === player.id && b.type === 'dwelling' && !b.complete);
  if (player.capacity - player.population <= 3 && !hasDwellingBuilding) {
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
  }
}

function buildExtra(sim, player, castle, type) {
  const def = BUILDING_DEFS[type];
  if (!sim.canAfford(player.id, def.cost)) return;
  const spot = findBuildSpot(sim, player, castle, type);
  if (spot) {
    sim.command(player.id, { op: 'build', buildingType: type, x: spot.x, y: spot.y });
  }
}

function findBuildSpot(sim, player, castle, type) {
  const def = BUILDING_DEFS[type];
  if (type === 'quarry' || type === 'ironmine') {
    const wanted = type === 'quarry' ? 'stone' : 'iron';
    const deposits = sim.map.deposits
      .filter(d => d.active && d.type === wanted)
      .sort((a, b) => depositDistance(a, castle, sim.map.size) - depositDistance(b, castle, sim.map.size));
    for (const dep of deposits) {
      for (const idx of dep.tiles) {
        const x = idx % sim.map.size;
        const y = Math.floor(idx / sim.map.size);
        const check = sim.canPlaceBuilding(player.id, type, x, y);
        if (check.valid) return { x, y };
      }
    }
    return null;
  }

  if (type === 'lumberjack') {
    let best = null;
    let bestD = Infinity;
    const cx = Math.floor(castle.centerX);
    const cy = Math.floor(castle.centerY);
    const r = 34;
    for (let y = Math.max(1, cy - r); y <= Math.min(sim.map.size - 2, cy + r); y++) {
      for (let x = Math.max(1, cx - r); x <= Math.min(sim.map.size - 2, cx + r); x++) {
        if (sim.map.getResource(x, y) !== RESOURCE_TYPES.TREE) continue;
        const d = Math.hypot(x - cx, y - cy);
        if (d >= bestD) continue;
        if (!sim.canPlaceBuilding(player.id, type, x, y).valid) continue;
        best = { x, y };
        bestD = d;
      }
    }
    return best;
  }

  // Obecná stavba – spirála kolem hradu.
  const centerX = castle.centerX;
  const centerY = castle.centerY;
  for (let ring = 5; ring <= 38; ring += 1.5) {
    const steps = Math.max(10, Math.round(ring * 2.1));
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2 + (ring % 3) * 0.4;
      const x = Math.round(centerX + Math.cos(angle) * ring - def.w / 2);
      const y = Math.round(centerY + Math.sin(angle) * ring - def.h / 2);
      if (sim.canPlaceBuilding(player.id, type, x, y).valid) return { x, y };
    }
  }
  return null;
}

function depositDistance(dep, castle, size) {
  let best = Infinity;
  for (const idx of dep.tiles) {
    const x = idx % size;
    const y = Math.floor(idx / size);
    const d = Math.hypot(x - castle.centerX, y - castle.centerY);
    if (d < best) best = d;
  }
  return best;
}

function tryTrade(sim, player) {
  const market = sim.buildings.find(b => b.ownerId === player.id && b.complete && b.type === 'market');
  if (!market) return;
  if (player.resources.food < player.population * 0.45 && player.resources.money >= 80) {
    const caps = sim.getStorageCaps(player.id);
    const free = caps.food - player.resources.food;
    const amount = Math.min(50, Math.floor(player.resources.money / 8), Math.floor(free));
    if (amount >= 5) sim.command(player.id, { op: 'buy', resource: 'food', amount });
  }
  if (player.resources.wood < 40 && player.resources.money >= 80) {
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
